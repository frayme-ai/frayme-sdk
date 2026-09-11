'use client';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { cva } from 'class-variance-authority';
import { safeColor } from '@frayme/catalog/validate';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { useAriaId } from './_aria.js';
import { Icon } from './icons.js';

/* Catalog group: DatePicker, DateRangePicker, Calendar.
 *
 * Date inputs + a month-grid calendar. Same truly-dynamic contract as Phases
 * 1–5:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (color the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities. The class set stays a
 *     closed build-time set (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing/absent
 *     value so the token fallback wins (props-less → polished).
 *
 * Defaults live in CVA `defaultVariants`, never the schema (schema props are
 * `.nullable()`). Every component reuses ONE deterministic month-grid helper
 * (`buildMonth`) computed purely from a year+month. The unseeded fallback month
 * is the CURRENT month — a fixed fallback month left real users on a permanently
 * outdated calendar with min:'today' disabling every visible day. Determinism
 * still holds whenever a spec seeds `value`/`month`; only unseeded pickers
 * follow the wall clock, which is what a date PICKER is for.
 * Dates are ISO 'YYYY-MM-DD'; months are 'YYYY-MM'. */

/* ── shared, non-exported month-grid helper ──────────────────────────────────
 *
 * Pure deterministic Date math (UTC, no `Date.now()`): everything is derived
 * from an explicit year + 0-based month. When no month/value is supplied we fall
 * back to a fixed sensible month so the grid never depends on the wall clock. */

/** Fallback display month when nothing seeds it: the CURRENT month (a hardcoded
 * fallback month goes stale — every day ends up < min:'today' and disabled). */
function fallbackYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const WEEKDAYS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** A single grid cell: a real day of the displayed month, or a leading/trailing
 *  blank (so columns align to the weekday header). */
type DayCell = { iso: string; day: number } | null;

/**
 * i18n length-validation: accept a model-supplied label array ONLY when it is an
 * array of exactly `len` strings; otherwise fall back to the English default so a
 * malformed/short array can never break the grid (props-less → byte-identical).
 */
function i18nLabels(x: unknown, len: number, fallback: string[]): string[] {
  if (Array.isArray(x) && x.length === len && x.every((s) => typeof s === 'string')) {
    return x as string[];
  }
  return fallback;
}

/** Parse 'YYYY-MM' → { year, month0 } (0-based month). Invalid → null. */
function parseYearMonth(ym: unknown): { year: number; month0: number } | null {
  if (typeof ym !== 'string') return null;
  const m = /^(\d{4})-(\d{2})/.exec(ym);
  if (!m) return null;
  const year = Number(m[1]);
  const month0 = Number(m[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month0) || month0 < 0 || month0 > 11) return null;
  return { year, month0 };
}

/** Parse an ISO 'YYYY-MM-DD' date → its 'YYYY-MM' month, or null. */
function isoToYearMonth(iso: unknown): string | null {
  if (typeof iso !== 'string') return null;
  const m = /^(\d{4}-\d{2})-\d{2}$/.exec(iso);
  return m ? m[1] : null;
}

/** Build an ISO 'YYYY-MM-DD' from numeric parts (zero-padded). */
function toIso(year: number, month0: number, day: number): string {
  const mm = String(month0 + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** Compare two ISO date strings lexically (valid 'YYYY-MM-DD' sorts correctly). */
function isoLte(a: string, b: string): boolean {
  return a <= b;
}

/* ── popover mechanics (DatePicker + DateRangePicker) ────────────────────────
 * Popover is the DEFAULT mode: the field is a
 * real focusable trigger and the month grid opens on demand. `mode:'inline'`
 * opts back into the always-visible grid. Close paths: Escape (focus returns
 * to the trigger), pointerdown outside the wrapper, and selection complete
 * (single: a day pick; range: the end landing). Listeners attach only while
 * open, so SSR and the closed state stay listener-free. */
function usePopoverDismiss(
  open: boolean,
  close: () => void,
  wrapRef: RefObject<HTMLDivElement | null>,
  triggerRef: RefObject<HTMLButtonElement | null>,
): void {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close, wrapRef, triggerRef]);
}

/** Displayed month DERIVED from the value (not initial-state-only — the old
 * `useState(seed)` froze the month, so the grid could show August while the
 * field said September). Chevron nav overrides; any value change re-derives. */
function useDisplayMonth(seed: string): [string, (next: string) => void] {
  const [nav, setNav] = useState<{ ym: string; base: string } | null>(null);
  const ym = nav && nav.base === seed ? nav.ym : seed;
  return [ym, (next: string) => setNav({ ym: next, base: seed })];
}

/** The trigger-button affordance classes layered over fieldRecipe in popover
 * mode: pointer cursor, left-aligned text, and a visible focus ring. */
const triggerAffordance =
  'cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:var(--fr-cal-accent,var(--fr-accent))]';

/**
 * The shared month grid. Deterministic: from an explicit 'YYYY-MM' (or a
 * fallback) it produces the month name + a weekday-aligned array of cells, plus
 * the prev/next month strings for paging. `weekStartsOn` shifts the leading
 * offset and the weekday header.
 */
function buildMonth(
  ym: string,
  weekStartsOn: 'sunday' | 'monday',
  i18n?: {
    /** 12 full month names (Jan→Dec) for the header title. */
    monthNames?: string[];
    /** 7 weekday labels already in `weekStartsOn` order. */
    weekdays?: string[];
  },
): {
  year: number;
  month0: number;
  title: string;
  weekdays: string[];
  cells: DayCell[];
  prevYm: string;
  nextYm: string;
} {
  const parsed = parseYearMonth(ym) ?? parseYearMonth(fallbackYm()) ?? { year: 2026, month0: 5 };
  const { year, month0 } = parsed;

  // Days in the month + which weekday the 1st lands on (UTC, deterministic).
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, month0, 1)).getUTCDay(); // 0=Sun..6=Sat

  // Leading blanks so day 1 sits under the right weekday column.
  const offset = weekStartsOn === 'monday' ? (firstDow + 6) % 7 : firstDow;

  const cells: DayCell[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ iso: toIso(year, month0, d), day: d });
  // Trailing blanks to complete the final week row.
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth0 = month0 === 0 ? 11 : month0 - 1;
  const prevYear = month0 === 0 ? year - 1 : year;
  const nextMonth0 = month0 === 11 ? 0 : month0 + 1;
  const nextYear = month0 === 11 ? year + 1 : year;

  // i18n overrides (already length-validated by the caller) fall back to English.
  const months = i18n?.monthNames ?? MONTH_NAMES;
  const weekdays = i18n?.weekdays ?? (weekStartsOn === 'monday' ? WEEKDAYS_MON : WEEKDAYS_SUN);

  return {
    year,
    month0,
    title: `${months[month0]} ${year}`,
    weekdays,
    cells,
    prevYm: `${prevYear}-${String(prevMonth0 + 1).padStart(2, '0')}`,
    nextYm: `${nextYear}-${String(nextMonth0 + 1).padStart(2, '0')}`,
  };
}

/** Human-format an ISO date for a picker field. An optional `monthNames` i18n
 *  override (full names, already length-validated) localises the `long` form; the
 *  `short` form keeps the English abbreviations (no abbrev override channel). */
function formatIso(iso: string, format: 'iso' | 'long' | 'short', monthNames?: string[]): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const year = Number(m[1]);
  const month0 = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month0 < 0 || month0 > 11 || day < 1 || day > 31) return iso;
  if (format === 'iso') return iso;
  if (format === 'short') return `${MONTH_SHORT[month0]} ${day}`;
  return `${(monthNames ?? MONTH_NAMES)[month0]} ${day}, ${year}`;
}

/* ── shared visual recipes ───────────────────────────────────────────────────
 *
 * `accent` is the brand lever (selected-day fill + ring); it routes through
 * `--fr-cal-accent` with a primary-token fallback. `bg`/`borderColor` route
 * through their own vars. The field surface + grid never bake a literal color. */

const fieldRecipe = cva(
  'inline-flex w-full items-center gap-2 border transition-[border-color,box-shadow] [border-color:var(--fr-cal-border,var(--color-border))] [background:var(--fr-cal-bg,var(--color-card))] text-[color:var(--fr-cal-fg,var(--color-foreground))] [border-radius:var(--fr-cal-radius,var(--radius-frayme))]',
  {
    variants: {
      size: {
        sm: 'h-8 px-2.5 text-sm',
        md: 'h-10 px-3',
        lg: 'h-12 px-3.5 text-lg',
      },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', disabled: false },
  },
);

const gridSize = cva('grid grid-cols-7', {
  variants: {
    size: { sm: 'gap-0.5 text-xs', md: 'gap-1 text-sm', lg: 'gap-1.5 text-base' },
  },
  defaultVariants: { size: 'md' },
});

const dayBtn = cva(
  'relative flex aspect-square items-center justify-center [border-radius:var(--fr-cal-radius,var(--radius-frayme))] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:[--tw-ring-color:var(--fr-cal-accent,var(--fr-accent))]',
  {
    variants: {
      // Fixed w+h made 7 cols overflow narrow cards by ~4px,
      // shaving Sunday. Cells are now fluid within their grid track (w-full +
      // aspect-square) with the old size as a MAX, so the grid compresses
      // gracefully instead of clipping the last column.
      size: { sm: 'w-full max-w-7 aspect-square', md: 'w-full max-w-9 aspect-square', lg: 'w-full max-w-11 aspect-square' },
      state: {
        // regular day numbers follow the settable base-text channel (--fr-cal-fg);
        // token fallback keeps the unset render byte-identical to text-[color:var(--fr-surface-fg,var(--color-foreground))].
        default: 'text-[color:var(--fr-cal-fg,var(--color-foreground))]',
        // quiet defaults: a SELECTED day (and range endpoints) is Button's
        // neutral high-contrast primary (near-black on light / near-white on dark) via
        // the accent-fallback swap, not a saturated brand slab. A supplied `accent`
        // still fills brand. The in-range fill's fallback moves in lockstep so the band
        // between neutral endpoints reads as a faint neutral tint, not a brand wash.
        selected:
          'font-semibold text-[color:var(--fr-cal-accent-fg,var(--color-card))] [background:var(--fr-cal-accent,var(--color-foreground))]',
        // a day inside a range (not an endpoint) — subtle fill, coherent with the neutral endpoints.
        inRange: 'text-[color:var(--fr-cal-fg,var(--color-foreground))] [background:color-mix(in_srgb,var(--fr-cal-accent,var(--color-foreground))_18%,transparent)]',
        // resting/out-of-range day text follows the settable muted channel.
        muted: 'cursor-not-allowed opacity-45 text-[color:var(--fr-cal-muted,var(--color-muted-foreground))]',
      },
      // The default-state hover fill travels with the component's own channels:
      // accent-derived (a 10% accent wash) when the model named an accent,
      // otherwise the token hover verbatim — MUTUALLY EXCLUSIVE branches (never
      // co-locate the two hovers; they are different tw-merge groups and the
      // token utility would win by stylesheet order). Unset accent reproduces the
      // prior hover byte-for-byte in the computed style.
      accentHover: { true: '', false: '' },
    },
    compoundVariants: [
      { state: 'default', accentHover: false, class: 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]' },
      {
        state: 'default',
        accentHover: true,
        class: 'hover:[background:color-mix(in_srgb,var(--fr-cal-accent)_10%,transparent)]',
      },
    ],
    defaultVariants: { size: 'md', state: 'default', accentHover: false },
  },
);

const toneDot: Record<'neutral' | 'success' | 'warning' | 'critical' | 'info', string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-danger',
  info: 'bg-info',
};

/** The month header: title + prev/next chevrons. Shared by all three.
 *
 *  The chevrons consume the SAME three text channels as the rest of the header
 *  row: resting glyph → mutedColor (--fr-cal-muted), hover
 *  glyph → color (--fr-cal-fg), focus ring → accent (--fr-cal-accent) — each
 *  with its prior token folded in as the in-var fallback, so an unset picker is
 *  byte-identical in computed style. The hover FILL follows the shared
 *  hover-from-accent pattern via `accented` (mutually-exclusive branches; the
 *  token hover string is kept verbatim when no accent is named). */
function MonthHeader({
  title,
  onPrev,
  onNext,
  accented,
}: {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  accented?: boolean;
}): ReactNode {
  const navBtn = cn(
    'inline-flex h-7 w-7 items-center justify-center rounded-frayme text-[color:var(--fr-cal-muted,var(--color-muted-foreground))] hover:text-[color:var(--fr-cal-fg,var(--color-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:var(--fr-cal-accent,var(--fr-accent))]',
    accented === true
      ? 'hover:[background:color-mix(in_srgb,var(--fr-cal-accent)_10%,transparent)]'
      : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
  );
  return (
    <div className="flex items-center justify-between px-1 pb-2">
      <button type="button" className={navBtn} aria-label="Previous month" onClick={onPrev}>
        <Icon name="chevron-left" size={16} />
      </button>
      <span className="text-sm font-semibold text-[color:var(--fr-cal-fg,var(--color-foreground))]" aria-live="polite">
        {title}
      </span>
      <button type="button" className={navBtn} aria-label="Next month" onClick={onNext}>
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  );
}

/** The weekday header row. */
function WeekdayHeader({ weekdays, size }: { weekdays: string[]; size?: 'sm' | 'md' | 'lg' }): ReactNode {
  return (
    <div className={cn(gridSize({ size }), 'mb-1')} aria-hidden>
      {weekdays.map((w) => (
        <span key={w} className="flex h-6 items-center justify-center font-medium [color:var(--fr-cal-muted,var(--color-muted-foreground))]">
          {w.slice(0, 2)}
        </span>
      ))}
    </div>
  );
}

/** What a day cell must spread onto its focusable element to join the grid's
 *  keyboard model. DayGrid owns the roving tab stop centrally so all three date
 *  components inherit ONE implementation of the pattern. */
type DayCellNav = {
  /** 0 on the single roving cell, -1 on the other ~30. */
  tabIndex: 0 | -1;
  ref: (el: HTMLElement | null) => void;
  onKeyDown: (e: ReactKeyboardEvent) => void;
  onFocus: () => void;
};

/** A month grid as a VALID ARIA grid: role="grid" → role="row" (one per week of
 *  7) → the day cells (role="gridcell", supplied by `renderCell`). Null padding
 *  slots render as aria-hidden spacers so each week still lays out 7 columns. A
 *  flat grid with gridcells NOT inside rows is invalid ARIA — this is the fix all
 *  three date components share.
 *
 *  ROVING TABINDEX (composite-roles rule). `role="grid"` promises a
 *  composite widget: ONE tab stop that the arrow keys move. Two separate defects
 *  lived here and both are fixed by this one helper:
 *
 *   - Calendar `selectable:false` rendered its cells as plain <div
 *     role="gridcell"> with no tabindex, so a keyboard user could not enter the
 *     grid AT ALL — measured on a 31-day month: 37 items (31 cells + 6 rows),
 *     0 focusable. Declaring `grid` and implementing nothing is the worst of the
 *     three options, so the cells became focusable rather than the role being
 *     dropped: the day's `aria-label` ("August 14, 2026, 2 events") is the ONLY
 *     carrier of the event count, and aria-label on a role-less <div> is not
 *     reliably exposed — dropping the role would have deleted that information
 *     for the very users this is for.
 *   - The three SELECTABLE grids were the opposite failure: every one of ~31 day
 *     buttons was its own tab stop and the arrow keys did nothing, so passing a
 *     calendar by keyboard cost 31 Tab presses. Legal, but not the pattern the
 *     role promises.
 *
 *  The stop resolves as: last-focused day → the anchor day (`preferredIso`: the
 *  selection, or "today") → the first operable day. It is null ONLY when the
 *  whole displayed month is out of range: a stop parked on a disabled <button>
 *  cannot take focus, which would drop the grid out of the tab order entirely,
 *  and nothing in that month is operable anyway (the header chevrons stay
 *  focusable, so the user can page to a month that has days). */
function DayGrid({
  grid,
  size,
  renderCell,
  preferredIso,
  isDisabled,
}: {
  grid: { title: string; cells: Array<{ iso: string; day: number } | null> };
  size?: 'sm' | 'md' | 'lg';
  renderCell: (cell: { iso: string; day: number }, nav: DayCellNav) => ReactNode;
  /** The day the tab stop anchors to before the user has touched the grid. */
  preferredIso?: string | null;
  /** Days that cannot hold focus (an out-of-range `<button disabled>`). */
  isDisabled?: (iso: string) => boolean;
}): ReactNode {
  const cells = grid.cells;
  const cellRefs = useRef(new Map<string, HTMLElement>());
  const [focusIso, setFocusIso] = useState<string | null>(null);

  const usable = (iso: string): boolean => isDisabled == null || !isDisabled(iso);
  const indexOfIso = (iso: string | null | undefined): number =>
    iso == null ? -1 : cells.findIndex((c) => c != null && c.iso === iso);
  /** An iso only counts as the stop while it is still an operable cell of the
   *  DISPLAYED month — paging months must not leave the stop on a day that is no
   *  longer rendered. */
  const held = (iso: string | null | undefined): string | null => {
    const i = indexOfIso(iso);
    const c = i >= 0 ? cells[i] : null;
    return c != null && usable(c.iso) ? c.iso : null;
  };
  let firstUsable: string | null = null;
  for (const c of cells) {
    if (c != null && usable(c.iso)) {
      firstUsable = c.iso;
      break;
    }
  }
  const activeIso = held(focusIso) ?? held(preferredIso) ?? firstUsable;

  /** One arrow step from a flat cell index (±1 = a day, ±7 = a week). Padding
   *  blanks and out-of-range days are stepped OVER in the direction of travel —
   *  the same bounded post-step PermissionMatrix does — and running off the
   *  month returns null so the key goes back to the host rather than
   *  re-selecting the cell we are already on. ±1 deliberately crosses the week
   *  boundary: the cell left of Monday IS the previous Sunday. */
  const stepFrom = (from: number, delta: number): string | null => {
    for (let i = from + delta; i >= 0 && i < cells.length; i += delta) {
      const c = cells[i];
      if (c != null && usable(c.iso)) return c.iso;
    }
    return null;
  };
  /** Home/End: the first/last operable day of the WEEK row (APG grid), so a
   *  leading padding blank or a min-bounded first day is skipped for free. */
  const rowEdge = (from: number, end: boolean): string | null => {
    const start = Math.floor(from / 7) * 7;
    const row = cells.slice(start, start + 7);
    if (end) row.reverse();
    for (const c of row) if (c != null && usable(c.iso)) return c.iso;
    return null;
  };

  const onCellKey = (e: ReactKeyboardEvent, iso: string): void => {
    const i = indexOfIso(iso);
    if (i < 0) return;
    const to =
      e.key === 'ArrowLeft' ? stepFrom(i, -1)
      : e.key === 'ArrowRight' ? stepFrom(i, 1)
      : e.key === 'ArrowUp' ? stepFrom(i, -7)
      : e.key === 'ArrowDown' ? stepFrom(i, 7)
      : e.key === 'Home' ? rowEdge(i, false)
      : e.key === 'End' ? rowEdge(i, true)
      : null;
    if (to == null) return;
    // A key the grid consumes stops BOTH its default action and the walk up to
    // the embedding host's shortcuts (Home/End otherwise scroll the host
    // document out from under an open picker).
    e.preventDefault();
    e.stopPropagation();
    // Moving the stop means moving FOCUS. A tabindex that walks while
    // document.activeElement stays put leaves the focused cell at -1 — the same
    // half-fix PermissionMatrix's a11y test pins.
    setFocusIso(to);
    cellRefs.current.get(to)?.focus();
  };

  const nav = (iso: string): DayCellNav => ({
    tabIndex: iso === activeIso ? 0 : -1,
    ref: (el) => {
      if (el) cellRefs.current.set(iso, el);
      else cellRefs.current.delete(iso);
    },
    onKeyDown: (e) => onCellKey(e, iso),
    // Focus arriving by ANY route (Tab in, arrow, click) becomes the stop, so
    // tabbing away and back returns the user to where they were rather than to
    // the anchor day. The equality bail-out matters: `onCellKey` already sets
    // the stop before calling .focus(), so without it every arrow press would
    // schedule a second, identical render.
    onFocus: () => setFocusIso((cur) => (cur === iso ? cur : iso)),
  });

  const weeks: Array<Array<{ iso: string; day: number } | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <div
      role="grid"
      aria-label={grid.title}
      className={cn('flex flex-col', size === 'sm' ? 'gap-0.5' : size === 'lg' ? 'gap-1.5' : 'gap-1')}
    >
      {weeks.map((week, wi) => (
        <div key={wi} role="row" className={cn(gridSize({ size }))}>
          {week.map((cell, ci) =>
            cell == null ? (
              // Plain spacer — `aspect-square` sized it to the grid TRACK width
              // (~2.5× a day button), stretching every week row that carries
              // leading/trailing padding (months not starting on the week's
              // first day rendered with phantom tall rows).
              <span key={`b${wi}-${ci}`} aria-hidden />
            ) : (
              renderCell(cell, nav(cell.iso))
            ),
          )}
        </div>
      ))}
    </div>
  );
}

/* ── DatePicker ──────────────────────────────────────────────────────────── */

export function DatePicker({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    value?: string | null;
    placeholder?: string | null;
    min?: string | null;
    max?: string | null;
    size?: 'sm' | 'md' | 'lg' | null;
    disabled?: boolean | null;
    format?: 'iso' | 'long' | 'short' | null;
    mode?: 'popover' | 'inline' | null;
    emitOnChange?: boolean | null;
    accent?: string | null;
    accentText?: string | null;
    borderColor?: string | null;
    bg?: string | null;
    mutedColor?: string | null;
    color?: string | null;
    radiusValue?: string | number | null;
    monthNames?: unknown;
    weekdayLabels?: unknown;
  };
  const [value, setValue] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = p.disabled === true;
  const format = (p.format as 'iso' | 'long' | 'short' | null) ?? 'long';
  const inline = p.mode === 'inline';
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  usePopoverDismiss(!inline && open, () => setOpen(false), wrapRef, triggerRef);

  // i18n overrides (length-validated; fall back to English). The field is always
  // Monday-first, so weekday labels are validated as Monday-first.
  const monthNames = i18nLabels(p.monthNames, 12, MONTH_NAMES);
  const weekdays = i18nLabels(p.weekdayLabels, 7, WEEKDAYS_MON);

  // Displayed month derives from the value (chevron nav overrides until the
  // value changes again).
  const seed = isoToYearMonth(value) ?? fallbackYm();
  const [ym, setYm] = useDisplayMonth(seed);
  const grid = buildMonth(ym, 'monday', { monthNames, weekdays });
  const styles = styleVars(
    { var: '--fr-cal-accent', value: p.accent, kind: 'color' },
    { var: '--fr-cal-accent-fg', value: p.accentText, kind: 'color' },
    { var: '--fr-cal-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-cal-bg', value: p.bg, kind: 'color' },
    { var: '--fr-cal-muted', value: p.mutedColor, kind: 'color' },
    // base text: day numbers, month title, and the chosen value in the field.
    { var: '--fr-cal-fg', value: p.color, kind: 'color' },
    { var: '--fr-cal-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
  );

  const min = typeof p.min === 'string' ? p.min : null;
  const max = typeof p.max === 'string' ? p.max : null;
  const outOfRange = (iso: string) => (min != null && iso < min) || (max != null && iso > max);

  const fieldText = value ? formatIso(value, format, monthNames) : p.placeholder ?? 'Select a date';
  const fieldInner = (
    <>
      <span className="text-[var(--fr-cal-muted,var(--color-muted-foreground))]" aria-hidden>
        <Icon name="calendar" size={16} />
      </span>
      {/* truncate EARNED: fieldRecipe fixes the box height per size enum
          (h-8/h-10/h-12), so this is a genuine single-line control — a wrapped
          date would paint through its own border. The content is a formatted
          date, and the field self-caps at max-w-xs per the width law, which is
          comfortably wider than any `format` output. */}
      <span className={cn('flex-1 break-words', !value && '[color:var(--fr-cal-muted,var(--color-muted-foreground))]')} title={fieldText}>
        {fieldText}
      </span>
    </>
  );
  // The panel's DOM id — what the popover trigger's `aria-expanded` expanded.
  // Carried in inline mode too (no trigger there, but the id stays stable).
  // Instance-unique: a `repeat` re-renders this element once per row reusing one
  // spec id, so a spec-id-only id aimed every row's trigger at row one's panel.
  const panelId = useAriaId('datepicker', element)();
  // Panel border completes the "picker chrome border" group: it reads the SAME
  // borderColor channel as the field box (matching the standalone Calendar).
  const panel = (
    <div
      id={panelId}
      role={inline ? undefined : 'dialog'}
      aria-label={inline ? undefined : 'Choose a date'}
      className={cn(
        'w-full [border-radius:var(--fr-cal-radius,var(--radius-frayme))] border [border-color:var(--fr-cal-border,var(--color-border))] p-2 [background:var(--fr-cal-bg,var(--color-card))]',
        inline ? 'max-w-sm' : 'absolute top-full left-0 z-30 mt-1 shadow-lg',
      )}
    >
      <MonthHeader title={grid.title} onPrev={() => setYm(grid.prevYm)} onNext={() => setYm(grid.nextYm)} accented={p.accent != null} />
      <WeekdayHeader weekdays={grid.weekdays} size={size} />
      <DayGrid
        grid={grid}
        size={size}
        // The tab stop anchors on the chosen day so opening the picker lands the
        // keyboard on the current value, not on the 1st of the month.
        preferredIso={value}
        isDisabled={outOfRange}
        renderCell={(cell, nav) => {
          const selected = value === cell.iso;
          const muted = outOfRange(cell.iso);
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={formatIso(cell.iso, 'long')}
              disabled={muted}
              {...nav}
              className={cn(dayBtn({ size, state: muted ? 'muted' : selected ? 'selected' : 'default', accentHover: p.accent != null }))}
              onClick={() => {
                if (muted) return;
                setValue(cell.iso);
                // A day pick is a DISCRETE deliberate selection (not a keystroke
                // stream) → always emit `select` (never silenced by emitOnChange),
                // matching Calendar. `change` stays gated for the value stream.
                emitWith('select', { value: cell.iso });
                if (p.emitOnChange !== false) emitWith('change', { value: cell.iso });
                // Selection completes the popover interaction.
                if (!inline) {
                  setOpen(false);
                  triggerRef.current?.focus();
                }
              }}
            >
              {cell.day}
            </button>
          );
        }}
      />
    </div>
  );

  if (inline) {
    return (
      <div className="inline-flex w-full max-w-xs flex-col gap-2" style={styles}>
        <div className={cn(fieldRecipe({ size, disabled }))} aria-disabled={disabled || undefined}>
          {fieldInner}
        </div>
        {!disabled && panel}
      </div>
    );
  }
  return (
    <div ref={wrapRef} className="relative inline-flex w-full max-w-xs flex-col" style={styles}>
      <button
        type="button"
        ref={triggerRef}
        className={cn(fieldRecipe({ size, disabled }), !disabled && triggerAffordance)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // Named only while the panel is IN the document — the mount condition
        // below is repeated verbatim, not approximated. `aria-expanded` stays in
        // both states (the control IS a disclosure either way), but a closed
        // trigger that still points `aria-controls` at an unmounted panel sends a
        // screen-reader user who follows the reference nowhere at all, which is
        // strictly worse than the omission ARIA permits (aria-controls is only
        // RECOMMENDED for disclosure). Same rule as the Toggletip and the ai-flow
        // headers.
        aria-controls={!disabled && open ? panelId : undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {fieldInner}
      </button>
      {!disabled && open && panel}
    </div>
  );
}

/* ── DateRangePicker ─────────────────────────────────────────────────────── */

export function DateRangePicker({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    startValue?: string | null;
    endValue?: string | null;
    presets?: Array<{ label?: string; start?: string; end?: string }> | null;
    min?: string | null;
    max?: string | null;
    size?: 'sm' | 'md' | 'lg' | null;
    disabled?: boolean | null;
    mode?: 'popover' | 'inline' | null;
    emitOnChange?: boolean | null;
    accent?: string | null;
    accentText?: string | null;
    borderColor?: string | null;
    bg?: string | null;
    mutedColor?: string | null;
    color?: string | null;
    radiusValue?: string | number | null;
    monthNames?: unknown;
    weekdayLabels?: unknown;
  };
  const [start, setStart] = useBoundProp<string>(p.startValue ?? undefined, bindings?.startValue);
  const [end, setEnd] = useBoundProp<string>(p.endValue ?? undefined, bindings?.endValue);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = p.disabled === true;
  const presets = Array.isArray(p.presets) ? p.presets : [];
  const inline = p.mode === 'inline';
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  usePopoverDismiss(!inline && open, () => setOpen(false), wrapRef, triggerRef);

  // i18n overrides (length-validated; fall back to English). Grid is Monday-first.
  const monthNames = i18nLabels(p.monthNames, 12, MONTH_NAMES);
  const weekdays = i18nLabels(p.weekdayLabels, 7, WEEKDAYS_MON);

  // Displayed month derives from the range (chevron nav overrides until the
  // range changes again).
  const seed = isoToYearMonth(start) ?? isoToYearMonth(end) ?? fallbackYm();
  const [ym, setYm] = useDisplayMonth(seed);
  const grid = buildMonth(ym, 'monday', { monthNames, weekdays });
  const styles = styleVars(
    { var: '--fr-cal-accent', value: p.accent, kind: 'color' },
    { var: '--fr-cal-accent-fg', value: p.accentText, kind: 'color' },
    { var: '--fr-cal-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-cal-bg', value: p.bg, kind: 'color' },
    { var: '--fr-cal-muted', value: p.mutedColor, kind: 'color' },
    // base text: day numbers, month title, and the chosen value in the field.
    { var: '--fr-cal-fg', value: p.color, kind: 'color' },
    { var: '--fr-cal-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
  );

  const min = typeof p.min === 'string' ? p.min : null;
  const max = typeof p.max === 'string' ? p.max : null;
  const outOfRange = (iso: string) => (min != null && iso < min) || (max != null && iso > max);

  // Range completion closes the popover (the Escape/outside paths live in
  // usePopoverDismiss).
  const closeOnComplete = () => {
    if (!inline) {
      setOpen(false);
      triggerRef.current?.focus();
    }
  };
  const handleDay = (iso: string) => {
    // First click (or a complete range exists) → fresh start, clear end.
    if (!start || (start && end)) {
      setStart(iso);
      setEnd('');
      // A day pick is a discrete selection → always `select`; `change` stays gated.
      emitWith('select', { startValue: iso, endValue: null });
      if (p.emitOnChange !== false) emitWith('change', { startValue: iso, endValue: null });
      return;
    }
    // Second click → set end, swapping if it lands before the start.
    if (isoLte(start, iso)) {
      setEnd(iso);
      emitWith('select', { startValue: start, endValue: iso });
      if (p.emitOnChange !== false) emitWith('change', { startValue: start, endValue: iso });
    } else {
      setEnd(start);
      setStart(iso);
      emitWith('select', { startValue: iso, endValue: start });
      if (p.emitOnChange !== false) emitWith('change', { startValue: iso, endValue: start });
    }
    closeOnComplete();
  };

  const fieldText =
    start && end
      ? `${formatIso(start, 'short')} – ${formatIso(end, 'short')}`
      : start
        ? `${formatIso(start, 'short')} – …`
        : 'Select a range';

  const presetColumn = presets.length > 0 && (
    <div
      // A preset label is written by the spec and is often a full range
      // ("Next fortnight · Mon 24 Aug – Sun 6 Sep"), so a fixed column width
      // makes the buttons overflow it and collide with the month grid beside
      // them. The column sizes to its labels within a bound instead.
      className={cn(
        'flex shrink-0 flex-row flex-wrap gap-1.5',
        // A preset label carries a whole range, so the column takes the width
        // its labels need (bounded) instead of ellipsising the range away.
        'w-auto min-w-40 max-w-72 flex-col flex-nowrap',
      )}
      role="group"
      aria-label="Quick ranges"
    >
      {presets.map((preset, i) => {
        const label = typeof preset?.label === 'string' ? preset.label : `Range ${i + 1}`;
        const s = typeof preset?.start === 'string' ? preset.start : null;
        const e = typeof preset?.end === 'string' ? preset.end : null;
        return (
          // The preset column sits directly beside the themed grid, so it
          // consumes the SAME channels: border → borderColor, label →
          // color, focus ring → accent, corner → radiusValue, fill → bg
          // (transparent fallback keeps the unset chip byte-identical), and
          // the hover follows the accent-or-token pattern the day cells use.
          <button
            key={`${label}-${i}`}
            type="button"
            disabled={disabled || s == null || e == null}
            className={cn(
              // break-words, not truncate: the comment above says this column
              // exists so a preset's whole range survives, but the button was
              // still clipping it — "Next fortnight · Mon 24 Aug – Sun 6 Sep"
              // ellipsised away exactly the dates the label is for. The button
              // has no fixed height (px-2.5 py-1.5), so it grows a line instead.
              //
              // This chip is the ONE piece of the date family whose ink inherits,
              // and its `[background:var(--fr-cal-bg,TRANSPARENT)]` is why: every
              // other surface here paints var(--fr-cal-bg,var(--color-card)) — the
              // field box, the DatePicker panel, the Calendar root, the popover
              // shell, the inline month grid — so their text sits on an opaque
              // slab that an authored Card's `bg` never re-points (Card sets
              // --fr-card-bg) and keeps --color-foreground. In INLINE mode this
              // column has no such shell above it, so an authored
              // `Card { bg:"#12161f", color:"#e2e6f0" }` showed through the chip
              // while the token reset its label to rgb(24,24,27) — contrast 1.02.
              // In POPOVER mode
              // the chip sits on the dialog shell's card fill, which now declares
              // that same ink itself (see the shell below), so `currentColor`
              // resolves there to exactly the token it used to name — that branch
              // does not move. Top level is unchanged either way: frayme.css
              // points `.frayme-root { color }` and --color-foreground at
              // --frayme-fg.
              'min-w-0 max-w-full break-words [border-radius:var(--fr-cal-radius,var(--radius-frayme))] border [border-color:var(--fr-cal-border,var(--color-border))] [background:var(--fr-cal-bg,transparent)] px-2.5 py-1.5 text-left text-sm text-[color:var(--fr-cal-fg,currentColor)] focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:var(--fr-cal-accent,var(--fr-accent))] disabled:cursor-not-allowed disabled:opacity-60',
              p.accent != null
                ? 'hover:[background:color-mix(in_srgb,var(--fr-cal-accent)_10%,transparent)]'
                : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
            )}
            onClick={() => {
              if (s == null || e == null) return;
              setStart(s);
              setEnd(e);
              setYm(isoToYearMonth(s) ?? ym);
              emitWith('select', { startValue: s, endValue: e });
              if (p.emitOnChange !== false) emitWith('change', { startValue: s, endValue: e });
              // A preset lands a complete range in one click.
              closeOnComplete();
            }}
            title={label}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  const monthGrid = (
    // Panel border completes the "picker chrome border" group (same
    // borderColor channel as the field box, matching Calendar).
    <div
      className={cn(
        'w-full [border-radius:var(--fr-cal-radius,var(--radius-frayme))] p-2',
        // In popover mode the dialog shell already carries the chrome border +
        // background; a second border here would double it.
        inline
          // A definite width, not a percentage: inside a content-hugging row a
          // percentage resolves against fit-content and the month grid collapses
          // to its min-content, cramping every day cell.
          ? 'sm:w-80 max-w-full border [border-color:var(--fr-cal-border,var(--color-border))] [background:var(--fr-cal-bg,var(--color-card))]'
          : 'w-72 shrink-0',
      )}
    >
      <MonthHeader title={grid.title} onPrev={() => setYm(grid.prevYm)} onNext={() => setYm(grid.nextYm)} accented={p.accent != null} />
      <WeekdayHeader weekdays={grid.weekdays} size={size} />
      <DayGrid
        grid={grid}
        size={size}
        // Anchor on the range's start (the end when only that is set) so the
        // keyboard opens on the range the field is showing.
        preferredIso={start || end}
        isDisabled={outOfRange}
        renderCell={(cell, nav) => {
          const muted = outOfRange(cell.iso);
          const isEndpoint = cell.iso === start || cell.iso === end;
          const inRange =
            !!start && !!end && isoLte(start, cell.iso) && isoLte(cell.iso, end) && !isEndpoint;
          const state = muted ? 'muted' : isEndpoint ? 'selected' : inRange ? 'inRange' : 'default';
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              aria-selected={isEndpoint}
              aria-label={formatIso(cell.iso, 'long')}
              disabled={muted}
              {...nav}
              className={cn(dayBtn({ size, state, accentHover: p.accent != null }))}
              onClick={() => {
                if (muted) return;
                handleDay(cell.iso);
              }}
            >
              {cell.day}
            </button>
          );
        }}
      />
    </div>
  );

  const fieldInner = (
    <>
      <span className="text-[var(--fr-cal-muted,var(--color-muted-foreground))]" aria-hidden>
        <Icon name="calendar" size={16} />
      </span>
      {/* truncate EARNED, same contract as DatePicker's field: fieldRecipe fixes
          the box height (h-8/h-10/h-12). The range text is built from the SHORT
          format on both ends ("12 Sep – 19 Sep"), so it fits the max-w-xs field
          with room to spare. */}
      <span className={cn('flex-1 break-words', !start && '[color:var(--fr-cal-muted,var(--color-muted-foreground))]')} title={fieldText}>{fieldText}</span>
    </>
  );
  // The popover's DOM id — what the trigger's `aria-expanded` expanded. Inline
  // mode has no single panel (presets + grid sit side by side) and no trigger.
  // Instance-unique for the same repeat reason as DatePicker above.
  const panelId = useAriaId('daterange', element)();

  if (inline) {
    // The field and the month grid share a top line: the field stacks over its
    // presets in a left column, the grid sits beside them. flex-wrap rather than
    // a `sm:` breakpoint — the renderer is host-agnostic, so a VIEWPORT query is
    // the wrong instrument (in a 608px host panel it simply never fires).
    return (
      <div className="flex w-full flex-wrap items-start gap-2" style={styles}>
        {/* min(14rem,100%): a hard 14rem floor is a floor even when the host is
            narrower than 14rem, which is how a preset column walks off a phone.
            The floor holds wherever there is room for it and yields where there
            is not. */}
        <div className="flex min-w-[min(14rem,100%)] flex-col gap-2">
          <div className={cn(fieldRecipe({ size, disabled }), 'max-w-xs')} aria-disabled={disabled || undefined}>
            {fieldInner}
          </div>
          {!disabled && presetColumn}
        </div>
        {!disabled && monthGrid}
      </div>
    );
  }
  return (
    <div ref={wrapRef} className="relative inline-flex w-full max-w-xs flex-col" style={styles}>
      <button
        type="button"
        ref={triggerRef}
        className={cn(fieldRecipe({ size, disabled }), !disabled && triggerAffordance)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // Mount-gated for the same reason as DatePicker above: the popover below
        // renders on `!disabled && open`, so a closed trigger naming `panelId`
        // would reference an id that is not in the document.
        aria-controls={!disabled && open ? panelId : undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {fieldInner}
      </button>
      {!disabled && open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose a date range"
          // The shell PAINTS a fill, so it also declares the ink that partners it:
          // the preset chips inside are transparent and now inherit (see their
          // note above), and without this they would inherit from outside the
          // picker — an authored dark Card's near-white ink on this light
          // --color-card slab. The declared value is the same chain the chips used
          // to name inline, so this branch is unchanged in computed colour, at the
          // top level and inside an authored container alike.
          className="absolute top-full left-0 z-30 mt-1 flex w-max max-w-[calc(100vw-2rem)] flex-wrap items-start gap-2 [border-radius:var(--fr-cal-radius,var(--radius-frayme))] border [border-color:var(--fr-cal-border,var(--color-border))] p-2 shadow-lg [background:var(--fr-cal-bg,var(--color-card))] text-[color:var(--fr-cal-fg,var(--color-foreground))]"
        >
          {presetColumn}
          {monthGrid}
        </div>
      )}
    </div>
  );
}

/* ── Calendar ────────────────────────────────────────────────────────────── */

export function Calendar({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    month?: string | null;
    value?: string | null;
    today?: string | null;
    events?: Array<{ date?: string; label?: string; tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null; color?: string | null }> | null;
    view?: 'month' | null;
    selectable?: boolean | null;
    emitOnChange?: boolean | null;
    weekStartsOn?: 'sunday' | 'monday' | null;
    accent?: string | null;
    accentText?: string | null;
    borderColor?: string | null;
    bg?: string | null;
    mutedColor?: string | null;
    color?: string | null;
    radiusValue?: string | number | null;
    monthNames?: unknown;
    weekdayLabels?: unknown;
    size?: 'sm' | 'md' | 'lg' | null;
  };
  const [value, setValue] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const selectable = p.selectable ?? true;
  const weekStartsOn = (p.weekStartsOn as 'sunday' | 'monday' | null) ?? 'monday';
  const events = Array.isArray(p.events) ? p.events : [];

  // i18n overrides (length-validated; fall back to English). The weekday labels
  // are validated against whichever first-day order `weekStartsOn` selects.
  const monthNames = i18nLabels(p.monthNames, 12, MONTH_NAMES);
  const weekdays = i18nLabels(
    p.weekdayLabels,
    7,
    weekStartsOn === 'monday' ? WEEKDAYS_MON : WEEKDAYS_SUN,
  );

  // Bucket events by ISO date (validated strings only). A per-event `color`
  // override is re-validated here (defence in depth); an invalid value drops to
  // null so the tone class wins.
  const byDate = new Map<string, Array<{ label: string; tone: 'neutral' | 'success' | 'warning' | 'critical' | 'info'; color: string | null }>>();
  for (const ev of events) {
    const date = typeof ev?.date === 'string' ? ev.date : null;
    if (date == null) continue;
    const tone = ev?.tone ?? 'neutral';
    const label = typeof ev?.label === 'string' ? ev.label : '';
    const color = ev?.color != null ? safeColor(ev.color) : null;
    const list = byDate.get(date) ?? [];
    list.push({ label, tone, color });
    byDate.set(date, list);
  }

  const seed = (typeof p.month === 'string' ? p.month : null) ?? isoToYearMonth(value) ?? fallbackYm();
  const [ym, setYm] = useBoundProp<string>(seed, (bindings as { month?: unknown })?.month);
  const grid = buildMonth(ym ?? seed, weekStartsOn, { monthNames, weekdays });
  // the author-supplied "today" date (never a wall-clock read — the
  // deterministic contract holds). Only a well-formed YYYY-MM-DD marks a cell.
  const todayIso = typeof p.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.today) ? p.today : null;
  const styles = styleVars(
    { var: '--fr-cal-accent', value: p.accent, kind: 'color' },
    { var: '--fr-cal-accent-fg', value: p.accentText, kind: 'color' },
    { var: '--fr-cal-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-cal-bg', value: p.bg, kind: 'color' },
    { var: '--fr-cal-muted', value: p.mutedColor, kind: 'color' },
    // base text: day numbers, month title, and the chosen value in the field.
    { var: '--fr-cal-fg', value: p.color, kind: 'color' },
    { var: '--fr-cal-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
  );

  return (
    <div className="inline-flex w-full max-w-sm flex-col [border-radius:var(--fr-cal-radius,var(--radius-frayme))] border [border-color:var(--fr-cal-border,var(--color-border))] [background:var(--fr-cal-bg,var(--color-card))] p-3" style={styles}>
      <MonthHeader title={grid.title} onPrev={() => setYm(grid.prevYm)} onNext={() => setYm(grid.nextYm)} accented={p.accent != null} />
      <WeekdayHeader weekdays={grid.weekdays} size={size} />
      <DayGrid
        grid={grid}
        size={size}
        // No `isDisabled`: a Calendar never renders an unfocusable day (there is
        // no min/max here, and `selectable:false` cells are read-only, NOT
        // disabled — they still carry the event count in their aria-label and so
        // are exactly what a keyboard user needs to reach).
        preferredIso={value ?? todayIso}
        renderCell={(cell, nav) => {
          const dayEvents = byDate.get(cell.iso) ?? [];
          const dots = dayEvents.slice(0, 3);
          // overflow beyond 3 events → a 4th muted "more" dot cue so the
          // sighted user gets the same "there are more" signal the aria-label gives.
          const overflow = dayEvents.length - dots.length;
          const selected = value === cell.iso;
          // mark "today" with an inset ring (NOT the selected fill; when a
          // day is BOTH today and selected, the selected treatment wins).
          const isToday = todayIso != null && cell.iso === todayIso && !selected;
          const base = formatIso(cell.iso, 'long');
          const ariaLabel = dayEvents.length > 0 ? `${base}, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : base;
          const todayRing = isToday && 'ring-1 ring-inset [--tw-ring-color:var(--fr-cal-accent,var(--fr-accent))]';

          const content = (
            <>
              <span>{cell.day}</span>
              {dots.length > 0 && (
                <span className="absolute bottom-1 flex gap-0.5" aria-hidden>
                  {dots.map((d, di) => {
                    // On a selected day the dots read against the accent fill via
                    // currentColor. Otherwise a per-event `color` (validated) wins
                    // over the tone class; absent → the tone class.
                    const useOverride = !selected && d.color != null;
                    return (
                      <span
                        key={di}
                        className={cn('h-1 w-1 rounded-full', selected ? 'bg-current opacity-80' : useOverride ? undefined : toneDot[d.tone])}
                        style={useOverride ? { backgroundColor: d.color as string } : undefined}
                      />
                    );
                  })}
                  {overflow > 0 && (
                    <span className={cn('ml-px h-1 w-1 rounded-full', selected ? 'bg-current opacity-60' : '[background:var(--fr-cal-muted,var(--color-muted-foreground))]')} />
                  )}
                </span>
              )}
            </>
          );

          if (!selectable) {
            return (
              // `pointer-events-none` still says "not clickable" to a mouse, but
              // the cell is now KEYBOARD-reachable: it is a read-only gridcell,
              // not a disabled one, and its aria-label is the only place the
              // event count is announced.
              <div
                key={cell.iso}
                role="gridcell"
                aria-label={ariaLabel}
                aria-selected={selected || undefined}
                {...nav}
                className={cn(dayBtn({ size, state: selected ? 'selected' : 'default', accentHover: p.accent != null }), todayRing, 'pointer-events-none')}
              >
                {content}
              </div>
            );
          }
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={ariaLabel}
              {...nav}
              className={cn(dayBtn({ size, state: selected ? 'selected' : 'default', accentHover: p.accent != null }), todayRing)}
              onClick={() => {
                setValue(cell.iso);
                emitWith('select', { value: cell.iso });
                if (p.emitOnChange !== false) emitWith('change', { value: cell.iso });
              }}
            >
              {content}
            </button>
          );
        }}
      />
    </div>
  );
}
