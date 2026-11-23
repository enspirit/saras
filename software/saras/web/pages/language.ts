// Choosing the language of the interface.

import { language, languages, setLanguage, t } from '../i18n.ts';
import { Select } from '../ui/atoms/input.ts';
import type { Child } from '../ui/dom.ts';
import { Field } from '../ui/molecules/field.ts';

/** A language selector, when there is more than one language to choose from. */
export function LanguagePicker(): Child {
  if (languages().length < 2) return null;
  const select = Select(languages().map((l) => ({ value: l.tag, label: l.name, selected: l.tag === language() })), { onchange: () => setLanguage(select.value) });
  return Field(t('settings.language'), select);
}
