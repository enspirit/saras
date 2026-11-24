// EditAttribute — an administrator changes an attribute. Of the two pre-configured ones
// ("Stands in", "Priority") only how they are decided changes: their values are fixed,
// because the application relies on them.
//
//   DomPre   an attribute of the organisation
//   DomPost  it is decided this way; one the organisation made also has this name and these values
//   ReqPre   the member is an administrator
//            it is decided in a way we know: by a rule, or by nobody
//            decided by a rule, it has one, which Elo can read
//            one the organisation made: a name, two values for a choice
//   ReqPost  "Stands in": whether its rule decides it is the organisation's setting (automated mail set aside first)
//            emails already kept stay as they were sorted
import { STATUS } from '../../../shared/attribute.ts';
import type { Attribute } from '../../../shared/attribute.ts';
import { isAdministrator } from '../computations/access.ts';
import { attributeGiven, decidedByRule, deciderGiven } from '../computations/attributes.ts';
import { clipped } from '../computations/given.ts';
import { accepted } from '../refusal.ts';
import { attributeOf, changeAttribute, keepSystemAttribute } from '../state/attributes.ts';
import type { Actor, World } from '../world.ts';
import { isDecidable } from './attribute-rules.ts';

/** How a pre-configured attribute is decided, and nothing else of it. */
async function editSystem({ db }: World, { organization }: Actor, key: string, given: Record<string, unknown>): Promise<void> {
  const decidedBy = accepted(deciderGiven(given.decidedBy));
  const elo = clipped(given.elo, 4000);
  isDecidable({ decidedBy, elo });
  await keepSystemAttribute(db, organization.id, key, decidedBy, elo);
  if (key !== STATUS) return;
  await db.run('UPDATE organizations SET skip_automated = $1 WHERE id = $2', [decidedByRule(decidedBy), organization.id]);
  Object.assign(organization, { skip_automated: decidedByRule(decidedBy) });
}

async function editMade({ db }: World, { organization }: Actor, key: string, given: Record<string, unknown>): Promise<void> {
  const attribute = accepted(attributeGiven(given));
  isDecidable(attribute);
  await changeAttribute(db, organization.id, key, attribute);
}

export async function editAttribute(world: World, actor: Actor, key: unknown, given: Record<string, unknown>): Promise<Attribute> {
  accepted(isAdministrator(actor));
  const kept = await attributeOf(world.db, actor.organization, key);
  await (kept.system ? editSystem(world, actor, kept.key, given) : editMade(world, actor, kept.key, given));
  return attributeOf(world.db, actor.organization, kept.key);
}
