// SetSignature — a member gives the signature their proposals end with.
//
//   DomPre   (none)
//   DomPost  the member's signature is this one
import { clipped } from '../computations/given.ts';
import type { Actor, World } from '../world.ts';

export const setSignature = async ({ db }: World, { member }: Actor, value: unknown): Promise<void> =>
  void (await db.run('UPDATE users SET signature = $1 WHERE id = $2', [clipped(value, 2000), member.id]));
