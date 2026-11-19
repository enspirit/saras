/** Pure decisions about how a reply is shaped: subject, recipients, threading headers, quoting. */

export function replySubject(subject) {
  const s = String(subject || '').trim();
  return /^(re|tr|aw|sv)\s*:/i.test(s) ? s : `Re: ${s}`;
}

/**
 * Default recipients of a reply.
 * @param email    stored email ({ fromAddr, fromName, replyTo, to, cc })
 * @param ownAddress the mailbox owner, never included
 * @param replyAll  also copy the other recipients of the original
 */
export function replyRecipients(email, ownAddress, replyAll = false) {
  const own = String(ownAddress || '').toLowerCase();
  const primary = (email.replyTo || email.fromAddr || '').toLowerCase();
  const to = primary ? [primary] : [];
  if (!replyAll) return { to, cc: [] };
  const seen = new Set([own, ...to]);
  const cc = [];
  for (const { address } of [...(email.to || []), ...(email.cc || [])]) {
    const a = String(address || '').toLowerCase();
    if (a && !seen.has(a)) {
      seen.add(a);
      cc.push(a);
    }
  }
  return { to, cc };
}

/** References header of the reply: the original chain plus the original Message-ID. */
export function replyReferences(email) {
  const ids = String(email.refs || '').split(/\s+/).filter(Boolean);
  if (email.messageId && !ids.includes(email.messageId)) ids.push(email.messageId);
  return ids.slice(-20);
}

export function quoteOriginal(email) {
  const when = new Date(email.date).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' });
  const who = email.fromName ? `${email.fromName} <${email.fromAddr}>` : email.fromAddr;
  const quoted = String(email.bodyText || '')
    .split('\n')
    .map((l) => (l.startsWith('>') ? `>${l}` : `> ${l}`))
    .join('\n');
  return `Le ${when} (UTC), ${who} a écrit :\n${quoted}`;
}

export function composeReplyBody(text, email) {
  const body = String(text || '').trimEnd();
  return email.bodyText ? `${body}\n\n${quoteOriginal(email)}\n` : `${body}\n`;
}

/** Was the AI proposal changed by the user? Whitespace-only differences do not count. */
export function wasEdited(aiText, finalText) {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  return norm(aiText) !== norm(finalText);
}
