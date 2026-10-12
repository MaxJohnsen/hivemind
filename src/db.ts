import postgres from 'postgres';

export type Sql = postgres.Sql;

/** Who a request or routine acts for. Every transaction runs as exactly one. */
export type Principal = { person: string } | { space: string };

/** A transaction running as a principal. */
export interface Session {
  tx: postgres.TransactionSql;
  principal: Principal;
}

/** The restricted role Hivemind uses for everything except migrations. */
export const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://hivemind_app:hivemind_app@localhost:5442/hivemind';

/** The admin role, used only to run migrations. */
export const adminUrl =
  process.env.DATABASE_ADMIN_URL ?? 'postgres://hivemind:hivemind@localhost:5442/hivemind';

export function connect(url = databaseUrl): Sql {
  return postgres(url, { transform: postgres.camel, onnotice: () => {} });
}

/**
 * Runs fn in a transaction as the principal. Row-level security in
 * PostgreSQL reads the same principal, so it applies even where Hivemind's
 * own checks are missing.
 */
export async function withPrincipal<T>(
  sql: Sql,
  principal: Principal,
  fn: (session: Session) => Promise<T>,
): Promise<T> {
  const person = 'person' in principal ? principal.person : '';
  const space = 'space' in principal ? principal.space : '';
  return (await sql.begin(async (tx) => {
    await tx`
      select set_config('hivemind.person_id', ${person}, true),
             set_config('hivemind.space_id', ${space}, true)
    `;
    return fn({ tx, principal });
  })) as T;
}

/** Hivemind refused an operation the principal isn't allowed to perform. */
export class AccessDenied extends Error {
  override name = 'AccessDenied';
}

export function personOf(principal: Principal): string | undefined {
  return 'person' in principal ? principal.person : undefined;
}
