-- Accounts and sign-in.
--
-- Better Auth handles sign-in and sessions, as homing_auth. Its tables live
-- in their own schema: sign-in code can't read space data, and homing_app
-- can't read passwords, passkeys or sessions. An account has the same id as
-- its person, and people join only through an invite.

do $$
begin
  if not exists (select from pg_roles where rolname = 'homing_auth') then
    create role homing_auth;
  end if;
end
$$;

create schema auth;
grant usage on schema auth to homing_auth;
alter default privileges in schema auth grant select, insert, update, delete on tables to homing_auth;

-- Better Auth's tables, as it generates them for the passkey plugin, with
-- each account tied to its person and each passkey to one account. A test
-- checks they still match. The person is created after the account, in the
-- same sign-up, so the tie is checked when the sign-up commits.

create table auth."user" (
  "id" uuid not null primary key references public.people (id) on delete cascade deferrable initially deferred,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null,
  "image" text,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz default current_timestamp not null
);

create table auth."session" (
  "id" uuid default gen_random_uuid() not null primary key,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid not null references auth."user" ("id") on delete cascade
);

create table auth."account" (
  "id" uuid default gen_random_uuid() not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" uuid not null references auth."user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz not null
);

create table auth."verification" (
  "id" uuid default gen_random_uuid() not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz default current_timestamp not null
);

create table auth."passkey" (
  "id" uuid default gen_random_uuid() not null primary key,
  "name" text,
  "publicKey" text not null,
  "userId" uuid not null references auth."user" ("id") on delete cascade,
  "credentialID" text not null,
  "counter" integer not null,
  "deviceType" text not null,
  "backedUp" boolean not null,
  "transports" text,
  "createdAt" timestamptz,
  "aaguid" text
);

create index "session_userId_idx" on auth."session" ("userId");
create index "account_userId_idx" on auth."account" ("userId");
create index "verification_identifier_idx" on auth."verification" ("identifier");
create index "passkey_userId_idx" on auth."passkey" ("userId");
create unique index "passkey_credentialID_idx" on auth."passkey" ("credentialID");

-- Nobody loses their last way to sign in. Removing a passkey needs another
-- passkey or a password left, checked under a lock on the account, so two
-- removals at once can't both pass.
create function auth.keep_a_way_to_sign_in() returns trigger
language plpgsql set search_path = auth, pg_temp
as $$
begin
  perform from auth."user" u where u.id = old."userId" for update;
  if not found then
    -- The account itself is going, and its passkeys with it.
    return old;
  end if;
  if not exists (select from auth."passkey" p where p."userId" = old."userId" and p.id <> old.id)
    and not exists (select from auth."account" a where a."userId" = old."userId" and a."providerId" = 'credential') then
    raise exception 'this is the last way to sign in to the account' using errcode = 'check_violation';
  end if;
  return old;
end
$$;

create trigger keep_a_way_to_sign_in before delete on auth."passkey"
for each row execute function auth.keep_a_way_to_sign_in();

-- The instance admin invites people. It gives no access to any space.
alter table people add column instance_admin boolean not null default false;

-- An invite is a one-time link for creating an account. Only a hash of the
-- token in the link is kept. The setup link, shown when the server starts
-- before anyone can look after the instance, is an invite whose account
-- becomes the instance admin.
create table invites (
  id uuid primary key default gen_random_uuid(),
  hash bytea not null unique,
  instance_admin boolean not null default false,
  expires_at timestamptz not null,
  accepted_by uuid references people (id) on delete cascade,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- homing_app reads and changes invites only through the functions below.
alter table invites enable row level security;

-- A person is now created with a given id, so their account can share it.
drop function create_person(text);

create function create_person(name text, id uuid default gen_random_uuid(), out person_id uuid, out personal_space_id uuid)
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into people (id, name) values (create_person.id, create_person.name) returning people.id into person_id;
  insert into spaces (name, private_to) values ('Personal', person_id) returning spaces.id into personal_space_id;
  insert into memberships (space_id, person_id, role) values (personal_space_id, person_id, 'admin');
end
$$;

-- Whether someone looks after the instance: an instance admin with an
-- account. A sign-up that failed halfway leaves a person without one, and
-- then the setup link still works.
create function has_instance_admin() returns boolean
language sql stable set search_path = public, pg_temp
as $$ select exists (select from people p join auth."user" u on u.id = p.id where p.instance_admin) $$;

-- Makes a new setup link while nobody looks after the instance. Only the
-- newest one works, for an hour.
create function create_setup_invite(hash bytea) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtext('homing.invites'));
  if has_instance_admin() then
    return false;
  end if;
  delete from invites i where i.instance_admin and i.accepted_by is null;
  insert into invites (hash, instance_admin, expires_at)
  values (create_setup_invite.hash, true, now() + interval '1 hour');
  return true;
end
$$;

-- The invite with this token's hash, if it can still be used.
create function find_invite(hash bytea) returns table (instance_admin boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select i.instance_admin from invites i
  where i.hash = find_invite.hash
    and i.accepted_by is null
    and i.expires_at > now()
    and not (i.instance_admin and has_instance_admin())
$$;

-- Creates the invited person with the given id, and uses up the invite.
-- Accepting it again for the same person changes nothing, so a sign-up that
-- failed after this can be finished with the same ticket.
create function accept_invite(hash bytea, person uuid, name text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  invite invites;
begin
  perform pg_advisory_xact_lock(hashtext('homing.invites'));
  select * into invite from invites i where i.hash = accept_invite.hash;

  if invite.accepted_by = person then
    return;
  end if;
  if invite.id is null
    or invite.accepted_by is not null
    or invite.expires_at <= now()
    or (invite.instance_admin and has_instance_admin()) then
    raise exception 'this invite has expired or was already used' using errcode = 'insufficient_privilege';
  end if;

  perform create_person(name, person);
  update people set instance_admin = invite.instance_admin where id = person;
  update invites set accepted_by = person, accepted_at = now() where id = invite.id;
end
$$;

revoke execute on function has_instance_admin, create_person, create_setup_invite, find_invite, accept_invite from public;
grant execute on function create_person, create_setup_invite, find_invite, accept_invite to homing_app;
