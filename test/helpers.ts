import { after } from 'node:test';
import { adminUrl, authDatabaseUrl, connect, databaseUrl, withPrincipal, type Principal, type Session } from '../src/db.ts';
import { createPerson } from '../src/spaces.ts';
import { inTestDatabase } from './reset.ts';

/** Homing's connection, as the restricted role. */
export const db = connect(inTestDatabase(databaseUrl));

/** The admin role, which row-level security doesn't apply to. */
export const admin = connect(inTestDatabase(adminUrl));

/** Sign-in's own role, which Better Auth uses. */
export const authDb = connect(inTestDatabase(authDatabaseUrl));

after(() => Promise.all([db.end(), admin.end(), authDb.end()]));

/** Runs fn as a person or a space, the way Homing does. */
export function as<T>(principal: Principal, fn: (s: Session) => Promise<T>, sql = db): Promise<T> {
  return withPrincipal(sql, principal, fn);
}

/**
 * Creates a person, who can also act as a principal. Every test creates its
 * own people, so tests never see each other's data.
 */
export async function person(name: string) {
  const { id, personalSpaceId } = await createPerson(db, name);
  return { name, id, personalSpaceId, person: id };
}

export type Person = Awaited<ReturnType<typeof person>>;

/** How PostgreSQL refuses an operation: insufficient privilege. */
export const refused = { code: '42501' };
