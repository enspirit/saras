// MoveBackToHandle — a member puts an email back among those to handle.
//
//   DomPre   an email not replied
//   DomPost  the email is to handle
//   ReqPre   the member may use the email's mailbox
//   ReqPost  the verdict is recorded as the member's
import type { Actor, World } from '../world.ts';
import { correctSorting } from './correct-sorting.ts';

export const moveBackToHandle = (world: World, actor: Actor, emailId: unknown): Promise<void> => correctSorting(world, actor, emailId, 'needs_reply');
