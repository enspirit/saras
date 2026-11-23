// An embedded PostgreSQL (PGlite), running inside this process.
import { PGlite } from '@electric-sql/pglite';
import type { Db } from '../db.ts';
import { inTransaction, queries } from './executor.ts';
import type { Executor } from './executor.ts';

const executor = (runner: Pick<PGlite, 'query'>): Executor => ({
  execute: async (sql, params) => {
    const result = await runner.query(sql, params);
    return { rows: result.rows, affected: result.affectedRows ?? 0 };
  },
});

/** Its files are kept in the directory given; in memory when there is none. */
export function embeddedDb(directory: string | null): Db {
  const lite = new PGlite(directory ?? undefined);
  return {
    ...queries(executor(lite)),
    transaction: (fn) => lite.transaction((tx) => fn(inTransaction(executor(tx)))),
    close: () => lite.close(),
  };
}
