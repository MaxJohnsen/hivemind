import { randomBytes } from 'node:crypto';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import type { Pool } from 'pg';
import type { Sql } from './db.ts';
import { acceptInvite, type Ticket } from './invites.ts';

export interface AuthSettings {
  /** Where Homing is reached. Passkeys belong to its host name. */
  url: URL;
  /** Signs sessions. */
  secret: string;
  /** Whether people may also sign in with a password. */
  passwords: boolean;
}

/**
 * Sign-in and sessions, through Better Auth. It connects as homing_auth and
 * keeps its tables in the auth schema. Homing owns people: an account is
 * created only by accepting an invite, with a passkey, and gets its person's id.
 */
export function createAuth(sql: Sql, pool: Pool, settings: AuthSettings) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(settings.url.hostname);

  return betterAuth({
    appName: 'Homing',
    baseURL: settings.url.origin,
    basePath: '/api/auth',
    secret: settings.secret,
    database: pool,
    trustedOrigins: [settings.url.origin],
    emailAndPassword: { enabled: settings.passwords, disableSignUp: true },
    // Accounts are never linked because an email address matches.
    account: { accountLinking: { enabled: false } },
    // Limits are kept per client address, which only a real deployment has.
    rateLimit: { enabled: !local },
    advanced: { cookiePrefix: 'homing', database: { generateId: 'uuid' } },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/passkey/generate-register-options') {
          // Adding a passkey to an account needs a recent sign-in, as other
          // sensitive changes do. Creating an account needs a ticket instead.
          const session = await getSessionFromCtx(ctx);
          const age = session && Date.now() - new Date(session.session.createdAt).getTime();
          if (age && age >= ctx.context.sessionConfig.freshAge * 1000) {
            throw APIError.from('FORBIDDEN', { code: 'SIGN_IN_AGAIN', message: 'Sign in again to add a passkey.' });
          }
        }
        if (ctx.path === '/passkey/delete-passkey') {
          const session = await getSessionFromCtx(ctx);
          const passwords = ctx.context.options.emailAndPassword?.enabled ?? false;
          if (session && (await waysToSignIn(ctx.context.adapter, session.user.id, passwords)) <= 1) {
            throw APIError.from('BAD_REQUEST', {
              code: 'LAST_WAY_TO_SIGN_IN',
              message: "This is your only way to sign in. Add another passkey first.",
            });
          }
        }
      }),
    },
    plugins: [
      passkey({
        rpID: settings.url.hostname,
        rpName: 'Homing',
        origin: settings.url.origin,
        // Sign-in offers saved passkeys without asking whose they are.
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
        registration: {
          requireSession: false,
          // Someone without an account registers a passkey for the account
          // their invite creates, named by the ticket POST /api/join gave them.
          resolveUser: async ({ ctx, context }) => {
            const ticket = await findTicket(ctx.context.internalAdapter, context);
            if (!ticket) throw expired();
            return { id: ticket.person, name: ticket.email, displayName: ticket.name };
          },
          afterVerification: async ({ ctx, user, context }) => {
            if (!context) return;
            const adapter = ctx.context.internalAdapter;
            const ticket = await findTicket(adapter, context);
            // A ticket creates one account, once, with its first passkey and a session, all together.
            if (!ticket || ticket.person !== user.id || !ctx.body?.createSession) throw expired();
            if (await adapter.findUserById(ticket.person)) throw expired();
            if (await adapter.findUserByEmail(ticket.email)) throw taken();
            // The account comes before the person. Its email is unique, so of two
            // sign-ups with the same email, the second stops here with its invite unused.
            try {
              await adapter.createUser(
                { id: ticket.person, name: ticket.name, email: ticket.email, emailVerified: false },
                { method: 'invite' },
              );
            } catch (error) {
              if (code(error) === '23505') throw taken();
              throw error;
            }
            try {
              await acceptInvite(sql, ticket);
            } catch (error) {
              if (code(error) === '42501') throw expired();
              throw error;
            }
            await adapter.deleteVerificationByIdentifier(ticketKey(context));
          },
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const ticketKey = (id: string) => `homing-join:${id}`;

/** Keeps a join ticket for ten minutes, and returns the id the join page holds. */
export async function saveTicket(auth: Auth, ticket: Ticket): Promise<string> {
  const id = randomBytes(24).toString('base64url');
  const { internalAdapter } = await auth.$context;
  await internalAdapter.createVerificationValue({
    identifier: ticketKey(id),
    value: JSON.stringify(ticket),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return id;
}

async function findTicket(
  adapter: { findVerificationValue(identifier: string): Promise<{ value: string; expiresAt: Date } | null> },
  id: string | null | undefined,
): Promise<Ticket | undefined> {
  const stored = id ? await adapter.findVerificationValue(ticketKey(id)) : null;
  return stored && new Date(stored.expiresAt) > new Date() ? (JSON.parse(stored.value) as Ticket) : undefined;
}

/** A database error's code, wherever the driver put it. */
function code(error: unknown): string | undefined {
  const { code, cause } = (error ?? {}) as { code?: string; cause?: { code?: string } };
  return code ?? cause?.code;
}

/**
 * The Better Auth endpoints Homing's pages use. The server answers only
 * these, so an upgrade can't quietly add a way into an account.
 */
export const authEndpoints = new Set([
  'POST /sign-in/email',
  'POST /sign-out',
  'GET /passkey/generate-authenticate-options',
  'POST /passkey/verify-authentication',
  'GET /passkey/generate-register-options',
  'POST /passkey/verify-registration',
  'POST /passkey/delete-passkey',
]);

interface Counter {
  count(query: { model: string; where: { field: string; value: string }[] }): Promise<number>;
}

/** How many passkeys, and passwords if they are on, an account can sign in with. */
async function waysToSignIn(adapter: Counter, userId: string, withPasswords: boolean): Promise<number> {
  const passkeys = await adapter.count({ model: 'passkey', where: [{ field: 'userId', value: userId }] });
  if (!withPasswords) return passkeys;
  const passwords = await adapter.count({
    model: 'account',
    where: [
      { field: 'userId', value: userId },
      { field: 'providerId', value: 'credential' },
    ],
  });
  return passkeys + passwords;
}

const expired = () =>
  APIError.from('BAD_REQUEST', { code: 'INVITE_EXPIRED', message: 'This invite has expired or was already used.' });

const taken = () =>
  APIError.from('CONFLICT', { code: 'EMAIL_TAKEN', message: 'There is already an account with this email.' });
