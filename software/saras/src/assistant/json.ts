// Reading what a model wrote as data: nothing of it is trusted to be what was asked for.

/** The JSON object an answer holds, whatever it is wrapped in: a code fence, a sentence before or after. Null when it holds none. */
export function objectIn(text: string): Record<string, unknown> | null {
  const from = text.indexOf('{');
  const to = text.lastIndexOf('}');
  if (from < 0 || to < from) return null;
  try {
    const held: unknown = JSON.parse(text.slice(from, to + 1));
    return held && typeof held === 'object' && !Array.isArray(held) ? (held as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** A text of at most `max` characters; nothing for what is not a text. */
export const textOf = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** A list, or an empty one for what is not a list. */
export const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
