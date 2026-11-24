// What a log line may not hold, whatever it was given: the value of anything named as a
// secret, the credentials of a URL, an email address, a value known to be secret, a text
// long enough to be a mail. Pure: the logger applies it to every line, and nothing is
// written that did not pass here.
import { errorMessage } from './errors.ts';

export const HIDDEN = '[hidden]';
const MAX_TEXT = 2000;
const MAX_DEPTH = 4;
const MAX_ITEMS = 50;

/** Names whose value is not to be read: `password`, `pass`, `apiKey`, `authorization`, `set-cookie`, `refreshToken`… */
const SECRET_NAME = /pass|secret|token|credential|authori[sz]ation|cookie|api[-_]?key|^key$/i;

/** `smtps://user:password@host` says its host, and not who signs in there. */
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi;

const withoutUrlCredentials = (text: string): string => text.replace(URL_CREDENTIALS, `$1${HIDDEN}@`);

/** Whoever it is: a member, a mailbox, a correspondent. A server's answer or an error may name one. */
const ADDRESS = /[^\s<>"'(),:;@[\]/]+@(?:[a-z0-9-]+\.)+[a-z]{2,}/gi;

const withoutAddresses = (text: string): string => text.replace(ADDRESS, '[address]');

const clipped = (text: string): string => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}… (${text.length} characters)` : text);

const told = (text: string): string => clipped(withoutAddresses(withoutUrlCredentials(text)));

const fieldsOf = (value: object, depth: number): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_ITEMS)
      .map(([name, held]) => [name, SECRET_NAME.test(name) ? HIDDEN : redacted(held, depth + 1)]),
  );

/** What is neither a text nor a plain object: said by what it is, never by what it holds. */
function otherwise(value: object, depth: number): unknown {
  if (value instanceof Error) return told(errorMessage(value));
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (ArrayBuffer.isView(value)) return `[${value.byteLength} bytes]`;
  if (depth >= MAX_DEPTH) return '[deeper]';
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => redacted(item, depth + 1));
  return fieldsOf(value, depth);
}

/** A value as a log line may hold it: plain JSON, of a bounded size, without what a secret's name or a URL gives away. */
export function redacted(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return told(value);
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value !== 'object') return undefined;
  return otherwise(value, depth);
}

const base64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64');

/** The ways a text may carry a value: as it is, between JSON quotes, in base64. */
const formsOf = (secret: string): string[] => [secret, JSON.stringify(secret).slice(1, -1), base64(secret)];

/** Hides values known to be secret wherever a text holds them. The longest first: one may contain another. */
export function hiding(secrets: string[]): (text: string) => string {
  const known = [...new Set(secrets.filter(Boolean).flatMap(formsOf))].sort((a, b) => b.length - a.length);
  return (text) => known.reduce((said, secret) => said.replaceAll(secret, HIDDEN), text);
}
