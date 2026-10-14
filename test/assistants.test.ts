// Issue #5, done when: assistants connect to Homing and act as the signed-in
// person. One that hasn't signed in gets nothing, a disconnected one stops
// working at once, and an instance admin can't sign in as anyone else.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { authDatabaseUrl } from '../src/db.ts';
import { startServer, type Homing } from '../src/server.ts';
import { createSpace } from '../src/spaces.ts';
import { Assistant, assistants, fetchClientMetadata } from './assistant.ts';
import { admin, as, authDb, db, member } from './helpers.ts';
import { inTestDatabase } from './reset.ts';

let homing: Homing;

before(async () => {
  homing = await startServer(db, { port: 0, host: '127.0.0.1', authDatabase: inTestDatabase(authDatabaseUrl), fetchClientMetadata });
});

after(() => homing.close());

test('an assistant acts as the person who signed in and allowed it', async () => {
  const ana = await member(homing.url, 'Ana');
  const acme = await as(ana, (s) => createSpace(s, { name: 'Acme' }));
  const claude = new Assistant(homing.url);

  const { page, callback } = await claude.connect(ana.browser);
  // Homing asks the person first, on its own page.
  assert.equal(page.pathname, '/connect');
  assert.equal(page.searchParams.get('client_id'), assistants.claude.client_id);
  // The answer names Homing as its issuer, so the assistant can tell it's the right server (RFC 9207).
  assert.equal(callback?.searchParams.get('iss'), new URL('/api/auth', homing.url).toString());

  // Only its access token works, not the ID token that came with it.
  const idToken = (claude.tokens as { id_token?: string }).id_token;
  assert.ok(idToken);
  const withIdToken = await fetch(new URL('/mcp', homing.url), {
    method: 'POST',
    headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  assert.equal(withIdToken.status, 401);

  const session = await claude.open();
  const saved = await session.call('remember', { space: `space:${acme}`, text: 'Acme launches on 1 March' });
  assert.equal(saved.failed, false, saved.text);
  const [item] = await admin`select written_by, agent from content where body = 'Acme launches on 1 March' and space_id = ${acme}`;
  assert.deepEqual(item, { writtenBy: ana.id, agent: 'Claude' });

  const me = await ana.browser.json('/api/me');
  assert.deepEqual(me.body.assistants.map((assistant: { name: string }) => assistant.name), ['Claude']);
  assert.equal(me.body.mcpUrl, new URL('/mcp', homing.url).toString());
});

test('an assistant that hasn’t signed in gets nothing, and is told where to sign in', async () => {
  const ana = await member(homing.url, 'Ana');
  const call = (authorization?: string) =>
    fetch(new URL('/mcp', homing.url), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(authorization && { authorization }) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

  const anonymous = await call();
  assert.equal(anonymous.status, 401);
  const metadata = /resource_metadata="([^"]+)"/.exec(anonymous.headers.get('www-authenticate') ?? '')?.[1];
  assert.ok(metadata);
  const resource = await (await fetch(metadata)).json();
  assert.equal(resource.resource, new URL('/mcp', homing.url).toString());
  const server = await (await fetch(new URL('/.well-known/oauth-authorization-server/api/auth', homing.url))).json();
  assert.equal(server.client_id_metadata_document_supported, true);
  // Assistants name themselves with a metadata document; nobody registers clients.
  assert.equal(server.registration_endpoint, undefined);

  assert.equal((await call('Bearer not-a-token')).status, 401);
  // A token Homing signed for something other than /mcp isn't accepted either, even for a connected assistant.
  await new Assistant(homing.url).connect(ana.browser);
  const { token } = await homing.auth.api.signJWT({
    body: { payload: { sub: ana.id, azp: assistants.claude.client_id, aud: 'https://elsewhere.test/api', iss: new URL('/api/auth', homing.url).toString(), iat: Math.floor(Date.now() / 1000) } },
  });
  assert.equal((await call(`Bearer ${token}`)).status, 401);
});

test('disconnecting an assistant stops it at once, and it can’t get new tokens', async () => {
  const ana = await member(homing.url, 'Ana');
  const claude = new Assistant(homing.url);
  await claude.connect(ana.browser);
  const chatgpt = new Assistant(homing.url, assistants.chatgpt);
  await chatgpt.connect(ana.browser);
  const working = await claude.open();
  assert.equal((await working.call('context', { request: 'What am I working on?' })).failed, false);

  const disconnected = await ana.browser.json('/api/assistants/disconnect', { clientId: assistants.claude.client_id });
  assert.equal(disconnected.status, 200);

  // The same session and the same access token are refused from the next request.
  await assert.rejects(working.call('context', { request: 'What am I working on?' }));
  const refreshed = await fetch(new URL('/api/auth/oauth2/token', homing.url), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: claude.tokens!.refresh_token!, client_id: assistants.claude.client_id }),
  });
  assert.equal(refreshed.status, 400);

  // The other assistant keeps working, and reconnecting asks the person again.
  assert.equal((await (await chatgpt.open()).call('context', { request: 'What am I working on?' })).failed, false);
  const stale = claude.tokens!.access_token;
  // Tokens tell time in whole seconds, and a person reconnects seconds later at the earliest.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const again = await new Assistant(homing.url).connect(ana.browser);
  assert.equal(again.page.pathname, '/connect');
  // A token from before the disconnect stays refused after reconnecting.
  const status = await fetch(new URL('/mcp', homing.url), {
    method: 'POST',
    headers: { authorization: `Bearer ${stale}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  assert.equal(status.status, 401);
});

test('an assistant the person doesn’t allow gets no access', async () => {
  const ana = await member(homing.url, 'Ana');
  const claude = new Assistant(homing.url);
  const { callback } = await claude.connect(ana.browser, { allow: false });
  assert.equal(callback?.searchParams.get('error'), 'access_denied');
  assert.equal(claude.tokens, undefined);
  assert.deepEqual((await ana.browser.json('/api/me')).body.assistants, []);
});

test('nobody, the instance admin included, can act as someone else', async () => {
  const ana = await member(homing.url, 'Ana');
  const acme = await as(ana, (s) => createSpace(s, { name: 'Acme' }));
  const anas = new Assistant(homing.url);
  await anas.connect(ana.browser);
  await (await anas.open()).call('remember', { space: `space:${acme}`, text: 'Acme launches on 1 March' });

  const ida = await member(homing.url, 'Ida');
  await admin`update people set instance_admin = true where id = ${ida.id}`;

  // Sign-in offers no way in: no impersonation, no setting someone's password, no making clients.
  for (const path of ['/api/auth/admin/impersonate-user', '/api/auth/admin/set-user-password', '/api/auth/admin/create-user', '/api/auth/oauth2/register', '/api/auth/oauth2/create-client']) {
    assert.equal((await ida.browser.json(path, { userId: ana.id, newPassword: 'taken-over-123' })).status, 404, path);
  }

  // Nor through sign-in's own server API: nobody, signed in or not, makes OAuth clients.
  await assert.rejects(
    homing.auth.api.createOAuthClient({
      headers: new Headers({ cookie: ida.browser.cookieHeader() }),
      body: { redirect_uris: ['https://evil.test/callback'], client_name: 'Claude' },
    }),
  );

  // The instance admin's own assistant sees only what the instance admin can.
  const idas = new Assistant(homing.url);
  await idas.connect(ida.browser);
  const found = await (await idas.open()).call('search', { query: 'Acme launches' });
  assert.doesNotMatch(found.text, /Acme launches on 1 March/);

  // Disconnecting acts only on your own connections.
  await ida.browser.json('/api/assistants/disconnect', { clientId: assistants.claude.client_id });
  assert.match((await (await anas.open()).call('search', { query: 'Acme launches' })).text, /Acme launches on 1 March/);
  assert.equal((await authDb`select count(*)::int as n from auth."oauthConsent" where "userId" = ${ana.id}`)[0].n, 1);
});
