-- Skills (spec §2): instructions plus files such as references and scripts,
-- kept on a skill page exactly as they were imported, so a skill stays a
-- SKILL.md folder in the agent skills format. Like rules, only people change
-- skills, and they reach the spaces below their own.

alter table pages
  drop constraint pages_type_check,
  add constraint pages_type_check check (type in ('guidance', 'skill') or lower(type) not in ('guidance', 'skill'));

-- A skill's files are items with a path. Only text files are kept for now.
alter table content
  drop constraint content_kind_check,
  add constraint content_kind_check check (kind in ('title', 'text', 'requirement', 'preference', 'file', 'removed')),
  add column path text,
  add constraint content_path_check check ((kind = 'file') = (path is not null));

-- Only people change guidance, which includes skills. Shared guidance is
-- changed by the space's admins, and private guidance by its owner, which
-- row-level security already ensures. Each kind of page holds only its own
-- kinds of item.
create or replace function check_guidance() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  page_type text := (select type from pages where id = new.page_id);
begin
  if not new.kind = any (case page_type
    when 'guidance' then array['requirement', 'preference', 'removed']
    when 'skill' then array['title', 'file', 'removed']
    else array['title', 'text']
  end) then
    raise exception 'that kind of item doesn''t belong on this page' using errcode = 'check_violation';
  end if;
  if page_type in ('guidance', 'skill') then
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

-- As before, and a removal can also remove a skill's file, but not its name.
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
          replaced.kind in ('requirement', 'preference', 'file')
          and replaced.private_to is not distinct from new.private_to
          and replaced.reaches_down = new.reaches_down
        else false
      end
  ) then
    raise exception 'that item can''t be replaced' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

grant insert (path) on content to hivemind_app;
