// The rule of an attribute being written: checked as it is written, and tried on recent emails
// before it is kept.

import type { Attribute, AttributeValue, RuleProblem, RuleTried, ValueGiven } from '../../shared/attribute.ts';
import { checkRule, tryRule } from '../api/attributes.ts';
import { t, tRich } from '../i18n.ts';
import { ActionButton } from './actions.ts';
import { chipFor, noValueChip } from './attribute-values.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { ButtonLink } from '../ui/atoms/button.ts';
import { Code, Link, Muted, Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { CardSection } from '../ui/molecules/card.ts';
import type { EloEditorHandle } from '../ui/molecules/elo-editor.ts';
import { Block, Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';
import { Problems, Proportion } from '../ui/molecules/rule-help.ts';
import { Table } from '../ui/molecules/table.ts';

export type EloEditorMaker = typeof import('../ui/molecules/elo-editor.ts').EloEditor;

/** A place on the page whose content changes: what is shown there is replaced by what comes next. */
function slot(shown: HTMLElement): { first: HTMLElement; show(next: HTMLElement): void } {
  const first = shown;
  return { first, show: (next) => (shown.replaceWith(next), void (shown = next)) };
}

/** Whether the rule fits the email, in a word. */
const statusOf = (problems: RuleProblem[]): HTMLElement =>
  problems.length ? Badge(t('rules.problems', { count: problems.length }), 'danger') : Badge(t('rules.fits'), 'ok');

/** What is wrong, each with its place; where a field was probably meant, one click writes it. */
const problemsOf = (problems: RuleProblem[], editor: () => EloEditorHandle): HTMLElement =>
  Problems(problems.map((problem) => ({
    where: t('rules.where', { line: problem.line, column: problem.column }),
    message: problem.message,
    fix: problem.suggestion ? { before: t('rules.didYouMean'), label: problem.suggestion, apply: () => editor().fix(problem) } : undefined,
  })));

/** The attribute as the values being typed make it: so that what a rule answers is shown as it will be. */
export const typed = (attribute: Attribute | null, values: ValueGiven[]): Attribute => {
  const made: AttributeValue[] = values.map(({ label, color }, index) => ({ key: String(index + 1), label, color }));
  return attribute && (attribute.system || attribute.kind === 'member') ? attribute : { key: '', name: '', kind: 'choice', values: made, decidedBy: 'elo', elo: '', system: false };
};

const chipOrNone = (attribute: Attribute, key: string | null | undefined): HTMLSpanElement => chipFor(attribute, key ?? undefined, true) ?? noValueChip(true);

/** What changes for one email, in a word: a value where there was none, or nothing because a member set it. */
function remark({ value, now }: RuleTried): Child {
  if (now?.source === 'user' && now.value !== value) return Muted(t('rules.triedStays'));
  return !now && value ? Muted(t('rules.triedNew')) : null;
}

/** How many of the emails tried get each value, and how many the rule says nothing of. */
const shares = (attribute: Attribute, tried: RuleTried[]) => [
  ...attribute.values.map((v) => ({ label: chipFor(attribute, v.key, true), count: tried.filter((one) => one.value === v.key).length, color: v.color })).filter((part) => part.count > 0),
  { label: noValueChip(true), count: tried.filter((one) => one.value === null).length },
];

/** What the rule says of recent emails, beside what each has now. */
const triedSection = (attribute: Attribute, tried: RuleTried[]): HTMLElement =>
  CardSection(t('rules.triedTitle', { count: tried.length }),
    Proportion(shares(attribute, tried), t('rules.triedShares')),
    Table({ columns: [t('attributes.triedEmail'), t('rules.triedNow'), t('rules.triedSays')] },
      tried.map((one) => [[one.subject || t('mailbox.noSubject'), ' ', Muted(one.from)], chipOrNone(attribute, one.now?.value), [chipOrNone(attribute, one.value), ' ', remark(one)]])));

/** The skill that has an AI assistant write the rule: of this attribute, with its name and its values, or of any. */
const skillLink = (attribute: Attribute | null): HTMLElement =>
  ButtonLink(t('attributes.skill'), { href: attribute ? `/api/attributes/${attribute.key}/skill` : '/api/attributes/skill', variant: 'link' });

/** The rule: the editor, whether it fits the email, and a way to see it at work on recent emails before it is kept. */
export function ruleSection(attribute: Attribute | null, EloEditor: EloEditorMaker, values: () => ValueGiven[]): { section: HTMLElement; editor: EloEditorHandle } {
  const status = slot(Badge(t('rules.unchecked'), 'neutral'));
  const problems = slot(Muted());
  const result = slot(Muted());
  const checked = (found: RuleProblem[]): void => (status.show(statusOf(found)), problems.show(found.length ? problemsOf(found, () => editor) : Muted()));
  const editor: EloEditorHandle = EloEditor({ value: attribute?.elo ?? '', label: t('attributes.ruleTitle'), hint: t('attributes.ruleExample'), check: checkRule, onChecked: checked });
  const tryIt = ActionButton(t('attributes.try'), '…', async () => {
    const shown = typed(attribute, values());
    result.show(triedSection(shown, await tryRule(editor.value(), attribute?.key ?? null, values())));
  }, { icon: 'play' });
  const section = CardSection(t('attributes.ruleTitle'),
    Block(Text({ muted: true, small: true }, tRich('attributes.ruleIntro', {}, { link: (label) => Link(label, 'https://elo-lang.org'), code: Code }), ' ', status.first)),
    Field(null, [editor.element, problems.first]), Actions(tryIt, skillLink(attribute)), result.first);
  return { section, editor };
}
