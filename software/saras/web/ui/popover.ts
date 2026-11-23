/**
 * Something that opens under a button and closes on a choice, a click elsewhere or Escape.
 * `make` builds what opens, and is handed the way to close it; what is returned toggles it.
 */
export function popover(anchor: HTMLElement, button: HTMLElement, make: (close: () => void) => HTMLElement): () => void {
  let open: HTMLElement | null = null;
  const outside = (event: Event): void => void (!anchor.contains(event.target as Node) && close());
  const escape = (event: KeyboardEvent): void => void (event.key === 'Escape' && (close(), button.focus()));
  function close(): void {
    open?.remove();
    open = null;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside);
    document.removeEventListener('keydown', escape);
  }
  return () => {
    if (open) return close();
    open = anchor.appendChild(make(close));
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
  };
}
