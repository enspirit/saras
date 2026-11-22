// A PostgreSQL server, reached through a pool of connections.
import pg from 'pg';
import type { Db } from '../db.ts';
import { inTransaction, queries } from './executor.ts';
import type { Executor } from './executor.ts';

const executor = (client: pg.Pool | pg.PoolClient): Executor => ({
  execute: async (sql, params) => {
    const result = await client.query(sql, params);
    return { rows: result.rows, affected: result.rowCount ?? 0 };
  },
});

/** Runs `fn` on one connection, between BEGIN and COMMIT; rolled back when it throws. */
async function transaction<T>(pool: pg.Pool, fn: (tx: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(inTransaction(executor(client)));
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export function serverDb(url: string): Db {
  const pool = new pg.Pool({ connectionString: url });
  return { ...queries(executor(pool)), transaction: (fn) => transaction(pool, fn), close: () => pool.end() };
}
