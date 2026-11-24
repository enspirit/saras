// The attribute an organisation starts with beside "Stands in": a priority, set by hand, named
// in its creator's language. It is the organisation's own from then on, like any it makes: it
// can be renamed, given other values or a rule, and deleted (decision 0014).
import type { AttributeGiven } from '../../../shared/attribute.ts';

const priority = (name: string, high: string, normal: string, low: string): AttributeGiven => ({
  name,
  kind: 'choice',
  values: [{ label: high, color: 'red' }, { label: normal, color: 'grey' }, { label: low, color: 'blue' }],
  decidedBy: 'nobody',
  elo: '',
});

const PRIORITY: Record<string, AttributeGiven> = {
  en: priority('Priority', 'High', 'Normal', 'Low'),
  fr: priority('Priorité', 'Haute', 'Normale', 'Basse'),
};

/** The attributes of its own an organisation starts with, in this language; in English when we do not have it. */
export const firstAttributes = (language: string): AttributeGiven[] => [PRIORITY[language] ?? PRIORITY[language.split('-')[0] ?? ''] ?? PRIORITY.en!];
