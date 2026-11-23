// The attributes of the organisation's emails (administrators): what each is, its values, and who decides it.

import type { Attribute } from '../../shared/attribute.ts';
import { readAttributes } from '../api/attributes.ts';
import { t, tRich } from '../i18n.ts';
import { guard } from './actions.ts';
import { attributeName } from './attribute-names.ts';
import { DECIDER_ICONS, chipOf } from './attribute-values.ts';
import { shell } from './shell.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { Button, ButtonLink } from '../ui/atoms/button.ts';
import { Link, Muted, Strong, Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { DecidedBy, ValueList } from '../ui/molecules/attribute-bar.ts';
import { Features } from '../ui/molecules/features.ts';
import { Block } from '../ui/molecules/field.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Table } from '../ui/molecules/table.ts';
import { Page } from '../ui/organisms/page.ts';

/** Who decides an attribute, as a translation key. */
export const DECIDER_LABEL = { nobody: 'attributes.deciderNobody', elo: 'attributes.deciderElo', ai: 'attributes.deciderAi', eloAi: 'attributes.deciderEloAi' };

/** How an email gets a value: its rule, then the AI, then a member by hand. */
const howDecided = (): HTMLDivElement => Features([
  { icon: 'code', title: t('attributes.stepRule'), text: t('attributes.stepRuleText') },
  { icon: 'sparkles', title: t('attributes.stepAi'), text: t('attributes.stepAiText') },
  { icon: 'pencil', title: t('attributes.stepHand'), text: t('attributes.stepHandText') },
]);

const valuesOf = (attribute: Attribute): Child => (attribute.kind === 'member' ? Muted(t('attributes.kindMember')) : ValueList(attribute.values.map((value) => chipOf(attribute, value))));

/** One attribute: its name, its values, who decides it, and the way to its form. */
const attributeRow = (attribute: Attribute): Child[] => [
  [Strong(attributeName(attribute)), ' ', attribute.system && Badge(t('attributes.preconfigured'), 'neutral')],
  valuesOf(attribute),
  DecidedBy(DECIDER_ICONS[attribute.decidedBy], t(DECIDER_LABEL[attribute.decidedBy])),
  Button(t('common.edit'), { variant: 'ghost', size: 'small', icon: 'pencil', iconOnly: true, onClick: () => (location.hash = `#/attributes/edit/${attribute.key}`) }),
];

export const attributesPage = guard(async () => {
  const attributes = await readAttributes();
  shell(Page(
    PageHeader({ title: t('attributes.title'), intro: t('attributes.intro') }, ButtonLink(t('attributes.new'), { href: '#/attributes/new', variant: 'primary' })),
    howDecided(),
    Table({ columns: [t('attributes.name'), t('attributes.values'), t('attributes.decidedBy')], actions: t('common.actions') }, attributes.map(attributeRow)),
    Block(Text({ muted: true, small: true }, tRich('rules.guideLink', {}, { link: (label) => Link(label, '#/attributes/guide') }))),
  ));
});
