-- Guidance (spec §2): rules, stored on a space's guidance page like
-- knowledge, with their own rules for who changes them and how far they reach.
--
-- Only people change guidance: every write to a guidance page must be a
-- direct edit by a person, never an agent or a routine acting for them.
-- Guidance is the one exception to the access rule: it also reaches the
-- spaces below its own, closed ones included, unless it is marked only here.
-- Knowledge never reaches down.

-- Whether a person is editing directly, as in the web app or the command
-- line. Hivemind marks only those paths, so a new path can't change guidance
-- just by forgetting to name its agent.
create function direct_edit() returns boolean
language sql stable
as $$
  select current_setting('hivemind.direct', true) = 'true'
     and current_person_id() is not null
     and current_agent() is null
$$;

-- Guidance pages are reserved, and spelled exactly so.
alter table pages
  drop constraint pages_type_check,
  add constraint pages_type_check check (type = 'guidance' or lower(type) not in ('guidance', 'skill'));

-- A space has one guidance page, with one item per rule.
create unique index pages_one_guidance on pages (space_id) where type = 'guidance';

-- A rule is a requirement or a preference. Removing one adds a removal that
-- replaces it, so it stays in the history.
alter table content
  drop constraint content_kind_check,
  add constraint content_kind_check check (kind in ('title', 'text', 'requirement', 'preference', 'removed')),
  drop constraint content_check,
  add constraint content_supersedes_check check (
    case kind when 'text' then true when 'removed' then supersedes is not null else supersedes is null end
  ),
  -- Set on guidance that reaches the spaces below its own: every rule, unless it is marked only here.
  add column reaches_down boolean not null default false;

-- The space's guidance page, created when needed. It runs as its owner,
-- because the page may hold only rules the caller can't see.
create function guidance_page(space uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  page uuid;
begin
  if space not in (select accessible_spaces()) then
    raise exception 'no access to that space' using errcode = 'insufficient_privilege';
  end if;
  insert into pages (space_id, type) values (space, 'guidance')
  on conflict (space_id) where type = 'guidance' do nothing
  returning id into page;
  return coalesce(page, (select p.id from pages p where p.space_id = space and p.type = 'guidance'));
end
$$;

-- The spaces above those the principal can access, whose guidance reaches
-- them. Closed spaces block inherited membership, not guidance.
create function guidance_reach() returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  with recursive above (id) as (
    select s.parent_id from spaces s
    where s.id in (select accessible_spaces()) and s.parent_id is not null
    union
    select s.parent_id from spaces s join above a on s.id = a.id
    where s.parent_id is not null
  )
  select id from above
$$;

-- The spaces above one the principal can access, nearest first.
create function spaces_above(space uuid) returns table (id uuid, distance integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  with recursive above (id, distance) as (
    select s.parent_id, 1 from spaces s
    where s.id = spaces_above.space and s.id in (select accessible_spaces()) and s.parent_id is not null
    union all
    select s.parent_id, a.distance + 1 from spaces s join above a on s.id = a.id
    where s.parent_id is not null
  )
  select id, distance from above
$$;

revoke execute on function guidance_page, guidance_reach, spaces_above from public;
grant execute on function guidance_page, guidance_reach, spaces_above to hivemind_app;

-- Only people change guidance. Shared guidance is changed by the space's
-- admins, and private guidance by its owner, which row-level security
-- already ensures.
create function check_guidance() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if (select type from pages where id = new.page_id) = 'guidance' then
    if not direct_edit() then
      raise exception 'only people change guidance' using errcode = 'insufficient_privilege';
    end if;
    if new.private_to is null and not exists (
      select from space_access a
      where a.space_id = new.space_id and a.person_id = current_person_id() and a.admin
    ) then
      raise exception 'only admins change shared guidance' using errcode = 'insufficient_privilege';
    end if;
  elsif new.reaches_down then
    raise exception 'knowledge never reaches down' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

create trigger check_guidance
before insert or update on content
for each row execute function check_guidance();

-- A replacement must replace an item its writer can see. A shared one
-- replaces only shared knowledge, and agents never replace what people
-- wrote. A removal ends a rule for everyone it reaches, never just for one
-- person. It runs as the writer, so row-level security decides what they
-- can see.
create or replace function check_replacement() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if not exists (
    select from content replaced
    where replaced.id = new.supersedes
      and case new.kind
        when 'text' then
          replaced.kind = 'text'
          and (new.private_to is not null or replaced.private_to is null)
          and (current_agent() is null or replaced.agent is not null or replaced.written_by is null)
        when 'removed' then
          replaced.kind in ('requirement', 'preference')
          and replaced.private_to is not distinct from new.private_to
        else false
      end
  ) then
    raise exception 'that item can''t be replaced' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

-- Guidance is also visible in the spaces below its own, to everyone there,
-- unless it is marked only here. Private guidance reaches down only for its
-- owner.
create policy guidance_reach on content for select
using (
  reaches_down
  and space_id in (select guidance_reach())
  and (private_to is null or private_to = current_person_id())
);

grant insert (reaches_down) on content to hivemind_app;
