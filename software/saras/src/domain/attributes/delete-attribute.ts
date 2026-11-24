// DeleteAttribute — an administrator removes one of the organisation's own attributes: one it
// made, or the priority it started with.
//
//   DomPre   an attribute of the organisation's own
//   DomPost  it is gone
//   ReqPre   the member is an administrator
//            not the pre-configured attribute, "Stands in"
//   ReqPost  boards that filtered on it no longer do
import { isAdministrator } from '../computations/access.ts';
import { Refusal, accepted } from '../refusal.ts';
import { attributeOf, forgetAttribute } from '../state/attributes.ts';
import type { Actor, World } from '../world.ts';

export async function deleteAttribute({ db }: World, actor: Actor, key: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const attribute = await attributeOf(db, actor.organization, key);
  if (attribute.system) throw new Refusal('conflict', 'attributes.systemFixed');
  await forgetAttribute(db, actor.organization.id, attribute.key);
}
