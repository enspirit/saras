// Writing a rule: what one is, what it can read, rules to start from, Elo in brief, and what is checked.

import { RECIPES } from '../../shared/rule-recipes.ts';
import type { Recipe } from '../../shared/rule-recipes.ts';
import { t, tRich } from '../i18n.ts';
import { guard, toast } from './actions.ts';
import { briefCard, fieldsCard, skillCard } from './rule-aside.ts';
import { shell } from './shell.ts';
import { Code, Heading, Link, List, Prose, Text } from '../ui/atoms/text.ts';
import { Card } from '../ui/molecules/card.ts';
import { Block } from '../ui/molecules/field.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { CodeCard, CodeCards } from '../ui/molecules/rule-help.ts';
import { Columns, Page } from '../ui/organisms/page.ts';

/** `title` and `what` are translation keys. */
const RECIPE_TEXT: Record<Recipe['key'], { title: string; what: string }> = {
  domain: { title: 'rules.recipe.domain', what: 'rules.recipe.domainWhat' },
  words: { title: 'rules.recipe.words', what: 'rules.recipe.wordsWhat' },
  attachment: { title: 'rules.recipe.attachment', what: 'rules.recipe.attachmentWhat' },
  mailbox: { title: 'rules.recipe.mailbox', what: 'rules.recipe.mailboxWhat' },
  newsletter: { title: 'rules.recipe.newsletter', what: 'rules.recipe.newsletterWhat' },
  reason: { title: 'rules.recipe.reason', what: 'rules.recipe.reasonWhat' },
};

const EXAMPLE = `if contains(lower(_.subject), 'invoice')\nthen 'billing' else null`;

/** What a rule is given, what it answers, and what happens when it says nothing. */
const shapeCard = (): HTMLDivElement =>
  Card({ title: t('rules.shapeTitle') },
    Text({}, tRich('rules.shapeGiven', {}, { code: Code })),
    Block(Prose(EXAMPLE)),
    Text({}, tRich('rules.shapeAnswers', {}, { code: Code })),
    Text({ muted: true }, t('rules.shapeNothing')));

const recipeCard = ({ key, elo }: Recipe): HTMLElement =>
  CodeCard({ title: t(RECIPE_TEXT[key].title), what: t(RECIPE_TEXT[key].what), code: elo, copyLabel: t('rules.copy'), onCopied: () => toast(t('rules.copied')) });

/** What saras checks of a rule, and the limits it runs within. */
const checkedCard = (): HTMLDivElement =>
  Card({ title: t('rules.checkedTitle') }, List([t('rules.checkedType'), t('rules.checkedLimits'), t('rules.checkedValues'), t('rules.checkedFails')]));

export const ruleGuidePage = guard(async () => {
  shell(Page(
    PageHeader({ title: t('rules.guideTitle'), intro: tRich('rules.guideIntro', {}, { link: (label) => Link(label, 'https://elo-lang.org'), code: Code }), crumbs: [{ label: t('attributes.title'), href: '#/attributes' }] }),
    Columns([shapeCard(), checkedCard()], [fieldsCard()]),
    Block(Heading(2, t('rules.recipesTitle'))),
    CodeCards(RECIPES.map(recipeCard)),
    Columns(briefCard({ label: t('rules.eloSite'), href: 'https://elo-lang.org' }), skillCard()),
  ));
});
