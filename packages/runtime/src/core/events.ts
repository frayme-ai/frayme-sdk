/**
 * The dynamic-action seam.
 *
 * Static interactions (state writes via `$bindState`, visibility via `$cond`,
 * tab switches, form typing…) are resolved entirely in the browser by the
 * json-render runtime and NEVER reach this seam — that's ~90% of clicks, at
 * zero latency and zero cost.
 *
 * The remaining ~10% — spec-bound named actions (`element.on.press → {action}`)
 * — are forwarded here, and the transport adapters (`/ai-sdk`, `/ag-ui`) route
 * them to the consumer's agent.
 */
export interface DynamicActionEvent {
  /** The action name the spec bound, e.g. "submit_form" or "frayme:regenerate". */
  action: string;
  /** Resolved action params (often includes form state via `$state` expressions). */
  params: Record<string, unknown>;
  /**
   * The canonical event verb that fired (`commit`/`select`/`change`/`dismiss`/
   * `search`/`sort`/`page`/`move`), when the action is bound to exactly one event
   * — lets the host route on the interaction KIND without re-deriving it. Omitted
   * when the action is bound to more than one event (ambiguous).
   */
  event?: string;
  /**
   * A live snapshot of the renderer's state at fire time — the resolved
   * `$bindState` values the user entered. The host reads what the user did
   * without re-deriving it from `params`.
   */
  state?: Record<string, unknown>;
  /**
   * The spec id of the element that fired — the Button, or the DataTable whose
   * row/bulk action was pressed. Read from the renderer's intrinsic slot, so it is
   * set for every renderer-driven fire and absent for a programmatic dispatch.
   */
  element_id?: string;
  /**
   * The compose generation this UI was built from (server-stamped
   * `spec.generation_id`) — correlates the action back to its request. Undefined
   * when the spec carries no generation id.
   */
  generation_id?: string;
  /**
   * The label of the control the user pressed, VERBATIM — never re-cased,
   * never translated (core/thread-text.ts says why: labels are often not
   * English). The host shows a card in the chat
   * thread for every declared action, headed by this label. Known only when the
   * fire says so — a Button / IconButton / Fab / Confirmation / Link payload
   * carries its `label`; a row or bulk action press resolves to the matching
   * `rowActions[]` / `bulkActions[]` entry's label on the host that drew it; a
   * Form's submit carries no label (its payload is `{ fields }`), and a
   * programmatic dispatch has no control at all. A `live: true` pick (a Select,
   * a menu, a BodyMap region) carries the label of the ITEM chosen — the pick is
   * the event there. Absent → the card falls back to `humanizeName(action)`.
   * See core/action-enrich.ts.
   */
  label?: string;
  /**
   * What the action DOES, in the host's words: the `description` of the host's
   * `ActionDecl` for this action (`<FraymeRenderer actionContract>`), else the
   * consumer's `actions` map entry (when it routes through one), else the
   * server-stamped `spec.actions[name].description`. Absent when none gave
   * one — the card then omits the line rather than echoing the action name
   * ("Track price / Track price" reads as broken). Same source the automatic
   * confirm's message already reads (FraymeRenderer.normalizeSpecProps).
   */
  description?: string;
}

export type OnDynamicAction = (event: DynamicActionEvent) => unknown | Promise<unknown>;
