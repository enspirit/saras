// The frame of every signed-in screen: the boxes, the configuration pages, who is signed in
// and the way out. On a phone, the page that leads to everything that is not a box.

import { signOut } from '../api/access.ts';
import { t } from '../i18n.ts';
import { route, start } from '../navigation.ts';
import { ActionButton } from './actions.ts';
import { BOXES } from './boxes.ts';
import { called } from './people.ts';
import { showScreen } from './screen.ts';
import { isAdmin, me, session } from '../session.ts';
import type { ButtonOptions } from '../ui/atoms/button.ts';
import type { IconName } from '../ui/atoms/icon.ts';
import type { Child } from '../ui/dom.ts';
import { Assurance } from '../ui/molecules/assurance.ts';
import { Card } from '../ui/molecules/card.ts';
import { Block } from '../ui/molecules/field.ts';
import { NavItem } from '../ui/molecules/nav-item.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { AppShell } from '../ui/organisms/app-shell.ts';
import { Page } from '../ui/organisms/page.ts';

/** `label` is a translation key. */
const CONFIGURATION: { path: string; label: string; icon: IconName; admin?: boolean }[] = [
  { path: 'accounts', label: 'nav.accounts', icon: 'plug' },
  { path: 'prompts', label: 'nav.prompts', icon: 'file-text', admin: true },
  { path: 'users', label: 'nav.users', icon: 'users', admin: true },
  { path: 'settings', label: 'nav.settings', icon: 'settings' },
];

const pagesOfUser = () => CONFIGURATION.filter((p) => !p.admin || isAdmin());
const assurance = () => ({ text: t('nav.assurance.text'), title: t('nav.assurance.title') });
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
      boxes: BOXES.map((b) => item(b.path, t(b.label), b.icon, session.counts[b.id])),
      pages: { title: t('nav.configuration'), items: pages.map((p) => item(p.path, t(p.label), p.icon)) },
      // On a phone the boxes fill the bar: this entry leads to everything else.
      more: { href: '#/more', label: t('nav.more'), icon: 'settings', current: current === 'more' || pages.some((p) => p.path === current) },
      assurance: assurance(),
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
      Card({}, pagesOfUser().map((p) => NavItem({ href: `#/${p.path}`, label: t(p.label), icon: p.icon }))),
      Block(Assurance(assurance().text, assurance().title)),
      signOutButton({ icon: 'log-out' }),
    ),
  );
}
