// FileReplyAsDraft — a member files their reply in the Drafts folder of the mailbox, to
// finish and send it from their mail client.
//
//   DomPre   an email not replied, with no reply to it on its way
//   DomPost  the email is replied, as a draft: the reply is in the mailbox's Drafts folder
//   ReqPre   the member may use the email's mailbox
//            the reply is not empty
//            it has at least one recipient
//            every recipient is an address
//   ReqPost  nothing is sent
//            whether the proposal was edited is recorded, with who filed it
//            the reason for the change is kept only if the proposal was edited
import type { Actor, World } from '../world.ts';
import { handOver } from './hand-over.ts';
import type { ReplyRequest } from './hand-over.ts';

export const fileReplyAsDraft = (world: World, actor: Actor, request: ReplyRequest): Promise<{ wasEdited: boolean }> => handOver(world, actor, request, 'draft');
