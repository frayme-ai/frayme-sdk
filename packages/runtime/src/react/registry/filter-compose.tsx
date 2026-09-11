'use client';
import { useRef, useState, useEffect, type ReactNode, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { useAriaId } from './_aria.js';
import { Icon, hasIcon } from './icons.js';
import { safeUrl, safeImageSrc } from './url-safety.js';

/* Catalog group (filter-compose): FilterBar, FacetList, FilterPanel,
 * RichComposer.
 *
 * Same truly-dynamic contract as the shipped catalog:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (a model-named color) NEVER become classes — they land in
 *     `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC arbitrary
 *     `var(--fr-…, var(--color-…))` utilities WITH a token fallback. The class set
 *     stays a closed build-time set (no JIT, no injection); `styleVars`
 *     re-validates + omits any failing/absent value so the token fallback wins.
 *
 * INTERACTIVITY (rule #9 — reactive WITHOUT a binding):
 *   - FilterBar: removed chips = internal `useState` set; search = `useLocalOrBound`.
 *   - FacetList: selected values = `useLocalOrBound`; show-more = internal `useState`.
 *   - FilterPanel: per-section collapse = internal `useState`; selected = local.
 *   - RichComposer: text = `useLocalOrBound`; toolbar wraps the textarea selection
 *     in MARKDOWN markers via refs/state — NO contentEditable, NO HTML, NO Lexical.
 * `emit(...)` is an ADDITIONAL host signal in every case, never the only effect.
 *
 * Icons resolve against the closed `icons.ts` registry (guarded by `hasIcon`;
 * unknown/null → nothing). A toolbar control ALWAYS draws a mark: a registry
 * glyph, or — for a format the closed registry carries no glyph for — a
 * letterform typeset to that glyph's optical mass. Never bare punctuation, never
 * an unstyled string. All bodies render as plain auto-escaped React children. */

/* ── shared sizing menus ──────────────────────────────────────────────────── */

const CTRL_PAD: Record<string, string> = { sm: 'h-7 text-[0.8125rem]', md: 'h-9 text-sm', lg: 'h-11 text-[0.9375rem]' };
const sizeOf = (v: unknown): 'sm' | 'md' | 'lg' => (v === 'sm' || v === 'lg' ? v : 'md');

/** Resolve a glyph-override prop against the closed registry, falling back to a
 *  default glyph name when the supplied name is absent/unknown (never raw SVG). */
const resolveGlyph = (name: string | null | undefined, dflt: string): string =>
  typeof name === 'string' && hasIcon(name) ? name : dflt;

/* ── shared ARIA ids ──────────────────────────────────────────────────────── */

/* This file used to mint its own trigger↔region ids from the SPEC ID alone. The
 * reasoning ("unique within a spec — one spec id per element") holds for a flat
 * spec and breaks under `repeat`: json-render re-renders one element per row
 * reusing a single `__fid`, so two rows of a repeated FacetList/FilterPanel got
 * IDENTICAL ids and row two's header pointed a screen reader at row one's
 * panel. That is measured, not theoretical — aria-repeat-ids.test.tsx pins it
 * for the pairings that were migrated first. `useAriaId` (registry/_aria.ts)
 * folds React's per-INSTANCE `useId()` into the same string and carries the
 * SSR-divergence argument that motivated the local helper: trigger and panel are
 * rendered by one component reading one value, so a divergence moves both sides
 * together and the pairing cannot break. */

/* ── FilterBar ────────────────────────────────────────────────────────────── */

const filterBarWrap = cva(
  'flex w-full flex-wrap items-center gap-2 [--fr-filterbar-accent:var(--fr-accent)]',
);

export function FilterBar({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    filters?: Array<{ label?: string; value?: string; removable?: boolean | null }> | null;
    searchPlaceholder?: string | null;
    searchValue?: string | null;
    searchLabel?: string | null;
    showClear?: boolean | null;
    clearLabel?: string | null;
    removeLabel?: string | null;
    removeIcon?: string | null;
    size?: string | null;
    accent?: string | null;
    mutedColor?: string | null;
    activeFilters?: string[] | null;
    emitOnChange?: boolean | null;
  };
  const filters = Array.isArray(p.filters)
    ? p.filters.filter((f): f is { label?: string; value?: string; removable?: boolean | null } => f != null && typeof f === 'object')
    : [];
  const size = sizeOf(p.size);
  const emitWith = useIntrinsicEmit(emit, element);

  // INTERNAL removed-set — chips drop live without any binding (drives the render).
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  // Search value — two-way when bound, local otherwise.
  const [search, setSearch] = useBoundProp<string>(p.searchValue ?? '', bindings?.searchValue);
  // Active-filter set — mirrored into (bindable) state on each mutation so an
  // external Apply button can read the whole bar via spec.state. The `removed`
  // set still drives the visible render; this only exposes the resolved value.
  const [, setActiveFilters] = useBoundProp<string[]>(
    Array.isArray(p.activeFilters) ? p.activeFilters : undefined,
    (bindings as { activeFilters?: unknown } | undefined)?.activeFilters,
  );

  const visible = filters
    .map((f, i) => ({ f, key: typeof f.value === 'string' ? f.value : `idx-${i}` }))
    .filter(({ key }) => !removed.has(key));
  const showClear = p.showClear !== false && (visible.length > 0 || (typeof search === 'string' && search.length > 0));

  // The full resolved bar state after a mutation — the current search text, every
  // removed chip value, and the chip values still active. Computed from in-scope
  // values (never a stale render snapshot) so `change` always carries the whole
  // picture, not a single delta the agent must accumulate.
  const barState = (removedSet: Set<string>, query: string) => ({
    query,
    removed: [...removedSet],
    activeFilters: filters
      .map((f, i) => (typeof f.value === 'string' ? f.value : `idx-${i}`))
      .filter((k) => !removedSet.has(k)),
  });

  const removeChip = (key: string): void => {
    const next = new Set(removed);
    next.add(key);
    setRemoved(next);
    const state = barState(next, typeof search === 'string' ? search : '');
    // Keep the bound active-filter set live regardless of the emit gate.
    setActiveFilters(state.activeFilters);
    emitWith('dismiss', { value: key });
    if (p.emitOnChange !== false) emitWith('change', state);
  };
  const clearAll = (): void => {
    const all = new Set(filters.map((f, i) => (typeof f.value === 'string' ? f.value : `idx-${i}`)));
    setRemoved(all);
    setSearch('');
    const state = barState(all, '');
    setActiveFilters(state.activeFilters);
    emitWith('dismiss', { all: true });
    if (p.emitOnChange !== false) emitWith('change', state);
  };
  // Submit path — always fires regardless of the emit gate; carries the full bar.
  const applyBar = (): void => {
    emitWith('commit', barState(removed, typeof search === 'string' ? search : ''));
  };

  return (
    <div
      className={cn(filterBarWrap())}
      style={styleVars(
        { var: '--fr-filterbar-accent', value: p.accent, kind: 'color' },
        { var: '--fr-filterbar-muted', value: p.mutedColor, kind: 'color' },
      )}
    >
      {visible.map(({ f, key }) => {
        const removable = f.removable !== false;
        return (
          <span
            key={key}
            className={cn(
              'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-medium',
              // Mutually-exclusive fill: NEUTRAL resting
              // chip (bg-muted + text-foreground) when accent is unset; a
              // 14%-accent-tint fill/text ONLY when the model names an accent —
              // never co-located (the arbitrary color-mix background/text would not
              // dedupe against bg-muted/text-foreground).
              p.accent != null
                ? '[background:color-mix(in_srgb,var(--fr-filterbar-accent)_14%,transparent)] [color:var(--fr-filterbar-accent)]'
                : 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-[color:var(--fr-surface-fg,var(--color-foreground))]',
            )}
          >
            {/* break-words, not truncate: a filter chip is NOT a one-token badge —
                it carries the applied criterion ("Created after 12 Aug"), and a
                reader who cannot see what is filtered cannot trust the results. The
                bar is flex-wrap and the chip caps at max-w-full, so a long criterion
                takes a second line inside the pill. Leaf text carries no `min-w-0`:
                the criterion's longest word is the width the chip must keep, and
                zeroing that floor let the pill collapse to a per-character sliver.
                `break-words` still breaks a token wider than the pill. */}
            <span className="break-words" title={f.label ?? f.value ?? undefined}>{f.label ?? f.value ?? ''}</span>
            {removable && (
              <button
                type="button"
                /* The drawn X stays 16px — a 24px disc inside a `py-1` pill would
                   redesign the chip (measured: the pill grows 27px → 32px) and
                   every existing filter chip would move. So the TARGET is
                   grown instead, with a transparent 24px ::before centred on the
                   button: the same trick Switch uses for its 16-20px track (see
                   `switchTrack` in forms.tsx), and the one WCAG 2.5.8 is written
                   to accept — the criterion measures the target, not the ink.
                   Measured before: 16×16, a plain failure in every font (the
                   inline-target exemption does not apply — a flex item is
                   blockified, so the control is not constrained by a line box).
                   Absolutely positioned, so it adds no height and shifts nothing;
                   the 4px it overhangs on each side lands inside the pill's own
                   px-2.5 padding and over non-interactive label text. */
                className="relative inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 opacity-70 transition-opacity before:absolute before:left-1/2 before:top-1/2 before:h-6 before:w-6 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]"
                aria-label={`${p.removeLabel ?? 'Remove'} ${f.label ?? f.value ?? 'filter'}`}
                onClick={() => removeChip(key)}
              >
                <Icon name={resolveGlyph(p.removeIcon, 'x')} size={13} />
              </button>
            )}
          </span>
        );
      })}
      {/* The wrapper's text colour reads the muted var (group form — the token is
          the fallback) so the leading search icon travels WITH the placeholder +
          clear-all when mutedColor is set. */}
      <label className={cn('inline-flex min-w-[8rem] flex-1 items-center gap-2 rounded-frayme border border-border bg-background px-2.5 text-[color:var(--fr-filterbar-muted,var(--color-muted-foreground))] focus-within:ring-2 focus-within:[--tw-ring-color:var(--fr-filterbar-accent,var(--fr-accent))]', CTRL_PAD[size])}>
        <span className="shrink-0" aria-hidden>
          <Icon name="search" size={15} />
        </span>
        <input
          type="text"
          role="searchbox"
          aria-label={p.searchPlaceholder ?? p.searchLabel ?? 'Search'}
          className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:[color:var(--fr-filterbar-muted,var(--color-muted-foreground))]"
          placeholder={p.searchPlaceholder ?? 'Search…'}
          value={typeof search === 'string' ? search : ''}
          onChange={(e) => {
            setSearch(e.target.value);
            if (p.emitOnChange !== false) {
              emitWith('search', { query: e.target.value });
              emitWith('change', barState(removed, e.target.value));
            }
          }}
        />
      </label>
      {showClear && (
        <button
          type="button"
          // min-h-6 for the same MEASURED reason as FacetList's show-more: `py-1`
          // + an arbitrary `text-[0.8125rem]` (no bundled line-height) inside a
          // bar that sets no `text-*` class leaves the height to the font's
          // `normal` line box — 24px in the default `ui-sans-serif, system-ui`
          // stack, 23px in Arial/Helvetica/Georgia. A floor, not a fixed height.
          // `hover:text-inherit` for the same reason as FacetList's show-more:
          // this hover paints no fill, so the foreground token hid the control on
          // an authored surface exactly when it was pointed at.
          className="inline-flex min-h-6 shrink-0 cursor-pointer items-center rounded-frayme border-0 bg-transparent px-2 py-1 text-[0.8125rem] font-medium [color:var(--fr-filterbar-muted,var(--color-muted-foreground))] transition-colors hover:text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]"
          aria-label={p.clearLabel ?? 'Clear all'}
          onClick={clearAll}
        >
          {p.clearLabel ?? 'Clear all'}
        </button>
      )}
      {/* Submit path — commits the full resolved bar so an agent can read the whole
          filter set on demand (not only via the per-keystroke change stream). */}
      <button
        type="button"
        className={cn(
          // quiet defaults: neutral high-contrast fill (foreground/card) by
          // default; a supplied `accent` still fills brand. Focus ring stays on the
          // accent channel (a thin indicator, not a slab).
          'inline-flex shrink-0 cursor-pointer items-center rounded-frayme border-0 px-3 font-medium [background:var(--fr-filterbar-accent,var(--color-foreground))] text-card transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:var(--fr-filterbar-accent,var(--fr-accent))]',
          CTRL_PAD[size],
        )}
        aria-label="Apply filters"
        onClick={applyBar}
      >
        Apply
      </button>
    </div>
  );
}

/* ── facet checkbox row (shared by FacetList + FilterPanel) ───────────────── */

type FacetT = { label?: string; value?: string; count?: number | null; checked?: boolean | null };

/** Literal per-caller checkbox-fill classes. Tailwind's static scanner never
 *  sees an interpolated `[background:var(${accentVar},…)]`, so no rule gets
 *  compiled for it — the class must exist as a literal string in source. */
const FACET_ACCENT_BG: Record<string, string> = {
  // quiet defaults: a checked facet's box is neutral high-contrast
  // (foreground) by default, not a brand slab; a supplied `accent` still fills brand.
  '--fr-facetlist-accent': '[background:var(--fr-facetlist-accent,var(--color-foreground))]',
  '--fr-filterpanel-accent': '[background:var(--fr-filterpanel-accent,var(--color-foreground))]',
};

/** The check-glyph colour ON the accent fill — the `accentText` channel (the
 *  PromptInput/RichComposer pairing), token-defaulted so an unset value stays
 *  byte-identical to the on-fill text (`card`, pairing the neutral foreground fill).
 *  Same literal-per-caller rule as above. */
const FACET_ACCENT_TEXT: Record<string, string> = {
  '--fr-facetlist-accent': '[color:var(--fr-facetlist-accent-text,var(--color-card))]',
  '--fr-filterpanel-accent': '[color:var(--fr-filterpanel-accent-text,var(--color-card))]',
};

/** The row LABEL's resting ink — per caller, because the two callers stand on
 *  different surfaces and one shared `text-foreground` cannot be right on both.
 *  FilterPanel paints an opaque `bg-card` slab, so its ink must stay that token's
 *  partner. FacetList paints nothing: it borrows the container's surface, and
 *  inside an authored one (Card bg:#12161f color:#e2e6f0) the baked token
 *  repainted every label #18181b over navy — 1.02:1, text the colour of its own
 *  background. `color: inherit` follows the container and is byte-identical
 *  unwrapped (.frayme-root's colour and --color-foreground are both --frayme-fg).
 *  Same literal-per-caller rule as the two maps above. */
const FACET_LABEL_FG: Record<string, string> = {
  '--fr-facetlist-accent': 'text-inherit',
  '--fr-filterpanel-accent': 'text-foreground',
};

/** A labelled checkbox row with an optional result count. Pure presentation +
 *  an onToggle callback; the checked state is owned by the caller. */
function FacetRow({
  facet,
  checked,
  accentVar,
  mutedVar,
  onToggle,
  id,
}: {
  facet: FacetT;
  checked: boolean;
  accentVar: string;
  mutedVar: string;
  onToggle: () => void;
  /** Optional DOM id — set only where a show-more control has to name the rows
   *  its `aria-expanded` reveals. */
  id?: string;
}): ReactNode {
  const count = typeof facet.count === 'number' && Number.isFinite(facet.count) ? facet.count : null;
  return (
    <label id={id} className="flex cursor-pointer items-center gap-2.5 rounded-frayme px-1.5 py-1.5 text-sm hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/50">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={onToggle}
      />
      <span
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors peer-focus-visible:ring-2 peer-focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]',
          checked
            ? `border-transparent ${FACET_ACCENT_BG[accentVar] ?? ''} ${FACET_ACCENT_TEXT[accentVar] ?? '[color:var(--color-card)]'}`
            : 'border-border bg-background text-transparent',
        )}
        aria-hidden
      >
        <Icon name="check" size={12} />
      </span>
      {/* break-words, not truncate: the facet label IS the choice being made — a
          clipped one ("Ships to United King…") cannot be picked with confidence. The
          checkbox and the count beside it are shrink-0, so this span alone gives way
          and the row simply gets a line taller. `flex-1` stays (it is what pushes
          the count to the far edge); `min-w-0` does NOT — this is leaf text, and
          its longest word is the floor below which the label stops being readable
          at all. `break-words` handles the genuinely over-wide token. */}
      <span className={cn('flex-1 break-words', FACET_LABEL_FG[accentVar] ?? 'text-foreground')} title={facet.label ?? facet.value ?? undefined}>{facet.label ?? facet.value ?? ''}</span>
      {count != null && <span className={`shrink-0 text-[0.8125rem] tabular-nums [color:var(${mutedVar},var(--color-muted-foreground))]`}>{count}</span>}
    </label>
  );
}

/** Filter the facets array to safe objects + derive their stable keys. */
function safeFacets(raw: unknown): Array<{ facet: FacetT; key: string }> {
  const arr = Array.isArray(raw) ? raw.filter((f): f is FacetT => f != null && typeof f === 'object') : [];
  return arr.map((facet, i) => ({ facet, key: typeof facet.value === 'string' ? facet.value : `idx-${i}` }));
}

/* ── FacetList ────────────────────────────────────────────────────────────── */

export function FacetList({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title?: string | null;
    facets?: FacetT[] | null;
    selected?: string[] | null;
    max?: number | null;
    showMoreLabel?: string | null;
    showLessLabel?: string | null;
    accent?: string | null;
    accentText?: string | null;
    mutedColor?: string | null;
    emitOnChange?: boolean | null;
  };
  const facets = safeFacets(p.facets);
  const emitWith = useIntrinsicEmit(emit, element);
  // Seed the selection from explicit `selected` + any `checked` facets.
  const seeded = (() => {
    const set = new Set<string>(Array.isArray(p.selected) ? p.selected.filter((v) => typeof v === 'string') : []);
    for (const { facet, key } of facets) if (facet.checked === true) set.add(key);
    return Array.from(set);
  })();
  // Selection — two-way when bound, local otherwise.
  const [selected, setSelected] = useBoundProp<string[]>(seeded, bindings?.selected);
  const sel = Array.isArray(selected) ? selected : [];

  const max = typeof p.max === 'number' && Number.isFinite(p.max) ? Math.max(1, Math.trunc(p.max)) : null;
  // INTERNAL show-more — collapses a long list, live without a binding.
  const [expanded, setExpanded] = useState(false);
  const collapsed = max != null && facets.length > max && !expanded;
  const shown = collapsed ? facets.slice(0, max) : facets;
  // What show-more actually reveals: the rows past `max`. They are direct flex
  // items of the column (a wrapper would swallow the gap between them), so the
  // trigger names them as an ID LIST — aria-controls takes one. Keyed by the
  // index in `facets` (a facet `value` may repeat; `shown` is a head slice, so
  // the row index IS the facet index); `useAriaId` separates two FacetLists on
  // one page AND two rows of one repeated FacetList (see the note above).
  const facetId = useAriaId('facetlist', element);
  const optionId = (i: number): string => facetId('opt', i);

  const toggle = (key: string): void => {
    const next = sel.includes(key) ? sel.filter((v) => v !== key) : [...sel, key];
    // Selection stays live in (bindable) state regardless of the emit gate.
    setSelected(next);
    // A checkbox toggle is a DISCRETE PICK (single deliberate click), not a
    // per-tick stream — its host signal must never be silenced by emitOnChange,
    // and FacetList has no submit/commit path to recover it otherwise.
    emitWith('change', { value: next, toggled: key });
  };

  return (
    <div
      className="flex w-full flex-col gap-1 [--fr-facetlist-accent:var(--fr-accent)]"
      style={styleVars(
        { var: '--fr-facetlist-accent', value: p.accent, kind: 'color' },
        { var: '--fr-facetlist-accent-text', value: p.accentText, kind: 'color' },
        { var: '--fr-facetlist-muted', value: p.mutedColor, kind: 'color' },
      )}
    >
      {p.title != null && (
        // break-words, not truncate: the group heading names what the facets below
        // filter — the column has no fixed row height, so it wraps instead.
        <span className="break-words px-1.5 pb-1 text-[0.8125rem] font-semibold uppercase tracking-wide [color:var(--fr-facetlist-muted,var(--color-muted-foreground))]" title={p.title || undefined}>{p.title}</span>
      )}
      {/* An id ONLY on the rows the show-more trigger names (`i >= max`), which is
          what FacetRow's `id` prop was documented for. It used to be stamped on
          every row, so a plain FacetList — no `max`, no trigger, nothing that can
          reference them — still emitted an id per row. Narrowing it also keeps
          the common case's markup free of the per-instance `useId` token. */}
      {shown.map(({ facet, key }, i) => (
        <FacetRow key={key} id={max != null && i >= max ? optionId(i) : undefined} facet={facet} checked={sel.includes(key)} accentVar="--fr-facetlist-accent" mutedVar="--fr-facetlist-muted" onToggle={() => toggle(key)} />
      ))}
      {max != null && facets.length > max && (
        <button
          type="button"
          // min-h-6 = the WCAG 2.5.8 24px floor, MEASURED not assumed. `py-1` +
          // `text-[0.8125rem]` leaves the height to the font: an arbitrary
          // font-size utility carries no line-height, and this button's column
          // parent sets no `text-*` class, so the line box is the font's
          // `normal`. Headless Chromium put the rendered control at exactly 24px
          // in the default `ui-sans-serif, system-ui` stack and at 23px in Arial,
          // Helvetica and Georgia — i.e. it passes only by accident of the
          // default font, and any workspace theme that names its own family
          // fails. A FLOOR, never a fixed height: a larger font must still grow
          // the control rather than clip inside it.
          // `hover:text-inherit`, not `hover:text-foreground`: the hover state
          // paints NO fill of its own (unlike the composer's toolbar buttons,
          // which pair hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] with the token), so on an authored surface
          // the token made this control DISAPPEAR at the moment it was pointed at
          // — #18181b over #12161f, 1.02:1. Inheriting keeps the "brighten to full
          // ink on hover" intent on any surface; unwrapped it is the same colour.
          className="mt-0.5 inline-flex min-h-6 w-fit cursor-pointer items-center gap-1 rounded-frayme border-0 bg-transparent px-1.5 py-1 text-[0.8125rem] font-medium [color:var(--fr-facetlist-muted,var(--color-muted-foreground))] transition-colors hover:text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]"
          aria-expanded={!collapsed}
          // The revealed rows exist ONLY while expanded — `shown` is a head slice
          // of `max` while collapsed, so every id in this list named nothing in
          // the collapsed state, which is the state the trigger spends most of
          // its life in. Emitted only when the rows are actually mounted.
          aria-controls={collapsed ? undefined : facets.slice(max).map((_, i) => optionId(max + i)).join(' ')}
          onClick={() => setExpanded((e) => !e)}
        >
          <Icon name={collapsed ? 'plus' : 'minus'} size={13} />
          {collapsed
            ? (p.showMoreLabel ?? 'Show {n} more').replace('{n}', String(facets.length - max))
            : (p.showLessLabel ?? 'Show less')}
        </button>
      )}
    </div>
  );
}

/* ── FilterPanel ──────────────────────────────────────────────────────────── */

type SectionT = { heading?: string; facets?: FacetT[] | null; collapsed?: boolean | null };

/** One collapsible facet section. Collapse + selection are internal (live
 *  without a binding); toggling a facet reports `(option, checked, sectionSelection)`
 *  via onChange — the FULL updated selection of THIS section, not just the delta. */
function PanelSection({
  section,
  accentVar,
  mutedVar,
  onChange,
  regionId,
}: {
  section: SectionT;
  accentVar: string;
  mutedVar: string;
  onChange: (option: string, checked: boolean, sectionSelection: string[]) => void;
  /** DOM id for the facet list this section's header opens — minted by the
   *  panel (which knows the section's index), since a section cannot know how
   *  many siblings share its heading. */
  regionId: string;
}): ReactNode {
  const facets = safeFacets(section.facets);
  const seeded = facets.filter(({ facet }) => facet.checked === true).map(({ key }) => key);
  const [selected, setSelected] = useState<string[]>(seeded);
  const [collapsed, setCollapsed] = useState(section.collapsed === true);

  const toggle = (key: string): void => {
    const checked = !selected.includes(key);
    // Compute the resolved next selection from in-scope `selected` (never inside
    // the setState updater) so it can be emitted; the updater only stores it.
    const next = selected.includes(key) ? selected.filter((v) => v !== key) : [...selected, key];
    setSelected(next);
    onChange(key, checked, next);
  };

  return (
    <div className="flex flex-col border-b border-border pb-2 last:border-b-0 last:pb-0">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent px-1.5 py-2 text-left text-sm font-semibold text-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]"
        aria-expanded={!collapsed}
        // The facet list is mounted only while expanded (`{!collapsed && …}`
        // below), so the reference is emitted only then. Unconditional, a
        // collapsed section — the state `collapsed: true` puts it in on first
        // paint — pointed a reader at an id that is not in the document.
        aria-controls={collapsed ? undefined : regionId}
        onClick={() => setCollapsed((c) => !c)}
      >
        {/* break-words, not truncate: the section heading names the criterion the
            rows below belong to; the chevron beside it is shrink-0, so only this
            span gives way and the toggle row grows a line instead. No `min-w-0` —
            leaf text keeps its longest-word minimum so the heading wraps by words
            rather than shattering per character. */}
        <span className="break-words" title={section.heading ?? undefined}>{section.heading ?? ''}</span>
        {/* The chevron reads the panel's muted var (token fallback) so a set
            mutedColor re-tints it together with the facet counts — the
            DatePicker month-nav chevron model. Literal (single caller). */}
        <span className={cn('shrink-0 [color:var(--fr-filterpanel-muted,var(--color-muted-foreground))] transition-transform', collapsed && '-rotate-90')} aria-hidden>
          <Icon name="chevron-down" size={16} />
        </span>
      </button>
      {!collapsed && (
        <div id={regionId} className="flex flex-col gap-0.5 pb-1">
          {facets.map(({ facet, key }) => (
            <FacetRow key={key} facet={facet} checked={selected.includes(key)} accentVar={accentVar} mutedVar={mutedVar} onToggle={() => toggle(key)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterPanel({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title?: string | null;
    sections?: SectionT[] | null;
    accent?: string | null;
    accentText?: string | null;
    mutedColor?: string | null;
    selections?: Record<string, string[]> | null;
    applyLabel?: string | null;
    emitOnChange?: boolean | null;
  };
  const sections = Array.isArray(p.sections)
    ? p.sections.filter((s): s is SectionT => s != null && typeof s === 'object')
    : [];
  const emitWith = useIntrinsicEmit(emit, element);

  // Cross-section selection snapshot: heading → its checked facet values. Seeded
  // from each section's initially-checked facets so `change`/`commit` always carry
  // the FULL resolved selection across ALL sections (mirroring FacetList), not
  // just the toggled delta. Mirrored into (bindable) state so an external Apply
  // button can read the whole panel via spec.state; a ref holds the same value so
  // handlers read the current map without depending on the async setState.
  const seedSelections = (): Record<string, string[]> => {
    const map: Record<string, string[]> = {};
    sections.forEach((section, i) => {
      const heading = section.heading ?? `section-${i}`;
      map[heading] = safeFacets(section.facets)
        .filter(({ facet }) => facet.checked === true)
        .map(({ key }) => key);
    });
    return map;
  };
  const [, setSelectionsState] = useBoundProp<Record<string, string[]>>(
    p.selections != null ? p.selections : undefined,
    (bindings as { selections?: unknown } | undefined)?.selections,
  );
  // One id minter for the whole panel — the sections' region ids are struck from
  // it below (a section cannot know its own index, and two repeat rows of one
  // FilterPanel must not share ids; see the shared-ARIA-ids note above).
  const panelId = useAriaId('filterpanel', element);
  const selectionsRef = useRef<Record<string, string[]>>(seedSelections());
  useEffect(() => {
    const map = seedSelections();
    selectionsRef.current = map;
    setSelectionsState(map);
    // Re-seed only when the section shape changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sections.map((s) => [s.heading, safeFacets(s.facets).map(({ key }) => key)]))]);

  return (
    <div
      className="flex w-full flex-col gap-2 rounded-frayme border border-border bg-card p-3 [--fr-filterpanel-accent:var(--fr-accent)]"
      style={styleVars(
        { var: '--fr-filterpanel-accent', value: p.accent, kind: 'color' },
        { var: '--fr-filterpanel-accent-text', value: p.accentText, kind: 'color' },
        { var: '--fr-filterpanel-muted', value: p.mutedColor, kind: 'color' },
      )}
    >
      {p.title != null && (
        // break-words, not truncate: the panel title names the whole filter set and
        // the panel is a free-height column — it wraps rather than losing its tail.
        <span className="break-words px-1.5 pb-1 text-sm font-semibold text-foreground" title={p.title || undefined}>{p.title}</span>
      )}
      {sections.map((section, i) => {
        const heading = section.heading ?? `section-${i}`;
        return (
          <PanelSection
            key={i}
            section={section}
            accentVar="--fr-filterpanel-accent"
            mutedVar="--fr-filterpanel-muted"
            // Index-keyed, not heading-keyed: two sections may carry the same
            // (or no) heading, and a duplicated id would aim every header at the
            // first section's facets. `panelId` separates two FilterPanels.
            regionId={panelId('section', i)}
            onChange={(option, checked, sectionSelection) => {
              const nextSelections = { ...selectionsRef.current, [heading]: sectionSelection };
              selectionsRef.current = nextSelections;
              // Keep the bound selection map live regardless of the emit gate.
              setSelectionsState(nextSelections);
              // A checkbox toggle is a DISCRETE PICK (single deliberate click),
              // not a per-tick stream — its host signal must never be silenced
              // by emitOnChange. (The Apply button additionally commits the full
              // map, but the per-pick change must still always reach the host.)
              emitWith('change', {
                section: section.heading ?? null,
                option,
                checked,
                selected: sectionSelection,
                selections: nextSelections,
              });
            }}
          />
        );
      })}
      {/* Submit path — commits the full cross-section selection map so an agent can
          read the whole panel on demand (not only via the per-toggle change stream). */}
      <button
        type="button"
        className="mt-1 inline-flex w-full cursor-pointer items-center justify-center rounded-frayme border-0 px-3 py-2 text-sm font-medium [background:var(--fr-filterpanel-accent,var(--color-foreground))] text-[color:var(--fr-filterpanel-accent-text,var(--color-card))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:var(--fr-filterpanel-accent,var(--fr-accent))]"
        aria-label={p.applyLabel ?? 'Apply filters'}
        onClick={() => emitWith('commit', { selections: selectionsRef.current })}
      >
        {p.applyLabel ?? 'Apply filters'}
      </button>
    </div>
  );
}

/* ── RichComposer ─────────────────────────────────────────────────────────── */

/* A WYSIWYG rich-text composer (Salesforce Rich Text Area-style): a
 * contentEditable surface + a formatting toolbar driven by the browser's native
 * execCommand (zero dep). SECURE for the untrusted-spec model: the spec's `value`
 * is inserted as PLAIN TEXT (never innerHTML → no spec-borne injection), paste is
 * coerced to plain text (no HTML-paste injection), links route through safeUrl,
 * and the editor's content is SANITISED to a small tag allowlist on every change
 * before it reaches the bound value / `submit`. */
/* A toolbar entry. `cmd` is a native execCommand; `block` pairs with formatBlock;
 * `state` names the queryCommandState command used to light the button as pressed;
 * `kind` marks the custom (non-execCommand) tools that open a prompt or insert.
 *
 * MARK — every entry declares EXACTLY ONE of `icon` (a closed-registry glyph
 * name) or `label` (a letterform); the union makes "neither" unrepresentable, so
 * no control can reach the row undrawn. `label` covers only the formats the
 * closed registry holds no glyph for, and it is typeset (see `toolMark`), not
 * emitted as loose text. `struck` strikes the letterform so the mark DEPICTS its
 * format instead of merely naming it — the same trick the registry's own
 * bold/italic/underline glyphs use, which are drawn letterforms too. */
type RcMark =
  | { icon: string; label?: never; struck?: never }
  | { icon?: never; label: string; struck?: boolean };
type RcTool = RcMark & { title: string; cmd?: string; block?: string; state?: string; kind?: 'link' | 'image' | 'inlineCode' | 'divider' | 'clear' };
const RC_TOOLS: Record<string, RcTool> = {
  bold: { title: 'Bold', icon: 'bold', cmd: 'bold', state: 'bold' },
  italic: { title: 'Italic', icon: 'italic', cmd: 'italic', state: 'italic' },
  underline: { title: 'Underline', icon: 'underline', cmd: 'underline', state: 'underline' },
  strike: { title: 'Strikethrough', label: 'S', struck: true, cmd: 'strikeThrough', state: 'strikeThrough' },
  h1: { title: 'Heading 1', label: 'H1', cmd: 'formatBlock', block: 'h1' },
  h2: { title: 'Heading 2', label: 'H2', cmd: 'formatBlock', block: 'h2' },
  h3: { title: 'Heading 3', label: 'H3', cmd: 'formatBlock', block: 'h3' },
  bullet: { title: 'Bulleted list', icon: 'list', cmd: 'insertUnorderedList', state: 'insertUnorderedList' },
  number: { title: 'Numbered list', icon: 'list-ordered', cmd: 'insertOrderedList', state: 'insertOrderedList' },
  quote: { title: 'Quote', icon: 'message-square', cmd: 'formatBlock', block: 'blockquote' },
  code: { title: 'Code block', icon: 'terminal', cmd: 'formatBlock', block: 'pre' },
  inlineCode: { title: 'Inline code', icon: 'code', kind: 'inlineCode' },
  link: { title: 'Insert link', icon: 'link', kind: 'link' },
  image: { title: 'Insert image', icon: 'image', kind: 'image' },
  divider: { title: 'Divider', icon: 'minus', kind: 'divider' },
  clear: { title: 'Clear formatting', icon: 'rotate-ccw', kind: 'clear' },
};
const RC_DEFAULT_TOOLS = [
  'bold', 'italic', 'underline', 'strike',
  'h1', 'h2', 'h3',
  'link', 'image',
  'bullet', 'number',
  'code', 'inlineCode', 'quote', 'divider',
  'clear',
];

/** Output sanitiser: walk the contentEditable DOM, keep only allow-listed tags
 *  (execCommand emits these; paste/edge cases get scrubbed too), drop all attrs
 *  except a safeUrl'd href. Unknown tags are unwrapped (their text kept). */
const RC_ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'A', 'CODE', 'PRE', 'BLOCKQUOTE', 'BR', 'P', 'DIV', 'H1', 'H2', 'H3', 'IMG', 'HR']);
function rcEscape(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
}
function rcSanitize(root: HTMLElement): string {
  const walk = (node: Node): string => {
    if (node.nodeType === 3) return rcEscape(node.textContent ?? '');
    if (node.nodeType !== 1) return '';
    const el = node as HTMLElement;
    const tag = el.tagName;
    const inner = Array.from(el.childNodes).map(walk).join('');
    if (!RC_ALLOWED.has(tag)) return inner;
    if (tag === 'BR') return '<br>';
    if (tag === 'HR') return '<hr>';
    if (tag === 'IMG') {
      // Void element: keep only a URL-guarded src + escaped alt; drop everything else.
      const safe = safeImageSrc(el.getAttribute('src'));
      if (!safe) return '';
      const alt = rcEscape(el.getAttribute('alt') ?? '');
      return `<img src="${rcEscape(safe)}" alt="${alt}" />`;
    }
    if (tag === 'DIV' || tag === 'P') return inner ? `<p>${inner}</p>` : '';
    if (tag === 'A') {
      const safe = safeUrl(el.getAttribute('href'));
      return safe ? `<a href="${rcEscape(safe)}" rel="noopener noreferrer">${inner}</a>` : inner;
    }
    const t = tag.toLowerCase();
    return `<${t}>${inner}</${t}>`;
  };
  return Array.from(root.childNodes).map(walk).join('').trim();
}

/* Editor density by size. The min-height is emitted as a DEFAULT var (not a
 * min-h-* utility) so the exact `minHeight` channel can override it through a
 * single min-height declaration (no tw-merge double-declaration); the font-size
 * stays on the enum. Defaults reproduce the prior min-h-[4rem]/5.5rem/7rem. */
const composerMin: Record<string, string> = {
  sm: '[--fr-composer-minh-default:4rem] text-[0.8125rem]',
  md: '[--fr-composer-minh-default:5.5rem] text-sm',
  lg: '[--fr-composer-minh-default:7rem] text-[0.9375rem]',
};

export function RichComposer({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    value?: string | null;
    placeholder?: string | null;
    toolbar?: string[] | null;
    maxLength?: number | null;
    submitLabel?: string | null;
    size?: string | null;
    minHeight?: string | number | null;
    disabled?: boolean | null;
    loading?: boolean | null;
    accent?: string | null;
    accentText?: string | null;
    mutedColor?: string | null;
    emitOnChange?: boolean | null;
    readMode?: boolean | null;
    editLabel?: string | null;
  };
  const size = sizeOf(p.size);
  const maxLength = typeof p.maxLength === 'number' && Number.isFinite(p.maxLength) && p.maxLength > 0 ? Math.trunc(p.maxLength) : null;
  const requested = Array.isArray(p.toolbar) ? p.toolbar.filter((t) => typeof t === 'string' && RC_TOOLS[t] != null) : null;
  const tools = requested && requested.length > 0 ? requested : RC_DEFAULT_TOOLS;
  const emitWith = useIntrinsicEmit(emit, element);
  // Disabled / loading parity with PromptInput: both block editing + the
  // toolbar + submit; loading additionally shows a send spinner + aria-busy.
  const disabled = p.disabled === true;
  const loading = p.loading === true;
  const blocked = disabled || loading;

  // `value` is the editor's content (one-way OUT, sanitised HTML); two-way when
  // a spec binds it. The editor is UNCONTROLLED after the initial seed so the
  // caret never jumps (we read on input, we don't write innerHTML back).
  const [, setValue] = useBoundProp<string>(p.value ?? '', bindings?.value);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  // Tracks a consecutive Enter inside a code/quote block → the 2nd one exits it.
  const codeEnterRef = useRef(false);
  const [count, setCount] = useState(0);
  const [empty, setEmpty] = useState(true);
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageMode, setImageMode] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  // Which inline formats are active at the caret → the toolbar lights them pressed.
  const [active, setActive] = useState<Record<string, boolean>>({});

  // Read/view mode: when `readMode`, the composer flips to a rendered read-only view
  // after Send (with an Edit button to return). Starts in read when seeded with a value.
  const readable = p.readMode === true;
  const [mode, setMode] = useState<'edit' | 'read'>(
    readable && typeof p.value === 'string' && p.value.trim().length > 0 ? 'read' : 'edit',
  );
  const [viewHtml, setViewHtml] = useState<string>(
    readable && typeof p.value === 'string' && p.value.trim().length > 0
      ? `<p>${rcEscape(p.value).replace(/\n/g, '<br>')}</p>`
      : '',
  );

  // Seed ONCE from the spec value as PLAIN TEXT (never innerHTML → no injection).
  useEffect(() => {
    const el = editorRef.current;
    if (el && typeof p.value === 'string' && p.value.length > 0 && (el.textContent ?? '') === '') {
      el.textContent = p.value;
      setEmpty(false);
      setCount(p.value.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Returning to edit from read → re-hydrate the editor with the (sanitised) view
  // HTML so content is not lost. viewHtml is always sanitiser output or escaped
  // plain text, so setting it as innerHTML is safe.
  useEffect(() => {
    if (mode !== 'edit') return;
    const el = editorRef.current;
    if (el && (el.textContent ?? '').length === 0 && viewHtml) {
      el.innerHTML = viewHtml;
      const t = el.textContent ?? '';
      setEmpty(t.trim().length === 0);
      setCount(t.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Reflect the caret's inline formats onto the toolbar (pressed state). Cheap +
  // best-effort — queryCommandState is unsupported for some commands/hosts.
  const INLINE_STATES = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'];
  const refreshActive = (): void => {
    if (typeof document === 'undefined') return;
    const next: Record<string, boolean> = {};
    for (const name of INLINE_STATES) {
      try { next[name] = document.queryCommandState(name); } catch { /* command unsupported */ }
    }
    setActive(next);
  };

  const sync = (): string => {
    const el = editorRef.current;
    if (!el) return '';
    const text = el.textContent ?? '';
    setCount(text.length);
    setEmpty(text.trim().length === 0 && !el.querySelector('img,hr'));
    const value = rcSanitize(el);
    refreshActive();
    // Value stays live in (bindable) state regardless of the emit gate; only the
    // per-keystroke change stream is suppressed when emitOnChange is false. The
    // submit path reads this returned value and fires `commit` unconditionally.
    setValue(value);
    if (p.emitOnChange !== false) emitWith('change', { value });
    return value;
  };

  const exec = (def: RcTool): void => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    if (def.kind === 'inlineCode') {
      const sel = window.getSelection();
      const text = sel && sel.rangeCount > 0 ? sel.toString() : '';
      // Wrap the selection (or a placeholder) in <code>; trailing space so the
      // caret leaves the code run and the next keystrokes are not code.
      document.execCommand('insertHTML', false, `<code>${rcEscape(text || 'code')}</code>&nbsp;`);
    } else if (def.kind === 'divider') {
      document.execCommand('insertHorizontalRule');
    } else if (def.kind === 'clear') {
      // Full reset — removeFormat only strips INLINE marks, so also flatten the
      // block (heading/quote/code → normal paragraph), drop any list, and unlink.
      document.execCommand('removeFormat');
      document.execCommand('formatBlock', false, 'div');
      if (document.queryCommandState('insertUnorderedList')) document.execCommand('insertUnorderedList');
      if (document.queryCommandState('insertOrderedList')) document.execCommand('insertOrderedList');
      document.execCommand('unlink');
    } else if (def.cmd === 'formatBlock' && def.block) {
      document.execCommand('formatBlock', false, def.block);
    } else if (def.cmd) {
      document.execCommand(def.cmd, false, undefined);
    }
    sync();
  };

  // Escape a code block / quote — reliably, without parsing Chrome's inconsistent
  // newline DOM: press Enter TWICE. The 1st Enter inserts a newline (default); the
  // 2nd CONSECUTIVE Enter breaks out into a fresh paragraph below. Any other key
  // resets the counter. Also works with Cmd/Ctrl+Enter as a one-press shortcut.
  const enclosingBlock = (): HTMLElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if (node.nodeType === 1 && /^(PRE|BLOCKQUOTE)$/.test((node as HTMLElement).tagName)) return node as HTMLElement;
      node = node.parentNode;
    }
    return null;
  };
  const breakOutOf = (block: HTMLElement): void => {
    // trim the trailing empty line/br the first Enter left behind
    const t = block.textContent ?? '';
    if (t.endsWith('\n')) block.textContent = t.replace(/\n+$/, '');
    else {
      const last = block.lastChild;
      if (last && (last.nodeName === 'BR' || (last.nodeType === 1 && (last as HTMLElement).textContent === ''))) block.removeChild(last);
    }
    const para = document.createElement('p');
    para.appendChild(document.createElement('br'));
    block.parentNode?.insertBefore(para, block.nextSibling);
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStart(para, 0);
    r.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(r);
    editorRef.current?.focus();
    sync();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Enter') { codeEnterRef.current = false; return; }
    if (e.shiftKey) return; // Shift+Enter is always a plain newline
    const block = enclosingBlock();
    if (!block) { codeEnterRef.current = false; return; }
    // Cmd/Ctrl+Enter → exit immediately (one press); otherwise the 2nd Enter exits.
    if (e.metaKey || e.ctrlKey || codeEnterRef.current) {
      e.preventDefault();
      codeEnterRef.current = false;
      breakOutOf(block);
      return;
    }
    codeEnterRef.current = true; // first Enter: arm; let the default newline happen
  };

  // Link + image share the saved-range pattern (a toolbar click would otherwise
  // collapse the selection). Opening one closes the other so only one row shows.
  const openLink = (): void => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    savedRange.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    setLinkUrl('');
    setImageMode(false);
    setLinkMode(true);
  };
  const applyLink = (): void => {
    const el = editorRef.current;
    const safe = safeUrl(linkUrl);
    setLinkMode(false);
    // safeUrl returns the '#' sentinel for a rejected/empty URL (e.g. javascript:) —
    // don't create a dead anchor from bad input; require a real, allow-listed URL.
    if (!el || !safe || safe === '#') return;
    el.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand('createLink', false, safe);
    sync();
  };

  const openImage = (): void => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    savedRange.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    setImageUrl('');
    setLinkMode(false);
    setImageMode(true);
  };
  const applyImage = (): void => {
    const el = editorRef.current;
    const safe = safeImageSrc(imageUrl);
    setImageMode(false);
    if (!el || !safe) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand('insertHTML', false, `<img src="${rcEscape(safe)}" alt="" />`);
    sync();
  };

  // Plain-text paste only — no HTML-paste injection into the editor.
  const onPaste = (e: ClipboardEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const txt = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, txt);
  };

  const submit = (): void => {
    if (blocked) return;
    const value = sync();
    emitWith('commit', { value });
    // readMode → flip to the rendered read-only view (Edit button returns).
    if (readable) {
      setViewHtml(value);
      setMode('read');
    }
  };

  // Toolbar buttons read the composer's muted var (token fallback) so a set
  // mutedColor recolors the muted layer as ONE set (toolbar + placeholder +
  // counter); the hover highlight keeps the token (higher-specificity variant).
  // The hit box is a FIXED 28px square — never min-width plus padding — so every
  // control holds one rhythm across the row whichever mark it draws.
  const toolBtn =
    'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-frayme border-0 bg-transparent text-[color:var(--fr-composer-muted,var(--color-muted-foreground))] transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] hover:text-[color:var(--fr-surface-fg,var(--color-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]';

  // A letterform mark must carry the same optical weight as the 15px stroke-2
  // glyph beside it: 12px bold lands a cap-height and stem width in the glyph's
  // range, tight tracking keeps a two-character mark inside the 28px box, and
  // tabular figures hold H1/H2/H3 to one width. Typography lives HERE, not on
  // the button, so the glyph controls inherit no type scale they never use.
  const toolMark = 'text-[0.75rem] font-bold leading-none tracking-[-0.04em] tabular-nums';

  // READ MODE — a rendered, read-only view of the committed content + an Edit button.
  if (mode === 'read') {
    return (
      <div
        className="flex w-full flex-col gap-2 rounded-frayme border border-border bg-card p-3 [--fr-composer-accent:var(--fr-accent)]"
        style={styleVars(
          { var: '--fr-composer-accent', value: p.accent, kind: 'color' },
          { var: '--fr-composer-accent-text', value: p.accentText, kind: 'color' },
          { var: '--fr-composer-muted', value: p.mutedColor, kind: 'color' },
        )}
      >
        <div
          className="fr-rte w-full rounded-frayme px-1 leading-relaxed text-foreground"
          // SAFE: viewHtml is ALWAYS rcSanitize output (allow-listed tags, URL-guarded
          // href/src) or escaped plain text — never a raw spec value. No injection path.
          dangerouslySetInnerHTML={{
            __html: viewHtml || `<p class="[color:var(--fr-composer-muted,var(--color-muted-foreground))]">${rcEscape(p.placeholder ?? 'Nothing to show.')}</p>`,
          }}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setMode('edit')}
            aria-label={p.editLabel ?? 'Edit'}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-frayme border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]"
          >
            <Icon name="edit" size={14} />
            {p.editLabel ?? 'Edit'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-2 rounded-frayme border border-border bg-card p-2 [--fr-composer-accent:var(--fr-accent)]',
        // Dim + block pointer while disabled/loading (conditional → byte-identical
        // when unset). aria-busy on the region signals the in-flight state to AT.
        blocked && 'opacity-60',
      )}
      aria-busy={loading || undefined}
      style={styleVars(
        { var: '--fr-composer-accent', value: p.accent, kind: 'color' },
        { var: '--fr-composer-accent-text', value: p.accentText, kind: 'color' },
        { var: '--fr-composer-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-composer-minh', value: p.minHeight, kind: 'dim', opts: { units: ['px', 'rem'], min: 48, max: 480 } },
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border pb-2" role="toolbar" aria-label="Formatting">
        {tools.map((name) => {
          const def = RC_TOOLS[name];
          if (def == null) return null;
          // A declared glyph name is only drawn when it is IN the closed registry.
          // The mark is TOTAL: no glyph → the declared letterform, and failing that
          // the title's initial, so no path through this branch leaves a blank box.
          const glyph = def.icon != null && hasIcon(def.icon) ? def.icon : null;
          const mark = glyph != null ? null : (def.label ?? def.title.charAt(0).toUpperCase());
          return (
            <button
              key={name}
              type="button"
              // Disabled affordance classes are CONDITIONAL so an enabled composer
              // stays byte-identical (the disabled: variants would otherwise sit in
              // the class list even when never disabled).
              className={cn(
                toolBtn,
                // Pressed = this inline format is active at the caret (visible feedback).
                def.state && active[def.state] && 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-foreground ring-1 ring-inset ring-border',
                blocked && 'cursor-not-allowed opacity-50',
              )}
              title={def.title}
              aria-label={def.title}
              aria-pressed={def.state ? !!active[def.state] : undefined}
              disabled={blocked}
              // keep the editor's selection when the toolbar is clicked
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (def.kind === 'link' ? openLink() : def.kind === 'image' ? openImage() : exec(def))}
            >
              {glyph != null ? (
                <Icon name={glyph} size={15} />
              ) : (
                // aria-hidden: the button's aria-label already names the format, so
                // the mark must not be read a second time as a stray letter.
                <span aria-hidden className={cn(toolMark, def.struck === true && 'line-through')}>
                  {mark}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {linkMode && (
        <div className="flex items-center gap-1.5">
          <input
            type="url"
            autoFocus
            aria-label="Link URL"
            placeholder="https://…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              } else if (e.key === 'Escape') {
                setLinkMode(false);
              }
            }}
            className="min-w-0 flex-1 rounded-frayme border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:var(--fr-composer-accent,var(--fr-accent))]"
          />
          <button type="button" onClick={applyLink} className="shrink-0 cursor-pointer rounded-frayme border-0 px-2.5 py-1.5 text-sm font-medium [background:var(--fr-composer-accent,var(--color-foreground))] text-[color:var(--fr-composer-accent-text,var(--color-card))] hover:opacity-90">
            Apply
          </button>
          <button type="button" onClick={() => setLinkMode(false)} className="shrink-0 cursor-pointer rounded-frayme border border-border bg-transparent px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]">
            Cancel
          </button>
        </div>
      )}

      {imageMode && (
        <div className="flex items-center gap-1.5">
          <input
            type="url"
            autoFocus
            aria-label="Image URL"
            placeholder="https://…/image.png"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyImage();
              } else if (e.key === 'Escape') {
                setImageMode(false);
              }
            }}
            className="min-w-0 flex-1 rounded-frayme border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:var(--fr-composer-accent,var(--fr-accent))]"
          />
          <button type="button" onClick={applyImage} className="shrink-0 cursor-pointer rounded-frayme border-0 px-2.5 py-1.5 text-sm font-medium [background:var(--fr-composer-accent,var(--color-foreground))] text-[color:var(--fr-composer-accent-text,var(--color-card))] hover:opacity-90">
            Insert
          </button>
          <button type="button" onClick={() => setImageMode(false)} className="shrink-0 cursor-pointer rounded-frayme border border-border bg-transparent px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]">
            Cancel
          </button>
        </div>
      )}

      <div className="relative">
        {empty && (
          <span className="pointer-events-none absolute left-3 top-2 [color:var(--fr-composer-muted,var(--color-muted-foreground))]" aria-hidden>
            {p.placeholder ?? 'Write a message…'}
          </span>
        )}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={p.placeholder ?? 'Message'}
          // a disabled/loading composer is not editable and reports it to AT.
          contentEditable={!blocked}
          aria-disabled={blocked || undefined}
          suppressContentEditableWarning
          className={cn(
            'fr-rte w-full resize-y overflow-auto rounded-frayme border border-border bg-background px-3 py-2 leading-relaxed text-foreground outline-none [min-height:var(--fr-composer-minh,var(--fr-composer-minh-default,5.5rem))] focus-visible:ring-2 focus-visible:[--tw-ring-color:var(--fr-composer-accent,var(--fr-accent))]',
            composerMin[size],
            blocked && 'cursor-not-allowed',
          )}
          onInput={sync}
          onBlur={sync}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {maxLength != null ? (
          <span className={cn('text-[0.75rem] tabular-nums', count > maxLength ? 'text-danger' : '[color:var(--fr-composer-muted,var(--color-muted-foreground))]')}>
            {count} / {maxLength}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-frayme border-0 px-3.5 py-1.5 text-sm font-medium [background:var(--fr-composer-accent,var(--color-foreground))] text-[color:var(--fr-composer-accent-text,var(--color-card))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:var(--fr-composer-accent,var(--fr-accent))]',
            blocked && 'cursor-not-allowed opacity-50',
          )}
          disabled={blocked}
          aria-busy={loading || undefined}
          onClick={submit}
        >
          {loading ? (
            <span
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden
            />
          ) : (
            <Icon name="send" size={15} />
          )}
          {p.submitLabel ?? 'Send'}
        </button>
      </div>
    </div>
  );
}

