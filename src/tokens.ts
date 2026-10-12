import { createHash, randomBytes } from 'node:crypto';
import type { Principal, Session, Sql } from './db.ts';

/** Creates a token that lets an agent act for the session's person. It is shown only once. */
export async function createToken(s: Session, agent: string): Promise<string> {
  const token = `hm_${randomBytes(32).toString('base64url')}`;
  await s.tx`select create_token(${agent}, ${hash(token)})`;
  return token;
}

/** Who a token acts for, if it is valid. */
export async function authenticate(sql: Sql, token: string): Promise<Principal | undefined> {
  const [found] = await sql<{ personId: string | null; agent: string }[]>`
    select person_id, agent from authenticate(${hash(token)})
  `;
  return found?.personId ? { person: found.personId, agent: found.agent } : undefined;
}

function hash(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}
