// SetOrganizationKey, RemoveOrganizationKey — an administrator gives the organisation its own
// key for the AI, or takes it back.
//
//   DomPre   (none)
//   DomPost  the organisation has this key; with an empty one, none: the server's then applies
//   ReqPre   the member is an administrator
//   ReqPost  the key is kept sealed
import { isAdministrator } from '../computations/access.ts';
import { clipped } from '../computations/given.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

export async function setOrganizationKey({ db, vault }: World, actor: Actor, value: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const key = clipped(value, 500);
  await db.run('UPDATE organizations SET openrouter_key_enc = $1 WHERE id = $2', [key ? vault.seal(key) : null, actor.organization.id]);
}
