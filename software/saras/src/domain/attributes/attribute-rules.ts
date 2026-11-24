// What CreateAttribute and EditAttribute both require of how an attribute is decided.
import { EMAIL_FOR_RULES } from '../../../shared/attribute.ts';
import type { AttributeGiven } from '../../../shared/attribute.ts';
import { EloError, compileRule } from '../../tooling/elo.ts';
import { decidedByRule, hasItsRule } from '../computations/attributes.ts';
import { Refusal, accepted } from '../refusal.ts';

/** ReqPre: a rule that Elo can read. */
export function ruleReads(elo: string): void {
  try {
    compileRule(elo, EMAIL_FOR_RULES);
  } catch (e) {
    if (!(e instanceof EloError)) throw e;
    throw new Refusal('invalid', 'attributes.ruleInvalid', { detail: e.message });
  }
}

/** ReqPre: decided by a rule, it has one, and the rule can be read. */
export function isDecidable({ decidedBy, elo }: Pick<AttributeGiven, 'decidedBy' | 'elo'>): void {
  accepted(hasItsRule({ decidedBy, elo }));
  if (decidedByRule(decidedBy)) ruleReads(elo);
}
