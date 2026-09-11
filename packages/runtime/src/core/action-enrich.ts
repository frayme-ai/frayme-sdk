/**
 * RECEIPT ENRICHMENT — the two facts a thread card needs that the dispatch did
 * not carry until now: what the pressed control was CALLED, and what the action
 * DOES.
 *
 * When a control fires a declared action, the host
 * shows a CARD in the chat thread — the control's name, its description, and a
 * human-readable table of the params. The name is shown VERBATIM (never
 * re-cased; core/thread-text.ts explains why — labels are often not English)
 * and only the fallback, `humanizeName(action)`, is derived. The
 * description comes from the host's own declaration and is OMITTED when there
 * is none — never the action name again, because a card reading "Track price /
 * Track price" looks broken.
 *
 * Both helpers are called by FraymeRenderer's handlers Proxy at dispatch, with
 * the intrinsic entry `take()` just popped, and land on
 * `FraymeActionContext.label` / `.description` → `DynamicActionEvent`.
 *
 * NEVER THROWS, NEVER INVALIDATES. Every read is structural and every miss is
 * `undefined`; nothing here can add a validation issue or an error path for
 * spec content. A missing label or description is simply not there.
 *
 * PURE module: no React, no @json-render imports (structural types only), like
 * ./intrinsic.ts and ./dynamic-gate.ts.
 */
import type { ActionDecl } from '@frayme/catalog/validate';
import type { FraymeActionMap } from './handlers.js';
import type { IntrinsicEntry } from './intrinsic.js';

/** A non-blank string, or undefined — the one shape every source below must pass. */
function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * `map[action].description` when `map` is an object holding that OWN key whose
 * entry is an object with a non-blank description. Reads the consumer's
 * `actions` map and the spec's `actions` block alike — both are keyed by action
 * name and both may hold a `false` deny or (the consumer's) a bare function,
 * neither of which describes anything. Own-property only: an action named
 * `constructor` must not resolve a prototype member.
 */
function descriptionIn(map: unknown, action: string): string | undefined {
  if (!map || typeof map !== 'object' || !Object.hasOwn(map, action)) return undefined;
  const decl = (map as Record<string, { description?: unknown } | null | undefined | false>)[action];
  return decl && typeof decl === 'object' ? nonBlank(decl.description) : undefined;
}

/**
 * The action's description, in precedence order:
 *   1. the host's `actionContract` entry for `action` (the same `ActionDecl[]`
 *      it sent to compose) — the host's words, straight from the host;
 *   2. the consumer's `actions` MAP entry (`<FraymeRenderer actions={{ name:
 *      { kind, description } }}>`) — the map is the routing authority when
 *      passed, and its `description` field (handlers.ts) would be dead
 *      if the host's own entry lost to the server-stamped copy below (a host
 *      overriding the stamped text on its map got the stamped text back).
 *      Read as data only — the entry's `kind` / `run` are never
 *      touched here, so the map's authority over routing is unchanged;
 *   3. `spec.actions[action].description` — the platform binder stamps the same
 *      declaration onto the spec, so a renderer with no
 *      contract prop and no map still has it; read as COPY, never as a handler,
 *      exactly as FraymeRenderer.normalizeSpecProps reads it for the confirm
 *      message;
 *   4. undefined — the card omits the line.
 * The returned string is TRIMMED: a description is host prose, and the trailing
 * newline a YAML block leaves behind would otherwise render as a blank line
 * under the title.
 */
export function resolveActionDescription(
  contract: readonly ActionDecl[] | null | undefined,
  consumerMap: FraymeActionMap | null | undefined,
  spec: unknown,
  action: string,
): string | undefined {
  if (Array.isArray(contract)) {
    for (const decl of contract) {
      if (decl && typeof decl === 'object' && decl.name === action) {
        const d = nonBlank(decl.description);
        if (d) return d.trim();
        break; // the host declared it without a description — fall through to the map / spec
      }
    }
  }
  const fromMap = descriptionIn(consumerMap, action);
  if (fromMap) return fromMap.trim();
  const fromSpec = descriptionIn((spec as { actions?: unknown } | null | undefined)?.actions, action);
  if (fromSpec) return fromSpec.trim();
  return undefined;
}

/** Structural view of one spec element — only what the label lookup reads. */
type ElementLike = {
  type?: unknown;
  props?: { rowActions?: unknown; bulkActions?: unknown } | null;
  rowActions?: unknown;
  children?: unknown;
} | null | undefined;

/** The label of the entry in `list` whose `id` is `actionId`, when it has one. */
function labelIn(list: unknown, actionId: string): string | undefined {
  if (!Array.isArray(list)) return undefined;
  for (const entry of list) {
    const e = entry as { id?: unknown; label?: unknown } | null;
    if (e && typeof e === 'object' && e.id === actionId) return nonBlank(e.label);
  }
  return undefined;
}

/**
 * The per-item action list an element DRAWS, in the two placements the renderer
 * honours (registry/_rowaction.ts `readRowActions`: `props.rowActions`, else the
 * element-level `rowActions` placement generated specs also use). Read
 * structurally here rather than imported, so this module stays free of the
 * registry the way dynamic-gate.ts `declaresItemActions` is.
 *
 * KNOWN LIMIT: this reads the RAW spec (`specRef.current`),
 * while the renderer draws the json-render-RESOLVED props — a `rowActions`
 * authored as a `{ $state: '/actions' }` binding is an object here, not an
 * array, and yields no label (undefined, never a throw). No known spec binds
 * its action list to state; if one appears, the fix is to stash the
 * pressed entry's `label` in the payload at the emit site (the renderer holds
 * the resolved `RowActionDef`), which DataTable's built-in delete already does.
 */
function rowActionsOf(el: ElementLike): unknown {
  const fromProps = el?.props?.rowActions;
  return Array.isArray(fromProps) ? fromProps : el?.rowActions;
}

/**
 * The label of the control the user pressed, when the FIRE makes it knowable.
 * In order:
 *   1. the intrinsic payload's own `label`, when it is a non-blank string — a
 *      Button / IconButton / Fab / Confirmation / Link press stashes
 *      `{ label: p.label }` (registry/actions.tsx, misc-extended.tsx,
 *      data-longtail.tsx, ai-flow.tsx); DataTable's built-in row / bulk delete
 *      stashes the label it drew. Returned VERBATIM, whitespace and all.
 *      TAKEN ON EVERY VERB, deliberately: the intrinsic
 *      contract (intrinsic.ts) defines `select.label` / `change.label` /
 *      `dismiss.label` as the ITEM chosen — a menu entry, a tab, a spreadsheet
 *      cell's display value, a toast's title on its own timer. None of those
 *      hosts is a carrier by default, so this only reaches a card under a
 *      `live: true` binding or a widened `dynamicActionTypes`, and there the
 *      host asked for the pick itself to be the event: "Left knee" heads the
 *      card for a BodyMap pick because the pick IS what was done. Restricting
 *      this to press-shaped verbs is a one-line change if the card should
 *      always be headed by the control's name instead.
 *   2. a row / bulk action press (`affordance` asserted by the renderer, never
 *      read from the spec): the payload names the action by `action: <id>`, and
 *      the label is on the host element's matching `rowActions[]` /
 *      `bulkActions[]` entry — DataTable (registry/data-table.tsx), KanbanBoard
 *      and a KanbanCard with its own list (board-nav.tsx). A slot-authored
 *      KanbanCard with NO list of its own draws the nearest ancestor
 *      KanbanBoard's `rowActions` (board-nav.tsx CardActionsContext — "a card's
 *      own rowActions wins outright"), so the lookup follows the same rule: own
 *      list first, then the board above it. That walk is the renderer's exact
 *      inheritance, not a heuristic.
 *   3. a Form's submit: its payload is `{ fields }` alone (forms-extended.tsx
 *      `useFormCommit` — the commit does not know which Button pressed it), so
 *      the label is unknown. Deliberately NOT recovered by scanning the Form's
 *      children for a submit Button: the card wants the label the fire names,
 *      not a guess.
 *   4. otherwise undefined — a programmatic dispatch, a `watch`, a bare emit.
 */
export function resolveControlLabel(
  spec: unknown,
  intrinsic: IntrinsicEntry | null | undefined,
): string | undefined {
  if (!intrinsic) return undefined;
  const fromPayload = nonBlank(intrinsic.payload?.label);
  if (fromPayload !== undefined) return fromPayload;
  const affordance = intrinsic.affordance;
  if (affordance !== 'row-action' && affordance !== 'bulk-action') return undefined;
  const actionId = intrinsic.payload?.action;
  const fid = intrinsic.fid;
  if (typeof actionId !== 'string' || typeof fid !== 'string' || !fid) return undefined;
  const elements = (spec as { elements?: unknown } | null | undefined)?.elements;
  if (!elements || typeof elements !== 'object') return undefined;
  const els = elements as Record<string, ElementLike>;
  // Own-property only: an id like 'constructor' must not resolve a prototype member.
  const host = Object.hasOwn(els, fid) ? els[fid] : undefined;
  if (!host || typeof host !== 'object') return undefined;
  if (affordance === 'bulk-action') return labelIn(host.props?.bulkActions, actionId);
  const own = labelIn(rowActionsOf(host), actionId);
  if (own !== undefined) return own;
  // A card drawing the board's list: walk the spec's parent edges up to the
  // nearest KanbanBoard. Bounded by the element count — a cyclic `children`
  // graph cannot loop it (the renderer already cut cycles, and `seen` guards
  // this read against a raw spec regardless).
  if (host.type !== 'KanbanCard' || Array.isArray(rowActionsOf(host))) return undefined;
  const parentOf = new Map<string, string>();
  for (const [id, el] of Object.entries(els)) {
    const kids = el && typeof el === 'object' ? el.children : undefined;
    if (!Array.isArray(kids)) continue;
    for (const kid of kids) if (typeof kid === 'string' && !parentOf.has(kid)) parentOf.set(kid, id);
  }
  const seen = new Set<string>([fid]);
  let cursor = parentOf.get(fid);
  while (cursor !== undefined && !seen.has(cursor)) {
    seen.add(cursor);
    const el = Object.hasOwn(els, cursor) ? els[cursor] : undefined;
    if (el && typeof el === 'object' && el.type === 'KanbanBoard') return labelIn(rowActionsOf(el), actionId);
    cursor = parentOf.get(cursor);
  }
  return undefined;
}
