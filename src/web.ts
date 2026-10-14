import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname } from 'node:path';
import { fromNodeHeaders } from 'better-auth/node';
import type { Auth } from './auth.ts';
import { withPrincipal, type Sql } from './db.ts';
import { findInvite, issueTicket } from './invites.ts';

/** What the web app's requests need from the server. */
export interface App {
  sql: Sql;
  auth: Auth;
  url: URL;
  secret: string;
}

/** Homing's own endpoints for its pages. Sign-in itself is Better Auth's, under /api/auth. */
export async function handleApi(app: App, req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const headers = fromNodeHeaders(req.headers);

  if (req.method === 'POST' && headers.get('origin') !== app.url.origin) {
    return json(res, 403, { message: 'Requests must come from Homing itself.' });
  }

  if (req.method === 'POST' && path === '/api/invite') {
    const { token } = await readJson(req);
    const invite = typeof token === 'string' ? await findInvite(app.sql, token) : undefined;
    if (!invite) return json(res, 410, { message: 'This invite has expired or was already used.' });
    return json(res, 200, invite);
  }

  if (req.method === 'POST' && path === '/api/join') {
    const body = await readJson(req);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const token = typeof body.token === 'string' ? body.token : '';
    if (await app.auth.api.getSession({ headers })) {
      return json(res, 409, { code: 'SIGNED_IN', message: 'Sign out first to create a new account with this invite.' });
    }
    if (!(await findInvite(app.sql, token))) return json(res, 410, { message: 'This invite has expired or was already used.' });
    if (!name || name.length > 200) return json(res, 400, { field: 'name', message: 'Enter your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { field: 'email', message: 'Enter an email address, like ana@example.com.' });
    const context = await app.auth.$context;
    if (await context.internalAdapter.findUserByEmail(email)) {
      return json(res, 409, { field: 'email', message: 'There is already an account with this email. Sign in instead.' });
    }
    return json(res, 200, { ticket: issueTicket(app.secret, { token, name, email }) });
  }

  if (req.method === 'GET' && path === '/api/sign-in-options') {
    return json(res, 200, { passwords: app.auth.options.emailAndPassword?.enabled ?? false });
  }

  if (req.method === 'GET' && path === '/api/me') {
    const session = await app.auth.api.getSession({ headers });
    if (!session) return json(res, 401, { message: 'Sign in first.' });
    const [person] = await withPrincipal(app.sql, { person: session.user.id }, ({ tx }) => tx<{ name: string; instanceAdmin: boolean }[]>`
      select name, instance_admin from people where id = ${session.user.id}::uuid
    `);
    const passkeys = await app.auth.api.listPasskeys({ headers });
    return json(res, 200, {
      name: person?.name ?? session.user.name,
      email: session.user.email,
      instanceAdmin: person?.instanceAdmin ?? false,
      passkeys: passkeys.map(({ id, name, createdAt }) => ({ id, name: name ?? null, createdAt })),
    });
  }

  return json(res, 404, { message: 'Not found.' });
}

const dist = new URL('../web/dist/app/', import.meta.url);

/** The pages of the web app. Each one loads the same single-page app. */
const pages = new Set(['/sign-in', '/setup', '/join', '/account']);

const types: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** Serves the built web app, and sends the home page to sign-in or your account. */
export async function serveApp(app: App, req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end();
    return;
  }

  if (path === '/') {
    const session = await app.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    res.writeHead(302, { location: session ? '/account' : '/sign-in' }).end();
    return;
  }

  // Built files have a hash in their name, so they never change.
  const asset = /^\/assets\/[\w.-]+$/.test(path) || path === '/favicon.svg';
  const file = asset ? path.slice(1) : 'index.html';
  let body: Buffer;
  try {
    body = await readFile(new URL(file, dist));
  } catch {
    if (asset) {
      res.writeHead(404).end();
    } else {
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }).end('The web app is not built. Run `npm run build:web`.\n');
    }
    return;
  }

  if (asset) {
    res.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': path === '/favicon.svg' ? 'public, max-age=86400' : 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    });
  } else {
    res.writeHead(pages.has(path) ? 200 : 404, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
      'content-security-policy':
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    });
  }
  res.end(req.method === 'HEAD' ? undefined : body);
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 64 * 1024) throw new Error('request body too large');
    chunks.push(chunk as Buffer);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}
