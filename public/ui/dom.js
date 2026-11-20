/**
 * The one DOM helper of the design system. Text always goes through text nodes, never
 * innerHTML, so mail content cannot inject markup.
 *
 * Children may be nodes, strings, numbers, arrays of those, or falsy values (skipped),
 * which allows `condition && Component()` in a list of children.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

export function append(el, ...children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Join class names, skipping falsy ones: cx('btn', primary && 'btn--primary'). */
export const cx = (...names) => names.filter(Boolean).join(' ');
