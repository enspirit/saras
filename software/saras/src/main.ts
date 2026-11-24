import { existsSync } from 'node:fs';
import { createApp } from './tooling/http/server.ts';
import { startClock } from './tooling/clock.ts';
import type { Task } from './tooling/clock.ts';
import { loadConfig, loadDotEnv } from './tooling/config.ts';
import { createVault } from './tooling/crypto.ts';
import { connectDb } from './tooling/db.ts';
import { migrate, migrated, standing } from './tooling/db/migrate.ts';
import { errorMessage } from './tooling/errors.ts';
import { createOpenRouter } from './tooling/llm/openrouter.ts';
import { createMailService } from './tooling/mail/mail-service.ts';
import { expireSessions } from './domain/access/expire-sessions.ts';
import { createSync } from './domain/mailboxes/fetch-mailbox.ts';
import { erasePastRetention } from './domain/retention/erase-past-retention.ts';
import { createTriage } from './domain/sorting/strategies.ts';

loadDotEnv();
let config;
try {
  config = loadConfig();
} catch (e) {
  console.error(errorMessage(e));
  process.exit(1);
}
const { roles } = config;

// The browser code is compiled from web/ and is not in the repository.
if (roles.web && !existsSync(new URL('../public/js/app.js', import.meta.url))) {
  console.error('The interface has not been built yet. Run: npm run build');
  process.exit(1);
}

const db = connectDb({ databaseUrl: config.databaseUrl, dataDir: config.dataDir });
const database = config.databaseUrl ? 'PostgreSQL server' : `embedded PostgreSQL in ${config.dataDir}`;

// The database is brought to what this version expects before anything else is done on it:
// by this server, or by the one that has the role while this one waits.
if (roles.migrate) {
  const applied = await migrate(db);
  if (applied.length) console.log(`migrations applied: ${applied.join(', ')}`);
} else {
  const { pending } = await standing(db);
  if (pending.length) console.log(`waiting for a server with the role "migrate" to apply: ${pending.join(', ')}`);
  await migrated(db);
}
// Not refused: a migration leaves the version before it working, which is what lets an upgrade be taken back.
const { unknown } = await standing(db);
if (unknown.length) console.warn(`the database was migrated by a newer version of saras, which applied: ${unknown.join(', ')}`);

// Migrating was all that was asked: a job, which ends.
if (!roles.web && !roles.clock) {
  await db.close();
  process.exit(0);
}

const vault = createVault(config.appSecret);
const mail = createMailService({ db, vault, config });
const llm = createOpenRouter({ baseUrl: config.openrouter.baseUrl });
const triage = createTriage({ config, vault, llm });
const sync = createSync({ db, mail, triage, config, llm, vault });

if (roles.web) {
  createApp({ config, db, vault, mail, llm, sync }).listen(config.port, () => {
    console.log(`saras listening on ${config.baseUrl} — ${database}, OpenRouter in ZDR mode, default model ${config.openrouter.model}`);
  });
}

/** What the backend owes on its own, the ReqTrig of each operation: run by one server at a time, however many keep the clock. */
const tasks: Task[] = [
  { name: 'expire-sessions', everySeconds: 3_600, run: () => expireSessions({ db }) },
  { name: 'erase-past-retention', everySeconds: 3_600, run: () => erasePastRetention({ db, config }) },
  ...(config.syncIntervalMinutes > 0 ? [{ name: 'fetch-mailboxes', everySeconds: config.syncIntervalMinutes * 60, run: () => sync.syncAll() }] : []),
];
if (roles.clock) {
  startClock(db, tasks);
  if (!roles.web) console.log(`saras keeping the clock, and answering nothing — ${database}`);
}

// Close the database before leaving: the embedded one writes its files on the way out.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    db.close()
      .catch((e) => console.error(`closing the database failed: ${errorMessage(e)}`))
      .finally(() => process.exit(0));
  });
}
