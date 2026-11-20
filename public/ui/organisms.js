/**
 * ORGANISMS — styled by design/organisms.css. The large regions of a screen.
 */
import { BrandMark, ButtonLink, Heading } from './atoms.js';
import { cx, h } from './dom.js';
import { Assurance, EmptyState, NavItem } from './molecules.js';

/** Centered panel for signing in, signing up, accepting an invitation. */
export function AuthPanel({ brand, tagline, foot }, ...children) {
  return h('div', { class: 'auth' },
    h('div', { class: 'auth__panel' },
      BrandMark(brand, { large: true }),
      h('p', { class: 'auth__tagline' }, tagline),
      children,
      foot && h('p', { class: 'auth__foot' }, foot),
    ),
  );
}

/**
 * The frame of every signed-in screen.
 * @param sections [{ title, items: [{ href, label, count, current }] }]
 * @param assurance { text, title }
 * @param user text identifying who is signed in
 * @param logout a Button
 */
export function AppShell({ brand, sections, assurance, user, logout }, content) {
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
export const Page = (...children) => h('div', { class: 'page' }, children);

/**
 * List of emails on one side, reading pane on the other.
 * @param items EmailListItem nodes
 * @param detail content of the reading pane, or null when no email is open
 */
export function Mailbox({ title, action, items, empty, backHref, detail }) {
  return h('div', { class: cx('mailbox', detail && 'mailbox--reading') },
    h('section', { class: 'mailbox__list' },
      h('div', { class: 'mailbox__list-head' }, Heading(2, title), action),
      items.length ? items : EmptyState(empty),
    ),
    h('section', { class: 'mailbox__detail' },
      detail ? [h('div', { class: 'mailbox__back' }, ButtonLink('← Retour', { href: backHref })), detail] : EmptyState(items.length ? 'Sélectionnez un email.' : ''),
    ),
  );
}

/**
 * Top of the reading pane.
 * @param meta lines of "who, when, to whom"
 * @param triage optional verdict line (badge + reason)
 */
export function ReadingHeader({ subject, meta = [], triage }) {
  return h('div', { class: 'reading-head' },
    Heading(1, subject),
    meta.map((line) => h('p', { class: 'reading-head__meta' }, line)),
    triage && h('p', { class: 'reading-head__triage' }, triage),
  );
}
