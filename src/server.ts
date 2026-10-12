import { createServer, type IncomingMessage, type Server } from 'node:http';
import { hostHeaderValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, localhostAllowedHostnames, type AuthInfo } from '@modelcontextprotocol/server';
import { connect, type Principal, type Sql } from './db.ts';
import { mcpServer } from './mcp.ts';
import { migrate } from './migrate.ts';
import { authenticate } from './tokens.ts';

/** Where Hivemind is reached, which decides the host names it answers to. */
export const publicUrl = new URL(process.env.HIVEMIND_URL ?? 'http://localhost:4100');

/** Serves MCP at /mcp. Every request needs a valid token. */
export function startServer(sql: Sql, options: { port: number; host?: string }): Promise<Server> {
  const mcp = toNodeHandler(
    createMcpHandler(({ authInfo }) => mcpServer(sql, authInfo?.extra?.principal as Principal)),
  );
  // Refuses requests addressed to other host names, which protects a local install from DNS rebinding.
  const validateHost = hostHeaderValidation(
    publicUrl.hostname === 'localhost' ? localhostAllowedHostnames() : [publicUrl.hostname],
  );

  const server = createServer(async (req, res) => {
    try {
      if (!validateHost(req, res)) return;
      if (new URL(req.url ?? '/', publicUrl).pathname !== '/mcp') {
        res.writeHead(404).end();
        return;
      }
      const token = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '')?.[1];
      const principal = token && (await authenticate(sql, token));
      if (!principal) {
        res.writeHead(401, { 'www-authenticate': 'Bearer' }).end();
        return;
      }
      const auth: AuthInfo = { token: '', clientId: principal.agent ?? 'agent', scopes: [], extra: { principal } };
      await mcp(Object.assign(req, { auth }) as IncomingMessage & { auth: AuthInfo }, res);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.writeHead(500).end();
    }
  });

  return new Promise((resolve) => server.listen(options.port, options.host, () => resolve(server)));
}

if (import.meta.main) {
  await migrate();
  const port = Number(process.env.PORT ?? publicUrl.port ?? 4100);
  await startServer(connect(), { port, host: process.env.HOST ?? '127.0.0.1' });
  console.log(`Hivemind is serving MCP at ${new URL('/mcp', publicUrl)}`);
}
