// The HTML of a received email, as it may be shown. Like the HTML of replies (html.ts) it is
// rebuilt from a list: every tag of the result is written here, with the attributes of a
// list and no other. The list is longer, since a received email is laid out by whoever wrote
// it: tables, fonts, colours, styles. Nothing in the result runs, asks anything of another
// host, or leads anywhere but to the web or to an address. Pure.
//
// It is one of two guards: the document is also served under a policy that forbids scripts
// and every request (src/tooling/http/emails.ts).

const TAGS = new Set(
  'a abbr b blockquote br caption center code col colgroup dd div dl dt em font h1 h2 h3 h4 h5 h6 hr i img li ol p pre s small span strike strong sub sup table tbody td tfoot th thead tr u ul'.split(' '),
);
const VOID = new Set(['br', 'hr', 'img', 'col']);
/** How an email lays itself out. No `id`, no `name`, nothing that starts with `on`. */
const ATTRIBUTES = new Set('align alt bgcolor border cellpadding cellspacing class color colspan dir face height lang rowspan size style title valign width'.split(' '));

/** Elements whose content is not text to show. */
const DROPPED_WITH_CONTENT = /<(script|head|title|iframe|object|embed|noscript|template|svg|math|form|select|textarea|button)\b[\s\S]*?<\/\1\s*>/gi;
const STYLE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
/** A tag: its name, and its attributes, in which a quoted value may hold a ">". */
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTRIBUTE = /([a-zA-Z][\w:-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/** Where a link may lead, said in so many letters: no entity is read as part of it. */
const LEADS_SOMEWHERE_SAFE = /^(https?:\/\/|mailto:)/i;
/** The only images shown are those the email carries in itself. One hosted elsewhere would tell its host that the email was opened. */
const CARRIED_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;
const HOSTED_IMAGE = /<img\b[^>]*\ssrc\s*=\s*["']?\s*(https?:|\/\/)/i;

/** A value between the quotes we write. Its entities stay as they were written: none can end the attribute. */
const quoted = (value: string): string => value.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The attributes of a tag as they were written, by name; the first of a name wins, as in a browser. */
function attributesOf(inside: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, name = '', double, single, bare] of inside.matchAll(ATTRIBUTE)) {
    if (!found.has(name.toLowerCase())) found.set(name.toLowerCase(), (double ?? single ?? bare ?? '').trim());
  }
  return found;
}

/** What only one element may have: where a link leads, and the image an email carries. */
function ownAttributes(name: string, written: Map<string, string>): string {
  const href = written.get('href') ?? '';
  if (name === 'a') return `${LEADS_SOMEWHERE_SAFE.test(href) ? ` href="${quoted(href)}"` : ''} target="_blank" rel="noopener noreferrer"`;
  const src = written.get('src') ?? '';
  return name === 'img' && CARRIED_IMAGE.test(src) ? ` src="${quoted(src)}"` : '';
}

/** A tag as we write it ourselves; nothing for one an email is not shown with. */
function rewritten([, closing, rawName = '', inside = '']: RegExpMatchArray): string {
  const name = rawName.toLowerCase();
  if (!TAGS.has(name)) return '';
  if (closing) return VOID.has(name) ? '' : `</${name}>`;
  const written = attributesOf(inside);
  const kept = [...written].filter(([attribute]) => ATTRIBUTES.has(attribute)).map(([attribute, value]) => ` ${attribute}="${quoted(value)}"`);
  return `<${name}${kept.join('')}${ownAttributes(name, written)}>`;
}

/** A stray "<" in text is escaped: nothing opens a tag but what we wrote. */
const textOnly = (chunk: string): string => chunk.replace(/</g, '&lt;');

/** The body of an email, rebuilt. */
function body(source: string): string {
  let out = '';
  let last = 0;
  for (const match of source.matchAll(TAG)) {
    out += textOnly(source.slice(last, match.index)) + rewritten(match);
    last = match.index + match[0].length;
  }
  return out + textOnly(source.slice(last));
}

/** The style sheets an email brings, wherever it wrote them. Without a "<", none can end the element we put it in. */
const styleSheets = (html: string): string => [...html.matchAll(STYLE)].map(([, css = '']) => `<style>${css.replace(/</g, '')}</style>`).join('');

/**
 * How an email that says nothing of it looks: a sheet of paper, white whatever the theme of the
 * interface, with a margin, in the fonts and sizes the interface reads in, and no wider than
 * where it is shown. An email that says how it looks is obeyed: its style sheets come after.
 */
const OURS = `<style>
html{color-scheme:light;background:#fff}
html,body{height:auto!important;min-height:0!important}
body{margin:0;padding:16px 20px;color:#1f2328;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:14px;line-height:1.5;overflow-wrap:anywhere}
img,table{max-width:100%}img{height:auto}
a{color:#1a56db}
blockquote{margin:0 0 0 2px;padding:0 0 0 12px;border-left:2px solid #d0d7de;color:#57606a}
hr{border:0;border-top:1px solid #d8dee4;margin:16px 0}
pre{white-space:pre-wrap}
</style>`.replace(/\n/g, '');

/** A received email as a document of its own, to be shown in a frame. Links open elsewhere than in the frame. */
export function receivedDocument(html: string): string {
  const source = html.replace(/<!--[\s\S]*?-->/g, '');
  const shown = body(source.replace(STYLE, '').replace(DROPPED_WITH_CONTENT, ''));
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">${OURS}${styleSheets(source)}</head><body>${shown}</body></html>`;
}

/** Whether an email shows images hosted elsewhere, which are held back. */
export const holdsHostedImages = (html: string): boolean => HOSTED_IMAGE.test(html);
