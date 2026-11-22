// Prompts: the organisation's ways of replying, the ready-made ones, and what members corrected.
// One function per operation of OPERATIONS.md.
import type { Correction, Prompt, ReadyMadePrompt } from '../../shared/prompt.ts';
import { api } from '../api.ts';

/** What a prompt is made of, as its form sends it. */
export interface PromptContent {
  name: string;
  description: string;
  systemPrompt: string;
}

export const readPrompts = (): Promise<Prompt[]> => api<Prompt[]>('GET', '/prompts');
export const readPromptTemplates = (): Promise<ReadyMadePrompt[]> => api<ReadyMadePrompt[]>('GET', '/prompts/ready-made');
/** What members changed in the proposals written with this prompt, and why. */
export const readCorrections = (promptId: number): Promise<Correction[]> => api<Correction[]>('GET', `/prompts/${promptId}/corrections`);
export const createPrompt = (prompt: PromptContent): Promise<unknown> => api('POST', '/prompts', prompt);
export const addReadyMadePrompt = (template: ReadyMadePrompt): Promise<unknown> => api('POST', '/prompts', template);
export const editPrompt = (id: number, prompt: PromptContent): Promise<unknown> => api('PUT', `/prompts/${id}`, prompt);
export const deletePrompt = (id: number): Promise<unknown> => api('DELETE', `/prompts/${id}`);
