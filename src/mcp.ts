import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { AccessDenied, personOf, withPrincipal, type Principal, type Session, type Sql } from './db.ts';
import {
  addSource,
  createPage,
  listPages,
  readItem,
  readPage,
  readSource,
  search,
  supersedeItem,
  updateItem,
  writeItem,
  type Hit,
} from './knowledge.ts';
import { listSpaces, personName, type Space } from './spaces.ts';

const instructions = `Hivemind holds the user's working context: their spaces, such as clients and projects, and what is known in each.

- At the start of a task, call \`context\` with the user's request. If it's unclear which space the task is about, pick from the candidates or ask.
- Before relying on what you remember, \`search\`. Mention the references of what you use.
- When you learn something worth keeping, such as a decision, a date, an owner or a preference, save it with \`remember\`. It stays private to the user.`;

/** The MCP tools, for one principal. */
export function mcpServer(sql: Sql, principal: Principal): McpServer {
  const server = new McpServer({ name: 'hivemind', version: '0.1.0' }, { instructions });
  const answer = (fn: (s: Session) => Promise<string>) => respond(sql, principal, fn);

  server.registerTool(
    'context',
    {
      title: 'Get context',
      description:
        'Start here. Without a space, lists the spaces you can work in, with those that match the request first. ' +
        'With a space, gives its pages and the knowledge relevant to the request.',
      inputSchema: z.object({
        request: z.string().describe("What the user asked for, in their words"),
        space: z.string().optional().describe('A space reference, such as space:…'),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ request, space }) =>
      answer((s) => (space ? spaceContext(s, parseRef(space, 'space'), request) : spacesFor(s, request))),
  );

  server.registerTool(
    'search',
    {
      title: 'Search',
      description: 'Searches pages, knowledge and sources you can see, optionally within a space and the spaces below it.',
      inputSchema: z.object({
        query: z.string(),
        space: z.string().optional().describe('A space reference, such as space:…'),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ query, space }) =>
      answer(async (s) => {
        const hits = await search(s, query, { spaceId: space && parseRef(space, 'space') });
        return hits.length ? (await describeHits(s, hits)).join('\n') : 'No matches.';
      }),
  );

  server.registerTool(
    'read',
    {
      title: 'Read',
      description: 'Reads a space, a page, an item with its history, or a source, by its reference.',
      inputSchema: z.object({ ref: z.string().describe('A reference, such as page:…') }),
      annotations: { readOnlyHint: true },
    },
    ({ ref }) => answer((s) => read(s, ref)),
  );

  server.registerTool(
    'remember',
    {
      title: 'Remember',
      description:
        'Saves knowledge on your private side of a space. Nobody else sees it unless you share it later. ' +
        'Save each fact that can change, such as a date, an owner or a decision, on its own, on the page for its subject. ' +
        'Without a page, it is kept as a note that search still finds. ' +
        'Use replaces when something is no longer true, and updates to correct an item you saved.',
      inputSchema: z.object({
        space: z.string().describe('The space it belongs to, such as space:…'),
        text: z.string().describe('The knowledge, in Markdown'),
        page: z
          .string()
          .optional()
          .describe('A page reference, or the title of the page for its subject. A page with that title is created if there is none.'),
        type: z.string().optional().describe('The type of a new page, such as person, project or decision'),
        replaces: z.string().optional().describe('An item that is no longer true because of this'),
        updates: z.string().optional().describe('An item to rewrite with this text'),
        sources: z
          .array(z.object({ reference: z.string().optional(), excerpt: z.string() }))
          .optional()
          .describe('Where it came from, such as an email or a document, and the words it rests on'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) => answer((s) => remember(s, input)),
  );

  return server;
}

async function respond(sql: Sql, principal: Principal, fn: (s: Session) => Promise<string>) {
  try {
    const text = await withPrincipal(sql, principal, fn);
    return { content: [{ type: 'text' as const, text }] };
  } catch (error) {
    if (!(error instanceof AccessDenied || error instanceof Refused)) throw error;
    return { isError: true, content: [{ type: 'text' as const, text: error.message }] };
  }
}

/** A request Hivemind can't carry out as asked. */
class Refused extends Error {}

const kinds = ['space', 'page', 'item', 'source'] as const;
type Kind = (typeof kinds)[number];

const ref = (kind: Kind, id: string) => `${kind}:${id}`;

function parseRef(value: string, kind: Kind): string {
  const parsed = parseAnyRef(value);
  if (parsed.kind !== kind) throw new Refused(`Expected a ${kind} reference, such as ${kind}:…, but got "${value}".`);
  return parsed.id;
}

function parseAnyRef(value: string): { kind: Kind; id: string } {
  const match = /^(space|page|item|source):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
    value.trim(),
  );
  if (!match) throw new Refused(`"${value}" isn't a reference. References look like page:… or item:….`);
  return { kind: match[1] as Kind, id: match[2].toLowerCase() };
}

/** Without a space: who you are, and the spaces that match the request. */
async function spacesFor(s: Session, request: string): Promise<string> {
  const spaces = await listSpaces(s);
  const matches = new Map<string, number>();
  for (const hit of await search(s, request, { limit: 50 })) {
    matches.set(hit.spaceId, (matches.get(hit.spaceId) ?? 0) + 1);
  }
  const named = (space: Space) => request.toLowerCase().includes(space.name.toLowerCase());
  const why = (space: Space) =>
    [named(space) && 'named in the request', matches.has(space.id) && plural(matches.get(space.id)!, 'match', 'matches')]
      .filter(Boolean)
      .join(', ');
  const candidates = spaces
    .filter((space) => named(space) || matches.has(space.id))
    .sort((a, b) => Number(named(b)) - Number(named(a)) || (matches.get(b.id) ?? 0) - (matches.get(a.id) ?? 0))
    .map((space) => `- ${space.name} (${ref('space', space.id)}): ${why(space)}`);

  return [
    `You are ${await personName(s)}. Choose the space this is about, and call \`context\` again with it.`,
    candidates.length ? `\n## Spaces that match\n${candidates.join('\n')}` : '\nNo space has anything that matches yet.',
    `\n## Your spaces\n${tree(spaces).join('\n')}`,
  ].join('\n');
}

/** With a space: its pages, and what is relevant to the request. */
async function spaceContext(s: Session, spaceId: string, request?: string): Promise<string> {
  const space = (await listSpaces(s)).find((candidate) => candidate.id === spaceId);
  if (!space) throw new Refused('There is no space with that reference that you can see.');

  const pages = await listPages(s, spaceId);
  const lines = [
    `# ${space.name}`,
    `You are ${await personName(s)}${space.admin ? ', an admin of this space' : ''} (${ref('space', space.id)}). ` +
      'What you save with `remember` stays on your private side.',
    '\n## Pages',
    ...(pages.length
      ? pages.map((page) => `- ${page.title ?? 'Untitled'}${page.type ? ` (${page.type})` : ''}, ${ref('page', page.id)}`)
      : ['No pages yet.']),
  ];
  if (request) {
    const hits = await search(s, request, { spaceId, limit: 10 });
    lines.push(`\n## Relevant to the request`, ...(hits.length ? await describeHits(s, hits) : ['Nothing yet.']));
  }
  return lines.join('\n');
}

async function read(s: Session, value: string): Promise<string> {
  const { kind, id } = parseAnyRef(value);
  const missing = new Refused(`There is no ${kind} with that reference that you can see.`);

  if (kind === 'space') return spaceContext(s, id);

  if (kind === 'page') {
    const page = await readPage(s, id);
    if (!page) throw missing;
    const space = (await listSpaces(s)).find((candidate) => candidate.id === page.spaceId);
    return [
      `# ${page.title}`,
      `${page.type ? `A ${page.type} page` : 'A page'} in ${space?.name} (${ref('page', page.id)}, in ${ref('space', page.spaceId)})`,
      '',
      ...(page.items.length
        ? page.items.flatMap((item) => [
            `- ${item.body} (${ref('item', item.id)}, ${side(item.privateTo)})`,
            ...item.sources.map((source) => `  - Source: ${describeSource(source)}`),
          ])
        : ['Nothing on this page yet.']),
    ].join('\n');
  }

  if (kind === 'item') {
    const item = await readItem(s, id);
    if (!item) throw missing;
    return [
      item.body,
      '',
      `${ref('item', item.id)} on ${ref('page', item.pageId)}, ${side(item.privateTo)}, written by ${item.agent ?? 'a person'}.`,
      item.supersededBy ? `No longer true: replaced by ${ref('item', item.supersededBy)}.` : '',
      ...item.sources.map((source) => `- Source: ${describeSource(source)}`),
      ...(item.history.length ? ['\n## Earlier versions', ...item.history.map((revision) => `- ${revision.body}`)] : []),
    ]
      .filter((line) => line !== '')
      .join('\n');
  }

  const source = await readSource(s, id);
  if (!source) throw missing;
  return `${describeSource(source)}\n\n${ref('source', source.id)}, ${side(source.privateTo)}, in ${ref('space', source.spaceId)}.`;
}

async function remember(
  s: Session,
  input: {
    space: string;
    text: string;
    page?: string;
    type?: string;
    replaces?: string;
    updates?: string;
    sources?: { reference?: string; excerpt: string }[];
  },
): Promise<string> {
  const spaceId = parseRef(input.space, 'space');
  const sources = [];
  for (const source of input.sources ?? []) sources.push((await addSource(s, { spaceId, ...source })).id);

  if (input.replaces || input.updates) {
    if (input.replaces && input.updates) throw new Refused('Use either replaces or updates, not both.');
    const itemId = parseRef((input.replaces ?? input.updates)!, 'item');
    const item = await readItem(s, itemId);
    if (!item || item.spaceId !== spaceId) throw new Refused('There is no item with that reference in this space that you can see.');
    // Changing shared knowledge would publish, which remember never does.
    if (item.privateTo !== personOf(s.principal)) throw new Refused('remember only changes your private side, and that item is shared.');
    const changed = input.replaces
      ? await supersedeItem(s, itemId, { body: input.text, sources })
      : await updateItem(s, itemId, { body: input.text, sources });
    return input.replaces
      ? `Saved as ${ref('item', changed!.id)}. ${ref('item', itemId)} is kept as what used to be true.`
      : `Updated ${ref('item', itemId)}. What it said before is kept in its history.`;
  }

  if (!input.page) {
    const note = await addSource(s, { spaceId, excerpt: input.text, reference: `Noted by ${s.principal.agent ?? 'you'}` });
    return `Kept as a note on your private side (${ref('source', note.id)}). Search will find it.`;
  }

  const pageId = await pageFor(s, spaceId, input.page, input.type);
  const item = await writeItem(s, { pageId, body: input.text, sources });
  return `Saved on your private side, as ${ref('item', item.id)} on ${ref('page', pageId)}.`;
}

/** The page a reference points to, or the page with that title, created if there is none. */
async function pageFor(s: Session, spaceId: string, page: string, type?: string): Promise<string> {
  if (/^page:/i.test(page.trim())) {
    const id = parseRef(page, 'page');
    if ((await readPage(s, id))?.spaceId !== spaceId) {
      throw new Refused('There is no page with that reference in this space that you can see.');
    }
    return id;
  }
  const title = page.trim();
  const existing = (await listPages(s, spaceId)).find((candidate) => candidate.title?.toLowerCase() === title.toLowerCase());
  return existing?.id ?? createPage(s, { spaceId, title, type });
}

async function describeHits(s: Session, hits: Hit[]): Promise<string[]> {
  const names = new Map((await listSpaces(s)).map((space) => [space.id, space.name]));
  return hits.map((hit) => {
    const label =
      hit.kind === 'page'
        ? `Page "${hit.text}"`
        : hit.kind === 'source'
          ? `Source: ${describeSource({ reference: hit.title, excerpt: hit.text })}`
          : `${hit.title ? `${hit.title}: ` : ''}${hit.text}`;
    const where = `in ${names.get(hit.spaceId)}${hit.private ? ', private' : ''}`;
    return `- ${label} (${ref(hit.kind, hit.id)}, ${where})${hit.superseded ? '. No longer true.' : ''}`;
  });
}

function describeSource(source: { reference: string | null; excerpt: string }): string {
  return source.reference ? `${source.reference}: "${source.excerpt}"` : `"${source.excerpt}"`;
}

function side(privateTo: string | null): string {
  return privateTo ? 'private' : 'shared';
}

function tree(spaces: Space[], parentId: string | null = null, depth = 0): string[] {
  return spaces
    .filter((space) => space.parentId === parentId || (depth === 0 && !spaces.some((other) => other.id === space.parentId)))
    .flatMap((space) => [
      `${'  '.repeat(depth)}- ${space.name} (${ref('space', space.id)})${space.privateTo ? ', only yours' : ''}`,
      ...tree(spaces, space.id, depth + 1),
    ]);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
