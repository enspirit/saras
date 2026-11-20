import { existsSync } from 'node:fs';
import { createApp } from './app.ts';
import { loadConfig, loadDotEnv } from './config.ts';
import { createVault } from './crypto.ts';
import { openDb, purgeOldContent } from './db.ts';
import { errorMessage } from './errors.ts';
import { createOpenRouter } from './llm/openrouter.ts';
import { createMailService } from './mail/index.ts';
import { createSync } from './sync.ts';
import { createTriage } from './triage/index.ts';

loadDotEnv();
let config;
try {
  config = loadConfig();
} catch (e) {
  console.error(errorMessage(e));
  process.exit(1);
}

// The browser code is compiled from web/ and is not in the repository.
if (!existsSync(new URL('../public/js/app.js', import.meta.url))) {
  console.error('The interface has not been built yet. Run: npm run build');
  process.exit(1);
}

const db = await openDb({ databaseUrl: config.databaseUrl, dataDir: config.dataDir });
const vault = createVault(config.appSecret);
const mail = createMailService({ db, vault, config });
const llm = createOpenRouter({ baseUrl: config.openrouter.baseUrl });
const triage = createTriage({ config, vault, llm });
const sync = createSync({ db, mail, triage, config });

createApp({ config, db, vault, mail, llm, sync }).listen(config.port, () => {
  const database = config.databaseUrl ? 'PostgreSQL server' : `embedded PostgreSQL in ${config.dataDir}`;
  console.log(`saras listening on ${config.baseUrl} — ${database}, triage "${config.triageStrategy}", OpenRouter in ZDR mode, default model ${config.openrouter.model}`);
});

// Close the database before leaving: the embedded one writes its files on the way out.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    db.close()
      .catch((e) => console.error(`closing the database failed: ${errorMessage(e)}`))
      .finally(() => process.exit(0));
  });
}

/** Hourly: forget expired sessions and invitations, erase email content past its retention. */
const housekeeping = async (): Promise<void> => {
  try {
    await db.run(`DELETE FROM sessions WHERE expires_at <= now()`);
    await purgeOldContent(db, config.retentionDays);
  } catch (e) {
    console.error(`housekeeping failed: ${errorMessage(e)}`);
  }
};
void housekeeping();
setInterval(housekeeping, 3_600_000).unref();

if (config.syncIntervalMinutes > 0) {
  setInterval(() => void sync.syncAll(), config.syncIntervalMinutes * 60_000).unref();
}
