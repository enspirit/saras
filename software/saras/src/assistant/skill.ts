// The assistant: what saras has a language model do that is not writing a reply. It is a
// subsystem of its own: it knows what to tell a model and how to read what comes back, and
// nothing of the organisation, the database, HTTP, or which model answers. Whoever uses it
// gives it the means: a way to ask, and a say on what is read.

/** One turn of a conversation with a model. */
export interface Turn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Asks a model: what is said goes, its text comes back. With which key, which model and under which guarantees is the business of who gives it. */
export type Ask = (said: Turn[]) => Promise<string>;

/** An answer that was read, or what a model must be told is wrong in it. */
export type Read<Answer> = { ok: true; answer: Answer } | { ok: false; objections: string[] };

export const read = <Answer>(answer: Answer): Read<Answer> => ({ ok: true, answer });
export const objecting = (...objections: string[]): Read<never> => ({ ok: false, objections });

/**
 * A skill: one thing the assistant knows how to have a model do. It is pure: from what is
 * asked, what to say; from the text that comes back, what it means.
 */
export interface Skill<Asked, Answer> {
  name: string;
  /** What the model is told, and asked. */
  brief(asked: Asked): Turn[];
  /** What its answer says, or what is wrong in how it is written. */
  read(text: string, asked: Asked): Read<Answer>;
}

/** What whoever uses a skill gives it. */
export interface Means<Answer> {
  ask: Ask;
  /** What they object to in an answer that reads well, in words a model can act on; nothing when it will do. */
  check?: (answer: Answer) => string[] | Promise<string[]>;
}
