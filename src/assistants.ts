import { createLocalJWKSet, errors, jwtVerify } from 'jose';
import type { Pool } from 'pg';
import { mcpResource, type Auth } from './auth.ts';

/** A person, and the assistant acting for them, such as "Claude". */
export interface AgentPrincipal {
  person: string;
  agent: string;
}

/** An assistant someone has connected, and can disconnect. */
export interface ConnectedAssistant {
  clientId: string;
  name: string;
  connectedAt: Date;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Who an access token acts for: its person, and the assistant it was issued
 * to. The token must be Homing's own access token, for /mcp and current, and the person
 * must not have disconnected the assistant since it was issued, so
 * disconnecting takes effect at once. Keys are checked here, without asking
 * the server over the network.
 */
export function tokenVerifier(auth: Auth, pool: Pool, url: URL) {
  let keys: ReturnType<typeof createLocalJWKSet> | undefined;
  const loadKeys = async () => (keys = createLocalJWKSet(await auth.api.getJwks()));
  // An access token (RFC 9068), not an ID token or anything else Homing signs.
  const options = { issuer: new URL('/api/auth', url).toString(), audience: mcpResource(url), typ: 'at+jwt' };

  const verify = async (token: string) => {
    try {
      return (await jwtVerify(token, keys ?? (await loadKeys()), options)).payload;
    } catch (error) {
      // A key made since the last load.
      if (error instanceof errors.JWKSNoMatchingKey) return (await jwtVerify(token, await loadKeys(), options)).payload;
      throw error;
    }
  };

  return async (token: string): Promise<AgentPrincipal | undefined> => {
    const claims = await verify(token).catch(() => undefined);
    const person = claims?.sub;
    const clientId = claims?.azp ?? claims?.client_id;
    if (!person || !uuid.test(person) || typeof clientId !== 'string' || typeof claims?.iat !== 'number') return undefined;

    const { rows } = await pool.query<{ name: string | null }>(
      `select client.name from "oauthConsent" consent
       join "oauthClient" client on client."clientId" = consent."clientId"
       where consent."userId" = $1 and consent."clientId" = $2
         and not coalesce(client.disabled, false)
         and $3 >= floor(extract(epoch from consent."createdAt"))`,
      [person, clientId, claims.iat],
    );
    if (!rows[0]) return undefined;
    return { person, agent: rows[0].name || hostOf(clientId) };
  };
}

/** The assistants a person has connected, most recent first. */
export async function connectedAssistants(pool: Pool, person: string): Promise<ConnectedAssistant[]> {
  const { rows } = await pool.query<{ clientId: string; name: string | null; connectedAt: Date }>(
    `select consent."clientId", client.name, consent."createdAt" as "connectedAt"
     from "oauthConsent" consent
     join "oauthClient" client on client."clientId" = consent."clientId"
     where consent."userId" = $1
     order by consent."createdAt" desc`,
    [person],
  );
  return rows.map((row) => ({ ...row, name: row.name || hostOf(row.clientId) }));
}

/**
 * Disconnects an assistant at once. Its access tokens stop working with its
 * consent, and its refresh tokens are revoked so it can't get new ones.
 */
export async function disconnectAssistant(pool: Pool, person: string, clientId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rowCount } = await client.query('delete from "oauthConsent" where "userId" = $1 and "clientId" = $2', [person, clientId]);
    for (const table of ['oauthRefreshToken', 'oauthAccessToken']) {
      await client.query(`update "${table}" set revoked = now() where "userId" = $1 and "clientId" = $2 and revoked is null`, [person, clientId]);
    }
    await client.query('commit');
    return Boolean(rowCount);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

function hostOf(clientId: string): string {
  try {
    return new URL(clientId).hostname;
  } catch {
    return clientId;
  }
}
