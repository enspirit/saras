// FileProposalAsDraft — the backend files a proposal it just prepared in the Drafts folder
// of the mailbox, for its owner to finish and send from their mail client.
//
//   DomPre   an email to handle, with a proposal just prepared
//   DomPost  the email is replied, as a draft, by the mailbox's owner
//   ReqPre   the email has someone to reply to
//   ReqPost  nothing is sent
//            recorded as not edited: the draft is the proposal
import { replyRecipients } from '../computations/reply.ts';
import { htmlToText } from '../../tooling/text.ts';
import type { AccountRow, Email, UserRow } from '../../types.ts';
import { recordReply } from '../state/proposals.ts';
import type { World } from '../world.ts';
import type { Proposal } from './proposal.ts';

export async function fileProposalAsDraft({ db, mail }: World, mailbox: AccountRow, owner: UserRow, email: Email, proposal: Proposal): Promise<void> {
  const { to, cc } = replyRecipients(email, mailbox.email, false);
  if (!to.length) return;
  await mail.providerFor(mailbox).saveDraft({ email, to, cc, html: proposal.html, language: owner.language });
  const text = htmlToText(proposal.html);
  await recordReply(db, { emailId: email.id, memberId: owner.id, promptId: proposal.promptId, proposedText: text, text, html: proposal.html, edited: false, reason: '', mode: 'draft', to, cc }, 'needs_reply');
}
