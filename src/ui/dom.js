/**
 * DOM toolkit — the small, reusable building blocks the UI is rendered with.
 *
 * Security: the el() builder inserts every value via textContent or typed DOM
 * properties and *refuses* innerHTML outright, so there is no HTML-injection
 * surface no matter what flows through it.
 */

/** Tiny element builder to keep rendering declarative and injection-safe. */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') throw new Error('innerHTML is intentionally not supported');
    else if (key.startsWith('data-') || key === 'role' || key === 'for')
      node.setAttribute(key, value);
    else if (key === 'aria') {
      for (const [a, v] of Object.entries(value)) node.setAttribute(`aria-${a}`, v);
    } else node[key] = value;
  }
  for (const child of [].concat(children)) if (child != null) node.append(child);
  return node;
}

/** Shorthand for document.getElementById. */
export const $ = (id) => document.getElementById(id);

/** True when the user has asked the OS to minimize animation/motion. */
export function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/** Scroll an element into view, honouring the user's reduced-motion preference. */
export function scrollIntoViewSafe(node) {
  node?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  });
}
