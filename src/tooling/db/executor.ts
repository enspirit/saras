// What the server driver and the embedded one have in common, once narrowed to our needs.
import type { Db } from '../db.ts';

export interface Executor {
  execute(sql: string, params: unknown[]): Promise<{ rows: unknown[]; affected: number }>;
}

/** The query helpers, on top of anything that can execute SQL. */
export function queries(executor: Executor): Pick<Db, 'query' | 'one' | 'run'> {
  return {
    query: async <T>(sql: string, params: unknown[] = []) => (await executor.execute(sql, params)).rows as T[],
    one: async <T>(sql: string, params: unknown[] = []) => (await executor.execute(sql, params)).rows[0] as T | undefined,
    run: async (sql, params = []) => (await executor.execute(sql, params)).affected,
  };
}

/** Inside a transaction, a nested one simply joins it. */
export const inTransaction = (executor: Executor): Db => {
  const tx: Db = { ...queries(executor), transaction: (fn) => fn(tx), close: async () => {} };
  return tx;
};
