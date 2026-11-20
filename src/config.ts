import { existsSync } from 'node:fs';

const int = (v: string | undefined, d: number): number => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

/** Build the configuration from an env-like object. Pure, so tests can call it. */
export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: Record<string, string | undefined> = process.env) {
  const secret = env.APP_SECRET || '';
  if (secret.length < 32) {
    throw new Error('APP_SECRET is missing or too short (32 characters minimum). Generate one with: openssl rand -hex 32');
  }
  const baseUrl = (env.BASE_URL || `http://localhost:${int(env.PORT, 3000)}`).replace(/\/+$/, '');
  return {
    port: int(env.PORT, 3000),
    baseUrl,
    secureCookies: baseUrl.startsWith('https://'),
    appSecret: secret,
    dataDir: env.DATA_DIR || './data',
    // Folder holding a company's theme.css, brand.json, logo and favicon; empty for the default brand.
    brandDir: env.BRAND_DIR || '',
    // Closed by default: beyond the first account, people join through an administrator's invitation.
    allowSignup: env.ALLOW_SIGNUP === 'true',
    invitationDays: int(env.INVITATION_DAYS, 7),
    syncIntervalMinutes: int(env.SYNC_INTERVAL_MINUTES, 10),
    syncDays: int(env.SYNC_DAYS, 7),
    syncMaxEmails: int(env.SYNC_MAX_EMAILS, 50),
    retentionDays: int(env.RETENTION_DAYS, 30),
    openrouter: {
      apiKey: env.OPENROUTER_API_KEY || '',
      model: env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4.5',
      baseUrl: (env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
    },
    microsoft: {
      clientId: env.MICROSOFT_CLIENT_ID || '',
      clientSecret: env.MICROSOFT_CLIENT_SECRET || '',
      tenant: env.MICROSOFT_TENANT || 'common',
    },
  };
}

export function loadDotEnv(path = '.env') {
  if (existsSync(path)) process.loadEnvFile(path);
}
