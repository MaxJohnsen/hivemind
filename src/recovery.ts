import { createHash, randomBytes } from 'node:crypto';
import { createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import * as z from 'zod';
import type { Auth } from './auth.ts';

const linkKey = (token: string) => `homing-sign-in:${createHash('sha256').update(token).digest('base64url')}`;

/**
 * Sign-in links from whoever runs the server, for someone who can't sign in.
 * Unlike an emailed link, one says nothing about who owns the address, so it
 * only signs in, once, and changes nothing else about the account.
 */
export function operatorLinks() {
  return {
    id: 'homing-operator-links',
    endpoints: {
      signInWithOperatorLink: createAuthEndpoint(
        '/sign-in/operator-link',
        { method: 'GET', query: z.object({ token: z.string() }) },
        async (ctx) => {
          const stored = await ctx.context.internalAdapter.consumeVerificationValue(linkKey(ctx.query.token));
          const user = stored && new Date(stored.expiresAt) > new Date() ? await ctx.context.internalAdapter.findUserById(stored.value) : null;
          if (!user) throw ctx.redirect('/recover?expired');
          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          throw ctx.redirect('/account?recovered');
        },
      ),
    },
  };
}

/** A one-time sign-in link for the account with this email, working for 15 minutes, if there is one. */
export async function operatorSignInLink(auth: Auth, url: URL, email: string): Promise<string | undefined> {
  const { internalAdapter } = await auth.$context;
  const found = await internalAdapter.findUserByEmail(email.trim().toLowerCase());
  if (!found) return undefined;
  const token = randomBytes(32).toString('base64url');
  await internalAdapter.createVerificationValue({
    identifier: linkKey(token),
    value: found.user.id,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  return new URL(`/api/auth/sign-in/operator-link?token=${token}`, url).toString();
}
