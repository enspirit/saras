import express from 'express';
import type { CookieOptions, ErrorRequestHandler, Express, Request, RequestHandler, Response } from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from '../config.ts';
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
import { addressesGiven as addressList, clipped as str } from '../../domain/computations/given.ts';
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
import { chooseLanguage } from '../../domain/settings/choose-language.ts';
import { chooseOwnModel } from '../../domain/settings/choose-own-model.ts';
import { chooseWayOfWorking } from '../../domain/settings/choose-way-of-working.ts';
import { renameOrganization } from '../../domain/settings/rename-organization.ts';
import { setAsideAutomatedFirst } from '../../domain/settings/set-aside-automated-first.ts';
import { setOrganizationKey } from '../../domain/settings/set-organization-key.ts';
import { setOrganizationModel } from '../../domain/settings/set-organization-model.ts';
import { setOwnKey } from '../../domain/settings/set-own-key.ts';
import { setOwnName } from '../../domain/settings/set-own-name.ts';
import { setSignature } from '../../domain/settings/set-signature.ts';
import { ignoreEmail } from '../../domain/sorting/ignore-email.ts';
import { markNoReplyNeeded } from '../../domain/sorting/mark-no-reply-needed.ts';
import { moveBackToHandle } from '../../domain/sorting/move-back-to-handle.ts';
import { sortAgainUnsorted } from '../../domain/sorting/sort-again-unsorted.ts';
import { writeWithPrompt } from '../../domain/replying/write-with-prompt.ts';
import { emailFor } from '../../domain/state/emails.ts';
import type { OwnedEmailRow } from '../../domain/state/emails.ts';
import { mayUse } from '../../domain/state/mailboxes.ts';
import { manages } from '../../domain/computations/mailboxes.ts';
import { wayOf } from '../../domain/computations/way-of-working.ts';
import { chooseWatchedFolder } from '../../domain/mailboxes/choose-watched-folder.ts';
import { beginHostSignIn, connectMailboxByHostSignIn } from '../../domain/mailboxes/connect-mailbox-by-host-sign-in.ts';
import { connectMailboxByServers } from '../../domain/mailboxes/connect-mailbox-by-servers.ts';
import { disconnectMailbox } from '../../domain/mailboxes/disconnect-mailbox.ts';
import { fetchMailboxNow } from '../../domain/mailboxes/fetch-mailbox-now.ts';
import { listFolders } from '../../domain/mailboxes/list-folders.ts';
import { renewMailboxPassword } from '../../domain/mailboxes/renew-mailbox-credentials.ts';
import { promptOf as organizationPrompt } from '../../domain/state/prompts.ts';
import { createWorld } from '../../domain/world.ts';
import type { Actor, World } from '../../domain/world.ts';
import { errorMessage } from '../errors.ts';
import { LlmError, PRIVACY } from '../llm/openrouter.ts';
import { decodeProblem, problem, readReason } from '../messages.ts';
import type { MessageCode, MessageParams, Problem } from '../messages.ts';
import type { MailService } from '../mail/index.ts';
import { lookupMailHost } from '../mail/lookup.ts';
import { isConfigured } from '../mail/oauth.ts';
import { replyRecipients } from '../../domain/computations/reply.ts';
import { llmSettings } from '../../domain/computations/key-in-force.ts';
import { rowToEmail } from '../../domain/computations/emails.ts';
import type { Sync } from '../../domain/mailboxes/fetch-mailbox.ts';
import type {
  DraftRow,
  EmailStatus,
  Fetch,
  Llm,
  PromptRow,
  ReplyMode,
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
  const world: World = createWorld({ db, mail, llm, vault, config }, sync);
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
        way: wayOf(req.org),
        skipAutomated: req.org.skip_automated,
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

  // Each field sent is one operation of domain/settings, applied in this order; a field that
  // is refused stops there, and those before it stay applied.
  app.put('/api/settings', auth, async (req, res) => {
    const { model, signature, openrouterKey, language, name } = req.body;
    const actor = actorOf(req);
    if (typeof name === 'string') await setOwnName(world, actor, name);
    if (typeof language === 'string') await chooseLanguage(world, actor, language);
    if (typeof model === 'string') await chooseOwnModel(world, actor, model);
    if (typeof signature === 'string') await setSignature(world, actor, signature);
    if (typeof openrouterKey === 'string') await setOwnKey(world, actor, openrouterKey);
    res.json({ ok: true });
  });

  /** The organisation's own settings, for its administrators: again one operation per field sent. */
  app.put('/api/organization', auth, adminOnly, async (req, res) => {
    const { name, way, skipAutomated, model, openrouterKey } = req.body;
    const actor = actorOf(req);
    if (typeof name === 'string') await renameOrganization(world, actor, name);
    if (way !== undefined) await chooseWayOfWorking(world, actor, way);
    if (typeof skipAutomated === 'boolean') await setAsideAutomatedFirst(world, actor, skipAutomated);
    if (typeof model === 'string') await setOrganizationModel(world, actor, model);
    if (typeof openrouterKey === 'string') await setOrganizationKey(world, actor, openrouterKey);
    res.json({ ok: true });
  });

  app.post('/api/organization/sort-again', auth, adminOnly, async (req, res) => {
    await sortAgainUnsorted(world, actorOf(req));
    res.json({ ok: true });
  });

  // ---- mail accounts ----------------------------------------------------------------------
  app.get('/api/accounts', auth, async (req, res) => {
    const rows = await db.query<{ lastError: string | null; shared: boolean; user_id: number }>(
        `SELECT a.id, a.kind, a.email, a.display_name AS "displayName", a.shared, a.user_id, a.folder, a.folder_name AS "folderName",
                a.last_sync_at AS "lastSyncAt", a.last_error AS "lastError",
                (SELECT count(*)::int FROM emails e WHERE e.account_id = a.id AND e.status IN ('needs_reply','pending')) AS todo
         FROM accounts a WHERE ${mayUse('$1', '$2')} ORDER BY a.shared DESC, a.id`,
        [req.org.id, req.user.id],
    );
    res.json(rows.map(({ user_id, ...row }) => ({ ...row, canManage: manages(actorOf(req), { shared: row.shared, user_id }), lastError: decodeProblem(row.lastError) })));
  });

  app.post('/api/accounts/imap', auth, async (req, res) => {
    res.status(201).json({ id: (await connectMailboxByServers(world, actorOf(req), req.body)).id });
  });

  /** Who hosts the mail of an address, from its domain's MX records: the connection page uses it to propose the right way in. */
  app.get('/api/mail/host', auth, async (req, res) => {
    res.json(await lookupMailHost(str(req.query.email, 320)));
  });

  app.get('/api/accounts/:id/folders', auth, async (req, res) => {
    res.json(await listFolders(world, actorOf(req), req.params.id));
  });

  app.put('/api/accounts/:id/folder', auth, async (req, res) => {
    const folder = await chooseWatchedFolder(world, actorOf(req), req.params.id, req.body.folder);
    res.json({ ok: true, folder: folder.id, folderName: folder.name });
  });

  app.put('/api/accounts/:id/password', auth, async (req, res) => {
    await renewMailboxPassword(world, actorOf(req), req.params.id, req.body.password);
    res.json({ ok: true });
  });

  app.delete('/api/accounts/:id', auth, async (req, res) => {
    await disconnectMailbox(world, actorOf(req), req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/accounts/:id/sync', auth, async (req, res) => {
    res.json(await fetchMailboxNow(world, actorOf(req), req.params.id));
  });

  // ---- signing in at the mail host (Google / Microsoft) -------------------------------------
  app.get('/api/oauth/:kind/start', auth, async (req, res) => {
    res.redirect(await beginHostSignIn(world, actorOf(req), req.user.sid, String(req.params.kind), req.query.shared === '1', req.query.renew));
  });

  /** The member comes back from the host: the outcome travels in the URL, as a message code and its technical detail when there is one. */
  app.get('/api/oauth/:kind/callback', auth, async (req, res) => {
    const back = (code?: MessageCode, detail = '') =>
      res.redirect(`/#/accounts${code ? `?error=${encodeURIComponent(code)}&detail=${encodeURIComponent(detail)}` : ''}`);
    const { state, code, error } = req.query;
    try {
      await connectMailboxByHostSignIn(world, actorOf(req), req.user.sid, { kind: String(req.params.kind), remembered: req.user.oauth_state, state, code, error }, fetchImpl);
      back();
    } catch (e) {
      if (e instanceof Refusal) back(e.problem.code, String(e.problem.params.detail ?? ''));
      else back('oauth.failed', errorMessage(e));
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
       WHERE ${mayUse('$1', '$2')} AND e.status = ANY($3)
       ORDER BY e.date DESC LIMIT 200`,
      [req.org.id, req.user.id, statuses],
    );
    const counts = Object.fromEntries(Object.keys(BOXES).map((box) => [box, 0]));
    const perStatus = await db.query<{ status: EmailStatus; n: number }>(
      `SELECT e.status, count(*)::int AS n FROM emails e JOIN accounts a ON a.id = e.account_id WHERE ${mayUse('$1', '$2')} GROUP BY e.status`,
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
