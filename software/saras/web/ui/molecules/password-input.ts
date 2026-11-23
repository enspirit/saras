import { Icon } from '../atoms/icon.ts';
import { h } from '../dom.ts';

/**
 * A password input with an eye to see what is typed. `labels` name the eye for those who
 * cannot see it: what pressing it does, in each state.
 */
export function PasswordInput(input: HTMLInputElement, labels: { show: string; hide: string }): HTMLSpanElement {
  const eye = h('button', { type: 'button', class: 'password__eye', title: labels.show, 'aria-label': labels.show, 'aria-pressed': 'false' }, Icon('eye'));
  eye.addEventListener('click', () => {
    const shown = input.type === 'password';
    input.type = shown ? 'text' : 'password';
    eye.replaceChildren(Icon(shown ? 'eye-off' : 'eye'));
    eye.title = shown ? labels.hide : labels.show;
    eye.setAttribute('aria-label', eye.title);
    eye.setAttribute('aria-pressed', String(shown));
    input.focus();
  });
  return h('span', { class: 'password' }, input, eye);
}
