import { randomBytes } from 'node:crypto';
import { cimd } from '@better-auth/cimd';
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import { mcp } from '@better-auth/mcp';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { jwt, magicLink } from 'better-auth/plugins';
import type { Pool } from 'pg';
import type { Sql } from './db.ts';
import { emails, type Mailer } from './email.ts';
import { acceptInvite, type Ticket } from './invites.ts';

export interface AuthSettings {
  /** Where Homing is reached. Passkeys belong to its host name. */
  url: URL;
  /** Signs sessions. */
  secret: string;
  /** Whether people may also sign in with a password. */
  passwords: boolean;
  /** Whether sign-in limits how often each client tries, by the address the server gives it. */
  rateLimit: boolean;
  /**
   * Fetches an assistant's client metadata document from its own site. Tests
   * replace it, since that site is outside Homing.
   */
  fetchClientMetadata?: typeof fetchClientMetadataResource;
  /**
   * The sites whose assistants may connect, by the host of their client
   * metadata document, or `*` for any. Each one can send people back to its
   * own addresses, so Homing doesn't trust every site that publishes one.
   */
  assistantSites: string[];
  /** Sends email, if Homing has a way to. */
  mailer?: Mailer;
  /**
   * For whoever runs the server: receives sign-in links for anyone, instead
   * of email only going to verified addresses. Only the command line sets it.
   */
  operatorLinks?: (link: string) => void;
}

/** Where the server puts the address a request comes from, for sign-in's rate limits. */
export const clientAddressHeader = 'x-homing-client-address';

/**
 * Sign-in, sessions and OAuth for assistants, through Better Auth. It
 * connects as homing_auth and keeps its tables in the auth schema. Homing
 * owns people: an account is created only by accepting an invite, with a
 * passkey, and gets its person's id.
 */
export function createAuth(sql: Sql, pool: Pool, settings: AuthSettings) {
  return betterAuth({
    appName: 'Homing',
    baseURL: settings.url.origin,
    basePath: '/api/auth',
    secret: settings.secret,
    database: pool,
    trustedOrigins: [settings.url.origin],
    emailAndPassword: { enabled: settings.passwords, disableSignUp: true, minPasswordLength: 10, maxPasswordLength: 128 },
    // With email, people can verify their address, so it can be used for recovery.
    emailVerification: settings.mailer && {
      sendVerificationEmail: async ({ user, url }) => settings.mailer!(emails.verify(user.email, url)),
    },
    // Accounts are never linked because an email address matches.
    account: { accountLinking: { enabled: false } },
    rateLimit: { enabled: settings.rateLimit },
    advanced: {
      cookiePrefix: 'homing',
      database: { generateId: 'uuid' },
      // Only the server's own answer to who a request comes from, never a header the client sent.
      ipAddress: { ipAddressHeaders: [clientAddressHeader] },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/passkey/generate-register-options') {
          // Adding a passkey to an account needs a recent sign-in, as adding
          // a password does. Creating an account needs a ticket instead.
          const session = await getSessionFromCtx(ctx);
          if (session && !signedInRecently(session.session)) {
            throw APIError.from('FORBIDDEN', { code: 'SIGN_IN_AGAIN', message: 'Sign in again to add a passkey.' });
          }
        }
        if (ctx.path === '/send-verification-email') {
          // Only to your own address, while signed in.
          const session = await getSessionFromCtx(ctx);
          if (!session || ctx.body?.email?.toLowerCase() !== session.user.email) {
            throw APIError.from('UNAUTHORIZED', { code: 'SIGN_IN_FIRST', message: 'Sign in to verify your email.' });
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
                { id: ticket.person, name: ticket.name, email: ticket.email, emailVerified: ticket.emailVerified },
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
      // Signs the access tokens assistants use at /mcp.
      jwt(),
      mcp({
        resource: mcpResource(settings.url),
        loginPage: '/sign-in',
        consentPage: '/connect',
        // Nobody manages OAuth clients through the API, which the default
        // allows any signed-in person to do. Assistants identify themselves
        // with a client metadata document at their own address instead.
        clientPrivileges: () => false,
        // Sign-in names the assistant that sent you, from its signed request.
        allowPublicClientPrelogin: true,
      }),
      cimd({
        fetchClientMetadataResource: settings.fetchClientMetadata ?? fetchClientMetadataResource,
        metadataProfile: 'mcp-2026-07-28',
        isMetadataDocumentUrlAllowed: (clientId) =>
          settings.assistantSites.includes('*') || settings.assistantSites.includes(new URL(clientId).hostname),
      }),
      // Recovery: a one-time sign-in link, by email only to a verified address,
      // or from whoever runs the server. It never creates an account.
      magicLink({
        disableSignUp: true,
        expiresIn: settings.operatorLinks ? 60 * 60 : 15 * 60,
        storeToken: 'hashed',
        sendMagicLink: async ({ email, url }, ctx) => {
          if (settings.operatorLinks) return settings.operatorLinks(url);
          const user = await ctx?.context.internalAdapter.findUserByEmail(email);
          if (settings.mailer && user?.user.emailVerified) await settings.mailer(emails.signIn(user.user.email, url));
        },
      }),
    ],
  });
}

/** The address assistants connect to, which their tokens are for. */
export function mcpResource(url: URL): string {
  return new URL('/mcp', url).toString();
}

export type Auth = ReturnType<typeof createAuth>;

/** Whether a session began in the last day, as adding a way to sign in needs. */
export function signedInRecently(session: { createdAt: Date | string }): boolean {
  return Date.now() - new Date(session.createdAt).getTime() < 24 * 60 * 60 * 1000;
}

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

/**
 * Creates the account a join ticket is for, with a password instead of a
 * passkey. As with a passkey, the account comes before the invite is used up,
 * and both commit together.
 */
export async function joinWithPassword(auth: Auth, pool: Pool, sql: Sql, ticketId: string, password: string): Promise<Ticket> {
  const context = await auth.$context;
  const ticket = await findTicket(context.internalAdapter, ticketId);
  if (!ticket) throw expired();
  const { minPasswordLength, maxPasswordLength } = auth.options.emailAndPassword;
  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    throw APIError.from('BAD_REQUEST', {
      code: 'PASSWORD_LENGTH',
      message: `Use a password of at least ${minPasswordLength} characters.`,
    });
  }
  const hash = await context.password.hash(password);

  const client = await pool.connect();
  try {
    await client.query('begin');
    if ((await client.query('select from "user" where id = $1', [ticket.person])).rowCount) throw expired();
    try {
      await client.query(
        `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1, $2, $3, $4, now(), now())`,
        [ticket.person, ticket.name, ticket.email, ticket.emailVerified],
      );
    } catch (error) {
      if (code(error) === '23505') throw taken();
      throw error;
    }
    await client.query(
      `insert into account ("accountId", "providerId", "userId", password, "createdAt", "updatedAt") values ($1, 'credential', $2, $3, now(), now())`,
      [ticket.person, ticket.person, hash],
    );
    try {
      await acceptInvite(sql, ticket);
    } catch (error) {
      if (code(error) === '42501') throw expired();
      throw error;
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  await context.internalAdapter.deleteVerificationByIdentifier(ticketKey(ticketId));
  return ticket;
}

/** A database error's code, wherever the driver put it. */
function code(error: unknown): string | undefined {
  const { code, cause } = (error ?? {}) as { code?: string; cause?: { code?: string } };
  return code ?? cause?.code;
}

/**
 * The Better Auth endpoints Homing's pages and assistants use. The server
 * answers only these, so an upgrade can't quietly add a way into an account.
 */
export const authEndpoints = new Set([
  'POST /api/auth/sign-in/email',
  'POST /api/auth/sign-out',
  'GET /api/auth/passkey/generate-authenticate-options',
  'POST /api/auth/passkey/verify-authentication',
  'GET /api/auth/passkey/generate-register-options',
  'POST /api/auth/passkey/verify-registration',
  'POST /api/auth/passkey/delete-passkey',
  'POST /api/auth/change-password',
  // Recovery and verifying an email address.
  'POST /api/auth/sign-in/magic-link',
  'GET /api/auth/magic-link/verify',
  'POST /api/auth/send-verification-email',
  'GET /api/auth/verify-email',
  // Assistants find out how to connect, sign the person in and get tokens.
  'GET /.well-known/oauth-protected-resource/mcp',
  'GET /.well-known/oauth-protected-resource',
  'GET /.well-known/oauth-authorization-server/api/auth',
  'GET /api/auth/.well-known/oauth-authorization-server',
  'GET /api/auth/.well-known/openid-configuration',
  'GET /api/auth/jwks',
  'GET /api/auth/oauth2/authorize',
  'POST /api/auth/oauth2/public-client-prelogin',
  'GET /api/auth/oauth2/public-client',
  'POST /api/auth/oauth2/consent',
  'POST /api/auth/oauth2/token',
  'POST /api/auth/oauth2/revoke',
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
