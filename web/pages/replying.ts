// Replying to an email. The member writes whatever they want in the one editor — a full reply,
// a few notes, instructions — then, if they wish, asks the AI for help; then sends the reply,
// or files it as a draft in the mailbox.

import type { EmailWithItsReply } from '../../shared/email.ts';
import type { Prompt } from '../../shared/prompt.ts';
import { fileReplyAsDraft, sendReply } from '../api/replying.ts';
import type { ReplyToHandOver } from '../api/replying.ts';
import { t, tRich } from '../i18n.ts';
import { route } from '../navigation.ts';
import { ActionButton } from './actions.ts';
import { replyHelp } from './asking-the-ai.ts';
import { replyToHandOver, showProposal, startReply, syncReply } from './reply-in-progress.ts';
import type { ReplyInProgress } from './reply-in-progress.ts';
import { me } from '../session.ts';
import { Checkbox } from '../ui/atoms/input.ts';
import { Notice } from '../ui/atoms/notice.ts';
import { Link, Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { confirmDialog } from '../ui/molecules/dialog.ts';
import { Facts } from '../ui/molecules/facts.ts';
import { Block, CheckField } from '../ui/molecules/field.ts';
import { ReplyDock } from '../ui/organisms/reply-dock.ts';

/** After the reply left: says so, and goes back to the list. */
type Done = (message: string) => void;

/** The last thing seen before an email leaves: who it goes to, in the interface's own dialog. */
function confirmSending(email: EmailWithItsReply, reply: ReplyToHandOver): Promise<boolean> {
  const facts: [string, Child][] = [[t('reply.from'), email.mailbox], [t('composer.to'), reply.to.join(', ')]];
  if (reply.cc.length) facts.push([t('composer.cc'), reply.cc.join(', ')]);
  return confirmDialog({ title: t('composer.confirmSendTitle'), text: [Facts(facts), Text({ muted: true, small: true }, t('composer.confirmSendText'))], confirmLabel: t('composer.send'), cancelLabel: t('common.cancel') });
}

/** SendReply, once the member confirmed to whom. */
const sendButton = (reply: ReplyInProgress, done: Done): HTMLButtonElement => ActionButton(t('composer.send'), t('composer.sending'), async () => {
  const written = replyToHandOver(reply);
  if (!(await confirmSending(reply.email, written))) return;
  await sendReply(reply.email.id, written);
  done(t('composer.sent'));
}, { variant: 'primary', icon: 'send' });

/** FileReplyAsDraft: nothing is sent, the reply waits in the mailbox's drafts. */
const fileAsDraftButton = (reply: ReplyInProgress, done: Done): HTMLButtonElement => ActionButton(t('composer.saveDraft'), t('composer.savingDraft'), async () => {
  await fileReplyAsDraft(reply.email.id, replyToHandOver(reply));
  done(t('composer.draftSaved', { account: reply.email.mailbox }));
}, { title: t('composer.saveDraftTitle') });

/** What to know before writing: what to try at the end of the getting-started path, and a missing key. */
const replyNotices = (email: EmailWithItsReply): Child => [
  // Arriving from the getting-started path: say what to try, once.
  route().query.has('welcome') && Block(Notice('info', email.proposal ? t('welcome.tryPrepared') : t('welcome.tryIt'))),
  !me().hasKey && Notice('warn', tRich('composer.noKey', {}, { link: (label) => Link(label, '#/settings') })),
];

/** The recipients, and replying to all when the email had others in copy. */
function recipients(reply: ReplyInProgress): Child {
  const { recipientsAll } = reply.email;
  const replyAll = Checkbox({ onchange: () => reply.cc.setValues(replyAll.checked ? recipientsAll.cc : []) });
  return [reply.to.element, reply.cc.element, recipientsAll.cc.length > 0 && CheckField(t('composer.replyAll'), replyAll)];
}

/** The reply area, docked under the email. It opens on the proposal prepared for the email, when there is one. */
export function replyArea(email: EmailWithItsReply, prompts: Prompt[], done: Done): HTMLElement {
  const reply = startReply(email);
  const dock = ReplyDock({
    label: t('composer.title'),
    notice: replyNotices(email),
    recipients: recipients(reply),
    write: [reply.editor.element, reply.reasonField],
    help: replyHelp(reply, prompts),
    actions: [sendButton(reply, done), fileAsDraftButton(reply, done), reply.caution],
  });
  if (email.proposal) showProposal(reply, email.proposal, null);
  else syncReply(reply);
  return dock;
}
