/**
 * Something that opens under a button, above everything else on the page. It is a popover of
 * the browser's own: shown in the top layer, where no scrolling area or panel can cut it, and
 * closed by the browser on a click elsewhere or on Escape. It is tied to its button by CSS
 * anchor positioning (see `[popover]` in design/base.css), which also moves it where there is room.
 * `make` builds what opens, and is handed the way to close it; what is returned toggles it.
 */
let made = 0;

/** Where a browser without anchor positioning puts what opens: under its button, by the numbers. */
function placeUnder(button: HTMLElement, opened: HTMLElement): void {
  if (CSS.supports('position-area', 'bottom')) return;
  const { left, bottom } = button.getBoundingClientRect();
  Object.assign(opened.style, { left: `${left}px`, top: `${bottom}px` });
}

/** Shows what was made as a popover anchored to the button; when it closes, however it does, it is taken away. */
function show(anchor: HTMLElement, button: HTMLElement, opened: HTMLElement, closed: () => void): void {
  const name = `--popover-${(made += 1)}`;
  button.style.setProperty('anchor-name', name);
  opened.style.setProperty('position-anchor', name);
  opened.popover = 'auto';
  opened.addEventListener('toggle', (event) => {
    if ((event as ToggleEvent).newState !== 'closed') return;
    opened.remove();
    button.style.removeProperty('anchor-name');
    button.setAttribute('aria-expanded', 'false');
    closed();
  });
  anchor.appendChild(opened).showPopover();
  placeUnder(button, opened);
  button.setAttribute('aria-expanded', 'true');
}

export function popover(anchor: HTMLElement, button: HTMLElement, make: (close: () => void) => HTMLElement): () => void {
  let open: HTMLElement | null = null;
  // A press on the button of an open popover closes it, as a click elsewhere does: the click that follows must not open it again.
  let pressedWhileOpen = false;
  button.addEventListener('pointerdown', () => (pressedWhileOpen = open !== null));
  return () => {
    const reopening = pressedWhileOpen;
    pressedWhileOpen = false;
    if (open) return open.hidePopover();
    if (reopening) return;
    open = make(() => open?.hidePopover());
    show(anchor, button, open, () => (open = null));
  };
}
