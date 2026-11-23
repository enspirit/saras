// The molecules, each in the situations the application puts it in.

import { t } from '../i18n.ts';
import { editorLabels, proposedEditor, sampleEmail, showToast } from './samples.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { Button } from '../ui/atoms/button.ts';
import { Checkbox, Input } from '../ui/atoms/input.ts';
import { Spacer } from '../ui/atoms/spacer.ts';
import { Heading, Prose, RichText, Strong, Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Assurance } from '../ui/molecules/assurance.ts';
import { Callout } from '../ui/molecules/callout.ts';
import { Card, CardSection } from '../ui/molecules/card.ts';
import { Choices } from '../ui/molecules/choices.ts';
import { confirmDialog, promptDialog } from '../ui/molecules/dialog.ts';
import { EmptyState } from '../ui/molecules/empty-state.ts';
import { Features } from '../ui/molecules/features.ts';
import { Block, CheckField, Field } from '../ui/molecules/field.ts';
import { Actions, Form, FormRow } from '../ui/molecules/form.ts';
import { Message } from '../ui/molecules/message.ts';
import { NavItem } from '../ui/molecules/nav-item.ts';
import { Person } from '../ui/molecules/person.ts';
import { RecipientField } from '../ui/molecules/recipient-field.ts';
import { Remark } from '../ui/molecules/remark.ts';
import { RichEditor } from '../ui/molecules/rich-editor.ts';
import { Steps } from '../ui/molecules/steps.ts';
import { Table } from '../ui/molecules/table.ts';
import { Tabs } from '../ui/molecules/tabs.ts';

const formsCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.forms') },
    Form(
      FormRow(Field(t('styleguide.withHint'), Input(), { hint: t('styleguide.hint') }), Field(t('styleguide.narrow'), Input({ type: 'number', value: 993 }), { size: 'narrow' }), CheckField(t('styleguide.checkbox'), Checkbox({ checked: true }), { size: 'narrow' })),
      CheckField(t('styleguide.checkbox'), Checkbox(), { hint: t('styleguide.hint') }),
      Actions(Button(t('styleguide.confirm'), { variant: 'primary', onClick: () => showToast(t('styleguide.toast')) }), Button(t('styleguide.error'), { onClick: () => showToast(t('styleguide.toastError'), true) }), Spacer(), Button(t('styleguide.atEnd'))),
    ),
  );

const cardCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.card'), badges: [Badge(t('styleguide.withBadge'), 'neutral'), Badge(t('mailboxes.todo', { count: 3 }))] },
    Block(Text({ muted: true }, t('styleguide.cardText'))),
    CardSection(t('styleguide.cardSection'), Text({ small: true }, t('styleguide.cardSectionText'))),
  );

const dialogsCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.dialogs') },
    Actions(
      Button(t('styleguide.dialogConfirm'), { onClick: async () => showToast(t('styleguide.dialogAnswer', { answer: String(await confirmDialog({ title: t('styleguide.dialogTitle'), text: t('styleguide.dialogText'), confirmLabel: t('composer.send'), cancelLabel: t('common.cancel') })) })) }),
      Button(t('styleguide.dialogDanger'), { variant: 'danger', onClick: async () => showToast(t('styleguide.dialogAnswer', { answer: String(await confirmDialog({ title: t('styleguide.dialogDangerTitle'), text: t('styleguide.dialogDangerText'), confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'), danger: true })) })) }),
      Button(t('styleguide.dialogPrompt'), { onClick: async () => showToast(t('styleguide.dialogAnswer', { answer: String(await promptDialog({ title: t('editor.link'), label: t('editor.linkPrompt'), value: 'https://', confirmLabel: t('editor.linkInsert'), cancelLabel: t('common.cancel') })) })) }),
    ),
  );

const pagePartsCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.pageParts') },
    Block(Steps([t('mailboxes.step1'), t('mailboxes.step2'), t('mailboxes.step3')], 1)),
    Tabs([{ label: t('settings.you'), href: '#', current: true }, { label: t('organization.title'), href: '#' }, { label: t('settings.privacy'), href: '#' }]),
    Callout('ok', t('mailboxes.connectedShort', { email: 'claire@client.example' })),
    Callout('warn', [Strong(t('settings.yourPart')), ' ', t('settings.privacyLogging')]),
  );

const choicesCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.choices') },
    Choices({ legend: t('mailboxes.whose'), name: 'sample-whose', value: 'mine', options: [{ value: 'mine', title: t('mailboxes.mine'), hint: t('mailboxes.mineHint') }, { value: 'shared', title: t('mailboxes.sharedChoice'), hint: t('mailboxes.imapHint') }, { value: 'off', title: t('mailboxes.connectGoogle'), hint: t('styleguide.unavailableWhy'), disabled: true }] }).element,
    Choices({ legend: t('mailboxes.folders'), name: 'sample-folder', rows: true, value: 'a', options: [{ value: 'a', title: t('styleguide.firstOption') }, { value: 'b', title: t('styleguide.secondOption') }] }).element,
  );

const tablesCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.tables') },
    Table({ columns: [t('members.member'), t('members.role'), t('members.joined')], actions: t('common.actions') }, [
      [Person({ name: 'Claire Martin', detail: 'claire@client.example', tags: [Badge(t('members.you'), 'neutral')] }), Badge(t('role.admin')), '22 Nov 2026', [Button(t('members.demote'), { variant: 'ghost', size: 'small' })]],
      [Person({ name: 'contact@client.example', detail: 'IMAP / SMTP', icon: 'users' }), Badge(t('role.user'), 'neutral'), '22 Nov 2026', [Button(t('members.promote'), { variant: 'ghost', size: 'small' }), Button(t('members.delete'), { variant: 'danger', size: 'small', icon: 'trash', iconOnly: true })]],
    ]),
    Remark({ text: t('composer.reasonPlaceholder'), by: 'Claire Martin', meta: 'Claire Martin · 08:13' }),
  );

const featuresCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.features') },
    Features([{ icon: 'lock', title: t('settings.guarantee.zdr'), text: t('settings.privacyZdr') }, { icon: 'key', title: t('settings.guarantee.encryption'), text: t('settings.privacyEncryption') }, { icon: 'check', title: t('settings.guarantee.validation'), text: t('settings.privacyValidation') }]),
  );

const recipientsCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.recipients') },
    RecipientField({ label: t('styleguide.to'), values: ['claire.martin@ostrava-logistics.example', 'paul.novak@ostrava-logistics.example'], removeLabel: (address) => t('styleguide.removeRecipient', { address }) }).element,
  );

const navigationCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.navigation') },
    NavItem({ href: '#', label: t('styleguide.navCurrent'), icon: 'mail', count: 4, current: true }),
    NavItem({ href: '#', label: t('styleguide.navEntry'), icon: 'archive', count: 12 }),
    Block(NavItem({ href: '#', label: t('styleguide.navNoCount') })),
    Assurance(t('nav.assurance.text')),
  );

const emailsCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.emails') },
    sampleEmail({ tags: [Badge(t('mailbox.priority'), 'warn')], shared: { label: 'contact', title: 'contact@client.example' } }),
    sampleEmail({ current: true, from: 'Sophie Leroy', subject: t('styleguide.sample.subject2'), tags: [Badge(t('mailbox.untriaged'), 'neutral'), Badge(t('mailbox.draft'), 'neutral')] }),
    Message(Prose(t('styleguide.sample.body'))),
    EmptyState(t('styleguide.empty')),
    EmptyState(t('styleguide.empty'), { icon: 'mail', title: t('styleguide.emptyTitle'), action: Button(t('styleguide.emptyAction'), { icon: 'refresh-cw' }) }),
  );

const editorCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.editor') },
    Block(RichEditor({
      placeholder: t('composer.placeholder'),
      labels: editorLabels(),
    }).element),
    CardSection(t('styleguide.proposal'), Block(proposedEditor())),
    CardSection(t('styleguide.richText'), RichText(t('styleguide.sample.rich'))),
  );

export const moleculesSection = (): Child[] => [
  Heading(2, t('styleguide.molecules')),
  formsCard(),
  cardCard(),
  dialogsCard(),
  pagePartsCard(),
  choicesCard(),
  tablesCard(),
  featuresCard(),
  recipientsCard(),
  navigationCard(),
  emailsCard(),
  editorCard(),
];
