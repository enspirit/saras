// EditAttribute — an administrator changes an attribute. Of the two pre-configured ones
// ("Stands in", "Priority") only how they are decided changes: their values are fixed,
// because the application relies on them.
//
//   DomPre   an attribute of the organisation
//   DomPost  it is decided this way; one the organisation made also has this name and these values
//   ReqPre   the member is an administrator
//            decided by a rule, it has one, which Elo can read
//            one the organisation made: a name, two values for a choice, and not left to the AI
//   ReqPost  "Stands in": whether its rule and the AI decide it are the organisation's two sorting settings
//            emails already kept stay as they were sorted
import { STATUS } from '../../../shared/attribute.ts';
import type { Attribute, Decider } from '../../../shared/attribute.ts';
import { isAdministrator } from '../computations/access.ts';
import { attributeGiven, decidedByAi, decidedByRule } from '../computations/attributes.ts';
import { clipped } from '../computations/given.ts';
import { accepted } from '../refusal.ts';
import { attributeOf, changeAttribute, keepSystemAttribute } from '../state/attributes.ts';
import type { Actor, World } from '../world.ts';
import { isDecidable, isNotLeftToTheAi } from './attribute-rules.ts';

const DECIDERS: Decider[] = ['nobody', 'elo', 'ai', 'eloAi'];

/** How a pre-configured attribute is decided, and nothing else of it. */
async function editSystem({ db }: World, { organization }: Actor, key: string, given: Record<string, unknown>): Promise<void> {
  const decidedBy = DECIDERS.find((d) => d === given.decidedBy) ?? 'nobody';
  const elo = clipped(given.elo, 4000);
  isDecidable({ decidedBy, elo });
  await keepSystemAttribute(db, organization.id, key, decidedBy, elo);
  if (key !== STATUS) return;
  await db.run('UPDATE organizations SET skip_automated = $1, triage_strategy = $2 WHERE id = $3', [decidedByRule(decidedBy), decidedByAi(decidedBy) ? 'ai' : 'none', organization.id]);
  Object.assign(organization, { skip_automated: decidedByRule(decidedBy), triage_strategy: decidedByAi(decidedBy) ? 'ai' : 'none' });
}

async function editMade({ db }: World, { organization }: Actor, key: string, given: Record<string, unknown>): Promise<void> {
  const attribute = accepted(attributeGiven(given));
  isNotLeftToTheAi(attribute);
  isDecidable(attribute);
  await changeAttribute(db, organization.id, key, attribute);
}

export async function editAttribute(world: World, actor: Actor, key: unknown, given: Record<string, unknown>): Promise<Attribute> {
  accepted(isAdministrator(actor));
  const kept = await attributeOf(world.db, actor.organization, key);
  await (kept.system ? editSystem(world, actor, kept.key, given) : editMade(world, actor, kept.key, given));
  return attributeOf(world.db, actor.organization, kept.key);
}
