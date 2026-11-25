import { h } from '../dom.ts';

/** An entry that can be moved among the others, and what names it in the order. */
export interface SortableItem<K> {
  key: K;
  node: HTMLElement;
}

const MARKS = ['sortable--moving', 'sortable--before', 'sortable--after'];
const unmarked = (node: HTMLElement): void => node.classList.remove(...MARKS);

/** Whether the pointer is over the lower half of an entry: what is dropped there goes after it. */
const lowerHalf = (event: DragEvent, node: HTMLElement): boolean => {
  const { top, height } = node.getBoundingClientRect();
  return event.clientY > top + height / 2;
};

/** The list of entries as it is now, and what moves one of them. */
function arrangement<K>(items: SortableItem<K>[], onOrder: (keys: K[]) => void) {
  let order = [...items];
  /** Puts `item` just before or after `target`, on screen as in the order, and says the new order. */
  const place = (item: SortableItem<K>, target: SortableItem<K>, after: boolean): void => {
    if (item === target) return;
    order = order.filter((other) => other !== item);
    order.splice(order.indexOf(target) + (after ? 1 : 0), 0, item);
    target.node[after ? 'after' : 'before'](item.node);
    onOrder(order.map((other) => other.key));
  };
  /** Moves `item` one place up or down, when there is one. */
  const step = (item: SortableItem<K>, down: boolean): void => {
    const target = order[order.indexOf(item) + (down ? 1 : -1)];
    if (target) place(item, target, down);
  };
  return { place, step };
}

/** With the keyboard: Alt and an arrow moves the entry one place, and keeps the focus on it. */
function movedByKeyboard<K>(item: SortableItem<K>, step: (item: SortableItem<K>, down: boolean) => void): void {
  item.node.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown');
  item.node.addEventListener('keydown', (event) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    step(item, event.key === 'ArrowDown');
    item.node.focus();
  });
}

/** What is being dragged, among the entries of one list. */
interface Drag<K> {
  moving: SortableItem<K> | null;
}

/** An entry is picked up, and let go of: wherever it lands, the marks of the drag are taken off. */
function pickedUp<K>(item: SortableItem<K>, items: SortableItem<K>[], drag: Drag<K>): void {
  item.node.draggable = true;
  item.node.addEventListener('dragstart', (event) => {
    drag.moving = item;
    item.node.classList.add('sortable--moving');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });
  item.node.addEventListener('dragend', () => {
    drag.moving = null;
    items.forEach((other) => unmarked(other.node));
  });
}

/** Another entry is dragged over this one, shown where it would land, and dropped there. */
function droppedOn<K>(item: SortableItem<K>, drag: Drag<K>, place: (item: SortableItem<K>, target: SortableItem<K>, after: boolean) => void): void {
  const { node } = item;
  node.addEventListener('dragover', (event) => {
    if (!drag.moving || drag.moving === item) return;
    event.preventDefault();
    const after = lowerHalf(event, node);
    node.classList.toggle('sortable--before', !after);
    node.classList.toggle('sortable--after', after);
  });
  node.addEventListener('dragleave', () => node.classList.remove('sortable--before', 'sortable--after'));
  node.addEventListener('drop', (event) => {
    event.preventDefault();
    if (drag.moving) place(drag.moving, item, lowerHalf(event, node));
  });
}

/**
 * Entries that are put in order by dragging one onto another, or with Alt and an arrow. The
 * entries move on screen at once; `onOrder` is told the keys in their new order, to keep it.
 */
export function Sortable<K>(items: SortableItem<K>[], onOrder: (keys: K[]) => void): HTMLDivElement {
  const { place, step } = arrangement(items, onOrder);
  const drag: Drag<K> = { moving: null };
  for (const item of items) {
    pickedUp(item, items, drag);
    droppedOn(item, drag, place);
    movedByKeyboard(item, step);
  }
  return h('div', { class: 'sortable' }, items.map((item) => item.node));
}
