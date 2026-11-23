// SortAgainByRule — an administrator has the rule of an attribute applied to the emails
// already kept, after writing or changing it.
//
//   DomPre   an attribute decided by a rule, and the emails the organisation keeps
//   DomPost  each email has, for that attribute, what the rule says of it now
//   ReqPre   the member is an administrator
//            the attribute is decided by a rule, which Elo can read
//   ReqPost  a value a member set by hand is left as it is
//            a value the rule had given goes where the rule no longer speaks
//            "Stands in": emails replied, placed by a member, or fetched before their headers
//            were kept are left where they stand; one the rule no longer places waits to be sorted
//   ReqTrig  for "Stands in": the mailboxes are fetched at once, so that what waits is sorted
import { EMAIL_FOR_RULES } from '../../../shared/attribute.ts';
import { STATUS } from '../../../shared/attribute.ts';
import type { Attribute, SortedAgain } from '../../../shared/attribute.ts';
import { EloError, compileRule } from '../../tooling/elo.ts';
import type { Rule } from '../../tooling/elo.ts';
import { isAdministrator } from '../computations/access.ts';
import { decidedByRule, decidedFrom, keptEmailForRules } from '../computations/attributes.ts';
import type { Decided } from '../computations/attributes.ts';
import { standsAgain, valueAgain } from '../computations/sorting-again.ts';
import { ruleReads } from '../attributes/attribute-rules.ts';
import { Refusal, accepted } from '../refusal.ts';
import { attributeOf } from '../state/attributes.ts';
import { emailsKeptBy, keepStanding, keepValues } from '../state/emails.ts';
import type { KeptEmail } from '../state/emails.ts';
import { watchedMailboxesOf } from '../state/mailboxes.ts';
import type { Actor, World } from '../world.ts';

/** What the rule says of a kept email; nothing when it fails on it. */
function said(rule: Rule, attribute: Attribute, email: KeptEmail): Decided | null {
  try {
    return decidedFrom(rule.run(keptEmailForRules(email, email.mailbox)), attribute.values);
  } catch (e) {
    if (!(e instanceof EloError)) throw e;
    return null;
  }
}

const sortingOf = (email: KeptEmail) => ({ status: email.status, source: email.triage_source, hasHeaders: email.headers_json !== '{}', attributes: JSON.parse(email.attributes_json) });

/** Applies the rule to one email; tells whether anything changed. */
async function sortAgain({ db }: World, attribute: Attribute, rule: Rule, email: KeptEmail): Promise<boolean> {
  const decided = said(rule, attribute, email);
  if (attribute.key === STATUS) {
    const stands = standsAgain(sortingOf(email), decided);
    if (stands) await keepStanding(db, email.id, stands);
    return Boolean(stands);
  }
  const values = valueAgain(attribute.key, sortingOf(email), decided);
  if (values) await keepValues(db, email.id, values);
  return Boolean(values);
}

export async function sortAgainByRule(world: World, actor: Actor, key: unknown): Promise<SortedAgain> {
  accepted(isAdministrator(actor));
  const attribute = await attributeOf(world.db, actor.organization, key);
  if (!decidedByRule(attribute.decidedBy) || !attribute.elo) throw new Refusal('invalid', 'attributes.ruleRequired');
  ruleReads(attribute.elo);
  const rule = compileRule(attribute.elo, EMAIL_FOR_RULES);
  const emails = await emailsKeptBy(world.db, actor.organization.id);
  let changed = 0;
  for (const email of emails) if (await sortAgain(world, attribute, rule, email)) changed += 1;
  if (attribute.key === STATUS && changed) for (const mailbox of await watchedMailboxesOf(world.db, actor.organization.id)) world.fetching.inBackground(mailbox);
  return { examined: emails.length, changed };
}
