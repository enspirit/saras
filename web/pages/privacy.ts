// Settings → Privacy: what the product guarantees about the emails it handles, and what
// remains the organisation's part.

import type { Profile } from '../../shared/member.ts';
import type { Organization } from '../../shared/organization.ts';
import { t, tRich } from '../i18n.ts';
import { session } from '../session.ts';
import { Code, Strong, Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Callout } from '../ui/molecules/callout.ts';
import { Card } from '../ui/molecules/card.ts';
import { Features } from '../ui/molecules/features.ts';
import { Block } from '../ui/molecules/field.ts';

/** What the AI is sent, which depends on what the organisation has it do at sorting and at writing. */
const whatIsSent = ({ sorting, writing }: Organization): Child => [
  sorting === 'ai' ? t('settings.privacyTriageAi') : t('settings.privacyTriageNone'),
  writing !== 'none' && ` ${t('settings.privacyPrepared')}`,
];

const guaranteeFeatures = (who: Profile): HTMLDivElement => Features([
  { icon: 'lock', title: t('settings.guarantee.zdr'), text: t('settings.privacyZdr') },
  { icon: 'eye-off', title: t('settings.guarantee.minimal'), text: whatIsSent(who.organization) },
  { icon: 'timer', title: t('settings.guarantee.retention'), text: who.retentionDays ? t('settings.privacyRetention', { days: who.retentionDays }) : t('settings.privacyNoRetention') },
  { icon: 'key', title: t('settings.guarantee.encryption'), text: t('settings.privacyEncryption') },
  { icon: 'check', title: t('settings.guarantee.validation'), text: t('settings.privacyValidation') },
  { icon: 'users', title: t('settings.guarantee.reasons'), text: t('settings.privacyReasons') },
]);

/** What the product guarantees, what stays the organisation's part, and the technical policy behind it. */
export const privacy = (who: Profile): Child => [
  Block(Text({ muted: true }, t('settings.privacyIntro', { product: session.brand.name }))),
  guaranteeFeatures(who),
  Callout('warn', [Strong(t('settings.yourPart')), ' ', t('settings.privacyLogging')]),
  Card({ title: t('settings.technical') }, Text({ small: true }, tRich('settings.privacyPolicy', { policy: `provider: ${JSON.stringify(who.privacy)}` }, { code: Code }))),
];
