// The second factor: after the password, the code of an authenticator app. The first time,
// the app is set up, and recovery codes are given to keep.

import type { Admitted, SecondFactorAsked } from '../../shared/access.ts';
import { giveSecondFactor } from '../api/access.ts';
import { t } from '../i18n.ts';
import { SubmitForm } from './actions.ts';
import { publicInfo, showVisitorScreen } from './visitor-screen.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input } from '../ui/atoms/input.ts';
import { Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { CodeList } from '../ui/molecules/code-list.ts';
import { Block, Field } from '../ui/molecules/field.ts';
import { QrCode } from '../ui/molecules/qr-code.ts';

/** Where a sign-in goes on: `next` once in, `again` to start over with the password. */
export interface Onwards {
  next: () => Promise<void>;
  again: () => void;
}

/** Setting the app up: the QR code to scan, or the key to type. */
const settingUp = (asked: SecondFactorAsked): Child => [
  Block(Text({}, t('secondFactor.enrolIntro'))),
  QrCode(asked.uri ?? '', t('secondFactor.qrLabel')),
  Field(t('secondFactor.key'), Input({ readOnly: true, value: asked.secret ?? '' }), { hint: t('secondFactor.keyHint') }),
];

/** The recovery codes, shown once: the member goes on when they have kept them. */
async function recoveryCodesPage(codes: string[], { next }: Onwards): Promise<void> {
  showVisitorScreen(await publicInfo(), { title: t('secondFactor.recoveryTitle'), intro: t('secondFactor.recoveryIntro') },
    CodeList(codes),
    Button(t('secondFactor.recoveryKept'), { variant: 'primary', size: 'large', block: true, onClick: () => void next() }),
  );
}

/** GiveSecondFactor: the code, then in — by way of the recovery codes when the app was just set up. */
function codeForm(asked: SecondFactorAsked, onwards: Onwards): { form: HTMLFormElement; code: HTMLInputElement } {
  const code = Input({ required: true, inputMode: 'numeric', autocomplete: 'one-time-code', placeholder: '123 456' });
  const submit = Button(t('secondFactor.confirm'), { variant: 'primary', size: 'large', type: 'submit', block: true });
  const form = SubmitForm(submit, '…', async () => {
    const { recoveryCodes } = await giveSecondFactor(code.value);
    await (recoveryCodes ? recoveryCodesPage(recoveryCodes, onwards) : onwards.next());
  },
    asked.step === 'enrol' && settingUp(asked),
    Field(t('secondFactor.code'), code, { hint: asked.step === 'code' && t('secondFactor.codeHint') }),
    submit,
  );
  return { form, code };
}

async function secondFactorPage(asked: SecondFactorAsked, onwards: Onwards): Promise<void> {
  const { form, code } = codeForm(asked, onwards);
  const enrol = asked.step === 'enrol';
  showVisitorScreen(await publicInfo(), {
    title: enrol ? t('secondFactor.enrolTitle') : t('secondFactor.title'),
    intro: enrol ? t('secondFactor.enrolWhy') : t('secondFactor.intro'),
    foot: Button(t('secondFactor.startAgain'), { variant: 'link', onClick: onwards.again }),
  }, form);
  code.focus();
}

/** After a password was accepted or an account opened: on to `next`, by way of the second factor where one is asked. */
export const continueSigningIn = (admitted: Admitted, onwards: Onwards): Promise<void> =>
  admitted.secondFactor ? secondFactorPage(admitted.secondFactor, onwards) : onwards.next();
