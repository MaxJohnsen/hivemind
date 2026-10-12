import { createHash, randomBytes } from 'node:crypto';
import type { Session, Sql } from './db.ts';

/** A person, and the agent acting for them with a token. */
export interface AgentPrincipal {
  person: string;
  agent: string;
}

/** Creates a token that lets an agent act for the session's person. It is shown only once. */
export async function createToken(s: Session, agent: string): Promise<string> {
  const token = `hm_${randomBytes(32).toString('base64url')}`;
  await s.tx`select create_token(${agent}, ${hash(token)})`;
  return token;
}

/** Revokes all of the session's person's tokens, such as after one leaked. */
export async function revokeTokens(s: Session): Promise<number> {
  const [{ count }] = await s.tx`select revoke_tokens() as count`;
  return count;
}

/** Who a token acts for, if it is valid. */
export async function authenticate(sql: Sql, token: string): Promise<AgentPrincipal | undefined> {
  const [found] = await sql<{ personId: string | null; agent: string }[]>`
    select person_id, agent from authenticate(${hash(token)})
  `;
  return found?.personId ? { person: found.personId, agent: found.agent } : undefined;
}

function hash(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}
