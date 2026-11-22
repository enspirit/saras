// The key step of getting started, when no AI key is available: the administrator gives the
// organisation's, or goes on without.

import { setOrganizationKey } from '../../api/settings.ts';
import { t, tRich } from '../../i18n.ts';
import { SubmitForm } from '../actions.ts';
import { leaveStep, PathSteps } from './path.ts';
import { shell } from '../shell.ts';
import { refreshMe } from '../../session.ts';
import { Button } from '../../ui/atoms/button.ts';
import { Input } from '../../ui/atoms/input.ts';
import { Link } from '../../ui/atoms/text.ts';
import { Card } from '../../ui/molecules/card.ts';
import { Field } from '../../ui/molecules/field.ts';
import { Actions } from '../../ui/molecules/form.ts';
import { PageHeader } from '../../ui/molecules/page-header.ts';
import { Page } from '../../ui/organisms/page.ts';

/** SetOrganizationKey, then on with the path. */
function keyForm(key: HTMLInputElement): HTMLFormElement {
  const save = Button(t('mailboxes.keySave'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    await setOrganizationKey(key.value);
    await refreshMe();
    leaveStep('key');
  },
    Field(t('organization.key'), key, { hint: tRich('mailboxes.keyHint', {}, { link: (label) => Link(label, 'https://openrouter.ai/keys') }) }),
    Actions(save, Button(t('mailboxes.keyLater'), { variant: 'link', onClick: () => leaveStep('key') })),
  );
}

/** Last step before the emails when no AI key is available: the administrator gives the organisation's, or goes on without. */
export function organisationKeyPage(): void {
  const key = Input({ type: 'password', required: true, autocomplete: 'off', placeholder: 'sk-or-…' });
  shell(Page(
    PathSteps('key'),
    PageHeader({ title: t('mailboxes.keyTitle'), intro: t('mailboxes.keyIntro') }),
    Card({ form: true }, keyForm(key)),
  ));
  key.focus();
}
