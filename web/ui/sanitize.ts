/**
 * The one place where HTML that did not come from our own code becomes DOM: what the user
 * pasted, what the LLM proposed, what a colleague sent. It is reduced to the few elements a
 * reply may contain, and returned as nodes — nothing here or anywhere else writes innerHTML.
 */
import DOMPurify from 'dompurify';

/** The same elements the server keeps (src/tooling/html.ts). */
const ALLOWED_TAGS = ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'blockquote'];

// A link in a reply opens beside the application, and tells the site it leads to nothing about us.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof HTMLAnchorElement) {
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  }
});

export function sanitizeToFragment(html: string): DocumentFragment {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
    RETURN_DOM_FRAGMENT: true,
  });
}
