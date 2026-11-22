import { isSignedOut } from '../api.ts';
import { t } from '../i18n.ts';
import { start } from '../navigation.ts';
import { Button, setBusy } from '../ui/atoms/button.ts';
import type { ButtonOptions } from '../ui/atoms/button.ts';
import type { Child } from '../ui/dom.ts';
import { confirmDialog } from '../ui/molecules/dialog.ts';
import { Form } from '../ui/molecules/form.ts';
import { createToast } from '../ui/molecules/toast.ts';

// What pages share to act: the toast, buttons and forms wired to an action that takes time,
// the confirmation asked before what cannot be taken back, and the guard of a page.
export const toast = createToast(document.getElementById('toast') as HTMLElement);

export const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Asks before an action that cannot be taken back, in the interface's own dialog. */
export const confirmAction = (text: string, confirmLabel: string, danger = true): Promise<boolean> => confirmDialog({ text, confirmLabel, cancelLabel: t('common.cancel'), danger });

/** Run an async action from a button: disables it meanwhile and reports failures. */
export function busy(button: HTMLButtonElement, label: string, fn: () => unknown) {
  return async (event?: Event): Promise<void> => {
    event?.preventDefault();
    // The button keeps its label and its width; a spinner shows the wait, and `label` names it to screen readers.
    const name = button.getAttribute('aria-label');
    setBusy(button, true);
    if (label.length > 1) button.setAttribute('aria-label', label);
    try {
      await fn();
    } catch (e) {
      if (isSignedOut(e)) return start();
      toast(messageOf(e), true);
    } finally {
      setBusy(button, false);
      if (name === null) button.removeAttribute('aria-label');
      else button.setAttribute('aria-label', name);
    }
  };
}

/** A button wired to an async action. */
export function ActionButton(label: string, busyLabel: string, fn: () => unknown, options?: ButtonOptions): HTMLButtonElement {
  const button = Button(label, options);
  button.addEventListener('click', busy(button, busyLabel, fn));
  return button;
}

/** A form whose submit button runs an async action. */
export function SubmitForm(submit: HTMLButtonElement, busyLabel: string, fn: () => unknown, ...children: Child[]): HTMLFormElement {
  const form = Form(children);
  form.addEventListener('submit', busy(submit, busyLabel, fn));
  return form;
}

/** Wraps a page renderer: a lost session goes back to sign-in, any other failure is shown. */
export const guard = <A extends unknown[]>(fn: (...args: A) => Promise<void>) => async (...args: A): Promise<void> => {
  try {
    await fn(...args);
  } catch (e) {
    if (isSignedOut(e)) return start();
    toast(messageOf(e), true);
  }
};
