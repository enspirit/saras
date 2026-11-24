// The database of a test run: by default the embedded PostgreSQL, in memory. With
// TEST_DATABASE_URL set, a PostgreSQL server instead, where each stack gets a schema of its
// own so that test files running side by side do not see each other's rows.
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { connectDb, openDb } from '../../src/tooling/db.ts';
import type { Db, DbOptions } from '../../src/tooling/db.ts';

interface TestDatabase {
  db: Db;
  /** The same database as a second server reaches it: connections of its own on a PostgreSQL server; the embedded one is opened once. */
  another: () => Db;
  drop: () => Promise<void>;
}

/** How the database is opened: migrated, as a server finds it once started, unless a test says otherwise. */
type Open = (options: DbOptions) => Db | Promise<Db>;

async function inMemory(open: Open): Promise<TestDatabase> {
  const db = await open({});
  return { db, another: () => db, drop: () => db.close() };
}

/** The same server, seen through a schema of its own. */
function scopedTo(url: string, schema: string): string {
  const scoped = new URL(url);
  scoped.searchParams.set('options', `-c search_path=${schema}`);
  return scoped.toString();
}

async function inItsOwnSchema(url: string, open: Open): Promise<TestDatabase> {
  const schema = `test_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const databaseUrl = scopedTo(url, schema);
  const opened = [await open({ databaseUrl })];
  const drop = async (): Promise<void> => {
    await Promise.all(opened.map((db) => db.close()));
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  };
  return { db: opened[0] as Db, another: () => opened[opened.push(connectDb({ databaseUrl })) - 1] as Db, drop };
}

export const testDatabase = (open: Open = openDb): Promise<TestDatabase> =>
  process.env.TEST_DATABASE_URL ? inItsOwnSchema(process.env.TEST_DATABASE_URL, open) : inMemory(open);
