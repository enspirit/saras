import type { Address } from './types.ts';

/** Small pure text helpers shared by the mail providers and the prompt builders. */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function htmlToText(html: string | null | undefined | false): string {
  return String(html || '')
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function escapeHtml(text: string): string {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c as '&' | '<' | '>' | '"']);
}

export function truncate(text: string | null | undefined, max: number): string {
  const s = String(text || '');
  return s.length <= max ? s : `${s.slice(0, max)}\n[… message truncated]`;
}

/** "Jane Doe <jane@x.org>" or "jane@x.org" -> { name, address } */
export function parseAddress(input: string | null | undefined): Address {
  const s = String(input || '').trim();
  const m = s.match(/^(.*)<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (m) return { name: m[1].trim().replace(/^"(.*)"$/, '$1'), address: m[2].toLowerCase() };
  return { name: '', address: s.toLowerCase() };
}

export const isEmailAddress = (s: unknown): boolean => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(String(s || ''));

export function formatAddress({ name, address }: Address): string {
  return name ? `"${String(name).replace(/["\\]/g, '')}" <${address}>` : address;
}
