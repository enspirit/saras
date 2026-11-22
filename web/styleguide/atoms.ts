// The atoms, each in its variants.

import { t, tRich } from '../i18n.ts';
import { busyButton, showToast } from './samples.ts';
import { Avatar } from '../ui/atoms/avatar.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { BrandMark } from '../ui/atoms/brand-mark.ts';
import { Button, ButtonLink } from '../ui/atoms/button.ts';
import { Chip } from '../ui/atoms/chip.ts';
import { Icon } from '../ui/atoms/icon.ts';
import type { IconName } from '../ui/atoms/icon.ts';
import { Checkbox, Input, Select, Textarea } from '../ui/atoms/input.ts';
import { Notice } from '../ui/atoms/notice.ts';
import { Spinner } from '../ui/atoms/spinner.ts';
import { Code, Heading, Link, List, Muted, Small, Strong, Text } from '../ui/atoms/text.ts';
import { TodoMark } from '../ui/atoms/todo-mark.ts';
import type { Brand } from '../ui/brand.ts';
import type { Child } from '../ui/dom.ts';
import { Card } from '../ui/molecules/card.ts';
import { Block, Field } from '../ui/molecules/field.ts';
import { Actions, FormRow } from '../ui/molecules/form.ts';

const ICONS: IconName[] = ['mail', 'mail-check', 'reply', 'archive', 'inbox', 'plug', 'file-text', 'users', 'settings', 'lock', 'eye-off', 'timer', 'globe', 'log-out', 'refresh-cw', 'search', 'send', 'paperclip', 'spell-check', 'pen-line', 'pencil', 'undo', 'trash', 'plus', 'x', 'check', 'chevron-down', 'info', 'circle-alert', 'triangle-alert', 'bold', 'italic', 'underline', 'list', 'list-ordered', 'link', 'remove-formatting'];

const iconsCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.icons') },
    Block(Text({ muted: true, small: true }, t('styleguide.iconsHint'))),
    Block(Actions(ICONS.map((name) => Icon(name, { size: 'large' })))),
    Actions(Icon('lock', { size: 'small' }), Icon('lock'), Icon('lock', { size: 'large' }), Spinner()),
  );

const buttonsCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.buttons') },
    Block(Actions(Button(t('styleguide.default')), Button(t('styleguide.primary'), { variant: 'primary' }), Button(t('styleguide.danger'), { variant: 'danger' }), Button(t('styleguide.destructive'), { variant: 'destructive' }), Button(t('styleguide.ghost'), { variant: 'ghost' }), Button(t('styleguide.link'), { variant: 'link' }))),
    Block(Actions(Button(t('styleguide.small'), { size: 'small' }), Button(t('styleguide.default')), Button(t('styleguide.large'), { size: 'large' }), Button(t('styleguide.small'), { variant: 'primary', size: 'small' }), Button(t('styleguide.large'), { variant: 'primary', size: 'large' }))),
    Block(Actions(Button(t('styleguide.withIcon'), { variant: 'primary', icon: 'send' }), Button(t('styleguide.withIcon'), { icon: 'spell-check' }), Button(t('styleguide.withIcon'), { variant: 'ghost', size: 'small', icon: 'archive' }), Button(t('styleguide.iconOnly'), { variant: 'ghost', icon: 'refresh-cw', iconOnly: true }), busyButton())),
    Actions(ButtonLink(t('styleguide.buttonLink'), { href: '#' }), ButtonLink(t('styleguide.unavailable'), { disabled: true, title: t('styleguide.unavailableWhy') })),
  );

const peopleCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.people') },
    Actions(Avatar('Claire Martin'), Avatar('alex@brightwater.example', { size: 'small' }), Chip('Claire Martin'), Chip('Paul Novak', { removeLabel: t('styleguide.removeRecipient', { address: 'Paul Novak' }), onRemove: () => showToast(t('styleguide.toast')) }), TodoMark(t('styleguide.toComplete'))),
  );

const noticesCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.notices') },
    Block(Notice('info', tRich('styleguide.noticeInfo', {}, { link: (label) => Link(label, '#') }))),
    Block(Notice('ok', t('styleguide.noticeOk'))),
    Block(Notice('warn', t('styleguide.noticeWarn'))),
    Notice('danger', t('styleguide.noticeDanger')),
  );

const textCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.text') },
    Heading(1, t('styleguide.heading', { level: 1 })),
    Heading(2, t('styleguide.heading', { level: 2 })),
    Heading(3, t('styleguide.heading', { level: 3 })),
    Text({}, tRich('styleguide.paragraph', {}, { strong: Strong, code: Code, link: (label) => Link(label, '#') })),
    Text({ muted: true }, t('styleguide.paragraphMuted')),
    Text({ small: true }, t('styleguide.paragraphSmall'), ' ', Small(Muted(t('styleguide.smallMuted')))),
    List([t('styleguide.firstItem'), t('styleguide.secondItem')]),
  );

const controlsCard = (): HTMLDivElement =>
  Card({ title: t('styleguide.controls') },
    FormRow(Field(t('styleguide.textInput'), Input({ placeholder: t('styleguide.textInputPlaceholder') })), Field(t('styleguide.select'), Select([{ value: 1, label: t('styleguide.firstOption') }, { value: 2, label: t('styleguide.secondOption') }]))),
    Field(t('styleguide.textarea'), Textarea({ placeholder: t('styleguide.textareaPlaceholder') })),
    Field(t('styleguide.disabled'), Input({ value: t('styleguide.disabledValue'), disabled: true })),
    Field(t('styleguide.fieldError'), Input({ type: 'email', value: 'claire@' }), { error: t('styleguide.errorText') }),
    Actions(Checkbox({ checked: true }), Checkbox()),
  );

export const atomsSection = (brand: Brand): Child[] => [
  Heading(2, t('styleguide.atoms')),
  Card({ title: t('styleguide.brandMark') }, Actions(BrandMark(brand), BrandMark(brand, { large: true }))),
  iconsCard(),
  buttonsCard(),
  Card({ title: t('styleguide.badges') }, Actions(Badge(t('styleguide.accent')), Badge(t('styleguide.success'), 'ok'), Badge(t('styleguide.warning'), 'warn'), Badge(t('styleguide.danger'), 'danger'), Badge(t('styleguide.neutral'), 'neutral'))),
  peopleCard(),
  noticesCard(),
  textCard(),
  controlsCard(),
];
