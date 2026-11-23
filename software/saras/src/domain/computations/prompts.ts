// Pure decisions about prompts.
import type { PromptAffinity } from '../../../shared/prompt.ts';
import { accept, refuse } from '../refusal.ts';
import { affinityGiven } from './prompt-affinity.ts';
import type { Verdict } from '../refusal.ts';

export interface PromptContent {
  name: string;
  /** When to use it: what members read to choose. */
  description: string;
  /** The instructions given to the LLM. */
  systemPrompt: string;
  /** The emails it suits, by their attributes. */
  affinity: PromptAffinity;
}

const clipped = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** ReqPre of CreatePrompt and EditPrompt: a prompt has a name and instructions. What is given is trimmed and capped. */
export function promptContent(given: { name?: unknown; description?: unknown; systemPrompt?: unknown; affinity?: unknown }): Verdict<PromptContent> {
  const content = { name: clipped(given.name, 120), description: clipped(given.description, 500), systemPrompt: clipped(given.systemPrompt, 20_000), affinity: affinityGiven(given.affinity) };
  return content.name && content.systemPrompt ? accept(content) : refuse('invalid', 'prompts.incomplete');
}
