import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Sql } from './db.ts';

/** A one-time link for creating an account. Only a hash of its token is kept. */
export function inviteLink(url: URL, token: string, page = 'join'): string {
  // The token is in the fragment, so it never reaches a server log or another site.
  return new URL(`/${page}#${token}`, url).toString();
}

/**
 * Makes a new setup link, which creates the first account and makes it the
 * instance admin. There is none once someone is the instance admin.
 */
export async function setupLink(sql: Sql, url: URL): Promise<string | undefined> {
  const token = newToken();
  const [{ created }] = await sql`select create_setup_invite(${hash(token)}) as created`;
  return created ? inviteLink(url, token, 'setup') : undefined;
}

/** What an invite that can still be used is for. */
export async function findInvite(sql: Sql, token: string): Promise<{ instanceAdmin: boolean } | undefined> {
  const [invite] = await sql<{ instanceAdmin: boolean }[]>`select instance_admin from find_invite(${hash(token)})`;
  return invite;
}

/**
 * Someone accepting an invite, between checking it and creating their
 * account with a passkey. Homing keeps it, and the page holds only its id.
 */
export interface Ticket {
  /** The hash of the invite's token. */
  invite: string;
  /** The id the new person and their account get. */
  person: string;
  name: string;
  email: string;
}

export function newTicket(input: { token: string; name: string; email: string }): Ticket {
  return { invite: hash(input.token).toString('base64url'), person: randomUUID(), name: input.name, email: input.email };
}

/** Creates the ticket's person, with their personal space, and uses up the invite. */
export async function acceptInvite(sql: Sql, ticket: Ticket): Promise<void> {
  await sql`select accept_invite(${Buffer.from(ticket.invite, 'base64url')}, ${ticket.person}::uuid, ${ticket.name})`;
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

function hash(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}
