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

/** The colours a value can be shown in. Grey is the one a value has until it is given another. */
export const VALUE_COLORS = ['grey', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
export type ValueColor = (typeof VALUE_COLORS)[number];

export interface AttributeValue {
  key: string;
  label: string;
  /** The colour it is shown in; a member has none. */
  color?: ValueColor;
}

/** A value of a choice as an administrator gives it. */
export interface ValueGiven {
  label: string;
  color: ValueColor;
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
  values: ValueGiven[];
  decidedBy: Decider;
  elo: string;
}

/** The value an email has for an attribute, and who decided it: a rule, the AI, or a member by hand. */
export interface ValueOfEmail {
  value: string;
  source: 'rule' | 'ai' | 'user';
  /** Why, when the rule that decided it said. */
  reason?: string;
}

/** What trying a rule on recent emails gives: for each, the value it would get (by its key) and the one it has now. */
export interface RuleTried {
  subject: string;
  from: string;
  value: string | null;
  now: ValueOfEmail | null;
}

/** What is wrong in a rule, and where: so that it is shown on the word it is about. */
export interface RuleProblem {
  line: number;
  column: number;
  /** How many characters it is about, from there. */
  length: number;
  message: string;
  /** The field that was probably meant, when the rule names one an email does not have. */
  suggestion: string | null;
}

/** What applying a rule again to the emails already kept did. */
export interface SortedAgain {
  examined: number;
  changed: number;
}

/**
 * The email as a rule is given it (`_`), as an Elo type. The type checker reads it, so that a
 * rule naming a field an email does not have is refused when it is saved; the page shows it,
 * so that who writes a rule knows what there is.
 */
export const EMAIL_FOR_RULES = `{
  from: { name: String, address: String },
  to: [{ name: String, address: String }],
  cc: [{ name: String, address: String }],
  subject: String,
  text: String,
  attachments: [{ name: String, type: String, size: Int }],
  date: String,
  mailbox: String,
  answered: Bool,
  headers: { listUnsubscribe: String, listId: String, autoSubmitted: String, precedence: String }
}`;

/** The same, field by field, for who writes a rule: what there is to read, and its type. */
export const EMAIL_FIELDS = [
  { path: '_.from.address', type: 'String' },
  { path: '_.from.name', type: 'String' },
  { path: '_.to', type: '[{ name, address }]' },
  { path: '_.cc', type: '[{ name, address }]' },
  { path: '_.subject', type: 'String' },
  { path: '_.text', type: 'String' },
  { path: '_.attachments', type: '[{ name, type, size }]' },
  { path: '_.date', type: 'String' },
  { path: '_.mailbox', type: 'String' },
  { path: '_.answered', type: 'Bool' },
  { path: '_.headers.listUnsubscribe', type: 'String' },
  { path: '_.headers.listId', type: 'String' },
  { path: '_.headers.autoSubmitted', type: 'String' },
  { path: '_.headers.precedence', type: 'String' },
] as const;
export type EmailFieldPath = (typeof EMAIL_FIELDS)[number]['path'];
