// Pure: attributes of emails — what an attribute given is reduced to, what a rule sees of an
// email, and what its answer is taken as.
import { ATTRIBUTE_KINDS, DECIDERS, STATUS, VALUE_COLORS } from '../../../shared/attribute.ts';
import type { Attribute, AttributeGiven, AttributeKind, AttributeValue, Decider, ValueGiven, ValueOfEmail } from '../../../shared/attribute.ts';
import { MESSAGES, reasonCode } from '../../tooling/messages.ts';
import type { MessageCode } from '../../tooling/messages.ts';
import type { EmailRow, IncomingEmail } from '../model/email.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import { rowToEmail } from './emails.ts';
import { clipped } from './given.ts';

const oneOf = <T extends string>(known: readonly T[], value: unknown, otherwise: T): T => known.find((item) => item === value) ?? otherwise;

/** One value as it is given: its label alone, or its label and its colour. */
const valueGiven = (given: unknown): ValueGiven => {
  const { label, color } = given && typeof given === 'object' ? (given as { label?: unknown; color?: unknown }) : { label: given, color: undefined };
  return { label: clipped(label, 60), color: oneOf(VALUE_COLORS, color, 'grey') };
};

/** The values of a choice, each once: each keeps its place as its key. */
export function valuesGiven(value: unknown): ValueGiven[] {
  const seen = new Set<string>();
  const values = (Array.isArray(value) ? value : []).map(valueGiven).filter(({ label }) => label && !seen.has(label) && seen.add(label));
  return values.slice(0, 30);
}

/** A value a rule decided, as it is kept on the email: with why, when the rule said. */
export const ruleValue = ({ value, reason }: { value: string; reason: string }): ValueOfEmail => ({ value, source: 'rule', ...(reason ? { reason } : {}) });

/** ReqPre of CreateAttribute and EditAttribute: a way of deciding we know. Nobody, when none is given. */
export function deciderGiven(value: unknown): Verdict<Decider> {
  if (value === undefined || value === null) return accept('nobody');
  const decider = DECIDERS.find((known) => known === value);
  return decider ? accept(decider) : refuse('invalid', 'attributes.deciderUnknown');
}

/** ReqPre of CreateAttribute and EditAttribute: a name; for a choice, at least two values; a way of deciding we know. */
export function attributeGiven(given: Record<string, unknown>): Verdict<AttributeGiven> {
  const name = clipped(given.name, 60);
  const kind: AttributeKind = oneOf(ATTRIBUTE_KINDS, given.kind, 'choice');
  const values = kind === 'choice' ? valuesGiven(given.values) : [];
  const decidedBy = deciderGiven(given.decidedBy);
  if (!name) return refuse('invalid', 'attributes.nameRequired');
  if (kind === 'choice' && values.length < 2) return refuse('invalid', 'attributes.valuesRequired');
  if (!decidedBy.ok) return decidedBy;
  return accept({ name, kind, values, decidedBy: decidedBy.value, elo: clipped(given.elo, 4000) });
}

/** ReqPre of an attribute decided by a rule: there is one. */
export const hasItsRule = ({ decidedBy, elo }: Pick<AttributeGiven, 'decidedBy' | 'elo'>): Verdict<true> =>
  decidedByRule(decidedBy) && !elo ? refuse('invalid', 'attributes.ruleRequired') : accept(true);

/** Whether a rule has a say in an attribute. */
export const decidedByRule = (decidedBy: Decider): boolean => decidedBy === 'elo';

/** The email as a rule sees it: `_` in Elo. */
export const emailForRules = (email: IncomingEmail, mailboxAddress: string) => ({
  from: { name: email.fromName, address: email.fromAddr },
  to: email.to,
  cc: email.cc,
  subject: email.subject,
  text: email.bodyText,
  attachments: email.attachments,
  date: email.date,
  mailbox: mailboxAddress,
  answered: Boolean(email.answered),
  headers: { listUnsubscribe: '', listId: '', autoSubmitted: '', precedence: '', ...email.headers },
});
export type EmailForRules = ReturnType<typeof emailForRules>;

/** A kept email as a rule sees it: as when it was fetched, but for whether it was already answered, which is not kept. */
export const keptEmailForRules = (row: EmailRow, mailboxAddress: string): EmailForRules =>
  emailForRules({ ...rowToEmail(row), headers: JSON.parse(row.headers_json), answered: false }, mailboxAddress);

/** What a rule decided: a value of the attribute, and why when it said. */
export interface Decided {
  value: string;
  reason: string;
}

/** A reason that is one of the server's own messages is kept as its code, to be said in the reader's language. */
const reasonKept = (reason: unknown): string => (typeof reason === 'string' && reason in MESSAGES ? reasonCode(reason as MessageCode) : clipped(reason, 300));

/**
 * What a rule's answer is taken as. A rule gives the key or the label of a value, or
 * `{value, reason}`; anything else, null included, says nothing.
 */
export function decidedFrom(answer: unknown, values: AttributeValue[]): Decided | null {
  const given = answer && typeof answer === 'object' ? (answer as { value?: unknown; reason?: unknown }) : { value: answer };
  const wanted = String(given.value ?? '').trim().toLowerCase();
  const value = values.find((v) => v.key.toLowerCase() === wanted || v.label.toLowerCase() === wanted);
  return value ? { value: value.key, reason: reasonKept(given.reason) } : null;
}

/** The values of the pre-configured attribute: fixed, because the application relies on them. Their colours are what they start with. */
export const STATUS_VALUES: AttributeValue[] = [
  { key: 'todo', label: 'To handle', color: 'purple' },
  { key: 'none', label: 'No reply needed', color: 'grey' },
  { key: 'sent', label: 'Replied', color: 'green' },
  { key: 'ignored', label: 'Ignored', color: 'grey' },
];

export const isSystem = (key: string): boolean => key === STATUS;

/**
 * The values of the pre-configured attribute in the colours given for them. Each value keeps its
 * place, so the colour given at its place is its own; where none we know is given, it keeps the one it has.
 */
export const recolored = (values: AttributeValue[], given: unknown): AttributeValue[] =>
  values.map((value, place) => ({ ...value, color: oneOf(VALUE_COLORS, (Array.isArray(given) ? given[place] : undefined)?.color, value.color ?? 'grey') }));

/** The same from how the colours are kept: by the key of each value. */
export function inColorsKept(values: AttributeValue[], valuesJson: string | undefined): AttributeValue[] {
  const kept = JSON.parse(valuesJson || '[]') as { key?: string; color?: string }[];
  return recolored(values, values.map(({ key }) => kept.find((one) => one.key === key)));
}

/** An attribute as it is told, from how it is kept. */
export interface AttributeKept {
  key: string;
  name: string;
  kind: AttributeKind;
  values_json: string;
  decided_by: Decider;
  elo: string;
}
export const attributeTold = (kept: AttributeKept): Attribute => ({
  key: kept.key,
  name: kept.name,
  kind: kept.kind,
  values: JSON.parse(kept.values_json),
  decidedBy: kept.decided_by,
  elo: kept.elo,
  system: isSystem(kept.key),
});
