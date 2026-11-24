// The clock: what the backend does on its own is done by one server at a time, however many
// keep the clock on one database, and a server that starts again does not start the count again.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startClock, takesTurn, tick } from '../../src/tooling/clock.ts';
import type { Task } from '../../src/tooling/clock.ts';
import type { Db } from '../../src/tooling/db.ts';
import { startLogging } from '../../src/tooling/log.ts';
import { testDatabase } from '../support/database.ts';

let db: Db;
let drop: () => Promise<void>;
before(async () => ({ db, drop } = await testDatabase()));
after(() => drop());

const hourly = (name: string, run: () => Promise<unknown> = async () => {}): Task => ({ name, everySeconds: 3_600, run });
const secondsToNext = async (name: string): Promise<number> =>
  (await db.one<{ s: number }>('SELECT round(extract(epoch FROM next_run_at - now()))::int AS s FROM scheduled_tasks WHERE name = $1', [name]))?.s ?? NaN;
const moment = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

test('a task never seen is due at once, and then not before its time', async () => {
  assert.equal(await takesTurn(db, hourly('never-seen')), true);
  assert.equal(await takesTurn(db, hourly('never-seen')), false);
  assert.equal(await secondsToNext('never-seen'), 3_600);
});

test('of the servers that look at the same time, one takes the turn', async () => {
  const took = await Promise.all([1, 2, 3, 4, 5].map(() => takesTurn(db, hourly('looked-at-by-five'))));
  assert.deepEqual(took.filter(Boolean), [true]);
});

test('the next turn follows from the one that was due, not from when it was taken', async () => {
  await takesTurn(db, hourly('taken-late'));
  await db.run(`UPDATE scheduled_tasks SET next_run_at = now() - interval '40 seconds' WHERE name = 'taken-late'`);
  assert.equal(await takesTurn(db, hourly('taken-late')), true);
  assert.equal(await secondsToNext('taken-late'), 3_560);
});

test('after a long absence the turns missed are not caught up', async () => {
  await takesTurn(db, hourly('long-away'));
  await db.run(`UPDATE scheduled_tasks SET next_run_at = now() - interval '5 hours' WHERE name = 'long-away'`);
  assert.equal(await takesTurn(db, hourly('long-away')), true);
  assert.equal(await takesTurn(db, hourly('long-away')), false);
  assert.equal(await secondsToNext('long-away'), 3_600);
});

test('a task that fails is told, waits for its next turn, and keeps none of the others from running', async () => {
  const told: { level: string; msg: string; task: string; error: string }[] = [];
  startLogging('warn', (line) => told.push(JSON.parse(line)));
  const ran: string[] = [];
  const failing = hourly('failing', async () => Promise.reject(new Error('the mail host is away')));
  await tick(db, [failing, hourly('after-it', async () => ran.push('after-it'))]);
  assert.deepEqual(ran, ['after-it']);
  assert.deepEqual(told.map(({ level, msg, task, error }) => ({ level, msg, task, error })), [{ level: 'error', msg: 'task failed', task: 'failing', error: 'the mail host is away' }]);
  assert.equal(await takesTurn(db, failing), false);
});

test('a server that starts again does not start the count again', async () => {
  let runs = 0;
  const task = hourly('across-restarts', async () => runs++);
  for (const _server of ['first', 'started again']) {
    const stop = startClock(db, [task], 5);
    await moment(60);
    stop();
  }
  assert.equal(runs, 1);
});
