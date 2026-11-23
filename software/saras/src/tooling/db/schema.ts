// The schema, as SQL statements run one by one each time the database is opened.
// The statements after the tables bring a database created by an earlier version up to date:
// a mailbox fetched before folders existed keeps watching its inbox, the identity of an email
// includes its folder (IMAP numbers messages per folder), and what existed before
// organisations did is gathered into a single one.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  triage_strategy TEXT NOT NULL DEFAULT 'none',
  skip_automated BOOLEAN NOT NULL DEFAULT true,
  automation TEXT NOT NULL DEFAULT 'none',
  openrouter_key_enc TEXT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  language TEXT NOT NULL DEFAULT 'en',
  name TEXT NOT NULL DEFAULT '',
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
  org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  token_hash TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared BOOLEAN NOT NULL DEFAULT false,
  kind TEXT NOT NULL CHECK (kind IN ('imap','google','microsoft')),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  config_enc TEXT NOT NULL,
  folder TEXT,
  folder_name TEXT NOT NULL DEFAULT '',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS prompts (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS emails (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  folder TEXT NOT NULL DEFAULT 'INBOX',
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
  attachments_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('pending','needs_reply','no_reply','ignored','sent')),
  triage_source TEXT,
  triage_reason TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  suggested_prompt_id INTEGER REFERENCES prompts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS emails_status ON emails (account_id, status, date);
CREATE TABLE IF NOT EXISTS drafts (
  id SERIAL PRIMARY KEY,
  email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  action TEXT,
  prompt_id INTEGER REFERENCES prompts(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  ai_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS replies (
  id SERIAL PRIMARY KEY,
  email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  prompt_id INTEGER REFERENCES prompts(id) ON DELETE SET NULL,
  ai_text TEXT,
  final_text TEXT NOT NULL,
  final_html TEXT NOT NULL DEFAULT '',
  was_edited BOOLEAN NOT NULL DEFAULT false,
  change_reason TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'sent' CHECK (mode IN ('sent','draft')),
  to_json TEXT NOT NULL DEFAULT '[]',
  cc_json TEXT NOT NULL DEFAULT '[]',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS automation TEXT NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes_json TEXT NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS sign_ins_in_progress (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret_enc TEXT,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS boards (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  filter_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS attributes (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'choice',
  values_json TEXT NOT NULL DEFAULT '[]',
  decided_by TEXT NOT NULL DEFAULT 'nobody',
  elo TEXT NOT NULL DEFAULT ''
);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS attributes_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE emails ADD COLUMN IF NOT EXISTS headers_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS folder TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS folder_name TEXT NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS fetch_days INTEGER;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS unread_only BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS folder TEXT NOT NULL DEFAULT 'INBOX';
ALTER TABLE emails ADD COLUMN IF NOT EXISTS attachments_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_account_id_provider_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS emails_identity ON emails (account_id, folder, provider_id);
UPDATE accounts SET folder = CASE kind WHEN 'microsoft' THEN 'inbox' ELSE 'INBOX' END, folder_name = 'Inbox' WHERE folder IS NULL AND last_sync_at IS NOT NULL;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS final_html TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
INSERT INTO organizations (name) SELECT 'Organisation' WHERE EXISTS (SELECT 1 FROM users WHERE org_id IS NULL) AND NOT EXISTS (SELECT 1 FROM organizations);
UPDATE users SET org_id = (SELECT min(id) FROM organizations) WHERE org_id IS NULL;
UPDATE invitations SET org_id = (SELECT min(id) FROM organizations) WHERE org_id IS NULL;
UPDATE prompts SET org_id = (SELECT min(id) FROM organizations) WHERE org_id IS NULL;
UPDATE accounts a SET org_id = (SELECT u.org_id FROM users u WHERE u.id = a.user_id) WHERE a.org_id IS NULL;
UPDATE replies r SET user_id = (SELECT a.user_id FROM emails e JOIN accounts a ON a.id = e.account_id WHERE e.id = r.email_id) WHERE r.user_id IS NULL;
ALTER TABLE users ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE invitations ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE prompts ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_kind_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_identity ON accounts (org_id, kind, email);
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS invitations_identity ON invitations (org_id, email);
`;
