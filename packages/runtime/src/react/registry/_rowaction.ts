/**
 * The shared per-ITEM action contract: the vocabulary a spec writes, and the
 * confirm gate that stands in front of it.
 *
 * DataTable defined all of this privately, and it is the right shape — an action
 * is a `{ id, label?, icon?, variant?, confirm?, disabled? }` record, a custom id
 * emits `commit { action: id, … }`, and confirmation lives ON THE ACTION rather
 * than on the binding. When KanbanBoard/KanbanCard gained per-card actions they
 * needed exactly that contract, so it moved here instead of being written twice:
 * two copies of a confirm gate is two places for "are you sure?" to drift, and
 * every spec has to follow ONE idiom for per-item actions across every surface
 * that has them.
 *
 * Nothing here is table- or board-specific. The rendering differs per surface (a
 * row cell is not a card footer) and stays with each component; what is shared is
 * the DATA SHAPE and the DECISION TO GUARD.
 */

/** Per-action confirmation config (same shape as a spec binding's `confirm`). */
export type ConfirmCfg = { title?: string | null; message?: string | null; confirmLabel?: string | null; cancelLabel?: string | null; variant?: string | null };
export type RowActionVariant = 'ghost' | 'outline' | 'primary' | 'secondary' | 'danger';
export interface RowActionDef {
  id: string;
  label?: string | null;
  icon?: string | null;
  variant?: RowActionVariant | null;
  confirm?: ConfirmCfg | null;
  /** Greyed and inert. Bind it to state so an action that has already fired
   *  cannot fire twice — the latch the interactivity contract asks for. */
  disabled?: boolean | null;
}

/** A `confirm` written as a bare STRING is the message. The catalog documents the
 *  object form, but a spec may well write
 *    "confirm": "Send the supplier one request covering the ticked claims?"
 *  and a string has no `.title`/`.message` — both read undefined, so the modal
 *  opened with the button label as its title and an EMPTY body. The authored
 *  question, the one sentence that told the user what they were agreeing to, was
 *  silently discarded, and it LOOKED like it worked. Coerce rather than reject:
 *  the intent is unambiguous and nothing else can sensibly be meant by a string.
 *  `confirm: true` is the same gesture with no words — carry it as an empty
 *  config so the label-derived title still shows.
 */
export function asConfirmCfg(c: unknown): ConfirmCfg | null {
  if (!c) return null;
  if (typeof c === 'string') return c.trim() ? { message: c } : {};
  if (c === true) return {};
  return typeof c === 'object' ? (c as ConfirmCfg) : {};
}

/** CONFIRM IS THE DEFAULT ON PER-ITEM ACTIONS, not an opt-in.
 *  Row and bulk actions are overwhelmingly consequential — the labels are things
 *  like "withdraw", "escalate", "mark closed-won", "chase" — and `confirmDelete`,
 *  the earlier opt-in, was practically never set, so the guard existed and
 *  protected nobody.
 *  Putting it HERE rather than in every spec matters twice over: each spec would
 *  otherwise have to author it (and would sometimes forget), and a bulk action
 *  inherently acts on N selected rows, where "are you sure" is not decoration.
 *  NOT a label heuristic. Labels are multilingual — 選考枠を押さえる, auf die
 *  warteliste setzen — so any English destructive-verb test would silently pass
 *  every non-English action straight through. Default on, explicit opt-out.
 *  OPT OUT with `confirm: false` on the individual action (for a genuinely benign
 *  "View"/"Export"). `undefined` now means CONFIRM. */
export function wantsConfirm(c: unknown): boolean { return c !== false; }

export function deriveConfirm(
  label: string | null | undefined,
  variant: RowActionVariant | null | undefined,
  confirmRaw: unknown,
  icon?: string | null,
): ConfirmCfg & { confirmIcon?: string } {
  const confirm = asConfirmCfg(confirmRaw) ?? {};
  return {
    title: confirm.title ?? (label ? `${label}?` : 'Confirm'),
    message: confirm.message ?? '',
    confirmLabel: confirm.confirmLabel ?? label ?? 'Confirm',
    cancelLabel: confirm.cancelLabel ?? 'Cancel',
    variant: confirm.variant ?? (variant === 'danger' ? 'danger' : undefined),
    confirmIcon: typeof icon === 'string' ? icon : undefined,
  };
}

/** The spec's per-item action list, defensively read.
 *
 *  TWO PLACEMENTS, ONE MEANING. The catalog declares `rowActions` inside `props`,
 *  and that is the documented shape — but a board was found writing it as a
 *  SIBLING of `props` on the element, and the board drew nothing at all. Same
 *  call as `asConfirmCfg` above: an element-level `rowActions` has no other
 *  possible meaning, so read it rather than discard the author's intent.
 *  `props` wins when both are present. */
export function readRowActions(element: { props?: unknown; rowActions?: unknown } | null | undefined): RowActionDef[] {
  const fromProps = (element?.props as { rowActions?: unknown } | undefined)?.rowActions;
  const raw = Array.isArray(fromProps) ? fromProps : Array.isArray(element?.rowActions) ? element.rowActions : null;
  if (raw == null) return [];
  return raw.filter((a): a is RowActionDef => a != null && typeof a === 'object' && typeof (a as RowActionDef).id === 'string');
}
