// Living style guide: every token and every component of the design system, rendered with
// the installation's own brand. It is built from the same modules as the application and
// reads the token list from design/tokens.css itself, so it cannot drift from the real thing.
import { Avatar, Badge, BrandMark, Button, ButtonLink, Checkbox, Chip, Code, Heading, Icon, Input, Link, List, Muted, Notice, Prose, RichText, Select, Small, Spacer, Spinner, Strong, Text, Textarea, TodoMark, setBusy } from './ui/atoms.ts';
import type { IconName } from './ui/atoms.ts';
import { Actions, AiNote, Assurance, Block, Card, CardSection, CheckField, EmailListItem, EmptyState, Field, Form, FormRow, Message, NavItem, PageHeader, RecipientField, RichEditor, Swatch, confirmDialog, createToast, promptDialog } from './ui/molecules.ts';
import { AuthPanel, Mailbox, Page, ReadingHeader } from './ui/organisms.ts';
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

const sampleEmail = (over = {}) =>
  EmailListItem({ from: 'Claire Martin', date: '09:30', subject: t('styleguide.sample.subject'), snippet: t('styleguide.sample.snippet'), ...over });

(document.getElementById('app') as HTMLElement).replaceChildren(
  Page(
    PageHeader(t('styleguide.title', { product: brand.name }), Spacer(), ButtonLink(t('styleguide.back'), { href: '/' })),
    Block(Text({ muted: true }, tRich('styleguide.intro', {}, { code: Code }))),

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
      sampleEmail({ badges: [Badge(t('mailbox.priority'), 'danger')] }),
      sampleEmail({ current: true, from: 'Sophie Leroy', subject: t('styleguide.sample.subject2'), badges: [Badge(t('mailbox.untriaged'), 'warn'), Badge(t('mailbox.draft'), 'neutral')] }),
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
    Card({ title: t('styleguide.readingHeader') },
      ReadingHeader({ subject: t('styleguide.sample.subject'), meta: [tRich('reading.from', { sender: 'Claire Martin <claire@client.example>', date: new Date(2026, 10, 19, 9, 30).toLocaleString(locale(), { dateStyle: 'full', timeStyle: 'short' }) }, { strong: Strong })], triage: [Badge(t('reading.triage.ai'), 'neutral'), ' ', t('styleguide.sample.triage')] }),
    ),
    Card({ title: t('styleguide.mailbox') },
      Mailbox({ title: t('box.todo.label'), action: Button(t('mailbox.refresh')), items: [sampleEmail({ current: true }), sampleEmail({ from: 'Marc Dubois', subject: t('styleguide.sample.subject3') })], empty: '', backHref: '#', backLabel: t('mailbox.back'), selectHint: t('mailbox.select'), detail: Card({ title: t('styleguide.readingPane') }, Text({ muted: true }, t('styleguide.readingPaneText'))) }),
    ),
    Card({ title: t('styleguide.authPanel') },
      AuthPanel({ brand, tagline: brand.tagline, foot: t('styleguide.authFoot') }, Form(Field(t('auth.email'), Input({ type: 'email' })), Button(t('auth.signIn'), { variant: 'primary', block: true }))),
    ),
    Block(Text({ muted: true, small: true }, t('styleguide.shellNote'))),
  ),
);
