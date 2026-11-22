// The reply in progress: what the member writes, what the AI last proposed for it, and what
// surrounds the text to say so. It lives in the page only, and is lost on leaving it.

import type { EmailWithItsReply } from '../../shared/email.ts';
import type { Proposal } from '../../shared/reply.ts';
import type { ReplyToHandOver } from '../api/replying.ts';
import { t } from '../i18n.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input } from '../ui/atoms/input.ts';
import { AiNote } from '../ui/molecules/ai-note.ts';
import { Caution } from '../ui/molecules/caution.ts';
import { ReasonField } from '../ui/molecules/reason-field.ts';
import { RecipientField } from '../ui/molecules/recipient-field.ts';
import type { RecipientFieldHandle } from '../ui/molecules/recipient-field.ts';
import { RichEditor } from '../ui/molecules/rich-editor.ts';
import type { RichEditorHandle } from '../ui/molecules/rich-editor.ts';

/** A passage in square brackets: what a prompt leaves for the user to complete. */
const TO_COMPLETE = /\[[^[\]\n]{2,80}\]/;

export interface ReplyInProgress {
  email: EmailWithItsReply;
  editor: RichEditorHandle;
  to: RecipientFieldHandle;
  cc: RecipientFieldHandle;
  /** Why the proposal was changed, and the field that asks it. */
  reason: HTMLInputElement;
  reasonField: HTMLDivElement;
  /** What is left to complete, shown next to the actions; replaced each time it changes. */
  caution: HTMLElement;
  /** Puts back what the AI replaced. */
  undo: HTMLButtonElement;
  /** The last thing the AI proposed, to tell whether the user changed it since, and how to say it. */
  proposal: { id: number; action: Proposal['action']; text: string; said: string } | null;
  /** What the editor held before the AI last replaced it, for the user to get it back. */
  before: string | null;
  /** Whether the note above the text already says that the proposal was edited. */
  notedEdited: boolean | null;
}

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** The one editor of the reply area, with the wording of its toolbar. */
const replyEditor = (): RichEditorHandle => RichEditor({
  placeholder: t('composer.placeholder'),
  highlight: TO_COMPLETE,
  labels: {
    bold: t('editor.bold'),
    italic: t('editor.italic'),
    underline: t('editor.underline'),
    bullets: t('editor.bullets'),
    numbers: t('editor.numbers'),
    link: t('editor.link'),
    linkPrompt: t('editor.linkPrompt'),
    linkInsert: t('editor.linkInsert'),
    cancel: t('common.cancel'),
    clear: t('editor.clear'),
  },
});

/** Nothing to complete yet: the place where it will be said. */
const quietCaution = (): HTMLElement => {
  const caution = Caution('');
  caution.hidden = true;
  return caution;
};

/** An empty reply to this email, addressed to whoever wrote it. */
export function startReply(email: EmailWithItsReply): ReplyInProgress {
  const removeLabel = (address: string): string => t('composer.removeRecipient', { address });
  const reason = Input({ placeholder: t('composer.reasonPlaceholder') });
  const reply: ReplyInProgress = {
    email,
    editor: replyEditor(),
    to: RecipientField({ label: t('composer.to'), values: email.recipients.to, removeLabel }),
    cc: RecipientField({ label: t('composer.cc'), removeLabel }),
    reason,
    reasonField: ReasonField(t('composer.reason'), reason, t('composer.reasonHint')),
    caution: quietCaution(),
    undo: Button(t('composer.undo'), { variant: 'ghost', size: 'small', icon: 'undo', onClick: () => putMyTextBack(reply) }),
    proposal: null,
    before: null,
    notedEdited: null,
  };
  reply.editor.onChange(() => syncReply(reply));
  return reply;
}

/** PutMyTextBack: the text the AI replaced comes back, and its proposal is forgotten. */
function putMyTextBack(reply: ReplyInProgress): void {
  if (reply.before === null) return;
  reply.editor.setHtml(reply.before);
  reply.before = null;
  reply.proposal = null;
  syncReply(reply);
}

/** Says above the text what the AI did, and whether it was changed since. */
function noteProposal(reply: ReplyInProgress, edited: boolean): void {
  if (!reply.proposal) {
    reply.editor.setProposal(null);
    reply.notedEdited = null;
  } else if (reply.notedEdited !== edited) {
    reply.notedEdited = edited;
    reply.editor.setProposal(AiNote([reply.proposal.said, edited && ` ${t('composer.editedByYou')}`], reply.before !== null && reply.undo), !edited);
  }
}

/** Brings what surrounds the text in line with it: the AI's note, the "why", what is left to complete. */
export function syncReply(reply: ReplyInProgress): void {
  const edited = reply.proposal !== null && norm(reply.editor.getText()) !== norm(reply.proposal.text);
  // Only a proposal made with a prompt can teach that prompt something.
  reply.reasonField.hidden = reply.proposal?.action !== 'prompt' || !edited;
  noteProposal(reply, edited);
  const open = reply.editor.countHighlights();
  const next = Caution(open ? t('composer.toComplete', { count: open }) : '');
  next.hidden = !open;
  reply.caution.replaceWith(next);
  reply.caution = next;
}

/** Shows a proposal in the editor and remembers it. `replaced` is what it took the place of. */
export function showProposal(reply: ReplyInProgress, draft: Proposal, replaced: string | null): void {
  reply.before = replaced;
  reply.editor.setHtml(draft.html);
  const by = draft.provider ? t('composer.generatedVia', { model: draft.model, provider: draft.provider }) : t('composer.generatedBy', { model: draft.model });
  const what = { typos: t('composer.done.typos'), style: t('composer.done.style'), prompt: t('composer.done.prompt') }[draft.action];
  reply.proposal = { id: draft.id, action: draft.action, text: reply.editor.getText(), said: `${what} ${by}` };
  reply.notedEdited = null;
  syncReply(reply);
}

/** The reply as it stands, as the server expects it. */
export const replyToHandOver = (reply: ReplyInProgress): ReplyToHandOver => ({
  proposalId: reply.proposal?.id,
  html: reply.editor.getHtml(),
  to: reply.to.getValues(),
  cc: reply.cc.getValues(),
  changeReason: reply.reasonField.hidden ? '' : reply.reason.value,
});
