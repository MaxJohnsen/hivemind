-- Knowledge (spec §3): sources, pages and items, with history and search.
--
-- A page has no side of its own. It is visible to whoever can see at least
-- one of its items, and its title is an item too, so a private page never
-- shows up for anyone else.

create table sources (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id),
  private_to uuid references people (id),
  -- Where it came from, such as a link, a message or a document.
  reference text,
  -- What it says, as far as it may be kept.
  excerpt text not null,
  -- The person who added it, or null when a space's routine did.
  written_by uuid references people (id),
  agent text,
  created_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', excerpt)) stored
);

create index sources_space on sources (space_id);
create index sources_search on sources using gin (search);

create table pages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id),
  -- Free text, such as person, decision or meeting.
  type text,
  created_at timestamptz not null default now(),
  unique (id, space_id)
);

-- Items now belong to a page in their own space. Each records who wrote it,
-- and which agent if a person didn't write it themselves.
alter table content
  add column page_id uuid not null,
  add column kind text not null default 'text' check (kind in ('title', 'text')),
  add column written_by uuid references people (id),
  add column agent text,
  add column superseded_by uuid references content (id),
  add column superseded_at timestamptz,
  add column search tsvector generated always as (to_tsvector('simple', body)) stored,
  add constraint content_page foreign key (page_id, space_id) references pages (id, space_id);

create index content_page_id on content (page_id);
create index content_search on content using gin (search);

-- Which sources an item rests on.
create table citations (
  content_id uuid not null references content (id),
  source_id uuid not null references sources (id),
  primary key (content_id, source_id)
);

create index citations_source on citations (source_id);

-- Earlier versions of an item's text. Each keeps the item's visibility.
create table revisions (
  content_id uuid not null references content (id),
  space_id uuid not null,
  private_to uuid,
  body text not null,
  written_by uuid,
  agent text,
  written_at timestamptz not null,
  replaced_at timestamptz not null default now()
);

create index revisions_content on revisions (content_id);

-- Only this trigger writes history, so it can't be forged.
create function keep_revision() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into revisions (content_id, space_id, private_to, body, written_by, agent, written_at)
  values (old.id, old.space_id, old.private_to, old.body, old.written_by, old.agent, old.updated_at);
  return new;
end
$$;

create trigger keep_revision
before update of body on content
for each row when (old.body is distinct from new.body)
execute function keep_revision();

-- Row-level security

alter table sources enable row level security;
alter table pages enable row level security;
alter table citations enable row level security;
alter table revisions enable row level security;

-- Sources and items follow the same rule, and nobody can write in someone
-- else's name.
create policy visible on sources
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
  and written_by is not distinct from current_person_id()
);

drop policy visible on content;

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
  and written_by is not distinct from current_person_id()
);

create policy visible on pages for select
using (exists (select from content c where c.page_id = pages.id));

create policy new_page on pages for insert
with check (space_id in (select accessible_spaces()));

create policy visible on citations
using (content_id in (select id from content))
with check (content_id in (select id from content) and source_id in (select id from sources));

create policy visible on revisions for select
using (
  space_id in (select accessible_spaces())
  and (private_to is null or private_to = current_person_id())
);

grant select, insert on sources, pages, citations to hivemind_app;
grant select on revisions to hivemind_app;
grant update (written_by, agent, superseded_by, superseded_at) on content to hivemind_app;
