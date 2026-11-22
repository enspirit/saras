// SetOwnKey, RemoveOwnKey — a member gives their own key for the AI, or takes it back.
//
//   DomPre   (none)
//   DomPost  the member has this key; with an empty one, none: the organisation's then applies
//   ReqPost  the key is kept sealed
import { clipped } from '../computations/given.ts';
import type { Actor, World } from '../world.ts';

export async function setOwnKey({ db, vault }: World, { member }: Actor, value: unknown): Promise<void> {
  const key = clipped(value, 500);
  await db.run('UPDATE users SET openrouter_key_enc = $1 WHERE id = $2', [key ? vault.seal(key) : null, member.id]);
}
