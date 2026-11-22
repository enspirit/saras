import { Button } from '../atoms/button.ts';
import { Input } from '../atoms/input.ts';
import { Heading } from '../atoms/text.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

export interface DialogOptions {
  /** The question, in a few words. */
  title?: string;
  /** What will happen, in a sentence. */
  text?: Child;
  confirmLabel: string;
  cancelLabel: string;
  /** The action destroys something: its button says so, and Cancel is the default. */
  danger?: boolean;
}

/** What a dialog may ask for besides a yes or a no: one value, under its label. */
interface DialogField {
  label: string;
  input: HTMLInputElement;
}

/** The dialog itself: the question, the field when there is one, and the two answers. */
function DialogBox({ title, text }: DialogOptions, field: DialogField | undefined, cancel: HTMLButtonElement, confirm: HTMLButtonElement): HTMLDialogElement {
  return h('dialog', { class: 'dialog' },
    h('form', { method: 'dialog' },
      h('div', { class: 'dialog__body' },
        title ? Heading(2, title) : null,
        text && h('div', { class: 'dialog__text' }, text),
        field && h('label', { class: 'dialog__field field__label' }, field.label, field.input),
      ),
      h('div', { class: 'dialog__actions' }, cancel, confirm),
    ),
  );
}

/** Opens a modal dialog and resolves with what was typed in `field` (or '' without one), or null when dismissed. */
function openDialog(options: DialogOptions, field?: DialogField): Promise<string | null> {
  const { confirmLabel, cancelLabel, danger = false } = options;
  const confirm = Button(confirmLabel, { variant: danger ? 'destructive' : 'primary', type: 'submit' });
  confirm.value = 'confirm';
  const cancel = Button(cancelLabel, { onClick: () => dialog.close() });
  const dialog = DialogBox(options, field, cancel, confirm);
  const answer = new Promise<string | null>((resolve) => dialog.addEventListener('close', () => {
    dialog.remove();
    resolve(dialog.returnValue === 'confirm' ? (field?.input.value ?? '') : null);
  }));
  document.body.append(dialog);
  dialog.showModal();
  (field?.input ?? (danger ? cancel : confirm)).focus();
  return answer;
}

/** Asks for a confirmation before an action. Resolves to true when confirmed; Escape cancels. */
export const confirmDialog = async (options: DialogOptions): Promise<boolean> => (await openDialog(options)) !== null;

/** Asks for one value. Resolves to it, or to null when dismissed. */
export function promptDialog({ label, value = '', ...options }: DialogOptions & { label: string; value?: string }): Promise<string | null> {
  return openDialog(options, { label, input: Input({ value, required: true }) });
}
