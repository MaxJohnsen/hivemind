// Recreates the test database and applies the migrations. Run by `npm test`.

import postgres from 'postgres';
import { adminUrl, databaseUrl } from '../src/db.ts';
import { migrate } from '../src/migrate.ts';

/** Points a database URL at the test database. */
export function inTestDatabase(url: string): string {
  const test = new URL(url);
  test.pathname = '/hivemind_test';
  return test.toString();
}

if (import.meta.main) {
  const sql = postgres(adminUrl, { onnotice: () => {} });
  await sql.unsafe('drop database if exists hivemind_test with (force)');
  await sql.unsafe('create database hivemind_test');
  await sql.end();
  await migrate(inTestDatabase(adminUrl), inTestDatabase(databaseUrl));
}
