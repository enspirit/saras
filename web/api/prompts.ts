// Prompts: the organisation's ways of replying, the ready-made ones, and what members corrected.
// One function per operation of OPERATIONS.md.
import { api } from '../api.ts';

/** A prompt as every user sees it; administrators also get the instructions and usage. */
export interface Prompt {
  id: number;
  name: string;
  description: string;
  systemPrompt?: string;
  used?: number;
  edited?: number;
}

/** A ready-made prompt the organisation does not have yet. */
export interface PromptTemplate {
  name: string;
  description: string;
  systemPrompt: string;
}

export interface Correction {
  reason: string;
  /** Address of who made it, and their name when they gave one. */
  user: string;
  userName: string;
  at: string;
}

/** What a prompt is made of, as its form sends it. */
export interface PromptContent {
  name: string;
  description: string;
  systemPrompt: string;
}

export const readPrompts = (): Promise<Prompt[]> => api<Prompt[]>('GET', '/prompts');
export const readPromptTemplates = (): Promise<PromptTemplate[]> => api<PromptTemplate[]>('GET', '/prompts/templates');
/** What members changed in the proposals written with this prompt, and why. */
export const readCorrections = (promptId: number): Promise<Correction[]> => api<Correction[]>('GET', `/prompts/${promptId}/corrections`);
export const createPrompt = (prompt: PromptContent): Promise<unknown> => api('POST', '/prompts', prompt);
export const addReadyMadePrompt = (template: PromptTemplate): Promise<unknown> => api('POST', '/prompts', template);
export const editPrompt = (id: number, prompt: PromptContent): Promise<unknown> => api('PUT', `/prompts/${id}`, prompt);
export const deletePrompt = (id: number): Promise<unknown> => api('DELETE', `/prompts/${id}`);
