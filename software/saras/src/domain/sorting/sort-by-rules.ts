// SortByRules — when an email is fetched, the rules of the organisation's attributes say what
// they can of it, at no cost: where it stands, its priority, and the attributes the organisation made.
//
//   DomPre   an email just fetched
//   DomPost  for each attribute decided by a rule that speaks of this email: the email has that value, as the rule's
//   ReqPost  a rule that says nothing, fails or takes too long leaves the attribute undecided
//            "Stands in" undecided, the email is to handle, and nobody decided so
//            a rule cannot mark an email as replied
import { EMAIL_FOR_RULES } from '../../../shared/attribute.ts';
import { PRIORITY, STATUS } from '../../../shared/attribute.ts';
import type { Attribute, ValueOfEmail } from '../../../shared/attribute.ts';
import type { EmailStatus, Priority } from '../../../shared/email.ts';
import { EloError, compileRule } from '../../tooling/elo.ts';
import type { Rule } from '../../tooling/elo.ts';
import { decidedByRule, decidedFrom, emailForRules, ruleValue } from '../computations/attributes.ts';
import type { Decided } from '../computations/attributes.ts';
import type { Standing } from '../computations/emails.ts';
import type { IncomingEmail } from '../model/email.ts';

/** An attribute with its rule, ready to run. */
export interface Ruled {
  attribute: Attribute;
  rule: Rule;
}

/** The attributes a rule decides, each rule compiled once for the whole fetch. One that does not compile is left out. */
export const ruled = (attributes: Attribute[]): Ruled[] =>
  attributes.filter((attribute) => decidedByRule(attribute.decidedBy) && attribute.elo).flatMap((attribute) => {
    try {
      return [{ attribute, rule: compileRule(attribute.elo, EMAIL_FOR_RULES) }];
    } catch {
      return [];
    }
  });

/** What one rule says of an email; nothing when it fails. */
function said({ attribute, rule }: Ruled, input: unknown): Decided | null {
  try {
    return decidedFrom(rule.run(input), attribute.values);
  } catch (e) {
    if (!(e instanceof EloError)) throw e;
    return null;
  }
}

/** Where a rule may put an email: it cannot mark it as replied. */
const STATUS_OF: Record<string, EmailStatus> = { todo: 'needs_reply', none: 'no_reply', ignored: 'ignored' };

/** Where a fetched email first stands, its priority, and its other attributes, as the rules say. */
export function sortByRules(rules: Ruled[], email: IncomingEmail, mailboxAddress: string): Standing {
  const input = emailForRules(email, mailboxAddress);
  const decided = new Map(rules.map((r) => [r.attribute.key, said(r, input)] as const).filter(([, d]) => d !== null)) as Map<string, Decided>;
  const stands = STATUS_OF[decided.get(STATUS)?.value ?? ''];
  const attributes: Record<string, ValueOfEmail> = {};
  for (const [key, said] of decided) if (key !== STATUS) attributes[key] = ruleValue(said);
  return {
    status: stands ?? 'needs_reply',
    source: stands ? 'rule' : 'none',
    reason: stands ? decided.get(STATUS)!.reason : '',
    priority: (decided.get(PRIORITY)?.value as Priority | undefined) ?? 'normal',
    attributes,
  };
}
