// An attribute of an email: something an organisation wants to know about each one, to
// organise itself — where it stands, how urgent it is, who takes care of it, what it is about.

/** A list of values the organisation defines, or one of its members. */
export const ATTRIBUTE_KINDS = ['choice', 'member'] as const;
export type AttributeKind = (typeof ATTRIBUTE_KINDS)[number];

/**
 * Who decides the value when an email is sorted:
 *   nobody   no one: members set it by hand
 *   elo      a rule written in Elo, which costs nothing
 *   ai       the AI, from an instruction
 *   eloAi    the rule first, the AI where the rule says nothing
 */
export const DECIDERS = ['nobody', 'elo', 'ai', 'eloAi'] as const;
export type Decider = (typeof DECIDERS)[number];

/** The two attributes every organisation starts with, which the application itself relies on. */
export const STATUS = 'status';
export const PRIORITY = 'priority';

export interface AttributeValue {
  key: string;
  label: string;
}

export interface Attribute {
  /** What boards and emails name it by: `status`, `priority`, or a number for one the organisation made. */
  key: string;
  name: string;
  kind: AttributeKind;
  /** The values of a choice; empty for a member. */
  values: AttributeValue[];
  decidedBy: Decider;
  /** The rule, in Elo: given the email as `_`, the key of a value, or null to say nothing. */
  elo: string;
  /** Pre-configured: its values are fixed and it cannot be deleted; how it is decided can be changed. */
  system: boolean;
}

/** What an administrator gives to make or change an attribute. */
export interface AttributeGiven {
  name: string;
  kind: AttributeKind;
  values: string[];
  decidedBy: Decider;
  elo: string;
}

/** The value an email has for an attribute, and who decided it: a rule, the AI, or a member by hand. */
export interface ValueOfEmail {
  value: string;
  source: 'rule' | 'ai' | 'user';
}

/** What trying a rule on recent emails gives: for each, the value it would get. */
export interface RuleTried {
  subject: string;
  from: string;
  value: string | null;
}
