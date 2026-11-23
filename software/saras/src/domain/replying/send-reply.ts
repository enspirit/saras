// SendReply — a member sends their reply from the mailbox the email arrived in.
//
//   DomPre   an email not replied, with no reply to it on its way
//   DomPost  the email is replied: the reply left from the mailbox
//   ReqPre   the member may use the email's mailbox
//            the reply is not empty
//            it has at least one recipient
//            every recipient is an address
//            the member confirmed (asked by the interface, not checked here)
//   ReqPost  the reply quotes the original and is attached to its thread (the mailbox's doing)
//            whether the proposal was edited is recorded, with who replied
//            the reason for the change is kept only if the proposal was edited
import type { Actor, World } from '../world.ts';
import { handOver } from './hand-over.ts';
import type { ReplyRequest } from './hand-over.ts';

export const sendReply = (world: World, actor: Actor, request: ReplyRequest): Promise<{ wasEdited: boolean }> => handOver(world, actor, request, 'sent');
