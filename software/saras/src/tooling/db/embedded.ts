// An embedded PostgreSQL (PGlite), running inside this process.
import { PGlite } from '@electric-sql/pglite';
import type { Db, Release } from '../db.ts';
import { inTransaction, queries } from './executor.ts';
import type { Executor, Holds } from './executor.ts';

const executor = (runner: Pick<PGlite, 'query'>): Executor => ({
  execute: async (sql, params) => {
    const result = await runner.query(sql, params);
    return { rows: result.rows, affected: result.affectedRows ?? 0 };
  },
});

/** This process is the only one on the database: who holds a key is kept in its memory. */
function holdsInMemory(): Holds {
  /** Key -> settled once the last who asked for it has given it up. */
  const held = new Map<string, Promise<void>>();
  const take = async (key: string): Promise<Release> => {
    const before = held.get(key);
    let giveUp = (): void => {};
    const mine = new Promise<void>((resolve) => (giveUp = resolve));
    const last = (before ?? Promise.resolve()).then(() => mine);
    held.set(key, last);
    await before;
    return async () => {
      giveUp();
      if (held.get(key) === last) held.delete(key);
    };
  };
  return { hold: take, holdIfFree: async (key) => (held.has(key) ? null : take(key)) };
}

/** Its files are kept in the directory given; in memory when there is none. */
export function embeddedDb(directory: string | null): Db {
  const lite = new PGlite(directory ?? undefined);
  const holds = holdsInMemory();
  return {
    ...queries(executor(lite)),
    ...holds,
    transaction: (fn) => lite.transaction((tx) => fn(inTransaction(executor(tx), holds))),
    close: () => lite.close(),
  };
}
