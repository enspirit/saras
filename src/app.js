import express from 'express';
import { fileURLToPath } from 'node:url';
import { hashPassword, randomToken, verifyPassword } from './crypto.js';
import { seedDefaultPrompts } from './db.js';
import { LlmError, PRIVACY } from './llm/openrouter.js';
import { buildDraftMessages } from './llm/prompts.js';
import { authorizationUrl, exchangeCode, fetchIdentity, isConfigured, isOAuthKind } from './mail/oauth.js';
import { replyRecipients, wasEdited } from './reply.js';
import { llmSettings, rowToEmail } from './sync.js';
import { isEmailAddress } from './text.js';

const SESSION_DAYS = 30;
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const str = (v, max = 10_000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const addressList = (v) => (Array.isArray(v) ? v.map((a) => str(a, 320).toLowerCase()).filter(Boolean) : []);

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function createApp({ config, db, vault, mail, llm, sync, fetchImpl = fetch }) {
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
  app.use(express.static(PUBLIC_DIR));
  app.use('/api', (req, res, next) => {
    res.set('cache-control', 'no-store');
    // Cross-site forms cannot send JSON: requiring it on writes is our CSRF barrier, with SameSite=Lax.
    if (!['GET', 'HEAD'].includes(req.method) && !req.is('application/json')) {
      return next(new HttpError(415, 'Content-Type application/json requis'));
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  // ---- sessions ---------------------------------------------------------------------------
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: config.secureCookies, path: '/' };

  function openSession(res, userId) {
    const id = randomToken();
    db.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`).run(id, userId, `+${SESSION_DAYS} days`);
    res.cookie('sid', id, { ...cookieOptions, maxAge: SESSION_DAYS * 86_400_000 });
  }

  function auth(req, res, next) {
    const sid = readCookie(req, 'sid');
    const row =
      sid &&
      db
        .prepare(`SELECT u.*, s.id AS sid, s.oauth_state FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > datetime('now')`)
        .get(sid);
    if (!row) return next(new HttpError(401, 'Non connecté'));
    req.user = row;
    next();
  }

  const adminOnly = (req, res, next) => next(req.user.role === 'admin' ? undefined : new HttpError(403, 'Réservé aux administrateurs.'));

  const attempts = new Map();
  function throttle(req) {
    const now = Date.now();
    const entry = attempts.get(req.ip);
    if (!entry || entry.reset < now) return void attempts.set(req.ip, { count: 1, reset: now + 15 * 60_000 });
    if (++entry.count > 10) throw new HttpError(429, 'Trop de tentatives, réessayez dans quelques minutes.');
  }

  const publicInfo = () => ({ allowSignup: config.allowSignup });

  app.get('/api/public', (req, res) => res.json(publicInfo()));

  app.post('/api/auth/signup', (req, res) => {
    if (!config.allowSignup) throw new HttpError(403, 'Les inscriptions sont fermées.');
    throttle(req);
    const email = str(req.body.email, 320).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!isEmailAddress(email)) throw new HttpError(400, 'Adresse email invalide.');
    if (password.length < 10) throw new HttpError(400, 'Mot de passe : 10 caractères minimum.');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'Un compte existe déjà avec cette adresse.');
    // The first account of an installation administers it.
    const role = db.prepare('SELECT 1 FROM users').get() ? 'user' : 'admin';
    const { lastInsertRowid } = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(email, hashPassword(password), role);
    if (!db.prepare('SELECT 1 FROM prompts').get()) seedDefaultPrompts(db, lastInsertRowid);
    openSession(res, lastInsertRowid);
    res.status(201).json({ ok: true });
  });

  app.post('/api/auth/login', (req, res) => {
    throttle(req);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(str(req.body.email, 320).toLowerCase());
    if (!user || !verifyPassword(String(req.body.password || ''), user.password_hash)) {
      throw new HttpError(401, 'Email ou mot de passe incorrect.');
    }
    openSession(res, user.id);
    res.json({ ok: true });
  });

  app.post('/api/auth/logout', auth, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.user.sid);
    res.clearCookie('sid', cookieOptions);
    res.json({ ok: true });
  });

  // ---- profile & settings -----------------------------------------------------------------
  app.get('/api/me', auth, (req, res) => {
    const { apiKey, model } = llmSettings(req.user, { config, vault });
    res.json({
      email: req.user.email,
      role: req.user.role,
      signature: req.user.signature,
      model,
      defaultModel: config.openrouter.model,
      hasOwnKey: Boolean(req.user.openrouter_key_enc),
      hasKey: Boolean(apiKey),
      oauth: { google: isConfigured(config, 'google'), microsoft: isConfigured(config, 'microsoft') },
      privacy: PRIVACY,
      retentionDays: config.retentionDays,
    });
  });

  app.put('/api/settings', auth, (req, res) => {
    const { model, signature, openrouterKey } = req.body;
    if (typeof model === 'string') {
      const m = str(model, 200);
      if (m && !/^[\w.:-]+\/[\w.:-]+$/.test(m)) throw new HttpError(400, 'Modèle invalide : attendu « fournisseur/modèle ».');
      db.prepare('UPDATE users SET model = ? WHERE id = ?').run(m || null, req.user.id);
    }
    if (typeof signature === 'string') db.prepare('UPDATE users SET signature = ? WHERE id = ?').run(str(signature, 2000), req.user.id);
    if (typeof openrouterKey === 'string') {
      const key = str(openrouterKey, 500);
      db.prepare('UPDATE users SET openrouter_key_enc = ? WHERE id = ?').run(key ? vault.seal(key) : null, req.user.id);
    }
    res.json({ ok: true });
  });

  // ---- mail accounts ----------------------------------------------------------------------
  const accountOf = (req) => {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
    if (!account) throw new HttpError(404, 'Compte introuvable');
    return account;
  };
  const backgroundSync = (account) => sync.syncAccount(account).catch((e) => console.error(`sync compte ${account.id} : ${e.message}`));

  app.get('/api/accounts', auth, (req, res) => {
    res.json(
      db
        .prepare(
          `SELECT a.id, a.kind, a.email, a.display_name AS displayName, a.last_sync_at AS lastSyncAt, a.last_error AS lastError,
                  (SELECT count(*) FROM emails e WHERE e.account_id = a.id AND e.status IN ('needs_reply','pending')) AS todo
           FROM accounts a WHERE a.user_id = ? ORDER BY a.id`,
        )
        .all(req.user.id),
    );
  });

  app.post('/api/accounts/imap', auth, async (req, res) => {
    const b = req.body;
    const email = str(b.email, 320).toLowerCase();
    const port = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) < 65536 ? Number(v) : null);
    const cfg = {
      imap: { host: str(b.imapHost, 255), port: port(b.imapPort), secure: Boolean(b.imapSecure), user: str(b.username, 320) || email, pass: String(b.password || '') },
      smtp: { host: str(b.smtpHost, 255), port: port(b.smtpPort), secure: Boolean(b.smtpSecure), user: str(b.username, 320) || email, pass: String(b.password || '') },
    };
    if (!isEmailAddress(email)) throw new HttpError(400, 'Adresse email invalide.');
    if (!cfg.imap.host || !cfg.smtp.host || !cfg.imap.port || !cfg.smtp.port) throw new HttpError(400, 'Serveurs et ports IMAP et SMTP requis.');
    if (!cfg.imap.pass) throw new HttpError(400, 'Mot de passe requis.');
    const draft = { kind: 'imap', email, display_name: str(b.displayName, 200) };
    try {
      await mail.imapProvider(draft, cfg).verify();
    } catch (e) {
      throw new HttpError(400, `Connexion impossible : ${e.responseText || e.message}`);
    }
    const account = saveAccount(req.user.id, draft, cfg);
    backgroundSync(account);
    res.status(201).json({ id: account.id });
  });

  function saveAccount(userId, { kind, email, display_name }, cfg) {
    db.prepare(
      `INSERT INTO accounts (user_id, kind, email, display_name, config_enc) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, kind, email) DO UPDATE SET config_enc = excluded.config_enc, display_name = excluded.display_name, last_error = NULL`,
    ).run(userId, kind, email, display_name, vault.seal(cfg));
    return db.prepare('SELECT * FROM accounts WHERE user_id = ? AND kind = ? AND email = ?').get(userId, kind, email);
  }

  app.delete('/api/accounts/:id', auth, (req, res) => {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(accountOf(req).id);
    res.json({ ok: true });
  });

  app.post('/api/accounts/:id/sync', auth, async (req, res) => {
    res.json(await sync.syncAccount(accountOf(req)));
  });

  // ---- OAuth (Google / Microsoft) ---------------------------------------------------------
  app.get('/api/oauth/:kind/start', auth, (req, res) => {
    const { kind } = req.params;
    if (!isOAuthKind(kind) || !isConfigured(config, kind)) throw new HttpError(404, 'Fournisseur OAuth non configuré sur ce serveur.');
    const state = randomToken(24);
    db.prepare('UPDATE sessions SET oauth_state = ? WHERE id = ?').run(`${kind}:${state}`, req.user.sid);
    res.redirect(authorizationUrl(config, kind, state));
  });

  app.get('/api/oauth/:kind/callback', auth, async (req, res) => {
    const { kind } = req.params;
    const back = (error) => res.redirect(`/#/comptes${error ? `?erreur=${encodeURIComponent(error)}` : ''}`);
    const expected = req.user.oauth_state;
    db.prepare('UPDATE sessions SET oauth_state = NULL WHERE id = ?').run(req.user.sid);
    if (!isOAuthKind(kind) || !isConfigured(config, kind)) return back('Fournisseur OAuth non configuré.');
    if (req.query.error) return back(`Autorisation refusée (${str(req.query.error, 100)}).`);
    if (!expected || expected !== `${kind}:${req.query.state}`) return back('Session OAuth expirée, recommencez.');
    try {
      const tokens = await exchangeCode(config, kind, String(req.query.code || ''), fetchImpl);
      if (!tokens.refreshToken) throw new Error('aucun refresh token reçu');
      const identity = await fetchIdentity(kind, tokens.accessToken, fetchImpl);
      backgroundSync(saveAccount(req.user.id, { kind, email: identity.email, display_name: identity.name }, tokens));
      back();
    } catch (e) {
      back(e.message);
    }
  });

  // ---- prompts ----------------------------------------------------------------------------
  // Prompts are shared by every user and maintained by administrators.
  const promptOf = (req, id = req.params.id) => {
    const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(Number(id));
    if (!prompt) throw new HttpError(404, 'Prompt introuvable');
    return prompt;
  };
  const promptBody = (req) => {
    const p = { name: str(req.body.name, 120), description: str(req.body.description, 500), systemPrompt: str(req.body.systemPrompt, 20_000) };
    if (!p.name || !p.systemPrompt) throw new HttpError(400, 'Nom et instructions requis.');
    return p;
  };

  app.get('/api/prompts', auth, (req, res) => {
    if (req.user.role !== 'admin') {
      // Users pick a prompt by name and purpose; its instructions stay with the administrators.
      return res.json(db.prepare('SELECT id, name, description FROM prompts ORDER BY id').all());
    }
    res.json(
      db
        .prepare(
          `SELECT p.id, p.name, p.description, p.system_prompt AS systemPrompt,
                  (SELECT count(*) FROM replies r WHERE r.prompt_id = p.id) AS used,
                  (SELECT count(*) FROM replies r WHERE r.prompt_id = p.id AND r.was_edited = 1) AS edited
           FROM prompts p ORDER BY p.id`,
        )
        .all(),
    );
  });

  app.post('/api/prompts', auth, adminOnly, (req, res) => {
    const p = promptBody(req);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO prompts (user_id, name, description, system_prompt) VALUES (?, ?, ?, ?)')
      .run(req.user.id, p.name, p.description, p.systemPrompt);
    res.status(201).json({ id: lastInsertRowid });
  });

  app.put('/api/prompts/:id', auth, adminOnly, (req, res) => {
    const p = promptBody(req);
    db.prepare('UPDATE prompts SET name = ?, description = ?, system_prompt = ? WHERE id = ?').run(p.name, p.description, p.systemPrompt, promptOf(req).id);
    res.json({ ok: true });
  });

  app.delete('/api/prompts/:id', auth, adminOnly, (req, res) => {
    db.prepare('DELETE FROM prompts WHERE id = ?').run(promptOf(req).id);
    res.json({ ok: true });
  });

  /**
   * What this user said when correcting drafts made with this prompt, most recent first.
   * Corrections are personal ("I am on first-name terms with this client"): they steer the
   * drafts of the user who made them, not those of colleagues.
   */
  const lessonsFor = (promptId, userId) =>
    db
      .prepare(
        `SELECT r.change_reason FROM replies r JOIN emails e ON e.id = r.email_id JOIN accounts a ON a.id = e.account_id
         WHERE r.prompt_id = ? AND a.user_id = ? AND r.was_edited = 1 AND r.change_reason != '' ORDER BY r.id DESC LIMIT 8`,
      )
      .all(promptId, userId)
      .map((r) => r.change_reason);

  /** For administrators: every user's corrections on a prompt, the raw material to improve it. */
  app.get('/api/prompts/:id/corrections', auth, adminOnly, (req, res) => {
    res.json(
      db
        .prepare(
          `SELECT r.change_reason AS reason, u.email AS user, r.sent_at AS at
           FROM replies r JOIN emails e ON e.id = r.email_id JOIN accounts a ON a.id = e.account_id JOIN users u ON u.id = a.user_id
           WHERE r.prompt_id = ? AND r.was_edited = 1 AND r.change_reason != '' ORDER BY r.id DESC LIMIT 50`,
        )
        .all(promptOf(req).id),
    );
  });

  // ---- users (administrators) -------------------------------------------------------------
  app.get('/api/users', auth, adminOnly, (req, res) => {
    res.json(
      db
        .prepare(
          `SELECT u.id, u.email, u.role, u.created_at AS createdAt, (SELECT count(*) FROM accounts a WHERE a.user_id = u.id) AS accounts
           FROM users u ORDER BY u.id`,
        )
        .all(),
    );
  });

  app.put('/api/users/:id', auth, adminOnly, (req, res) => {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!target) throw new HttpError(404, 'Utilisateur introuvable');
    if (!['admin', 'user'].includes(req.body.role)) throw new HttpError(400, 'Rôle invalide');
    const admins = db.prepare(`SELECT count(*) AS n FROM users WHERE role = 'admin'`).get().n;
    if (target.role === 'admin' && req.body.role === 'user' && admins === 1) {
      throw new HttpError(409, 'Il doit rester au moins un administrateur.');
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(req.body.role, target.id);
    res.json({ ok: true });
  });

  // ---- emails -----------------------------------------------------------------------------
  const BOXES = { todo: ['needs_reply', 'pending'], none: ['no_reply'], sent: ['sent'], ignored: ['ignored'] };

  const emailOf = (req) => {
    const row = db
      .prepare(
        `SELECT e.*, a.email AS account_email FROM emails e JOIN accounts a ON a.id = e.account_id WHERE e.id = ? AND a.user_id = ?`,
      )
      .get(Number(req.params.id), req.user.id);
    if (!row) throw new HttpError(404, 'Email introuvable');
    return row;
  };

  app.get('/api/emails', auth, (req, res) => {
    const statuses = BOXES[req.query.box] || BOXES.todo;
    const rows = db
      .prepare(
        `SELECT e.id, e.from_name AS fromName, e.from_addr AS fromAddr, e.subject, e.date, e.status, e.priority,
                e.triage_reason AS triageReason, e.triage_source AS triageSource, substr(e.body_text, 1, 160) AS snippet, a.email AS account,
                (SELECT r.mode FROM replies r WHERE r.email_id = e.id ORDER BY r.id DESC LIMIT 1) AS replyMode
         FROM emails e JOIN accounts a ON a.id = e.account_id
         WHERE a.user_id = ? AND e.status IN (${statuses.map(() => '?').join(',')})
         ORDER BY e.date DESC LIMIT 200`,
      )
      .all(req.user.id, ...statuses);
    const counts = Object.fromEntries(Object.keys(BOXES).map((box) => [box, 0]));
    for (const { status, n } of db
      .prepare(`SELECT e.status, count(*) AS n FROM emails e JOIN accounts a ON a.id = e.account_id WHERE a.user_id = ? GROUP BY e.status`)
      .all(req.user.id)) {
      for (const [box, list] of Object.entries(BOXES)) if (list.includes(status)) counts[box] += n;
    }
    res.json({ emails: rows, counts });
  });

  app.get('/api/emails/:id', auth, (req, res) => {
    const row = emailOf(req);
    const email = rowToEmail(row);
    const draft = db.prepare('SELECT id, prompt_id AS promptId, model, instructions, ai_text AS aiText FROM drafts WHERE email_id = ? ORDER BY id DESC LIMIT 1').get(row.id);
    const reply = db
      .prepare(
        `SELECT final_text AS finalText, was_edited AS wasEdited, change_reason AS changeReason, mode, to_json AS toJson, cc_json AS ccJson, sent_at AS sentAt
         FROM replies WHERE email_id = ? ORDER BY id DESC LIMIT 1`,
      )
      .get(row.id);
    res.json({
      ...email,
      account: row.account_email,
      recipients: replyRecipients(email, row.account_email, false),
      recipientsAll: replyRecipients(email, row.account_email, true),
      draft: draft || null,
      reply: reply ? { ...reply, wasEdited: Boolean(reply.wasEdited), to: JSON.parse(reply.toJson), cc: JSON.parse(reply.ccJson) } : null,
    });
  });

  app.post('/api/emails/:id/status', auth, (req, res) => {
    const row = emailOf(req);
    const status = req.body.status;
    if (!['needs_reply', 'no_reply', 'ignored'].includes(status)) throw new HttpError(400, 'Statut invalide');
    if (row.status === 'sent') throw new HttpError(409, 'Réponse déjà envoyée.');
    db.prepare(`UPDATE emails SET status = ?, triage_source = 'user' WHERE id = ?`).run(status, row.id);
    res.json({ ok: true });
  });

  app.post('/api/emails/:id/draft', auth, async (req, res) => {
    const row = emailOf(req);
    if (!row.body_text) throw new HttpError(410, 'Le contenu de cet email a été effacé (durée de conservation dépassée).');
    const prompt = promptOf(req, req.body.promptId);
    const instructions = str(req.body.instructions, 4000);
    const { apiKey, model } = llmSettings(req.user, { config, vault });
    const messages = buildDraftMessages({
      email: rowToEmail(row),
      prompt: { systemPrompt: prompt.system_prompt },
      ownAddress: row.account_email,
      signature: req.user.signature,
      instructions,
      lessons: lessonsFor(prompt.id, req.user.id),
    });
    const answer = await llm.chat({ apiKey, model, messages });
    const { lastInsertRowid } = db
      .prepare('INSERT INTO drafts (email_id, prompt_id, model, instructions, ai_text) VALUES (?, ?, ?, ?, ?)')
      .run(row.id, prompt.id, answer.model, instructions, answer.text);
    res.status(201).json({ id: lastInsertRowid, promptId: prompt.id, model: answer.model, provider: answer.provider, aiText: answer.text });
  });

  const sending = new Set();

  /**
   * Hand the reply over to the mailbox, either sent ('sent') or left in its drafts ('draft').
   * Both record what the AI proposed, what the user made of it, and why.
   */
  const deliver = (mode) => async (req, res) => {
    const row = emailOf(req);
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const to = addressList(req.body.to);
    const cc = addressList(req.body.cc);
    if (!text) throw new HttpError(400, 'La réponse est vide.');
    if (!to.length) throw new HttpError(400, 'Au moins un destinataire est requis.');
    const bad = [...to, ...cc].find((a) => !isEmailAddress(a));
    if (bad) throw new HttpError(400, `Adresse invalide : ${bad}`);
    if (row.status === 'sent' || sending.has(row.id)) throw new HttpError(409, 'Une réponse a déjà été traitée pour cet email.');
    const draft = req.body.draftId ? db.prepare('SELECT * FROM drafts WHERE id = ? AND email_id = ?').get(Number(req.body.draftId), row.id) : null;
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(row.account_id);

    sending.add(row.id);
    try {
      const provider = mail.providerFor(account);
      const reply = { email: rowToEmail(row), to, cc, text };
      try {
        await (mode === 'draft' ? provider.saveDraft(reply) : provider.send(reply));
      } catch (e) {
        throw new HttpError(502, `${mode === 'draft' ? 'Enregistrement du brouillon' : 'Envoi'} impossible : ${e.responseText || e.message}`);
      }
      const edited = draft ? wasEdited(draft.ai_text, text) : false;
      db.transaction(() => {
        db.prepare(
          `INSERT INTO replies (email_id, prompt_id, ai_text, final_text, was_edited, change_reason, mode, to_json, cc_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(row.id, draft?.prompt_id ?? null, draft?.ai_text ?? null, text, edited ? 1 : 0, edited ? str(req.body.changeReason, 1000) : '', mode, JSON.stringify(to), JSON.stringify(cc));
        db.prepare(`UPDATE emails SET status = 'sent' WHERE id = ?`).run(row.id);
      })();
      res.json({ ok: true, wasEdited: edited });
    } finally {
      sending.delete(row.id);
    }
  };

  app.post('/api/emails/:id/send', auth, deliver('sent'));
  app.post('/api/emails/:id/save-draft', auth, deliver('draft'));

  // ---- errors -----------------------------------------------------------------------------
  app.use('/api', (req, res, next) => next(new HttpError(404, 'Route inconnue')));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err instanceof LlmError ? 502 : err.status || err.statusCode || 500;
    // Only the message is logged, never request bodies: they contain mail content.
    if (status >= 500 && !(err instanceof LlmError) && !(err instanceof HttpError)) console.error(`${req.method} ${req.path} : ${err.message}`);
    res.status(status).json({ error: status === 500 ? 'Erreur interne du serveur.' : err.message });
  });

  return app;
}
