// The attributes of the organisation's emails (administrators): what each is, and how it is decided.

import type { Attribute } from '../../shared/attribute.ts';
import { readAttributes } from '../api/attributes.ts';
import { t } from '../i18n.ts';
import { guard } from './actions.ts';
import { attributeName, valueLabel } from './attribute-names.ts';
import { shell } from './shell.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { Button, ButtonLink } from '../ui/atoms/button.ts';
import { Muted } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Table } from '../ui/molecules/table.ts';
import { Page } from '../ui/organisms/page.ts';

/** Who decides an attribute, as a translation key. */
export const DECIDER_LABEL = { nobody: 'attributes.deciderNobody', elo: 'attributes.deciderElo', ai: 'attributes.deciderAi', eloAi: 'attributes.deciderEloAi' };

const valuesOf = (attribute: Attribute): Child => (attribute.kind === 'member' ? Muted(t('attributes.kindMember')) : attribute.values.map((value) => valueLabel(attribute, value)).join(' · '));

/** One attribute: its name, its values, who decides it, and the way to its form. */
const attributeRow = (attribute: Attribute): Child[] => [
  [attributeName(attribute), ' ', attribute.system && Badge(t('attributes.preconfigured'), 'neutral')],
  valuesOf(attribute),
  t(DECIDER_LABEL[attribute.decidedBy]),
  Button(t('common.edit'), { variant: 'ghost', size: 'small', icon: 'pencil', iconOnly: true, onClick: () => (location.hash = `#/attributes/edit/${attribute.key}`) }),
];

export const attributesPage = guard(async () => {
  const attributes = await readAttributes();
  shell(Page(
    PageHeader({ title: t('attributes.title'), intro: t('attributes.intro') }, ButtonLink(t('attributes.new'), { href: '#/attributes/new', variant: 'primary' })),
    Table({ columns: [t('attributes.name'), t('attributes.values'), t('attributes.decidedBy')], actions: t('common.actions') }, attributes.map(attributeRow)),
  ));
});
