-- The instance admin invites people.
--
-- An invite sent by email keeps the address it went to: accepting it with
-- that address proves the person can read its mail, so it counts as
-- verified for recovery. Only invites create people now.

alter table invites
  add column invited_by uuid references people (id) on delete cascade,
  add column email text check (email = lower(email));

revoke execute on function create_person from homing_app;

-- Makes an invite that works once, for a week. Only the instance admin,
-- editing directly, can.
create function create_invite(hash bytea, email text default null) returns timestamptz
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  expires timestamptz := now() + interval '7 days';
begin
  if not direct_edit() or not exists (select from people p where p.id = current_person_id() and p.instance_admin) then
    raise exception 'only the instance admin invites people' using errcode = 'insufficient_privilege';
  end if;
  insert into invites (hash, invited_by, email, expires_at)
  values (create_invite.hash, current_person_id(), lower(nullif(create_invite.email, '')), expires);
  return expires;
end
$$;

-- The invite with this token's hash, if it can still be used: whom it was
-- sent to, if anyone, and who sent it.
drop function find_invite(bytea);

create function find_invite(hash bytea) returns table (instance_admin boolean, email text, invited_by text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select i.instance_admin, i.email, p.name
  from invites i
  left join people p on p.id = i.invited_by
  where i.hash = find_invite.hash
    and i.accepted_by is null
    and i.expires_at > now()
    and not (i.instance_admin and has_instance_admin())
$$;

revoke execute on function create_invite, find_invite from public;
grant execute on function create_invite, find_invite to homing_app;
