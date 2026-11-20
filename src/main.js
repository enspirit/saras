import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from './app.js';
import { loadConfig, loadDotEnv } from './config.js';
import { createVault } from './crypto.js';
import { openDb, purgeOldContent } from './db.js';
import { createOpenRouter } from './llm/openrouter.js';
import { createMailService } from './mail/index.js';
import { createSync } from './sync.js';

loadDotEnv();
let config;
try {
  config = loadConfig();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

mkdirSync(config.dataDir, { recursive: true });
const dbPath = join(config.dataDir, 'saras.sqlite');
// The database was named after the product's former name: carry an existing one over.
const formerPath = join(config.dataDir, 'mailia.sqlite');
if (!existsSync(dbPath) && existsSync(formerPath)) {
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(formerPath + suffix)) renameSync(formerPath + suffix, dbPath + suffix);
  }
  console.log(`database renamed from ${formerPath} to ${dbPath}`);
}
const db = openDb(dbPath);
const vault = createVault(config.appSecret);
const mail = createMailService({ db, vault, config });
const llm = createOpenRouter({ baseUrl: config.openrouter.baseUrl });
const sync = createSync({ db, mail, llm, config, vault });

createApp({ config, db, vault, mail, llm, sync }).listen(config.port, () => {
  console.log(`saras listening on ${config.baseUrl} — OpenRouter in ZDR mode, default model ${config.openrouter.model}`);
});

const housekeeping = () => {
  db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();
  purgeOldContent(db, config.retentionDays);
};
housekeeping();
setInterval(housekeeping, 3_600_000).unref();

if (config.syncIntervalMinutes > 0) {
  setInterval(() => sync.syncAll(), config.syncIntervalMinutes * 60_000).unref();
}
