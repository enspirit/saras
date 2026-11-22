import { cx, h } from '../dom.ts';

/** The glyphs of the icon font that the interface uses (see .icon in design/atoms/icon.css). */
export type IconName =
  | 'archive' | 'bold' | 'check' | 'chevron-down' | 'chevron-right' | 'copy' | 'folder' | 'key' | 'shield-check' | 'user-plus' | 'circle-alert' | 'eye-off' | 'file-text' | 'globe' | 'inbox' | 'info' | 'italic'
  | 'link' | 'list' | 'list-ordered' | 'lock' | 'log-out' | 'mail' | 'mail-check' | 'paperclip' | 'pen-line' | 'pencil' | 'plug' | 'plus'
  | 'refresh-cw' | 'remove-formatting' | 'reply' | 'search' | 'send' | 'settings' | 'spell-check' | 'timer' | 'trash' | 'triangle-alert'
  | 'underline' | 'undo' | 'users' | 'x';

export type Size = 'small' | 'medium' | 'large';

/** A decorative glyph: what it means is always said in words next to it, or by its button's label. */
export function Icon(name: IconName, { size = 'medium' }: { size?: Size } = {}): HTMLElement {
  return h('i', { class: cx('icon', `icon--${name}`, size !== 'medium' && `icon--${size}`), 'aria-hidden': 'true' });
}
