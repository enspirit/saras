// Migrating: bringing a database from where it stands to what this version of the server
// expects. Each migration is applied once, all of it or nothing, and written in a ledger
// (schema_migrations). Any number of servers may start at once on one database: a migration is
// applied under a lock by the first to get there, and the others find it done.
import type { Db } from '../db.ts';
import { errorMessage } from '../errors.ts';
import { MIGRATIONS } from './migrations.ts';
import type { Migration } from './migrations.ts';

const LEDGER = `CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
// Held until the transaction ends. Per schema: the test files, each in a schema of its own on
// one server, do not wait for each other.
const LOCK = `SELECT pg_advisory_xact_lock(hashtext('saras.migrations.' || current_schema()))`;

/** Where a database stands: what this version would still apply, and what was applied that it does not know. */
export interface Standing {
  pending: string[];
  /** Not empty on a database last migrated by a newer version. */
  unknown: string[];
}

const statementsOf = (sql: string): string[] => sql.split(';').map((s) => s.trim()).filter(Boolean);

async function applied(db: Db): Promise<string[]> {
  const found = await db.one<{ ledger: string | null }>(`SELECT to_regclass('schema_migrations')::text AS ledger`);
  if (!found?.ledger) return [];
  return (await db.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id')).map((row) => row.id);
}

export async function standing(db: Db, migrations: Migration[] = MIGRATIONS): Promise<Standing> {
  const done = await applied(db);
  const known = migrations.map((migration) => migration.id);
  return { pending: known.filter((id) => !done.includes(id)), unknown: done.filter((id) => !known.includes(id)) };
}

/** One statement, a failure naming the migration and the statement at fault. */
const run = (tx: Db, migration: Migration, statement: string): Promise<number> =>
  tx.run(statement).catch((e) => {
    throw new Error(`migration ${migration.id} failed at "${statement.slice(0, 80)}": ${errorMessage(e)}`, { cause: e });
  });

/** Applies a migration unless it already was, and says whether it was applied here. */
const apply = (db: Db, migration: Migration): Promise<boolean> =>
  db.transaction(async (tx) => {
    await tx.query(LOCK);
    await tx.run(LEDGER);
    if (await tx.one('SELECT 1 FROM schema_migrations WHERE id = $1', [migration.id])) return false;
    for (const statement of statementsOf(migration.sql)) await run(tx, migration, statement);
    await tx.run('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
    return true;
  });

/** Applies what is pending, in order, and returns what was applied here. A database that is up to date is only read. */
export async function migrate(db: Db, migrations: Migration[] = MIGRATIONS): Promise<string[]> {
  const { pending } = await standing(db, migrations);
  const here: string[] = [];
  for (const migration of migrations.filter((m) => pending.includes(m.id))) {
    if (await apply(db, migration)) here.push(migration.id);
  }
  return here;
}
