-- Tokens let local agents such as Claude Code act for a person.
--
-- Only a hash of each token is kept. Hivemind can't read this table: it
-- checks a token with authenticate(), before it knows who is asking.

create table tokens (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  -- The agent that uses it. Its writes are recorded under this name.
  agent text not null check (agent <> ''),
  hash bytea not null unique,
  created_at timestamptz not null default now()
);

alter table tokens enable row level security;

-- Creates a token for the current person.
create function create_token(agent text, hash bytea) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if current_person_id() is null then
    raise exception 'only a person can have a token' using errcode = 'insufficient_privilege';
  end if;
  insert into tokens (person_id, agent, hash) values (current_person_id(), create_token.agent, create_token.hash);
end
$$;

-- Revokes all of the current person's tokens.
create function revoke_tokens() returns integer
language sql security definer set search_path = public, pg_temp
as $$
  with revoked as (delete from tokens where person_id = current_person_id() returning 1)
  select count(*)::integer from revoked
$$;

-- The person a token acts for, and the agent using it.
create function authenticate(hash bytea, out person_id uuid, out agent text)
language sql stable security definer set search_path = public, pg_temp
as $$ select t.person_id, t.agent from tokens t where t.hash = authenticate.hash $$;

revoke execute on function create_token, revoke_tokens, authenticate from public;
grant execute on function create_token, revoke_tokens, authenticate to hivemind_app;
