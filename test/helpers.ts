import { after } from 'node:test';
import { adminUrl, connect, databaseUrl, withPrincipal, type Principal, type Session } from '../src/db.ts';
import { createPerson } from '../src/spaces.ts';
import { inTestDatabase } from './reset.ts';

/** Hivemind's connection, as the restricted role. */
export const db = connect(inTestDatabase(databaseUrl));

/** The admin role, for changes Hivemind has no operation for yet. */
export const admin = connect(inTestDatabase(adminUrl));

after(() => Promise.all([db.end(), admin.end()]));

export function as<T>(principal: Principal, fn: (s: Session) => Promise<T>): Promise<T> {
  return withPrincipal(db, principal, fn);
}

/** Creates a person. Each test makes its own, so tests can't see each other's data. */
export async function person(name: string) {
  const created = await createPerson(db, name);
  return { ...created, principal: { person: created.id } };
}

export const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id).sort();
