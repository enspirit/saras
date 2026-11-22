/**
 * ORGANISMS — styled by design/organisms.css. The large regions of a screen.
 */
import { Avatar, BrandMark, ButtonLink, Chip, Heading, Icon } from './atoms.ts';
import type { Brand, IconName } from './atoms.ts';
import { cx, h } from './dom.ts';
import type { Child } from './dom.ts';
import { Assurance, NavItem } from './molecules.ts';
import type { NavEntry } from './molecules.ts';

export interface AuthPanelOptions {
  brand: Brand;
  /** What the product is, in one sentence: the headline of the brand's side. */
  tagline: string;
  /** What the installation guarantees, shown under the tagline. */
  points?: { icon: IconName; title?: string; text: string }[];
  /** Title of the form: what the visitor is about to do. */
  title: string;
  intro?: Child;
  /** A control above the form, e.g. the language. */
  tools?: Child;
  /** Under the form: the way to the other form. */
  foot?: Child;
}

/** Signing in, signing up, accepting an invitation: the brand on one side, the form on the other. */
export function AuthPanel({ brand, tagline, points = [], title, intro, tools, foot }: AuthPanelOptions, ...children: Child[]): HTMLDivElement {
  return h('div', { class: 'auth' },
    h('aside', { class: 'auth__brand' },
      h('div', { class: 'auth__mark' }, BrandMark(brand, { onDark: true }), brand.byline && h('span', { class: 'auth__byline' }, brand.byline)),
      h('div', { class: 'auth__pitch' },
        h('p', { class: 'auth__tagline' }, tagline),
        points.length > 0 && h('ul', { class: 'auth__points' }, points.map((p) => h('li', { class: 'auth__point' }, Icon(p.icon, { size: 'large' }), h('span', {}, p.title && h('span', { class: 'auth__point-title' }, p.title), p.text)))),
      ),
    ),
    h('main', { class: 'auth__main' },
      h('div', { class: 'auth__tools' }, tools),
      h('div', { class: 'auth__panel' }, Heading(1, title), intro && h('p', { class: 'auth__intro' }, intro), children, foot && h('p', { class: 'auth__foot' }, foot)),
      brand.credit && h('p', { class: 'auth__credit' }, brand.credit),
    ),
  );
}

export interface AppShellOptions {
  brand: Brand;
  /** The boxes of the mailbox: the main entries. */
  boxes: NavEntry[];
  /** Configuration pages: quieter entries, under their title. */
  pages: { title: string; items: NavEntry[] };
  /** On a small screen, the entry that leads to everything that is not a box. */
  more: NavEntry;
  assurance?: { text: string; title?: string };
  /** Who is signed in, and in which organisation. */
  user: { name: string; organization: string };
  /** The sign-out button. */
  logout: Child;
}

/** The frame of every signed-in screen. */
export function AppShell({ brand, boxes, pages, more, assurance, user, logout }: AppShellOptions, content: Child): HTMLDivElement {
  return h('div', { class: 'shell' },
    h('nav', { class: 'shell__nav' },
      h('div', { class: 'shell__brand' }, BrandMark(brand)),
      h('div', { class: 'shell__group' }, boxes.map(NavItem), h('div', { class: 'shell__more' }, NavItem(more))),
      h('div', { class: 'shell__group shell__group--minor' }, h('div', { class: 'shell__section' }, pages.title), pages.items.map(NavItem)),
      h('div', { class: 'shell__foot' },
        assurance && Assurance(assurance.text, assurance.title),
        h('div', { class: 'shell__user' }, Avatar(user.name, { size: 'small' }), h('div', { class: 'shell__who' }, h('span', { class: 'shell__name' }, user.name), h('span', { class: 'shell__org' }, user.organization)), logout),
      ),
    ),
    h('main', { class: 'shell__main' }, content),
  );
}

/** A scrolling column, centred. */
export const Page = (...children: Child[]): HTMLDivElement => h('div', { class: 'page' }, h('div', { class: 'page__inner' }, children));

/** What one works on, and beside it what informs the work. */
export const Columns = (main: Child, aside: Child): HTMLDivElement => h('div', { class: 'columns' }, h('div', {}, main), h('aside', {}, aside));

export interface MailboxOptions {
  title: string;
  /** How many emails the box holds. */
  count?: number;
  /** A short fact about the list, e.g. when mail was last fetched. */
  meta?: string;
  /** A control at the end of the head, e.g. a refresh button. */
  action?: Child;
  /** EmailListItem nodes. */
  items: Node[];
  /** Shown in the list when it has no item (an EmptyState). */
  empty: Child;
  backHref: string;
  /** Label of the link back to the list, on small screens. */
  backLabel: string;
  /** Shown in the reading pane while no email is open (an EmptyState). */
  idle: Child;
  /** Content of the reading pane (a Reading), or null when no email is open. */
  detail: Child;
}

/** List of emails on one side, reading pane on the other. */
export function Mailbox({ title, count, meta, action, items, empty, backHref, backLabel, idle, detail }: MailboxOptions): HTMLDivElement {
  return h('div', { class: cx('mailbox', Boolean(detail) && 'mailbox--reading') },
    h('section', { class: 'mailbox__list' },
      h('div', { class: 'mailbox__list-head' }, Heading(2, title), count ? h('span', { class: 'mailbox__count' }, count) : null, meta && h('span', { class: 'mailbox__meta' }, meta), action),
      items.length ? items : empty,
    ),
    h('section', { class: 'mailbox__detail' },
      detail ? [h('div', { class: 'mailbox__back' }, ButtonLink(backLabel, { href: backHref, variant: 'link' })), detail] : idle,
    ),
  );
}

/** An open email: its header, its content (which scrolls), and what is docked under it. */
export const Reading = ({ header, dock }: { header: Child; dock?: Child }, ...content: Child[]): HTMLDivElement =>
  h('div', { class: 'reading' }, header, h('div', { class: 'reading__body' }, content), dock);

export interface ReadingHeaderOptions {
  subject: string;
  /** Decisions about the email itself, at the end of the subject line. */
  actions?: Child;
  sender: { name: string; address?: string };
  /** 'To you · Cc Paul Novak'. */
  to?: string;
  /** Names of the attached files. */
  attachments?: string[];
  date: string;
  /** The complete date, as a tooltip. */
  dateTitle?: string;
  /** Verdict line: badge and reason. */
  triage?: Child;
}

/** Top of the reading pane. */
export function ReadingHeader({ subject, actions, sender, to, attachments = [], date, dateTitle, triage }: ReadingHeaderOptions): HTMLElement {
  return h('header', { class: 'reading-head' },
    h('div', { class: 'reading-head__top' }, Heading(1, subject), actions),
    h('div', { class: 'reading-head__sender' },
      Avatar(sender.name),
      h('div', { class: 'reading-head__who' },
        h('span', {}, h('span', { class: 'reading-head__name' }, sender.name), sender.address && [' ', h('span', { class: 'reading-head__address' }, sender.address)]),
        to && h('span', { class: 'reading-head__to' }, to),
      ),
      attachments.length > 0 && h('div', { class: 'reading-head__files' }, attachments.map((name) => Chip(name, { icon: 'paperclip' }))),
      h('span', { class: 'reading-head__date', title: dateTitle }, date),
    ),
    triage && h('div', { class: 'reading-head__triage' }, triage),
  );
}

export interface ReplyDockOptions {
  /** Accessible name of the region. */
  label: string;
  /** A notice above everything, e.g. a missing key. */
  notice?: Child;
  /** RecipientField elements and the reply-to-all control. */
  recipients: Child;
  /** The editor, and what follows it when the proposal was edited. */
  write: Child;
  /** The AI help. */
  help: Child;
  /** Send, save, and what must be settled first. */
  actions: Child;
}

/** The reply area, docked under the email. */
export function ReplyDock({ label, notice, recipients, write, help, actions }: ReplyDockOptions): HTMLElement {
  return h('section', { class: 'dock', 'aria-label': label },
    notice && h('div', { class: 'dock__notice' }, notice),
    h('div', { class: 'dock__recipients' }, recipients),
    h('div', { class: 'dock__write' }, write),
    h('div', { class: 'dock__help' }, help),
    h('div', { class: 'dock__actions' }, actions),
  );
}

/** In place of the reply area when no reply is expected: says so, and offers to open it. */
export const ClosedDock = (text: Child, action: Child): HTMLDivElement =>
  h('div', { class: 'dock dock--closed' }, Icon('mail-check', { size: 'large' }), h('span', { class: 'dock__text' }, text), action);
