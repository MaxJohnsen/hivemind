import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { hostHeaderValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, localhostAllowedHostnames, type AuthInfo } from '@modelcontextprotocol/server';
import { toNodeHandler as authHandler } from 'better-auth/node';
import { Pool } from 'pg';
import { authEndpoints, createAuth, type Auth } from './auth.ts';
import { authDatabaseUrl, connect, type Sql } from './db.ts';
import { setupLink } from './invites.ts';
import { mcpServer } from './mcp.ts';
import { authenticate, type AgentPrincipal } from './tokens.ts';
import { handleApi, serveApp, type App } from './web.ts';

export interface ServerOptions {
  port: number;
  host?: string;
  /** Where Homing is reached. By default HOMING_URL, or localhost at the port it listens on. */
  url?: URL;
  /** Signs sessions. By default HOMING_SECRET, which only a local install may leave out. */
  secret?: string;
  /** Sign-in's own database connection, as homing_auth. */
  authDatabase?: string;
}

export interface Homing {
  url: URL;
  auth: Auth;
  server: Server;
  close(): Promise<void>;
}

/** Serves the web app, sign-in, and MCP at /mcp. */
export async function startServer(sql: Sql, options: ServerOptions): Promise<Homing> {
  let app: App | undefined;
  let mcp: ReturnType<typeof toNodeHandler>;
  let auth: ReturnType<typeof authHandler>;
  let validateHost: ReturnType<typeof hostHeaderValidation>;

  const server = createServer(async (req, res) => {
    try {
      if (!app) {
        res.writeHead(503).end();
        return;
      }
      if (!validateHost(req, res)) return;
      const path = new URL(req.url ?? '/', app.url).pathname;
      if (path === '/mcp') {
        const token = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '')?.[1];
        const principal = token && (await authenticate(sql, token));
        if (!principal) {
          res.writeHead(401, { 'www-authenticate': 'Bearer' }).end();
          return;
        }
        const info: AuthInfo = { token: '', clientId: principal.agent, scopes: [], extra: { principal } };
        await mcp(Object.assign(req, { auth: info }) as IncomingMessage & { auth: AuthInfo }, res);
      } else if (path.startsWith('/api/auth/')) {
        if (authEndpoints.has(`${req.method} ${path.slice('/api/auth'.length)}`)) await auth(req, res);
        else res.writeHead(404).end();
      } else if (path.startsWith('/api/')) {
        await handleApi(app, req, res, path);
      } else {
        await serveApp(app, req, res, path);
      }
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.writeHead(500).end();
    }
  });

  await new Promise<void>((resolve) => server.listen(options.port, options.host, resolve));
  const url = options.url ?? configuredUrl ?? new URL(`http://localhost:${(server.address() as AddressInfo).port}`);
  const secret = options.secret ?? secretFor(url);
  const pool = new Pool({ connectionString: options.authDatabase ?? authDatabaseUrl, options: '-c search_path=auth' });
  const homingAuth = createAuth(sql, pool, { url, secret, passwords: process.env.HOMING_PASSWORDS !== 'off' });

  mcp = toNodeHandler(createMcpHandler(({ authInfo }) => mcpServer(sql, authInfo?.extra?.principal as AgentPrincipal)));
  auth = authHandler(homingAuth);
  // Refuses requests addressed to other host names, which protects a local install from DNS rebinding.
  validateHost = hostHeaderValidation(isLocal(url) ? localhostAllowedHostnames() : [url.hostname]);
  app = { sql, auth: homingAuth, url, secret };

  return {
    url,
    auth: homingAuth,
    server,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
    },
  };
}

/** Where Homing is reached, which decides the host names it answers to. */
const configuredUrl = process.env.HOMING_URL ? new URL(process.env.HOMING_URL) : undefined;

function isLocal(url: URL): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

// Anyone could sign sessions with this one, so only a local install may use it.
const developmentSecret = 'homing-development-secret-for-localhost-only';

function secretFor(url: URL): string {
  const secret = process.env.HOMING_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (!secret && isLocal(url)) return developmentSecret;
  throw new Error('Set HOMING_SECRET to at least 32 random characters, such as the output of `openssl rand -base64 32`.');
}

// Migrations run as a separate step before this, so the server never holds the admin role.
if (import.meta.main) {
  const sql = connect();
  const port = Number(process.env.PORT ?? 4100);
  const homing = await startServer(sql, { port, host: process.env.HOST ?? '127.0.0.1' });
  console.log(`Homing is running at ${homing.url}, with MCP at ${new URL('/mcp', homing.url)}`);
  const link = await setupLink(sql, homing.url);
  if (link) {
    console.log(`\nCreate the first account with this link. It also looks after this Homing, and works for an hour:\n\n  ${link}\n\nRestart Homing for a new link.\n`);
  }
}
