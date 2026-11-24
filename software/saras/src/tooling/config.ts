import { existsSync } from 'node:fs';

const int = (v: string | undefined, d: number): number => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

/** Build the configuration from an env-like object. Pure, so tests can call it. */
export type Config = ReturnType<typeof loadConfig>;

type Env = Record<string, string | undefined>;

/** Where this server is reached, and where it keeps its data. */
function hosting(env: Env) {
  const baseUrl = (env.BASE_URL || `http://localhost:${int(env.PORT, 3000)}`).replace(/\/+$/, '');
  return {
    port: int(env.PORT, 3000),
    baseUrl,
    secureCookies: baseUrl.startsWith('https://'),
    dataDir: env.DATA_DIR || './data',
    // A PostgreSQL server. Empty: an embedded PostgreSQL keeps its files in dataDir.
    databaseUrl: env.DATABASE_URL || '',
    // Folder holding a company's theme.css, brand.json, logo and favicon; empty for the default brand.
    brandDir: env.BRAND_DIR || '',
  };
}

/** Who may join, and what a new organisation starts with. */
const joining = (env: Env) => ({
  // Closed by default: beyond the first account, people join through an administrator's invitation.
  allowSignup: env.ALLOW_SIGNUP === 'true',
  invitationDays: int(env.INVITATION_DAYS, 7),
  // A second factor (a code from an authenticator app) is asked of every member at sign-in.
  secondFactor: env.MFA_ENABLED === 'true',
  // Set plainly automated mail aside (newsletters, no-reply…), by rule.
  skipAutomated: env.TRIAGE_SKIP_AUTOMATED !== 'false',
});

/** How often and how far back mailboxes are fetched, and how long content is kept. */
const fetching = (env: Env) => ({
  syncIntervalMinutes: int(env.SYNC_INTERVAL_MINUTES, 10),
  syncDays: int(env.SYNC_DAYS, 7),
  syncMaxEmails: int(env.SYNC_MAX_EMAILS, 50),
  retentionDays: int(env.RETENTION_DAYS, 30),
});

/** The other hosts this server talks to: the LLM, and the mail hosts members sign in at. */
const otherHosts = (env: Env) => ({
  // Outgoing mail of the server itself, for lost passwords: smtp(s)://user:password@host:port, and who it writes as.
  smtpUrl: env.SMTP_URL || '',
  mailFrom: env.MAIL_FROM || '',
  openrouter: {
    apiKey: env.OPENROUTER_API_KEY || '',
    model: env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4.5',
    baseUrl: (env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
  },
  google: { clientId: env.GOOGLE_CLIENT_ID || '', clientSecret: env.GOOGLE_CLIENT_SECRET || '' },
  microsoft: { clientId: env.MICROSOFT_CLIENT_ID || '', clientSecret: env.MICROSOFT_CLIENT_SECRET || '', tenant: env.MICROSOFT_TENANT || 'common' },
});

const ROLES = ['migrate', 'web', 'clock'];

/**
 * What this process takes on, of what a server does: migrating the database, answering over
 * HTTP, and what the backend does on its own clock. All three unless ROLES says less, for
 * several processes on one database. The embedded database is opened by a single process,
 * which therefore takes them all.
 */
function roles(env: Env) {
  const named = (env.ROLES || ROLES.join(',')).split(',').map((role) => role.trim()).filter(Boolean);
  const unknown = named.filter((role) => !ROLES.includes(role));
  if (unknown.length) throw new Error(`ROLES names ${unknown.join(', ')}: a role is one of ${ROLES.join(', ')}`);
  if (!env.DATABASE_URL && named.length < ROLES.length) throw new Error('ROLES leaves a role out, which needs a PostgreSQL server (DATABASE_URL): the embedded database is opened by one process only');
  return { roles: { migrate: named.includes('migrate'), web: named.includes('web'), clock: named.includes('clock') } };
}

export function loadConfig(env: Env = process.env) {
  const appSecret = env.APP_SECRET || '';
  if (appSecret.length < 32) {
    throw new Error('APP_SECRET is missing or too short (32 characters minimum). Generate one with: openssl rand -hex 32');
  }
  return { appSecret, ...hosting(env), ...joining(env), ...fetching(env), ...otherHosts(env), ...roles(env) };
}

export function loadDotEnv(path = '.env') {
  if (existsSync(path)) process.loadEnvFile(path);
}
