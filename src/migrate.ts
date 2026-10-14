import { readdir, readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { adminUrl, databaseUrl } from './db.ts';

const directory = new URL('../migrations/', import.meta.url);

/**
 * Applies new migrations as the admin role, then lets the restricted role
 * log in with the password from the app's database URL.
 */
export async function migrate(admin = adminUrl, app = databaseUrl): Promise<void> {
  const { username, password } = new URL(app);
  if (username !== 'homing_app') {
    throw new Error('DATABASE_URL must connect as homing_app');
  }

  const sql = postgres(admin, { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('homing.migrate'))`;
      await tx`
        create table if not exists schema_migrations (
          name text primary key,
          applied_at timestamptz not null default now()
        )
      `;
      const applied = new Set((await tx`select name from schema_migrations`).map((row) => row.name));
      const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
      for (const file of files.filter((file) => !applied.has(file))) {
        await tx.unsafe(await readFile(new URL(file, directory), 'utf8'));
        await tx`insert into schema_migrations (name) values (${file})`;
      }
      const [{ statement }] = await tx`
        select format('alter role homing_app with login password %L', ${decodeURIComponent(password)}::text) as statement
      `;
      await tx.unsafe(statement);
    });
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  await migrate();
}
