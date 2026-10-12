-- Skills (spec §2): instructions plus files such as references and scripts,
-- kept on a skill page exactly as they were imported, so a skill stays a
-- SKILL.md folder in the Agent Skills format. Like rules, only people change
-- skills, they reach the spaces below their own, and removing a file, or the
-- skill's name and with it the skill, adds a removal that keeps the history.

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
-- kinds of item, and all of a skill reaches down.
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
  if page_type = 'skill' and not new.reaches_down then
    raise exception 'a skill applies in the spaces below its own' using errcode = 'check_violation';
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

grant insert (path) on content to hivemind_app;
