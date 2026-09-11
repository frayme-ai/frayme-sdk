/* Shared print helper — print ONLY a [data-fr-print-root] element, not the whole
 * app, WITHOUT the blank-pages bug.
 *
 * The old approach added `fr-printing` to <html> and hid everything else with
 * `visibility:hidden`. But visibility PRESERVES box height, so the full-height app
 * still paginated into 5–10 blank sheets. Pulling the root to `position:absolute`
 * fixed the blank pages only by clipping genuinely long documents to one page — a
 * lose-lose (verified with a headless page-count test).
 *
 * This instead walks the root → <body> and, at each level, `display:none`s the
 * SIBLINGS off the path (so their height disappears → no blank pages) and resets
 * the ancestor chain's own height/padding (so an app-shell `min-height:100vh`
 * leaves no residual page). The document itself stays in NORMAL FLOW, so a long
 * document still paginates naturally. Everything is a transient data-attribute on
 * existing DOM nodes, removed after printing — it never reparents or mutates React-
 * owned structure, so it is safe to call from a component. */
export function printFraymeRoot(root: HTMLElement | null): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (!root) {
    window.print();
    return;
  }
  const marked: Element[] = [];
  const mark = (el: Element, attr: string): void => {
    if (!el.hasAttribute(attr)) {
      el.setAttribute(attr, '');
      marked.push(el);
    }
  };
  let node: HTMLElement | null = root;
  while (node && node !== document.body && node.parentElement) {
    for (const sib of Array.from(node.parentElement.children)) {
      if (sib !== node) mark(sib, 'data-fr-print-hidden');
    }
    node = node.parentElement;
    if (node && node !== document.body) mark(node, 'data-fr-print-ancestor');
  }
  const cleanup = (): void => {
    for (const el of marked) {
      el.removeAttribute('data-fr-print-hidden');
      el.removeAttribute('data-fr-print-ancestor');
    }
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // Fallback for browsers that don't fire `afterprint` (or a cancelled dialog).
  setTimeout(cleanup, 1000);
}
