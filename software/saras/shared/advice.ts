// What an administrator asks the assistant, and what it answers: questions first when it needs
// to know more, then a proposal to read before anything is applied.
import type { Configuration } from './configuration.ts';

/** A question of the assistant, with a few answers to pick from when a few cover it. */
export interface Question {
  question: string;
  choices: string[];
}

/** A question as it was answered; an answer left empty says "as you see fit". */
export interface Answered {
  question: string;
  answer: string;
}

/** What is told to have a configuration proposed: what the organisation does and how it handles its mail, and the answers to what was asked. */
export interface ConfigurationWanted {
  description: string;
  answers: Answered[];
}

/** The assistant needs to know more before it proposes. It asks once. */
export interface QuestionsAsked {
  kind: 'questions';
  questions: Question[];
}

/**
 * A configuration proposed: only what is new or would change, as `PUT /configuration` takes
 * it, and in a few words what it is for. Nothing is applied by proposing.
 */
export interface ConfigurationProposed {
  kind: 'proposal';
  summary: string;
  configuration: Configuration;
}

export type ConfigurationAdvice = QuestionsAsked | ConfigurationProposed;
