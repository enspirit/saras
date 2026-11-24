// The server's own clock: what it does on its own, each task every so often. When a task is
// next due is kept in the database (scheduled_tasks), and taking its turn is one statement:
// of all the servers on one database a single one runs it, and a server that starts again
// does not start the count again.
import type { Db } from './db.ts';
import { errorMessage } from './errors.ts';
import { about, log } from './log.ts';

export interface Task {
  name: string;
  everySeconds: number;
  run: () => Promise<unknown>;
}

// The next turn follows from the one that was due, not from when it was taken: no drift.
// After a long absence it follows from now: the turns missed are not caught up. A task
// never seen is due at once.
const TAKE_TURN = `
  INSERT INTO scheduled_tasks (name, next_run_at) VALUES ($1, now() + make_interval(secs => $2))
  ON CONFLICT (name) DO UPDATE
    SET next_run_at = CASE WHEN scheduled_tasks.next_run_at + make_interval(secs => $2) > now()
                           THEN scheduled_tasks.next_run_at + make_interval(secs => $2)
                           ELSE now() + make_interval(secs => $2) END
    WHERE scheduled_tasks.next_run_at <= now()
  RETURNING name`;

/** Whether the task is due and this server is the one to run it. */
export const takesTurn = async (db: Db, task: Task): Promise<boolean> => (await db.query(TAKE_TURN, [task.name, task.everySeconds])).length > 0;

/** Runs the task if its turn is this server's, and says how long it took. */
async function inTurn(db: Db, task: Task): Promise<void> {
  if (!(await takesTurn(db, task))) return;
  const started = Date.now();
  await task.run();
  log.info('task done', { ms: Date.now() - started });
}

/** Runs each task whose turn this server took. What fails is logged, and waits for its next turn. */
export async function tick(db: Db, tasks: Task[]): Promise<void> {
  for (const task of tasks) {
    await about({ task: task.name }, () => inTurn(db, task)).catch((e) => log.error('task failed', { task: task.name, error: errorMessage(e) }));
  }
}

/** Looks at what is due now, then again and again, each look once the one before is over. Returns what stops it. */
export function startClock(db: Db, tasks: Task[], everyMs = 30_000): () => void {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  const look = async (): Promise<void> => {
    await tick(db, tasks);
    if (!stopped) timer = setTimeout(() => void look(), everyMs);
  };
  void look();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
