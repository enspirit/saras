// Pages of the application. They hold behaviour only: every element on screen comes from
// the design system in ./ui (atoms, molecules, organisms) and every word from the
// translation files, through t() and tRich(). Tests enforce both.
import { Badge, Button, ButtonLink, Checkbox, Code, Heading, Input, Link, List, Muted, Notice, Prose, RichText, Select, Small, Spacer, Strong, Text, Textarea, setBusy } from './ui/atoms.ts';
import { Actions, AiHelp, AiNote, Assurance, Block, Callout, Card, CardSection, Caution, CheckField, Choices, EmailListItem, EmptyState, Facts, Features, Field, Form, FormRow, Loading, Message, NavItem, PageHeader, Panel, Person, PromptPick, ReasonField, RecipientField, Remark, RichEditor, Steps, Table, Tabs, confirmDialog, createToast } from './ui/molecules.ts';
import { AppShell, AuthPanel, ClosedDock, Columns, Mailbox, Page, Reading, ReadingHeader, ReplyDock } from './ui/organisms.ts';
import { loadBrand } from './ui/brand.ts';
import type { Brand, ButtonOptions, IconName } from './ui/atoms.ts';
import type { Child } from './ui/dom.ts';
import { api, isSignedOut, problemText } from './api.ts';
import { initI18n, language, languages, locale, setLanguage, t, tRich } from './i18n.ts';
import { serversFor } from './mail-presets.ts';
import type { MailServers } from './mail-presets.ts';
import type { Account, BoxId, MailFolder, MailHost, Correction, Draft, EmailDetail, EmailList, Invitation, Me, NewInvitation, Prompt, PromptTemplate, PublicInfo, Role, SentReply, SyncResult, User } from './api.ts';

const root = document.getElementById('app') as HTMLElement;
const toast = createToast(document.getElementById('toast') as HTMLElement);
let brand: Brand = { name: '', tagline: '', logo: null, logoDark: null, byline: '', credit: '', euHosting: false };

// ---- helpers ----------------------------------------------------------------------------
/** Asks before an action that cannot be taken back, in the interface's own dialog. */
const confirmAction = (text: string, confirmLabel: string, danger = true): Promise<boolean> => confirmDialog({ text, confirmLabel, cancelLabel: t('common.cancel'), danger });

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Run an async action from a button: disables it meanwhile and reports failures. */
function busy(button: HTMLButtonElement, label: string, fn: () => unknown) {
  return async (event?: Event): Promise<void> => {
    event?.preventDefault();
    // The button keeps its label and its width; a spinner shows the wait, and `label` names it to screen readers.
    const name = button.getAttribute('aria-label');
    setBusy(button, true);
    if (label.length > 1) button.setAttribute('aria-label', label);
    try {
      await fn();
    } catch (e) {
      if (isSignedOut(e)) return boot();
      toast(messageOf(e), true);
    } finally {
      setBusy(button, false);
      if (name === null) button.removeAttribute('aria-label');
      else button.setAttribute('aria-label', name);
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
/** Day and time, short: for the head of an email or of a reply. */
const fmtWhen = (iso: string): string => {
  const d = asDate(iso);
  return d.toDateString() === new Date().toDateString() ? fmtDate(iso) : d.toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const fmtFull = (iso: string): string => asDate(iso).toLocaleString(locale(), { dateStyle: 'full', timeStyle: 'short' });
const splitAddresses = (s: string): string[] => s.split(/[,;\s]+/).map((a) => a.trim()).filter(Boolean);
/** How a person is shown: by their name when they gave one, by their address otherwise. */
const called = (name: string | null | undefined, email: string): string => name?.trim() || email;
const fmtDay = (iso: string): string => asDate(iso).toLocaleDateString(locale(), { dateStyle: 'medium' });
const roleLabel = (role: Role): string => (role === 'admin' ? t('role.admin') : t('role.user'));

// ---- state & routing --------------------------------------------------------------------
/** A box of the mailbox: its API id, its URL path and its wording. */
interface Box {
  id: BoxId;
  path: string;
  /** Translation keys of its name and of the text shown when it is empty. */
  label: string;
  empty: string;
  icon: IconName;
}

const BOXES: Box[] = [
  { id: 'todo', path: 'inbox', label: 'box.todo.label', empty: 'box.todo.empty', icon: 'mail' },
  { id: 'none', path: 'no-reply', label: 'box.none.label', empty: 'box.none.empty', icon: 'mail-check' },
  { id: 'sent', path: 'replied', label: 'box.sent.label', empty: 'box.sent.empty', icon: 'reply' },
  { id: 'ignored', path: 'ignored', label: 'box.ignored.label', empty: 'box.ignored.empty', icon: 'archive' },
];
/** `label` is a translation key. */
const PAGES: { path: string; label: string; icon: IconName; admin?: boolean }[] = [
  { path: 'accounts', label: 'nav.accounts', icon: 'plug' },
  { path: 'prompts', label: 'nav.prompts', icon: 'file-text', admin: true },
  { path: 'users', label: 'nav.users', icon: 'users', admin: true },
  { path: 'settings', label: 'nav.settings', icon: 'settings' },
];
const isAdmin = (): boolean => state.me?.role === 'admin';

const state: { me: Me | null; counts: Partial<Record<BoxId, number>> } = { me: null, counts: {} };

/** The signed-in user. Only called from pages shown after sign-in. */
const me = (): Me => state.me as Me;

/** `#/page/12`, `#/page/part` or `#/page/part/12`: a page, optionally one of its parts, optionally one thing by its number. */
function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [page = '', first = '', second = ''] = path.split('/');
  const numbered = /^\d+$/.test(first);
  return { page: page || 'inbox', part: numbered ? '' : first, id: numbered ? Number(first) : second ? Number(second) : null, query: new URLSearchParams(query) };
}

const invitationToken = () => location.hash.match(/^#\/invitation\/([\w-]+)$/)?.[1] || null;

async function boot(): Promise<void> {
  const token = invitationToken();
  if (token) return renderInvitation(token);
  // Nothing on screen yet: say that something is coming rather than show a blank page.
  if (!root.hasChildNodes()) root.replaceChildren(Loading(t('common.loading')));
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
/** What the installation guarantees, said where a visitor first meets it. */
const guarantees = (info: PublicInfo) => [
  brand.euHosting && { icon: 'shield-check' as const, title: t('auth.pointEuTitle'), text: t('auth.pointEu') },
  { icon: 'lock' as const, text: t('auth.pointZdr') },
  { icon: 'eye-off' as const, text: t('auth.pointMinimal') },
  info.retentionDays ? { icon: 'timer' as const, text: t('settings.privacyRetention', { days: info.retentionDays }) } : null,
  { icon: 'check' as const, text: t('settings.privacyValidation') },
].filter((point) => point !== null && point !== false);

async function renderAuth(mode: 'login' | 'signup' = 'login', typedEmail = ''): Promise<void> {
  const info = await api<PublicInfo>('GET', '/public').catch((): PublicInfo => ({ allowSignup: false }));
  const signup = mode === 'signup' && info.allowSignup;
  const email = Input({ type: 'email', required: true, autocomplete: 'username', value: typedEmail });
  const password = Input({ type: 'password', required: true, minLength: signup ? 10 : 1, autocomplete: signup ? 'new-password' : 'current-password' });
  const organization = Input({ required: true, autocomplete: 'organization' });
  const name = Input({ autocomplete: 'name' });
  const submit = Button(signup ? t('auth.createAccount') : t('auth.signIn'), { variant: 'primary', size: 'large', type: 'submit', block: true });
  const form = SubmitForm(submit, '…', async () => {
    await api('POST', signup ? '/auth/signup' : '/auth/login', { email: email.value, password: password.value, organization: organization.value, name: name.value, language: language() });
    if (signup) location.hash = '#/accounts';
    await boot();
  },
    signup && Field(t('auth.organization'), organization, { hint: t('auth.organizationHint') }),
    signup && Field(t('auth.name'), name, { hint: t('auth.nameHint') }),
    Field(t('auth.email'), email),
    Field(t('auth.password'), password, { hint: signup && t('auth.passwordHint') }),
    submit,
  );

  const foot = info.allowSignup
    ? [signup ? t('auth.haveAccount') : t('auth.noAccountYet'), ' ', Button(signup ? t('auth.signIn') : t('auth.signUp'), { variant: 'link', onClick: () => renderAuth(signup ? 'login' : 'signup', email.value) })]
    : t('auth.askInvitation');

  root.replaceChildren(
    AuthPanel({ brand, tagline: brand.tagline, points: guarantees(info), title: signup ? t('auth.signUp') : t('auth.signIn'), intro: info.firstAccount && t('auth.firstAccount'), tools: LanguagePicker(), foot }, form),
  );
  (signup ? organization : email).focus();
}

/** Landing page of an invitation link: the invited person gives their name and chooses a password. */
async function renderInvitation(token: string): Promise<void> {
  const leave = () => {
    // Drop the token from the address bar and the history.
    history.replaceState(null, '', '/');
    return boot();
  };
  const info = await api<PublicInfo>('GET', '/public').catch((): PublicInfo => ({ allowSignup: false }));
  let invitation: { email: string; organization: string };
  try {
    invitation = await api<{ email: string; organization: string }>('POST', '/invitations/check', { token });
  } catch (e) {
    return root.replaceChildren(AuthPanel({ brand, tagline: brand.tagline, points: guarantees(info), title: t('invitation.title') }, Notice('danger', messageOf(e)), Button(t('invitation.goToSignIn'), { onClick: leave })));
  }
  const name = Input({ autocomplete: 'name' });
  const password = Input({ type: 'password', required: true, minLength: 10, autocomplete: 'new-password' });
  const submit = Button(t('auth.createAccount'), { variant: 'primary', size: 'large', type: 'submit', block: true });
  const form = SubmitForm(submit, '…', async () => {
    await api('POST', '/invitations/accept', { token, password: password.value, name: name.value, language: language() });
    history.replaceState(null, '', '/#/accounts');
    await boot();
  },
    Field(t('auth.email'), Input({ type: 'email', value: invitation.email, disabled: true, autocomplete: 'username' })),
    Field(t('auth.name'), name, { hint: t('auth.nameHint') }),
    Field(t('invitation.choosePassword'), password, { hint: t('auth.passwordHint') }),
    submit,
  );
  root.replaceChildren(
    AuthPanel({ brand, tagline: brand.tagline, points: guarantees(info), title: t('invitation.title'), intro: t('invitation.invited', { organization: invitation.organization, product: brand.name }), tools: LanguagePicker() }, form),
  );
  name.focus();
}

// ---- shell ------------------------------------------------------------------------------
const pagesOfUser = () => PAGES.filter((p) => !p.admin || isAdmin());
const assurance = () => ({ text: t('nav.assurance.text'), title: t('nav.assurance.title') });
const signOut = (options: ButtonOptions): HTMLButtonElement => ActionButton(t('nav.signOut'), '…', async () => {
  await api('POST', '/auth/logout');
  location.hash = '';
  await boot();
}, options);

function shell(content: Child): void {
  const current = route().page;
  const item = (path: string, label: string, icon: IconName, count?: number) => ({ href: `#/${path}`, label, icon, count, current: current === path });
  const pages = pagesOfUser();
  root.replaceChildren(
    AppShell({
      brand,
      boxes: BOXES.map((b) => item(b.path, t(b.label), b.icon, state.counts[b.id])),
      pages: { title: t('nav.configuration'), items: pages.map((p) => item(p.path, t(p.label), p.icon)) },
      // On a phone the boxes fill the bar: this entry leads to everything else.
      more: { href: '#/more', label: t('nav.more'), icon: 'settings', current: current === 'more' || pages.some((p) => p.path === current) },
      assurance: assurance(),
      user: { name: called(me().name, me().email), organization: me().organization.name },
      logout: signOut({ variant: 'ghost', icon: 'log-out', iconOnly: true }),
    }, content),
  );
}

/** On a phone: the configuration pages, who is signed in, and the way out. */
function renderMore(): void {
  shell(
    Page(
      PageHeader({ title: called(me().name, me().email), intro: me().organization.name }),
      Card({}, pagesOfUser().map((p) => NavItem({ href: `#/${p.path}`, label: t(p.label), icon: p.icon }))),
      Block(Assurance(assurance().text, assurance().title)),
      signOut({ icon: 'log-out' }),
    ),
  );
}

/** Shows the page of the current URL. Renderers report their own failures, so nothing is awaited. */
function render(): void {
  const r = route();
  const box = BOXES.find((b) => b.path === r.page);
  if (box) void renderMailbox(box, r.id);
  else if (r.page === 'prompts' && isAdmin()) void renderPrompts(r.part === 'new' ? 'new' : r.id);
  else if (r.page === 'users' && isAdmin()) void renderUsers();
  else if (r.page === 'accounts') void renderAccounts(r.part, r.id, r.query.get('error'), r.query.get('detail') ?? '');
  else if (r.page === 'settings') void renderSettings(r.part);
  else if (r.page === 'more') renderMore();
  else if (r.page === 'welcome' && r.part === 'key' && needsKey()) keyPage();
  else if (r.page === 'welcome' && r.part === 'prompt' && isAdmin()) void promptStep();
  else if (r.page === 'welcome' && r.part === 'work' && isAdmin()) void workStep();
  else if (r.page === 'welcome') void openFirstEmail();
  else location.hash = '#/inbox';
}

// ---- mailbox ----------------------------------------------------------------------------
const renderMailbox = guard(async (box: Box, selectedId: number | null) => {
  const [{ emails, counts }, prompts, accounts] = await Promise.all([api<EmailList>('GET', `/emails?box=${box.id}`), api<Prompt[]>('GET', '/prompts'), api<Account[]>('GET', '/accounts')]);
  state.counts = counts;
  const lastFetch = accounts.map((a) => a.lastSyncAt ?? '').filter(Boolean).sort().pop();

  const refresh = ActionButton(t('mailbox.refresh'), t('mailbox.refreshing'), async () => {
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
  }, { variant: 'ghost', icon: 'refresh-cw', iconOnly: true, title: t('mailbox.refreshTitle') });

  const detail = selectedId ? emailDetail(await api<EmailDetail>('GET', `/emails/${selectedId}`), prompts, box) : null;

  shell(
    Mailbox({
      title: t(box.label),
      count: emails.length,
      meta: lastFetch ? t('mailbox.fetchedAt', { time: fmtWhen(lastFetch) }) : undefined,
      action: refresh,
      // With no mailbox connected yet, the empty box leads to where one is connected.
      empty: EmptyState(t(box.empty), { icon: box.icon, action: !accounts.length && ButtonLink(t('nav.accounts'), { href: '#/accounts', variant: 'primary' }) }),
      backHref: `#/${box.path}`,
      backLabel: t('mailbox.back'),
      idle: emails.length > 0 && EmptyState(t('mailbox.select'), { icon: box.icon, title: t('mailbox.count', { count: emails.length }) }),
      detail,
      items: emails.map((e) =>
        EmailListItem({
          from: e.fromName || e.fromAddr,
          date: fmtDate(e.date),
          subject: e.subject || t('mailbox.noSubject'),
          snippet: e.snippet,
          current: e.id === selectedId,
          onClick: () => (location.hash = `#/${box.path}/${e.id}`),
          tags: [
            e.priority === 'high' && e.status !== 'sent' && Badge(t('mailbox.priority'), 'warn'),
            e.status === 'pending' && Badge(t('mailbox.untriaged'), 'neutral'),
            e.replyMode === 'draft' && Badge(t('mailbox.draft'), 'neutral'),
          ],
          // In a shared mailbox, say which: several may be shown together.
          shared: e.shared ? { label: e.account.split('@')[0] ?? e.account, title: e.account } : undefined,
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
  const waiting = pending || email.status === 'needs_reply';
  const names = (list: { name: string; address: string }[]): string => list.map((a) => a.name || a.address).join(', ');
  /** After a decision about the email: say so, and go back to the list. */
  const done = (message: string): void => {
    toast(message);
    location.hash = `#/${box.path}`;
  };
  const setStatus = (status: string, message: string) => async (): Promise<void> => {
    await api('POST', `/emails/${email.id}/status`, { status });
    done(message);
  };
  const sent = email.status === 'sent' ? email.reply : null;

  // Decisions about the email itself sit with the email, not with the reply.
  const decisions = waiting
    ? [
      ActionButton(t('composer.noReplyNeeded'), '…', setStatus('no_reply', t('composer.markedNoReply')), { variant: 'ghost', size: 'small', icon: 'mail-check' }),
      ActionButton(t('composer.ignore'), '…', setStatus('ignored', t('composer.ignored')), { variant: 'ghost', size: 'small', icon: 'archive' }),
    ]
    : !sent && ActionButton(t('composer.restore'), '…', setStatus('needs_reply', t('composer.restored')), { size: 'small', icon: 'undo' });

  const header = ReadingHeader({
    subject: email.subject || t('mailbox.noSubject'),
    actions: decisions,
    sender: { name: email.fromName || email.fromAddr, address: email.fromName ? email.fromAddr : undefined },
    to: email.cc.length ? t('reading.toCc', { to: names(email.to) || email.account, cc: names(email.cc) }) : t('reading.to', { to: names(email.to) || email.account }),
    attachments: email.attachments.map((a) => a.name || a.type),
    date: fmtWhen(email.date),
    dateTitle: fmtFull(email.date),
    triage: (email.triageReason || pending) && [
      pending ? Badge(t('mailbox.untriaged'), 'neutral') : Badge(triageSourceLabel(email.triageSource), 'neutral'),
      pending ? t('reading.pendingTriage') : email.triageReasonCode ? problemText({ code: email.triageReasonCode, params: {}, message: email.triageReason }) : email.triageReason,
    ],
  });
  const original = email.bodyText ? Message(Prose(email.bodyText)) : Text({ muted: true }, t('reading.erased'));

  if (sent) return Reading({ header }, original, sentReply(sent));
  if (waiting) return Reading({ header, dock: composer(email, prompts, done) }, original);
  // Set aside: no reply is expected, so the reply area opens only when asked for.
  const closed: HTMLElement = ClosedDock(
    email.status === 'ignored' ? t('composer.closedIgnored') : t('composer.closedNone'),
    Button(t('composer.replyAnyway'), { size: 'small', icon: 'reply', onClick: () => closed.replaceWith(composer(email, prompts, done)) }),
  );
  return Reading({ header, dock: closed }, original);
}

function sentReply(r: SentReply): Child {
  const draft = r.mode === 'draft';
  const author = r.by && r.by !== me().email ? called(r.byName, r.by) : null;
  const facts: [string, Child][] = [[t('composer.to'), r.to.join(', ')]];
  if (r.cc.length) facts.push([t('composer.cc'), r.cc.join(', ')]);
  if (r.changeReason) facts.push([t('reply.why'), r.changeReason]);
  return Panel({
    icon: 'check',
    title: draft ? t('reply.draftTitle') : t('reply.sentTitle'),
    meta: [author && `${t('reply.by', { user: author })} · `, fmtWhen(r.sentAt)],
    // An edited proposal is a fact, not a problem.
    badges: [Badge(r.wasEdited ? t('reply.edited') : t('reply.unedited'), 'neutral')],
    facts,
  },
    draft && Block(Notice('info', t('reply.draftNotice'))),
    Message(r.finalHtml ? RichText(r.finalHtml) : Prose(r.finalText || t('reply.textErased'))),
  );
}

/** A passage in square brackets: what a prompt leaves for the user to complete. */
const TO_COMPLETE = /\[[^[\]\n]{2,80}\]/;

/**
 * The reply area. The user writes whatever they want in the one editor — a full reply, a few
 * notes, instructions — then, if they wish, asks the AI to check typos, improve the style, or
 * write the reply with one of the organisation's prompts.
 */
function composer(email: EmailDetail, prompts: Prompt[], done: (message: string) => void): HTMLElement {
  /** The last thing the AI proposed, to tell whether the user changed it since, and how to say it. */
  let proposal: { id: number; action: Draft['action']; text: string; said: string } | null = null;
  /** What the editor held before the AI last replaced it, for the user to get it back. */
  let before: string | null = null;
  /** Whether the note above the text already says that the proposal was edited. */
  let notedEdited: boolean | null = null;
  const suggested = email.suggestedPromptId;
  const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

  const editor = RichEditor({
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
  const pick = prompts.length
    ? PromptPick({
      label: t('composer.applyPrompt'),
      selectLabel: t('composer.prompt'),
      title: t('composer.applyPromptTitle'),
      options: prompts.map((p) => ({ value: p.id, label: p.name, selected: p.id === (email.draft?.promptId ?? suggested) })),
      suggested: suggested ? { value: suggested, label: t('composer.suggestedTag') } : undefined,
    })
    : null;
  const removeLabel = (address: string): string => t('composer.removeRecipient', { address });
  const to = RecipientField({ label: t('composer.to'), values: email.recipients.to, removeLabel });
  const cc = RecipientField({ label: t('composer.cc'), removeLabel });
  const replyAll = Checkbox({ onchange: () => cc.setValues(replyAll.checked ? email.recipientsAll.cc : []) });
  const reason = Input({ placeholder: t('composer.reasonPlaceholder') });
  const reasonField = ReasonField(t('composer.reason'), reason, t('composer.reasonHint'));
  let caution = Caution('');
  caution.hidden = true;

  const undo = Button(t('composer.undo'), { variant: 'ghost', size: 'small', icon: 'undo', onClick: () => {
    if (before === null) return;
    editor.setHtml(before);
    before = null;
    proposal = null;
    sync();
  } });

  /** Brings what surrounds the text in line with it: the AI's note, the "why", what is left to complete. */
  function sync(): void {
    const edited = proposal !== null && norm(editor.getText()) !== norm(proposal.text);
    // Only a proposal made with a prompt can teach that prompt something.
    reasonField.hidden = proposal?.action !== 'prompt' || !edited;
    if (!proposal) {
      editor.setProposal(null);
      notedEdited = null;
    } else if (notedEdited !== edited) {
      notedEdited = edited;
      editor.setProposal(AiNote([proposal.said, edited && ` ${t('composer.editedByYou')}`], before !== null && undo), !edited);
    }
    const open = editor.countHighlights();
    const next = Caution(open ? t('composer.toComplete', { count: open }) : '');
    next.hidden = !open;
    caution.replaceWith(next);
    caution = next;
  }
  editor.onChange(sync);

  /** Shows a proposal in the editor and remembers it. */
  const show = (draft: Draft, replaced: string | null): void => {
    before = replaced;
    editor.setHtml(draft.html);
    const by = draft.provider ? t('composer.generatedVia', { model: draft.model, provider: draft.provider }) : t('composer.generatedBy', { model: draft.model });
    const what = { typos: t('composer.done.typos'), style: t('composer.done.style'), prompt: t('composer.done.prompt') }[draft.action];
    proposal = { id: draft.id, action: draft.action, text: editor.getText(), said: `${what} ${by}` };
    notedEdited = null;
    sync();
  };

  const assist = (action: Draft['action']) => async (): Promise<void> => {
    const html = editor.getHtml();
    show(await api<Draft>('POST', `/emails/${email.id}/assist`, { action, html, promptId: action === 'prompt' ? Number(pick?.select.value) : undefined }), html);
  };
  const typos = ActionButton(t('composer.typos'), t('composer.working'), assist('typos'), { size: 'small', icon: 'spell-check', title: t('composer.typosTitle') });
  const style = ActionButton(t('composer.style'), t('composer.working'), assist('style'), { size: 'small', icon: 'pen-line', title: t('composer.styleTitle') });
  pick?.button.addEventListener('click', busy(pick.button, t('composer.working'), assist('prompt')));

  const payload = () => ({
    draftId: proposal?.id,
    html: editor.getHtml(),
    to: to.getValues(),
    cc: cc.getValues(),
    changeReason: reasonField.hidden ? '' : reason.value,
  });
  const send = ActionButton(t('composer.send'), t('composer.sending'), async () => {
    const reply = payload();
    const facts: [string, Child][] = [[t('reply.from'), email.account], [t('composer.to'), reply.to.join(', ')]];
    if (reply.cc.length) facts.push([t('composer.cc'), reply.cc.join(', ')]);
    // The last thing seen before an email leaves: who it goes to, in the interface's own dialog.
    const confirmed = await confirmDialog({ title: t('composer.confirmSendTitle'), text: [Facts(facts), Text({ muted: true, small: true }, t('composer.confirmSendText'))], confirmLabel: t('composer.send'), cancelLabel: t('common.cancel') });
    if (!confirmed) return;
    await api('POST', `/emails/${email.id}/send`, reply);
    done(t('composer.sent'));
  }, { variant: 'primary', icon: 'send' });
  const saveDraft = ActionButton(t('composer.saveDraft'), t('composer.savingDraft'), async () => {
    await api('POST', `/emails/${email.id}/save-draft`, payload());
    done(t('composer.draftSaved', { account: email.account }));
  }, { title: t('composer.saveDraftTitle') });

  const dock = ReplyDock({
    label: t('composer.title'),
    notice: [
      // Arriving from the getting-started path: say what to try, once.
      route().query.has('welcome') && Block(Notice('info', email.draft ? t('welcome.tryPrepared') : t('welcome.tryIt'))),
      !me().hasKey && Notice('warn', tRich('composer.noKey', {}, { link: (label) => Link(label, '#/settings') })),
    ],
    recipients: [to.element, cc.element, email.recipientsAll.cc.length > 0 && CheckField(t('composer.replyAll'), replyAll)],
    write: [editor.element, reasonField],
    help: AiHelp({ label: t('composer.help'), note: t('composer.helpNote') },
      typos, style,
      pick ? pick.element : Notice('warn', isAdmin() ? tRich('composer.noPromptAdmin', {}, { link: (label) => Link(label, '#/prompts') }) : t('composer.noPrompt')),
    ),
    actions: [send, saveDraft, caution],
  });
  if (email.draft) show(email.draft, null);
  else sync();
  return dock;
}

// ---- prompts (administrators) -----------------------------------------------------------
/** The list of prompts, or with `open` one of them (or a new one) being edited. */
const renderPrompts = guard(async (open: number | 'new' | null = null) => {
  const [prompts, templates] = await Promise.all([api<Prompt[]>('GET', '/prompts'), api<PromptTemplate[]>('GET', '/prompts/templates')]);
  const back = (): void => void (location.hash === '#/prompts' ? renderPrompts() : (location.hash = '#/prompts'));
  const prompt = typeof open === 'number' ? prompts.find((p) => p.id === open) ?? null : null;

  if (open !== null && (open === 'new' || prompt)) {
    const items = prompt ? await api<Correction[]>('GET', `/prompts/${prompt.id}/corrections`).catch((): Correction[] => []) : [];
    const name = Input({ required: true, value: prompt?.name || '' });
    const description = Input({ value: prompt?.description || '' });
    const system = Textarea({ required: true, rows: 9, value: prompt?.systemPrompt || '' });
    const save = Button(prompt ? t('common.save') : t('prompts.create'), { variant: 'primary', type: 'submit' });
    const form = SubmitForm(save, '…', async () => {
      const body = { name: name.value, description: description.value, systemPrompt: system.value };
      await (prompt ? api('PUT', `/prompts/${prompt.id}`, body) : api('POST', '/prompts', body));
      toast(t('prompts.saved'));
      back();
    },
      Field(t('prompts.name'), name),
      Field(t('prompts.when'), description, { hint: t('prompts.whenHint') }),
      Field(t('prompts.instructions'), system, { hint: t('prompts.instructionsHint') }),
      Actions(save, Button(t('common.cancel'), { onClick: back })),
    );
    // What members changed in this prompt's proposals sits beside the instructions it should feed.
    const corrections = prompt && Card({ title: t('prompts.corrections'), badges: [items.length > 0 && Badge(String(items.length))] },
      Block(Text({ muted: true, small: true }, t('prompts.correctionsHint'))),
      items.length ? items.map((c) => Remark({ text: c.reason, by: called(c.userName, c.user), meta: `${called(c.userName, c.user)} · ${fmtWhen(c.at)}` })) : Text({ muted: true, small: true }, t('prompts.noCorrections')),
    );
    shell(Page(
      PageHeader({ title: prompt ? t('prompts.edit') : t('prompts.new'), crumbs: [{ label: t('prompts.title'), href: '#/prompts' }] }),
      corrections ? Columns(Card({}, form), corrections) : Card({ form: true }, form),
    ));
    name.focus();
    return;
  }

  shell(
    Page(
      PageHeader({ title: t('prompts.title'), intro: t('prompts.intro') }, ButtonLink(t('prompts.new'), { href: '#/prompts/new', variant: 'primary' })),
      Table({ columns: [t('prompts.column'), t('prompts.usageColumn')], actions: t('common.actions') }, prompts.map((p) => [
        [Strong(p.name), p.description && Text({ muted: true, small: true }, p.description)],
        (p.used ?? 0) > 0 ? t('prompts.usage', { used: p.used ?? 0, edited: p.edited ?? 0 }) : Muted(t('prompts.unused')),
        [
          ButtonLink(t('common.edit'), { href: `#/prompts/${p.id}` }),
          ActionButton(t('common.delete'), '…', async () => {
            if (!(await confirmAction(t('prompts.confirmDelete', { name: p.name }), t('common.delete')))) return;
            await api('DELETE', `/prompts/${p.id}`);
            renderPrompts();
          }, { variant: 'danger', size: 'small', icon: 'trash', iconOnly: true }),
        ],
      ])),
      templates.length > 0 && [Block(Text({ muted: true }, t('prompts.templatesHint'))), TemplateTable(templates, () => void renderPrompts())],
    ),
  );
});

// ---- users (administrators) -------------------------------------------------------------
const renderUsers = guard(async (freshInvitation?: NewInvitation) => {
  const [users, invitations] = await Promise.all([api<User[]>('GET', '/users'), api<Invitation[]>('GET', '/invitations')]);

  const email = Input({ type: 'email', required: true, placeholder: t('users.emailPlaceholder') });
  const role = Select([{ value: 'user', label: t('role.user') }, { value: 'admin', label: t('role.admin') }]);
  const invite = Button(t('users.createLink'), { variant: 'primary', type: 'submit' });
  // Inviting is a step, opened on demand, rather than a form that stays on the page.
  const inviteCard = Card({ title: t('users.invite'), form: true },
    SubmitForm(invite, '…', async () => renderUsers(await api<NewInvitation>('POST', '/invitations', { email: email.value, role: role.value })),
      FormRow(Field(t('users.email'), email), Field(t('users.role'), role, { size: 'narrow' })),
      Actions(invite, Button(t('common.cancel'), { onClick: () => (inviteCard.hidden = true) })),
    ),
  );
  inviteCard.hidden = true;

  let freshLink: Child = null;
  if (freshInvitation?.link) {
    const link = Input({ readOnly: true, value: freshInvitation.link, onfocus: () => link.select() });
    const copy = Button(t('common.copy'), {
      icon: 'copy',
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
    freshLink = Callout('ok', tRich('users.linkReady', { email: freshInvitation.email, days: freshInvitation.validDays }, { strong: Strong }), FormRow(Field(null, link), Field(null, copy, { size: 'fit' })));
  }

  shell(
    Page(
      PageHeader({ title: t('users.title'), intro: t('users.intro', { organization: me().organization.name }) },
        Button(t('users.invite'), { variant: 'primary', icon: 'user-plus', onClick: () => {
          inviteCard.hidden = false;
          email.focus();
        } })),
      freshLink,
      inviteCard,
      Table({ columns: [t('users.member'), t('users.role'), t('users.joined'), t('users.mailboxes')], actions: t('common.actions') }, users.map((u) => {
        const admin = u.role === 'admin';
        const self = u.email === me().email;
        return [
          Person({ name: called(u.name, u.email), detail: u.name ? u.email : undefined, tags: [self && Badge(t('users.you'), 'neutral')] }),
          Badge(roleLabel(u.role), admin ? 'accent' : 'neutral'),
          fmtDay(u.createdAt),
          u.accounts || Muted(t('users.noMailbox')),
          [
            ActionButton(admin ? t('users.demote') : t('users.promote'), '…', async () => {
              await api('PUT', `/users/${u.id}`, { role: admin ? 'user' : 'admin' });
              if (self) return boot();
              renderUsers();
            }, { variant: 'ghost', size: 'small' }),
            !self && ActionButton(t('users.delete'), '…', async () => {
              if (!(await confirmAction(t('users.confirmDelete', { email: u.email }), t('users.delete')))) return;
              await api('DELETE', `/users/${u.id}`);
              renderUsers();
            }, { variant: 'danger', size: 'small', icon: 'trash', iconOnly: true }),
          ],
        ];
      })),
      invitations.length > 0 && Table({ title: t('users.pending'), columns: [t('users.email'), t('users.role'), t('users.expiry')], actions: t('common.actions') }, invitations.map((i) => [
        i.email,
        Badge(roleLabel(i.role), i.role === 'admin' ? 'accent' : 'neutral'),
        i.expired ? Badge(t('users.expired'), 'warn') : fmtDay(i.expiresAt),
        ActionButton(t('users.revoke'), '…', async () => {
          await api('DELETE', `/invitations/${i.id}`);
          renderUsers();
        }, { variant: 'ghost', size: 'small' }),
      ])),
    ),
  );
});

// ---- accounts ---------------------------------------------------------------------------
/** Kinds of mailbox are product names: the same in every language. */
const KIND: Record<Account['kind'], string> = { imap: 'IMAP / SMTP', google: 'Google', microsoft: 'Microsoft' };
/** Whether the path still has to ask for the AI's key: no key is available, and this person may give the organisation's. */
const needsKey = (): boolean => isAdmin() && !me().hasKey;

/**
 * Getting started is a path. Everyone connects a mailbox and chooses its folder; whoever
 * administers the organisation is then shown what a newcomer would not find alone: the AI's
 * key when there is none, the prompt, and how the tool works for the team. It ends on a first email.
 */
type PathStep = 'connect' | 'folder' | 'key' | 'prompt' | 'work' | 'read';
const STEP_LABEL: Record<PathStep, string> = { connect: 'accounts.step1', folder: 'accounts.step2', key: 'accounts.stepKey', prompt: 'welcome.stepPrompt', work: 'welcome.stepWork', read: 'accounts.step3' };
const pathOf = (withKey: boolean): PathStep[] => ['connect', 'folder', ...(withKey ? (['key'] as const) : []), ...(isAdmin() ? (['prompt', 'work'] as const) : []), 'read'];
/** The path as shown at the top of each of its pages. */
function PathSteps(at: PathStep): HTMLOListElement {
  const steps = pathOf(needsKey() || at === 'key');
  return Steps(steps.map((step) => t(STEP_LABEL[step])), steps.indexOf(at));
}
/** Where the path goes after `at`. */
function leave(at: PathStep): void {
  const steps = pathOf(needsKey());
  const next = steps[steps.indexOf(at) + 1] ?? 'read';
  if (next === 'read') void openFirstEmail();
  else location.hash = `#/welcome/${next}`;
}

/** The end of the path: the first email to handle, open, or the box that has something to show. */
const openFirstEmail = guard(async () => {
  const { emails } = await api<EmailList>('GET', '/emails?box=todo');
  if (emails[0]) return void (location.hash = `#/inbox/${emails[0].id}?welcome`);
  const { emails: prepared } = await api<EmailList>('GET', '/emails?box=sent');
  location.hash = prepared.length ? '#/replied' : '#/inbox';
});

/**
 * Choosing the one folder of a mailbox to watch. The folders are asked of the mailbox when
 * the page appears, with the inbox first and preselected.
 */
function folderPage(account: Account): void {
  const fresh = account.folder === null;
  const folders = Choices({ legend: t('accounts.folders'), name: 'folder', rows: true, options: [{ value: '', title: t('accounts.loadingFolders'), disabled: true }] });
  const confirm = ActionButton(t('accounts.useFolder'), t('mailbox.refreshing'), async () => {
    await api('PUT', `/accounts/${account.id}/folder`, { folder: folders.value() });
    if (!fresh) {
      toast(t('accounts.folderChosen'));
      location.hash = '#/accounts';
      return void renderAccounts();
    }
    // The first choice goes on with the path. The button waits for the first fetch, so that
    // the newcomer arrives on their emails and not on an empty box.
    const fetched = await api<SyncResult>('POST', `/accounts/${account.id}/sync`);
    if (fetched.error) toast(problemText(fetched.error), true);
    else toast(t('mailbox.fetched', { count: fetched.fetched }));
    leave('folder');
  }, { variant: 'primary' });
  confirm.disabled = true;
  api<MailFolder[]>('GET', `/accounts/${account.id}/folders`)
    .then((list) => {
      folders.setOptions(list.map((f) => ({ value: f.id, title: f.name })), account.folder ?? list[0]?.id);
      confirm.disabled = false;
    })
    .catch((e) => toast(messageOf(e), true));
  shell(Page(
    fresh && PathSteps('folder'),
    PageHeader({ title: t('accounts.chooseFolderTitle'), intro: t('accounts.chooseFolder'), crumbs: fresh ? [] : [{ label: t('accounts.title'), href: '#/accounts' }] }),
    fresh && Callout('ok', t('accounts.connectedShort', { email: account.email })),
    Card({ form: true }, folders.element, Actions(confirm, !fresh && ButtonLink(t('common.cancel'), { href: '#/accounts' }))),
  ));
}

/** Giving saras access to a mailbox again: a new password, or a new trip to its host. */
function renewPage(account: Account): void {
  const crumbs = [{ label: t('accounts.title'), href: '#/accounts' }];
  const header = PageHeader({ title: t('accounts.renewTitle', { email: account.email }), intro: t('accounts.renewIntro'), crumbs });
  if (account.kind !== 'imap') {
    const provider = account.kind === 'google' ? t('accounts.connectGoogle') : t('accounts.connectMicrosoft');
    return shell(Page(header, Card({},
      Block(Text({ muted: true }, t('accounts.oauthIntro'))),
      Actions(ButtonLink(t('accounts.continueAt', { provider }), { href: `/api/oauth/${account.kind}/start?renew=${account.id}`, variant: 'primary' }), ButtonLink(t('common.cancel'), { href: '#/accounts' })),
    )));
  }
  const password = Input({ type: 'password', required: true, autocomplete: 'off' });
  const renew = Button(t('accounts.renew'), { variant: 'primary', type: 'submit' });
  shell(Page(header, Card({}, SubmitForm(renew, t('accounts.connecting'), async () => {
    await api('PUT', `/accounts/${account.id}/password`, { password: password.value });
    toast(t('accounts.renewed'));
    location.hash = '#/accounts';
    void renderAccounts();
  },
    Field(t('accounts.newPassword'), password, { hint: t('accounts.passwordHint') }),
    Actions(renew, ButtonLink(t('common.cancel'), { href: '#/accounts' })),
  ))));
}

/** Last step before the emails when no AI key is available: the administrator gives the organisation's, or goes on without. */
function keyPage(): void {
  const key = Input({ type: 'password', required: true, autocomplete: 'off', placeholder: 'sk-or-…' });
  const save = Button(t('accounts.keySave'), { variant: 'primary', type: 'submit' });
  const form = SubmitForm(save, '…', async () => {
    await api('PUT', '/organization', { openrouterKey: key.value });
    state.me = await api<Me>('GET', '/me');
    leave('key');
  },
    Field(t('organization.key'), key, { hint: tRich('accounts.keyHint', {}, { link: (label) => Link(label, 'https://openrouter.ai/keys') }) }),
    Actions(save, Button(t('accounts.keyLater'), { variant: 'link', onClick: () => leave('key') })),
  );
  shell(Page(
    PathSteps('key'),
    PageHeader({ title: t('accounts.keyTitle'), intro: t('accounts.keyIntro') }),
    Card({ form: true }, form),
  ));
  key.focus();
}

/** Ready-made prompts not yet added, each with its button. `onAdded` is called after one was. */
function TemplateTable(templates: PromptTemplate[], onAdded?: () => void): Child {
  return Table({ columns: [t('prompts.templates')], actions: t('common.actions') }, templates.map((template) => {
    const add: HTMLButtonElement = ActionButton(t('prompts.addTemplate'), '…', async () => {
      await api('POST', '/prompts', template);
      if (onAdded) return onAdded();
      add.replaceWith(Badge(t('prompts.added'), 'ok'));
    }, { size: 'small', icon: 'plus' });
    return [[Strong(template.name), Text({ muted: true, small: true }, template.description)], add];
  }));
}

/** The prompt an organisation starts with, to read and adjust, and the other ready-made ones beside it. */
const promptStep = guard(async () => {
  const [prompts, templates] = await Promise.all([api<Prompt[]>('GET', '/prompts'), api<PromptTemplate[]>('GET', '/prompts/templates')]);
  const first = prompts[0];
  const name = Input({ required: true, value: first?.name ?? '' });
  const description = Input({ value: first?.description ?? '' });
  const system = Textarea({ required: true, rows: 7, value: first?.systemPrompt ?? '' });
  const next = Button(t('welcome.continue'), { variant: 'primary', type: 'submit' });
  const form = SubmitForm(next, '…', async () => {
    const body = { name: name.value, description: description.value, systemPrompt: system.value };
    await (first ? api('PUT', `/prompts/${first.id}`, body) : api('POST', '/prompts', body));
    leave('prompt');
  },
    Field(t('prompts.name'), name),
    Field(t('prompts.when'), description, { hint: t('prompts.whenHint') }),
    Field(t('prompts.instructions'), system, { hint: t('prompts.instructionsHint') }),
    Actions(next),
  );
  shell(Page(
    PathSteps('prompt'),
    PageHeader({ title: t('welcome.promptTitle'), intro: t('welcome.promptIntro') }),
    templates.length ? Columns(Card({}, form), [Block(Text({ muted: true, small: true }, t('prompts.templatesHint'))), TemplateTable(templates)]) : Card({ form: true }, form),
  ));
});

/** The ways of working an administrator chooses between, as the tour and the settings name them. */
const WAYS = ['manual', 'sort', 'draft', 'mailbox'] as const;

/** Choosing how the tool works for the team, then on to a first email sorted and prepared that way. */
const workStep = guard(async () => {
  const hasKey = me().hasKey;
  // Without a key the AI can do nothing: only the first way can be chosen, and the others say why.
  const withAi = (hint: string) => ({ hint: hasKey ? hint : t('welcome.needsKey'), disabled: !hasKey });
  const ways = Choices({ legend: t('welcome.workLegend'), name: 'way', value: hasKey ? me().organization.way : 'manual', options: [
    { value: 'manual', title: t('welcome.manual'), hint: t('welcome.manualHint') },
    { value: 'sort', title: t('welcome.sort'), ...withAi(t('welcome.sortHint')) },
    { value: 'draft', title: t('welcome.draft'), ...withAi(t('welcome.draftHint')) },
    { value: 'mailbox', title: t('welcome.mailbox'), ...withAi(t('welcome.mailboxHint')) },
  ] });
  const finish = ActionButton(t('welcome.finish'), t('mailbox.refreshing'), async () => {
    // What the first fetch let through is sorted again the chosen way, and prepared if asked.
    await api('PUT', '/organization', { way: ways.value() });
    await api('POST', '/organization/sort-again');
    state.me = await api<Me>('GET', '/me');
    for (const account of await api<Account[]>('GET', '/accounts')) if (account.folder) await api('POST', `/accounts/${account.id}/sync`);
    leave('work');
  }, { variant: 'primary' });
  shell(Page(
    PathSteps('work'),
    PageHeader({ title: t('welcome.workTitle'), intro: t('welcome.workIntro') }),
    Card({}, ways.element, Text({ muted: true, small: true }, t('welcome.workLater'))),
    Actions(finish),
  ));
});

/** Connecting a mailbox: whose it is, where it is hosted, then what that host asks for. */
function connectPage(first: boolean, oauthError: Child): void {
  const { oauth } = me();
  const whose = isAdmin()
    ? Choices({ legend: t('accounts.whose'), name: 'whose', value: 'mine', options: [
      { value: 'mine', title: t('accounts.mine'), hint: t('accounts.mineHint') },
      { value: 'shared', title: t('accounts.sharedChoice'), hint: t('accounts.sharedHint', { organization: me().organization.name }) },
    ], onChange: () => show() })
    : null;
  const shared = (): boolean => whose?.value() === 'shared';
  const unavailable = (kind: 'google' | 'microsoft'): string | undefined => (oauth[kind] ? undefined : t('accounts.oauthUnavailable', { prefix: kind.toUpperCase() }));
  const host = Choices({ legend: t('accounts.where'), name: 'host', value: oauth.google ? 'google' : oauth.microsoft ? 'microsoft' : 'imap', options: [
    { value: 'google', title: t('accounts.connectGoogle'), hint: unavailable('google'), disabled: !oauth.google },
    { value: 'microsoft', title: t('accounts.connectMicrosoft'), hint: unavailable('microsoft'), disabled: !oauth.microsoft },
    { value: 'imap', title: t('accounts.imapTitle'), hint: t('accounts.imapHint') },
  ], onChange: () => show() });

  // A first mailbox is most often one's own: start from what sign-up already knows.
  const email = Input({ type: 'email', required: true, value: first ? me().email : '' });
  const displayName = Input({ placeholder: t('accounts.namePlaceholder'), value: first ? me().name : '' });
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
  // The servers follow the address until the user writes their own.
  let proposed = '';
  const propose = (servers: MailServers | null): void => {
    if (!servers || (imapHost.value && imapHost.value !== proposed)) return;
    proposed = imapHost.value = servers.imapHost;
    smtpHost.value = servers.smtpHost;
    imapPort.value = String(servers.imapPort);
    smtpPort.value = String(servers.smtpPort);
    imapSecure.checked = servers.imapPort === 993;
    smtpSecure.checked = servers.smtpPort === 465;
  };
  email.addEventListener('input', () => propose(serversFor(email.value)));
  propose(serversFor(email.value));

  // Who really hosts the address is asked of its domain: an address at one's own domain is
  // often at Google or Microsoft, where signing in is the way that works.
  let advice: HTMLElement = Callout('info', '');
  advice.hidden = true;
  const advise = (next: HTMLElement | null): void => {
    const shown = next ?? Callout('info', '');
    shown.hidden = next === null;
    advice.replaceWith(shown);
    advice = shown;
  };
  let asked = '';
  const findHost = async (address: string): Promise<void> => {
    if (!serversFor(address) || address === asked) return;
    asked = address;
    const found = await api<MailHost>('GET', `/mail/host?email=${encodeURIComponent(address)}`).catch(() => null);
    if (!found || address !== asked) return;
    propose(found.servers);
    if (found.provider === 'other') return advise(null);
    const provider = found.provider === 'google' ? t('accounts.connectGoogle') : t('accounts.connectMicrosoft');
    if (oauth[found.provider] && host.select(found.provider)) {
      show();
      advise(Callout('info', t('accounts.hostedSignIn', { address, provider })));
    } else {
      advise(Callout('warn', t('accounts.hostedPassword', { address, provider })));
    }
  };
  email.addEventListener('change', () => void findHost(email.value));
  const connect = Button(t('accounts.connect'), { variant: 'primary', type: 'submit' });
  const imapForm = SubmitForm(connect, t('accounts.connecting'), async () => {
    await api('POST', '/accounts/imap', {
      email: email.value, displayName: displayName.value, username: username.value, password: password.value,
      imapHost: imapHost.value, imapPort: Number(imapPort.value), imapSecure: imapSecure.checked,
      smtpHost: smtpHost.value, smtpPort: Number(smtpPort.value), smtpSecure: smtpSecure.checked,
      shared: shared(),
    });
    toast(t('accounts.connected'));
    location.hash = '#/accounts';
    void renderAccounts();
  },
    FormRow(Field(t('accounts.email'), email), Field(t('accounts.password'), password)),
    Field(t('accounts.name'), displayName, { hint: t('accounts.passwordHint') }),
    CardSection(t('accounts.serverSettings'),
      Block(Text({ muted: true, small: true }, t('accounts.serversProposed'))),
      FormRow(Field(t('accounts.imapServer'), imapHost), Field(t('accounts.port'), imapPort, { size: 'narrow' }), CheckField(t('accounts.directTls'), imapSecure, { size: 'narrow' })),
      FormRow(Field(t('accounts.smtpServer'), smtpHost), Field(t('accounts.port'), smtpPort, { size: 'narrow' }), CheckField(t('accounts.directTls'), smtpSecure, { size: 'narrow' })),
      Field(t('accounts.username'), username, { hint: t('accounts.tlsHint') }),
    ),
    Actions(connect, Muted(Small(t('accounts.connectHint')))),
  );

  // What the chosen host asks for: a form for IMAP, a trip to the provider for the others.
  const detail = Card({});
  function show(): void {
    const kind = host.value();
    if (kind === 'imap') return detail.replaceChildren(imapForm);
    const provider = kind === 'google' ? t('accounts.connectGoogle') : t('accounts.connectMicrosoft');
    detail.replaceChildren(
      Block(Text({ muted: true }, t('accounts.oauthIntro'))),
      ButtonLink(t('accounts.continueAt', { provider }), { href: `/api/oauth/${kind}/start${shared() ? '?shared=1' : ''}`, variant: 'primary' }),
    );
  }
  show();

  shell(Page(
    first && PathSteps('connect'),
    PageHeader({ title: t('accounts.connectTitle'), intro: t('accounts.connectIntro'), crumbs: first ? [] : [{ label: t('accounts.title'), href: '#/accounts' }] }),
    oauthError,
    advice,
    whose && Card({}, whose.element),
    Card({}, host.element),
    detail,
  ));
  if (first) void findHost(me().email);
}

const renderAccounts = guard(async (part = '', id: number | null = null, oauthError?: string | null, oauthDetail?: string) => {
  const accounts = await api<Account[]>('GET', '/accounts');
  const failure = oauthError && Callout('warn', problemText({ code: oauthError, params: { detail: oauthDetail ?? '' }, message: oauthDetail || oauthError }));

  // With no mailbox yet, the page is the first step of the path.
  if (part === 'connect' || accounts.length === 0) return connectPage(accounts.length === 0, failure);
  const renewing = part === 'renew' && accounts.find((a) => a.canManage && a.id === id);
  if (renewing) return renewPage(renewing);
  // A mailbox just connected has no folder yet: the page is the second step.
  const pending = accounts.find((a) => a.canManage && (a.folder === null || (part === 'folder' && a.id === id)));
  if (pending) return folderPage(pending);

  shell(
    Page(
      PageHeader({ title: t('accounts.title'), intro: t('accounts.intro') }, ButtonLink(t('accounts.connectTitle'), { href: '#/accounts/connect', variant: 'primary' })),
      failure,
      accounts.filter((a) => a.lastError && a.folder).map((a) => Callout('warn', `${a.email}: ${problemText(a.lastError as NonNullable<Account['lastError']>)}`)),
      Table({ columns: [t('accounts.mailbox'), t('accounts.folderColumn'), t('accounts.lastSyncColumn'), t('box.todo.label')], actions: t('common.actions') }, accounts.map((a) => [
        Person({ name: a.email, detail: KIND[a.kind], tags: [a.shared && Badge(t('accounts.shared'))], icon: a.shared ? 'users' : 'mail' }),
        a.folder ? a.folderName : Muted(t('accounts.folderPending')),
        a.lastSyncAt ? fmtWhen(a.lastSyncAt) : Muted(t('accounts.neverSynced')),
        a.todo,
        [
          a.folder && ActionButton(t('accounts.syncNow'), t('mailbox.refreshing'), async () => {
            const r = await api<SyncResult>('POST', `/accounts/${a.id}/sync`);
            if (r.error) toast(problemText(r.error), true);
            else toast(t('mailbox.fetched', { count: r.fetched }));
            renderAccounts();
          }, { size: 'small', icon: 'refresh-cw' }),
          a.folder && a.canManage && Button(t('accounts.changeFolder'), { variant: 'ghost', size: 'small', icon: 'folder', iconOnly: true, onClick: () => (location.hash = `#/accounts/folder/${a.id}`) }),
          a.canManage && Button(t('accounts.renew'), { variant: 'ghost', size: 'small', icon: 'key', iconOnly: true, onClick: () => (location.hash = `#/accounts/renew/${a.id}`) }),
          a.canManage && ActionButton(t('accounts.disconnect'), '…', async () => {
            if (!(await confirmAction(t('accounts.confirmDisconnect', { email: a.email }), t('accounts.disconnect')))) return;
            await api('DELETE', `/accounts/${a.id}`);
            renderAccounts();
          }, { variant: 'danger', size: 'small', icon: 'trash', iconOnly: true }),
        ],
      ])),
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
  const way = Select(WAYS.map((value) => ({ value, label: t(`welcome.${value}`), selected: org.way === value })));
  const skipAutomated = Checkbox({ checked: org.skipAutomated });
  const model = Input({ value: org.model ?? '', placeholder: t('organization.modelPlaceholder') });
  const key = Input({ type: 'password', autocomplete: 'off', placeholder: org.hasKey ? t('settings.keySaved') : 'sk-or-…' });
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  const form = SubmitForm(save, '…', async () => {
    const body: Record<string, unknown> = { name: name.value, way: way.value, skipAutomated: skipAutomated.checked, model: model.value };
    if (key.value) body.openrouterKey = key.value;
    await api('PUT', '/organization', body);
    toast(t('settings.saved'));
    void renderSettings('organisation');
  },
    Field(t('organization.name'), name),
    Field(t('organization.way'), way, { hint: t('organization.wayHint') }),
    CheckField(t('organization.skipAutomated'), skipAutomated),
    CardSection(t('settings.aiTitle'),
      Field(t('organization.model'), model, { hint: t('organization.modelHint') }),
      Field(t('organization.key'), key, { hint: org.hasKey ? t('settings.keyHintOwn') : t('organization.keyHint') }),
    ),
    Actions(save, org.hasKey && ActionButton(t('organization.deleteKey'), '…', async () => {
      await api('PUT', '/organization', { openrouterKey: '' });
      toast(t('settings.keyDeleted'));
      void renderSettings('organisation');
    }, { variant: 'danger' })),
  );
  return [
    Card({ form: true }, Block(Text({ muted: true }, t('organization.intro'))), form),
    Card({ title: t('settings.appearance'), form: true }, Text({}, tRich('settings.appearanceText', {}, { link: (label) => Link(label, '/styleguide.html') }))),
  ];
}

/** Settings, one tab per audience: one's own, the organisation's (administrators), and what the product guarantees. */
const renderSettings = guard(async (part = '') => {
  const me = (state.me = await api<Me>('GET', '/me'));
  const tab = part === 'privacy' || (part === 'organisation' && isAdmin()) ? part : 'you';
  const tabs = Tabs([
    { label: t('settings.you'), href: '#/settings', current: tab === 'you' },
    ...(isAdmin() ? [{ label: t('organization.title'), href: '#/settings/organisation', current: tab === 'organisation' }] : []),
    { label: t('settings.privacy'), href: '#/settings/privacy', current: tab === 'privacy' },
  ]);
  const frame = (...content: Child[]): void => shell(Page(PageHeader(t('settings.title')), tabs, content));

  if (tab === 'organisation') return frame(OrganizationSettings(me));

  if (tab === 'privacy') {
    return frame(
      Block(Text({ muted: true }, t('settings.privacyIntro', { product: brand.name }))),
      Features([
        { icon: 'lock', title: t('settings.guarantee.zdr'), text: t('settings.privacyZdr') },
        { icon: 'eye-off', title: t('settings.guarantee.minimal'), text: [me.organization.way === 'manual' ? t('settings.privacyTriageNone') : t('settings.privacyTriageAi'), (me.organization.way === 'draft' || me.organization.way === 'mailbox') && ` ${t('settings.privacyPrepared')}`] },
        { icon: 'timer', title: t('settings.guarantee.retention'), text: me.retentionDays ? t('settings.privacyRetention', { days: me.retentionDays }) : t('settings.privacyNoRetention') },
        { icon: 'key', title: t('settings.guarantee.encryption'), text: t('settings.privacyEncryption') },
        { icon: 'check', title: t('settings.guarantee.validation'), text: t('settings.privacyValidation') },
        { icon: 'users', title: t('settings.guarantee.reasons'), text: t('settings.privacyReasons') },
      ]),
      Callout('warn', [Strong(t('settings.yourPart')), ' ', t('settings.privacyLogging')]),
      Card({ title: t('settings.technical') }, Text({ small: true }, tRich('settings.privacyPolicy', { policy: `provider: ${JSON.stringify(me.privacy)}` }, { code: Code }))),
    );
  }

  const name = Input({ value: me.name, autocomplete: 'name' });
  const model = Input({ value: me.model, placeholder: me.defaultModel });
  const signature = Textarea({ rows: 3, placeholder: t('settings.signaturePlaceholder'), value: me.signature });
  const key = Input({ type: 'password', autocomplete: 'off', placeholder: me.hasOwnKey ? t('settings.keySaved') : me.hasKey ? t('settings.keyServer') : 'sk-or-…' });
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  const form = SubmitForm(save, '…', async () => {
    const body: { name: string; model: string; signature: string; openrouterKey?: string } = { name: name.value, model: model.value === me.defaultModel ? '' : model.value, signature: signature.value };
    if (key.value) body.openrouterKey = key.value;
    await api('PUT', '/settings', body);
    toast(t('settings.saved'));
    render();
  },
    Field(t('settings.name'), name, { hint: t('settings.nameHint', { organization: me.organization.name }) }),
    Field(t('settings.signature'), signature, { hint: t('settings.signatureHint') }),
    CardSection(t('settings.aiTitle'),
      Field(t('settings.model'), model, { hint: t('settings.modelHint', { model: me.defaultModel }) }),
      Field(t('settings.key'), key, { hint: me.hasOwnKey ? t('settings.keyHintOwn') : t('settings.keyHint') }),
    ),
    Actions(save, me.hasOwnKey && ActionButton(t('settings.deleteKey'), '…', async () => {
      await api('PUT', '/settings', { openrouterKey: '' });
      toast(t('settings.keyDeleted'));
      render();
    }, { variant: 'danger' })),
  );
  const current = Input({ type: 'password', required: true, autocomplete: 'current-password' });
  const next = Input({ type: 'password', required: true, minLength: 10, autocomplete: 'new-password' });
  const change = Button(t('settings.changePassword'), { type: 'submit' });
  const passwordForm = SubmitForm(change, '…', async () => {
    await api('PUT', '/auth/password', { current: current.value, next: next.value });
    toast(t('settings.passwordChanged'));
    render();
  },
    FormRow(Field(t('settings.currentPassword'), current), Field(t('settings.newPassword'), next, { hint: t('auth.passwordHint') })),
    Actions(change),
  );
  frame(
    !me.hasKey && Callout('warn', t('settings.noKey')),
    Card({ form: true }, form),
    Card({ title: t('settings.passwordTitle'), form: true }, passwordForm),
    languages().length > 1 && Card({ title: t('settings.display'), form: true }, LanguagePicker()),
  );
});

// Translations first: the brand's tagline and every screen depend on the language.
initI18n()
  .then(() => loadBrand(language()))
  .then((loaded) => {
    brand = loaded;
    void boot();
  });
