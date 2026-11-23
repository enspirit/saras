// CreateAttribute — an administrator gives the organisation's emails one more attribute: a
// choice among values they define, or a member of the organisation.
//
//   DomPre   (none)
//   DomPost  the organisation has one more attribute, with this name, these values and this way of being decided
//   ReqPre   the member is an administrator
//            it has a name; a choice has at least two values
//            decided by a rule, it has one, which Elo can read
//            it is not left to the AI, which does not decide those yet
//   ReqPost  emails fetched from now on get its value from its rule; those already kept have none
import type { Attribute } from '../../../shared/attribute.ts';
import { isAdministrator } from '../computations/access.ts';
import { attributeGiven } from '../computations/attributes.ts';
import { accepted } from '../refusal.ts';
import { addAttribute, attributeOf } from '../state/attributes.ts';
import type { Actor, World } from '../world.ts';
import { isDecidable, isNotLeftToTheAi } from './attribute-rules.ts';

export async function createAttribute({ db }: World, actor: Actor, given: Record<string, unknown>): Promise<Attribute> {
  accepted(isAdministrator(actor));
  const attribute = accepted(attributeGiven(given));
  isNotLeftToTheAi(attribute);
  isDecidable(attribute);
  return attributeOf(db, actor.organization, await addAttribute(db, actor.organization.id, attribute));
}
