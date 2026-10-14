-- Knowledge (spec §3): sources, pages and items, with history and search.
--
-- A page has no side of its own. It is visible to whoever can see at least
-- one of its items, and its title is an item too, so a private page never
-- shows up for anyone else.
--
-- Who wrote something comes from the transaction's principal and agent, and
-- triggers keep the history. Nobody can write in someone else's name,
-- backdate a change or skip its history.

-- The agent acting in this transaction, such as "Claude Code", or null when
-- a person acts directly.
create function current_agent() returns text
language sql stable
as $$ select nullif(current_setting('homing.agent', true), '') $$;

create table sources (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id),
  private_to uuid references people (id),
  -- Where it came from, such as a link, a message or a document.
  reference text,
  -- What it says, as far as it may be kept.
  excerpt text not null,
  -- The person who added it, or null when a space's routine did.
  written_by uuid default current_person_id() references people (id),
  agent text default current_agent(),
  created_at timestamptz not null default clock_timestamp(),
  search tsvector generated always as (to_tsvector('simple', excerpt)) stored
);

create index sources_space on sources (space_id);
create index sources_search on sources using gin (search);

create table pages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id),
  -- Free text, such as person, decision or meeting. Guidance and skill
  -- pages are reserved for guidance (spec §2).
  type text check (lower(type) not in ('guidance', 'skill')),
  created_at timestamptz not null default clock_timestamp(),
  unique (id, space_id)
);

-- Items belong to a page in their own space, and record who wrote them and
-- which agent, if a person didn't write them directly.
alter table content
  alter column created_at set default clock_timestamp(),
  alter column updated_at set default clock_timestamp(),
  add column page_id uuid not null,
  add column kind text not null default 'text' check (kind in ('title', 'text')),
  add column written_by uuid default current_person_id() references people (id),
  add column agent text default current_agent(),
  -- The item this one replaces, because it is no longer true. The old item
  -- stays, and only those who can see the replacement see it as replaced.
  add column supersedes uuid check (supersedes is null or kind = 'text'),
  add column search tsvector generated always as (to_tsvector('simple', body)) stored,
  add constraint content_page foreign key (page_id, space_id) references pages (id, space_id),
  add constraint content_on_page unique (id, page_id);

-- A replacement stays on the same page as what it replaces.
alter table content
  add constraint content_supersedes foreign key (supersedes, page_id) references content (id, page_id);

create index content_page_id on content (page_id);
create index content_supersedes on content (supersedes);
create index content_search on content using gin (search);

-- A page has one title on each side.
create unique index content_one_title on content (page_id, private_to) nulls not distinct where kind = 'title';

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
  replaced_at timestamptz not null default clock_timestamp()
);

create index revisions_content on revisions (content_id);

-- Keeps what an item said before each change, and records who changed it.
-- Agents never rewrite what people wrote.
create function keep_history() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if current_agent() is not null and old.written_by is not null and old.agent is null then
    raise exception 'agents never rewrite what people wrote' using errcode = 'insufficient_privilege';
  end if;
  insert into revisions (content_id, space_id, private_to, body, written_by, agent, written_at)
  values (old.id, old.space_id, old.private_to, old.body, old.written_by, old.agent, old.updated_at);
  new.written_by := current_person_id();
  new.agent := current_agent();
  new.updated_at := clock_timestamp();
  return new;
end
$$;

create trigger keep_history
before update of body on content
for each row when (old.body is distinct from new.body)
execute function keep_history();

-- A replacement must replace an item its writer can see. A shared one
-- replaces only shared items, and agents never replace what people wrote.
-- It runs as the writer, so row-level security decides what they can see.
create function check_replacement() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if not exists (
    select from content replaced
    where replaced.id = new.supersedes
      and replaced.kind = 'text'
      and (new.private_to is not null or replaced.private_to is null)
      and (current_agent() is null or replaced.agent is not null or replaced.written_by is null)
  ) then
    raise exception 'that item can''t be replaced' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

create trigger check_replacement
before insert on content
for each row when (new.supersedes is not null)
execute function check_replacement();

-- Row-level security

alter table sources enable row level security;
alter table pages enable row level security;
alter table citations enable row level security;
alter table revisions enable row level security;

-- Sources and items follow the same access rule.
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
);


create policy visible on pages for select
using (exists (select from content c where c.page_id = pages.id));

create policy new_page on pages for insert
with check (space_id in (select accessible_spaces()));

-- Only the writer of an item adds sources to it.
create policy visible on citations
using (content_id in (select id from content))
with check (
  content_id in (select id from content where written_by is not distinct from current_person_id())
  and source_id in (select id from sources)
);

create policy visible on revisions for select
using (
  space_id in (select accessible_spaces())
  and (private_to is null or private_to = current_person_id())
);

-- Authorship and timestamps are never written directly.
revoke insert, update on content from homing_app;
grant insert (space_id, private_to, page_id, kind, body, supersedes) on content to homing_app;
grant update (body) on content to homing_app;
grant select, insert (space_id, private_to, reference, excerpt) on sources to homing_app;
grant select, insert (id, space_id, type) on pages to homing_app;
grant select, insert on citations to homing_app;
grant select on revisions to homing_app;
