// When each thing the server does on its own is next due (src/tooling/clock.ts): kept here
// rather than in a server's memory, so that several servers take turns and a restart does
// not start the count again.
import type { Migration } from '../migrations.ts';

const sql = `
CREATE TABLE scheduled_tasks (
  name TEXT PRIMARY KEY,
  next_run_at TIMESTAMPTZ NOT NULL
);
`;

export const scheduledTasks: Migration = { id: '0002-scheduled-tasks', sql };
