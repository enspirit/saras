// PrepareProposals — when the organisation asked for it, the backend writes a proposal for
// each email to handle that has none, without anyone asking.
//
//   DomPre   emails to handle, with content and no proposal
//   DomPost  each has a proposal
//   ReqPre   the organisation has proposals written at fetch
//            a key is in force, as the mailbox's owner
//            the organisation has a prompt
//   ReqPost  written with the prompt of the first shared board that shows the email, else the one
//            suggested at triage, else the organisation's first
//            as the mailbox's owner: their model, signature and past corrections
//            at most MAX_PREPARED per fetch, most recent first
//            when the organisation has them filed in the mailbox, each is then filed: FileProposalAsDraft
//   ReqTrig  part of every fetch, after sorting
import { errorMessage } from '../../tooling/errors.ts';
import { LlmError } from '../../tooling/llm/openrouter.ts';
import { buildPromptMessages } from '../computations/llm-prompts.ts';
import { llmSettings } from '../computations/key-in-force.ts';
import { problem } from '../../tooling/messages.ts';
import type { ServerProblem } from '../../tooling/messages.ts';
import { rowToEmail } from '../computations/emails.ts';
import type { AccountRow } from '../model/mailbox.ts';
import type { UserRow } from '../model/member.ts';
import type { OrganizationRow } from '../model/organization.ts';
import { promptToPrepareWith } from '../computations/replying.ts';
import { emailsAwaitingProposal } from '../state/emails.ts';
import { promptOfBoardShowing, sharedBoardsWithPrompt } from '../state/boards.ts';
import { lessonsFor, promptsOf } from '../state/prompts.ts';
import type { Reach } from '../world.ts';
import { fileProposalAsDraft } from './file-proposal-as-draft.ts';
import { writeProposal } from './proposal.ts';

/** A full folder is not drafted in one go. */
const MAX_PREPARED = 10;

/** Returns what went wrong, if anything: a fetch records it on the mailbox. */
export async function prepareProposals(world: Reach, mailbox: AccountRow, organization: OrganizationRow, owner: UserRow): Promise<ServerProblem | null> {
  const { db } = world;
  if (organization.automation === 'none') return null;
  const settings = llmSettings(organization, world);
  const prompts = await promptsOf(db, organization.id);
  if (!settings.apiKey || !prompts.length) return null;
  const boards = await sharedBoardsWithPrompt(db, organization.id);
  try {
    for (const row of await emailsAwaitingProposal(db, mailbox.id, MAX_PREPARED)) {
      const email = rowToEmail(row);
      const prompt = promptToPrepareWith(await promptOfBoardShowing(db, boards, row.id), row.suggested_prompt_id, prompts)!;
      const messages = buildPromptMessages({ email, prompt: { systemPrompt: prompt.system_prompt }, ownAddress: mailbox.email, signature: owner.signature, lessons: await lessonsFor(db, prompt.id, owner.id), html: '' });
      const proposal = await writeProposal(world, { emailId: row.id, action: 'prompt', promptId: prompt.id, messages, ...settings });
      if (organization.automation === 'mailbox') await fileProposalAsDraft(world, mailbox, owner, email, proposal);
    }
    return null;
  } catch (e) {
    return e instanceof LlmError ? e.problem : problem('sync.prepareFailed', { detail: errorMessage(e) });
  }
}
