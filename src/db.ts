import { PGlite } from '@electric-sql/pglite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { DEFAULT_PROMPTS } from './default-prompts.ts';

/**
 * The database is PostgreSQL, reached in one of two ways behind the same interface:
 *
 *  - a PostgreSQL server, when DATABASE_URL is set (production, docker compose);
 *  - an embedded PostgreSQL (PGlite) running inside this process and stored in DATA_DIR,
 *    otherwise: nothing to install to try the tool, and what the tests run on.
 *
 * Both speak the same SQL, so there is a single schema and a single set of queries.
 */
export interface Db {
  /** Rows of a query. Parameters are positional: $1, $2… */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** The first row of a query, if any. */
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  /** Runs a statement and returns the number of rows it affected. */
  run(sql: string, params?: unknown[]): Promise<number>;
  /** Runs `fn` in a transaction: committed when it resolves, rolled back when it throws. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  model TEXT,
  signature TEXT NOT NULL DEFAULT '',
  openrouter_key_enc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oauth_state TEXT,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS invitations (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  token_hash TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('imap','google','microsoft')),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  config_enc TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, email)
);
CREATE TABLE IF NOT EXISTS prompts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS emails (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  message_id TEXT,
  thread_id TEXT,
  refs TEXT NOT NULL DEFAULT '',
  from_name TEXT NOT NULL DEFAULT '',
  from_addr TEXT NOT NULL DEFAULT '',
  reply_to TEXT NOT NULL DEFAULT '',
  to_json TEXT NOT NULL DEFAULT '[]',
  cc_json TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL DEFAULT '',
  date TIMESTAMPTZ NOT NULL,
  body_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending','needs_reply','no_reply','ignored','sent')),
  triage_source TEXT,
  triage_reason TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  suggested_prompt_id INTEGER REFERENCES prompts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, provider_id)
);
CREATE INDEX IF NOT EXISTS emails_status ON emails (account_id, status, date);
CREATE TABLE IF NOT EXISTS drafts (
  id SERIAL PRIMARY KEY,
  email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  prompt_id INTEGER REFERENCES prompts(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  ai_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS replies (
  id SERIAL PRIMARY KEY,
  email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  prompt_id INTEGER REFERENCES prompts(id) ON DELETE SET NULL,
  ai_text TEXT,
  final_text TEXT NOT NULL,
  was_edited BOOLEAN NOT NULL DEFAULT false,
  change_reason TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'sent' CHECK (mode IN ('sent','draft')),
  to_json TEXT NOT NULL DEFAULT '[]',
  cc_json TEXT NOT NULL DEFAULT '[]',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/** What the server driver and the embedded one have in common, once narrowed to our needs. */
interface Executor {
  execute(sql: string, params: unknown[]): Promise<{ rows: unknown[]; affected: number }>;
}

/** The query helpers, on top of anything that can execute SQL. */
function queries(executor: Executor): Pick<Db, 'query' | 'one' | 'run'> {
  return {
    query: async <T>(sql: string, params: unknown[] = []) => (await executor.execute(sql, params)).rows as T[],
    one: async <T>(sql: string, params: unknown[] = []) => (await executor.execute(sql, params)).rows[0] as T | undefined,
    run: async (sql, params = []) => (await executor.execute(sql, params)).affected,
  };
}

/** Inside a transaction, a nested one simply joins it. */
const inTransaction = (executor: Executor): Db => {
  const tx: Db = { ...queries(executor), transaction: (fn) => fn(tx), close: async () => {} };
  return tx;
};

function serverDb(url: string): Db {
  const pool = new pg.Pool({ connectionString: url });
  const executor = (client: pg.Pool | pg.PoolClient): Executor => ({
    execute: async (sql, params) => {
      const result = await client.query(sql, params);
      return { rows: result.rows, affected: result.rowCount ?? 0 };
    },
  });
  return {
    ...queries(executor(pool)),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(inTransaction(executor(client)));
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

function embeddedDb(directory: string | null): Db {
  const lite = new PGlite(directory ?? undefined);
  type Runner = Pick<PGlite, 'query'>;
  const executor = (runner: Runner): Executor => ({
    execute: async (sql, params) => {
      const result = await runner.query(sql, params);
      return { rows: result.rows, affected: result.affectedRows ?? 0 };
    },
  });
  return {
    ...queries(executor(lite)),
    transaction: (fn) => lite.transaction((tx) => fn(inTransaction(executor(tx)))),
    close: () => lite.close(),
  };
}

export interface DbOptions {
  /** URL of a PostgreSQL server. Empty for the embedded database. */
  databaseUrl?: string;
  /** Where the embedded database keeps its files. Null keeps it in memory (tests). */
  dataDir?: string | null;
}

/** Opens the database and makes sure its schema exists. */
export async function openDb({ databaseUrl, dataDir = null }: DbOptions = {}): Promise<Db> {
  let db: Db;
  if (databaseUrl) db = serverDb(databaseUrl);
  else {
    if (dataDir) mkdirSync(dataDir, { recursive: true });
    db = embeddedDb(dataDir ? join(dataDir, 'postgres') : null);
  }
  // One statement per call: the server driver does not take several with parameters, and
  // a failure then names the statement at fault.
  for (const statement of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await db.run(statement);
  return db;
}

/** Prompts are shared by all users; prompts.user_id records who created them. */
export async function seedDefaultPrompts(db: Db, userId: number): Promise<void> {
  for (const p of DEFAULT_PROMPTS) {
    await db.run('INSERT INTO prompts (user_id, name, description, system_prompt) VALUES ($1, $2, $3, $4)', [userId, p.name, p.description, p.systemPrompt]);
  }
}

/**
 * Drop the content of old emails (bodies, drafts, reply texts) while keeping the
 * triage row, so they are not imported again. Correction reasons are kept: they
 * are the user's own words and feed future drafts.
 */
export async function purgeOldContent(db: Db, retentionDays: number): Promise<number> {
  if (!retentionDays) return 0;
  const old = `(SELECT id FROM emails WHERE date < now() - make_interval(days => $1))`;
  const days = [Number(retentionDays)];
  await db.run(`DELETE FROM drafts WHERE email_id IN ${old}`, days);
  await db.run(`UPDATE replies SET ai_text = NULL, final_text = '' WHERE email_id IN ${old}`, days);
  return db.run(`UPDATE emails SET body_text = '' WHERE body_text != '' AND date < now() - make_interval(days => $1)`, days);
}
