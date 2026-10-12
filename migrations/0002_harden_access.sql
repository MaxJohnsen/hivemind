-- Tightens spaces and access, after a security review.
--
-- Only admins create spaces under a space: a child space receives its
-- parent's shared guidance, so creating one and inviting people to it is a
-- decision for the parent's admins. Changes to access take the access lock
-- before checking rights, so a check can't race a removal.
--
-- The access rule's own functions name their tables in full, and nobody can
-- create temporary tables, so no session can put its own table in their place.

create or replace function create_space(name text, parent_id uuid default null, closed boolean default false)
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
  perform pg_advisory_xact_lock(hashtext('hivemind.space_access'));

  if create_space.parent_id is not null then
    if not exists (
      select from space_access a
      where a.space_id = create_space.parent_id and a.person_id = me and a.admin
    ) then
      raise exception 'only admins can create spaces under a space' using errcode = 'insufficient_privilege';
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

create or replace function add_member(space uuid, person uuid, member_role text default 'member')
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtext('hivemind.space_access'));
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

create or replace function remove_member(space uuid, person uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtext('hivemind.space_access'));
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

create or replace function space_subtree(root uuid) returns setof uuid
language sql stable
as $$
  with recursive subtree (id) as (
    select root
    union all
    select s.id from public.spaces s join subtree t on s.parent_id = t.id
  )
  select id from subtree
$$;

create or replace function accessible_spaces() returns setof uuid
language sql stable
as $$
  select space_id from public.space_access where person_id = current_person_id()
  union all
  select current_space_id() where current_space_id() is not null
$$;

do $$
begin
  execute format('revoke temporary on database %I from public', current_database());
end
$$;
