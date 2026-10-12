// End to end through MCP, as issue #2 asks: an agent saves knowledge to a
// client space with remember, a new session finds it with context and search,
// and another person can't see it.

import assert from 'node:assert/strict';
import type { AddressInfo, Server } from 'node:net';
import { after, before, test } from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createPage, writeItem } from '../src/knowledge.ts';
import { startServer } from '../src/server.ts';
import { createSpace } from '../src/spaces.ts';
import { createToken } from '../src/tokens.ts';
import { as, db, person } from './helpers.ts';

let server: Server;
let url: URL;

before(async () => {
  server = await startServer(db, { port: 0, host: '127.0.0.1' });
  url = new URL(`http://localhost:${(server.address() as AddressInfo).port}/mcp`);
});

after(() => new Promise((resolve) => server.close(resolve)));

/** A new agent session for a person, like opening Claude Code. */
async function session(token: string) {
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${token}` } } }),
  );
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    const text = result.content.map((block) => (block.type === 'text' ? block.text : '')).join('\n');
    return { text, failed: Boolean(result.isError) };
  };
  return { call, close: () => client.close() };
}

/** Ana works for Acme and Ben for Beta. Each has Claude Code connected. */
async function clients() {
  const ana = await person('Ana');
  const ben = await person('Ben');
  const acme = await as(ana, (s) => createSpace(s, { name: 'Acme' }));
  await as(ben, (s) => createSpace(s, { name: 'Beta' }));
  return {
    acme: `space:${acme}`,
    ana: await as(ana, (s) => createToken(s, 'Claude Code')),
    ben: await as(ben, (s) => createToken(s, 'Claude Code')),
    anaId: ana.id,
    acmeId: acme,
  };
}

const refIn = (text: string, kind: string) => new RegExp(`${kind}:[0-9a-f-]{36}`).exec(text)?.[0];

test('an agent saves knowledge, and a new session finds it again', async () => {
  const { acme, ana } = await clients();

  const first = await session(ana);
  const start = await first.call('context', { request: 'Gunnar says the Acme launch moves to 1 March' });
  assert.match(start.text, /You are Ana/);
  assert.ok(start.text.includes(`## Spaces that match\n- Acme (${acme}): named in the request`));
  const saved = await first.call('remember', {
    space: acme,
    page: 'Launch',
    type: 'project',
    text: 'Acme launches on 1 March',
    sources: [{ reference: 'Email from Gunnar, 3 October', excerpt: 'We are moving the launch to 1 March.' }],
  });
  assert.match(saved.text, /Saved on your private side/);
  await first.close();

  const second = await session(ana);
  const context = await second.call('context', { request: 'When does Acme launch?', space: acme });
  assert.match(context.text, /- Launch \(project\), page:/);
  assert.match(context.text, /Launch: Acme launches on 1 March \(item:[0-9a-f-]+, in Acme, private\)/);

  const found = await second.call('search', { query: 'launch date' });
  assert.match(found.text, /Acme launches on 1 March/);

  const page = await second.call('read', { ref: refIn(context.text, 'page') });
  assert.match(page.text, /Source: Email from Gunnar, 3 October: "We are moving the launch to 1 March."/);
  await second.close();
});

test('another person can’t see it, or write to it', async () => {
  const { acme, ana, ben } = await clients();
  const anas = await session(ana);
  const saved = await anas.call('remember', { space: acme, page: 'Launch', text: 'Acme launches on 1 March' });
  const page = refIn(saved.text, 'page');
  await anas.close();

  const bens = await session(ben);
  assert.doesNotMatch((await bens.call('context', { request: 'Acme launch' })).text, /Acme/);
  assert.equal((await bens.call('search', { query: 'Acme launch' })).text, 'No matches.');
  assert.equal((await bens.call('context', { request: 'launch', space: acme })).failed, true);
  assert.equal((await bens.call('read', { ref: page })).failed, true);
  assert.equal((await bens.call('remember', { space: acme, page: 'Launch', text: 'Beta was here' })).failed, true);
  await bens.close();
});

test('remember never changes the shared side', async () => {
  const { acme, acmeId, ana, anaId } = await clients();
  const decision = await as({ person: anaId }, async (s) => {
    const page = await createPage(s, { spaceId: acmeId, title: 'Launch', shared: true });
    return writeItem(s, { pageId: page, body: 'Acme launches on 1 March', shared: true });
  });

  const anas = await session(ana);
  for (const change of ['replaces', 'updates']) {
    const attempt = await anas.call('remember', { space: acme, text: 'Acme launches in April', [change]: `item:${decision.id}` });
    assert.equal(attempt.failed, true);
    assert.match(attempt.text, /only changes your private side/);
  }
  await anas.close();
});

test('requests without a valid token are refused', async () => {
  for (const authorization of [undefined, 'Bearer hm_not-a-real-token']) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(authorization && { authorization }) },
      body: '{}',
    });
    assert.equal(response.status, 401);
  }
});
