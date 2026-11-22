// RenameOrganization — an administrator changes the name of the organisation.
//
//   DomPre   (none)
//   DomPost  the organisation has this name
//   ReqPre   the member is an administrator
//   ReqPost  an empty name changes nothing
import { isAdministrator } from '../computations/access.ts';
import { clipped } from '../computations/given.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

export async function renameOrganization({ db }: World, actor: Actor, value: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const name = clipped(value, 120);
  if (name) await db.run('UPDATE organizations SET name = $1 WHERE id = $2', [name, actor.organization.id]);
}
