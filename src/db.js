import Database from 'better-sqlite3';
import { DEFAULT_PROMPTS } from './default-prompts.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  model TEXT,
  signature TEXT NOT NULL DEFAULT '',
  openrouter_key_enc TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oauth_state TEXT,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('imap','google','microsoft')),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  config_enc TEXT NOT NULL,
  last_sync_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, kind, email)
);
CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY,
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
  date TEXT NOT NULL,
  body_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending','needs_reply','no_reply','ignored','sent')),
  triage_source TEXT,
  triage_reason TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  suggested_prompt_id INTEGER REFERENCES prompts(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, provider_id)
);
CREATE INDEX IF NOT EXISTS emails_status ON emails (account_id, status, date);
CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY,
  email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  prompt_id INTEGER REFERENCES prompts(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  ai_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS replies (
  id INTEGER PRIMARY KEY,
  email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  prompt_id INTEGER REFERENCES prompts(id) ON DELETE SET NULL,
  ai_text TEXT,
  final_text TEXT NOT NULL,
  was_edited INTEGER NOT NULL DEFAULT 0,
  change_reason TEXT NOT NULL DEFAULT '',
  to_json TEXT NOT NULL DEFAULT '[]',
  cc_json TEXT NOT NULL DEFAULT '[]',
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function openDb(path) {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export function seedDefaultPrompts(db, userId) {
  const insert = db.prepare('INSERT INTO prompts (user_id, name, description, system_prompt) VALUES (?, ?, ?, ?)');
  for (const p of DEFAULT_PROMPTS) insert.run(userId, p.name, p.description, p.systemPrompt);
}

/**
 * Drop the content of old emails (bodies, drafts, reply texts) while keeping the
 * triage row, so they are not imported again. Correction reasons are kept: they
 * are the user's own words and feed future drafts.
 */
export function purgeOldContent(db, retentionDays) {
  if (!retentionDays) return 0;
  const cutoff = `-${Number(retentionDays)} days`;
  const old = `(SELECT id FROM emails WHERE date < datetime('now', ?))`;
  db.prepare(`DELETE FROM drafts WHERE email_id IN ${old}`).run(cutoff);
  db.prepare(`UPDATE replies SET ai_text = NULL, final_text = '' WHERE email_id IN ${old}`).run(cutoff);
  return db.prepare(`UPDATE emails SET body_text = '' WHERE body_text != '' AND date < datetime('now', ?)`).run(cutoff).changes;
}
