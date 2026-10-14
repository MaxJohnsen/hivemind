import type { Pool } from 'pg';
import { createAuth } from './auth.ts';
import type { Sql } from './db.ts';

/**
 * A one-time sign-in link for someone who can't sign in, for whoever runs the
 * server to pass on. It works for an hour. With it, the person signs in once
 * and adds a new passkey.
 */
export async function operatorSignInLink(
  sql: Sql,
  pool: Pool,
  settings: { url: URL; secret: string },
  email: string,
): Promise<string | undefined> {
  let link: string | undefined;
  const auth = createAuth(sql, pool, { ...settings, passwords: false, assistantSites: [], operatorLinks: (url) => void (link = url) });
  const { internalAdapter } = await auth.$context;
  if (!(await internalAdapter.findUserByEmail(email.toLowerCase()))) return undefined;
  await auth.api.signInMagicLink({ body: { email: email.toLowerCase(), callbackURL: '/account?recovered' }, headers: new Headers() });
  return link;
}
