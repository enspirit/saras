// Settings → Privacy: what the product guarantees about the emails it handles, and what
// remains the organisation's part.

import type { Profile } from '../../shared/member.ts';
import { t } from '../i18n.ts';
import { Strong } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Callout } from '../ui/molecules/callout.ts';
import { Features } from '../ui/molecules/features.ts';

const guaranteeFeatures = (who: Profile): HTMLDivElement => Features([
  { icon: 'lock', title: t('settings.guarantee.zdr'), text: t('settings.privacyZdr') },
  { icon: 'timer', title: t('settings.guarantee.retention'), text: who.retentionDays ? t('settings.privacyRetention', { days: who.retentionDays }) : t('settings.privacyNoRetention') },
  { icon: 'key', title: t('settings.guarantee.encryption'), text: t('settings.privacyEncryption') },
  { icon: 'check', title: t('settings.guarantee.validation'), text: t('settings.privacyValidation') },
  { icon: 'users', title: t('settings.guarantee.reasons'), text: t('settings.privacyReasons') },
]);

/** What the product guarantees, and what stays the organisation's part. What the AI is sent is said above, with what it does. */
export const privacy = (who: Profile): Child => [
  guaranteeFeatures(who),
  Callout('warn', [Strong(t('settings.yourPart')), ' ', t('settings.privacyLogging')]),
];
