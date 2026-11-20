import type { Email } from './types.ts';

/** Pure decisions about how a reply is shaped: subject, recipients, threading headers, quoting. */

type Recipients = { to: string[]; cc: string[] };

export function replySubject(subject: string | null | undefined): string {
  const s = String(subject || '').trim();
  return /^(re|tr|aw|sv)\s*:/i.test(s) ? s : `Re: ${s}`;
}

/**
 * Default recipients of a reply.
 * @param email    stored email ({ fromAddr, fromName, replyTo, to, cc })
 * @param ownAddress the mailbox owner, never included
 * @param replyAll  also copy the other recipients of the original
 */
export function replyRecipients(
  email: Pick<Email, 'fromAddr' | 'replyTo' | 'to' | 'cc'>,
  ownAddress: string,
  replyAll = false,
): Recipients {
  const own = String(ownAddress || '').toLowerCase();
  const primary = (email.replyTo || email.fromAddr || '').toLowerCase();
  const to = primary ? [primary] : [];
  if (!replyAll) return { to, cc: [] };
  const seen = new Set([own, ...to]);
  const cc: string[] = [];
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
export function replyReferences(email: Pick<Email, 'refs' | 'messageId'>): string[] {
  const ids = String(email.refs || '').split(/\s+/).filter(Boolean);
  if (email.messageId && !ids.includes(email.messageId)) ids.push(email.messageId);
  return ids.slice(-20);
}

/** The line introducing the quoted original, in the languages we know; English otherwise. */
const ATTRIBUTION: Record<string, (when: string, who: string) => string> = {
  en: (when, who) => `On ${when} (UTC), ${who} wrote:`,
  fr: (when, who) => `Le ${when} (UTC), ${who} a écrit :`,
};

export function quoteOriginal(email: Pick<Email, 'date' | 'fromName' | 'fromAddr' | 'bodyText'>, language = 'en'): string {
  const base = language.split('-')[0] ?? 'en';
  const attribution = ATTRIBUTION[base] ?? ATTRIBUTION.en!;
  const locale = ATTRIBUTION[base] ? language : 'en';
  const when = new Date(email.date).toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' });
  const who = email.fromName ? `${email.fromName} <${email.fromAddr}>` : email.fromAddr;
  const quoted = String(email.bodyText || '')
    .split('\n')
    .map((l) => (l.startsWith('>') ? `>${l}` : `> ${l}`))
    .join('\n');
  return `${attribution(when, who)}\n${quoted}`;
}

export function composeReplyBody(text: string, email: Pick<Email, 'date' | 'fromName' | 'fromAddr' | 'bodyText'>, language = 'en'): string {
  const body = String(text || '').trimEnd();
  return email.bodyText ? `${body}\n\n${quoteOriginal(email, language)}\n` : `${body}\n`;
}

/** Was the AI proposal changed by the user? Whitespace-only differences do not count. */
export function wasEdited(aiText: string | null | undefined, finalText: string | null | undefined): boolean {
  const norm = (s: string | null | undefined) => String(s || '').replace(/\s+/g, ' ').trim();
  return norm(aiText) !== norm(finalText);
}
