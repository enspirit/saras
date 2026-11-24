// EditAttribute — an administrator changes an attribute. Of the pre-configured one ("Stands in")
// only how it is decided and the colours of its values change: its name and its values are
// fixed, because the application relies on them.
//
//   DomPre   an attribute of the organisation
//   DomPost  it is decided this way; one of the organisation's own also has this name and these values;
//            the pre-configured one has its values in the colours given, each at its place
//   ReqPre   the member is an administrator
//            it is decided in a way we know: by a rule, or by nobody
//            decided by a rule, it has one, which Elo can read
//            one of the organisation's own: a name, two values for a choice
//   ReqPost  "Stands in": whether its rule decides it is the organisation's setting (automated mail set aside first)
//            the pre-configured one, given no colour for a value or none we know, keeps the one it has
//            emails already kept stay as they were sorted
import { STATUS } from '../../../shared/attribute.ts';
import type { Attribute } from '../../../shared/attribute.ts';
import { isAdministrator } from '../computations/access.ts';
import { attributeGiven, decidedByRule, deciderGiven, recolored } from '../computations/attributes.ts';
import { clipped } from '../computations/given.ts';
import { accepted } from '../refusal.ts';
import { attributeOf, changeAttribute, keepSystemAttribute } from '../state/attributes.ts';
import type { Actor, World } from '../world.ts';
import { isDecidable } from './attribute-rules.ts';

/** How the pre-configured attribute is decided and the colours of its values: nothing else of it. */
async function editSystem({ db }: World, { organization }: Actor, { key, values }: Attribute, given: Record<string, unknown>): Promise<void> {
  const decidedBy = accepted(deciderGiven(given.decidedBy));
  const elo = clipped(given.elo, 4000);
  isDecidable({ decidedBy, elo });
  await keepSystemAttribute(db, organization.id, { key, decidedBy, elo, values: recolored(values, given.values) });
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
  await (kept.system ? editSystem(world, actor, kept, given) : editMade(world, actor, kept.key, given));
  return attributeOf(world.db, actor.organization, kept.key);
}
