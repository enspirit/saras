// A PostgreSQL server, reached through a pool of connections.
import pg from 'pg';
import type { Db, Release } from '../db.ts';
import { inTransaction, queries } from './executor.ts';
import type { Executor, Holds } from './executor.ts';

const executor = (client: pg.Pool | pg.PoolClient): Executor => ({
  execute: async (sql, params) => {
    const result = await client.query(sql, params);
    return { rows: result.rows, affected: result.rowCount ?? 0 };
  },
});

/** Runs `fn` on one connection, between BEGIN and COMMIT; rolled back when it throws. */
async function transaction<T>(pool: pg.Pool, holds: Holds, fn: (tx: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(inTransaction(executor(client), holds));
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// A key is an advisory lock of the session: the server gives it up by itself when the
// connection that took it goes, so a server that dies holds nothing. Per schema: the test
// files, each in a schema of its own on one server, do not hold each other's keys.
const LOCK_ID = `hashtext(current_schema() || ':' || $1)`;
const TAKE = `SELECT pg_advisory_lock(${LOCK_ID})`;
const TAKE_IF_FREE = `SELECT pg_try_advisory_lock(${LOCK_ID}) AS held`;
const GIVE_UP = `SELECT pg_advisory_unlock(${LOCK_ID})`;

/** Gives the key up and the connection back; a connection that cannot say so is closed, which gives the key up too. */
const releasing = (client: pg.PoolClient, key: string): Release => async () => {
  try {
    await client.query(GIVE_UP, [key]);
    client.release();
  } catch (e) {
    client.release(e as Error);
  }
};

/** A key is held by a connection, for as long as it is held: one of a pool of their own, so that those who wait never keep the queries from running. */
async function hold(connections: pg.Pool, key: string, wait: boolean): Promise<Release | null> {
  const client = await connections.connect();
  try {
    const held = wait ? (await client.query(TAKE, [key])).rows.length > 0 : Boolean((await client.query(TAKE_IF_FREE, [key])).rows[0]?.held);
    if (held) return releasing(client, key);
    client.release();
    return null;
  } catch (e) {
    client.release(e as Error);
    throw e;
  }
}

export function serverDb(url: string): Db {
  const pool = new pg.Pool({ connectionString: url });
  const connections = new pg.Pool({ connectionString: url, max: 5 });
  const holds: Holds = {
    hold: async (key) => (await hold(connections, key, true)) as Release,
    holdIfFree: (key) => hold(connections, key, false),
  };
  const close = async (): Promise<void> => void (await Promise.all([pool.end(), connections.end()]));
  return { ...queries(executor(pool)), ...holds, transaction: (fn) => transaction(pool, holds, fn), close };
}
