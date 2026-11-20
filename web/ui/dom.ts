/**
 * The one DOM helper of the design system. Text always goes through text nodes, never
 * innerHTML, so mail content cannot inject markup.
 */

/**
 * What a component accepts as content: nodes, text, numbers, arrays of those, and falsy
 * values (skipped), which allows `condition && Component()` in a list of children.
 */
export type Child = Node | string | number | false | null | undefined | Child[];

/** DOM properties (`value`, `hidden`…), attributes (`aria-current`…) and `on<event>` listeners. */
export type Attrs = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k in el && k !== 'list' && k !== 'form') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

export function append<T extends Element>(el: T, ...children: Child[]): T {
  for (const c of (children as unknown[]).flat(Infinity) as Exclude<Child, Child[]>[]) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Join class names, skipping falsy ones: cx('btn', primary && 'btn--primary'). */
export const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ');
