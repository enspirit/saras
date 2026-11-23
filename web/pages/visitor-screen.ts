// The screen a visitor meets before they are in: the brand and what the installation
// guarantees on one side, what they are asked on the other.

import type { WhatVisitorsAreTold } from '../../shared/member.ts';
import { readPublicInfo } from '../api/access.ts';
import { t } from '../i18n.ts';
import { LanguagePicker } from './language.ts';
import { showScreen } from './screen.ts';
import { session } from '../session.ts';
import { Input } from '../ui/atoms/input.ts';
import type { Attrs, Child } from '../ui/dom.ts';
import { PasswordInput } from '../ui/molecules/password-input.ts';
import { AuthPanel } from '../ui/organisms/auth-panel.ts';

/** What the installation guarantees, said where a visitor first meets it. */
export const guarantees = (info: WhatVisitorsAreTold) => [
  session.brand.euHosting && { icon: 'shield-check' as const, title: t('auth.pointEuTitle'), text: t('auth.pointEu') },
  { icon: 'lock' as const, text: t('auth.pointZdr') },
  { icon: 'eye-off' as const, text: t('auth.pointMinimal') },
  info.retentionDays ? { icon: 'timer' as const, text: t('settings.privacyRetention', { days: info.retentionDays }) } : null,
  { icon: 'check' as const, text: t('settings.privacyValidation') },
].filter((point) => point !== null && point !== false);

/** What the installation says of itself; when it cannot be asked, sign-up is taken as closed. */
export const publicInfo = (): Promise<WhatVisitorsAreTold> =>
  readPublicInfo().catch((): WhatVisitorsAreTold => ({ allowSignup: false, passwordResetByEmail: false, firstAccount: false, retentionDays: 0 }));

/** Shows what a visitor is asked, beside the brand. */
export function showVisitorScreen(info: WhatVisitorsAreTold, asked: { title: string; intro?: Child; foot?: Child }, ...children: Child[]): void {
  const { brand } = session;
  showScreen(AuthPanel({ brand, tagline: brand.tagline, points: guarantees(info), tools: LanguagePicker(), ...asked }, ...children));
}

/** A password being typed, with the eye that shows it. The input is returned for its value; the field is what goes on screen. */
export function passwordField(attrs: Attrs): { input: HTMLInputElement; field: HTMLElement } {
  const input = Input({ type: 'password', required: true, ...attrs });
  return { input, field: PasswordInput(input, { show: t('auth.showPassword'), hide: t('auth.hidePassword') }) };
}
