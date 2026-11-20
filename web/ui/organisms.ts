/**
 * ORGANISMS — styled by design/organisms.css. The large regions of a screen.
 */
import { BrandMark, ButtonLink, Heading } from './atoms.ts';
import type { Brand } from './atoms.ts';
import { cx, h } from './dom.ts';
import type { Child } from './dom.ts';
import { Assurance, EmptyState, NavItem } from './molecules.ts';
import type { NavEntry } from './molecules.ts';

export interface AuthPanelOptions {
  brand: Brand;
  tagline: string;
  /** Small print under the panel's content. */
  foot?: Child;
}

/** Centered panel for signing in, signing up, accepting an invitation. */
export function AuthPanel({ brand, tagline, foot }: AuthPanelOptions, ...children: Child[]): HTMLDivElement {
  return h('div', { class: 'auth' },
    h('div', { class: 'auth__panel' },
      BrandMark(brand, { large: true }),
      h('p', { class: 'auth__tagline' }, tagline),
      children,
      foot && h('p', { class: 'auth__foot' }, foot),
    ),
  );
}

export interface AppShellOptions {
  brand: Brand;
  sections: { title: string; items: NavEntry[] }[];
  assurance?: { text: string; title?: string };
  /** Text identifying who is signed in. */
  user: string;
  /** The sign-out button. */
  logout: Child;
}

/** The frame of every signed-in screen. */
export function AppShell({ brand, sections, assurance, user, logout }: AppShellOptions, content: Child): HTMLDivElement {
  return h('div', { class: 'shell' },
    h('nav', { class: 'shell__nav' },
      h('div', { class: 'shell__brand' }, BrandMark(brand)),
      sections.map((s) => [h('div', { class: 'shell__section' }, s.title), s.items.map(NavItem)]),
      h('div', { class: 'shell__foot' }, assurance && Assurance(assurance.text, assurance.title), h('div', { class: 'shell__user' }, user), logout),
    ),
    h('main', { class: 'shell__main' }, content),
  );
}

/** A scrolling column of cards. */
export const Page = (...children: Child[]): HTMLDivElement => h('div', { class: 'page' }, children);

export interface MailboxOptions {
  title: string;
  /** A control next to the title, e.g. a refresh button. */
  action?: Child;
  /** EmailListItem nodes. */
  items: Node[];
  /** Text shown when there is no item. */
  empty: string;
  backHref: string;
  /** Label of the link back to the list, on small screens. */
  backLabel: string;
  /** Shown in the reading pane while no email is open. */
  selectHint: string;
  /** Content of the reading pane, or null when no email is open. */
  detail: Child;
}

/** List of emails on one side, reading pane on the other. */
export function Mailbox({ title, action, items, empty, backHref, backLabel, selectHint, detail }: MailboxOptions): HTMLDivElement {
  return h('div', { class: cx('mailbox', Boolean(detail) && 'mailbox--reading') },
    h('section', { class: 'mailbox__list' },
      h('div', { class: 'mailbox__list-head' }, Heading(2, title), action),
      items.length ? items : EmptyState(empty),
    ),
    h('section', { class: 'mailbox__detail' },
      detail ? [h('div', { class: 'mailbox__back' }, ButtonLink(backLabel, { href: backHref })), detail] : EmptyState(items.length ? selectHint : ''),
    ),
  );
}

export interface ReadingHeaderOptions {
  subject: string;
  /** Lines of "who, when, to whom". */
  meta?: Child[];
  /** Verdict line: badge and reason. */
  triage?: Child;
}

/** Top of the reading pane. */
export function ReadingHeader({ subject, meta = [], triage }: ReadingHeaderOptions): HTMLDivElement {
  return h('div', { class: 'reading-head' },
    Heading(1, subject),
    meta.map((line) => h('p', { class: 'reading-head__meta' }, line)),
    triage && h('p', { class: 'reading-head__triage' }, triage),
  );
}
