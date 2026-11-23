import { escapeHtml } from './text.ts';

/**
 * The HTML of replies. A reply is rich text limited to what an email needs: paragraphs,
 * emphasis, lists, links and quotes. Everything here is pure.
 */

/** The only elements a reply may contain. */
export const REPLY_TAGS = ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'blockquote'] as const;

const ALLOWED = new Set<string>(REPLY_TAGS);
const VOID = new Set(['br']);
/** Elements whose content is not text to keep. */
const DROPPED_WITH_CONTENT = /<(script|style|head|title|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi;
const SAFE_LINK = /^(https?:|mailto:)/i;

/** The value of an attribute in the inside of a tag, entities left as written. */
function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

/**
 * Rebuilds HTML from the allowed elements only: every tag of the result is written by this
 * function, with no attribute other than the `href` of a link to the web or to an address.
 * Other tags disappear and their text stays; scripts, styles and the like go with their content.
 *
 * It is applied to what the LLM returns and to what is stored and sent, so that a reply never
 * carries markup we did not mean, whatever produced it. The interface sanitises again before
 * displaying anything.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  const source = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(DROPPED_WITH_CONTENT, '');
  let out = '';
  let last = 0;
  for (const match of source.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g)) {
    out += textOnly(source.slice(last, match.index)) + rewritten(match);
    last = match.index + match[0].length;
  }
  return (out + textOnly(source.slice(last))).trim();
}

/** A stray "<" in text (one that opens no tag we emit) is escaped: nothing unbalanced gets through. */
const textOnly = (chunk: string): string => chunk.replace(/</g, '&lt;');

/** A tag as we write it ourselves; nothing for one a reply may not contain. */
function rewritten([, closing, rawName = '', inside = '']: RegExpMatchArray): string {
  const name = rawName.toLowerCase();
  if (!ALLOWED.has(name)) return '';
  if (closing) return VOID.has(name) ? '' : `</${name}>`;
  return name === 'a' ? link(inside) : `<${name}>`;
}

/** A link keeps its address when it leads to the web or to an address, and nothing else. */
function link(inside: string): string {
  const href = (attribute(` ${inside}`, 'href') ?? '').trim();
  return SAFE_LINK.test(href) ? `<a href="${escapeHtml(href.replace(/&amp;/g, '&'))}">` : '<a>';
}

/** Plain text typed by a person -> paragraphs. */
export function textToHtml(text: string | null | undefined): string {
  return String(text || '')
    .trim()
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim())
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Whether an HTML fragment says nothing: no text once tags are gone. */
export const isBlankHtml = (html: string | null | undefined): boolean =>
  !String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|\s/g, '');

/** The model sometimes wraps its answer in a code fence despite being asked not to. */
export function stripCodeFence(answer: string): string {
  const fenced = answer.trim().match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
  return (fenced ? (fenced[1] ?? '') : answer).trim();
}
