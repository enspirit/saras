// The migrations, in the order they are applied: one file each under migrations/, named after
// its id. A new one is added at the end; one that was released is never edited again, since
// the databases that have it will not run it twice.
//
// Several versions of the server may run on one database while an upgrade is under way: a
// migration leaves the version before it working. What it stops using is removed by a later
// one, once no server of that version is left.
import { baseline } from './migrations/0001-baseline.ts';

export interface Migration {
  /** Its number and its name, as its file: 0002-what-it-does. */
  id: string;
  /** SQL statements, separated by semicolons, run one by one. */
  sql: string;
}

export const MIGRATIONS: Migration[] = [baseline];
