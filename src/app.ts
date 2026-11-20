import express from 'express';
import type { CookieOptions, ErrorRequestHandler, Express, Request, RequestHandler, Response } from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from './config.ts';
import { hashPassword, randomToken, tokenHash, verifyPassword } from './crypto.ts';
import type { Vault } from './crypto.ts';
import { seedDefaultPrompts } from './db.ts';
import type { Db } from './db.ts';
import { errorMessage } from './errors.ts';
import type { SessionUser } from './express.d.ts';
import { LlmError, PRIVACY } from './llm/openrouter.ts';
import { decodeProblem, problem, readReason } from './messages.ts';
import type { MessageCode, MessageParams, Problem } from './messages.ts';
import { buildDraftMessages } from './llm/prompts.ts';
import type { MailService } from './mail/index.ts';
import { authorizationUrl, exchangeCode, fetchIdentity, isConfigured, isOAuthKind } from './mail/oauth.ts';
import { replyRecipients, wasEdited } from './reply.ts';
import { llmSettings } from './llm/settings.ts';
import { rowToEmail } from './sync.ts';
import type { Sync } from './sync.ts';
import { isEmailAddress } from './text.ts';
import type {
  AccountKind,
  AccountRow,
  DraftRow,
  EmailRow,
  EmailStatus,
  Fetch,
  ImapCredentials,
  InvitationRow,
  Llm,
  OAuthTokens,
  PromptRow,
  ReplyMode,
  Role,
  Sender,
  ServerCredentials,
  UserRow,
} from './types.ts';

const SESSION_DAYS = 30;
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

/** A refusal with its HTTP status and a message code the interface can translate. */
class HttpError extends Error {
  status: number;
  problem: Problem;

  constructor(status: number, code: MessageCode, params: MessageParams = {}) {
    const described = problem(code, params);
    super(described.message);
    this.status = status;
    this.problem = described;
  }
}

/** A language tag as the interface sends it, or English when it does not look like one. */
const languageTag = (v: unknown): string => (typeof v === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(v) ? v : 'en');

/** A trimmed, length-capped string out of anything a client may have sent. */
const str = (v: unknown, max = 10_000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const addressList = (v: unknown): string[] => (Array.isArray(v) ? v.map((a) => str(a, 320).toLowerCase()).filter(Boolean) : []);

function readCookie(req: Request, name: string): string | null {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** An email row joined with the address of the mailbox it belongs to. */
type OwnedEmailRow = EmailRow & { account_email: string };

interface Dependencies {
  config: Config;
  db: Db;
  vault: Vault;
  mail: MailService;
  llm: Llm;
  sync: Sync;
  fetchImpl?: Fetch;
}

export function createApp({ config, db, vault, mail, llm, sync, fetchImpl = fetch }: Dependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.set({
      'content-security-policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    });
    next();
  });
  // A company's brand folder takes precedence, file by file: what it lacks falls back to the default brand.
  if (config.brandDir) app.use('/brand', express.static(resolve(config.brandDir)));
  app.use(express.static(PUBLIC_DIR));
  app.use('/api', (req, res, next) => {
    res.set('cache-control', 'no-store');
    // Cross-site forms cannot send JSON: requiring it on writes is our CSRF barrier, with SameSite=Lax.
    if (!['GET', 'HEAD'].includes(req.method) && !req.is('application/json')) {
      return next(new HttpError(415, 'request.jsonRequired'));
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  // ---- sessions ---------------------------------------------------------------------------
  const cookieOptions: CookieOptions = { httpOnly: true, sameSite: 'lax', secure: config.secureCookies, path: '/' };

  async function openSession(res: Response, userId: number): Promise<void> {
    const id = randomToken();
    await db.run(`INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`, [id, userId, SESSION_DAYS]);
    res.cookie('sid', id, { ...cookieOptions, maxAge: SESSION_DAYS * 86_400_000 });
  }

  const auth: RequestHandler = async (req, _res, next) => {
    const sid = readCookie(req, 'sid');
    const row = sid
      ? await db.one<SessionUser>(
          `SELECT u.*, s.id AS sid, s.oauth_state FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > now()`,
          [sid],
        )
      : undefined;
    if (!row) return next(new HttpError(401, 'auth.signedOut'));
    req.user = row;
    next();
  };

  const adminOnly: RequestHandler = (req, _res, next) => next(req.user.role === 'admin' ? undefined : new HttpError(403, 'auth.adminOnly'));

  // Brute-force brake on passwords and invitation tokens: ten wrong guesses per address
  // lock that address out for fifteen minutes. Successful requests do not count.
  const failures = new Map<string, { count: number; reset: number }>();
  const guarded = (handler: (req: Request, res: Response) => Promise<void>): RequestHandler => async (req, res) => {
    const ip = req.ip || '';
    const now = Date.now();
    const entry = failures.get(ip);
    if (entry && entry.reset > now && entry.count >= 10) throw new HttpError(429, 'request.tooManyAttempts');
    try {
      await handler(req, res);
    } catch (e) {
      if (e instanceof HttpError && (e.status === 401 || e.status === 404)) {
        if (!entry || entry.reset <= now) failures.set(ip, { count: 1, reset: now + 15 * 60_000 });
        else entry.count += 1;
      }
      throw e;
    }
  };

  // An empty installation always accepts its first account, which becomes its administrator.
  const isEmpty = async (): Promise<boolean> => !(await db.one('SELECT 1 FROM users LIMIT 1'));
  const publicInfo = async () => {
    const empty = await isEmpty();
    return { allowSignup: config.allowSignup || empty, firstAccount: empty };
  };

  /** Creates a user, and the default prompts with the very first one. `on` is the database or a transaction on it. */
  async function createUser(on: Db, email: string, password: unknown, role: Role, language: string): Promise<number> {
    if (!isEmailAddress(email)) throw new HttpError(400, 'auth.invalidEmail');
    if (typeof password !== 'string' || password.length < 10) throw new HttpError(400, 'auth.passwordTooShort');
    if (await on.one('SELECT 1 FROM users WHERE email = $1', [email])) throw new HttpError(409, 'auth.emailTaken');
    const created = await on.one<{ id: number }>('INSERT INTO users (email, password_hash, role, language) VALUES ($1, $2, $3, $4) RETURNING id', [
      email,
      hashPassword(password),
      role,
      language,
    ]);
    const id = created!.id;
    // The first account's language decides the language of the default prompts.
    if (!(await on.one('SELECT 1 FROM prompts LIMIT 1'))) await seedDefaultPrompts(on, id, language);
    return id;
  }

  app.get('/api/public', async (_req, res) => {
    res.json(await publicInfo());
  });

  app.post('/api/auth/signup', guarded(async (req, res) => {
    const { allowSignup, firstAccount } = await publicInfo();
    if (!allowSignup) throw new HttpError(403, 'auth.signupClosed');
    const id = await db.transaction((tx) => createUser(tx, str(req.body.email, 320).toLowerCase(), req.body.password, firstAccount ? 'admin' : 'user', languageTag(req.body.language)));
    await openSession(res, id);
    res.status(201).json({ ok: true });
  }));

  // ---- invitations ------------------------------------------------------------------------
  // The link carries a random token in the URL fragment; only its hash is stored. Saras has no
  // mailbox of its own, so the administrator passes the link on.
  const pendingInvitation = (token: unknown) =>
    db.one<InvitationRow>(`SELECT * FROM invitations WHERE token_hash = $1 AND expires_at > now()`, [tokenHash(token || '')]);

  app.post('/api/invitations/check', guarded(async (req, res) => {
    const invitation = await pendingInvitation(req.body.token);
    if (!invitation) throw new HttpError(404, 'invitation.invalid');
    res.json({ email: invitation.email });
  }));

  app.post('/api/invitations/accept', guarded(async (req, res) => {
    const invitation = await pendingInvitation(req.body.token);
    if (!invitation) throw new HttpError(404, 'invitation.invalid');
    const id = await db.transaction(async (tx) => {
      const userId = await createUser(tx, invitation.email, req.body.password, invitation.role, languageTag(req.body.language));
      await tx.run('DELETE FROM invitations WHERE id = $1', [invitation.id]);
      return userId;
    });
    await openSession(res, id);
    res.status(201).json({ ok: true });
  }));

  app.post('/api/auth/login', guarded(async (req, res) => {
    const user = await db.one<UserRow>('SELECT * FROM users WHERE email = $1', [str(req.body.email, 320).toLowerCase()]);
    if (!user || !verifyPassword(String(req.body.password || ''), user.password_hash)) {
      throw new HttpError(401, 'auth.invalidCredentials');
    }
    await openSession(res, user.id);
    res.json({ ok: true });
  }));

  app.post('/api/auth/logout', auth, async (req, res) => {
    await db.run('DELETE FROM sessions WHERE id = $1', [req.user.sid]);
    res.clearCookie('sid', cookieOptions);
    res.json({ ok: true });
  });

  // ---- profile & settings -----------------------------------------------------------------
  app.get('/api/me', auth, (req, res) => {
    const { apiKey, model } = llmSettings(req.user, { config, vault });
    res.json({
      email: req.user.email,
      role: req.user.role,
      language: req.user.language,
      signature: req.user.signature,
      model,
      defaultModel: config.openrouter.model,
      hasOwnKey: Boolean(req.user.openrouter_key_enc),
      hasKey: Boolean(apiKey),
      oauth: { google: isConfigured(config, 'google'), microsoft: isConfigured(config, 'microsoft') },
      privacy: PRIVACY,
      triage: config.triageStrategy,
      retentionDays: config.retentionDays,
    });
  });

  app.put('/api/settings', auth, async (req, res) => {
    const { model, signature, openrouterKey, language } = req.body;
    // The language of the interface, which the server needs for what it writes on the user's behalf.
    if (typeof language === 'string') await db.run('UPDATE users SET language = $1 WHERE id = $2', [languageTag(language), req.user.id]);
    if (typeof model === 'string') {
      const m = str(model, 200);
      if (m && !/^[\w.:-]+\/[\w.:-]+$/.test(m)) throw new HttpError(400, 'settings.invalidModel');
      await db.run('UPDATE users SET model = $1 WHERE id = $2', [m || null, req.user.id]);
    }
    if (typeof signature === 'string') await db.run('UPDATE users SET signature = $1 WHERE id = $2', [str(signature, 2000), req.user.id]);
    if (typeof openrouterKey === 'string') {
      const key = str(openrouterKey, 500);
      await db.run('UPDATE users SET openrouter_key_enc = $1 WHERE id = $2', [key ? vault.seal(key) : null, req.user.id]);
    }
    res.json({ ok: true });
  });

  // ---- mail accounts ----------------------------------------------------------------------
  const accountOf = async (req: Request): Promise<AccountRow> => {
    const account = await db.one<AccountRow>('SELECT * FROM accounts WHERE id = $1 AND user_id = $2', [Number(req.params.id), req.user.id]);
    if (!account) throw new HttpError(404, 'accounts.notFound');
    return account;
  };
  const backgroundSync = (account: AccountRow): void => {
    sync.syncAccount(account).catch((e) => console.error(`sync of account ${account.id} failed: ${errorMessage(e)}`));
  };

  app.get('/api/accounts', auth, async (req, res) => {
    const rows = await db.query<{ lastError: string | null }>(
        `SELECT a.id, a.kind, a.email, a.display_name AS "displayName", a.folder, a.folder_name AS "folderName",
                a.last_sync_at AS "lastSyncAt", a.last_error AS "lastError",
                (SELECT count(*)::int FROM emails e WHERE e.account_id = a.id AND e.status IN ('needs_reply','pending')) AS todo
         FROM accounts a WHERE a.user_id = $1 ORDER BY a.id`,
        [req.user.id],
    );
    res.json(rows.map((row) => ({ ...row, lastError: decodeProblem(row.lastError) })));
  });

  app.post('/api/accounts/imap', auth, async (req, res) => {
    const b = req.body;
    const email = str(b.email, 320).toLowerCase();
    /** A valid TCP port, or 0. */
    const port = (v: unknown): number => (Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) < 65536 ? Number(v) : 0);
    const server = (host: unknown, portValue: unknown, secure: unknown): ServerCredentials => ({
      host: str(host, 255),
      port: port(portValue),
      secure: Boolean(secure),
      user: str(b.username, 320) || email,
      pass: String(b.password || ''),
    });
    const cfg: ImapCredentials = { imap: server(b.imapHost, b.imapPort, b.imapSecure), smtp: server(b.smtpHost, b.smtpPort, b.smtpSecure) };
    if (!isEmailAddress(email)) throw new HttpError(400, 'auth.invalidEmail');
    if (!cfg.imap.host || !cfg.smtp.host || !cfg.imap.port || !cfg.smtp.port) throw new HttpError(400, 'accounts.serversRequired');
    if (!cfg.imap.pass) throw new HttpError(400, 'accounts.passwordRequired');
    const draft = { kind: 'imap' as const, email, display_name: str(b.displayName, 200) };
    try {
      await mail.imapProvider(draft, cfg).verify();
    } catch (e) {
      throw new HttpError(400, 'accounts.connectionFailed', { detail: errorMessage(e) });
    }
    // Nothing is fetched yet: the user first chooses the folder to watch.
    const account = await saveAccount(req.user.id, draft, cfg);
    res.status(201).json({ id: account.id });
  });

  /** Creates the account, or replaces the credentials of the same mailbox connected earlier. */
  async function saveAccount(userId: number, { kind, email, display_name }: Sender & { kind: AccountKind }, cfg: ImapCredentials | OAuthTokens): Promise<AccountRow> {
    const saved = await db.one<AccountRow>(
      `INSERT INTO accounts (user_id, kind, email, display_name, config_enc) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, kind, email) DO UPDATE SET config_enc = excluded.config_enc, display_name = excluded.display_name, last_error = NULL
       RETURNING *`,
      [userId, kind, email, display_name, vault.seal(cfg)],
    );
    return saved!;
  }

  /** The folders of the mailbox, for the user to choose the one to watch. */
  app.get('/api/accounts/:id/folders', auth, async (req, res) => {
    const account = await accountOf(req);
    try {
      res.json(await mail.providerFor(account).listFolders());
    } catch (e) {
      throw new HttpError(502, 'accounts.foldersFailed', { detail: errorMessage(e) });
    }
  });

  /** Chooses the one folder to watch. What was fetched from another folder before is kept. */
  app.put('/api/accounts/:id/folder', auth, async (req, res) => {
    const account = await accountOf(req);
    const wanted = str(req.body.folder, 1000);
    let folders;
    try {
      folders = await mail.providerFor(account).listFolders();
    } catch (e) {
      throw new HttpError(502, 'accounts.foldersFailed', { detail: errorMessage(e) });
    }
    const folder = folders.find((f) => f.id === wanted);
    if (!folder) throw new HttpError(400, 'accounts.unknownFolder');
    const updated = await db.one<AccountRow>('UPDATE accounts SET folder = $1, folder_name = $2, last_error = NULL WHERE id = $3 RETURNING *', [folder.id, folder.name, account.id]);
    backgroundSync(updated!);
    res.json({ ok: true, folder: folder.id, folderName: folder.name });
  });

  app.delete('/api/accounts/:id', auth, async (req, res) => {
    await db.run('DELETE FROM accounts WHERE id = $1', [(await accountOf(req)).id]);
    res.json({ ok: true });
  });

  app.post('/api/accounts/:id/sync', auth, async (req, res) => {
    res.json(await sync.syncAccount(await accountOf(req)));
  });

  // ---- OAuth (Google / Microsoft) ---------------------------------------------------------
  app.get('/api/oauth/:kind/start', auth, async (req, res) => {
    const { kind } = req.params;
    if (!isOAuthKind(kind) || !isConfigured(config, kind)) throw new HttpError(404, 'oauth.notConfigured');
    const state = randomToken(24);
    await db.run('UPDATE sessions SET oauth_state = $1 WHERE id = $2', [`${kind}:${state}`, req.user.sid]);
    res.redirect(authorizationUrl(config, kind, state));
  });

  app.get('/api/oauth/:kind/callback', auth, async (req, res) => {
    const { kind } = req.params;
    // The outcome travels in the URL: a message code, and its technical detail when there is one.
    const back = (code?: MessageCode, detail = '') =>
      res.redirect(`/#/accounts${code ? `?error=${encodeURIComponent(code)}&detail=${encodeURIComponent(detail)}` : ''}`);
    const expected = req.user.oauth_state;
    await db.run('UPDATE sessions SET oauth_state = NULL WHERE id = $1', [req.user.sid]);
    if (!isOAuthKind(kind) || !isConfigured(config, kind)) return back('oauth.notConfigured');
    if (req.query.error) return back('oauth.denied', str(req.query.error, 100));
    if (!expected || expected !== `${kind}:${req.query.state}`) return back('oauth.expired');
    try {
      const tokens = await exchangeCode(config, kind, String(req.query.code || ''), fetchImpl);
      if (!tokens.refreshToken) throw new Error('no refresh token received');
      const identity = await fetchIdentity(kind, tokens.accessToken, fetchImpl);
      const account = await saveAccount(req.user.id, { kind, email: identity.email, display_name: identity.name }, tokens);
      // Reconnecting a mailbox that already watches a folder resumes fetching at once.
      if (account.folder) backgroundSync(account);
      back();
    } catch (e) {
      back('oauth.failed', errorMessage(e));
    }
  });

  // ---- prompts ----------------------------------------------------------------------------
  // Prompts are shared by every user and maintained by administrators.
  const promptOf = async (req: Request, id: unknown = req.params.id): Promise<PromptRow> => {
    const prompt = Number.isInteger(Number(id)) ? await db.one<PromptRow>('SELECT * FROM prompts WHERE id = $1', [Number(id)]) : undefined;
    if (!prompt) throw new HttpError(404, 'prompts.notFound');
    return prompt;
  };
  const promptBody = (req: Request) => {
    const p = { name: str(req.body.name, 120), description: str(req.body.description, 500), systemPrompt: str(req.body.systemPrompt, 20_000) };
    if (!p.name || !p.systemPrompt) throw new HttpError(400, 'prompts.incomplete');
    return p;
  };

  app.get('/api/prompts', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
      // Users pick a prompt by name and purpose; its instructions stay with the administrators.
      return void res.json(await db.query('SELECT id, name, description FROM prompts ORDER BY id'));
    }
    res.json(
      await db.query(
        `SELECT p.id, p.name, p.description, p.system_prompt AS "systemPrompt",
                (SELECT count(*)::int FROM replies r WHERE r.prompt_id = p.id) AS used,
                (SELECT count(*)::int FROM replies r WHERE r.prompt_id = p.id AND r.was_edited) AS edited
         FROM prompts p ORDER BY p.id`,
      ),
    );
  });

  app.post('/api/prompts', auth, adminOnly, async (req, res) => {
    const p = promptBody(req);
    const created = await db.one<{ id: number }>('INSERT INTO prompts (user_id, name, description, system_prompt) VALUES ($1, $2, $3, $4) RETURNING id', [
      req.user.id,
      p.name,
      p.description,
      p.systemPrompt,
    ]);
    res.status(201).json({ id: created!.id });
  });

  app.put('/api/prompts/:id', auth, adminOnly, async (req, res) => {
    const p = promptBody(req);
    await db.run('UPDATE prompts SET name = $1, description = $2, system_prompt = $3 WHERE id = $4', [p.name, p.description, p.systemPrompt, (await promptOf(req)).id]);
    res.json({ ok: true });
  });

  app.delete('/api/prompts/:id', auth, adminOnly, async (req, res) => {
    await db.run('DELETE FROM prompts WHERE id = $1', [(await promptOf(req)).id]);
    res.json({ ok: true });
  });

  /**
   * What this user said when correcting drafts made with this prompt, most recent first.
   * Corrections are personal ("I am on first-name terms with this client"): they steer the
   * drafts of the user who made them, not those of colleagues.
   */
  const lessonsFor = async (promptId: number, userId: number): Promise<string[]> => {
    const rows = await db.query<{ change_reason: string }>(
      `SELECT r.change_reason FROM replies r JOIN emails e ON e.id = r.email_id JOIN accounts a ON a.id = e.account_id
       WHERE r.prompt_id = $1 AND a.user_id = $2 AND r.was_edited AND r.change_reason != '' ORDER BY r.id DESC LIMIT 8`,
      [promptId, userId],
    );
    return rows.map((r) => r.change_reason);
  };

  /** For administrators: every user's corrections on a prompt, the raw material to improve it. */
  app.get('/api/prompts/:id/corrections', auth, adminOnly, async (req, res) => {
    res.json(
      await db.query(
        `SELECT r.change_reason AS reason, u.email AS "user", r.sent_at AS at
         FROM replies r JOIN emails e ON e.id = r.email_id JOIN accounts a ON a.id = e.account_id JOIN users u ON u.id = a.user_id
         WHERE r.prompt_id = $1 AND r.was_edited AND r.change_reason != '' ORDER BY r.id DESC LIMIT 50`,
        [(await promptOf(req)).id],
      ),
    );
  });

  // ---- users (administrators) -------------------------------------------------------------
  app.get('/api/users', auth, adminOnly, async (_req, res) => {
    res.json(
      await db.query(
        `SELECT u.id, u.email, u.role, u.created_at AS "createdAt", (SELECT count(*)::int FROM accounts a WHERE a.user_id = u.id) AS accounts
         FROM users u ORDER BY u.id`,
      ),
    );
  });

  app.get('/api/invitations', auth, adminOnly, async (_req, res) => {
    res.json(await db.query(`SELECT id, email, role, expires_at AS "expiresAt", expires_at <= now() AS expired FROM invitations ORDER BY id DESC`));
  });

  app.post('/api/invitations', auth, adminOnly, async (req, res) => {
    const email = str(req.body.email, 320).toLowerCase();
    const role: Role = req.body.role === 'admin' ? 'admin' : 'user';
    if (!isEmailAddress(email)) throw new HttpError(400, 'auth.invalidEmail');
    if (await db.one('SELECT 1 FROM users WHERE email = $1', [email])) throw new HttpError(409, 'auth.emailTaken');
    const token = randomToken();
    // Inviting the same address again replaces the earlier link.
    const saved = await db.one<{ id: number }>(
      `INSERT INTO invitations (email, role, token_hash, created_by, expires_at) VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))
       ON CONFLICT (email) DO UPDATE SET role = excluded.role, token_hash = excluded.token_hash, created_by = excluded.created_by, expires_at = excluded.expires_at
       RETURNING id`,
      [email, role, tokenHash(token), req.user.id, config.invitationDays],
    );
    // The only time the link exists in clear: it cannot be shown again.
    res.status(201).json({ id: saved!.id, email, link: `${config.baseUrl}/#/invitation/${token}`, validDays: config.invitationDays });
  });

  app.delete('/api/invitations/:id', auth, adminOnly, async (req, res) => {
    await db.run('DELETE FROM invitations WHERE id = $1', [Number(req.params.id) || 0]);
    res.json({ ok: true });
  });

  const userOf = async (req: Request): Promise<UserRow> => {
    const target = await db.one<UserRow>('SELECT * FROM users WHERE id = $1', [Number(req.params.id) || 0]);
    if (!target) throw new HttpError(404, 'users.notFound');
    return target;
  };

  app.delete('/api/users/:id', auth, adminOnly, async (req, res) => {
    const target = await userOf(req);
    if (target.id === req.user.id) throw new HttpError(409, 'users.cannotDeleteSelf');
    await db.transaction(async (tx) => {
      // Shared prompts outlive their author.
      await tx.run('UPDATE prompts SET user_id = $1 WHERE user_id = $2', [req.user.id, target.id]);
      await tx.run('DELETE FROM users WHERE id = $1', [target.id]);
    });
    res.json({ ok: true });
  });

  app.put('/api/users/:id', auth, adminOnly, async (req, res) => {
    const target = await userOf(req);
    if (!['admin', 'user'].includes(req.body.role)) throw new HttpError(400, 'users.invalidRole');
    const admins = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`);
    if (target.role === 'admin' && req.body.role === 'user' && admins!.n === 1) {
      throw new HttpError(409, 'users.lastAdmin');
    }
    await db.run('UPDATE users SET role = $1 WHERE id = $2', [req.body.role, target.id]);
    res.json({ ok: true });
  });

  // ---- emails -----------------------------------------------------------------------------
  /** The boxes of the interface, and the statuses each one shows. */
  const BOXES: Record<string, EmailStatus[]> = { todo: ['needs_reply', 'pending'], none: ['no_reply'], sent: ['sent'], ignored: ['ignored'] };

  const emailOf = async (req: Request): Promise<OwnedEmailRow> => {
    const row = await db.one<OwnedEmailRow>(
      `SELECT e.*, a.email AS account_email FROM emails e JOIN accounts a ON a.id = e.account_id WHERE e.id = $1 AND a.user_id = $2`,
      [Number(req.params.id) || 0, req.user.id],
    );
    if (!row) throw new HttpError(404, 'emails.notFound');
    return row;
  };

  app.get('/api/emails', auth, async (req, res) => {
    const statuses = BOXES[String(req.query.box)] || BOXES.todo!;
    const rows = await db.query(
      `SELECT e.id, e.from_name AS "fromName", e.from_addr AS "fromAddr", e.subject, e.date, e.status, e.priority,
              e.triage_source AS "triageSource", substr(e.body_text, 1, 160) AS snippet, a.email AS account,
              (SELECT r.mode FROM replies r WHERE r.email_id = e.id ORDER BY r.id DESC LIMIT 1) AS "replyMode"
       FROM emails e JOIN accounts a ON a.id = e.account_id
       WHERE a.user_id = $1 AND e.status = ANY($2)
       ORDER BY e.date DESC LIMIT 200`,
      [req.user.id, statuses],
    );
    const counts = Object.fromEntries(Object.keys(BOXES).map((box) => [box, 0]));
    const perStatus = await db.query<{ status: EmailStatus; n: number }>(
      `SELECT e.status, count(*)::int AS n FROM emails e JOIN accounts a ON a.id = e.account_id WHERE a.user_id = $1 GROUP BY e.status`,
      [req.user.id],
    );
    for (const { status, n } of perStatus) {
      for (const [box, list] of Object.entries(BOXES)) if (list.includes(status)) counts[box] = (counts[box] || 0) + n;
    }
    res.json({ emails: rows, counts });
  });

  app.get('/api/emails/:id', auth, async (req, res) => {
    const row = await emailOf(req);
    const email = rowToEmail(row);
    const draft = await db.one(
      'SELECT id, prompt_id AS "promptId", model, instructions, ai_text AS "aiText" FROM drafts WHERE email_id = $1 ORDER BY id DESC LIMIT 1',
      [row.id],
    );
    const reply = await db.one<{ finalText: string; wasEdited: boolean; changeReason: string; mode: ReplyMode; toJson: string; ccJson: string; sentAt: Date }>(
      `SELECT final_text AS "finalText", was_edited AS "wasEdited", change_reason AS "changeReason", mode, to_json AS "toJson", cc_json AS "ccJson", sent_at AS "sentAt"
       FROM replies WHERE email_id = $1 ORDER BY id DESC LIMIT 1`,
      [row.id],
    );
    const reason = readReason(email.triageReason);
    res.json({
      ...email,
      triageReason: reason.text,
      triageReasonCode: reason.code,
      account: row.account_email,
      recipients: replyRecipients(email, row.account_email, false),
      recipientsAll: replyRecipients(email, row.account_email, true),
      draft: draft || null,
      reply: reply ? { ...reply, to: JSON.parse(reply.toJson), cc: JSON.parse(reply.ccJson) } : null,
    });
  });

  app.post('/api/emails/:id/status', auth, async (req, res) => {
    const row = await emailOf(req);
    const status = req.body.status;
    if (!['needs_reply', 'no_reply', 'ignored'].includes(status)) throw new HttpError(400, 'emails.invalidStatus');
    if (row.status === 'sent') throw new HttpError(409, 'emails.alreadySent');
    await db.run(`UPDATE emails SET status = $1, triage_source = 'user' WHERE id = $2`, [status, row.id]);
    res.json({ ok: true });
  });

  app.post('/api/emails/:id/draft', auth, async (req, res) => {
    const row = await emailOf(req);
    if (!row.body_text) throw new HttpError(410, 'emails.contentErased');
    const prompt = await promptOf(req, req.body.promptId);
    const instructions = str(req.body.instructions, 4000);
    const { apiKey, model } = llmSettings(req.user, { config, vault });
    const messages = buildDraftMessages({
      email: rowToEmail(row),
      prompt: { systemPrompt: prompt.system_prompt },
      ownAddress: row.account_email,
      signature: req.user.signature,
      instructions,
      lessons: await lessonsFor(prompt.id, req.user.id),
    });
    const answer = await llm.chat({ apiKey, model, messages });
    const created = await db.one<{ id: number }>('INSERT INTO drafts (email_id, prompt_id, model, instructions, ai_text) VALUES ($1, $2, $3, $4, $5) RETURNING id', [
      row.id,
      prompt.id,
      answer.model,
      instructions,
      answer.text,
    ]);
    res.status(201).json({ id: created!.id, promptId: prompt.id, model: answer.model, provider: answer.provider, aiText: answer.text });
  });

  /** Emails with a delivery in flight, so that a double click cannot send twice. */
  const sending = new Set<number>();

  /**
   * Hand the reply over to the mailbox, either sent ('sent') or left in its drafts ('draft').
   * Both record what the AI proposed, what the user made of it, and why.
   */
  const deliver = (mode: ReplyMode): RequestHandler => async (req, res) => {
    const row = await emailOf(req);
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const to = addressList(req.body.to);
    const cc = addressList(req.body.cc);
    if (!text) throw new HttpError(400, 'reply.empty');
    if (!to.length) throw new HttpError(400, 'reply.noRecipient');
    const bad = [...to, ...cc].find((a) => !isEmailAddress(a));
    if (bad) throw new HttpError(400, 'reply.invalidAddress', { address: bad });
    if (row.status === 'sent' || sending.has(row.id)) throw new HttpError(409, 'emails.alreadyHandled');
    // Claimed before the first await that follows, so that a second request cannot slip in between.
    sending.add(row.id);
    try {
      const draft = Number(req.body.draftId) ? await db.one<DraftRow>('SELECT * FROM drafts WHERE id = $1 AND email_id = $2', [Number(req.body.draftId), row.id]) : undefined;
      const account = await db.one<AccountRow>('SELECT * FROM accounts WHERE id = $1', [row.account_id]);
      const provider = mail.providerFor(account!);
      const reply = { email: rowToEmail(row), to, cc, text, language: req.user.language };
      try {
        await (mode === 'draft' ? provider.saveDraft(reply) : provider.send(reply));
      } catch (e) {
        throw new HttpError(502, mode === 'draft' ? 'reply.draftFailed' : 'reply.sendFailed', { detail: errorMessage(e) });
      }
      const edited = draft ? wasEdited(draft.ai_text, text) : false;
      await db.transaction(async (tx) => {
        await tx.run(
          `INSERT INTO replies (email_id, prompt_id, ai_text, final_text, was_edited, change_reason, mode, to_json, cc_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [row.id, draft?.prompt_id ?? null, draft?.ai_text ?? null, text, edited, edited ? str(req.body.changeReason, 1000) : '', mode, JSON.stringify(to), JSON.stringify(cc)],
        );
        await tx.run(`UPDATE emails SET status = 'sent' WHERE id = $1`, [row.id]);
      });
      res.json({ ok: true, wasEdited: edited });
    } finally {
      sending.delete(row.id);
    }
  };

  app.post('/api/emails/:id/send', auth, deliver('sent'));
  app.post('/api/emails/:id/save-draft', auth, deliver('draft'));

  // ---- errors -----------------------------------------------------------------------------
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'request.unknownRoute')));
  const onError: ErrorRequestHandler = (err: Error & { status?: number; statusCode?: number }, req, res, next) => {
    if (res.headersSent) return next(err);
    const known = err instanceof HttpError || err instanceof LlmError;
    const status = err instanceof LlmError ? 502 : err.status || err.statusCode || 500;
    // Only the message is logged, never request bodies: they contain mail content.
    if (!known && status >= 500) console.error(`${req.method} ${req.path}: ${err.message}`);
    // Malformed requests refused by the framework (4xx) keep its own message, without a code.
    const described = known ? err.problem : status >= 500 ? problem('error.internal') : null;
    res.status(status).json(described ? { error: described.message, code: described.code, params: described.params } : { error: err.message });
  };
  app.use(onError);

  return app;
}
