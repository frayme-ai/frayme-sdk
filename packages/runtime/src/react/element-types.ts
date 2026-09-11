'use client';
import { createContext, useContext } from 'react';

/* Responsive keystone: id → component type for the
 * CURRENT spec, provided by FraymeRenderer. Layout components use it to classify
 * their children STRUCTURALLY — a horizontal Stack holding ≥2 block-level
 * containers is a COLUMN LAYOUT (form beside a summary card) and must collapse
 * to a stacked full-width column on narrow containers, while an inline row
 * (icon + text, two buttons side by side) stays horizontal. Null outside a
 * FraymeRenderer (tests mounting a component directly) — consumers fall back to "not a column
 * layout", which keeps the pre-keystone render byte-identical. */
export const ElementTypesContext = createContext<Readonly<Record<string, string>> | null>(null);

/* The block-level "containery" catalog types that make a side-by-side layout
 * read as COLUMNS. Names verified against the registry map — an unknown name
 * simply never matches (safe). Leaves (Text, Icon, Button, Badge, inputs…) are
 * deliberately absent: rows of leaves are inline rows, not columns. */
const COLUMN_TYPES = new Set([
  'Stack',
  'Card',
  'Box',
  'Section',
  'Grid',
  'Form',
  'Table',
  'DataTable',
  'StatGroup',
  'DescriptionList',
  'Collapsible',
  'Tabs',
  'Callout',
  'Timeline',
  'Calendar',
  'Scheduler',
  'KanbanBoard',
  'BarChart',
  'LineChart',
  'AreaChart',
  'PieChart',
  'DonutChart',
  'ScatterChart',
  'RadarChart',
  'FunnelChart',
  'Heatmap',
  'LogConsole',
  'BlockDocumentEditor',
  'EditableSpreadsheetGrid',
]);

/* Column-vs-lockup rule:
 * VERTICAL Stacks are content columns (a text run beside a card is a legit
 * aside); HORIZONTAL Stacks are inline lockups (icon+text, badge rows, legend
 * strips) unless they hold containery content themselves. Needs children ids +
 * direction, so the provider carries meta alongside types. */
export interface ElementMeta {
  kids: readonly string[];
  horizontal: boolean;
}
export const ElementChildrenContext = createContext<Readonly<Record<string, ElementMeta>> | null>(null);

function isColumnChild(id: string, types: Readonly<Record<string, string>>, metaOf: Readonly<Record<string, ElementMeta>> | null, depth = 0): boolean {
  const t = types[id];
  if (typeof t !== 'string' || !COLUMN_TYPES.has(t)) return false;
  if (t !== 'Stack' || depth > 6) return t !== 'Stack';
  const meta = metaOf?.[id];
  const kids = meta?.kids ?? [];
  if (!meta?.horizontal) return kids.length >= 1;
  return kids.some((g) => isColumnChild(g, types, metaOf, depth + 1));
}

/** True when ≥2 of the given child ids resolve to block-container CONTENT — the
 * structural signature of a column layout. Unconditional hook (call it every
 * render); outside a provider it returns false. */
export function useIsColumnLayout(childIds: unknown): boolean {
  const types = useContext(ElementTypesContext);
  const childrenOf = useContext(ElementChildrenContext);
  if (!types || !Array.isArray(childIds)) return false;
  let n = 0;
  for (const id of childIds) {
    if (typeof id === 'string' && isColumnChild(id, types, childrenOf)) {
      n += 1;
      if (n >= 2) return true;
    }
  }
  return false;
}

/* ── Width law ───────────────────────────────────────────────────────────────
 * Page width is CONSTANT: every spec renders at full host width. The old
 * computeMeasureMode heuristic (a WIDE_DATA_TYPES enum deciding capped-vs-full
 * per spec) made sibling specs render at different page widths — killed.
 * Width restraint lives in the components now: flowing copy self-caps at a
 * reading measure, pickers self-cap their panels, and lone form controls get
 * column/card management at the spec level (see frayme.css "Width law"). */
