// MarkNoReplyNeeded — a member says that an email needs no reply.
//
//   DomPre   an email not replied
//   DomPost  the email needs no reply
//   ReqPre   the member may use the email's mailbox
//   ReqPost  the verdict is recorded as the member's
import type { Actor, World } from '../world.ts';
import { correctSorting } from './correct-sorting.ts';

export const markNoReplyNeeded = (world: World, actor: Actor, emailId: unknown): Promise<void> => correctSorting(world, actor, emailId, 'no_reply');
