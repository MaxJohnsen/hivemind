import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Session, Sql } from './db.ts';

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

/**
 * A new invite from the instance admin. It works once, for a week. If it is
 * sent to an email address, accepting it with that address verifies it.
 */
export async function createInvite(s: Session, url: URL, email?: string): Promise<{ link: string; expiresAt: Date }> {
  const token = newToken();
  const [{ expiresAt }] = await s.tx<{ expiresAt: Date }[]>`select create_invite(${hash(token)}, ${email ?? null}) as expires_at`;
  return { link: inviteLink(url, token), expiresAt };
}

/** An invite that can still be used. */
export interface Invite {
  instanceAdmin: boolean;
  /** The address it was sent to, if it was sent. */
  email: string | null;
  /** The name of whoever sent it. */
  invitedBy: string | null;
}

export async function findInvite(sql: Sql, token: string): Promise<Invite | undefined> {
  const [invite] = await sql<Invite[]>`select instance_admin, email, invited_by from find_invite(${hash(token)})`;
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
  /** Whether the invite went to this email, which proves it's theirs. */
  emailVerified: boolean;
  /** Whether the account becomes the instance admin, which signs in only with passkeys. */
  instanceAdmin: boolean;
}

export function newTicket(invite: Invite, input: { token: string; name: string; email: string }): Ticket {
  return {
    invite: hash(input.token).toString('base64url'),
    person: randomUUID(),
    name: input.name,
    email: input.email,
    emailVerified: invite.email === input.email,
    instanceAdmin: invite.instanceAdmin,
  };
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
