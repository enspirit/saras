// Pure: which prompt suits an email, from the email's attributes. Sorting gives an email its
// attributes; each prompt says which values it has an affinity with; the prompt that suits
// best is the one offered first to who writes, and the one that writes when nobody chooses.
import { PRIORITY, STATUS } from '../../../shared/attribute.ts';
import type { ValueOfEmail } from '../../../shared/attribute.ts';
import { BOXES } from '../../../shared/email.ts';
import type { Box, EmailStatus, Priority } from '../../../shared/email.ts';
import type { PromptAffinity } from '../../../shared/prompt.ts';
import { attributeValuesGiven } from './boards.ts';

/** An affinity as it is kept: only attributes we know how to name, only those with a value. */
export const affinityGiven = (value: unknown): PromptAffinity => attributeValuesGiven(value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

/** What is kept of an email that says which values it has. */
export interface Sorted {
  status: EmailStatus;
  priority: Priority;
  attributes: Record<string, ValueOfEmail>;
}

/** The box an email stands in, as a value of "Stands in". */
const boxOf = (status: EmailStatus): string => (Object.keys(BOXES) as Box[]).find((box) => (BOXES[box] as readonly EmailStatus[]).includes(status)) ?? '';

/** The value an email has for each attribute, by the attribute's key: where it stands, its priority, and those the organisation made. */
export const valuesOf = ({ status, priority, attributes }: Sorted): Record<string, string> => ({
  ...Object.fromEntries(Object.entries(attributes).map(([key, { value }]) => [key, value])),
  [STATUS]: boxOf(status),
  [PRIORITY]: priority,
});

/** How well a prompt suits: how many attributes it names, when the email has a suitable value for each; nothing when it has not. */
function suits(affinity: PromptAffinity, values: Record<string, string>): number | null {
  const named = Object.entries(affinity);
  return named.every(([key, wanted]) => wanted.includes(values[key] ?? '')) ? named.length : null;
}

/**
 * The prompt that suits an email best: among those whose every attribute named holds, the one
 * that names the most; the first of the list when several do. A prompt that names nothing is
 * never the best: it suits every email alike.
 */
export function bestPrompt<P extends { affinity: PromptAffinity }>(prompts: P[], values: Record<string, string>): P | undefined {
  let best: { prompt: P; score: number } | undefined;
  for (const prompt of prompts) {
    const score = suits(prompt.affinity, values);
    if (score && score > (best?.score ?? 0)) best = { prompt, score };
  }
  return best?.prompt;
}
