// SetOwnName — a member says how the other members should see them.
//
//   DomPre   (none)
//   DomPost  the member's name is this one
import { clipped } from '../computations/given.ts';
import type { Actor, World } from '../world.ts';

export const setOwnName = async ({ db }: World, { member }: Actor, value: unknown): Promise<void> =>
  void (await db.run('UPDATE users SET name = $1 WHERE id = $2', [clipped(value, 120), member.id]));
