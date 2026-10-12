import { randomUUID } from 'node:crypto';
import { AccessDenied, personOf, type Session } from './db.ts';
import { accessibleSpaces } from './spaces.ts';

export interface Item {
  id: string;
  pageId: string;
  spaceId: string;
  kind: 'title' | 'text';
  /** The person whose private side the item is on, or null when shared. */
  privateTo: string | null;
  body: string;
  /** The person who wrote it, or null when a space's routine did. */
  writtenBy: string | null;
  /** The agent that wrote it, or null when a person wrote it themselves. */
  agent: string | null;
  supersededBy: string | null;
}

export interface Source {
  id: string;
  spaceId: string;
  privateTo: string | null;
  reference: string | null;
  excerpt: string;
}

export interface Page {
  id: string;
  spaceId: string;
  type: string | null;
  title: string;
  items: (Item & { sources: Citation[] })[];
}

export type Citation = Pick<Source, 'id' | 'reference' | 'excerpt'>;

export interface Revision {
  body: string;
  writtenBy: string | null;
  agent: string | null;
  writtenAt: Date;
  replacedAt: Date;
}

export interface Hit {
  kind: 'page' | 'item' | 'source';
  id: string;
  spaceId: string;
  pageId: string | null;
  title: string | null;
  text: string;
  superseded: boolean;
}

/** Keeps where knowledge came from, without giving it a page yet. */
export async function addSource(
  s: Session,
  input: { spaceId: string; excerpt: string; reference?: string; shared?: boolean },
): Promise<Source> {
  const privateTo = sideOf(s, input.shared);
  await checkSpace(s, input.spaceId, input.shared);
  const [source] = await s.tx<Source[]>`
    insert into sources (space_id, private_to, reference, excerpt, written_by, agent)
    values (${input.spaceId}::uuid, ${privateTo}::uuid, ${input.reference ?? null}, ${input.excerpt},
            ${personOf(s.principal) ?? null}::uuid, ${s.principal.agent ?? null})
    returning id, space_id, private_to, reference, excerpt
  `;
  return source;
}

/** Creates a page for one subject, with its title on the given side. */
export async function createPage(
  s: Session,
  input: { spaceId: string; title: string; type?: string; shared?: boolean },
): Promise<string> {
  const privateTo = sideOf(s, input.shared);
  await checkSpace(s, input.spaceId, input.shared);
  // A page is only visible through its items, so it can't be returned until its title exists.
  const id = randomUUID();
  await s.tx`insert into pages (id, space_id, type) values (${id}::uuid, ${input.spaceId}::uuid, ${input.type ?? null})`;
  await insertItem(s, { pageId: id, spaceId: input.spaceId, privateTo, kind: 'title', body: input.title });
  return id;
}

/** Writes an item on a page. It is private unless shared is set. */
export async function writeItem(
  s: Session,
  input: { pageId: string; body: string; sources?: string[]; shared?: boolean },
): Promise<Item> {
  const privateTo = sideOf(s, input.shared);
  const [page] = await s.tx<{ spaceId: string }[]>`
    select space_id from content
    where page_id = ${input.pageId}::uuid and ${visible(s, 'content')}
    limit 1
  `;
  if (!page) throw new AccessDenied('no access to this page');
  await checkSpace(s, page.spaceId, input.shared);
  return insertItem(s, { ...input, spaceId: page.spaceId, privateTo, kind: 'text' });
}

/** Rewrites an item. What it said before stays in its history. */
export async function updateItem(
  s: Session,
  itemId: string,
  input: { body: string; sources?: string[] },
): Promise<Item | undefined> {
  if (!(await changeableItem(s, itemId))) return undefined;
  const [item] = await s.tx<Item[]>`
    update content
    set body = ${input.body}, written_by = ${personOf(s.principal) ?? null}::uuid,
        agent = ${s.principal.agent ?? null}, updated_at = now()
    where id = ${itemId}::uuid and ${visible(s, 'content')}
    returning ${itemColumns(s)}
  `;
  await cite(s, item.id, input.sources);
  return item;
}

/** Replaces an item that is no longer true. The old one is kept as what used to be true. */
export async function supersedeItem(
  s: Session,
  itemId: string,
  input: { body: string; sources?: string[] },
): Promise<Item | undefined> {
  const old = await changeableItem(s, itemId);
  if (!old) return undefined;
  const replacement = await insertItem(s, { ...old, ...input });
  await s.tx`update content set superseded_by = ${replacement.id}::uuid, superseded_at = now() where id = ${old.id}::uuid`;
  return replacement;
}

/** A page as the viewer sees it: the shared items plus their own, with their sources. */
export async function readPage(s: Session, pageId: string): Promise<Page | undefined> {
  const items = await s.tx<Page['items']>`
    select ${itemColumns(s)}, ${citationsOf(s)} as sources
    from content
    where page_id = ${pageId}::uuid and superseded_by is null and ${visible(s, 'content')}
    order by created_at
  `;
  if (items.length === 0) return undefined;
  const [{ type }] = await s.tx`select type from pages where id = ${pageId}::uuid`;
  const title = items.find((item) => item.kind === 'title')?.body ?? 'Untitled';
  return { id: pageId, spaceId: items[0].spaceId, type, title, items: items.filter((item) => item.kind === 'text') };
}

/** An item with its sources and earlier versions. */
export async function readItem(
  s: Session,
  itemId: string,
): Promise<(Item & { sources: Citation[]; history: Revision[] }) | undefined> {
  const [item] = await s.tx<(Item & { sources: Citation[] })[]>`
    select ${itemColumns(s)}, ${citationsOf(s)} as sources
    from content
    where id = ${itemId}::uuid and ${visible(s, 'content')}
  `;
  if (!item) return undefined;
  const history = await s.tx<Revision[]>`
    select body, written_by, agent, written_at, replaced_at
    from revisions
    where content_id = ${itemId}::uuid
    order by replaced_at
  `;
  return { ...item, history };
}

/** The pages in a space that the viewer can see, most recently changed first. */
export async function listPages(s: Session, spaceId: string) {
  return s.tx<{ id: string; type: string | null; title: string | null; updatedAt: Date }[]>`
    select c.page_id as id, p.type, ${titleOf(s, s.tx`c.page_id`)} as title, max(c.updated_at) as updated_at
    from content c
    join pages p on p.id = c.page_id
    where c.space_id = ${spaceId}::uuid and c.superseded_by is null and ${visible(s, 'c')}
    group by c.page_id, p.type
    order by updated_at desc
  `;
}

/**
 * Searches items and sources the viewer can see, optionally within a space
 * and the spaces below it. Words match by how they start, shorter texts rank
 * higher, and superseded items come last.
 */
export async function search(
  s: Session,
  query: string,
  options: { spaceId?: string; limit?: number } = {},
): Promise<Hit[]> {
  const words = query.match(/[\p{L}\p{N}]+/gu);
  if (!words) return [];
  const terms = words.map((word) => `${word}:*`).join(' | ');
  const within = (table: string) =>
    options.spaceId
      ? s.tx`and ${s.tx(table)}.space_id in (select space_subtree(${options.spaceId}::uuid))`
      : s.tx``;

  return s.tx<Hit[]>`
    select kind, id, space_id, page_id, title, text, superseded from (
      select case c.kind when 'title' then 'page' else 'item' end as kind,
             c.id, c.space_id, c.page_id, ${titleOf(s, s.tx`c.page_id`)} as title, c.body as text,
             c.superseded_by is not null as superseded,
             ts_rank(c.search, to_tsquery('simple', ${terms}), 1) as rank
      from content c
      where c.search @@ to_tsquery('simple', ${terms}) and ${visible(s, 'c')} ${within('c')}
      union all
      select 'source', src.id, src.space_id, null, src.reference, src.excerpt, false,
             ts_rank(src.search, to_tsquery('simple', ${terms}), 1)
      from sources src
      where src.search @@ to_tsquery('simple', ${terms}) and ${visible(s, 'src')} ${within('src')}
    ) hits
    order by superseded, rank desc
    limit ${options.limit ?? 20}
  `;
}

function itemColumns(s: Session) {
  return s.tx`id, page_id, space_id, kind, private_to, body, written_by, agent, superseded_by`;
}

async function insertItem(
  s: Session,
  item: Pick<Item, 'pageId' | 'spaceId' | 'privateTo' | 'kind' | 'body'> & { sources?: string[] },
): Promise<Item> {
  const [inserted] = await s.tx<Item[]>`
    insert into content (page_id, space_id, private_to, kind, body, written_by, agent)
    values (${item.pageId}::uuid, ${item.spaceId}::uuid, ${item.privateTo}::uuid, ${item.kind}, ${item.body},
            ${personOf(s.principal) ?? null}::uuid, ${s.principal.agent ?? null})
    returning ${itemColumns(s)}
  `;
  await cite(s, inserted.id, item.sources);
  return inserted;
}

/** The item, if the viewer can see it and may change it. */
async function changeableItem(s: Session, itemId: string): Promise<Item | undefined> {
  const [item] = await s.tx<Item[]>`
    select ${itemColumns(s)} from content where id = ${itemId}::uuid and ${visible(s, 'content')}
  `;
  if (!item) return undefined;
  if (item.supersededBy) throw new AccessDenied('a superseded item no longer changes');
  if (s.principal.agent && item.writtenBy && !item.agent) {
    throw new AccessDenied('agents never rewrite what people wrote');
  }
  return item;
}

async function cite(s: Session, itemId: string, sourceIds: string[] = []) {
  if (sourceIds.length === 0) return;
  const found = await s.tx`select id from sources where id in ${s.tx(sourceIds)} and ${visible(s, 'sources')}`;
  if (found.length !== new Set(sourceIds).size) throw new AccessDenied('no access to a cited source');
  const rows = sourceIds.map((sourceId) => ({ content_id: itemId, source_id: sourceId }));
  await s.tx`insert into citations ${s.tx(rows)} on conflict do nothing`;
}

/** Which side a write goes to: shared, or the person's own private side. */
function sideOf(s: Session, shared = false): string | null {
  if (shared) return null;
  const person = personOf(s.principal);
  if (!person) throw new AccessDenied('a space has no private side');
  return person;
}

async function checkSpace(s: Session, spaceId: string, shared = false) {
  const [space] = await s.tx<{ personal: boolean }[]>`
    select private_to is not null as personal
    from spaces
    where id = ${spaceId}::uuid and id in (${accessibleSpaces(s)})
  `;
  if (!space) throw new AccessDenied('no access to this space');
  if (space.personal && shared) throw new AccessDenied('spaces in a personal tree have no shared side');
}

/**
 * Rows the viewer can see: the shared side of spaces they can access, and
 * their own private side. Row-level security applies the same rule.
 */
function visible(s: Session, table: string) {
  const t = s.tx(table);
  return s.tx`
    ${t}.space_id in (${accessibleSpaces(s)})
    and (${t}.private_to is null or ${t}.private_to = ${personOf(s.principal) ?? null}::uuid)
  `;
}

function titleOf(s: Session, pageId: ReturnType<Session['tx']>) {
  return s.tx`(
    select t.body from content t
    where t.page_id = ${pageId} and t.kind = 'title' and t.superseded_by is null and ${visible(s, 't')}
    order by t.created_at
    limit 1
  )`;
}

function citationsOf(s: Session) {
  return s.tx`coalesce((
    select json_agg(json_build_object('id', src.id, 'reference', src.reference, 'excerpt', src.excerpt)
                    order by src.created_at)
    from citations ci
    join sources src on src.id = ci.source_id
    where ci.content_id = content.id and ${visible(s, 'src')}
  ), '[]')`;
}
