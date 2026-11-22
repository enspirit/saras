// IgnoreEmail — a member sets an email aside for good.
//
//   DomPre   an email not replied
//   DomPost  the email is ignored
//   ReqPre   the member may use the email's mailbox
//   ReqPost  the verdict is recorded as the member's
import type { Actor, World } from '../world.ts';
import { correctSorting } from './correct-sorting.ts';

export const ignoreEmail = (world: World, actor: Actor, emailId: unknown): Promise<void> => correctSorting(world, actor, emailId, 'ignored');
