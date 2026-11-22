// PrepareProposals — when the organisation asked for it, the backend writes a proposal for
// each email to handle that has none, without anyone asking.
//
//   DomPre   emails to handle, with content and no proposal
//   DomPost  each has a proposal
//   ReqPre   the organisation's way of working asks for it
//            a key is in force, as the mailbox's owner
//            the organisation has a prompt
//   ReqPost  written with the prompt suggested at triage, else the organisation's first
//            as the mailbox's owner: their model, signature and past corrections
//            at most MAX_PREPARED per fetch, most recent first
//            when the way of working says so, each is then filed: FileProposalAsDraft
//   ReqTrig  part of every fetch, after sorting
import { errorMessage } from '../../tooling/errors.ts';
import { LlmError } from '../../tooling/llm/openrouter.ts';
import { buildPromptMessages } from '../computations/llm-prompts.ts';
import { llmSettings } from '../computations/key-in-force.ts';
import { problem } from '../../tooling/messages.ts';
import type { Problem } from '../../tooling/messages.ts';
import { rowToEmail } from '../mailboxes/fetch-mailbox.ts';
import type { AccountRow, OrganizationRow, UserRow } from '../../types.ts';
import { promptToPrepareWith } from '../computations/replying.ts';
import { emailsAwaitingProposal } from '../state/emails.ts';
import { lessonsFor, promptsOf } from '../state/prompts.ts';
import type { Reach } from '../world.ts';
import { fileProposalAsDraft } from './file-proposal-as-draft.ts';
import { writeProposal } from './proposal.ts';

/** A full folder is not drafted in one go. */
const MAX_PREPARED = 10;

/** Returns what went wrong, if anything: a fetch records it on the mailbox. */
export async function prepareProposals(world: Reach, mailbox: AccountRow, organization: OrganizationRow, owner: UserRow): Promise<Problem | null> {
  const { db } = world;
  if (organization.automation === 'none') return null;
  const settings = llmSettings(owner, organization, world);
  const prompts = await promptsOf(db, organization.id);
  if (!settings.apiKey || !prompts.length) return null;
  try {
    for (const row of await emailsAwaitingProposal(db, mailbox.id, MAX_PREPARED)) {
      const email = rowToEmail(row);
      const prompt = promptToPrepareWith(row.suggested_prompt_id, prompts)!;
      const messages = buildPromptMessages({ email, prompt: { systemPrompt: prompt.system_prompt }, ownAddress: mailbox.email, signature: owner.signature, lessons: await lessonsFor(db, prompt.id, owner.id), html: '' });
      const proposal = await writeProposal(world, { emailId: row.id, action: 'prompt', promptId: prompt.id, messages, ...settings });
      if (organization.automation === 'mailbox') await fileProposalAsDraft(world, mailbox, owner, email, proposal);
    }
    return null;
  } catch (e) {
    return e instanceof LlmError ? e.problem : problem('sync.prepareFailed', { detail: errorMessage(e) });
  }
}
