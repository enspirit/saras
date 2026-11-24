import { existsSync } from 'node:fs';
import { createApp } from './tooling/http/server.ts';
import { startClock } from './tooling/clock.ts';
import type { Task } from './tooling/clock.ts';
import { loadConfig, loadDotEnv } from './tooling/config.ts';
import { createVault } from './tooling/crypto.ts';
import { connectDb } from './tooling/db.ts';
import { migrate, migrated, standing } from './tooling/db/migrate.ts';
import { errorMessage } from './tooling/errors.ts';
import { log, startLogging } from './tooling/log.ts';
import { createOpenRouter } from './tooling/llm/openrouter.ts';
import { createMailService } from './tooling/mail/mail-service.ts';
import { expireSessions } from './domain/access/expire-sessions.ts';
import { createSync } from './domain/mailboxes/fetch-mailbox.ts';
import { erasePastRetention } from './domain/retention/erase-past-retention.ts';

loadDotEnv();
startLogging();
// What nothing caught stops the server: said as a line of the log, like everything else it says.
process.on('uncaughtException', (e, origin) => {
  log.error('the server stops on an error that nothing caught', { origin, error: errorMessage(e), stack: e.stack });
  process.exit(1);
});
let config;
try {
  config = loadConfig();
} catch (e) {
  log.error('the configuration is refused', { error: errorMessage(e) });
  process.exit(1);
}
const { roles } = config;
startLogging(config.logLevel);

// The browser code is compiled from web/ and is not in the repository.
if (roles.web && !existsSync(new URL('../public/js/app.js', import.meta.url))) {
  log.error('The interface has not been built yet. Run: npm run build');
  process.exit(1);
}

const db = connectDb({ databaseUrl: config.databaseUrl, dataDir: config.dataDir });
const database = config.databaseUrl ? 'PostgreSQL server' : `embedded PostgreSQL in ${config.dataDir}`;

// The database is brought to what this version expects before anything else is done on it:
// by this server, or by the one that has the role while this one waits.
if (roles.migrate) {
  const applied = await migrate(db);
  if (applied.length) log.info('migrations applied', { applied });
} else {
  const { pending } = await standing(db);
  if (pending.length) log.info('waiting for a server with the role "migrate" to apply migrations', { pending });
  await migrated(db);
}
// Not refused: a migration leaves the version before it working, which is what lets an upgrade be taken back.
const { unknown } = await standing(db);
if (unknown.length) log.warn('the database was migrated by a newer version of saras', { unknown });

// Migrating was all that was asked: a job, which ends.
if (!roles.web && !roles.clock) {
  await db.close();
  process.exit(0);
}

const vault = createVault(config.appSecret);
const mail = createMailService({ db, vault, config });
const llm = createOpenRouter({ baseUrl: config.openrouter.baseUrl });
const sync = createSync({ db, mail, config, llm, vault });
/** What a server says of itself when it starts. */
const running = { database, roles: Object.keys(roles).filter((role) => roles[role as keyof typeof roles]), logLevel: config.logLevel, node: process.version };

if (roles.web) {
  createApp({ config, db, vault, mail, llm, sync }).listen(config.port, () => {
    log.info('saras listening', { ...running, port: config.port, baseUrl: config.baseUrl, llm: 'OpenRouter in ZDR mode', model: config.openrouter.model });
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
  if (!roles.web) log.info('saras keeping the clock, and answering nothing', running);
}

// Close the database before leaving: the embedded one writes its files on the way out.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    db.close()
      .catch((e) => log.error('closing the database failed', { error: errorMessage(e) }))
      .finally(() => process.exit(0));
  });
}
