import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { embeddedDb } from './db/embedded.ts';
import { SCHEMA } from './db/schema.ts';
import { serverDb } from './db/server.ts';

/**
 * The database is PostgreSQL, reached in one of two ways behind the same interface:
 *
 *  - a PostgreSQL server, when DATABASE_URL is set (production, docker compose);
 *  - an embedded PostgreSQL (PGlite) running inside this process and stored in DATA_DIR,
 *    otherwise: nothing to install to try the tool, and what the tests run on.
 *
 * Both speak the same SQL, so there is a single schema and a single set of queries.
 */
export interface Db {
  /** Rows of a query. Parameters are positional: $1, $2… */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** The first row of a query, if any. */
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  /** Runs a statement and returns the number of rows it affected. */
  run(sql: string, params?: unknown[]): Promise<number>;
  /** Runs `fn` in a transaction: committed when it resolves, rolled back when it throws. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface DbOptions {
  /** URL of a PostgreSQL server. Empty for the embedded database. */
  databaseUrl?: string;
  /** Where the embedded database keeps its files. Null keeps it in memory (tests). */
  dataDir?: string | null;
}

function connect({ databaseUrl, dataDir = null }: DbOptions): Db {
  if (databaseUrl) return serverDb(databaseUrl);
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  return embeddedDb(dataDir ? join(dataDir, 'postgres') : null);
}

/** Opens the database and makes sure its schema exists. */
export async function openDb(options: DbOptions = {}): Promise<Db> {
  const db = connect(options);
  // One statement per call: the server driver does not take several with parameters, and
  // a failure then names the statement at fault.
  for (const statement of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await db.run(statement);
  return db;
}
