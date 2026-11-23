// What the style guide shows its components with: sample emails, a sample reply area, and
// the toast its buttons answer through.

import { locale, t } from '../i18n.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { Button, setBusy } from '../ui/atoms/button.ts';
import { Checkbox, Input } from '../ui/atoms/input.ts';
import { AiHelp } from '../ui/molecules/ai-help.ts';
import { AiNote } from '../ui/molecules/ai-note.ts';
import { Caution } from '../ui/molecules/caution.ts';
import { EmailListItem } from '../ui/molecules/email-list-item.ts';
import { CheckField } from '../ui/molecules/field.ts';
import { PromptPick } from '../ui/molecules/prompt-pick.ts';
import { ReasonField } from '../ui/molecules/reason-field.ts';
import { RecipientField } from '../ui/molecules/recipient-field.ts';
import type { EditorLabels } from '../ui/molecules/rich-editor-toolbar.ts';
import { RichEditor } from '../ui/molecules/rich-editor.ts';
import { createToast } from '../ui/molecules/toast.ts';
import { ReadingHeader } from '../ui/organisms/reading.ts';
import { ReplyDock } from '../ui/organisms/reply-dock.ts';

export const showToast = createToast(document.getElementById('toast') as HTMLElement);

/** The wording of the editor's toolbar, as the application gives it. */
export const editorLabels = (): EditorLabels => ({ bold: t('editor.bold'), italic: t('editor.italic'), underline: t('editor.underline'), bullets: t('editor.bullets'), numbers: t('editor.numbers'), link: t('editor.link'), linkPrompt: t('editor.linkPrompt'), linkInsert: t('editor.linkInsert'), cancel: t('common.cancel'), clear: t('editor.clear') });

/** A button shown in its busy state. */
export const busyButton = (): HTMLButtonElement => {
  const button = Button(t('styleguide.busy'), { variant: 'primary', icon: 'send' });
  setBusy(button, true);
  return button;
};

/** An editor holding a proposal of the AI, with its note. */
export const proposedEditor = (): HTMLElement => {
  const editor = RichEditor({ labels: editorLabels() });
  editor.setHtml(t('styleguide.sample.rich'));
  editor.setProposal(AiNote(t('styleguide.aiNote'), Button(t('styleguide.undo'), { variant: 'ghost', size: 'small', icon: 'undo', onClick: () => editor.setProposal(null) })));
  return editor.element;
};

/** The head of an open email, with the decisions about it. */
export const sampleHeader = (): HTMLElement => ReadingHeader({
  subject: t('styleguide.sample.subject'),
  actions: [Button(t('composer.noReplyNeeded'), { variant: 'ghost', size: 'small', icon: 'mail-check' }), Button(t('composer.ignore'), { variant: 'ghost', size: 'small', icon: 'archive' })],
  sender: { name: 'Claire Martin', address: 'claire@client.example' },
  to: t('reading.to', { to: 'alex@brightwater.example' }),
  attachments: ['requirements.pdf'],
  date: new Date(2026, 10, 19, 9, 30).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }),
  triage: [Badge(t('reading.triage.ai'), 'neutral'), t('styleguide.sample.triage')],
});

/** The reply area with every part showing: recipients, a proposal, the reason, the help, the actions. */
export const sampleDock = (): HTMLElement => {
  const editor = RichEditor({ labels: editorLabels(), placeholder: t('composer.placeholder'), highlight: /\[[^[\]\n]{2,80}\]/ });
  editor.setHtml(t('styleguide.sample.rich'));
  editor.setProposal(AiNote([t('composer.done.prompt'), ' ', t('composer.editedByYou')], Button(t('composer.undo'), { variant: 'ghost', size: 'small', icon: 'undo' })), false);
  const removeLabel = (address: string): string => t('composer.removeRecipient', { address });
  const pick = PromptPick({ label: t('composer.applyPrompt'), selectLabel: t('composer.prompt'), options: [{ value: 1, label: t('styleguide.firstOption'), selected: true }, { value: 2, label: t('styleguide.secondOption') }], suggested: { value: 1, label: t('composer.suggestedTag') } });
  return ReplyDock({
    label: t('composer.title'),
    recipients: [RecipientField({ label: t('composer.to'), values: ['claire@client.example'], removeLabel }).element, RecipientField({ label: t('composer.cc'), removeLabel }).element, CheckField(t('composer.replyAll'), Checkbox())],
    write: [editor.element, ReasonField(t('composer.reason'), Input({ placeholder: t('composer.reasonPlaceholder') }), t('composer.reasonHint'))],
    help: AiHelp({ label: t('composer.help'), note: t('composer.helpNote') }, Button(t('composer.typos'), { size: 'small', icon: 'spell-check' }), Button(t('composer.style'), { size: 'small', icon: 'pen-line' }), pick.element),
    actions: [Button(t('composer.send'), { variant: 'primary', icon: 'send' }), Button(t('composer.saveDraft')), Caution(t('composer.toComplete', { count: 1 }))],
  });
};

export const sampleEmail = (over = {}) =>
  EmailListItem({ from: 'Claire Martin', date: '09:30', subject: t('styleguide.sample.subject'), snippet: t('styleguide.sample.snippet'), ...over });
