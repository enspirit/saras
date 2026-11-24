// Observation: the attributes of an organisation, and what a rule would say of recent emails.
import { EMAIL_FOR_RULES } from '../../../shared/attribute.ts';
import { PRIORITY, STATUS } from '../../../shared/attribute.ts';
import type { AttributeValue, RuleProblem, RuleTried, ValueOfEmail } from '../../../shared/attribute.ts';
import type { Db } from '../../tooling/db.ts';
import { EloError, compileRule, foundIn } from '../../tooling/elo.ts';
import { decidedFrom, keptEmailForRules, valuesGiven } from '../computations/attributes.ts';
import { problemTold } from '../computations/rule-problems.ts';
import type { EmailRow } from '../model/email.ts';
import { Refusal } from '../refusal.ts';
import { attributesOf } from '../state/attributes.ts';
import { mayUse } from '../state/mailboxes.ts';
import type { Actor } from '../world.ts';

type Recent = EmailRow & { mailbox: string };

/** The member's twenty most recent emails, as rules see them. */
const recentEmails = (db: Db, { member, organization }: Actor): Promise<Recent[]> =>
  db.query<Recent>(`SELECT e.*, a.email AS mailbox FROM emails e JOIN accounts a ON a.id = e.account_id WHERE ${mayUse('$1', '$2')} ORDER BY e.date DESC LIMIT 20`, [organization.id, member.id]);

/** The values a rule may give: those of the attribute named, or those being typed for a new one. */
async function valuesFor(db: Db, actor: Actor, given: { key?: unknown; values?: unknown }): Promise<AttributeValue[]> {
  const kept = (await attributesOf(db, actor.organization)).find((a) => a.key === String(given.key ?? ''));
  if (kept && (kept.system || kept.kind === 'member')) return kept.values;
  return valuesGiven(given.values).map(({ label }, index) => ({ key: String(index + 1), label }));
}

/** Where an email stands, as a value of "Stands in". */
const STANDS: Record<string, string> = { needs_reply: 'todo', no_reply: 'none', sent: 'sent', ignored: 'ignored' };
const sorter = (source: string | null): ValueOfEmail['source'] => (source === 'rule' || source === 'user' ? source : 'nobody');

/** The value an email has now for an attribute, and who decided it. */
function valueNow(row: Recent, key: string): ValueOfEmail | null {
  if (key === STATUS) return { value: STANDS[row.status] ?? 'todo', source: sorter(row.triage_source) };
  const kept = (JSON.parse(row.attributes_json) as Record<string, ValueOfEmail>)[key];
  return kept ?? (key === PRIORITY ? { value: row.priority, source: 'nobody' } : null);
}

/** What a rule would say of the member's recent emails, without changing any: so that a rule is seen at work before it is kept. */
export async function tryRule(db: Db, actor: Actor, given: { elo?: unknown; key?: unknown; values?: unknown }): Promise<RuleTried[]> {
  const values = await valuesFor(db, actor, given);
  try {
    const rule = compileRule(String(given.elo ?? ''), EMAIL_FOR_RULES);
    return (await recentEmails(db, actor)).map((row) => {
      const decided = decidedFrom(rule.run(keptEmailForRules(row, row.mailbox)), values);
      return { subject: row.subject, from: row.from_name || row.from_addr, value: decided?.value ?? null, now: valueNow(row, String(given.key ?? '')) };
    });
  } catch (e) {
    if (!(e instanceof EloError)) throw e;
    throw new Refusal('invalid', 'attributes.ruleInvalid', { detail: e.message });
  }
}

/** What is wrong in a rule as it is being written, each problem with its place; nothing when it fits the email. An empty rule has nothing wrong yet. */
export const checkRule = (given: { elo?: unknown }): RuleProblem[] => {
  const elo = String(given.elo ?? '').slice(0, 4000);
  return elo.trim() ? foundIn(elo, EMAIL_FOR_RULES).slice(0, 5).map(problemTold) : [];
};
