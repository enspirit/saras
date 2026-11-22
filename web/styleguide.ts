// Living style guide: every token and every component of the design system, rendered with
// the installation's own brand. It is built from the same modules as the application and
// reads the token list from design/tokens.css itself, so it cannot drift from the real thing.
import { Avatar, Badge, BrandMark, Button, ButtonLink, Checkbox, Chip, Code, Heading, Icon, Input, Link, List, Muted, Notice, Prose, RichText, Select, Small, Spacer, Spinner, Strong, Text, Textarea, TodoMark, setBusy } from './ui/atoms.ts';
import type { IconName } from './ui/atoms.ts';
import { Actions, AiHelp, AiNote, Assurance, Block, Card, CardSection, Callout, Caution, CheckField, Choices, EmailListItem, EmptyState, Features, Field, Form, FormRow, Message, NavItem, PageHeader, Panel, Person, PromptPick, ReasonField, RecipientField, Remark, RichEditor, Steps, Swatch, Table, Tabs, confirmDialog, createToast, promptDialog } from './ui/molecules.ts';
import { AuthPanel, ClosedDock, Columns, Mailbox, Page, Reading, ReadingHeader, ReplyDock } from './ui/organisms.ts';
import { loadBrand } from './ui/brand.ts';
import { initI18n, language, locale, t, tRich } from './i18n.ts';

const toast = createToast(document.getElementById('toast') as HTMLElement);

/** Names of the custom properties declared in tokens.css, in file order. */
async function tokenNames() {
  const css = await (await fetch('/design/tokens.css')).text();
  return [...new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]))];
}

const computed = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const valueLine = (name: string) => Text({ small: true }, Code(name), Muted(` — ${computed(name)}`));

await initI18n();
const brand = await loadBrand(language());
const tokens = await tokenNames();
const group = (prefix: string): string[] => tokens.filter((t) => t.startsWith(prefix));
document.title = t('styleguide.title', { product: brand.name });

const ICONS: IconName[] = ['mail', 'mail-check', 'reply', 'archive', 'inbox', 'plug', 'file-text', 'users', 'settings', 'lock', 'eye-off', 'timer', 'globe', 'log-out', 'refresh-cw', 'search', 'send', 'paperclip', 'spell-check', 'pen-line', 'pencil', 'undo', 'trash', 'plus', 'x', 'check', 'chevron-down', 'info', 'circle-alert', 'triangle-alert', 'bold', 'italic', 'underline', 'list', 'list-ordered', 'link', 'remove-formatting'];
const editorLabels = { bold: t('editor.bold'), italic: t('editor.italic'), underline: t('editor.underline'), bullets: t('editor.bullets'), numbers: t('editor.numbers'), link: t('editor.link'), linkPrompt: t('editor.linkPrompt'), linkInsert: t('editor.linkInsert'), cancel: t('common.cancel'), clear: t('editor.clear') };

/** A button shown in its busy state. */
const busyButton = (): HTMLButtonElement => {
  const button = Button(t('styleguide.busy'), { variant: 'primary', icon: 'send' });
  setBusy(button, true);
  return button;
};

/** An editor holding a proposal of the AI, with its note. */
const proposedEditor = (): HTMLElement => {
  const editor = RichEditor({ labels: editorLabels });
  editor.setHtml(t('styleguide.sample.rich'));
  editor.setProposal(AiNote(t('styleguide.aiNote'), Button(t('styleguide.undo'), { variant: 'ghost', size: 'small', icon: 'undo', onClick: () => editor.setProposal(null) })));
  return editor.element;
};

/** The head of an open email, with the decisions about it. */
const sampleHeader = (): HTMLElement => ReadingHeader({
  subject: t('styleguide.sample.subject'),
  actions: [Button(t('composer.noReplyNeeded'), { variant: 'ghost', size: 'small', icon: 'mail-check' }), Button(t('composer.ignore'), { variant: 'ghost', size: 'small', icon: 'archive' })],
  sender: { name: 'Claire Martin', address: 'claire@client.example' },
  to: t('reading.to', { to: 'alex@brightwater.example' }),
  attachments: ['requirements.pdf'],
  date: new Date(2026, 10, 19, 9, 30).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }),
  triage: [Badge(t('reading.triage.ai'), 'neutral'), t('styleguide.sample.triage')],
});

/** The reply area with every part showing: recipients, a proposal, the reason, the help, the actions. */
const sampleDock = (): HTMLElement => {
  const editor = RichEditor({ labels: editorLabels, placeholder: t('composer.placeholder'), highlight: /\[[^[\]\n]{2,80}\]/ });
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

const sampleEmail = (over = {}) =>
  EmailListItem({ from: 'Claire Martin', date: '09:30', subject: t('styleguide.sample.subject'), snippet: t('styleguide.sample.snippet'), ...over });

(document.getElementById('app') as HTMLElement).replaceChildren(
  Page(
    PageHeader({ title: t('styleguide.title', { product: brand.name }), intro: tRich('styleguide.intro', {}, { code: Code }) }, ButtonLink(t('styleguide.back'), { href: '/' })),

    Heading(2, t('styleguide.tokens')),
    Card({ title: t('styleguide.brandInputs') },
      Block(Text({ muted: true, small: true }, t('styleguide.brandInputsHint'))),
      group('--brand-').map((t) => (/(accent|canvas|ink)/.test(t) ? Swatch(t) : valueLine(t))),
    ),
    Card({ title: t('styleguide.colors') },
      Block(Text({ muted: true, small: true }, t('styleguide.colorsHint'))),
      group('--color-').map(Swatch),
    ),
    Card({ title: t('styleguide.typography') }, [...group('--font-'), ...group('--text-'), ...group('--weight-'), ...group('--leading')].map(valueLine)),
    Card({ title: t('styleguide.layout') },
      [...group('--space-'), ...group('--radius-'), '--border-width', '--nav-width', '--list-width', '--content-width', '--auth-width', '--dialog-width', '--logo-height'].map(valueLine),
    ),
    Card({ title: t('styleguide.elevation') }, [...group('--shadow-'), ...group('--duration-'), '--ease', ...group('--control-'), ...group('--icon-')].map(valueLine)),

    Heading(2, t('styleguide.atoms')),
    Card({ title: t('styleguide.brandMark') }, Actions(BrandMark(brand), BrandMark(brand, { large: true }))),
    Card({ title: t('styleguide.icons') },
      Block(Text({ muted: true, small: true }, t('styleguide.iconsHint'))),
      Block(Actions(ICONS.map((name) => Icon(name, { size: 'large' })))),
      Actions(Icon('lock', { size: 'small' }), Icon('lock'), Icon('lock', { size: 'large' }), Spinner()),
    ),
    Card({ title: t('styleguide.buttons') },
      Block(Actions(Button(t('styleguide.default')), Button(t('styleguide.primary'), { variant: 'primary' }), Button(t('styleguide.danger'), { variant: 'danger' }), Button(t('styleguide.destructive'), { variant: 'destructive' }), Button(t('styleguide.ghost'), { variant: 'ghost' }), Button(t('styleguide.link'), { variant: 'link' }))),
      Block(Actions(Button(t('styleguide.small'), { size: 'small' }), Button(t('styleguide.default')), Button(t('styleguide.large'), { size: 'large' }), Button(t('styleguide.small'), { variant: 'primary', size: 'small' }), Button(t('styleguide.large'), { variant: 'primary', size: 'large' }))),
      Block(Actions(Button(t('styleguide.withIcon'), { variant: 'primary', icon: 'send' }), Button(t('styleguide.withIcon'), { icon: 'spell-check' }), Button(t('styleguide.withIcon'), { variant: 'ghost', size: 'small', icon: 'archive' }), Button(t('styleguide.iconOnly'), { variant: 'ghost', icon: 'refresh-cw', iconOnly: true }), busyButton())),
      Actions(ButtonLink(t('styleguide.buttonLink'), { href: '#' }), ButtonLink(t('styleguide.unavailable'), { disabled: true, title: t('styleguide.unavailableWhy') })),
    ),
    Card({ title: t('styleguide.badges') }, Actions(Badge(t('styleguide.accent')), Badge(t('styleguide.success'), 'ok'), Badge(t('styleguide.warning'), 'warn'), Badge(t('styleguide.danger'), 'danger'), Badge(t('styleguide.neutral'), 'neutral'))),
    Card({ title: t('styleguide.people') },
      Actions(Avatar('Claire Martin'), Avatar('alex@brightwater.example', { size: 'small' }), Chip('Claire Martin'), Chip('Paul Novak', { removeLabel: t('styleguide.removeRecipient', { address: 'Paul Novak' }), onRemove: () => toast(t('styleguide.toast')) }), TodoMark(t('styleguide.toComplete'))),
    ),
    Card({ title: t('styleguide.notices') },
      Block(Notice('info', tRich('styleguide.noticeInfo', {}, { link: (label) => Link(label, '#') }))),
      Block(Notice('ok', t('styleguide.noticeOk'))),
      Block(Notice('warn', t('styleguide.noticeWarn'))),
      Notice('danger', t('styleguide.noticeDanger')),
    ),
    Card({ title: t('styleguide.text') },
      Heading(1, t('styleguide.heading', { level: 1 })),
      Heading(2, t('styleguide.heading', { level: 2 })),
      Heading(3, t('styleguide.heading', { level: 3 })),
      Text({}, tRich('styleguide.paragraph', {}, { strong: Strong, code: Code, link: (label) => Link(label, '#') })),
      Text({ muted: true }, t('styleguide.paragraphMuted')),
      Text({ small: true }, t('styleguide.paragraphSmall'), ' ', Small(Muted(t('styleguide.smallMuted')))),
      List([t('styleguide.firstItem'), t('styleguide.secondItem')]),
    ),
    Card({ title: t('styleguide.controls') },
      FormRow(Field(t('styleguide.textInput'), Input({ placeholder: t('styleguide.textInputPlaceholder') })), Field(t('styleguide.select'), Select([{ value: 1, label: t('styleguide.firstOption') }, { value: 2, label: t('styleguide.secondOption') }]))),
      Field(t('styleguide.textarea'), Textarea({ placeholder: t('styleguide.textareaPlaceholder') })),
      Field(t('styleguide.disabled'), Input({ value: t('styleguide.disabledValue'), disabled: true })),
      Field(t('styleguide.fieldError'), Input({ type: 'email', value: 'claire@' }), { error: t('styleguide.errorText') }),
      Actions(Checkbox({ checked: true }), Checkbox()),
    ),

    Heading(2, t('styleguide.molecules')),
    Card({ title: t('styleguide.forms') },
      Form(
        FormRow(Field(t('styleguide.withHint'), Input(), { hint: t('styleguide.hint') }), Field(t('styleguide.narrow'), Input({ type: 'number', value: 993 }), { size: 'narrow' }), CheckField(t('styleguide.checkbox'), Checkbox({ checked: true }), { size: 'narrow' })),
        Actions(Button(t('styleguide.confirm'), { variant: 'primary', onClick: () => toast(t('styleguide.toast')) }), Button(t('styleguide.error'), { onClick: () => toast(t('styleguide.toastError'), true) }), Spacer(), Button(t('styleguide.atEnd'))),
      ),
    ),
    Card({ title: t('styleguide.card'), badges: [Badge(t('styleguide.withBadge'), 'neutral'), Badge(t('accounts.todo', { count: 3 }))] },
      Block(Text({ muted: true }, t('styleguide.cardText'))),
      CardSection(t('styleguide.cardSection'), Text({ small: true }, t('styleguide.cardSectionText'))),
    ),
    Card({ title: t('styleguide.dialogs') },
      Actions(
        Button(t('styleguide.dialogConfirm'), { onClick: async () => toast(t('styleguide.dialogAnswer', { answer: String(await confirmDialog({ title: t('styleguide.dialogTitle'), text: t('styleguide.dialogText'), confirmLabel: t('composer.send'), cancelLabel: t('common.cancel') })) })) }),
        Button(t('styleguide.dialogDanger'), { variant: 'danger', onClick: async () => toast(t('styleguide.dialogAnswer', { answer: String(await confirmDialog({ title: t('styleguide.dialogDangerTitle'), text: t('styleguide.dialogDangerText'), confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'), danger: true })) })) }),
        Button(t('styleguide.dialogPrompt'), { onClick: async () => toast(t('styleguide.dialogAnswer', { answer: String(await promptDialog({ title: t('editor.link'), label: t('editor.linkPrompt'), value: 'https://', confirmLabel: t('editor.linkInsert'), cancelLabel: t('common.cancel') })) })) }),
      ),
    ),
    Card({ title: t('styleguide.pageParts') },
      Block(Steps([t('accounts.step1'), t('accounts.step2'), t('accounts.step3')], 1)),
      Tabs([{ label: t('settings.you'), href: '#', current: true }, { label: t('organization.title'), href: '#' }, { label: t('settings.privacy'), href: '#' }]),
      Callout('ok', t('accounts.connectedShort', { email: 'claire@client.example' })),
      Callout('warn', [Strong(t('settings.yourPart')), ' ', t('settings.privacyLogging')]),
    ),
    Card({ title: t('styleguide.choices') },
      Choices({ legend: t('accounts.whose'), name: 'sample-whose', value: 'mine', options: [{ value: 'mine', title: t('accounts.mine'), hint: t('accounts.mineHint') }, { value: 'shared', title: t('accounts.sharedChoice'), hint: t('accounts.imapHint') }, { value: 'off', title: t('accounts.connectGoogle'), hint: t('styleguide.unavailableWhy'), disabled: true }] }).element,
      Choices({ legend: t('accounts.folders'), name: 'sample-folder', rows: true, value: 'a', options: [{ value: 'a', title: t('styleguide.firstOption') }, { value: 'b', title: t('styleguide.secondOption') }] }).element,
    ),
    Card({ title: t('styleguide.tables') },
      Table({ columns: [t('users.member'), t('users.role'), t('users.joined')], actions: t('common.actions') }, [
        [Person({ name: 'Claire Martin', detail: 'claire@client.example', tags: [Badge(t('users.you'), 'neutral')] }), Badge(t('role.admin')), '22 Nov 2026', [Button(t('users.demote'), { variant: 'ghost', size: 'small' })]],
        [Person({ name: 'contact@client.example', detail: 'IMAP / SMTP', icon: 'users' }), Badge(t('role.user'), 'neutral'), '22 Nov 2026', [Button(t('users.promote'), { variant: 'ghost', size: 'small' }), Button(t('users.delete'), { variant: 'danger', size: 'small', icon: 'trash', iconOnly: true })]],
      ]),
      Remark({ text: t('composer.reasonPlaceholder'), by: 'Claire Martin', meta: 'Claire Martin · 08:13' }),
    ),
    Card({ title: t('styleguide.features') },
      Features([{ icon: 'lock', title: t('settings.guarantee.zdr'), text: t('settings.privacyZdr') }, { icon: 'key', title: t('settings.guarantee.encryption'), text: t('settings.privacyEncryption') }, { icon: 'check', title: t('settings.guarantee.validation'), text: t('settings.privacyValidation') }]),
    ),
    Card({ title: t('styleguide.recipients') },
      RecipientField({ label: t('styleguide.to'), values: ['claire.martin@ostrava-logistics.example', 'paul.novak@ostrava-logistics.example'], removeLabel: (address) => t('styleguide.removeRecipient', { address }) }).element,
    ),
    Card({ title: t('styleguide.navigation') },
      NavItem({ href: '#', label: t('styleguide.navCurrent'), icon: 'mail', count: 4, current: true }),
      NavItem({ href: '#', label: t('styleguide.navEntry'), icon: 'archive', count: 12 }),
      Block(NavItem({ href: '#', label: t('styleguide.navNoCount') })),
      Assurance(t('nav.assurance.text')),
    ),
    Card({ title: t('styleguide.emails') },
      sampleEmail({ tags: [Badge(t('mailbox.priority'), 'warn')], shared: { label: 'contact', title: 'contact@client.example' } }),
      sampleEmail({ current: true, from: 'Sophie Leroy', subject: t('styleguide.sample.subject2'), tags: [Badge(t('mailbox.untriaged'), 'neutral'), Badge(t('mailbox.draft'), 'neutral')] }),
      Message(Prose(t('styleguide.sample.body'))),
      EmptyState(t('styleguide.empty')),
      EmptyState(t('styleguide.empty'), { icon: 'mail', title: t('styleguide.emptyTitle'), action: Button(t('styleguide.emptyAction'), { icon: 'refresh-cw' }) }),
    ),

    Card({ title: t('styleguide.editor') },
      Block(RichEditor({
        placeholder: t('composer.placeholder'),
        labels: editorLabels,
      }).element),
      CardSection(t('styleguide.proposal'), Block(proposedEditor())),
      CardSection(t('styleguide.richText'), RichText(t('styleguide.sample.rich'))),
    ),

    Heading(2, t('styleguide.organisms')),
    Card({ title: t('styleguide.readingHeader') }, sampleHeader()),
    Card({ title: t('styleguide.mailbox') },
      Mailbox({
        title: t('box.todo.label'), count: 2, meta: t('mailbox.fetchedAt', { time: '08:13' }), action: Button(t('mailbox.refresh'), { variant: 'ghost', icon: 'refresh-cw', iconOnly: true }),
        items: [sampleEmail({ current: true }), sampleEmail({ from: 'Marc Dubois', subject: t('styleguide.sample.subject3') })],
        empty: EmptyState(t('box.todo.empty'), { icon: 'mail' }), idle: EmptyState(t('mailbox.select'), { icon: 'mail' }), backHref: '#', backLabel: t('mailbox.back'),
        detail: Reading({ header: sampleHeader(), dock: sampleDock() },
          Message(Prose(t('styleguide.sample.body'))),
          Panel({ icon: 'check', title: t('reply.sentTitle'), meta: '08:13', badges: [Badge(t('reply.edited'), 'neutral')], facts: [[t('composer.to'), 'claire@client.example'], [t('reply.why'), t('composer.reasonPlaceholder')]] }, RichText(t('styleguide.sample.rich'))),
        ),
      }),
      Block(ClosedDock(t('composer.closedNone'), Button(t('composer.replyAnyway'), { size: 'small', icon: 'reply' }))),
    ),
    Card({ title: t('styleguide.columns') }, Columns(Card({}, Text({}, t('styleguide.cardText'))), Card({ title: t('prompts.corrections') }, Text({ muted: true, small: true }, t('prompts.noCorrections'))))),
    Card({ title: t('styleguide.authPanel') },
      AuthPanel({ brand, tagline: brand.tagline, points: [{ icon: 'lock', text: t('auth.pointZdr') }, { icon: 'eye-off', text: t('auth.pointMinimal') }], title: t('auth.signIn'), foot: t('styleguide.authFoot') },
        Form(Field(t('auth.email'), Input({ type: 'email' })), Button(t('auth.signIn'), { variant: 'primary', size: 'large', block: true }))),
    ),
    Block(Text({ muted: true, small: true }, t('styleguide.shellNote'))),
  ),
);
