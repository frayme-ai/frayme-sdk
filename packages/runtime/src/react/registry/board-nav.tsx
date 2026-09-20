'use client';
import { useState, useRef, useEffect, useContext, useMemo, createContext, Children, isValidElement, cloneElement, type ReactNode, type ReactElement, type CSSProperties } from 'react';
import { cva } from 'class-variance-authority';
import { safeColor } from '@frayme/catalog/validate';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars, weightClass, surfaceField, surfaceInk, surfaceMuted, surfaceRaised, surfaceSunken } from './_style.js';
import { Icon, hasIcon } from './icons.js';
import { safeUrl, linkTargetRel } from './url-safety.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { useAriaId } from './_aria.js';
import { useScrollEdges } from '../use-scroll-edges.js';
import { FraymeConfirmModal } from '../confirm-modal.js';
import { type ConfirmCfg, type RowActionDef, type RowActionVariant, deriveConfirm, readRowActions, wantsConfirm } from './_rowaction.js';

/* Catalog group (board-nav): KanbanBoard, BoardColumn, KanbanCard,
 * NavigationMenu.
 *
 * Same truly-dynamic contract as the shipped catalog:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (a model-named color) NEVER become classes — they land in
 *     `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities WITH a token fallback.
 *
 * INTERACTIVITY (the unbound-reactivity rule): BoardColumn's collapse and
 * NavigationMenu's open-flyout are driven by internal `useState`, so they work
 * WITHOUT any spec binding — `emit(...)` is an ADDITIONAL host signal, never the
 * only effect. The board is a DISPLAY board: a card's move buttons + the body
 * click are genuinely host-routed (emit `move` / `change`) by design — there is NO
 * native drag (not spec-expressible).
 *
 * SECURITY: nav links flow through `safeUrl` + `linkTargetRel`. Icons resolve
 * against the closed registry (guarded by `hasIcon`; unknown/null → nothing).
 * Titles/labels/descriptions render as plain escaped React children — never
 * markup.
 */

/* ── Shared helpers ───────────────────────────────────────────────────────── */

// The `gap` enum sets a DEFAULT gap var (not a `gap-*` utility) so the exact
// `gapValue` channel can override it through one declaration — an arbitrary gap
// class and `gap-*` would NOT dedupe in tailwind-merge. Values reproduce the
// prior utilities exactly (none gap-0=0, sm gap-2=0.5rem, md gap-4=1rem,
// lg gap-6=1.5rem, xl gap-8=2rem).
/** How many columns the rail will squeeze to fit before it gives up and scrolls.
 *  Five is where real boards tend to sit (three to five columns), and below a
 *  fifth of a card width a kanban card stops carrying its title, assignee and
 *  meta legibly — past that, scrolling is the honest answer. */
const MAX_FIT_COLS = 5;

const GAP_CLASS: Record<string, string> = {
  none: '[--fr-board-gap-default:0px]',
  sm: '[--fr-board-gap-default:0.5rem]',
  md: '[--fr-board-gap-default:1rem]',
  lg: '[--fr-board-gap-default:1.5rem]',
  xl: '[--fr-board-gap-default:2rem]',
};

/* A board label is the same shape as Badge's tinted tone, and it carried the same
 * contrast bug Badge already fixed. A tone token is chosen to clear 4.5:1 on the
 * PLAIN surface (all four read 4.83-5.17 on white), but putting its own wash
 * behind it darkens that surface and costs ~0.9 — so the label failed on the very
 * fill meant to identify it. Measured on the light palette over the card surface,
 * `bg-<tone>/15 text-<tone>` read success 4.09 · warning 4.08 · critical 3.82 ·
 * info 4.19, and `bg-muted text-muted-foreground` read 4.40, against the 4.5 floor
 * that applies here (0.6875rem is small text — the 3:1 large-text allowance needs
 * >=18.66px bold or >=24px). Dark mode passed at 4.90-6.01, which is how this
 * survived review: the failure is light-mode-only.
 *
 * These strings are byte-identical to data-display.tsx's TONE_TINT so the two chip
 * families cannot drift — a 12% wash, and an ink that mixes 20% of
 * --color-foreground into the token. That mix self-corrects per
 * theme (near-black in light deepens the hue, near-white in dark lifts it) and
 * measures 5.21-5.71 light / 6.22-7.46 dark on BOTH surfaces a label sits on: the
 * card, and the bg-muted/40 column track.
 *
 * REJECTED — the solid `bg-<tone> text-<tone>-foreground` pairing. It clears AA in
 * light (4.83-5.17), but when this was measured frayme.css re-pointed only
 * --color-danger-foreground for dark; success/warning/info-foreground kept the
 * @theme #ffffff, so a dark solid chip painted white on #22c55e at 2.2:1. That
 * token gap belonged to the stylesheet and is now closed there (all four
 * foregrounds follow their --frayme-*-fg). The reason that still stands: a card
 * repeats these labels on every row, where a saturated slab reads as an alarm
 * rather than a tag.
 *
 * `neutral` is DELIBERATELY untouched. It measured 4.40:1 alongside the others,
 * but the cause was the --color-muted-foreground / --color-muted token pair, not
 * this chip — and that pair was corrected in the stylesheet (#71717a → #52525b,
 * now 7.03:1 light / 5.88 dark / 5.82-6.92 across the theme presets). Restating
 * the fix here as `text-[color:var(--fr-surface-fg,var(--color-foreground))]` would only make the board's neutral tag the
 * one dark-inked chip in the SDK, for no measured gain. */
const TONE_CHIP: Record<string, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success:
    'bg-[color-mix(in_srgb,var(--frayme-success)_12%,transparent)] text-[color:color-mix(in_srgb,var(--frayme-success)_80%,var(--color-foreground))]',
  warning:
    'bg-[color-mix(in_srgb,var(--frayme-warning)_12%,transparent)] text-[color:color-mix(in_srgb,var(--frayme-warning)_80%,var(--color-foreground))]',
  critical:
    'bg-[color-mix(in_srgb,var(--frayme-danger)_12%,transparent)] text-[color:color-mix(in_srgb,var(--frayme-danger)_80%,var(--color-foreground))]',
  info: 'bg-[color-mix(in_srgb,var(--frayme-info)_12%,transparent)] text-[color:color-mix(in_srgb,var(--frayme-info)_80%,var(--color-foreground))]',
};

/** A per-chip `color` override (validated, defence-in-depth): the author's colour
 *  becomes the chip's WASH, and the label ink comes from the foreground token.
 *
 *  Using the raw colour as ink on its own tint — what this did — is unbounded for
 *  an author-named value in a way the closed tone set never was. Measured over the
 *  card surface in light mode: `#fbbf24` read 1.54:1 and `#84cc16` 1.78:1. The
 *  80/20 foreground mix that rescues the TONE tokens above does NOT rescue an
 *  arbitrary hue either (#fbbf24 → 2.32:1): a pale yellow cannot be ink on a pale
 *  yellow wash at any blend that still reads as yellow. Nor can the choice be made
 *  per-hue — `color-contrast()` is not shipped anywhere we render, and a JS branch
 *  cannot see the colour scheme (light/dark is a media query resolved after this
 *  runs), so it could not know whether to darken or lighten.
 *
 *  So the hue lives in the fill, where its only contrast job is to be a
 *  distinguishable tint, and the ink is the surface's own foreground: worst case
 *  11.32:1 measured across 15 hues including pure #000 and #fff, in both themes,
 *  on both the card and the column track. Absent/invalid → tone. */
function chipColorStyle(color: unknown): CSSProperties | undefined {
  if (color == null) return undefined;
  const safe = safeColor(color);
  if (safe === null) return undefined;
  return {
    // 12% matches the tone wash above so an author-coloured label and a tone label
    // sitting side by side on one card carry the same visual weight.
    backgroundColor: `color-mix(in srgb, ${safe} 12%, transparent)`,
    color: 'var(--color-foreground)',
  };
}

/** The assignee-avatar chip's FILL, derived so it is never the one surface the
 *  card's own ink was not chosen for.
 *
 *  The chip's INK is --fr-kanbancard-fg, the channel the catalog documents as
 *  painting "the title and the assignee-avatar initials" (pinned by
 *  test/forms-board-channels.test.tsx). Its fill, though, defaulted to the flat
 *  --color-muted token, and ONLY a
 *  KanbanCard's own `mutedColor` ever replaced it — KanbanBoard's `columns` data
 *  path threads bg/bd/fg and nothing else, and BoardColumn the same. So doing
 *  exactly what the catalog asks — "Pair with `cardBg` so a dark card fill keeps a
 *  readable title" — put the on-dark-card ink onto a near-white chip. On a typical
 *  authored shape (cardBg #181d24, cardColor #e8e4dc, mutedColor #93a0ad):
 *  initials #e8e4dc on #f4f4f5, 1.15:1 — invisible. The same
 *  1.15 appears in slot mode whenever the column supplies cardBg/cardColor and the
 *  card names no mutedColor.
 *
 *  So when a card colour is named the chip becomes a 15% wash of THAT colour over
 *  the card fill — the shape `mutedColor` already produced, and the same reasoning
 *  as chipColorStyle above: the hue goes in the fill, the ink stays the surface's
 *  own. Wash and ink then derive from one colour over one fill, so the pair cannot
 *  drift — measured 8.80:1 on the dark card above, and on a default white card a
 *  dark cardColor gives a light chip with dark initials.
 *
 *  `mutedColor` still wins when set (the more specific channel). With NEITHER set
 *  nothing is emitted and the chip stays exactly --color-muted: byte-identical. */
/* `bg` is a THIRD source, and it was missing. The tint fell back to mutedColor then
   cardColor, so a board with an authored `bg` and neither of those tinted its avatars
   from the theme instead of from the surface the author actually painted. */
function avatarTintVar(mutedColor: unknown, cardColor: unknown, bg?: unknown): CSSProperties {
  const src = safeColor(mutedColor) ?? safeColor(cardColor) ?? safeColor(bg);
  return src == null
    ? {}
    : ({ '--fr-kanbancard-avatar': `color-mix(in srgb, ${src} 15%, transparent)` } as CSSProperties);
}

/** Initials (max 2) for the assignee avatar — from a NAME or from initials the
 *  author already wrote.
 *
 *  This took the first letter of each whitespace-separated word, which is right
 *  for "Priya Gupta" and wrong for the far commoner case: a spec that supplies
 *  the initials directly. "AK" is ONE word, so it rendered "A". On one test
 *  board, four drivers — AK, JM, SF, TB — all rendered as single letters,
 *  making two of them indistinguishable from each other on the board.
 *
 *  A single token is therefore used WHOLE, capped at the same two characters the
 *  multi-word path caps at. Multi-word behaviour is unchanged. */
function initialsOf(name: unknown): string {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  // One token = the author's own initials (or a mononym). Take it as written.
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

/* ── (c) labels ───────────────────────────────────────────────────────────── */

type LabelT = { text?: string | null; tone?: string | null; color?: string | null };

/** The card's label chips, defensively read.
 *
 *  The catalog declares a label as { text, tone?, color? } and that is the
 *  documented shape — but the object filter here DISCARDED anything else, and a
 *  board was found writing `labels: ["Queued"]` on all eleven of its cards.
 *  Every chip vanished, silently, on a board whose columns were the only other
 *  place that status appeared.
 *
 *  Same call as `asConfirmCfg` in _rowaction.ts: a bare string in a label slot has
 *  exactly one possible meaning, so coerce it rather than drop the author's text.
 *  The SCHEMA deliberately stays object-only — the canonical form is what specs
 *  should converge on, and the validator is where a loose one gets corrected;
 *  this is the renderer refusing to lose data in the meantime. */
function normaliseLabels(raw: unknown): LabelT[] {
  if (!Array.isArray(raw)) return [];
  const out: LabelT[] = [];
  for (const l of raw) {
    if (l == null) continue;
    if (typeof l === 'string' || typeof l === 'number') {
      const text = String(l).trim();
      if (text) out.push({ text });
      continue;
    }
    if (typeof l === 'object') out.push(l as LabelT);
  }
  return out;
}

/* ── (a) per-card actions ─────────────────────────────────────────────────── */

/** A card action's classes. Same VOCABULARY as a DataTable row action (the shared
 *  RowActionDef), different surface: a card footer is not a table cell, so the
 *  chip is smaller and reads the CARD's own colour chain rather than the table's
 *  — a board with an authored dark `cardBg` would otherwise get token-coloured
 *  buttons on it.
 *
 *  `ghost` folds to OUTLINE, for the reason data-table.tsx spells out at
 *  rowActionBtnCls: a control that paints nothing at all reads as plain text and
 *  loses the affordance, and authored ghosts skew destructive. The DEFAULT is
 *  outline for the same reason — quiet, but still visibly a button. */
function cardActionCls(variant: RowActionVariant | null | undefined, iconOnly: boolean): string {
  // min-h-6 = the WCAG 2.5.8 24px target floor, as a floor and not a size — the
  // chip must still grow when its label wraps.
  const base = `inline-flex min-h-6 cursor-pointer items-center justify-center gap-1.5 rounded-frayme text-[0.75rem] font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40 ${iconOnly ? 'p-1' : 'px-2 py-1'}`;
  switch (variant) {
    case 'primary':
      return `${base} border border-transparent bg-[color:var(--fr-btn-fill,var(--color-foreground))] text-[color:var(--fr-btn-ink,var(--color-card))] hover:opacity-90`;
    case 'danger':
      // "still red but not in the eyes" — hairline border + red ink, no resting
      // fill, because this is drawn once per CARD and a column of pink slabs
      // reads as an alarm.
      return `${base} border border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-danger hover:[background:color-mix(in_srgb,var(--color-danger)_10%,transparent)]`;
    case 'secondary':
      return `${base} border border-transparent bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-foreground hover:opacity-90`;
    default: // outline — and ghost, folded into it
      return `${base} border border-[color:var(--fr-kanbancard-bd,var(--color-border))] text-[color:var(--fr-kanbancard-fg,var(--color-foreground))] hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]`;
  }
}

/** Clamp a model count into lo..hi (props-less safe). */
function clampCount(v: unknown, dflt: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(Math.max(Math.round(n), lo), hi);
}

type CardT = {
  /** Stable record id, echoed verbatim in the change/move/commit params so a
   *  handler resolves WHICH card was acted on without re-indexing by title. */
  id?: string | null;
  title?: string | null;
  description?: string | null;
  /** Read through `normaliseLabels` — the canonical form is {text,tone?,color?},
   *  but a bare string is coerced rather than dropped. */
  labels?: unknown;
  assignee?: string | null;
  meta?: string | null;
  /** Permission fidelity: a locked card never shows move arrows even on a movable board. */
  locked?: boolean | null;
};

/* ── Card body (shared by KanbanBoard's inline cards + the KanbanCard renderer) ── */

/** The presentational body of a single card. `moveable` shows host-routed
 *  left/right move buttons (the only spec-expressible "move" — no native drag);
 *  a body click is host-routed via `onOpen`. */
function CardBody({
  card,
  moveable,
  titleWeight,
  onMove,
  onOpen,
  onAction,
  actions = [],
  footer,
  canLeft = true,
  canRight = true,
}: {
  card: CardT;
  moveable: boolean;
  // The KanbanCard `weight` channel — wins over the baked `font-medium` when set.
  // Absent (KanbanBoard's inline cards) → weightClass(undefined) → byte-identical.
  titleWeight?: string | null;
  onMove: (dir: 'left' | 'right') => void;
  onOpen: () => void;
  /** A per-card action was pressed. The OWNER (board or card) holds the confirm
   *  gate and does the emitting — this body only reports the press, so there is
   *  one dispatch path and one modal per owner rather than one per card. */
  onAction?: (a: RowActionDef) => void;
  actions?: RowActionDef[];
  /** Spec children appended inside the card, under the actions. */
  footer?: ReactNode;
  canLeft?: boolean;
  canRight?: boolean;
}): ReactNode {
  const labels = normaliseLabels(card.labels);
  const assignee = typeof card.assignee === 'string' && card.assignee.length > 0 ? card.assignee : null;
  const meta = typeof card.meta === 'string' && card.meta.length > 0 ? card.meta : null;
  return (
    <div
      // Class candidates must be STATIC literals (Tailwind's scanner can't see
      // interpolated `var(${…})` strings — an interpolated class never compiles).
      // The accent left rule is the side-specific `border-l-*` group; its fallback
      // chains through the card's own border var so accent-unset keeps borderColor.
      className="flex flex-col gap-2 rounded-frayme border border-l-2 p-3 [background:var(--fr-kanbancard-bg,var(--color-card))] [border-color:var(--fr-kanbancard-bd,var(--color-border))] border-l-[color:var(--fr-kanbancard-accent,var(--fr-kanbancard-bd,var(--color-border)))]"
    >
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.map((l, i) => {
            const tone = (l.tone as string | null) ?? 'neutral';
            const cls = TONE_CHIP[tone] ?? TONE_CHIP.neutral;
            // A per-chip `color` override (validated) replaces the tone classes
            // with an inline soft tint; absent/invalid → fall back to the tone.
            const overrideStyle = chipColorStyle((l as { color?: unknown }).color);
            return (
              // truncate KEPT: a board label is the single-line chip contract — one
              // token ("bug", "P1", "design") inside a pill, and the cap that makes
              // it fire is `max-w-full` (the card's own width, which relaxes), not a
              // fixed rem cap. The strip above is flex-wrap, so chips take extra rows.
              <span
                key={i}
                className={cn('max-w-full truncate rounded-full px-2 py-0.5 text-[0.6875rem] font-medium', overrideStyle == null && cls)}
                style={overrideStyle}
                title={l.text ?? undefined}
              >
                {l.text ?? ''}
              </span>
            );
          })}
        </div>
      )}
      <button
        type="button"
        // On-surface title colour: the --fr-kanbancard-fg chain (card `color` →
        // column/board `cardColor` → foreground token) pairs with the bg chain so
        // a dark card fill keeps a readable title.
        // NO min-w-0 here: this is a LEAF (it renders the title string, nothing
        // else), and min-w-0 lets a leaf shrink below its own min-content — the
        // longest word — which break-words then shatters one character per line.
        className={cn(
          'line-clamp-2 min-h-6 cursor-pointer break-words rounded-sm border-0 bg-transparent py-0.5 text-left text-sm font-medium text-[color:var(--fr-kanbancard-fg,var(--color-foreground))] outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          weightClass(titleWeight),
        )}
        onClick={onOpen}
        title={card.title ?? undefined}
      >
        {card.title ?? ''}
      </button>
      {card.description != null && (
        // Muted chain: card-level var wins over the inherited board-level var,
        // then the token — one static literal serves both CardBody call sites.
        // line-clamp-3 is a DECLARED vertical budget (honest); `break-words` pairs
        // with it so a long unbroken run (a URL, a ticket id) breaks inside those
        // three lines instead of running out past the card edge.
        <p className="m-0 line-clamp-3 break-words text-[0.8125rem] leading-relaxed text-[color:var(--fr-kanbancard-muted,var(--fr-kanbanboard-muted,var(--color-muted-foreground)))]" title={card.description ?? undefined}>{card.description}</p>
      )}
      {(assignee != null || meta != null || moveable) && (
        <div className="mt-0.5 flex items-center gap-2">
          {assignee != null && (
            <span
              // The avatar fill reads the derived --fr-kanbancard-avatar (a 15%
              // tint of the card's mutedColor, set by KanbanCard) with the muted
              // token inside as fallback — unset stays byte-identical to bg-muted.
              //
              // The INK deliberately stays on the card's on-surface chain (the
              // catalog documents `color`/`cardColor` as painting "the title and
              // the assignee-avatar initials", pinned by
              // test/forms-board-channels.test.tsx). What
              // was wrong is the FILL underneath it — see avatarTintVar above for
              // the 1.15:1 that fix removes.
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full [background:var(--fr-kanbancard-avatar,var(--color-muted))] text-[0.625rem] font-semibold text-[color:var(--fr-kanbancard-fg,var(--color-foreground))]"
              title={assignee}
            >
              {initialsOf(assignee)}
            </span>
          )}
          {/* break-words, not truncate: the meta line carries the card's due date /
              count — a value the reader acts on. Its row siblings are fixed-size
              shrink-0 boxes, so it is the only item that gives way; wrapping inside
              its own box just makes the footer a line taller. No min-w-0: a LEAF's
              automatic minimum (its longest word) is the floor that keeps the value
              legible — below it break-words shatters the date one char per line. */}
          {meta != null && <span className="break-words text-[0.75rem] tabular-nums text-[color:var(--fr-kanbancard-muted,var(--fr-kanbanboard-muted,var(--color-muted-foreground)))]" title={meta}>{meta}</span>}
          {moveable && (
            // Both arrows are min-h-6 min-w-6, not h-6 w-6: they render at the same
            // 24px (the icon inside is 16px), but a FIXED box is one that can be
            // squeezed or outgrown — the 24px WCAG 2.5.8 floor has to be a floor,
            // not a size. gap-0.5 is fine between them precisely because each one
            // already meets 24x24, so the spacing exception never has to apply.
            <span className="ml-auto inline-flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label="Move left"
                disabled={!canLeft}
                className="inline-flex min-h-6 min-w-6 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-[color:var(--fr-kanbancard-muted,var(--fr-kanbanboard-muted,var(--color-muted-foreground)))] outline-none hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] hover:text-[color:var(--fr-kanbancard-fg,var(--color-foreground))] focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-30"
                onClick={() => onMove('left')}
              >
                <Icon name="chevron-left" size={16} />
              </button>
              <button
                type="button"
                aria-label="Move right"
                disabled={!canRight}
                className="inline-flex min-h-6 min-w-6 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-[color:var(--fr-kanbancard-muted,var(--fr-kanbanboard-muted,var(--color-muted-foreground)))] outline-none hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] hover:text-[color:var(--fr-kanbancard-fg,var(--color-foreground))] focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-30"
                onClick={() => onMove('right')}
              >
                <Icon name="chevron-right" size={16} />
              </button>
            </span>
          )}
        </div>
      )}
      {actions.length > 0 && (
        /* PER-CARD ACTIONS. The whole point of drawing them HERE is that the
           control sits on the item it acts on: "Reassign driver" on the driver's
           card, carrying that card's id, rather than one global form beside the
           board with a dropdown to re-pick the row the user already pointed at.
           Testing found specs reaching for this on every board and getting
           nothing, so they fell back to the global-form shape every time.

           flex-wrap, and each chip sized by its own label: two or three short
           actions sit on one line and a long label takes the next, rather than
           truncating the verb that says what the button does. A separating rule
           rather than more gap — the footer is a different register from the
           card's content, and on a dense board gap alone reads as a gutter. */
        <div className="flex flex-wrap gap-1.5 border-t pt-2 border-t-[color:var(--fr-kanbancard-bd,var(--color-border))]">
          {actions.map((a) => {
            const label = typeof a.label === 'string' ? a.label : '';
            const icon = typeof a.icon === 'string' && hasIcon(a.icon) ? a.icon : null;
            const iconOnly = label === '' && icon != null;
            return (
              <button
                key={a.id}
                type="button"
                // Names the action for automated tests and for anything routing by
                // attribute rather than by label text — a stable locator cannot be
                // built from label strings alone.
                data-fr-card-action={a.id}
                disabled={a.disabled === true}
                // An icon-only chip still has to say what it does.
                aria-label={iconOnly ? a.id : undefined}
                className={cardActionCls(a.variant, iconOnly)}
                onClick={() => onAction?.(a)}
                title={label || a.id}
              >
                {icon != null && (
                  <span className="shrink-0" aria-hidden>
                    <Icon name={icon} size={14} />
                  </span>
                )}
                {label !== '' && <span className="break-words">{label}</span>}
              </button>
            );
          })}
        </div>
      )}
      {footer}
    </div>
  );
}

/* ── BoardColumn shell (shared by the renderer + KanbanBoard's inline columns) ── */

/** The column shell: a header (title + count badge) over the card stack.
 *  `collapsible` makes the header a toggle backed by internal state — live
 *  without a binding. The body is the caller-supplied `children`. */
function ColumnShell({
  title,
  count,
  collapsible,
  accentVar,
  accentValue,
  mutedVar,
  mutedValue,
  columnBg,
  emptyText,
  cardBg,
  cardBorder,
  cardColor,
  onToggle,
  collapsedValue,
  onCollapsedChange,
  bodyId,
  children,
}: {
  title?: string | null;
  count?: number | null;
  collapsible: boolean;
  accentVar: string;
  accentValue?: string | null;
  mutedVar: string;
  mutedValue?: string | null;
  // The column TRACK surface fill (the shell the cards sit on). Only set by the
  // BoardColumn renderer; KanbanBoard's inline columns leave it null so the shell
  // keeps its exact bg-muted/40 default (byte-identical).
  columnBg?: string | null;
  // Placeholder shown when the column has no cards. Only set by BoardColumn; unset
  // renders the exact prior empty column (a bare header over nothing).
  emptyText?: string | null;
  // Resting card surface to cascade onto this column's KanbanCard children.
  cardBg?: string | null;
  cardBorder?: string | null;
  // On-surface card text (title + avatar initials) to cascade likewise.
  cardColor?: string | null;
  // Receives the NEXT collapsed state so the caller can put it in the payload.
  onToggle?: (collapsed: boolean) => void;
  // OPTIONAL controlled-collapse channel (BoardColumn threads a bindable value
  // here). When `onCollapsedChange` is supplied the caller owns the collapse
  // state (so it can land in spec.state); otherwise the internal useState below
  // drives it — byte-identical for KanbanBoard's inline columns which pass neither.
  collapsedValue?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  // DOM id of the card-stack body, so the collapse toggle's aria-expanded can
  // name WHAT it expands via aria-controls. Supplied by every caller that passes
  // `collapsible` (only BoardColumn does — KanbanBoard's inline columns hardcode
  // collapsible={false}, render no toggle, and so leave the body id off entirely,
  // keeping their markup byte-identical).
  bodyId?: string;
  children?: ReactNode;
}): ReactNode {
  // INTERNAL state — the collapse is live without any spec binding. When the
  // caller controls collapse (BoardColumn's bound path), `collapsedValue` wins.
  const [collapsedLocal, setCollapsedLocal] = useState(false);
  const controlled = onCollapsedChange != null;
  const collapsed = controlled ? collapsedValue === true : collapsedLocal;
  const n = typeof count === 'number' && Number.isFinite(count) ? Math.trunc(count) : null;
  // An empty column = no rendered children. `emptyText` (when set) renders a muted
  // placeholder; unset keeps the exact prior empty body (byte-identical).
  const isEmpty =
    children == null || (Array.isArray(children) && children.filter((c) => c != null && c !== false).length === 0);
  const header = (
    // Class candidates must be STATIC literals (Tailwind's scanner can't see
    // interpolated `var(${…})` strings) — they name the same vars styleVars
    // writes below. The muted chain lets the inherited board-level var apply
    // when the column sets none.
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {/* Accent chain includes the BOARD tier (like the muted chain) so a
          board-level `accent` cascades to columns that don't set their own —
          this covers the BoardColumn-children slot path, not just the data
          path's JS threading. */}
      <span
        // marks the column's own name so a neighbouring column can be named in a
        // move payload without the board holding a registry
        data-fr-col-title=""
        // break-words, not truncate: the column NAME is what the move payloads are
        // keyed on and what the reader scans — the header has no fixed height, so a
        // long name takes a second line instead of losing its tail. The count badge
        // and caret beside it are shrink-0, so only this span gives way. No min-w-0:
        // the shrink floor belongs on the header ROW above (a container), not on this
        // LEAF, where it lets break-words split the name one character per line.
        // Both candidates are STATIC literals for the same reason as the fill
        // below, and they are MUTUALLY-EXCLUSIVE — the branch mirrors the track's
        // own: with `columnBg` set the shell OWNS an opaque fill, so the title's
        // last resort stays the token that partners it; unset, the track is
        // bg-muted/40 — 60% of whatever is underneath — so the title inherits
        // instead of repainting. Measured on a board inside an authored Card
        // (bg:#12161f color:#e2e6f0): the baked token put #18181b on that
        // part-navy track at 3.3:1, the inherited #e2e6f0 reads 4.1:1. Unwrapped
        // the two are byte-identical (.frayme-root's colour and
        // --color-foreground are both --frayme-fg).
        className={cn(
          'break-words text-sm font-semibold',
          columnBg != null
            ? 'text-[color:var(--fr-boardcolumn-accent,var(--fr-kanbanboard-accent,var(--color-foreground)))]'
            : 'text-[color:var(--fr-boardcolumn-accent,var(--fr-kanbanboard-accent,currentColor))]',
        )}
        title={title ?? undefined}
      >
        {title ?? ''}
      </span>
      {n != null && (
        // The count badge is the one glyph in this header that paints a `bg-muted`
        // fill under itself, so it — not the caret or the title — is where the
        // muted-on-muted pair had to be checked. It read 4.40:1 in light mode,
        // under the 4.5 floor for 0.6875rem text; the token pair was corrected in
        // frayme.css (--frayme-muted-fg #71717a → #52525b) and it now measures
        // 7.03:1 light / 5.88 dark. Left on the muted chain deliberately: the
        // defect was the token, and re-fixing it here would only desaturate this
        // one count while every other muted badge in the SDK stayed grey.
        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-[0.6875rem] font-medium tabular-nums text-[color:var(--fr-boardcolumn-muted,var(--fr-kanbanboard-muted,var(--color-muted-foreground)))]">
          {n}
        </span>
      )}
      {collapsible && (
        // The collapse caret reads the SAME muted chain as the count badge so
        // `mutedColor` covers all secondary header glyphs.
        <span className="ml-auto shrink-0 text-[color:var(--fr-boardcolumn-muted,var(--fr-kanbanboard-muted,var(--color-muted-foreground)))]" aria-hidden>
          <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size={16} />
        </span>
      )}
    </div>
  );
  return (
    <section
      // Column width reads the inherited board var with the old w-72 (18rem)
      // as the fallback — byte-identical when KanbanBoard sets no itemWidth and
      // when BoardColumn is used standalone (no board var to inherit).
      // Column TRACK fill: MUTUALLY-EXCLUSIVE with the bg-muted/40 default (an
      // arbitrary [background:var()] does NOT dedupe against the bg-muted/40
      // utility → exactly one must be present). columnBg SET → the value var
      // (token fallback inside → defence-in-depth); unset → the EXACT prior
      // bg-muted/40 (byte-identical).
      className={cn(
        // GROW from a floor, rather than a frozen width. `shrink-0` with a fixed
        // width meant a column could neither shrink nor stretch, so three columns in a
        // full-width rail occupied ~54rem and left the rest of the row empty — measured
        // at 1800px, roughly half the board was dead space.
        //
        // grow + basis + min-width keeps BOTH behaviours: few columns share the whole
        // rail, and once they would fall below --fr-board-col-w the min-width holds and
        // the rail scrolls exactly as before (it is overflow-x-auto). An authored
        // --fr-board-col-w still sets the floor, so the knob keeps working.
        // min-width is now the SMALLER of the authored column width and the
        // rail's equal share (--fr-board-col-fit, published by KanbanBoard only
        // when the column count can fit), floored at 9rem so squeezing never
        // makes a card unreadable. With the fit var unset the fallback is 100%,
        // so min(18rem,100%) = 18rem and max(9rem,18rem) = 18rem — byte-identical
        // to the previous hard min-width. STATIC literal: Tailwind cannot see an
        // interpolated class.
        'flex grow flex-col gap-3 rounded-frayme p-3 [flex-basis:var(--fr-board-col-w,18rem)] [min-width:max(9rem,min(var(--fr-board-col-w,18rem),var(--fr-board-col-fit,100%)))] max-w-full',
        columnBg != null ? '[background:var(--fr-boardcolumn-bg,var(--color-muted))]' : 'bg-muted/40',
      )}
      style={{
        ...styleVars(
          { var: accentVar as `--${string}`, value: accentValue, kind: 'color' },
          { var: mutedVar as `--${string}`, value: mutedValue, kind: 'color' },
          { var: '--fr-boardcolumn-bg', value: columnBg, kind: 'color' },
          // …and the SHARED surface channel, on exactly the condition that paints.
          // `columnBg` is the one branch where this shell OWNS an opaque fill; the unset
          // branch is bg-muted/40 — 40% of whatever is underneath — and a WASH must not
          // publish, so there is deliberately no reset here. The track hosts arbitrary
          // spec children, so unpublished, every Badge and Avatar an author drops on a
          // branded column derives its ground from OUTSIDE the column.
          { var: '--fr-surface', value: columnBg, kind: 'color' },
          { var: '--fr-surface-fg', value: surfaceInk(columnBg, undefined) as string, kind: 'raw' },
          { var: '--fr-surface-muted', value: surfaceMuted(columnBg, undefined) as string, kind: 'raw' },
          { var: '--fr-surface-sunken', value: surfaceSunken(columnBg) as string, kind: 'raw' },
          { var: '--fr-surface-raised', value: surfaceRaised(columnBg) as string, kind: 'raw' },
          { var: '--fr-surface-field', value: surfaceField(columnBg) as string, kind: 'raw' },
          // Per-column resting card surface — only set when provided, so the
          // board-level default still cascades to columns that don't override.
          { var: '--fr-kanbancard-bg', value: cardBg, kind: 'color' },
          { var: '--fr-kanbancard-bd', value: cardBorder, kind: 'color' },
          { var: '--fr-kanbancard-fg', value: cardColor, kind: 'color' },
        ),
        // …and the avatar chip fill that partners that ink. A column threading
        // cardColor to its cards previously left their chips on --color-muted,
        // which is the 1.15:1 slot-mode case in avatarTintVar's note. `mutedValue`
        // is the column's own muted channel, so it takes precedence exactly as it
        // does on a card. Innermost wins: a KanbanCard naming either channel
        // re-derives its own.
        ...avatarTintVar(mutedValue, cardColor, columnBg),
      }}
    >
      <div className="border-b-2 pb-2 border-b-[color:var(--fr-boardcolumn-accent,var(--fr-kanbanboard-accent,var(--color-border)))]">
        {collapsible ? (
          <button
            type="button"
            // min-h-6 = 24px, the WCAG 2.5.8 target floor. The header row this
            // button wraps has NO height of its own: its tallest child is the h-5
            // count badge (20px) or the text-sm title (20px line box), and the
            // button adds `p-0` — so the whole collapse target measured 20px tall.
            // Full-width covers the horizontal axis, but 2.5.8 is a 24x24 box, and
            // the card stack sits 12px below (gap-3), too close for the spacing
            // exception to carry it. min-h, never h-6: the row must still be free
            // to grow when a long column name wraps to a second line.
            className="flex min-h-6 w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-expanded={!collapsed}
            // Names the card stack the caret opens — but ONLY while that stack is
            // in the document. This shipped unconditional on the reasoning that a
            // reference is dangling-but-LEGAL when aria-expanded=false already
            // says there is nothing to reach. In practice this one collapsed
            // toggle was by far the commonest dangling `aria-controls` on a page.
            // Legal is not the bar. aria-controls is only RECOMMENDED for
            // the disclosure pattern, so omitting it while collapsed costs a
            // reader nothing, whereas following an IDREF that resolves to no
            // element strands them. Same fix as Toggletip and ai-flow's
            // Reasoning/ToolCall. aria-expanded stays in BOTH states — that part
            // is required, and it is what announces the collapse.
            // Gated on `collapsed`, not on which body branch won: the empty
            // placeholder and the card stack are mutually exclusive and both
            // carry `bodyId`, so !collapsed always means exactly one is mounted.
            aria-controls={collapsed ? undefined : bodyId}
            onClick={() => {
              const nextCollapsed = !collapsed;
              if (controlled) onCollapsedChange(nextCollapsed);
              else setCollapsedLocal(nextCollapsed);
              onToggle?.(nextCollapsed);
            }}
          >
            {header}
          </button>
        ) : (
          header
        )}
      </div>
      {!collapsed &&
        (isEmpty && emptyText != null ? (
          // Empty-column placeholder (only when the caller supplied emptyText);
          // reads the same muted chain as the header count badge/caret.
          <div
            id={bodyId}
            className="rounded-frayme border border-dashed border-border/60 px-3 py-6 text-center text-[0.8125rem] text-[color:var(--fr-boardcolumn-muted,var(--fr-kanbanboard-muted,var(--color-muted-foreground)))]"
          >
            {emptyText}
          </div>
        ) : (
          // Both body branches are mutually exclusive, so the id names exactly
          // one node at a time — whichever the toggle currently reveals.
          <div id={bodyId} className="flex flex-col gap-2">{children}</div>
        ))}
    </section>
  );
}

/* ── KanbanBoard ──────────────────────────────────────────────────────────── */

type BoardSnapshot = Array<{ title: string; cards: CardT[] }>;

export function KanbanBoard({ element, children, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    columns?: Array<{ title?: string; count?: number | null; accent?: string | null; cards?: CardT[] | null }> | null;
    board?: BoardSnapshot | null;
    gap?: string | null;
    gapValue?: string | number | null;
    itemWidth?: string | number | null;
    accent?: string | null;
    cardBg?: string | null;
    cardColor?: string | null;
    borderColor?: string | null;
    mutedColor?: string | null;
    showSave?: boolean | null;
    saveLabel?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  // Per-card actions, read defensively (props, else element level — see
  // readRowActions). ONE confirm gate for the whole board rather than one per
  // card: the modal is modal, so a second is unreachable anyway.
  const rowActions = readRowActions(element as { props?: unknown; rowActions?: unknown });
  const [pending, setPending] = useState<{ config: ConfirmCfg & { confirmIcon?: string }; run: () => void } | null>(null);
  // Gates the right-edge fade on real overflow (see use-scroll-edges).
  const railRef = useScrollEdges<HTMLDivElement>();
  const rawColumns = Array.isArray(p.columns)
    ? p.columns.filter((c): c is NonNullable<typeof c> => c != null && typeof c === 'object')
    : [];
  // The enum picks the DEFAULT gap var; the exact `gapValue` (when valid) wins
  // through the override var. The base reads gap via one declaration so an exact
  // override is never deduped against a `gap-*` utility.
  const gap = GAP_CLASS[(p.gap as string) ?? 'md'] ?? GAP_CLASS.md;

  // INTERNAL card arrangement — when given `columns` data, the board OWNS the
  // cards so a card's left/right buttons actually MOVE it between columns (live,
  // no binding). Each card carries a stable `_k` so React reconciles across moves.
  const [cols, setCols] = useState<Array<{ title: string; accent: string | null; cards: Array<CardT & { _k: string }> }>>(() => {
    let k = 0;
    return rawColumns.map((c) => ({
      title: c.title ?? '',
      accent: c.accent ?? null,
      cards: (Array.isArray(c.cards) ? c.cards.filter((cd): cd is CardT => cd != null && typeof cd === 'object') : []).map((cd) => ({ ...cd, _k: `k${k++}` })),
    }));
  });

  // Bindable composite: the CURRENT column→cards arrangement lands in spec.state
  // so an external Button (or the internal Save) can read the whole board without
  // replaying every `move`. Local-fallback when unbound. The `_k` reconcile keys
  // are stripped so the snapshot is the plain author-shaped board.
  const [, setBoundBoard] = useBoundProp<BoardSnapshot>(
    (p.board ?? undefined) as BoardSnapshot | undefined,
    (bindings as { board?: unknown } | undefined)?.board,
  );
  const snapshot = (
    src: Array<{ title: string; cards: Array<CardT & { _k: string }> }>,
  ): BoardSnapshot => src.map((c) => ({ title: c.title, cards: c.cards.map(({ _k, ...card }) => card) }));

  const moveCard = (ci: number, cardIdx: number, dir: 'left' | 'right'): void => {
    // Target + card are resolved OUTSIDE the updater so an out-of-range move
    // never emits (and the payload reads the pre-move arrangement).
    const target = ci + (dir === 'left' ? -1 : 1);
    if (target < 0 || target >= cols.length) return;
    const card = cols[ci]?.cards[cardIdx];
    // Compute the post-move arrangement OUTSIDE the setState updater so we can
    // both mirror it to bound state and emit from it without reading a setter.
    const next = cols.map((c) => ({ ...c, cards: [...c.cards] }));
    const [moved] = next[ci].cards.splice(cardIdx, 1);
    if (moved != null) next[target].cards.push(moved);
    setCols(next);
    setBoundBoard(snapshot(next));
    emitWith('move', {
      card: card?.title ?? null,
      fromColumn: cols[ci]?.title ?? null,
      toColumn: cols[target]?.title ?? null,
      fromIndex: cardIdx,
      toIndex: cols[target]?.cards?.length ?? 0,
    });
  };

  /* A per-card action fires. The payload names the CARD, not just the board:
     `id` is that card's own record id (the thing a handler needs and cannot
     re-derive from a board-level event), alongside the column and index that
     locate it. `action` is the action id, which is also what distinguishes this
     `commit` from the Save button's whole-arrangement one. */
  const runCardAction = (a: RowActionDef, ci: number, cardIdx: number): void => {
    const col = cols[ci];
    const card = col?.cards[cardIdx];
    emitWith('commit', {
      action: a.id,
      id: card?.id ?? null,
      card: card?.title ?? null,
      column: col?.title ?? null,
      index: cardIdx,
      assignee: card?.assignee ?? null,
      meta: card?.meta ?? null,
    // The same _rowaction.ts press a DataTable draws, so the carrier gate carries
    // it the same way (core/dynamic-gate.ts `item-action`) — a board's MOVE and
    // CHANGE stay local, its per-card action button does not.
    }, { affordance: 'row-action' });
  };
  const onCardAction = (a: RowActionDef, ci: number, cardIdx: number): void => {
    if (wantsConfirm(a.confirm)) setPending({ config: deriveConfirm(a.label, a.variant, a.confirm, a.icon), run: () => runCardAction(a, ci, cardIdx) });
    else runCardAction(a, ci, cardIdx);
  };

  /* COLUMNS THAT FIT, OR A RAIL THAT VISIBLY SCROLLS — never a column clipped
     off the edge in silence.
     The rail has always been overflow-x-auto, but each column carried a hard
     `min-width` of the authored itemWidth, so the columns could not give way and
     the overflow was invisible: nothing marked the right edge, and a mouse user
     with no trackpad had no affordance at all. Test boards pushed 5 x 15rem
     and 5 x 16rem into a desktop card
     — 75-80rem of columns — and the last column, the one holding 'Issue' and
     'Delivered', was simply not on screen.
     So: up to MAX_FIT_COLS the rail publishes an equal-share width, and the
     column's min-width takes min(authored, fit) — the columns shrink to fit and
     nothing is lost. Past that, or below the 9rem floor where a card stops being
     readable, the authored width holds and it scrolls — now with the same
     measured edge fade DataTable and the Tabs rail use, so the overflow is
     visible instead of merely present. */
  const fitWidth = (n: number): string | null =>
    n > 0 && n <= MAX_FIT_COLS
      ? `calc((100% - ${n - 1} * var(--fr-board-gap,var(--fr-board-gap-default,1rem))) / ${n})`
      : null;

  const board = (body: ReactNode, colCount: number): ReactNode => (
    <div
      ref={railRef}
      // A region that scrolls but cannot be focused is unreachable by keyboard:
      // its columns simply do not exist for that user. tabindex 0 makes the rail
      // focusable so arrow keys scroll it, and role=region + a name mean a screen
      // reader announces what was entered rather than an anonymous scroll box.
      tabIndex={0}
      role="region"
      aria-label="Board columns"
      className={cn(
        // fr-tabscroll is the SHARED scroll-edge affordance (frayme.css), painted
        // only while data-fr-more-x says there is genuinely more to the right.
        'fr-tabscroll flex w-full overflow-x-auto pb-1 [gap:var(--fr-board-gap,var(--fr-board-gap-default,1rem))]',
        gap,
      )}
      style={{
        ...styleVars(
          { var: '--fr-board-gap', value: p.gapValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 96 } },
          // Exact per-column width — cascades (custom props inherit) to every
          // ColumnShell's width var (fallback 18rem). Unset → 18rem.
          { var: '--fr-board-col-w', value: p.itemWidth, kind: 'dim', opts: { units: ['px', 'rem'], min: 160, max: 560 } },
          { var: '--fr-kanbanboard-accent', value: p.accent, kind: 'color' },
          { var: '--fr-kanbanboard-muted', value: p.mutedColor, kind: 'color' },
          // Board-wide resting card surface — cascades to every card's
          // `[background:var(--fr-kanbancard-bg,…)]` / `[border-color:var(--fr-kanbancard-bd,…)]`,
          // and the paired on-surface text var to every card title/avatar.
          { var: '--fr-kanbancard-bg', value: p.cardBg, kind: 'color' },
          { var: '--fr-kanbancard-bd', value: p.borderColor, kind: 'color' },
          { var: '--fr-kanbancard-fg', value: p.cardColor, kind: 'color' },
        ),
        // The equal-share column width, read by ColumnShell's min-width as the
        // SMALLER half of a min(). Omitted past MAX_FIT_COLS so the fallback
        // (100%) leaves min(authored, 100%) = the authored width — byte-identical
        // to the pre-fix rail for a board that genuinely has to scroll.
        ...(fitWidth(colCount) == null ? {} : { '--fr-board-col-fit': fitWidth(colCount) as string }),
        // The board-wide avatar chip fill, paired with the ink above — this is the
        // `columns` data path, the one that produced the measured 1.15:1.
        /* `cardBg` is the THIRD argument. avatarTintVar derives the avatar's 15%
           tint from the first colour it can find, and the fill the avatar actually
           sits on is the card background — which this call site alone never passed.
           Its two siblings do: ColumnShell passes `columnBg` (:513) and KanbanCard
           passes `p.bg` (:922). A board setting only `cardBg` therefore got a tint
           derived from the INK, or none at all. */
        ...avatarTintVar(p.mutedColor, p.cardColor, p.cardBg),
      }}
    >
      {body}
    </div>
  );

  // Slot of BoardColumn children takes precedence when provided (static board).
  if (children != null && rawColumns.length === 0) {
    // The slot form counts its BoardColumn children so it gets the same fit
    // treatment as the data form — slot-authored boards are common.
    return (
      <CardActionsContext.Provider value={rowActions}>
        {board(children, Children.toArray(children).length)}
      </CardActionsContext.Provider>
    );
  }

  // The on-demand submit: emits ONE `commit` with the full resolved arrangement
  // so a host can persist the board without replaying every `move`. Opt-in via
  // `showSave` (default off — a data board is often read via bound state alone).
  const save = (): void => {
    emitWith('commit', { columns: snapshot(cols) });
  };

  // READ-ONLY boards hide the left/right move affordances: when
  // nothing consumes a move — no `on.move` wiring, no bound `board` arrangement,
  // no Save path — the arrows would mutate throwaway local state only (the
  // dead-affordance class). Any one consumer brings them back.
  const onBlock = (element as { on?: Record<string, unknown> }).on;
  const moveable =
    onBlock?.move != null || (bindings as { board?: unknown } | undefined)?.board != null || p.showSave === true;

  return (
    <div className="flex w-full flex-col gap-3">
      {board(
        cols.map((col, ci) => (
          <ColumnShell
            key={ci}
            title={col.title}
            count={col.cards.length}
            collapsible={false}
            accentVar="--fr-boardcolumn-accent"
            accentValue={col.accent ?? p.accent}
            mutedVar="--fr-kanbanboard-muted"
          >
            {col.cards.map((card, i) => (
              <CardBody
                key={card._k}
                card={card}
                moveable={moveable && (card as { locked?: unknown }).locked !== true}
                canLeft={ci > 0}
                canRight={ci < cols.length - 1}
                onMove={(dir) => moveCard(ci, i, dir)}
                onOpen={() => emitWith('change', { card: card.title ?? null, column: col.title ?? null, index: i })}
                actions={rowActions}
                onAction={(a) => onCardAction(a, ci, i)}
              />
            ))}
          </ColumnShell>
        )),
        cols.length,
      )}
      {p.showSave === true && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center justify-center rounded-frayme bg-[color:var(--fr-btn-fill,var(--color-foreground))] px-4 py-2 text-sm font-medium text-[color:var(--fr-btn-ink,var(--color-card))] outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {p.saveLabel ?? 'Save board'}
          </button>
        </div>
      )}
      {pending && (
        <FraymeConfirmModal
          config={{
            title: pending.config.title ?? undefined,
            message: pending.config.message ?? undefined,
            confirmLabel: pending.config.confirmLabel ?? undefined,
            cancelLabel: pending.config.cancelLabel ?? undefined,
            variant: pending.config.variant ?? undefined,
            confirmIcon: pending.config.confirmIcon,
          }}
          onConfirm={() => { const r = pending.run; setPending(null); r(); }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

/* ── BoardColumn ──────────────────────────────────────────────────────────── */

export function BoardColumn({ element, children, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title?: string | null;
    count?: number | null;
    accent?: string | null;
    collapsible?: boolean | null;
    collapsed?: boolean | null;
    columnBg?: string | null;
    emptyText?: string | null;
    cardBg?: string | null;
    cardColor?: string | null;
    borderColor?: string | null;
    mutedColor?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  // Instance-unique so two `repeat` rows cannot name the same column body.
  const colAriaId = useAriaId('col', element);
  // Bindable collapse state: the current collapsed flag lands in spec.state so an
  // external control can read/drive it (distinct from `collapsible`, which merely
  // enables the toggle). Local-fallback when unbound — byte-identical to the prior
  // internal-only collapse for specs that bind nothing.
  const [collapsed, setCollapsed] = useBoundProp<boolean>(
    (p.collapsed ?? undefined) as boolean | undefined,
    (bindings as { collapsed?: unknown } | undefined)?.collapsed,
  );
  // Position within the board, republished to this column's cards so their move
  // arrows can tell an edge from the middle.
  const colRef = useRef<HTMLDivElement | null>(null);
  const title = typeof p.title === 'string' ? p.title : null;
  const position = useColumnPosition(colRef, title);
  const shell = (
    <ColumnShell
      title={p.title}
      count={p.count}
      collapsible={p.collapsible === true}
      accentVar="--fr-boardcolumn-accent"
      accentValue={p.accent}
      mutedVar="--fr-boardcolumn-muted"
      mutedValue={p.mutedColor}
      columnBg={p.columnBg}
      emptyText={p.emptyText}
      cardBg={p.cardBg}
      cardBorder={p.borderColor}
      cardColor={p.cardColor}
      collapsedValue={collapsed === true}
      onCollapsedChange={setCollapsed}
      // Names the card stack the collapse toggle opens. INSTANCE-unique, not
      // spec-id-only: json-render's `repeat` re-renders this column once per row
      // reusing one spec id, and the body id is rendered unconditionally while
      // expanded — so the old scheme put the SAME id on two live nodes (measured:
      // two rows both emitted `frayme-col-sut-body`), which is invalid HTML and
      // pointed row two's toggle at row one's stack.
      bodyId={colAriaId('body')}
      onToggle={(nextCollapsed) => emitWith('change', { column: p.title ?? null, collapsed: nextCollapsed })}
    >
      {children}
    </ColumnShell>
  );
  return (
    <div ref={colRef} className="contents">
      {position == null ? shell : <ColumnPositionContext.Provider value={position}>{shell}</ColumnPositionContext.Provider>}
    </div>
  );
}

/* ── KanbanCard ───────────────────────────────────────────────────────────── */

/**
 * A board authored as BoardColumn/KanbanCard ELEMENTS has no component holding
 * the arrangement: the runtime resolves each element's children from the spec,
 * so a parent cannot re-parent them and a card carries no spec identity. A card
 * therefore cannot know where it sits — both arrows render enabled even in the
 * end columns, and a "move" has nothing to rearrange.
 *
 * What IS expressible: the board publishes a registry its columns join on mount
 * (mount order is DOM order for siblings), and each column republishes its own
 * position to its cards. That makes the ARROWS honest — disabled at the board's
 * edges, and each move naming the column it leaves and the one it targets — so
 * the host can perform it. A board whose cards must move LOCALLY is authored
 * with the `columns` data prop instead, where KanbanBoard owns the arrangement.
 */
/** A column learns its position from the DOM after mount, not from a counter
 *  mutated during render: a shared render-time counter assigns different indices
 *  on the server and on the client (React may render a tree more than once), and
 *  the arrows then hydrate with mismatched `disabled` state. Reading the node's
 *  own index among its siblings is stable, needs no coordination, and the first
 *  client render matches the server exactly. */
function useColumnPosition(ref: { current: HTMLElement | null }, title: string | null): ColumnPosition | null {
  const [pos, setPos] = useState<{ index: number; count: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (el == null || parent == null) return;
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(el);
    if (index < 0) return;
    setPos((prev) => (prev && prev.index === index && prev.count === siblings.length ? prev : { index, count: siblings.length }));
  });
  const titleOf = (i: number): string | null => {
    const parent = ref.current?.parentElement;
    const node = parent?.children[i] as HTMLElement | undefined;
    // Each column shell labels itself with its own title.
    return node?.querySelector('[data-fr-col-title]')?.textContent ?? null;
  };
  return useMemo(
    () =>
      pos == null
        ? null
        : {
            index: pos.index,
            count: pos.count,
            title,
            neighbourTitle: (dir: 'left' | 'right') => titleOf(pos.index + (dir === 'left' ? -1 : 1)),
          },
    // titleOf reads the live DOM, so it does not belong in the dep list
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pos, title],
  );
}

interface ColumnPosition {
  index: number;
  count: number;
  title: string | null;
  neighbourTitle: (dir: 'left' | 'right') => string | null;
}
const ColumnPositionContext = createContext<ColumnPosition | null>(null);
/** Board-level `rowActions` published to slot-authored KanbanCards. A card's own
 *  `rowActions` wins outright (the more specific channel), exactly as its own
 *  `bg`/`color` win over the board's `cardBg`/`cardColor`. */
const CardActionsContext = createContext<RowActionDef[]>([]);

export function KanbanCard({ element, emit, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    id?: string | null;
    title?: string | null;
    description?: string | null;
    labels?: Array<{ text?: string | null; tone?: string | null; color?: string | null }> | null;
    assignee?: string | null;
    meta?: string | null;
    moveable?: boolean | null;
    accent?: string | null;
    bg?: string | null;
    color?: string | null;
    borderColor?: string | null;
    mutedColor?: string | null;
    weight?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const position = useContext(ColumnPositionContext);
  // This card's own actions win over the board's; neither is dropped silently.
  const inherited = useContext(CardActionsContext);
  const own = readRowActions(element as { props?: unknown; rowActions?: unknown });
  const actions = own.length > 0 ? own : inherited;
  const [pending, setPending] = useState<{ config: ConfirmCfg & { confirmIcon?: string }; run: () => void } | null>(null);
  // The RESOLVED card identity + structured fields the agent needs to act on an
  // open/move WITHOUT pre-indexing by title: the author-supplied stable `id`
  // (null when unset), plus the assignee/meta the renderer already holds.
  const cardId = typeof p.id === 'string' && p.id.length > 0 ? p.id : null;
  const assignee = typeof p.assignee === 'string' && p.assignee.length > 0 ? p.assignee : null;
  const meta = typeof p.meta === 'string' && p.meta.length > 0 ? p.meta : null;
  return (
    <div
      style={{
        ...styleVars(
          { var: '--fr-kanbancard-accent', value: p.accent, kind: 'color' },
          { var: '--fr-kanbancard-muted', value: p.mutedColor, kind: 'color' },
          // Resting card surface — read by CardBody's
          // `[background:var(--fr-kanbancard-bg,…)]` / `[border-color:var(--fr-kanbancard-bd,…)]`;
          // `color` is the paired on-surface text (title + avatar initials).
          { var: '--fr-kanbancard-bg', value: p.bg, kind: 'color' },
          { var: '--fr-kanbancard-bd', value: p.borderColor, kind: 'color' },
          { var: '--fr-kanbancard-fg', value: p.color, kind: 'color' },
        ),
        // mutedColor first (the specific channel), else the card's own `color` —
        // so a card that names a dark fill + its light ink gets a chip that ink is
        // readable on instead of the near-white muted token.
        ...avatarTintVar(p.mutedColor, p.color, p.bg),
      }}
    >
      <CardBody
        card={{
          id: cardId,
          title: p.title,
          description: p.description,
          labels: p.labels,
          assignee: p.assignee,
          meta: p.meta,
        }}
        moveable={p.moveable === true}
        titleWeight={p.weight}
        // Outside a slot-mode board there is no position to read, so both
        // directions stay open (the host is the only thing that can act).
        // Outside a board there is no position to read, so both directions stay
        // open — the host is the only thing that could act on them anyway.
        canLeft={position ? position.index > 0 : true}
        canRight={position ? position.index < position.count - 1 : true}
        onMove={(dir) =>
          // Naming both columns means a host acting on the move does not have to
          // re-derive them from a direction and a card id.
          emitWith('move', {
            id: cardId,
            card: p.title ?? null,
            dir,
            fromColumn: position?.title ?? null,
            toColumn: position?.neighbourTitle(dir) ?? null,
            assignee,
            meta,
          })
        }
        onOpen={() => emitWith('change', { id: cardId, card: p.title ?? null, assignee, meta })}
        actions={actions}
        onAction={(a) => {
          /* Same contract as the data-path board: `action` is the action id and
             `id` is THIS card's own record id, so a handler acts on the right
             record without re-indexing by title. */
          const run = (): void =>
            emitWith('commit', {
              action: a.id,
              id: cardId,
              card: p.title ?? null,
              column: position?.title ?? null,
              assignee,
              meta,
            // The per-card action button is the _rowaction.ts press — carried by
            // the gate as `item-action` (core/dynamic-gate.ts), unlike the card's
            // move / open, which stay local by default.
            }, { affordance: 'row-action' });
          if (wantsConfirm(a.confirm)) setPending({ config: deriveConfirm(a.label, a.variant, a.confirm, a.icon), run });
          else run();
        }}
        /* SPEC CHILDREN LAND INSIDE THE CARD.
           KanbanCard did not destructure `children` at all, so anything the model
           nested in a card was resolved by the renderer and then thrown away.
           One test board put all nine of its 'Reassign CSM' Buttons in
           KanbanCard children and ZERO reached the DOM, and another did the
           same with eleven — the contract walk counted them
           "bound and reachable" the whole time. `rowActions` above is the
           declared idiom for a per-card action; this is the escape hatch for
           anything else (a Progress bar, a Badge row, a link), and it is what
           makes the card an honest container instead of a silent sink. */
        footer={children == null ? undefined : <div className="flex flex-col gap-2">{children}</div>}
      />
      {pending && (
        <FraymeConfirmModal
          config={{
            title: pending.config.title ?? undefined,
            message: pending.config.message ?? undefined,
            confirmLabel: pending.config.confirmLabel ?? undefined,
            cancelLabel: pending.config.cancelLabel ?? undefined,
            variant: pending.config.variant ?? undefined,
            confirmIcon: pending.config.confirmIcon,
          }}
          onConfirm={() => { const r = pending.run; setPending(null); r(); }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

/* ── NavigationMenu ───────────────────────────────────────────────────────── */

const navWrap = cva('flex w-full gap-1 [--fr-navmenu-accent:var(--color-foreground)]', {
  variants: {
    orientation: {
      horizontal: 'flex-row flex-wrap items-center',
      vertical: 'flex-col items-stretch',
    },
  },
  defaultVariants: { orientation: 'horizontal' },
});

type NavLeaf = { label?: string | null; href?: string | null; description?: string | null; icon?: string | null };
type NavItem = NavLeaf & { active?: boolean | null; children?: NavLeaf[] | null };

/** Render the leaf glyph (guarded) + label for a nav entry. */
function NavLabel({ icon, label }: { icon?: string | null; label?: string | null }): ReactNode {
  const name = typeof icon === 'string' && hasIcon(icon) ? icon : null;
  return (
    <>
      {name != null && (
        <span className="shrink-0" aria-hidden>
          <Icon name={name} size={16} />
        </span>
      )}
      {/* break-words, not truncate: a nav destination name must survive. The
          horizontal wrap (`navWrap`) already lets entries take a second row, and a
          vertical menu / flyout row has no fixed height. No min-w-0: the shrink
          floor sits on the inline-flex row that wraps glyph + label; on this LEAF
          it would let break-words split the name one character per line. */}
      <span className="break-words" title={label ?? undefined}>{label ?? ''}</span>
    </>
  );
}

export function NavigationMenu({ element, emit }: ComponentRenderProps): ReactNode {
  const emitWith = useIntrinsicEmit(emit, element);
  // Hoisted out of the items loop below: useAriaId is a hook, so it is called
  // once per render and the returned builder is what varies per item.
  const navAriaId = useAriaId('nav', element);
  const p = (element.props ?? {}) as {
    items?: NavItem[] | null;
    orientation?: string | null;
    accent?: string | null;
    mutedColor?: string | null;
    bg?: string | null;
    borderColor?: string | null;
  };
  const items = Array.isArray(p.items)
    ? p.items.filter((it): it is NavItem => it != null && typeof it === 'object')
    : [];
  const orientation = (p.orientation as 'horizontal' | 'vertical' | null) ?? 'horizontal';
  // INTERNAL open-flyout state — live without a binding. null = all closed.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Dismiss the flyout on outside-click (client-only effect; SSR-safe).
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (openIndex == null) return;
    const onDown = (e: MouseEvent): void => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenIndex(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openIndex]);

  // No `text-[color:var(--fr-surface-fg,var(--color-foreground))]` in the base — an arbitrary [color:…] override (open-state
  // accent) is NOT deduped against `text-{color}` by tailwind-merge, so the base
  // would win. Color is applied per-use (leaf = token, parent = accent when open).
  const linkCls =
    'inline-flex items-center gap-2 rounded-frayme px-3 py-2 text-sm font-medium no-underline outline-none transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] hover:[color:var(--fr-navmenu-accent)] focus-visible:ring-2 focus-visible:ring-primary/50';

  return (
    <nav
      ref={navRef}
      className={cn(navWrap({ orientation }))}
      style={styleVars(
        { var: '--fr-navmenu-accent', value: p.accent, kind: 'color' },
        { var: '--fr-navmenu-muted', value: p.mutedColor, kind: 'color' },
        // Flyout panel surface channels (nav surfaces expose surface + border,
        // like Sidebar/Navbar) — read by the flyout's var-fallback classes.
        { var: '--fr-navmenu-bg', value: p.bg, kind: 'color' },
        { var: '--fr-navmenu-border', value: p.borderColor, kind: 'color' },
      )}
      aria-label="Main"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && openIndex != null) setOpenIndex(null);
      }}
    >
      {items.map((item, i) => {
        const subItems = Array.isArray(item.children)
          ? item.children.filter((c): c is NavLeaf => c != null && typeof c === 'object')
          : [];
        const hasChildren = subItems.length > 0;
        const isOpen = openIndex === i;
        // Every parent entry in this menu renders its own flyout, so the item
        // INDEX is what keeps the sibling triggers from all naming the first
        // panel. The instance part (hoisted above — useAriaId is a hook and
        // cannot be called in this loop) is what separates one NavigationMenu
        // from another, including two `repeat` rows sharing one spec id.
        const flyoutId = navAriaId('flyout', i);

        // Per-item current-page state: accent text + aria-current='page'. The
        // accent reader is added LAST (an arbitrary [color:var()] does NOT dedupe
        // text-inherit → the two are MUTUALLY-EXCLUSIVE so exactly one paints).
        //
        // The resting branch is `text-inherit`, not `text-[color:var(--fr-surface-fg,var(--color-foreground))]`: navWrap
        // paints NO surface of its own, so a menu inside an authored container
        // (Card bg:#12161f color:#e2e6f0) had every resting entry repainted
        // #18181b over navy — 1.02:1, the ~387-finding shape. A colour declaration
        // is still required (an <a> without one falls to the UA's -webkit-link
        // blue), so the fix is `color: inherit`, not dropping the class. Byte-
        // identical unwrapped: .frayme-root's colour and --color-foreground are
        // both --frayme-fg. The OPEN branch below keeps its token pairing — it
        // paints bg-muted under itself.
        const active = item.active === true;

        // A leaf entry → a scheme-guarded link.
        if (!hasChildren) {
          return (
            <a
              key={i}
              className={cn(linkCls, 'min-w-0', active ? '[color:var(--fr-navmenu-accent)] font-semibold' : 'text-inherit')}
              href={safeUrl(item.href)}
              {...linkTargetRel(false)}
              aria-current={active ? 'page' : undefined}
              onClick={() => emitWith('select', { label: item.label ?? null, href: item.href ?? null, index: i })}
            >
              <NavLabel icon={item.icon} label={item.label} />
            </a>
          );
        }

        // A parent entry → a button toggling its flyout (internal state).
        return (
          <div key={i} className={cn('relative', orientation === 'vertical' && 'w-full')}>
            <button
              type="button"
              className={cn(
                linkCls,
                'w-full justify-between cursor-pointer border-0 bg-transparent',
                // open wins; else active shows the current-page accent; else the
                // inherited ink (the trigger is bg-transparent when it is not open).
                isOpen
                  ? 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] [color:var(--fr-navmenu-accent)]'
                  : active
                    ? '[color:var(--fr-navmenu-accent)] font-semibold'
                    : 'text-inherit',
              )}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              // Emitted only while the flyout is mounted, for the reason spelled
              // out on ColumnShell's toggle above: a closed trigger that names an
              // absent id sends a reader who follows it nowhere. Note `openIndex`
              // is a SINGLE slot, so opening one parent unmounts its sibling's
              // panel — an unconditional reference would strand every OTHER
              // trigger in the menu, not just the resting ones. aria-haspopup
              // + aria-expanded still announce "a menu lives behind this" in both
              // states; aria-controls is only RECOMMENDED for the pattern.
              aria-controls={isOpen ? flyoutId : undefined}
              aria-current={active ? 'page' : undefined}
              onClick={() => setOpenIndex((cur) => (cur === i ? null : i))}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <NavLabel icon={item.icon} label={item.label} />
              </span>
              <span
                // The caret travels with the label state: muted chain at rest,
                // the accent var when the flyout is open (added LAST → dedupes
                // the resting text-color class).
                className={cn(
                  'shrink-0 transition-transform text-[color:var(--fr-navmenu-muted,var(--color-muted-foreground))]',
                  isOpen && 'rotate-180 text-[color:var(--fr-navmenu-accent)]',
                )}
                aria-hidden
              >
                <Icon name="chevron-down" size={16} />
              </span>
            </button>
            {isOpen && (
              <div
                id={flyoutId}
                role="menu"
                className={cn(
                  // Panel surface + border route through the navmenu vars (token
                  // fallbacks) so a branded nav doesn't pop a default-white menu.
                  'z-20 flex min-w-56 flex-col gap-0.5 rounded-frayme border border-[color:var(--fr-navmenu-border,var(--color-border))] [background:var(--fr-navmenu-bg,var(--color-card))] p-2 shadow-lg',
                  orientation === 'horizontal' ? 'absolute left-0 top-full mt-1' : 'relative mt-1 ml-3',
                )}
              >
                {subItems.map((sub, si) => (
                  <a
                    key={si}
                    role="menuitem"
                    className="flex flex-col gap-0.5 rounded-sm px-3 py-2 no-underline outline-none transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:ring-2 focus-visible:ring-primary/50"
                    href={safeUrl(sub.href)}
                    {...linkTargetRel(false)}
                    onClick={() => {
                      setOpenIndex(null);
                      emitWith('select', {
                        label: sub.label ?? null,
                        href: sub.href ?? null,
                        parent: item.label ?? null,
                        index: si,
                      });
                    }}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))]">
                      <NavLabel icon={sub.icon} label={sub.label} />
                    </span>
                    {sub.description != null && (
                      <span className="text-[0.8125rem] leading-snug [color:var(--fr-navmenu-muted,var(--color-muted-foreground))]">{sub.description}</span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
