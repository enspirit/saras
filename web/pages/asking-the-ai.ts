// The AI's help with a reply, always optional: check typos, improve the style, or write the
// reply with one of the organisation's prompts.

import type { EmailDetail } from '../api/emails.ts';
import type { Prompt } from '../api/prompts.ts';
import { checkTypos, improveStyle, writeWithPrompt } from '../api/replying.ts';
import type { Draft } from '../api/replying.ts';
import { t, tRich } from '../i18n.ts';
import { ActionButton, busy } from './actions.ts';
import { showProposal } from './reply-in-progress.ts';
import type { ReplyInProgress } from './reply-in-progress.ts';
import { isAdmin } from '../session.ts';
import { Notice } from '../ui/atoms/notice.ts';
import { Link } from '../ui/atoms/text.ts';
import { AiHelp } from '../ui/molecules/ai-help.ts';
import { PromptPick } from '../ui/molecules/prompt-pick.ts';

/** A kind of help: what is written goes in, a proposal comes back. */
type Help = (emailId: number, html: string) => Promise<Draft>;

/** The choice of the prompt to write with, on the one the AI suggested or last used; none without prompts. */
function promptPick(email: EmailDetail, prompts: Prompt[]) {
  const suggested = email.suggestedPromptId;
  if (!prompts.length) return null;
  return PromptPick({
    label: t('composer.applyPrompt'),
    selectLabel: t('composer.prompt'),
    title: t('composer.applyPromptTitle'),
    options: prompts.map((p) => ({ value: p.id, label: p.name, selected: p.id === (email.draft?.promptId ?? suggested) })),
    suggested: suggested ? { value: suggested, label: t('composer.suggestedTag') } : undefined,
  });
}

/** Asks for one kind of help with what is written, and shows the proposal in its place. */
const asking = (reply: ReplyInProgress, help: Help) => async (): Promise<void> => {
  const html = reply.editor.getHtml();
  showProposal(reply, await help(reply.email.id, html), html);
};

/** Said in place of the prompts when the organisation has none: where to add one, to who can. */
const noPrompt = (): HTMLElement =>
  Notice('warn', isAdmin() ? tRich('composer.noPromptAdmin', {}, { link: (label) => Link(label, '#/prompts') }) : t('composer.noPrompt'));

/** The three kinds of help, as equals, each asked for with what is written at that moment. */
export function replyHelp(reply: ReplyInProgress, prompts: Prompt[]): HTMLDivElement {
  const pick = promptPick(reply.email, prompts);
  const typos = ActionButton(t('composer.typos'), t('composer.working'), asking(reply, checkTypos), { size: 'small', icon: 'spell-check', title: t('composer.typosTitle') });
  const style = ActionButton(t('composer.style'), t('composer.working'), asking(reply, improveStyle), { size: 'small', icon: 'pen-line', title: t('composer.styleTitle') });
  const withPrompt: Help = (emailId, html) => writeWithPrompt(emailId, html, Number(pick?.select.value));
  pick?.button.addEventListener('click', busy(pick.button, t('composer.working'), asking(reply, withPrompt)));
  return AiHelp({ label: t('composer.help'), note: t('composer.helpNote') }, typos, style, pick ? pick.element : noPrompt());
}
