// Observation: the attributes of an organisation, and what a rule would say of recent emails.
import { EMAIL_FOR_RULES } from '../../../shared/attribute.ts';
import type { AttributeValue, RuleTried } from '../../../shared/attribute.ts';
import type { Db } from '../../tooling/db.ts';
import { EloError, compileRule } from '../../tooling/elo.ts';
import { decidedFrom, keptEmailForRules } from '../computations/attributes.ts';
import type { EmailRow } from '../model/email.ts';
import { Refusal } from '../refusal.ts';
import { attributesOf } from '../state/attributes.ts';
import { mayUse } from '../state/mailboxes.ts';
import type { Actor } from '../world.ts';

type Recent = EmailRow & { mailbox: string };

/** The member's twenty most recent emails, as rules see them. */
const recentEmails = (db: Db, { member, organization }: Actor): Promise<Recent[]> =>
  db.query<Recent>(`SELECT e.*, a.email AS mailbox FROM emails e JOIN accounts a ON a.id = e.account_id WHERE ${mayUse('$1', '$2')} ORDER BY e.date DESC LIMIT 20`, [organization.id, member.id]);

/** The values a rule may give: those of the attribute named, or the labels being typed for a new one. */
async function valuesFor(db: Db, actor: Actor, given: { key?: unknown; values?: unknown }): Promise<AttributeValue[]> {
  const kept = (await attributesOf(db, actor.organization)).find((a) => a.key === String(given.key ?? ''));
  if (kept && (kept.system || kept.kind === 'member')) return kept.values;
  return (Array.isArray(given.values) ? given.values : []).map((label, index) => ({ key: String(index + 1), label: String(label) }));
}

/** What a rule would say of the member's recent emails, without changing any: so that a rule is seen at work before it is kept. */
export async function tryRule(db: Db, actor: Actor, given: { elo?: unknown; key?: unknown; values?: unknown }): Promise<RuleTried[]> {
  const values = await valuesFor(db, actor, given);
  try {
    const rule = compileRule(String(given.elo ?? ''), EMAIL_FOR_RULES);
    return (await recentEmails(db, actor)).map((row) => {
      const decided = decidedFrom(rule.run(keptEmailForRules(row, row.mailbox)), values);
      return { subject: row.subject, from: row.from_name || row.from_addr, value: decided ? (values.find((v) => v.key === decided.value)?.label ?? null) : null };
    });
  } catch (e) {
    if (!(e instanceof EloError)) throw e;
    throw new Refusal('invalid', 'attributes.ruleInvalid', { detail: e.message });
  }
}
