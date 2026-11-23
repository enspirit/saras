// Settings, in three tabs: one's own, the organisation's (administrators), and the AI with what
// the product guarantees about it.

import { t } from '../i18n.ts';
import { guard } from './actions.ts';
import { organisationSettings } from './organisation-settings.ts';
import { aiAndPrivacy } from './ai-and-privacy.ts';
import { shell } from './shell.ts';
import { yourSettings } from './your-settings.ts';
import { isAdmin, refreshMe } from '../session.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Tabs } from '../ui/molecules/tabs.ts';
import { Page } from '../ui/organisms/page.ts';

type SettingsTab = 'you' | 'organisation' | 'ai';

const settingsTabs = (tab: SettingsTab): HTMLElement => Tabs([
  { label: t('settings.you'), href: '#/settings', current: tab === 'you' },
  ...(isAdmin() ? [{ label: t('organization.title'), href: '#/settings/organisation', current: tab === 'organisation' }] : []),
  { label: t('settings.aiPrivacy'), href: '#/settings/ai', current: tab === 'ai' },
]);

/** Settings: one's own, the organisation's (administrators), and the AI with its privacy. The old address of the privacy tab still leads there. */
export const settingsPage = guard(async (part = '') => {
  const who = await refreshMe();
  const tab: SettingsTab = part === 'ai' || part === 'privacy' ? 'ai' : part === 'organisation' && isAdmin() ? 'organisation' : 'you';
  const content = tab === 'organisation' ? organisationSettings(who) : tab === 'ai' ? aiAndPrivacy(who) : yourSettings(who);
  shell(Page(PageHeader(t('settings.title')), settingsTabs(tab), content));
});
