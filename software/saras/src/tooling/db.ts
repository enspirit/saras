import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { embeddedDb } from './db/embedded.ts';
import { migrate } from './db/migrate.ts';
import { serverDb } from './db/server.ts';

/**
 * The database is PostgreSQL, reached in one of two ways behind the same interface:
 *
 *  - a PostgreSQL server, when DATABASE_URL is set (production, docker compose);
 *  - an embedded PostgreSQL (PGlite) running inside this process and stored in DATA_DIR,
 *    otherwise: nothing to install to try the tool, and what the tests run on.
 *
 * Both speak the same SQL, so there is a single set of migrations and a single set of queries.
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
  /**
   * Takes `key` once nobody holds it, and returns what gives it up: for what must be done by
   * one at a time, whichever of the servers on this database is asked. Held outside any
   * transaction, and given up by a server that dies.
   */
  hold(key: string): Promise<Release>;
  /** The same without waiting: null when the key is held. */
  holdIfFree(key: string): Promise<Release | null>;
  close(): Promise<void>;
}

/** Gives up a key that was held. */
export type Release = () => Promise<void>;

export interface DbOptions {
  /** URL of a PostgreSQL server. Empty for the embedded database. */
  databaseUrl?: string;
  /** Where the embedded database keeps its files. Null keeps it in memory (tests). */
  dataDir?: string | null;
}

/** The database as it stands: nothing is asked of its schema. */
export function connectDb({ databaseUrl, dataDir = null }: DbOptions = {}): Db {
  if (databaseUrl) return serverDb(databaseUrl);
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  return embeddedDb(dataDir ? join(dataDir, 'postgres') : null);
}

/** Opens the database and brings its schema to what this version expects. */
export async function openDb(options: DbOptions = {}): Promise<Db> {
  const db = connectDb(options);
  await migrate(db);
  return db;
}
