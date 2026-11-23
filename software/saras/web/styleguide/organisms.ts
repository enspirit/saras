// The organisms: the large regions of a screen, with sample content.

import { t } from '../i18n.ts';
import { sampleDock, sampleEmail, sampleHeader } from './samples.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input } from '../ui/atoms/input.ts';
import { Heading, Prose, RichText, Text } from '../ui/atoms/text.ts';
import type { Brand } from '../ui/brand.ts';
import type { Child } from '../ui/dom.ts';
import { Card } from '../ui/molecules/card.ts';
import { EmptyState } from '../ui/molecules/empty-state.ts';
import { Block, Field } from '../ui/molecules/field.ts';
import { Form } from '../ui/molecules/form.ts';
import { Message } from '../ui/molecules/message.ts';
import { Panel } from '../ui/molecules/panel.ts';
import { AuthPanel } from '../ui/organisms/auth-panel.ts';
import { MailboxView } from '../ui/organisms/mailbox.ts';
import { Columns } from '../ui/organisms/page.ts';
import { Reading } from '../ui/organisms/reading.ts';
import { ClosedDock } from '../ui/organisms/reply-dock.ts';

const mailboxCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.mailbox') },
    MailboxView({
      title: t('box.todo.label'), count: 2, meta: t('mailbox.fetchedAt', { time: '08:13' }), action: Button(t('mailbox.refresh'), { variant: 'ghost', icon: 'refresh-cw', iconOnly: true }),
      items: [sampleEmail({ current: true }), sampleEmail({ from: 'Marc Dubois', subject: t('styleguide.sample.subject3') })],
      empty: EmptyState(t('box.todo.empty'), { icon: 'mail' }), idle: EmptyState(t('mailbox.select'), { icon: 'mail' }), backHref: '#', backLabel: t('mailbox.back'),
      detail: Reading({ header: sampleHeader(), dock: sampleDock() },
        Message(Prose(t('styleguide.sample.body'))),
        Panel({ icon: 'check', title: t('reply.sentTitle'), meta: '08:13', badges: [Badge(t('reply.edited'), 'neutral')], facts: [[t('composer.to'), 'claire@client.example'], [t('reply.why'), t('composer.reasonPlaceholder')]] }, RichText(t('styleguide.sample.rich'))),
      ),
    }),
    Block(ClosedDock(t('composer.closedNone'), Button(t('composer.replyAnyway'), { size: 'small', icon: 'reply' }))),
  );

const authPanelCard = (brand: Brand): HTMLDivElement =>
  Card({ title: t('styleguide.authPanel') },
    AuthPanel({ brand, tagline: brand.tagline, points: [{ icon: 'lock', text: t('auth.pointZdr') }, { icon: 'eye-off', text: t('auth.pointMinimal') }], title: t('auth.signIn'), foot: t('styleguide.authFoot') },
      Form(Field(t('auth.email'), Input({ type: 'email' })), Button(t('auth.signIn'), { variant: 'primary', size: 'large', block: true }))),
  );

export const organismsSection = (brand: Brand): Child[] => [
  Heading(2, t('styleguide.organisms')),
  Card({ title: t('styleguide.readingHeader') }, sampleHeader()),
  mailboxCard(),
  Card({ title: t('styleguide.columns') }, Columns(Card({}, Text({}, t('styleguide.cardText'))), Card({ title: t('prompts.corrections') }, Text({ muted: true, small: true }, t('prompts.noCorrections'))))),
  authPanelCard(brand),
  Block(Text({ muted: true, small: true }, t('styleguide.shellNote'))),
];
