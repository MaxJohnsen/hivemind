-- Spaces, membership and access.
--
-- Hivemind connects as hivemind_app, a restricted role that is subject to
-- row-level security, and sets a principal (a person or a space) for each
-- transaction. The policies below decide what that principal can see and
-- write, independently of the checks Hivemind makes itself.

do $$
begin
  if not exists (select from pg_roles where rolname = 'hivemind_app') then
    create role hivemind_app;
  end if;
end
$$;

-- The principal of the current transaction, set with set_config(..., true).

create function current_person_id() returns uuid
language sql stable
as $$ select nullif(current_setting('hivemind.person_id', true), '')::uuid $$;

create function current_space_id() returns uuid
language sql stable
as $$ select nullif(current_setting('hivemind.space_id', true), '')::uuid $$;

-- Tables

create table people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references spaces (id),
  closed boolean not null default false,
  -- Set on every space in a person's personal tree. Only that person has access.
  private_to uuid references people (id),
  created_at timestamptz not null default now()
);

-- The root of a personal tree is that person's personal space.
create unique index spaces_personal_space on spaces (private_to) where parent_id is null;
create index spaces_parent on spaces (parent_id);

create table memberships (
  space_id uuid not null references spaces (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (space_id, person_id)
);

-- Who can access which space. Derived from memberships, parents and closed
-- spaces, and rewritten in the same transaction as any change to them.
create table space_access (
  person_id uuid not null references people (id) on delete cascade,
  space_id uuid not null references spaces (id) on delete cascade,
  admin boolean not null,
  primary key (person_id, space_id)
);

create table content (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id),
  private_to uuid references people (id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_space on content (space_id);

-- Keeping space_access current

create function space_subtree(root uuid) returns setof uuid
language sql stable
as $$
  with recursive subtree (id) as (
    select root
    union all
    select s.id from spaces s join subtree t on s.parent_id = t.id
  )
  select id from subtree
$$;

-- A person can access a space through a membership in it, or in an ancestor
-- as long as no space on the way down is closed. Admin rights follow the same
-- path. Changes are serialized, so concurrent ones never see a stale tree.
create function refresh_space_access() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  root uuid;
begin
  if tg_table_name = 'spaces' then
    root := new.id;
  elsif tg_op = 'DELETE' then
    root := old.space_id;
  else
    root := new.space_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('hivemind.space_access'));

  delete from space_access where space_id in (select space_subtree(root));

  insert into space_access (person_id, space_id, admin)
  with recursive reach (space_id, ancestor_id, inherits) as (
    select s.id, s.id, not s.closed
    from spaces s
    where s.id in (select space_subtree(root))
    union all
    select r.space_id, p.id, not p.closed
    from reach r
    join spaces a on a.id = r.ancestor_id
    join spaces p on p.id = a.parent_id
    where r.inherits
  )
  select m.person_id, r.space_id, bool_or(m.role = 'admin')
  from reach r
  join memberships m on m.space_id = r.ancestor_id
  group by m.person_id, r.space_id;

  return null;
end
$$;

create trigger refresh_space_access
after insert or update of parent_id, closed on spaces
for each row execute function refresh_space_access();

create trigger refresh_space_access
after insert or update or delete on memberships
for each row execute function refresh_space_access();

-- Changing people, spaces and memberships
--
-- hivemind_app can't write these tables directly. These functions check the
-- caller's rights and make the change.

create function create_person(name text, out person_id uuid, out personal_space_id uuid)
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into people (name) values (create_person.name) returning id into person_id;
  insert into spaces (name, private_to) values ('Personal', person_id) returning id into personal_space_id;
  insert into memberships (space_id, person_id, role) values (personal_space_id, person_id, 'admin');
end
$$;

-- Anyone can create a root. A child needs access to its parent and stays in
-- the parent's personal tree, if any. The creator becomes an admin.
create function create_space(name text, parent_id uuid default null, closed boolean default false)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  me uuid := current_person_id();
  owner uuid;
  space uuid;
begin
  if me is null then
    raise exception 'only a person can create a space' using errcode = 'insufficient_privilege';
  end if;

  if create_space.parent_id is not null then
    if not exists (
      select from space_access a where a.space_id = create_space.parent_id and a.person_id = me
    ) then
      raise exception 'no access to the parent space' using errcode = 'insufficient_privilege';
    end if;
    select s.private_to into owner from spaces s where s.id = create_space.parent_id;
  end if;

  insert into spaces (name, parent_id, closed, private_to)
  values (create_space.name, create_space.parent_id, create_space.closed, owner)
  returning id into space;

  insert into memberships (space_id, person_id, role) values (space, me, 'admin');

  return space;
end
$$;

-- Adds a person to a space, or changes their role. Needs admin rights.
create function add_member(space uuid, person uuid, member_role text default 'member')
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not exists (
    select from space_access a
    where a.space_id = space and a.person_id = current_person_id() and a.admin
  ) then
    raise exception 'only admins can add members' using errcode = 'insufficient_privilege';
  end if;

  if (select s.private_to from spaces s where s.id = space) is not null then
    raise exception 'spaces in a personal tree have only their owner' using errcode = 'insufficient_privilege';
  end if;

  insert into memberships (space_id, person_id, role)
  values (space, person, member_role)
  on conflict on constraint memberships_pkey do update set role = excluded.role;
end
$$;

-- Removes a person from a space. Needs admin rights, unless you are leaving.
create function remove_member(space uuid, person uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if person is distinct from current_person_id() and not exists (
    select from space_access a
    where a.space_id = space and a.person_id = current_person_id() and a.admin
  ) then
    raise exception 'only admins can remove members' using errcode = 'insufficient_privilege';
  end if;

  if (select s.private_to from spaces s where s.id = space) is not null then
    raise exception 'spaces in a personal tree have only their owner' using errcode = 'insufficient_privilege';
  end if;

  delete from memberships m where m.space_id = space and m.person_id = person;
end
$$;

revoke execute on function create_person, create_space, add_member, remove_member from public;
grant execute on function create_person, create_space, add_member, remove_member to hivemind_app;

-- Row-level security

-- The spaces the principal can access: a person's from space_access, and a
-- space only itself.
create function accessible_spaces() returns setof uuid
language sql stable
as $$
  select space_id from space_access where person_id = current_person_id()
  union all
  select current_space_id() where current_space_id() is not null
$$;

alter table people enable row level security;
alter table spaces enable row level security;
alter table memberships enable row level security;
alter table space_access enable row level security;
alter table content enable row level security;

create policy visible on people for select
using (id = current_person_id() or id in (select person_id from memberships));

create policy visible on spaces for select
using (id in (select accessible_spaces()));

create policy visible on memberships for select
using (space_id in (select accessible_spaces()));

create policy own on space_access for select
using (person_id = current_person_id());

-- You can see and write the shared side of spaces you can access, and your
-- own private side. Spaces in a personal tree have no shared side.
create policy visible on content
using (
  space_id in (select accessible_spaces())
  and (private_to is null or private_to = current_person_id())
)
with check (
  space_id in (select accessible_spaces())
  and (
    private_to = current_person_id()
    or (private_to is null and space_id in (select id from spaces where private_to is null))
  )
);

grant select on people, spaces, memberships, space_access to hivemind_app;
-- Items never move between spaces or sides once written.
grant select, insert, update (body, updated_at) on content to hivemind_app;
