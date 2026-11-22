// Settings, one tab per audience: one's own, the organisation's (administrators), and what
// the product guarantees.

import { t } from '../i18n.ts';
import { guard } from './actions.ts';
import { organisationSettings } from './organisation-settings.ts';
import { privacy } from './privacy.ts';
import { shell } from './shell.ts';
import { yourSettings } from './your-settings.ts';
import { isAdmin, refreshMe } from '../session.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Tabs } from '../ui/molecules/tabs.ts';
import { Page } from '../ui/organisms/page.ts';

type SettingsTab = 'you' | 'organisation' | 'privacy';

const settingsTabs = (tab: SettingsTab): HTMLElement => Tabs([
  { label: t('settings.you'), href: '#/settings', current: tab === 'you' },
  ...(isAdmin() ? [{ label: t('organization.title'), href: '#/settings/organisation', current: tab === 'organisation' }] : []),
  { label: t('settings.privacy'), href: '#/settings/privacy', current: tab === 'privacy' },
]);

/** Settings, one tab per audience: one's own, the organisation's (administrators), and what the product guarantees. */
export const settingsPage = guard(async (part = '') => {
  const who = await refreshMe();
  const tab: SettingsTab = part === 'privacy' || (part === 'organisation' && isAdmin()) ? part : 'you';
  const content = tab === 'organisation' ? organisationSettings(who) : tab === 'privacy' ? privacy(who) : yourSettings(who);
  shell(Page(PageHeader(t('settings.title')), settingsTabs(tab), content));
});
