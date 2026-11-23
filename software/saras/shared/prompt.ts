// A prompt: a way of replying, shared by the members of an organisation and maintained by its administrators.

/** A prompt as every member sees it; administrators also get the instructions and how it is used. */
export interface Prompt {
  id: number;
  name: string;
  /** When to use it: what members read to choose, and the AI to suggest. */
  description: string;
  systemPrompt?: string;
  /** How many replies it wrote, and how many of those the member edited. */
  used?: number;
  edited?: number;
}

/** A ready-made prompt the organisation does not have yet. */
export interface ReadyMadePrompt {
  name: string;
  description: string;
  systemPrompt: string;
}

/** Why a member changed a proposal written with a prompt. */
export interface Correction {
  reason: string;
  /** Address of who made it, and their name when they gave one. */
  user: string;
  userName: string;
  at: string;
}
