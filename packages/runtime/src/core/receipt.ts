/**
 * THE RECEIPT — the pure model behind the card a host shows in the chat thread
 * when a control fires a declared action.
 *
 * The card shows the control's NAME, the action's
 * DESCRIPTION, and a human-readable TABLE of the params, themed exactly like the
 * renderer's default. The UI state is NOT shown on the card (it is in the
 * payload the agent reads — name + params + state — with no canned instruction),
 * so `state` is carried here only on request, and untouched.
 *
 *     Track price                          ← event.label, verbatim; else humanizeName(action)
 *     Watches a listing and alerts you…   ← event.description, or no line at all
 *     Model ID        vantor-dualzone-55   ← humanizeKey(key) | formatValue(value)
 *     Current price   149
 *     Duration days   14
 *
 * STRUCTURE, NOT ENGLISH — the same constraint as core/thread-text.ts, which
 * this reuses rather than restates: keys are humanized, values are formatted and
 * never rewritten, and the title is the caller's string exactly as supplied.
 * German capitalises nouns mid-sentence and Japanese has no case at all; any
 * rule clever enough to "fix" a title corrupts the ones it does not understand.
 *
 * PURE: no React, no @json-render, no I/O. Safe on a server, in an MCP handler,
 * or in the renderer at dispatch. react/action-receipt.tsx is the DOM.
 */
import type { DynamicActionEvent } from './events.js';
import { formatValue, humanizeKey, humanizeName, isBlank } from './thread-text.js';

/** One row of the params table. */
export interface ReceiptRow {
  /** The raw param key — for React keys and for a host that wants the original. */
  key: string;
  /** `humanizeKey(key)` — `currentPriceGbp` → "Current price GBP". */
  label: string;
  /** `formatValue(value)` — numbers separated, booleans Yes/No, objects and arrays
   *  summarised (`200 items`; `Ref: TXN-1, Customer: …`), strings verbatim. */
  value: string;
}

export interface ReceiptModel {
  /**
   * The control's label verbatim, else the humanized action name. Empty ONLY
   * for a malformed event with no `action` (`humanizeName('')` is `''`) — the
   * card then renders an empty heading and no accessible name, never a throw
   * and never an invented word.
   */
  title: string;
  /** The host's description of the action. Absent when none was given — never the action name. */
  description?: string;
  /** The params, minus blanks, minus `label` when it is the title, minus `omitKeys`. */
  rows: ReceiptRow[];
  /** `event.state`, untouched, ONLY when `includeState` was asked for. */
  state?: Record<string, unknown>;
}

export interface ReceiptModelOptions {
  /** Param keys to leave off the table (e.g. a `rows` snapshot the host already has). */
  omitKeys?: readonly string[];
  /** Carry `event.state` on the model. Default false — the card does not show state. */
  includeState?: boolean;
}

/** The slice of the event the model reads — a host may pass a full DynamicActionEvent. */
export type ReceiptEvent = Pick<DynamicActionEvent, 'action' | 'params' | 'label' | 'description' | 'state'>;

/** `event.label` when it is a non-blank string — the title's source; else undefined. */
export function titleLabel(event: Pick<ReceiptEvent, 'label'>): string | undefined {
  return typeof event.label === 'string' && event.label.trim() !== '' ? event.label : undefined;
}

/**
 * `event.params` minus a `label` entry that IS the control's label — strictly
 * equal to `titleLabel(event)`. A Button's payload carries `{ label }`
 * (registry/actions.tsx) and mergeIntrinsicParams folds it into the params, so
 * without this every thread surface printed the pressed control's name twice:
 * "Approve refund / Label: Approve / Order ID: 4821" (the forwarder's default
 * text had exactly that bullet, against the "no button label" shape). An
 * authored `label` param that DIFFERS from the control's
 * label is real data and stays. One rule, shared by the card (`receiptModel`)
 * and the AI SDK forwarder's default text (ai-sdk/index.tsx) so the two cannot
 * disagree. Never mutates; returns a fresh object only when something is dropped.
 */
export function paramsWithoutTitleLabel(event: Pick<ReceiptEvent, 'params' | 'label'>): Record<string, unknown> {
  const params = event.params ?? {};
  const label = titleLabel(event);
  if (label === undefined || !Object.hasOwn(params, 'label') || params.label !== label) return params;
  const { label: _dropped, ...rest } = params;
  return rest;
}

/**
 * Build the card's content from a dispatched event.
 *
 *  · title       — `event.label` when it is a non-blank string, VERBATIM (no
 *                  trim, no case change); else `humanizeName(event.action)`.
 *  · description — `event.description` when non-blank; else omitted.
 *  · rows        — `Object.entries(event.params)` in order, dropping: a `label`
 *                  entry equal to the title (it IS the title — a Button's payload
 *                  carries `{ label }` and the card must not print "Label: Approve"
 *                  under "Approve"; an authored `label` param that differs is real
 *                  data and stays); blanks (`isBlank` — `false` and `0` are values
 *                  and stay); and `opts.omitKeys`.
 *  · state       — `event.state` as-is, only with `opts.includeState`.
 */
export function receiptModel(event: ReceiptEvent, opts: ReceiptModelOptions = {}): ReceiptModel {
  const label = titleLabel(event);
  const title = label ?? humanizeName(event.action);
  const description =
    typeof event.description === 'string' && event.description.trim() !== '' ? event.description : undefined;
  const omit = new Set(opts.omitKeys ?? []);
  const rows: ReceiptRow[] = [];
  // paramsWithoutTitleLabel drops the `label` entry that became the title.
  for (const [key, value] of Object.entries(paramsWithoutTitleLabel(event))) {
    if (omit.has(key)) continue;
    if (isBlank(value)) continue;
    rows.push({ key, label: humanizeKey(key), value: formatValue(value) });
  }
  const model: ReceiptModel = { title, rows };
  if (description !== undefined) model.description = description;
  if (opts.includeState && event.state !== undefined) model.state = event.state;
  return model;
}
