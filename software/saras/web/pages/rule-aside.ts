// Beside a rule being written, and in the guide: what a rule can read and Elo in a few lines;
// beside a rule, what it can answer; in the guide, the skill that has an AI assistant write a rule.

import { EMAIL_FIELDS, STATUS, saidInRule, valuesForRules } from '../../shared/attribute.ts';
import type { Attribute, EmailFieldPath } from '../../shared/attribute.ts';
import { ELO_IN_BRIEF } from '../../shared/rule-recipes.ts';
import { t, tRich } from '../i18n.ts';
import { valueLabel } from './attribute-names.ts';
import { ButtonLink } from '../ui/atoms/button.ts';
import { Code, Link, Text } from '../ui/atoms/text.ts';
import { Card } from '../ui/molecules/card.ts';
import { Actions } from '../ui/molecules/form.ts';
import { FieldList, Snippet } from '../ui/molecules/rule-help.ts';
import type { FieldEntry } from '../ui/molecules/rule-help.ts';

/** What each field is, as a translation key. */
const WHAT: Record<EmailFieldPath, string> = {
  '_.from.address': 'rules.field.fromAddress',
  '_.from.name': 'rules.field.fromName',
  '_.to': 'rules.field.to',
  '_.cc': 'rules.field.cc',
  '_.subject': 'rules.field.subject',
  '_.text': 'rules.field.text',
  '_.attachments': 'rules.field.attachments',
  '_.date': 'rules.field.date',
  '_.mailbox': 'rules.field.mailbox',
  '_.answered': 'rules.field.answered',
  '_.headers.listUnsubscribe': 'rules.field.listUnsubscribe',
  '_.headers.listId': 'rules.field.listId',
  '_.headers.autoSubmitted': 'rules.field.autoSubmitted',
  '_.headers.precedence': 'rules.field.precedence',
};

/** What a rule can read of an email, field by field. */
export const emailFields = (): FieldEntry[] => EMAIL_FIELDS.map(({ path, type }) => ({ path, type, what: t(WHAT[path]) }));

/** What each line of Elo in brief means, as a translation key. */
const BRIEF: Record<(typeof ELO_IN_BRIEF)[number]['key'], string> = {
  choice: 'rules.brief.choice',
  naming: 'rules.brief.naming',
  contains: 'rules.brief.contains',
  any: 'rules.brief.any',
  chain: 'rules.brief.chain',
  logic: 'rules.brief.logic',
};

/** The fields of the email; with `onPick`, a click writes one in the rule. */
export const fieldsCard = (onPick?: (path: string) => void): HTMLDivElement =>
  Card({ title: t('rules.fieldsTitle') },
    Text({ muted: true, small: true }, tRich(onPick ? 'rules.fieldsPick' : 'rules.fieldsIntro', {}, { code: Code })),
    FieldList(emailFields(), onPick));

/** Elo in a few lines, and where the rest is. */
export const briefCard = (more: { label: string; href: string }): HTMLDivElement =>
  Card({ title: t('rules.briefTitle') }, ELO_IN_BRIEF.map(({ key, elo }) => Snippet(elo, t(BRIEF[key]))), Text({ small: true }, Link(more.label, more.href)));

/** A text as Elo writes one. */
const quoted = (text: string): string => `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

/** What the rule of an attribute may answer, each as it is written: one of its values, nothing, a value and why. */
function answers(attribute: Attribute): FieldEntry[] {
  const values = valuesForRules(attribute).map((value) => ({ path: quoted(saidInRule(attribute, value)), type: '', what: attribute.system ? valueLabel(attribute, value) : '' }));
  const why = values[0] ? [{ path: `{value: ${values[0].path}, reason: '…'}`, type: '', what: t('rules.answerWhy') }] : [];
  return [...values, { path: 'null', type: '', what: t('rules.answerNothing') }, ...why];
}

/** What the rule of this attribute can answer: a click writes one in the rule. */
export const answersCard = (attribute: Attribute, onPick: (answer: string) => void): HTMLDivElement =>
  Card({ title: t('rules.answersTitle') },
    Text({ muted: true, small: true }, t('rules.answersPick')),
    FieldList(answers(attribute), onPick),
    attribute.key === STATUS && Text({ muted: true, small: true }, tRich('rules.answerCodes', {}, { code: Code })));

/** The skill to hand an AI assistant, in the guide: each attribute offers its own beside its rule. */
export const skillCard = (): HTMLDivElement =>
  Card({ title: t('rules.skillTitle') },
    Text({ muted: true, small: true }, t('rules.skillGeneral')),
    Actions(ButtonLink(t('attributes.skill'), { href: '/api/attributes/skill' })));
