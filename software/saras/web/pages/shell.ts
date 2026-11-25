// The frame of every signed-in screen: the boxes, the boards, the configuration pages, who is signed in
// and the way out. On a phone, the page that leads to everything that is not a box.

import { signOut } from '../api/access.ts';
import { arrangeBoards } from '../api/boards.ts';
import { t } from '../i18n.ts';
import { route, showPage, start } from '../navigation.ts';
import { ActionButton, messageOf, toast } from './actions.ts';
import { BOXES_ON_SCREEN } from './boxes.ts';
import { called } from './people.ts';
import { showScreen } from './screen.ts';
import { isAdmin, me, refreshBoards, session } from '../session.ts';
import type { ButtonOptions } from '../ui/atoms/button.ts';
import type { IconName } from '../ui/atoms/icon.ts';
import type { Child } from '../ui/dom.ts';
import { Card } from '../ui/molecules/card.ts';
import { NavItem } from '../ui/molecules/nav-item.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Sortable } from '../ui/molecules/sortable.ts';
import { AppShell } from '../ui/organisms/app-shell.ts';
import { Page } from '../ui/organisms/page.ts';

/** `label` is a translation key. */
const CONFIGURATION: { path: string; label: string; icon: IconName; admin?: boolean }[] = [
  { path: 'mailboxes', label: 'nav.mailboxes', icon: 'plug' },
  // Attributes first: sorting comes before writing, and which prompt is suggested depends on it.
  { path: 'attributes', label: 'nav.attributes', icon: 'list', admin: true },
  { path: 'prompts', label: 'nav.prompts', icon: 'file-text', admin: true },
  { path: 'members', label: 'nav.members', icon: 'users', admin: true },
  { path: 'settings', label: 'nav.settings', icon: 'settings' },
];

/**
 * ArrangeBoards: the menu shows the new order already, and the server is told. Refused, the
 * menu is put back as the server has it.
 */
async function arrange(ids: number[]): Promise<void> {
  session.boards = ids.flatMap((id) => session.boards.find((b) => b.id === id) ?? []);
  try {
    await arrangeBoards(ids);
  } catch (e) {
    toast(messageOf(e), true);
    await refreshBoards();
    showPage();
  }
}

/** The boards of the menu, which the member puts in order by dragging them, then the entry that makes a new one. */
function boardEntries(): Child[] {
  const { page, part, id } = route();
  const at = (boardId: number): boolean => page === 'boards' && id === boardId;
  const boards = session.boards.map((b) => ({ key: b.id, node: NavItem({ href: `#/boards/${b.id}`, label: b.name, icon: 'list', count: b.count, current: at(b.id) }) }));
  return [Sortable(boards, (ids) => void arrange(ids)), NavItem({ href: '#/boards/new', label: t('nav.newBoard'), icon: 'plus', current: page === 'boards' && part === 'new' })];
}

const pagesOfUser = () => CONFIGURATION.filter((p) => !p.admin || isAdmin());
const signOutButton = (options: ButtonOptions): HTMLButtonElement => ActionButton(t('nav.signOut'), '…', async () => {
  await signOut();
  location.hash = '';
  await start();
}, options);

/** Shows `content` inside the frame, with the entry of the current page marked. */
export function shell(content: Child): void {
  const current = route().page;
  const item = (path: string, label: string, icon: IconName, count?: number) => ({ href: `#/${path}`, label, icon, count, current: current === path });
  const pages = pagesOfUser();
  showScreen(
    AppShell({
      brand: session.brand,
      boxes: BOXES_ON_SCREEN.map((b) => item(b.path, t(b.label), b.icon, session.counts[b.id])),
      boards: { title: t('nav.boards'), items: boardEntries() },
      pages: { title: t('nav.configuration'), items: pages.map((p) => item(p.path, t(p.label), p.icon)) },
      // On a phone the boxes fill the bar: this entry leads to everything else.
      more: { href: '#/more', label: t('nav.more'), icon: 'settings', current: current === 'more' || pages.some((p) => p.path === current) },
      user: { name: called(me().name, me().email), organization: me().organization.name },
      logout: signOutButton({ variant: 'ghost', icon: 'log-out', iconOnly: true }),
    }, content),
  );
}

/** On a phone: the configuration pages, who is signed in, and the way out. */
export function morePage(): void {
  shell(
    Page(
      PageHeader({ title: called(me().name, me().email), intro: me().organization.name }),
      Card({ title: t('nav.boards') }, boardEntries()),
      Card({}, pagesOfUser().map((p) => NavItem({ href: `#/${p.path}`, label: t(p.label), icon: p.icon }))),
      signOutButton({ icon: 'log-out' }),
    ),
  );
}
