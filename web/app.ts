// Pages of the application. They hold behaviour only: every element on screen comes from
// the design system in ./ui (atoms, molecules, organisms) and every word from the
// translation files, through t() and tRich(). Tests enforce both.
import { Badge, Button, ButtonLink, Checkbox, Code, Heading, Input, Link, List, Muted, Notice, Prose, RichText, Select, Small, Spacer, Strong, Text, Textarea } from './ui/atoms.ts';
import { Actions, Block, Card, CardSection, CheckField, EmailListItem, Field, Form, FormRow, Message, PageHeader, RichEditor, createToast } from './ui/molecules.ts';
import { AppShell, AuthPanel, Mailbox, Page, ReadingHeader } from './ui/organisms.ts';
import { loadBrand } from './ui/brand.ts';
import type { Brand, ButtonOptions } from './ui/atoms.ts';
import type { Child } from './ui/dom.ts';
import { api, isSignedOut, problemText } from './api.ts';
import { initI18n, language, languages, locale, setLanguage, t, tRich } from './i18n.ts';
import type { Account, BoxId, MailFolder, Correction, Draft, EmailDetail, EmailList, Invitation, Me, NewInvitation, Prompt, PublicInfo, Role, SentReply, SyncResult, User } from './api.ts';

const root = document.getElementById('app') as HTMLElement;
const toast = createToast(document.getElementById('toast') as HTMLElement);
let brand: Brand = { name: '', tagline: '', logo: null, logoDark: null };

// ---- helpers ----------------------------------------------------------------------------
const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Run an async action from a button: disables it meanwhile and reports failures. */
function busy(button: HTMLButtonElement, label: string, fn: () => unknown) {
  return async (event?: Event): Promise<void> => {
    event?.preventDefault();
    const original = button.textContent;
    button.disabled = true;
    button.textContent = label;
    try {
      await fn();
    } catch (e) {
      if (isSignedOut(e)) return boot();
      toast(messageOf(e), true);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  };
}

/** A button wired to an async action. */
function ActionButton(label: string, busyLabel: string, fn: () => unknown, options?: ButtonOptions): HTMLButtonElement {
  const button = Button(label, options);
  button.addEventListener('click', busy(button, busyLabel, fn));
  return button;
}

/** A form whose submit button runs an async action. */
function SubmitForm(submit: HTMLButtonElement, busyLabel: string, fn: () => unknown, ...children: Child[]): HTMLFormElement {
  const form = Form(children);
  form.addEventListener('submit', busy(submit, busyLabel, fn));
  return form;
}

const asDate = (iso: string): Date => new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
const fmtDate = (iso: string): string => {
  const d = asDate(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
const fmtFull = (iso: string): string => asDate(iso).toLocaleString(locale(), { dateStyle: 'full', timeStyle: 'short' });
const splitAddresses = (s: string): string[] => s.split(/[,;\s]+/).map((a) => a.trim()).filter(Boolean);
const roleLabel = (role: Role): string => (role === 'admin' ? t('role.admin') : t('role.user'));

// ---- state & routing --------------------------------------------------------------------
/** A box of the mailbox: its API id, its URL path and its wording. */
interface Box {
  id: BoxId;
  path: string;
  /** Translation keys of its name and of the text shown when it is empty. */
  label: string;
  empty: string;
}

const BOXES: Box[] = [
  { id: 'todo', path: 'inbox', label: 'box.todo.label', empty: 'box.todo.empty' },
  { id: 'none', path: 'no-reply', label: 'box.none.label', empty: 'box.none.empty' },
  { id: 'sent', path: 'replied', label: 'box.sent.label', empty: 'box.sent.empty' },
  { id: 'ignored', path: 'ignored', label: 'box.ignored.label', empty: 'box.ignored.empty' },
];
/** `label` is a translation key. */
const PAGES: { path: string; label: string; admin?: boolean }[] = [
  { path: 'accounts', label: 'nav.accounts' },
  { path: 'settings', label: 'nav.settings' },
  { path: 'prompts', label: 'nav.prompts', admin: true },
  { path: 'users', label: 'nav.users', admin: true },
];
const isAdmin = (): boolean => state.me?.role === 'admin';

const state: { me: Me | null; counts: Partial<Record<BoxId, number>> } = { me: null, counts: {} };

/** The signed-in user. Only called from pages shown after sign-in. */
const me = (): Me => state.me as Me;

function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [page = '', id] = path.split('/');
  return { page: page || 'inbox', id: id ? Number(id) : null, query: new URLSearchParams(query) };
}

const invitationToken = () => location.hash.match(/^#\/invitation\/([\w-]+)$/)?.[1] || null;

async function boot(): Promise<void> {
  const token = invitationToken();
  if (token) return renderInvitation(token);
  try {
    state.me = await api<Me>('GET', '/me');
    // The server writes on the user's behalf (triage reasons, reply quoting): keep it told of their language.
    if (state.me.language !== language()) void api('PUT', '/settings', { language: language() }).catch(() => {});
  } catch (e) {
    if (!isSignedOut(e)) toast(messageOf(e), true);
    state.me = null;
    return renderAuth();
  }
  render();
}

window.addEventListener('hashchange', () => (invitationToken() ? boot() : state.me && render()));

/** Wraps a page renderer: a lost session goes back to sign-in, any other failure is shown. */
const guard = <A extends unknown[]>(fn: (...args: A) => Promise<void>) => async (...args: A): Promise<void> => {
  try {
    await fn(...args);
  } catch (e) {
    if (isSignedOut(e)) return boot();
    toast(messageOf(e), true);
  }
};

// ---- auth -------------------------------------------------------------------------------
async function renderAuth(mode: 'login' | 'signup' = 'login', typedEmail = ''): Promise<void> {
  const info = await api<PublicInfo>('GET', '/public').catch((): PublicInfo => ({ allowSignup: false }));
  const signup = mode === 'signup' && info.allowSignup;
  const email = Input({ type: 'email', required: true, autocomplete: 'username', value: typedEmail });
  const password = Input({ type: 'password', required: true, minLength: signup ? 10 : 1, autocomplete: signup ? 'new-password' : 'current-password' });
  const organization = Input({ required: true, autocomplete: 'organization' });
  const submit = Button(signup ? t('auth.createAccount') : t('auth.signIn'), { variant: 'primary', type: 'submit', block: true });
  const form = SubmitForm(submit, '…', async () => {
    await api('POST', signup ? '/auth/signup' : '/auth/login', { email: email.value, password: password.value, organization: organization.value, language: language() });
    if (signup) location.hash = '#/accounts';
    await boot();
  },
    signup && Field(t('auth.organization'), organization, { hint: t('auth.organizationHint') }),
    Field(t('auth.email'), email),
    Field(t('auth.password'), password, { hint: signup && t('auth.passwordHint') }),
    submit,
  );

  const foot = info.allowSignup
    ? [signup ? t('auth.haveAccount') : t('auth.noAccountYet'), ' ', Button(signup ? t('auth.signIn') : t('auth.signUp'), { variant: 'link', onClick: () => renderAuth(signup ? 'login' : 'signup', email.value) })]
    : t('auth.askInvitation');

  root.replaceChildren(
    AuthPanel({ brand, tagline: brand.tagline, foot },
      info.firstAccount && Block(Notice('info', t('auth.firstAccount'))),
      form,
      LanguagePicker(),
    ),
  );
  email.focus();
}

/** Landing page of an invitation link: the invited person only chooses a password. */
async function renderInvitation(token: string): Promise<void> {
  const leave = () => {
    // Drop the token from the address bar and the history.
    history.replaceState(null, '', '/');
    return boot();
  };
  let invitation: { email: string; organization: string };
  try {
    invitation = await api<{ email: string; organization: string }>('POST', '/invitations/check', { token });
  } catch (e) {
    return root.replaceChildren(AuthPanel({ brand, tagline: brand.tagline }, Block(Notice('danger', messageOf(e))), Button(t('invitation.goToSignIn'), { onClick: leave })));
  }
  const password = Input({ type: 'password', required: true, minLength: 10, autocomplete: 'new-password' });
  const submit = Button(t('auth.createAccount'), { variant: 'primary', type: 'submit', block: true });
  const form = SubmitForm(submit, '…', async () => {
    await api('POST', '/invitations/accept', { token, password: password.value, language: language() });
    history.replaceState(null, '', '/#/accounts');
    await boot();
  },
    Field(t('auth.email'), Input({ type: 'email', value: invitation.email, disabled: true, autocomplete: 'username' })),
    Field(t('invitation.choosePassword'), password, { hint: t('auth.passwordHint') }),
    submit,
  );
  root.replaceChildren(AuthPanel({ brand, tagline: t('invitation.invited', { organization: invitation.organization, product: brand.name }) }, form));
  password.focus();
}

// ---- shell ------------------------------------------------------------------------------
function shell(content: Child): void {
  const current = route().page;
  const item = (path: string, label: string, count?: number) => ({ href: `#/${path}`, label, count, current: current === path });
  root.replaceChildren(
    AppShell({
      brand,
      sections: [
        { title: t('nav.emails'), items: BOXES.map((b) => item(b.path, t(b.label), state.counts[b.id])) },
        { title: t('nav.configuration'), items: PAGES.filter((p) => !p.admin || isAdmin()).map((p) => item(p.path, t(p.label))) },
      ],
      assurance: {
        text: t('nav.assurance.text'),
        title: t('nav.assurance.title'),
      },
      user: t('nav.member', { email: me().email, organization: me().organization.name }),
      logout: ActionButton(t('nav.signOut'), '…', async () => {
        await api('POST', '/auth/logout');
        location.hash = '';
        await boot();
      }),
    }, content),
  );
}

/** Shows the page of the current URL. Renderers report their own failures, so nothing is awaited. */
function render(): void {
  const r = route();
  const box = BOXES.find((b) => b.path === r.page);
  if (box) void renderMailbox(box, r.id);
  else if (r.page === 'prompts' && isAdmin()) void renderPrompts();
  else if (r.page === 'users' && isAdmin()) void renderUsers();
  else if (r.page === 'accounts') void renderAccounts(r.query.get('error'), r.query.get('detail') ?? '');
  else if (r.page === 'settings') void renderSettings();
  else location.hash = '#/inbox';
}

// ---- mailbox ----------------------------------------------------------------------------
const renderMailbox = guard(async (box: Box, selectedId: number | null) => {
  const [{ emails, counts }, prompts] = await Promise.all([api<EmailList>('GET', `/emails?box=${box.id}`), api<Prompt[]>('GET', '/prompts')]);
  state.counts = counts;

  const refresh = ActionButton(t('mailbox.refresh'), t('mailbox.refreshing'), async () => {
    const accounts = await api<Account[]>('GET', '/accounts');
    if (!accounts.length) return void (location.hash = '#/accounts');
    let fetched = 0;
    const errors: string[] = [];
    for (const a of accounts) {
      const r = await api<SyncResult>('POST', `/accounts/${a.id}/sync`);
      fetched += r.fetched;
      if (r.error) errors.push(t('mailbox.accountError', { account: a.email, error: problemText(r.error) }));
    }
    if (errors.length) toast(errors.join(' — '), true);
    else toast(t('mailbox.fetched', { count: fetched }));
    render();
  }, { title: t('mailbox.refreshTitle') });

  const detail = selectedId ? emailDetail(await api<EmailDetail>('GET', `/emails/${selectedId}`), prompts, box) : null;

  shell(
    Mailbox({
      title: t(box.label),
      action: refresh,
      empty: t(box.empty),
      backHref: `#/${box.path}`,
      backLabel: t('mailbox.back'),
      selectHint: t('mailbox.select'),
      detail,
      items: emails.map((e) =>
        EmailListItem({
          from: e.fromName || e.fromAddr,
          date: fmtDate(e.date),
          subject: e.subject || t('mailbox.noSubject'),
          snippet: e.snippet,
          current: e.id === selectedId,
          onClick: () => (location.hash = `#/${box.path}/${e.id}`),
          badges: [
            // In a shared mailbox, say which: several may be shown together.
            e.shared && Badge(e.account, 'neutral'),
            e.status === 'pending' && Badge(t('mailbox.untriaged'), 'warn'),
            e.priority === 'high' && e.status !== 'sent' && Badge(t('mailbox.priority'), 'danger'),
            e.replyMode === 'draft' && Badge(t('mailbox.draft'), 'neutral'),
          ],
        }),
      ),
    }),
  );
});

/** Who sorted the email, as a badge label. */
function triageSourceLabel(source: EmailDetail['triageSource']): string {
  if (source === 'ai') return t('reading.triage.ai');
  if (source === 'rule') return t('reading.triage.rule');
  if (source === 'user') return t('reading.triage.user');
  return t('reading.triage.unknown');
}

function emailDetail(email: EmailDetail, prompts: Prompt[], box: Box): Child {
  const pending = email.status === 'pending';
  const addresses = (list: { address: string }[]): string => list.map((a) => a.address).join(', ');
  const header = ReadingHeader({
    subject: email.subject || t('mailbox.noSubject'),
    meta: [
      tRich('reading.from', { sender: email.fromName ? `${email.fromName} <${email.fromAddr}>` : email.fromAddr, date: fmtFull(email.date) }, { strong: Strong }),
      email.cc.length
        ? t('reading.toCc', { to: addresses(email.to) || email.account, cc: addresses(email.cc) })
        : t('reading.to', { to: addresses(email.to) || email.account }),
      email.attachments.length > 0 &&
        t('reading.attachments', { count: email.attachments.length, names: email.attachments.map((a) => a.name || a.type).join(', ') }),
    ],
    triage: (email.triageReason || pending) && [
      pending ? Badge(t('mailbox.untriaged'), 'warn') : Badge(triageSourceLabel(email.triageSource), 'neutral'),
      ' ',
      pending ? t('reading.pendingTriage') : email.triageReasonCode ? problemText({ code: email.triageReasonCode, params: {}, message: email.triageReason }) : email.triageReason,
    ],
  });
  const original = Card({}, email.bodyText ? Message(Prose(email.bodyText)) : Text({ muted: true }, t('reading.erased')));

  if (email.status === 'sent' && email.reply) return [header, original, sentReply(email.reply)];
  return [header, original, composer(email, prompts, box)];
}

function sentReply(r: SentReply): Child {
  const draft = r.mode === 'draft';
  const recipients = { date: fmtFull(r.sentAt), to: r.to.join(', '), cc: r.cc.join(', ') };
  const author = r.by && r.by !== me().email ? r.by : null;
  return Card({
    title: draft ? t('reply.draftTitle') : t('reply.sentTitle'),
    badges: [Badge(r.wasEdited ? t('reply.edited') : t('reply.unedited'), r.wasEdited ? 'warn' : 'ok')],
  },
    Block(Text({ muted: true, small: true }, r.cc.length ? t('reply.metaCc', recipients) : t('reply.meta', recipients), author && ` · ${t('reply.by', { user: author })}`)),
    r.changeReason && Block(Text({ small: true }, tRich('reply.changeReason', { reason: r.changeReason }, { strong: Strong }))),
    draft && Block(Notice('info', t('reply.draftNotice'))),
    Message(r.finalHtml ? RichText(r.finalHtml) : Prose(r.finalText || t('reply.textErased'))),
  );
}

/**
 * The reply area. The user writes whatever they want in the one editor — a full reply, a few
 * notes, instructions — then, if they wish, asks the AI to check typos, improve the style, or
 * write the reply with one of the organisation's prompts.
 */
function composer(email: EmailDetail, prompts: Prompt[], box: Box): Child {
  /** The last thing the AI proposed, to tell whether the user changed it since. */
  let proposal: { id: number; action: Draft['action']; text: string } | null = null;
  /** What the editor held before the AI last replaced it, for the user to get it back. */
  let before: string | null = null;
  const suggested = email.suggestedPromptId;
  const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

  const editor = RichEditor({
    placeholder: t('composer.placeholder'),
    labels: {
      bold: t('editor.bold'),
      italic: t('editor.italic'),
      underline: t('editor.underline'),
      bullets: t('editor.bullets'),
      numbers: t('editor.numbers'),
      link: t('editor.link'),
      linkPrompt: t('editor.linkPrompt'),
      clear: t('editor.clear'),
    },
  });
  const promptSelect = Select(prompts.map((p) => ({
    value: p.id,
    label: p.id === suggested ? t('composer.suggested', { name: p.name }) : p.name,
    selected: p.id === (email.draft?.promptId ?? suggested),
  })), { 'aria-label': t('composer.prompt') });
  const to = Input({ value: email.recipients.to.join(', ') });
  const cc = Input();
  const replyAll = Checkbox({ onchange: () => (cc.value = replyAll.checked ? email.recipientsAll.cc.join(', ') : '') });
  const info = Small('');
  const reason = Input({ placeholder: t('composer.reasonPlaceholder') });
  const reasonField = Field(t('composer.reason'), reason, { hint: t('composer.reasonHint') });

  // Only a proposal made with a prompt can teach that prompt something.
  const syncReason = () => (reasonField.hidden = proposal?.action !== 'prompt' || norm(editor.getText()) === norm(proposal.text));
  editor.onChange(syncReason);

  const undo = Button(t('composer.undo'), { variant: 'link', onClick: () => {
    if (before === null) return;
    editor.setHtml(before);
    before = null;
    proposal = null;
    info.textContent = '';
    undo.hidden = true;
    syncReason();
  } });
  undo.hidden = true;

  /** Shows a proposal in the editor and remembers it. */
  const show = (draft: Draft, replaced: string | null): void => {
    before = replaced;
    editor.setHtml(draft.html);
    proposal = { id: draft.id, action: draft.action, text: editor.getText() };
    const by = draft.provider ? t('composer.generatedVia', { model: draft.model, provider: draft.provider }) : t('composer.generatedBy', { model: draft.model });
    const done = { typos: t('composer.done.typos'), style: t('composer.done.style'), prompt: t('composer.done.prompt') }[draft.action];
    info.textContent = `${done} ${by}`;
    undo.hidden = replaced === null;
    syncReason();
  };
  if (email.draft) show(email.draft, null);
  else syncReason();

  const assist = (action: Draft['action']) => async (): Promise<void> => {
    const html = editor.getHtml();
    show(await api<Draft>('POST', `/emails/${email.id}/assist`, { action, html, promptId: action === 'prompt' ? Number(promptSelect.value) : undefined }), html);
  };
  const typos = ActionButton(t('composer.typos'), t('composer.working'), assist('typos'), { title: t('composer.typosTitle') });
  const style = ActionButton(t('composer.style'), t('composer.working'), assist('style'), { title: t('composer.styleTitle') });
  const apply = ActionButton(t('composer.applyPrompt'), t('composer.working'), assist('prompt'), { title: t('composer.applyPromptTitle') });

  const payload = () => ({
    draftId: proposal?.id,
    html: editor.getHtml(),
    to: splitAddresses(to.value),
    cc: splitAddresses(cc.value),
    changeReason: reasonField.hidden ? '' : reason.value,
  });
  const done = (message: string): void => {
    toast(message);
    location.hash = `#/${box.path}`;
  };
  const send = ActionButton(t('composer.send'), t('composer.sending'), async () => {
    const reply = payload();
    if (!confirm(t('composer.confirmSend', { account: email.account, recipients: reply.to.join(', ') }))) return;
    await api('POST', `/emails/${email.id}/send`, reply);
    done(t('composer.sent'));
  }, { variant: 'primary' });
  const saveDraft = ActionButton(t('composer.saveDraft'), t('composer.savingDraft'), async () => {
    await api('POST', `/emails/${email.id}/save-draft`, payload());
    done(t('composer.draftSaved', { account: email.account }));
  }, { title: t('composer.saveDraftTitle') });

  const setStatus = (status: string, message: string) => async (): Promise<void> => {
    await api('POST', `/emails/${email.id}/status`, { status });
    done(message);
  };
  const triageActions = ['needs_reply', 'pending'].includes(email.status)
    ? [ActionButton(t('composer.noReplyNeeded'), '…', setStatus('no_reply', t('composer.markedNoReply'))), ActionButton(t('composer.ignore'), '…', setStatus('ignored', t('composer.ignored')))]
    : ActionButton(t('composer.restore'), '…', setStatus('needs_reply', t('composer.restored')));

  return Card({ title: t('composer.title') },
    !me().hasKey && Block(Notice('warn', tRich('composer.noKey', {}, { link: (label) => Link(label, '#/settings') }))),
    FormRow(Field(t('composer.to'), to), Field(t('composer.cc'), cc)),
    email.recipientsAll.cc.length > 0 && CheckField(t('composer.replyAll'), replyAll),
    Block(editor.element),
    CardSection(t('composer.help'),
      Block(Text({ muted: true, small: true }, t('composer.helpText'))),
      Block(Actions(typos, style)),
      prompts.length
        ? FormRow(Field(null, promptSelect), Field(null, apply, { size: 'fit' }))
        : Notice('warn', isAdmin() ? tRich('composer.noPromptAdmin', {}, { link: (label) => Link(label, '#/prompts') }) : t('composer.noPrompt')),
      Block(Text({ small: true }, info, ' ', undo)),
    ),
    reasonField,
    Actions(send, saveDraft, Spacer(), triageActions),
  );
}

// ---- prompts (administrators) -----------------------------------------------------------
const renderPrompts = guard(async () => {
  const prompts = await api<Prompt[]>('GET', '/prompts');

  async function editor(prompt: Prompt | null): Promise<void> {
    const items = prompt ? await api<Correction[]>('GET', `/prompts/${prompt.id}/corrections`).catch((): Correction[] => []) : [];
    const name = Input({ required: true, value: prompt?.name || '' });
    const description = Input({ value: prompt?.description || '' });
    const system = Textarea({ required: true, rows: 7, value: prompt?.systemPrompt || '' });
    const save = Button(prompt ? t('common.save') : t('prompts.create'), { variant: 'primary', type: 'submit' });
    const form = SubmitForm(save, '…', async () => {
      const body = { name: name.value, description: description.value, systemPrompt: system.value };
      await (prompt ? api('PUT', `/prompts/${prompt.id}`, body) : api('POST', '/prompts', body));
      toast(t('prompts.saved'));
      renderPrompts();
    },
      Field(t('prompts.name'), name),
      Field(t('prompts.when'), description, { hint: t('prompts.whenHint') }),
      Field(t('prompts.instructions'), system, { hint: t('prompts.instructionsHint') }),
      items.length > 0 && CardSection(t('prompts.corrections'),
        Block(Text({ muted: true, small: true }, t('prompts.correctionsHint'))),
        Block(List(items.map((c) => [c.reason, Muted(t('prompts.correctionBy', { user: c.user, date: fmtDate(c.at) }))]))),
      ),
      Actions(save, Button(t('common.cancel'), { onClick: () => renderPrompts() })),
    );
    shell(Page(Heading(1, t('prompts.title')), Card({ title: prompt ? t('prompts.edit') : t('prompts.new') }, form)));
    name.focus();
  }

  shell(
    Page(
      PageHeader(t('prompts.title'), Spacer(), Button(t('prompts.new'), { variant: 'primary', onClick: () => editor(null) })),
      Block(Text({ muted: true }, t('prompts.intro'))),
      prompts.map((p) =>
        Card({ title: p.name, badges: [(p.used ?? 0) > 0 && Badge(t('prompts.usage', { used: p.used ?? 0, edited: p.edited ?? 0 }), 'neutral')] },
          p.description && Block(Text({ muted: true }, p.description)),
          Block(Text({ small: true }, p.systemPrompt)),
          Actions(
            Button(t('common.edit'), { onClick: () => editor(p) }),
            ActionButton(t('common.delete'), '…', async () => {
              if (!confirm(t('prompts.confirmDelete', { name: p.name }))) return;
              await api('DELETE', `/prompts/${p.id}`);
              renderPrompts();
            }, { variant: 'danger' }),
          ),
        ),
      ),
    ),
  );
});

// ---- users (administrators) -------------------------------------------------------------
const renderUsers = guard(async (freshInvitation?: NewInvitation) => {
  const [users, invitations] = await Promise.all([api<User[]>('GET', '/users'), api<Invitation[]>('GET', '/invitations')]);

  const email = Input({ type: 'email', required: true, placeholder: t('users.emailPlaceholder') });
  const role = Select([{ value: 'user', label: t('role.user') }, { value: 'admin', label: t('role.admin') }]);
  const invite = Button(t('users.createLink'), { variant: 'primary', type: 'submit' });
  const inviteForm = SubmitForm(invite, '…', async () => renderUsers(await api<NewInvitation>('POST', '/invitations', { email: email.value, role: role.value })),
    FormRow(Field(t('users.email'), email), Field(t('users.role'), role, { size: 'narrow' }), Field(null, invite, { size: 'fit' })),
  );

  let freshLink: Child = null;
  if (freshInvitation?.link) {
    const link = Input({ readOnly: true, value: freshInvitation.link, onfocus: () => link.select() });
    const copy = Button(t('common.copy'), {
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(freshInvitation.link);
          toast(t('users.linkCopied'));
        } catch {
          link.focus();
          toast(t('users.copyFailed'), true);
        }
      },
    });
    freshLink = [
      Block(Notice('ok', tRich('users.linkReady', { email: freshInvitation.email, days: freshInvitation.validDays }, { strong: Strong }))),
      FormRow(Field(null, link), Field(null, copy, { size: 'fit' })),
    ];
  }

  shell(
    Page(
      Heading(1, t('users.title')),
      Block(Text({ muted: true }, t('users.intro', { organization: me().organization.name }))),
      Card({ title: t('users.invite') },
        freshLink,
        inviteForm,
        invitations.length > 0 && CardSection(t('users.pending'),
          invitations.map((i) =>
            Actions(
              i.email,
              Badge(roleLabel(i.role), 'neutral'),
              i.expired ? Small(t('users.expired')) : Small(Muted(t('users.expiresOn', { date: fmtFull(i.expiresAt) }))),
              Spacer(),
              ActionButton(t('users.revoke'), '…', async () => {
                await api('DELETE', `/invitations/${i.id}`);
                renderUsers();
              }, { variant: 'link' }),
            ),
          ),
        ),
      ),
      users.map((u) => {
        const admin = u.role === 'admin';
        const self = u.email === me().email;
        return Card({ title: u.email, badges: [Badge(roleLabel(u.role), admin ? 'accent' : 'neutral'), self && Badge(t('users.you'), 'neutral')] },
          Block(Text({ muted: true, small: true }, t('users.summary', { date: fmtFull(u.createdAt), count: u.accounts }))),
          Actions(
            ActionButton(admin ? t('users.demote') : t('users.promote'), '…', async () => {
              await api('PUT', `/users/${u.id}`, { role: admin ? 'user' : 'admin' });
              if (self) return boot();
              renderUsers();
            }),
            !self && ActionButton(t('users.delete'), '…', async () => {
              if (!confirm(t('users.confirmDelete', { email: u.email }))) return;
              await api('DELETE', `/users/${u.id}`);
              renderUsers();
            }, { variant: 'danger' }),
          ),
        );
      }),
    ),
  );
});

// ---- accounts ---------------------------------------------------------------------------
/**
 * Lets the user choose the one folder of a mailbox to watch. The folders are asked of the
 * mailbox when the chooser appears, with the inbox first and preselected.
 */
function FolderChooser(account: Account): HTMLElement {
  const select = Select([{ value: '', label: t('accounts.loadingFolders') }], { disabled: true });
  const confirm = ActionButton(t('accounts.useFolder'), '…', async () => {
    await api('PUT', `/accounts/${account.id}/folder`, { folder: select.value });
    toast(t('accounts.folderChosen'));
    void renderAccounts();
  });
  confirm.disabled = true;
  api<MailFolder[]>('GET', `/accounts/${account.id}/folders`)
    .then((folders) => {
      const current = account.folder ?? folders[0]?.id;
      select.replaceChildren(...Select(folders.map((f) => ({ value: f.id, label: f.name }))).children);
      // Set once the options are in place: an option moved between lists does not keep its selection.
      if (current) select.value = current;
      select.disabled = false;
      confirm.disabled = false;
    })
    .catch((e) => toast(messageOf(e), true));
  return Block(FormRow(Field(t('accounts.folder'), select), Field(null, confirm, { size: 'fit' })));
}

/** Kinds of mailbox are product names: the same in every language. */
const KIND: Record<Account['kind'], string> = { imap: 'IMAP / SMTP', google: 'Google', microsoft: 'Microsoft' };

const renderAccounts = guard(async (oauthError?: string | null, oauthDetail?: string) => {
  const accounts = await api<Account[]>('GET', '/accounts');
  const { oauth } = me();

  // Administrators may connect a mailbox for the whole organisation. The choice applies to
  // whichever way of connecting is used next.
  const shared = Checkbox();
  const oauthLinks: { kind: string; link: HTMLElement }[] = [];
  const oauthButton = (kind: 'google' | 'microsoft', label: string) => {
    const link = ButtonLink(label, { href: `/api/oauth/${kind}/start`, disabled: !oauth[kind], title: oauth[kind] ? undefined : t('accounts.oauthUnavailable', { prefix: kind.toUpperCase() }) });
    oauthLinks.push({ kind, link });
    return link;
  };
  shared.addEventListener('change', () => {
    for (const { kind, link } of oauthLinks) if (link instanceof HTMLAnchorElement) link.href = `/api/oauth/${kind}/start${shared.checked ? '?shared=1' : ''}`;
  });

  const email = Input({ type: 'email', required: true });
  const displayName = Input({ placeholder: t('accounts.namePlaceholder') });
  const username = Input({ placeholder: t('accounts.usernamePlaceholder'), autocomplete: 'off' });
  const password = Input({ type: 'password', required: true, autocomplete: 'new-password' });
  const imapHost = Input({ required: true, placeholder: t('accounts.imapPlaceholder') });
  const imapPort = Input({ type: 'number', required: true, value: 993, min: 1, max: 65535 });
  const imapSecure = Checkbox({ checked: true });
  const smtpHost = Input({ required: true, placeholder: t('accounts.smtpPlaceholder') });
  const smtpPort = Input({ type: 'number', required: true, value: 465, min: 1, max: 65535 });
  const smtpSecure = Checkbox({ checked: true });
  imapPort.addEventListener('input', () => (imapSecure.checked = imapPort.value === '993'));
  smtpPort.addEventListener('input', () => (smtpSecure.checked = smtpPort.value === '465'));
  const connect = Button(t('accounts.connect'), { variant: 'primary', type: 'submit' });
  const form = SubmitForm(connect, t('accounts.connecting'), async () => {
    await api('POST', '/accounts/imap', {
      email: email.value, displayName: displayName.value, username: username.value, password: password.value,
      imapHost: imapHost.value, imapPort: Number(imapPort.value), imapSecure: imapSecure.checked,
      smtpHost: smtpHost.value, smtpPort: Number(smtpPort.value), smtpSecure: smtpSecure.checked,
      shared: shared.checked,
    });
    toast(t('accounts.connected'));
    renderAccounts();
  },
    FormRow(Field(t('accounts.email'), email), Field(t('accounts.name'), displayName)),
    FormRow(Field(t('accounts.username'), username), Field(t('accounts.password'), password)),
    FormRow(Field(t('accounts.imapServer'), imapHost), Field(t('accounts.port'), imapPort, { size: 'narrow' }), CheckField(t('accounts.directTls'), imapSecure, { size: 'narrow' })),
    FormRow(Field(t('accounts.smtpServer'), smtpHost), Field(t('accounts.port'), smtpPort, { size: 'narrow' }), CheckField(t('accounts.directTls'), smtpSecure, { size: 'narrow' })),
    Block(Text({ muted: true, small: true }, t('accounts.tlsHint'))),
    connect,
  );

  shell(
    Page(
      Heading(1, t('accounts.title')),
      oauthError && Block(Notice('danger', problemText({ code: oauthError, params: { detail: oauthDetail ?? '' }, message: oauthDetail || oauthError }))),
      accounts.length === 0 && Block(Notice('info', t('accounts.none'))),
      accounts.map((a) =>
        Card({ title: a.email, badges: [a.shared && Badge(t('accounts.shared')), Badge(KIND[a.kind], 'neutral'), a.todo > 0 && Badge(t('accounts.todo', { count: a.todo }))] },
          a.folder
            ? Block(Text({ muted: true, small: true }, t('accounts.watching', { folder: a.folderName }), ' · ', a.lastSyncAt ? t('accounts.lastSync', { date: fmtFull(a.lastSyncAt) }) : t('accounts.neverSynced')))
            : Block(Notice('info', a.canManage ? t('accounts.chooseFolder') : t('accounts.folderPending'))),
          a.lastError && a.folder && Block(Notice('danger', problemText(a.lastError))),
          // A mailbox that has no folder yet opens on the choice; later it is behind a button.
          a.folder || !a.canManage ? null : FolderChooser(a),
          Actions(
            a.folder && a.canManage && Button(t('accounts.changeFolder'), { onClick: (event) => (event.target as HTMLElement).replaceWith(FolderChooser(a)) }),
            a.folder && ActionButton(t('accounts.syncNow'), t('mailbox.refreshing'), async () => {
              const r = await api<SyncResult>('POST', `/accounts/${a.id}/sync`);
              if (r.error) toast(problemText(r.error), true);
              else toast(t('mailbox.fetched', { count: r.fetched }));
              renderAccounts();
            }),
            a.canManage && ActionButton(t('accounts.disconnect'), '…', async () => {
              if (!confirm(t('accounts.confirmDisconnect', { email: a.email }))) return;
              await api('DELETE', `/accounts/${a.id}`);
              renderAccounts();
            }, { variant: 'danger' }),
          ),
        ),
      ),
      isAdmin() && Card({ title: t('accounts.sharedTitle') },
        Block(Text({ muted: true }, t('accounts.sharedIntro', { organization: me().organization.name }))),
        CheckField(t('accounts.sharedCheck'), shared),
      ),
      Card({ title: t('accounts.oauthTitle') },
        Block(Text({ muted: true }, t('accounts.oauthIntro'))),
        Actions(oauthButton('google', t('accounts.connectGoogle')), oauthButton('microsoft', t('accounts.connectMicrosoft'))),
      ),
      Card({ title: t('accounts.imapTitle') }, form),
    ),
  );
});

// ---- settings ---------------------------------------------------------------------------
/** A language selector, when there is more than one language to choose from. */
function LanguagePicker(): Child {
  if (languages().length < 2) return null;
  const select = Select(languages().map((l) => ({ value: l.tag, label: l.name, selected: l.tag === language() })), { onchange: () => setLanguage(select.value) });
  return Field(t('settings.language'), select);
}

/** The organisation's own settings, for its administrators. */
function OrganizationSettings(me: Me): Child {
  const org = me.organization;
  const name = Input({ required: true, value: org.name });
  const triage = Select([
    { value: 'none', label: t('organization.triageNone'), selected: org.triage === 'none' },
    { value: 'ai', label: t('organization.triageAi'), selected: org.triage === 'ai' },
  ]);
  const skipAutomated = Checkbox({ checked: org.skipAutomated });
  const model = Input({ value: org.model ?? '', placeholder: t('organization.modelPlaceholder') });
  const key = Input({ type: 'password', autocomplete: 'off', placeholder: org.hasKey ? t('settings.keySaved') : 'sk-or-…' });
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  const form = SubmitForm(save, '…', async () => {
    const body: Record<string, unknown> = { name: name.value, triage: triage.value, skipAutomated: skipAutomated.checked, model: model.value };
    if (key.value) body.openrouterKey = key.value;
    await api('PUT', '/organization', body);
    toast(t('settings.saved'));
    void renderSettings();
  },
    Field(t('organization.name'), name),
    Field(t('organization.triage'), triage, { hint: t('organization.triageHint') }),
    CheckField(t('organization.skipAutomated'), skipAutomated),
    Field(t('organization.model'), model, { hint: t('organization.modelHint') }),
    Field(t('organization.key'), key, { hint: org.hasKey ? t('settings.keyHintOwn') : t('organization.keyHint') }),
    Actions(save, org.hasKey && ActionButton(t('organization.deleteKey'), '…', async () => {
      await api('PUT', '/organization', { openrouterKey: '' });
      toast(t('settings.keyDeleted'));
      void renderSettings();
    }, { variant: 'danger' })),
  );
  return Card({ title: t('organization.title') }, Block(Text({ muted: true }, t('organization.intro'))), form);
}

const renderSettings = guard(async () => {
  const me = (state.me = await api<Me>('GET', '/me'));
  const model = Input({ value: me.model, placeholder: me.defaultModel });
  const signature = Textarea({ rows: 4, placeholder: t('settings.signaturePlaceholder'), value: me.signature });
  const key = Input({ type: 'password', autocomplete: 'off', placeholder: me.hasOwnKey ? t('settings.keySaved') : me.hasKey ? t('settings.keyServer') : 'sk-or-…' });
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  const form = SubmitForm(save, '…', async () => {
    const body: { model: string; signature: string; openrouterKey?: string } = { model: model.value === me.defaultModel ? '' : model.value, signature: signature.value };
    if (key.value) body.openrouterKey = key.value;
    await api('PUT', '/settings', body);
    toast(t('settings.saved'));
    renderSettings();
  },
    Field(t('settings.model'), model, { hint: t('settings.modelHint', { model: me.defaultModel }) }),
    Field(t('settings.signature'), signature, { hint: t('settings.signatureHint') }),
    Field(t('settings.key'), key, { hint: me.hasOwnKey ? t('settings.keyHintOwn') : t('settings.keyHint') }),
    Actions(save, me.hasOwnKey && ActionButton(t('settings.deleteKey'), '…', async () => {
      await api('PUT', '/settings', { openrouterKey: '' });
      toast(t('settings.keyDeleted'));
      renderSettings();
    }, { variant: 'danger' })),
  );

  shell(
    Page(
      Heading(1, t('settings.title')),
      !me.hasKey && Block(Notice('warn', t('settings.noKey'))),
      Card({ title: t('settings.writing') }, form),
      languages().length > 1 && Card({ title: t('settings.display') }, LanguagePicker()),
      isAdmin() && OrganizationSettings(me),
      Card({ title: t('settings.privacy') },
        List([
          tRich('settings.privacyPolicy', { policy: `provider: ${JSON.stringify(me.privacy)}` }, { code: Code }),
          t('settings.privacyLogging'),
          me.organization.triage === 'ai' ? t('settings.privacyTriageAi') : t('settings.privacyTriageNone'),
          me.retentionDays ? t('settings.privacyRetention', { days: me.retentionDays }) : t('settings.privacyNoRetention'),
          t('settings.privacyEncryption'),
          t('settings.privacyValidation'),
          t('settings.privacyReasons'),
        ]),
      ),
      isAdmin() && Card({ title: t('settings.appearance') },
        Text({}, tRich('settings.appearanceText', {}, { link: (label) => Link(label, '/styleguide.html') })),
      ),
    ),
  );
});

// Translations first: the brand's tagline and every screen depend on the language.
initI18n()
  .then(() => loadBrand(language()))
  .then((loaded) => {
    brand = loaded;
    void boot();
  });
