import { buildTriageMessages } from './llm/prompts.js';
import { heuristicTriage, parseTriageAnswer } from './triage.js';

const MAX_STORED_BODY = 100_000;

export function rowToEmail(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    providerId: row.provider_id,
    messageId: row.message_id,
    threadId: row.thread_id,
    refs: row.refs,
    fromName: row.from_name,
    fromAddr: row.from_addr,
    replyTo: row.reply_to,
    to: JSON.parse(row.to_json),
    cc: JSON.parse(row.cc_json),
    subject: row.subject,
    date: row.date,
    bodyText: row.body_text,
    status: row.status,
    triageSource: row.triage_source,
    triageReason: row.triage_reason,
    priority: row.priority,
    suggestedPromptId: row.suggested_prompt_id,
  };
}

/** Which key and model does this user's LLM traffic use? */
export function llmSettings(user, { config, vault }) {
  return {
    apiKey: user.openrouter_key_enc ? vault.open(user.openrouter_key_enc) : config.openrouter.apiKey,
    model: user.model || config.openrouter.model,
  };
}

/** Fetches new inbox emails of an account and sorts them into "needs a reply" or not. */
export function createSync({ db, mail, llm, config, vault }) {
  /** account id -> sync in flight; concurrent callers share it instead of fetching twice. */
  const running = new Map();

  const insertEmail = db.prepare(`
    INSERT OR IGNORE INTO emails
      (account_id, provider_id, message_id, thread_id, refs, from_name, from_addr, reply_to, to_json, cc_json,
       subject, date, body_text, status, triage_source, triage_reason)
    VALUES
      (@accountId, @providerId, @messageId, @threadId, @refs, @fromName, @fromAddr, @replyTo, @toJson, @ccJson,
       @subject, @date, @bodyText, @status, @triageSource, @triageReason)`);
  const setTriage = db.prepare(
    `UPDATE emails SET status = ?, triage_source = 'ai', triage_reason = ?, priority = ?, suggested_prompt_id = ? WHERE id = ?`,
  );

  function store(account, emails) {
    db.transaction(() => {
      for (const email of emails) {
        const verdict = heuristicTriage(email, account.email);
        insertEmail.run({
          accountId: account.id,
          providerId: email.providerId,
          messageId: email.messageId,
          threadId: email.threadId,
          refs: email.refs || '',
          fromName: email.fromName,
          fromAddr: email.fromAddr,
          replyTo: email.replyTo || '',
          toJson: JSON.stringify(email.to),
          ccJson: JSON.stringify(email.cc),
          subject: email.subject,
          date: email.date,
          bodyText: email.bodyText.slice(0, MAX_STORED_BODY),
          status: verdict ? verdict.status : 'pending',
          triageSource: verdict ? 'rule' : null,
          triageReason: verdict ? verdict.reason : '',
        });
      }
    })();
  }

  /** Ask the LLM about every email the rules could not settle. Stops at the first LLM failure. */
  async function triagePending(account) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(account.user_id);
    const { apiKey, model } = llmSettings(user, { config, vault });
    if (!apiKey) return { triaged: 0, error: 'Aucune clé OpenRouter : tri automatique désactivé.' };
    const prompts = db.prepare('SELECT id, name, description FROM prompts WHERE user_id = ? ORDER BY id').all(user.id);
    const pending = db.prepare(`SELECT * FROM emails WHERE account_id = ? AND status = 'pending' ORDER BY date DESC`).all(account.id);
    let triaged = 0;
    for (const row of pending) {
      const messages = buildTriageMessages({ email: rowToEmail(row), prompts, ownAddress: account.email });
      let answer;
      try {
        answer = await llm.chat({ apiKey, model, messages, temperature: 0, maxTokens: 200 });
      } catch (e) {
        return { triaged, error: e.message };
      }
      const verdict = parseTriageAnswer(answer.text, prompts.map((p) => p.id));
      setTriage.run(verdict.status, verdict.reason, verdict.priority, verdict.promptId, row.id);
      triaged += 1;
    }
    return { triaged, error: null };
  }

  function syncAccount(account) {
    if (!running.has(account.id)) {
      running.set(account.id, runSync(account).finally(() => running.delete(account.id)));
    }
    return running.get(account.id);
  }

  async function runSync(account) {
    const known = new Set(
      db.prepare('SELECT provider_id FROM emails WHERE account_id = ?').all(account.id).map((r) => r.provider_id),
    );
    const since = new Date(Date.now() - config.syncDays * 86_400_000);
    let fetched = 0;
    let error = null;
    try {
      const emails = await mail.providerFor(account).listNew({ since, limit: config.syncMaxEmails, known });
      store(account, emails);
      fetched = emails.length;
    } catch (e) {
      error = `Lecture de la boîte impossible : ${e.responseText || e.message}`;
    }
    const triage = error ? { triaged: 0, error: null } : await triagePending(account);
    error = error || triage.error;
    db.prepare(`UPDATE accounts SET last_sync_at = datetime('now'), last_error = ? WHERE id = ?`).run(error, account.id);
    return { fetched, triaged: triage.triaged, error };
  }

  async function syncAll() {
    for (const account of db.prepare('SELECT * FROM accounts').all()) {
      await syncAccount(account).catch((e) => console.error(`sync compte ${account.id} : ${e.message}`));
    }
  }

  return { syncAccount, syncAll, triagePending };
}
