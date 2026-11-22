import express from 'express';
import type { CookieOptions, ErrorRequestHandler, Express, Request, RequestHandler, Response } from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from '../config.ts';
import { randomToken } from '../crypto.ts';
import type { Vault } from '../crypto.ts';
import { defaultPrompts } from '../../domain/prompts/ready-made-prompts.ts';
import type { Db } from '../db.ts';
import { acceptInvitation } from '../../domain/access/accept-invitation.ts';
import { appointAdministrator } from '../../domain/access/appoint-administrator.ts';
import { checkInvitation } from '../../domain/access/check-invitation.ts';
import { createOrganization } from '../../domain/access/create-organization.ts';
import { deleteMember } from '../../domain/access/delete-member.ts';
import { inviteMember } from '../../domain/access/invite-member.ts';
import { removeAdministratorRole } from '../../domain/access/remove-administrator-role.ts';
import { revokeInvitation } from '../../domain/access/revoke-invitation.ts';
import { signIn } from '../../domain/access/sign-in.ts';
import { signOut } from '../../domain/access/sign-out.ts';
import { signUpIsOpen } from '../../domain/computations/access.ts';
import { addressesGiven as addressList, clipped as str, languageGiven as languageTag } from '../../domain/computations/given.ts';
import { proposalHtml } from '../../domain/computations/replying.ts';
import { installationIsEmpty, memberOf, organizationById } from '../../domain/state/members.ts';
import { memberOfSession } from '../../domain/state/sessions.ts';
import type { Session } from '../../domain/state/sessions.ts';
import { Refusal } from '../../domain/refusal.ts';
import type { RefusalKind } from '../../domain/refusal.ts';
import { createPrompt } from '../../domain/prompts/create-prompt.ts';
import { deletePrompt } from '../../domain/prompts/delete-prompt.ts';
import { editPrompt } from '../../domain/prompts/edit-prompt.ts';
import { checkTypos } from '../../domain/replying/check-typos.ts';
import { fileReplyAsDraft } from '../../domain/replying/file-reply-as-draft.ts';
import { improveStyle } from '../../domain/replying/improve-style.ts';
import { sendReply } from '../../domain/replying/send-reply.ts';
import { ignoreEmail } from '../../domain/sorting/ignore-email.ts';
import { markNoReplyNeeded } from '../../domain/sorting/mark-no-reply-needed.ts';
import { moveBackToHandle } from '../../domain/sorting/move-back-to-handle.ts';
import { writeWithPrompt } from '../../domain/replying/write-with-prompt.ts';
import { emailFor } from '../../domain/state/emails.ts';
import type { OwnedEmailRow } from '../../domain/state/emails.ts';
import { mayUse } from '../../domain/state/mailboxes.ts';
import { promptOf as organizationPrompt } from '../../domain/state/prompts.ts';
import { createWorld } from '../../domain/world.ts';
import type { Actor, World } from '../../domain/world.ts';
import { errorMessage } from '../errors.ts';
import { LlmError, PRIVACY } from '../llm/openrouter.ts';
import { decodeProblem, problem, readReason } from '../messages.ts';
import type { MessageCode, MessageParams, Problem } from '../messages.ts';
import type { MailService } from '../mail/index.ts';
import { lookupMailHost } from '../mail/lookup.ts';
import { authorizationUrl, exchangeCode, fetchIdentity, isConfigured, isOAuthKind } from '../mail/oauth.ts';
import { replyRecipients } from '../../domain/computations/reply.ts';
import { llmSettings } from '../../domain/computations/key-in-force.ts';
import { rowToEmail } from '../../domain/mailboxes/fetch-mailbox.ts';
import type { Sync } from '../../domain/mailboxes/fetch-mailbox.ts';
import { isTriageStrategy } from '../../domain/sorting/index.ts';
import { isEmailAddress } from '../text.ts';
import { AUTOMATIONS } from '../../types.ts';
import type {
  AccountKind,
  AccountRow,
  DraftRow,
  EmailStatus,
  Fetch,
  ImapCredentials,
  Llm,
  OAuthTokens,
  PromptRow,
  ReplyMode,
  Sender,
  ServerCredentials,
} from '../../types.ts';

const PUBLIC_DIR = fileURLToPath(new URL('../../../public', import.meta.url));

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

function readCookie(req: Request, name: string): string | null {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}


interface Dependencies {
  config: Config;
  db: Db;
  vault: Vault;
  mail: MailService;
  llm: Llm;
  sync: Sync;
  fetchImpl?: Fetch;
}

/** The status that says each kind of refusal. */
const STATUS: Record<RefusalKind, number> = { invalid: 400, unauthenticated: 401, forbidden: 403, notFound: 404, conflict: 409, gone: 410, tooMany: 429, upstream: 502 };

export function createApp({ config, db, vault, mail, llm, sync, fetchImpl = fetch }: Dependencies): Express {
  /** What the operations of the domain act in, and on whose behalf. */
  const world: World = createWorld({ db, mail, llm, vault, config });
  const actorOf = (req: Request): Actor => ({ member: req.user, organization: req.org });
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

  /** Has the browser keep a session just opened. */
  const startSession = (res: Response, session: Session): void => void res.cookie('sid', session.id, { ...cookieOptions, maxAge: session.days * 86_400_000 });

  const auth: RequestHandler = async (req, _res, next) => {
    const sid = readCookie(req, 'sid');
    const row = sid ? await memberOfSession(db, sid) : undefined;
    if (!row) return next(new HttpError(401, 'auth.signedOut'));
    req.user = row;
    req.org = await organizationById(db, row.org_id);
    next();
  };

  const adminOnly: RequestHandler = (req, _res, next) => next(req.user.role === 'admin' ? undefined : new HttpError(403, 'auth.adminOnly'));

  // Signing up creates an organisation, which the new account administers. Whether strangers
  // may do so is the operator's choice; an empty installation always accepts its first account.
  const publicInfo = async () => {
    const empty = await installationIsEmpty(db);
    // How long content is kept is public: the sign-in screen says so.
    return { allowSignup: signUpIsOpen(config.allowSignup, empty), firstAccount: empty, retentionDays: config.retentionDays };
  };

  app.get('/api/public', async (_req, res) => {
    res.json(await publicInfo());
  });

  // ---- access ----------------------------------------------------------------------------
  // The operations are in domain/access. Those a visitor may attempt are braked against
  // guessing, per origin: the address the request comes from.
  const originOf = (req: Request): string => req.ip || '';

  app.post('/api/auth/signup', async (req, res) => {
    startSession(res, await createOrganization(world, originOf(req), req.body));
    res.status(201).json({ ok: true });
  });

  app.post('/api/invitations/check', async (req, res) => {
    res.json(await checkInvitation(world, originOf(req), req.body.token));
  });

  app.post('/api/invitations/accept', async (req, res) => {
    startSession(res, await acceptInvitation(world, originOf(req), req.body));
    res.status(201).json({ ok: true });
  });

  app.post('/api/auth/login', async (req, res) => {
    startSession(res, await signIn(world, originOf(req), req.body));
    res.json({ ok: true });
  });

  app.post('/api/auth/logout', auth, async (req, res) => {
    await signOut(world, req.user.sid);
    res.clearCookie('sid', cookieOptions);
    res.json({ ok: true });
  });

  // ---- profile & settings -----------------------------------------------------------------
  app.get('/api/me', auth, (req, res) => {
    const { apiKey, model } = llmSettings(req.user, req.org, { config, vault });
    const admin = req.user.role === 'admin';
    res.json({
      email: req.user.email,
      name: req.user.name,
      organization: {
        name: req.org.name,
        triage: req.org.triage_strategy,
        skipAutomated: req.org.skip_automated,
        automation: req.org.automation,
        // What follows is the administrators' business.
        model: admin ? req.org.model || '' : undefined,
        hasKey: admin ? Boolean(req.org.openrouter_key_enc) : undefined,
      },
      role: req.user.role,
      language: req.user.language,
      signature: req.user.signature,
      model,
      defaultModel: req.org.model || config.openrouter.model,
      hasOwnKey: Boolean(req.user.openrouter_key_enc),
      hasKey: Boolean(apiKey),
      oauth: { google: isConfigured(config, 'google'), microsoft: isConfigured(config, 'microsoft') },
      privacy: PRIVACY,
      retentionDays: config.retentionDays,
    });
  });

  app.put('/api/settings', auth, async (req, res) => {
    const { model, signature, openrouterKey, language, name } = req.body;
    if (typeof name === 'string') await db.run('UPDATE users SET name = $1 WHERE id = $2', [str(name, 120), req.user.id]);
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

  /** The organisation's own settings, for its administrators. Only the fields sent are changed. */
  app.put('/api/organization', auth, adminOnly, async (req, res) => {
    const { name, triage, skipAutomated, automation, model, openrouterKey, resort } = req.body;
    const set = (column: string, value: unknown) => db.run(`UPDATE organizations SET ${column} = $1 WHERE id = $2`, [value, req.org.id]);
    if (typeof name === 'string' && str(name, 120)) await set('name', str(name, 120));
    if (triage !== undefined) {
      if (!isTriageStrategy(triage)) throw new HttpError(400, 'organization.invalidTriage');
      await set('triage_strategy', triage);
    }
    if (typeof skipAutomated === 'boolean') await set('skip_automated', skipAutomated);
    if (automation !== undefined) {
      if (!AUTOMATIONS.includes(automation)) throw new HttpError(400, 'organization.invalidAutomation');
      await set('automation', automation);
    }
    // Asked when the way of working is chosen after a first fetch: what that fetch let through
    // unsorted goes back to waiting, so that the next fetch sorts it the new way.
    if (resort === true) {
      await db.run(
        `UPDATE emails e SET status = 'pending', triage_source = NULL, triage_reason = ''
         FROM accounts a
         WHERE a.id = e.account_id AND a.org_id = $1 AND e.status = 'needs_reply' AND e.triage_source = 'none'
           AND NOT EXISTS (SELECT 1 FROM drafts d WHERE d.email_id = e.id)`,
        [req.org.id],
      );
    }
    if (typeof model === 'string') {
      const m = str(model, 200);
      if (m && !/^[\w.:-]+\/[\w.:-]+$/.test(m)) throw new HttpError(400, 'settings.invalidModel');
      await set('model', m || null);
    }
    if (typeof openrouterKey === 'string') {
      const key = str(openrouterKey, 500);
      await set('openrouter_key_enc', key ? vault.seal(key) : null);
    }
    res.json({ ok: true });
  });

  // ---- mail accounts ----------------------------------------------------------------------
  // A mailbox is reachable by its owner and, when shared, by every member of its organisation.
  // `a` is the alias of the accounts table; $org and $user are given positions by the caller.
  const canUse = mayUse;

  const accountOf = async (req: Request): Promise<AccountRow> => {
    const account = await db.one<AccountRow>(`SELECT a.* FROM accounts a WHERE a.id = $1 AND ${canUse('$2', '$3')}`, [Number(req.params.id) || 0, req.org.id, req.user.id]);
    if (!account) throw new HttpError(404, 'accounts.notFound');
    return account;
  };

  /** Changing or disconnecting a mailbox is for its owner; for a shared one, for administrators. */
  const canManage = (req: Request, account: Pick<AccountRow, 'shared' | 'user_id'>): boolean =>
    account.shared ? req.user.role === 'admin' : account.user_id === req.user.id;

  const managedAccountOf = async (req: Request): Promise<AccountRow> => {
    const account = await accountOf(req);
    if (!canManage(req, account)) throw new HttpError(403, 'accounts.adminOnly');
    return account;
  };
  const backgroundSync = (account: AccountRow): void => {
    sync.syncAccount(account).catch((e) => console.error(`sync of account ${account.id} failed: ${errorMessage(e)}`));
  };

  app.get('/api/accounts', auth, async (req, res) => {
    const rows = await db.query<{ lastError: string | null; shared: boolean; user_id: number }>(
        `SELECT a.id, a.kind, a.email, a.display_name AS "displayName", a.shared, a.user_id, a.folder, a.folder_name AS "folderName",
                a.last_sync_at AS "lastSyncAt", a.last_error AS "lastError",
                (SELECT count(*)::int FROM emails e WHERE e.account_id = a.id AND e.status IN ('needs_reply','pending')) AS todo
         FROM accounts a WHERE ${canUse('$1', '$2')} ORDER BY a.shared DESC, a.id`,
        [req.org.id, req.user.id],
    );
    res.json(rows.map(({ user_id, ...row }) => ({ ...row, canManage: canManage(req, { shared: row.shared, user_id }), lastError: decodeProblem(row.lastError) })));
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
    const draft = { kind: 'imap' as const, email, display_name: str(b.displayName, 200), shared: wantsShared(req, b.shared) };
    try {
      await mail.imapProvider(draft, cfg).verify();
    } catch (e) {
      throw new HttpError(400, 'accounts.connectionFailed', { detail: errorMessage(e) });
    }
    // Nothing is fetched yet: the user first chooses the folder to watch.
    const account = await saveAccount(req, draft, cfg);
    res.status(201).json({ id: account.id });
  });

  /** Only administrators connect shared mailboxes; anyone else asking for one gets a personal one. */
  const wantsShared = (req: Request, asked: unknown): boolean => req.user.role === 'admin' && asked === true;

  /**
   * Connects a mailbox to the organisation, or renews the credentials of one the user manages.
   * An address is connected once per organisation: nobody takes over someone else's mailbox.
   */
  async function saveAccount(req: Request, { kind, email, display_name, shared }: Sender & { kind: AccountKind; shared: boolean }, cfg: ImapCredentials | OAuthTokens): Promise<AccountRow> {
    const existing = await db.one<AccountRow>('SELECT * FROM accounts WHERE org_id = $1 AND kind = $2 AND email = $3', [req.org.id, kind, email]);
    if (existing) {
      if (!canManage(req, existing)) throw new HttpError(409, 'accounts.alreadyConnected');
      const renewed = await db.one<AccountRow>('UPDATE accounts SET config_enc = $1, display_name = $2, last_error = NULL WHERE id = $3 RETURNING *', [
        vault.seal(cfg),
        display_name,
        existing.id,
      ]);
      return renewed!;
    }
    const created = await db.one<AccountRow>('INSERT INTO accounts (org_id, user_id, shared, kind, email, display_name, config_enc) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [
      req.org.id,
      req.user.id,
      shared,
      kind,
      email,
      display_name,
      vault.seal(cfg),
    ]);
    return created!;
  }

  /** Who hosts the mail of an address, from its domain's MX records: the connection page uses it to propose the right way in. */
  app.get('/api/mail/host', auth, async (req, res) => {
    res.json(await lookupMailHost(str(req.query.email, 320)));
  });

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
    const account = await managedAccountOf(req);
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
    await db.run('DELETE FROM accounts WHERE id = $1', [(await managedAccountOf(req)).id]);
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
    // Whether a shared mailbox was asked for is kept with the state, on our side of the round trip.
    const scope = wantsShared(req, req.query.shared === '1') ? 'shared' : 'personal';
    await db.run('UPDATE sessions SET oauth_state = $1 WHERE id = $2', [`${kind}:${state}:${scope}`, req.user.sid]);
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
    const [expectedKind, expectedState, scope] = (expected || '').split(':');
    if (!expectedState || expectedKind !== kind || expectedState !== req.query.state) return back('oauth.expired');
    try {
      const tokens = await exchangeCode(config, kind, String(req.query.code || ''), fetchImpl);
      if (!tokens.refreshToken) throw new Error('no refresh token received');
      const identity = await fetchIdentity(kind, tokens.accessToken, fetchImpl);
      const account = await saveAccount(req, { kind, email: identity.email, display_name: identity.name, shared: wantsShared(req, scope === 'shared') }, tokens);
      // Reconnecting a mailbox that already watches a folder resumes fetching at once.
      if (account.folder) backgroundSync(account);
      back();
    } catch (e) {
      if (e instanceof HttpError) return back(e.problem.code);
      back('oauth.failed', errorMessage(e));
    }
  });

  // ---- prompts ----------------------------------------------------------------------------
  // Prompts belong to the organisation: shared by its members, maintained by its administrators.
  const promptOf = (req: Request, id: unknown = req.params.id): Promise<PromptRow> => organizationPrompt(db, req.org.id, id);

  app.get('/api/prompts', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
      // Users pick a prompt by name and purpose; its instructions stay with the administrators.
      return void res.json(await db.query('SELECT id, name, description FROM prompts WHERE org_id = $1 ORDER BY id', [req.org.id]));
    }
    res.json(
      await db.query(
        `SELECT p.id, p.name, p.description, p.system_prompt AS "systemPrompt",
                (SELECT count(*)::int FROM replies r WHERE r.prompt_id = p.id) AS used,
                (SELECT count(*)::int FROM replies r WHERE r.prompt_id = p.id AND r.was_edited) AS edited
         FROM prompts p WHERE p.org_id = $1 ORDER BY p.id`,
        [req.org.id],
      ),
    );
  });

  /** Ready-made prompts the organisation does not have yet, in the administrator's language. */
  app.get('/api/prompts/templates', auth, adminOnly, async (req, res) => {
    const taken = new Set((await db.query<{ name: string }>('SELECT name FROM prompts WHERE org_id = $1', [req.org.id])).map((p) => p.name));
    res.json(defaultPrompts(req.user.language).filter((p) => !taken.has(p.name)));
  });

  // The operations are in domain/prompts; each checks for itself that an administrator asks.
  app.post('/api/prompts', auth, async (req, res) => {
    res.status(201).json(await createPrompt(world, actorOf(req), req.body));
  });

  app.put('/api/prompts/:id', auth, async (req, res) => {
    await editPrompt(world, actorOf(req), req.params.id, req.body);
    res.json({ ok: true });
  });

  app.delete('/api/prompts/:id', auth, async (req, res) => {
    await deletePrompt(world, actorOf(req), req.params.id);
    res.json({ ok: true });
  });

  /** For administrators: every user's corrections on a prompt, the raw material to improve it. */
  app.get('/api/prompts/:id/corrections', auth, adminOnly, async (req, res) => {
    res.json(
      await db.query(
        `SELECT r.change_reason AS reason, u.email AS "user", u.name AS "userName", r.sent_at AS at
         FROM replies r JOIN users u ON u.id = r.user_id
         WHERE r.prompt_id = $1 AND r.was_edited AND r.change_reason != '' ORDER BY r.id DESC LIMIT 50`,
        [(await promptOf(req)).id],
      ),
    );
  });

  // ---- users (administrators) -------------------------------------------------------------
  app.get('/api/users', auth, adminOnly, async (req, res) => {
    res.json(
      await db.query(
        `SELECT u.id, u.email, u.name, u.role, u.created_at AS "createdAt", (SELECT count(*)::int FROM accounts a WHERE a.user_id = u.id AND NOT a.shared) AS accounts
         FROM users u WHERE u.org_id = $1 ORDER BY u.id`,
        [req.org.id],
      ),
    );
  });

  app.get('/api/invitations', auth, adminOnly, async (req, res) => {
    res.json(
      await db.query(`SELECT id, email, role, expires_at AS "expiresAt", expires_at <= now() AS expired FROM invitations WHERE org_id = $1 ORDER BY id DESC`, [req.org.id]),
    );
  });

  app.post('/api/invitations', auth, async (req, res) => {
    res.status(201).json(await inviteMember(world, actorOf(req), req.body));
  });

  app.delete('/api/invitations/:id', auth, async (req, res) => {
    await revokeInvitation(world, actorOf(req), req.params.id);
    res.json({ ok: true });
  });

  app.delete('/api/users/:id', auth, async (req, res) => {
    await deleteMember(world, actorOf(req), req.params.id);
    res.json({ ok: true });
  });

  // The role asked for says which of the two operations it is.
  const ROLE_CHANGES = { admin: appointAdministrator, user: removeAdministratorRole };

  app.put('/api/users/:id', auth, adminOnly, async (req, res) => {
    const change = ROLE_CHANGES[String(req.body.role) as keyof typeof ROLE_CHANGES];
    if (!change) {
      // A member one may not see is not found, whatever else is wrong with the request.
      await memberOf(db, req.org.id, req.params.id);
      throw new HttpError(400, 'users.invalidRole');
    }
    await change(world, actorOf(req), req.params.id);
    res.json({ ok: true });
  });

  // ---- emails -----------------------------------------------------------------------------
  /** The boxes of the interface, and the statuses each one shows. */
  const BOXES: Record<string, EmailStatus[]> = { todo: ['needs_reply', 'pending'], none: ['no_reply'], sent: ['sent'], ignored: ['ignored'] };

  const emailOf = (req: Request): Promise<OwnedEmailRow> => emailFor(db, actorOf(req), req.params.id);
  app.get('/api/emails', auth, async (req, res) => {
    const statuses = BOXES[String(req.query.box)] || BOXES.todo!;
    const rows = await db.query(
      `SELECT e.id, e.from_name AS "fromName", e.from_addr AS "fromAddr", e.subject, e.date, e.status, e.priority,
              e.triage_source AS "triageSource", substr(e.body_text, 1, 160) AS snippet, a.email AS account, a.shared,
              (SELECT r.mode FROM replies r WHERE r.email_id = e.id ORDER BY r.id DESC LIMIT 1) AS "replyMode"
       FROM emails e JOIN accounts a ON a.id = e.account_id
       WHERE ${canUse('$1', '$2')} AND e.status = ANY($3)
       ORDER BY e.date DESC LIMIT 200`,
      [req.org.id, req.user.id, statuses],
    );
    const counts = Object.fromEntries(Object.keys(BOXES).map((box) => [box, 0]));
    const perStatus = await db.query<{ status: EmailStatus; n: number }>(
      `SELECT e.status, count(*)::int AS n FROM emails e JOIN accounts a ON a.id = e.account_id WHERE ${canUse('$1', '$2')} GROUP BY e.status`,
      [req.org.id, req.user.id],
    );
    for (const { status, n } of perStatus) {
      for (const [box, list] of Object.entries(BOXES)) if (list.includes(status)) counts[box] = (counts[box] || 0) + n;
    }
    res.json({ emails: rows, counts });
  });

  app.get('/api/emails/:id', auth, async (req, res) => {
    const row = await emailOf(req);
    const email = rowToEmail(row);
    // The latest proposal, to resume where the user left off.
    const draft = await db.one<DraftRow>('SELECT * FROM drafts WHERE email_id = $1 ORDER BY id DESC LIMIT 1', [row.id]);
    const reply = await db.one<{ finalText: string; finalHtml: string; wasEdited: boolean; changeReason: string; mode: ReplyMode; toJson: string; ccJson: string; sentAt: Date; by: string | null; byName: string | null }>(
      `SELECT r.final_text AS "finalText", r.final_html AS "finalHtml", r.was_edited AS "wasEdited", r.change_reason AS "changeReason", r.mode, r.to_json AS "toJson", r.cc_json AS "ccJson",
              r.sent_at AS "sentAt", u.email AS by, u.name AS "byName"
       FROM replies r LEFT JOIN users u ON u.id = r.user_id WHERE r.email_id = $1 ORDER BY r.id DESC LIMIT 1`,
      [row.id],
    );
    const reason = readReason(email.triageReason);
    res.json({
      ...email,
      triageReason: reason.text,
      triageReasonCode: reason.code,
      account: row.account_email,
      shared: row.account_shared,
      recipients: replyRecipients(email, row.account_email, false),
      recipientsAll: replyRecipients(email, row.account_email, true),
      draft: draft ? { id: draft.id, action: draft.action ?? 'prompt', promptId: draft.prompt_id, model: draft.model, html: proposalHtml(draft) } : null,
      reply: reply ? { ...reply, to: JSON.parse(reply.toJson), cc: JSON.parse(reply.ccJson) } : null,
    });
  });

  // The three corrections of the sorting are in domain/sorting; the status asked for says which.
  const CORRECTIONS = { no_reply: markNoReplyNeeded, ignored: ignoreEmail, needs_reply: moveBackToHandle };

  app.post('/api/emails/:id/status', auth, async (req, res) => {
    const correct = CORRECTIONS[String(req.body.status) as keyof typeof CORRECTIONS];
    if (!correct) {
      // An email one may not see is not found, whatever else is wrong with the request.
      await emailOf(req);
      throw new HttpError(400, 'emails.invalidStatus');
    }
    await correct(world, actorOf(req), req.params.id);
    res.json({ ok: true });
  });

  // ---- replying --------------------------------------------------------------------------
  // The operations are in domain/replying: a route translates the request and calls one.
  const ASSISTANCE = { typos: checkTypos, style: improveStyle, prompt: writeWithPrompt };

  app.post('/api/emails/:id/assist', auth, async (req, res) => {
    const assist = ASSISTANCE[String(req.body.action) as keyof typeof ASSISTANCE];
    if (!assist) {
      // An email one may not see is not found, whatever else is wrong with the request.
      await emailOf(req);
      throw new HttpError(400, 'assist.invalidAction');
    }
    res.status(201).json(await assist(world, actorOf(req), { emailId: req.params.id, html: req.body.html, promptId: req.body.promptId }));
  });

  const replyRequest = (req: Request) => ({
    emailId: req.params.id,
    html: req.body.html,
    to: addressList(req.body.to),
    cc: addressList(req.body.cc),
    proposalId: Number(req.body.draftId) || 0,
    changeReason: str(req.body.changeReason, 1000),
  });

  app.post('/api/emails/:id/send', auth, async (req, res) => {
    res.json({ ok: true, ...(await sendReply(world, actorOf(req), replyRequest(req))) });
  });

  app.post('/api/emails/:id/save-draft', auth, async (req, res) => {
    res.json({ ok: true, ...(await fileReplyAsDraft(world, actorOf(req), replyRequest(req))) });
  });

  // ---- errors -----------------------------------------------------------------------------
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'request.unknownRoute')));
  const onError: ErrorRequestHandler = (err: Error & { status?: number; statusCode?: number }, req, res, next) => {
    if (res.headersSent) return next(err);
    const known = err instanceof HttpError || err instanceof LlmError || err instanceof Refusal;
    const status = err instanceof LlmError ? 502 : err instanceof Refusal ? STATUS[err.kind] : err.status || err.statusCode || 500;
    // Only the message is logged, never request bodies: they contain mail content.
    if (!known && status >= 500) console.error(`${req.method} ${req.path}: ${err.message}`);
    // Malformed requests refused by the framework (4xx) keep its own message, without a code.
    const described = known ? err.problem : status >= 500 ? problem('error.internal') : null;
    res.status(status).json(described ? { error: described.message, code: described.code, params: described.params } : { error: err.message });
  };
  app.use(onError);

  return app;
}
