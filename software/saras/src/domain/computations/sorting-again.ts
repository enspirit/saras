// Pure: what applying a rule again changes for an email already kept. A rule never undoes
// what a member decided, nor what it cannot judge.
import type { ValueOfEmail } from '../../../shared/attribute.ts';
import { PRIORITY } from '../../../shared/attribute.ts';
import type { EmailStatus, Priority } from '../../../shared/email.ts';
import { ruleValue } from './attributes.ts';
import type { Decided } from './attributes.ts';

/** What is kept of an email that sorting again looks at. */
export interface KeptSorting {
  status: EmailStatus;
  /** Who decided where it stands: 'rule', 'user', a strategy's name, or nobody yet. */
  source: string | null;
  /** The headers a rule on where an email stands needs; emails fetched before they were kept have none. */
  hasHeaders: boolean;
  attributes: Record<string, ValueOfEmail>;
}

/** Where a rule may put an email: it cannot mark it as replied. */
const STATUS_OF: Record<string, EmailStatus> = { todo: 'needs_reply', none: 'no_reply', ignored: 'ignored' };

export interface StatusAgain {
  status: EmailStatus;
  source: string | null;
  reason: string;
}

/**
 * Where an email stands once its rule is applied again, or null when nothing changes.
 * Left as it is: an email replied, one a member placed, one whose headers were not kept.
 * A rule that no longer speaks of an email it had placed sends it back to be sorted.
 */
export function standsAgain(kept: KeptSorting, decided: Decided | null): StatusAgain | null {
  if (kept.status === 'sent' || kept.source === 'user' || !kept.hasHeaders) return null;
  const status = STATUS_OF[decided?.value ?? ''];
  if (!status) return kept.source === 'rule' ? { status: 'pending', source: null, reason: '' } : null;
  return kept.status === status && kept.source === 'rule' ? null : { status, source: 'rule', reason: decided!.reason };
}

export interface ValueAgain {
  attributes: Record<string, ValueOfEmail>;
  /** Set when the attribute is the priority, which is also kept where the lists read it. */
  priority?: Priority;
}

/** The priority an email has once its values are these: normal when it has none. */
const priorityOf = (key: string, value: string | undefined): Pick<ValueAgain, 'priority'> => (key === PRIORITY ? { priority: (value as Priority | undefined) ?? 'normal' } : {});

/**
 * The values of an email once the rule of an attribute is applied again, or null when nothing
 * changes. A value set by hand stays; a value the rule had given goes when the rule no longer speaks.
 */
export function valueAgain(key: string, kept: KeptSorting, decided: Decided | null): ValueAgain | null {
  const current = kept.attributes[key];
  if (current?.source === 'user') return null;
  if (decided) {
    if (current?.source === 'rule' && current.value === decided.value) return null;
    return { attributes: { ...kept.attributes, [key]: ruleValue(decided) }, ...priorityOf(key, decided.value) };
  }
  if (current?.source !== 'rule') return null;
  const { [key]: _gone, ...left } = kept.attributes;
  return { attributes: left, ...priorityOf(key, undefined) };
}
