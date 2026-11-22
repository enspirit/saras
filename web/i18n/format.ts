/**
 * Formatting of translated messages, in the ICU MessageFormat syntax that Tolgee uses.
 * Pure and free of any browser API, so it is tested under Node.
 *
 * Supported subset:
 *   {name}                                   a parameter
 *   {count, plural, =0 {…} one {…} other {…}}  plural forms; `#` is the number
 *   {kind, select, a {…} other {…}}          a choice on a keyword
 *   '{' … '}'  and  ''                       quoting of braces, and a literal apostrophe
 *   <tag>…</tag>                             (formatRich only) a part rendered by the caller
 */

export type Params = Record<string, string | number>;

/** Index of the brace closing the one opened at `open`, quoted sections skipped. */
function closingBrace(message: string, open: number): number {
  let depth = 0;
  for (let i = open; i < message.length; i++) {
    const c = message[i];
    if (c === "'" && (message[i + 1] === '{' || message[i + 1] === '}')) {
      const end = message.indexOf("'", i + 2);
      i = end === -1 ? message.length : end;
    } else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

/** `one {a} other {b}` -> { one: 'a', other: 'b' } */
function parseOptions(source: string): Record<string, string> {
  const options: Record<string, string> = {};
  let i = 0;
  while (i < source.length) {
    const open = source.indexOf('{', i);
    if (open === -1) break;
    const close = closingBrace(source, open);
    if (close === -1) break;
    options[source.slice(i, open).trim()] = source.slice(open + 1, close);
    i = close + 1;
  }
  return options;
}

function choose(kind: string, value: string | number | undefined, options: Record<string, string>, params: Params, locale: string): string {
  if (kind === 'plural') {
    const n = Number(value);
    const branch = options[`=${n}`] ?? options[new Intl.PluralRules(locale).select(n)] ?? options.other ?? '';
    // `#` stands for the number, in the branch itself but not inside nested arguments.
    return format(branch, params, locale, new Intl.NumberFormat(locale).format(n));
  }
  return format(options[String(value)] ?? options.other ?? '', params, locale);
}

/** Reads what the apostrophe at `i` opens: a literal apostrophe, a quoted section, or just itself. `end` is the index of its last character. */
function quoted(message: string, i: number): { text: string; end: number } {
  const next = message[i + 1];
  if (next === "'") return { text: "'", end: i + 1 };
  if (next !== '{' && next !== '}') return { text: "'", end: i };
  const close = message.indexOf("'", i + 2);
  const stop = close === -1 ? message.length : close;
  return { text: message.slice(i + 1, stop), end: stop };
}

/** What stands between two braces, formatted: a parameter, or a choice on one. */
function argument(inner: string, params: Params, locale: string): string {
  const [name = '', kind, ...rest] = inner.split(',');
  const value = params[name.trim()];
  return kind ? choose(kind.trim(), value, parseOptions(rest.join(',')), params, locale) : String(value ?? `{${name.trim()}}`);
}

/**
 * @param hash what `#` expands to, inside a plural branch
 */
export function format(message: string, params: Params = {}, locale = 'en', hash?: string): string {
  let out = '';
  for (let i = 0; i < message.length; i++) {
    const c = message[i];
    if (c === "'") {
      const { text, end } = quoted(message, i);
      out += text;
      i = end;
    } else if (c === '{') {
      const close = closingBrace(message, i);
      if (close === -1) return out + message.slice(i);
      out += argument(message.slice(i + 1, close), params, locale);
      i = close;
    } else if (c === '#' && hash !== undefined) out += hash;
    else out += c;
  }
  return out;
}

/** A formatted message cut at its tags: plain text, or the text of a tag to be rendered by the caller. */
export type RichPart = string | { tag: string; text: string };

/**
 * Like `format`, for messages holding `<tag>…</tag>` parts. The template is cut at its tags
 * before parameters are inserted, so a parameter value can never be mistaken for a tag.
 */
export function formatRich(message: string, params: Params = {}, locale = 'en'): RichPart[] {
  const parts: RichPart[] = [];
  const tagged = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  for (const match of message.matchAll(tagged)) {
    if (match.index > last) parts.push(format(message.slice(last, match.index), params, locale));
    parts.push({ tag: match[1] ?? '', text: format(match[2] ?? '', params, locale) });
    last = match.index + match[0].length;
  }
  if (last < message.length) parts.push(format(message.slice(last), params, locale));
  return parts;
}

/** Names of the parameters a message uses, to compare translations with their source. */
export function parameterNames(message: string): string[] {
  const names = new Set<string>();
  const scan = (text: string): void => {
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== '{') continue;
      const close = closingBrace(text, i);
      if (close === -1) return;
      const [name = '', kind, ...rest] = text.slice(i + 1, close).split(',');
      names.add(name.trim());
      if (kind) Object.values(parseOptions(rest.join(','))).forEach(scan);
      i = close;
    }
  };
  scan(message);
  return [...names].sort();
}

/** `{ a: { b: 'x' } }` -> `{ 'a.b': 'x' }`: Tolgee's JSON nests keys on dots. */
export function flatten(tree: unknown, prefix = ''): Record<string, string> {
  const flat: Record<string, string> = {};
  if (tree && typeof tree === 'object') {
    for (const [key, value] of Object.entries(tree)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string') flat[path] = value;
      else Object.assign(flat, flatten(value, path));
    }
  }
  return flat;
}
