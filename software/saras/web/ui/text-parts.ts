// An email's text cut into what its sender says, what it quotes and how it is signed: a pure
// decision, beside the components, which the tests read without a browser.

/** What a stretch of an email's text is: what its sender says, what it quotes of earlier emails, or how it is signed. */
export type TextKind = 'said' | 'quoted' | 'signed';
export interface TextPart { kind: TextKind; text: string; }

/** The line under which a mail client puts the email replied to, whole. */
const HISTORY = /^\s*(-{2,}\s*(original message|message d'origine|forwarded message|message transf[ée]r[ée])\s*-*|_{10,})\s*$/i;
/** The line a client puts above what it quotes. */
const ATTRIBUTION = /^\s*(on|le)\s.+\s(wrote|a [ée]crit)\s?:\s*$/i;
/** What a phone or a client adds under each email. */
const FOOTER = /^\s*(sent from my|envoy[ée] (de|depuis) mon|get outlook for|obtenir outlook pour)\b/i;
const QUOTE = /^\s*>/;
const DELIMITER = /^--\s?$/;

interface Reading { history: boolean; signature: boolean; }

/** The kind of one line, given the next that is not blank and what the lines above have opened. */
function kindOf(line: string, next: () => string, seen: Reading): TextKind {
  if (seen.history || HISTORY.test(line)) return (seen.history = true), 'quoted';
  if (QUOTE.test(line) || (ATTRIBUTION.test(line) && QUOTE.test(next()))) return (seen.signature = false), 'quoted';
  return seen.signature || FOOTER.test(line) ? 'signed' : 'said';
}

/** A quoted line without its mark of quotation. */
const unquoted = (line: string, kind: TextKind): string => (kind === 'quoted' ? line.replace(/^\s*> ?/, '') : line);

/** An email's text cut into what is said, quoted and signed, in order; a blank line goes with what precedes it, and the line that opens a signature goes. */
export function partsOfText(text: string): TextPart[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const seen: Reading = { history: false, signature: false };
  const parts: TextPart[] = [];
  lines.forEach((line, index) => {
    if (DELIMITER.test(line) && !seen.history) return void (seen.signature = true);
    const last = parts[parts.length - 1];
    const kind = line.trim() === '' && last ? last.kind : kindOf(line, () => lines.slice(index + 1).find((l) => l.trim()) ?? '', seen);
    if (last?.kind === kind) last.text += `\n${unquoted(line, kind)}`;
    else parts.push({ kind, text: unquoted(line, kind) });
  });
  return parts.map((part) => ({ ...part, text: part.text.replace(/\n{3,}/g, '\n\n').trim() })).filter((part) => part.text);
}
