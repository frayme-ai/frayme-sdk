'use client';
import { Fragment, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { Icon, hasIcon } from './icons.js';
import { useAriaId } from './_aria.js';

/* Catalog group (inputs-choice): MultiSelect, Combobox, TagInput,
 * SegmentedControl.
 *
 * The option-SELECTION family — chips / typeahead / segmented — sitting beside
 * the base controls (Input/Select/… in forms.tsx). Same truly-dynamic contract
 * as Phases 1–4:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (color/dimension the model names directly) NEVER become
 *     classes — they land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`,
 *     read by STATIC arbitrary `var(--fr-…, var(--color-…))` utilities. The class
 *     set stays a closed, build-time set (no JIT, no injection); only the var's
 *     VALUE is model-supplied, and `styleVars` re-validates + omits any
 *     failing/absent value so the token fallback wins (props-less → polished).
 *
 * value > enum precedence: the CONDITIONAL override class — the
 * `[…:var(--fr-…)]` utility is only added to cn() when the model supplied that
 * value (`p.accent != null`), added LAST so tailwind-merge keeps it; the CVA
 * default wins when absent.
 *
 * RENDER-ONLY: these render selection state from an untrusted spec and emit a
 * pure-signal event; the host wires the handlers. No navigation, no fetch — a
 * Combobox does not load anything, it only filters the props-supplied options.
 *
 * Props-less safety: every options/value array is guarded (Array.isArray) and
 * every enum defaults via CVA, so a streamed element arriving before its props
 * patch still renders without crashing. */

type Opt = { label: string; value: string; icon?: string | null };

/** Coerce an unknown options array to a safe, well-shaped list. */
function safeOptions(x: unknown): Opt[] {
  if (!Array.isArray(x)) return [];
  return x.filter(
    (o): o is Opt => o != null && typeof o === 'object' && typeof (o as Opt).value === 'string',
  );
}

/** Coerce an unknown value array to a safe list of strings. */
function safeStrings(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.filter((s): s is string => typeof s === 'string');
}

/* The chip ✕ — ONE recipe shared by MultiSelect and TagInput (the two markup
 * sites were byte-identical, and a target floor that drifts between them is the
 * bug this hoist prevents).
 *
 * HIT AREA (WCAG 2.5.8, 24×24 CSS px): the painted button is `p-0.5` around a
 * 13px glyph = 17×17.
 * 2.5.8's "inline" exemption does NOT rescue it — the button is a flex
 * item of the chip, and a flex item is blockified, so its size is not constrained
 * by a line box (same reading as FilterChips' remove ✕).
 * REJECTED — growing the BOX to min-h-6/min-w-6: a 24px button inside the chip's
 * `py-0.5` makes the chip 28px, and at size sm the field only has 24px of content
 * box (min-h-8 − py-1·2), so every chip field would grow from 32px to 36px
 * to buy 7px of target. So the TARGET grows and the ink does not: a transparent
 * 24×24 ::before centred on the button, the trick FilterChips/InlineCitation/Switch
 * already use. It is out of flow, so it shifts nothing; the ~3.5px it overhangs
 * lands inside the chip's own px-2 padding on the right, over the chip's
 * non-interactive label on the left, and ~2.25px past the chip edge vertically —
 * under the field's gap-1.5, so wrapped rows never trade clicks.
 * The accessibility audit reads ::before/::after boxes off computed style, so this
 * is measured as a 24×24 target rather than asserted to be one. */
const chipRemoveHit =
  "relative cursor-pointer inline-flex shrink-0 items-center justify-center rounded-full p-0.5 opacity-70 before:absolute before:left-1/2 before:top-1/2 before:h-6 before:w-6 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current";

/* ── MultiSelect ──────────────────────────────────────────────────────────── */

/* The control surface. `accent` drives the focus ring; border/bg route through
   their own vars (all with token fallbacks). The corner rounding is a var-chain
   so an exact radiusValue wins while the default stays byte-identical to the
   prior `rounded-frayme` (var(--radius-frayme)). NEVER co-locate `rounded-*` with
   the arbitrary border-radius var — tw-merge would keep both → inert. */
const msControl = cva(
  'flex w-full flex-wrap items-center gap-1.5 border transition-[border-color,box-shadow] focus-within:ring-2 [border-color:var(--fr-ms-border,var(--color-border))] [background:var(--fr-ms-bg,var(--color-card))] [border-radius:var(--fr-ms-radius,var(--radius-frayme))] focus-within:[border-color:var(--fr-ms-accent,var(--fr-accent))] focus-within:[--tw-ring-color:color-mix(in_srgb,var(--fr-ms-accent,var(--fr-accent))_20%,transparent)]',
  {
    variants: {
      size: { sm: 'min-h-8 px-2 py-1 text-sm', md: 'min-h-10 px-2.5 py-1.5', lg: 'min-h-12 px-3 py-2 text-lg' },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', disabled: false },
  },
);

/* A selection chip. NEUTRAL resting fill (bg-muted +
 * text-foreground) when accent is unset; a 14%-accent-tint fill/text
 * ONLY when the model names an accent — mutually-exclusive, never co-located
 * (the arbitrary color-mix background/text would not dedupe against
 * bg-muted/text-foreground). */
const msChipBase = 'inline-flex items-center gap-1 rounded-frayme px-2 py-0.5 text-[0.8125rem] font-medium';
const msChipTint = '[background:color-mix(in_srgb,var(--fr-ms-accent,var(--color-primary))_14%,transparent)] [color:var(--fr-ms-accent,var(--color-foreground))]';

/* Coherence group "field + its popover": the open menu panel reads the SAME
   bg/borderColor channels as the control (token fallbacks keep the unset render
   byte-identical), mirroring how Combobox's menu follows its field. The menu is
   a SIBLING of the control, so its own styleVars must re-set the vars. */
const msMenu =
  'mt-1 max-h-60 overflow-auto rounded-frayme border border-[color:var(--fr-ms-border,var(--color-border))] [background:var(--fr-ms-bg,var(--color-card))] p-1 shadow-md [width:var(--fr-ms-menu-w,100%)] max-w-full';

export function MultiSelect({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    options?: unknown;
    value?: unknown;
    placeholder?: string | null;
    max?: number | null;
    size?: 'sm' | 'md' | 'lg' | null;
    searchable?: boolean | null;
    chips?: boolean | null;
    clearable?: boolean | null;
    disabled?: boolean | null;
    accent?: string | null;
    accentText?: string | null;
    borderColor?: string | null;
    bg?: string | null;
    mutedColor?: string | null;
    emptyText?: string | null;
    submitLabel?: string | null;
    menuWidth?: string | number | null;
    radiusValue?: string | number | null;
  };
  const options = safeOptions(p.options);
  const [value, setValue] = useBoundProp<string[]>(safeStrings(p.value), bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const selected = safeStrings(value);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = p.disabled === true;
  const showChips = p.chips ?? true;
  const max = typeof p.max === 'number' && Number.isFinite(p.max) ? p.max : undefined;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // The listbox menu's DOM id — what the chevron's `aria-expanded` expanded.
  //
  // Was a slug of the PLACEHOLDER (`fr-ms-options-menu` when unset), which is not
  // an id at all: two MultiSelects sharing a placeholder — including the default,
  // and including every row of a `repeat`, which re-renders one element per row —
  // minted the identical string, so both open menus carried it and the trigger's
  // aria-controls resolved to two elements (or, for a repeat, to row one's menu).
  // `useAriaId` is per-INSTANCE; the trigger and the menu are rendered by this
  // same component from this same value, so the pairing cannot come apart.
  const menuId = useAriaId('multiselect', element)('menu');

  const labelFor = (val: string) => options.find((o) => o.value === val)?.label ?? val;
  const atMax = max != null && selected.length >= max;
  const filtered = p.searchable === true && query.length > 0
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  function toggle(val: string): void {
    if (disabled) return;
    const next = selected.includes(val)
      ? selected.filter((v) => v !== val)
      : atMax
        ? selected
        : [...selected, val];
    if (next === selected) return;
    setValue(next);
    emitWith('change', { value: next, toggled: val, checked: next.includes(val) });
  }
  function remove(val: string): void {
    if (disabled) return;
    const next = selected.filter((v) => v !== val);
    setValue(next);
    emitWith('change', { value: next, toggled: val, checked: false });
  }
  // clear-all: one × beside the chevron deselects everything at once and emits
  // `dismiss` with { all: true }. Only wired when `clearable` and there is a selection.
  function clearAll(): void {
    if (disabled) return;
    setValue([]);
    emitWith('dismiss', { all: true, value: [] });
  }
  // Submit path: an optional internal Apply button that emits the
  // FULL current selection on demand — the on-demand commit for bound use without
  // a separate external Button. Reads in-scope `selected` (never a setState
  // updater); one emitWith('commit') per press.
  function submit(): void {
    if (disabled) return;
    emitWith('commit', { value: selected });
  }

  return (
    <div className="relative w-full">
      <div
        className={cn(
          msControl({ size, disabled }),
          // Resting-border precedence (family-wide rule): an explicit
          // borderColor — the more specific channel — WINS over accent, so the
          // accent takeover only applies when no borderColor is named.
          p.accent != null && p.borderColor == null && '[border-color:var(--fr-ms-accent)]',
        )}
        style={styleVars(
          { var: '--fr-ms-accent', value: p.accent, kind: 'color' },
          { var: '--fr-ms-border', value: p.borderColor, kind: 'color' },
          { var: '--fr-ms-bg', value: p.bg, kind: 'color' },
          { var: '--fr-ms-muted', value: p.mutedColor, kind: 'color' },
          // exact corner radius → --fr-ms-radius wins over the var-chain default.
          { var: '--fr-ms-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        )}
        aria-disabled={disabled || undefined}
      >
        {selected.length === 0 && (
          <span className="px-0.5 [color:var(--fr-ms-muted,var(--color-muted-foreground))]">{p.placeholder ?? 'Select…'}</span>
        )}
        {selected.length > 0 && showChips
          ? selected.map((val) => (
              <span key={val} className={cn(msChipBase, 'max-w-full', p.accent != null ? msChipTint : 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-[color:var(--fr-surface-fg,var(--color-foreground))]')}>
                {/* truncate EARNED: a selection chip is a single-line TOKEN in a
                    wrapping token field — msControl is flex-wrap with min-h-*, so
                    chips flow onto new lines instead of squeezing each other, and
                    `max-w-full` is a RELATIVE cap that tracks the control width
                    (never a fixed rem). The label therefore only clips when it is
                    longer than the whole field, which is the chip contract. */}
                <span className="break-words" title={labelFor(val) || undefined}>{labelFor(val)}</span>
                {!disabled && (
                  <button
                    type="button"
                    className={chipRemoveHit}
                    aria-label={`Remove ${labelFor(val)}`}
                    onClick={() => remove(val)}
                  >
                    <Icon name="x" size={13} />
                  </button>
                )}
              </span>
            ))
          : selected.length > 0 && (
              <span className="px-0.5 text-sm font-medium">{selected.length} selected</span>
            )}
        {/* Clear-all × — only when `clearable` is on AND something is selected.
            Absent otherwise. `ml-auto` moves to
            this button so the chevron stays flush-right after it. */}
        {p.clearable === true && selected.length > 0 && !disabled && (
          <button
            type="button"
            // HIT AREA (WCAG 2.5.8): measured 23×23 — `p-1` (4px a side) around a
            // 15px glyph, ONE pixel under the floor. Unlike the chip ✕ this button
            // sits directly in the field, whose content box is already ≥24px at
            // every size (sm = min-h-8 − py-1·2 = 24), so the box can simply grow
            // to 24 and nothing moves. min-h-6/min-w-6, never h-6/w-6: a fixed box
            // would clip a larger glyph instead of growing with it.
            className="ml-auto cursor-pointer inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full p-1 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current [color:var(--fr-ms-muted,var(--color-muted-foreground))]"
            aria-label="Clear all"
            onClick={clearAll}
          >
            <Icon name="x" size={15} />
          </button>
        )}
        <button
          type="button"
          // Keep the chevron flush-right: it owns ml-auto UNLESS the clear-all × is
          // present (then the × owns it). Unset clearable → the chevron keeps its leading
          // ml-auto in the SAME class position as before → byte-identical.
          className={cn(
            !(p.clearable === true && selected.length > 0 && !disabled) && 'ml-auto',
            // `disabled:cursor-not-allowed` must accompany the pointer on a
            // button that can be disabled: cursor inherits, so a bare
            // cursor-pointer would override the wrapper's not-allowed cursor.
            // min-h-6/min-w-6 states the 24×24 floor the chevron currently meets
            // only by arithmetic (p-1 + a 16px glyph = exactly 24, no margin):
            // it is one icon-size edit from silently becoming an undersized
            // target, and at 24 the two classes cost zero pixels.
            'cursor-pointer disabled:cursor-not-allowed inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center p-1 [color:var(--fr-ms-muted,var(--color-muted-foreground))]',
          )}
          aria-label={open ? 'Close options' : 'Open options'}
          aria-haspopup="listbox"
          aria-expanded={open}
          // Named only while the menu is mounted (the `open && !disabled` branch
          // below, repeated verbatim). `aria-expanded` stays in both states, but a
          // closed chevron pointing at an id that is not in the document sends a
          // screen reader that follows the reference nowhere — the Toggletip
          // defect, and ARIA only RECOMMENDS aria-controls here, so omitting it
          // while there is nothing to name costs nothing.
          aria-controls={open && !disabled ? menuId : undefined}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="chevron-down" size={16} />
        </button>
      </div>

      {open && !disabled && (
        <div
          id={menuId}
          className={msMenu}
          role="listbox"
          aria-multiselectable
          style={styleVars(
            { var: '--fr-ms-menu-w', value: p.menuWidth, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 720 } },
            { var: '--fr-ms-muted', value: p.mutedColor, kind: 'color' },
            { var: '--fr-ms-accent', value: p.accent, kind: 'color' },
            { var: '--fr-ms-accent-text', value: p.accentText, kind: 'color' },
            // bg/borderColor cover the menu panel too (field + popover group).
            { var: '--fr-ms-bg', value: p.bg, kind: 'color' },
            { var: '--fr-ms-border', value: p.borderColor, kind: 'color' },
          ) as CSSProperties}
        >
          {p.searchable === true && (
            <input
              className={cn(
                // The filter input clones the control's chrome: its border reads the
                // SAME --fr-ms-border chain (group form, token fallback → byte-identical
                // unset).
                'mb-1 w-full rounded-frayme border border-[color:var(--fr-ms-border,var(--color-border))] bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:var(--fr-ms-accent,var(--fr-accent))]',
                // The placeholder joins the mutedColor channel ONLY when set (the
                // input bakes no placeholder color, so an unconditional reader would
                // change the unset default).
                p.mutedColor != null && 'placeholder:[color:var(--fr-ms-muted,var(--color-muted-foreground))]',
              )}
              type="text"
              placeholder="Filter…"
              value={query}
              aria-label="Filter options"
              onChange={(e) => {
                setQuery(e.target.value);
                emitWith('search', { query: e.target.value });
              }}
            />
          )}
          {filtered.length === 0 ? (
            <div className="px-2 py-1.5 text-sm [color:var(--fr-ms-muted,var(--color-muted-foreground))]">{p.emptyText ?? 'No options'}</div>
          ) : (
            filtered.map((o) => {
              const isSel = selected.includes(o.value);
              const blocked = !isSel && atMax;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  disabled={blocked}
                  className={cn(
                    'cursor-pointer flex w-full items-center gap-2 rounded-frayme px-2 py-1.5 text-left text-sm',
                    // Hover/focus from the EXISTING accent channel, mutually-exclusive
                    // with the token hover — never co-locate the two hovers. Unset branch
                    // reproduces the exact prior trailing segment verbatim → byte-identical.
                    p.accent != null
                      ? 'hover:[background:color-mix(in_srgb,var(--fr-ms-accent)_12%,transparent)] focus-visible:[background:color-mix(in_srgb,var(--fr-ms-accent)_12%,transparent)] focus-visible:outline-none'
                      : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:outline-none',
                    blocked && 'cursor-not-allowed opacity-50',
                  )}
                  onClick={() => toggle(o.value)}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                      isSel
                        ? // quiet defaults: the checked box is neutral high-contrast
                          // (near-black), shadcn-style, not a brand slab; author `accent` still wins.
                          'border-transparent [background:var(--fr-ms-accent,var(--color-foreground))] text-[color:var(--fr-ms-accent-text,var(--color-card))]'
                        : 'border-border',
                    )}
                  >
                    {isSel && <Icon name="check" size={12} />}
                  </span>
                  {/* An option's label IS the choice — a menu row has no fixed
                      height (px-2 py-1.5), so it wraps to a second line rather
                      than ellipsising the thing being chosen. Leaf text, so no
                      `min-w-0`: the label's longest word is the floor it must
                      keep; `break-words` covers an over-wide token. */}
                  <span className="break-words" title={o.label || undefined}>{o.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Submit path: an optional internal Apply button emitting commit{value}
          with the full selection on demand (rendered only when submitLabel set). */}
      {p.submitLabel != null && p.submitLabel !== '' && (
        <button
          type="button"
          className="mt-2 cursor-pointer inline-flex items-center justify-center rounded-frayme bg-foreground px-3 py-1.5 text-sm font-medium text-card transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_70%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          onClick={submit}
        >
          {p.submitLabel}
        </button>
      )}
    </div>
  );
}

/* ── Combobox ─────────────────────────────────────────────────────────────── */

// The control surface. Corner rounding is a var-chain so an exact radiusValue
// wins; the default stays byte-identical to the prior `rounded-frayme`
// (var(--radius-frayme)). NEVER co-locate `rounded-*` with the arbitrary
// border-radius var — tw-merge would keep both → inert.
const cbControl = cva(
  'flex w-full items-center gap-2 border transition-[border-color,box-shadow] focus-within:ring-2 [border-color:var(--fr-cb-border,var(--color-border))] [background:var(--fr-cb-bg,var(--color-card))] [border-radius:var(--fr-cb-radius,var(--radius-frayme))] focus-within:[border-color:var(--fr-cb-accent,var(--fr-accent))] focus-within:[--tw-ring-color:color-mix(in_srgb,var(--fr-cb-accent,var(--fr-accent))_20%,transparent)]',
  {
    variants: {
      size: { sm: 'h-8 px-2.5 text-sm', md: 'h-10 px-3', lg: 'h-12 px-3.5 text-lg' },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', disabled: false },
  },
);

// The menu border completes the "field box + menu panel" coherence group: it
// reads the SAME borderColor channel as the input (token fallback keeps the
// unset render byte-identical), matching the bg channel the menu already reads.
const cbMenu =
  'mt-1 overflow-auto rounded-frayme border border-[color:var(--fr-cb-border,var(--color-border))] [background:var(--fr-cb-bg,var(--color-card))] p-1 shadow-md [width:var(--fr-cb-menu-w,100%)] max-w-full [max-height:var(--fr-cb-menu-mh,15rem)]';

export function Combobox({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    options?: unknown;
    value?: string | null;
    placeholder?: string | null;
    creatable?: boolean | null;
    emitOnChange?: boolean | null;
    loading?: boolean | null;
    size?: 'sm' | 'md' | 'lg' | null;
    disabled?: boolean | null;
    accent?: string | null;
    borderColor?: string | null;
    bg?: string | null;
    mutedColor?: string | null;
    emptyText?: string | null;
    menuWidth?: string | number | null;
    maxHeight?: string | number | null;
    radiusValue?: string | number | null;
  };
  const options = safeOptions(p.options);
  const [value, setValue] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = p.disabled === true;
  const loading = p.loading === true;

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value ?? '';
  // The query mirrors the committed label until the user types; once typing,
  // local state holds the in-flight query.
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // the keyboard-active option index into the FILTERED list (aria-activedescendant
  // + arrow-key navigation). -1 = none active yet.
  const [active, setActive] = useState(-1);
  const q = query ?? selectedLabel;

  const filtered = q.length > 0 ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  const exact = options.some((o) => o.label.toLowerCase() === q.toLowerCase());
  const showCreate = p.creatable === true && q.trim().length > 0 && !exact;
  // Stable option ids so aria-activedescendant can point at the active row.
  const listId = `fr-cb-${(p.placeholder ?? 'options').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'options'}`;
  const optId = (i: number): string => `${listId}-opt-${i}`;
  const activeId = open && active >= 0 && active < filtered.length ? optId(active) : undefined;

  function commit(val: string, label: string): void {
    if (disabled) return;
    setValue(val);
    setQuery(label);
    setOpen(false);
    setActive(-1);
    emitWith('change', { value: val });
  }

  // Submit path: commit the RAW in-flight query on Enter (with no
  // menu selection) or on blur, so partial/typed input lands in the bound value
  // and an external Button can read it on demand. Reads in-scope `query`/`value`
  // (never a setState updater); one emitWith('commit') per call, and only when the
  // query actually diverges from the already-committed value (avoids a redundant
  // commit when the query just mirrors the selected label).
  function commitQuery(): void {
    if (disabled) return;
    const raw = (query ?? '').trim();
    if (raw.length === 0 || raw === (value ?? '')) return;
    setValue(raw);
    emitWith('commit', { value: raw });
  }

  // keyboard nav on the input: ArrowDown/Up move the active option through the
  // FILTERED list (wrap at ends), Enter commits the active option (falls back to a lone
  // filtered match). Escape closes. preventDefault only on the keys we handle so normal
  // typing/caret keys are untouched.
  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      if (filtered.length > 0) setActive((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      if (filtered.length > 0) setActive((i) => (i <= 0 ? filtered.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      const pick = active >= 0 && active < filtered.length ? filtered[active] : filtered.length === 1 ? filtered[0] : null;
      if (pick != null) {
        e.preventDefault();
        commit(pick.value, pick.label);
      } else {
        // No menu match — submit the raw typed query (the free-text on-demand path).
        e.preventDefault();
        commitQuery();
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  }

  return (
    <div className="relative w-full">
      <div
        className={cn(
          cbControl({ size, disabled }),
          // Resting-border precedence (family-wide rule): an explicit
          // borderColor wins over accent — the takeover only applies when no
          // borderColor is named.
          p.accent != null && p.borderColor == null && '[border-color:var(--fr-cb-accent)]',
        )}
        style={styleVars(
          { var: '--fr-cb-accent', value: p.accent, kind: 'color' },
          { var: '--fr-cb-border', value: p.borderColor, kind: 'color' },
          { var: '--fr-cb-bg', value: p.bg, kind: 'color' },
          // mutedColor reaches the input placeholder too (parity with the menu
          // empty-state and with MultiSelect's --fr-ms-muted placeholder routing).
          { var: '--fr-cb-muted', value: p.mutedColor, kind: 'color' },
          // exact corner radius → --fr-cb-radius wins over the var-chain default.
          { var: '--fr-cb-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        )}
      >
        <input
          className="h-full w-full border-0 bg-transparent font-[inherit] text-inherit outline-none placeholder:[color:var(--fr-cb-muted,var(--color-muted-foreground))]"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          // aria-activedescendant points at the keyboard-active option's id so a
          // screen reader announces the arrow-key highlight (undefined when none active).
          aria-activedescendant={activeId}
          aria-label={p.placeholder ?? 'Search'}
          placeholder={p.placeholder ?? undefined}
          value={q}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Let an option click register before closing; then commit the raw
            // query so blurring with partial/typed input still delivers a value.
            window.setTimeout(() => {
              setOpen(false);
              commitQuery();
            }, 120);
          }}
          // arrow-key nav + Enter-to-commit + Escape (the ARIA the control declares).
          onKeyDown={onInputKeyDown}
          onChange={(e) => {
            // State setter stays UNCONDITIONAL so bound spec.state (the query→value
            // path) and the visible input stay live; only the per-keystroke stream is
            // gated behind emitOnChange.
            setQuery(e.target.value);
            setOpen(true);
            if (p.emitOnChange !== false) emitWith('search', { query: e.target.value });
          }}
        />
        {/* The trailing chevron + loading spinner follow the mutedColor channel
            (token fallback in-var, byte-identical when unset) — parity with
            MultiSelect's chevron, which already routes through its muted var. */}
        {loading ? (
          <span
            className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent [color:var(--fr-cb-muted,var(--color-muted-foreground))]"
            aria-hidden
          />
        ) : (
          <span className="pointer-events-none shrink-0 [color:var(--fr-cb-muted,var(--color-muted-foreground))]" aria-hidden>
            <Icon name="chevron-down" size={16} />
          </span>
        )}
      </div>

      {open && !disabled && (
        <div
          className={cbMenu}
          role="listbox"
          style={styleVars(
            { var: '--fr-cb-accent', value: p.accent, kind: 'color' },
            { var: '--fr-cb-bg', value: p.bg, kind: 'color' },
            // borderColor covers the menu panel too (field box + menu group).
            { var: '--fr-cb-border', value: p.borderColor, kind: 'color' },
            { var: '--fr-cb-muted', value: p.mutedColor, kind: 'color' },
            { var: '--fr-cb-menu-w', value: p.menuWidth, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 720 } },
            { var: '--fr-cb-menu-mh', value: p.maxHeight, kind: 'dim', opts: { units: ['px', 'rem'], max: 600 } },
          ) as CSSProperties}
        >
          {filtered.length === 0 && !showCreate ? (
            <div className="px-2 py-1.5 text-sm [color:var(--fr-cb-muted,var(--color-muted-foreground))]">{p.emptyText ?? 'No matches'}</div>
          ) : (
            filtered.map((o, i) => {
              const isSel = o.value === value;
              // the keyboard-active row (arrow-key highlight). aria-selected marks
              // the active row for the aria-activedescendant contract; a faint token/accent
              // tint shows it visually (mutually-exclusive with the hover, added LAST).
              const isActive = i === active;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  id={optId(i)}
                  aria-selected={isActive}
                  className={cn(
                    'cursor-pointer flex w-full items-center gap-2 rounded-frayme px-2 py-1.5 text-left text-sm',
                    // Hover/focus from the EXISTING accent channel, mutually-exclusive
                    // with the token hover — never co-locate (an arbitrary
                    // [background:color-mix] hover would not dedupe the bg-* hover utility).
                    // Unset branch reproduces the exact prior trailing segment
                    // (hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:outline-none)
                    // verbatim → byte-identical.
                    p.accent != null
                      ? 'hover:[background:color-mix(in_srgb,var(--fr-cb-accent)_12%,transparent)] focus-visible:[background:color-mix(in_srgb,var(--fr-cb-accent)_12%,transparent)] focus-visible:outline-none'
                      : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:outline-none',
                    // active-row tint (keyboard highlight). LAST so it wins; only on
                    // the active row so a mouse-only session is byte-identical to before.
                    isActive && (p.accent != null
                      ? '[background:color-mix(in_srgb,var(--fr-cb-accent)_12%,transparent)]'
                      : 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]'),
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(o.value, o.label);
                  }}
                >
                  <span className="w-4 shrink-0 [color:var(--fr-cb-accent,var(--fr-accent))]">
                    {isSel && <Icon name="check" size={14} />}
                  </span>
                  {/* Same as MultiSelect's menu: the option label is the choice,
                      and the row is free to grow (px-2 py-1.5), so it wraps —
                      and, being leaf text, keeps its longest-word minimum
                      (no `min-w-0`) so the label cannot shatter per-character. */}
                  <span className="break-words" title={o.label || undefined}>{o.label}</span>
                </button>
              );
            })
          )}
          {showCreate && (
            <button
              type="button"
              className={cn(
                'cursor-pointer flex w-full items-center gap-2 rounded-frayme px-2 py-1.5 text-left text-sm',
                // Hover/focus from the EXISTING accent channel, mutually-exclusive
                // with the token hover — never co-locate the two hovers. Unset branch
                // reproduces the exact prior trailing segment verbatim → byte-identical.
                p.accent != null
                  ? 'hover:[background:color-mix(in_srgb,var(--fr-cb-accent)_12%,transparent)] focus-visible:[background:color-mix(in_srgb,var(--fr-cb-accent)_12%,transparent)] focus-visible:outline-none'
                  : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:outline-none',
                '[color:var(--fr-cb-accent,var(--fr-accent))]',
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(q.trim(), q.trim());
              }}
            >
              <span className="shrink-0">
                <Icon name="plus" size={14} />
              </span>
              {/* This row echoes back what the user just typed — clipping it
                  hides the very value they are about to create. Leaf text: no
                  `min-w-0`, so the echoed value keeps its longest-word floor
                  instead of collapsing to a one-character column. */}
              <span className="break-words">
                Create &ldquo;{q.trim()}&rdquo;
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── TagInput ─────────────────────────────────────────────────────────────── */

// The chip-entry field surface. Corner rounding is a var-chain so an exact
// radiusValue wins; the default stays byte-identical to the prior `rounded-frayme`
// (var(--radius-frayme)). NEVER co-locate `rounded-*` with the arbitrary
// border-radius var — tw-merge would keep both → inert.
const tiField = cva(
  'flex w-full flex-wrap items-center gap-1.5 border transition-[border-color,box-shadow] focus-within:ring-2 [border-color:var(--fr-ti-border,var(--color-border))] [background:var(--fr-ti-bg,var(--color-card))] [border-radius:var(--fr-ti-radius,var(--radius-frayme))] focus-within:[border-color:var(--fr-ti-accent,var(--fr-accent))] focus-within:[--tw-ring-color:color-mix(in_srgb,var(--fr-ti-accent,var(--fr-accent))_20%,transparent)]',
  {
    variants: {
      size: { sm: 'min-h-8 px-2 py-1 text-sm', md: 'min-h-10 px-2.5 py-1.5', lg: 'min-h-12 px-3 py-2 text-lg' },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', disabled: false },
  },
);

// NEUTRAL resting fill (bg-muted + text-foreground)
// when accent is unset; a 14%-accent-tint fill/text ONLY when the model
// names an accent — mutually-exclusive, never co-located (the arbitrary
// color-mix background/text would not dedupe against bg-muted/text-foreground).
const tiChipBase = 'inline-flex items-center gap-1 rounded-frayme px-2 py-0.5 text-[0.8125rem] font-medium';
const tiChipTint = '[background:color-mix(in_srgb,var(--fr-ti-accent,var(--color-primary))_14%,transparent)] [color:var(--fr-ti-accent,var(--color-foreground))]';

export function TagInput({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const emitWith = useIntrinsicEmit(emit, element);
  const p = (element.props ?? {}) as {
    value?: unknown;
    suggestions?: unknown;
    max?: number | null;
    placeholder?: string | null;
    size?: 'sm' | 'md' | 'lg' | null;
    disabled?: boolean | null;
    removable?: boolean | null;
    lockedTags?: unknown;
    accent?: string | null;
    borderColor?: string | null;
    bg?: string | null;
    mutedColor?: string | null;
    radiusValue?: string | number | null;
  };
  const [value, setValue] = useBoundProp<string[]>(safeStrings(p.value), bindings?.value);
  const tags = safeStrings(value);
  const suggestions = safeStrings(p.suggestions);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = p.disabled === true;
  const removable = p.removable ?? true;
  // Permission fidelity: tags in this set are system-applied — no chip
  // ×, Backspace skips them; the user can still add their own tags freely.
  const lockedTags = new Set(safeStrings(p.lockedTags));
  const max = typeof p.max === 'number' && Number.isFinite(p.max) ? p.max : undefined;
  const atMax = max != null && tags.length >= max;
  const [draft, setDraft] = useState('');
  // Stable, deterministic datalist id (slug of the placeholder) — NOT keyed on
  // tags.length, which would churn the id on every add/remove (briefly detaching
  // the input from its datalist) and collide across instances with equal counts.
  const listSlug = (p.placeholder ?? 'tags').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tags';
  const listId = suggestions.length > 0 ? `fr-ti-${listSlug}-suggest` : undefined;

  function add(raw: string): void {
    const t = raw.trim();
    if (t.length === 0 || disabled || atMax || tags.includes(t)) {
      setDraft('');
      return;
    }
    const next = [...tags, t];
    setValue(next);
    setDraft('');
    emitWith('change', { value: next, toggled: t, checked: true });
  }
  function removeAt(i: number): void {
    if (lockedTags.has(tags[i] ?? "")) return;
    if (disabled) return;
    const removed = tags[i] ?? null;
    const next = tags.filter((_, idx) => idx !== i);
    setValue(next);
    emitWith('change', { value: next, toggled: removed, checked: false });
  }

  return (
    <div
      className={cn(
        tiField({ size, disabled }),
        // Resting-border precedence (family-wide rule): an explicit borderColor
        // wins over accent — the takeover only applies when no borderColor is
        // named.
        p.accent != null && p.borderColor == null && '[border-color:var(--fr-ti-accent)]',
      )}
      style={styleVars(
        { var: '--fr-ti-accent', value: p.accent, kind: 'color' },
        { var: '--fr-ti-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-ti-bg', value: p.bg, kind: 'color' },
        // mutedColor tints the placeholder (parity with MultiSelect's --fr-ms-muted).
        { var: '--fr-ti-muted', value: p.mutedColor, kind: 'color' },
        // exact corner radius → --fr-ti-radius wins over the var-chain default.
        { var: '--fr-ti-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
    >
      {tags.map((t, i) => (
        <span key={`${t}-${i}`} className={cn(tiChipBase, 'max-w-full', p.accent != null ? tiChipTint : 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-[color:var(--fr-surface-fg,var(--color-foreground))]')}>
          {/* truncate EARNED, same contract as MultiSelect's chip: a tag is a
              single-line token in a flex-wrap min-h-* field, and `max-w-full`
              tracks the field width rather than fixing a rem cap — so it clips
              only past the full field, never because a sibling squeezed it. */}
          <span className="break-words" title={t || undefined}>{t}</span>
          {removable && !disabled && !lockedTags.has(t) && (
            <button
              type="button"
              className={chipRemoveHit}
              aria-label={`Remove ${t}`}
              onClick={() => removeAt(i)}
            >
              <Icon name="x" size={13} />
            </button>
          )}
        </span>
      ))}
      <input
        // HIT AREA (WCAG 2.5.8): the draft field is the control a user taps to
        // start typing a tag, and it had NO height of its own — border-0, no
        // padding, `font:inherit`, so its box was one inherited line box (20px at
        // the sm/`text-sm` field). Width was never the problem
        // (min-w-[6ch] + flex-1); the floor it missed was vertical.
        // min-h-6 costs no layout: the field's content box is already ≥24px at
        // every size (sm = min-h-8 − py-1·2 = 24, md 28, lg 32), and a chip in the
        // same wrapping row measures ~24px too, so the row height is unchanged.
        className="min-h-6 min-w-[6ch] flex-1 border-0 bg-transparent font-[inherit] text-inherit outline-none placeholder:[color:var(--fr-ti-muted,var(--color-muted-foreground))]"
        type="text"
        value={draft}
        list={listId}
        disabled={disabled}
        placeholder={tags.length === 0 ? (p.placeholder ?? 'Add a tag…') : undefined}
        aria-label={p.placeholder ?? 'Add a tag'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && draft.length === 0 && tags.length > 0) {
            for (let i = tags.length - 1; i >= 0; i--) { if (!lockedTags.has(tags[i])) { removeAt(i); break; } }
          }
        }}
      />
      {listId && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

/* ── SegmentedControl ─────────────────────────────────────────────────────── */

// The resting TRACK behind the pills reads the `trackColor` channel with a muted
// token fallback (an unset/invalid value is omitted by styleVars → token wins).
// Rail + pills share ONE --fr-sc-radius var-chain (one rounded control); the
// default stays byte-identical to the prior `rounded-frayme` (var(--radius-frayme)).
// NEVER co-locate `rounded-*` with the arbitrary border-radius var — tw-merge
// would keep both → inert.
// `min-w-0 max-w-full overflow-x-auto`: a control with many/long segments must
// SCROLL inside its own track on narrow containers (MCP panels) instead of
// forcing the whole page to scroll sideways (RSP-3). min-w-0 lets it shrink as a
// flex item; max-w-full caps it in a block parent; segments carry shrink-0 so
// they keep their size and the excess scrolls rather than squashing.
const scTrack = cva('inline-flex min-w-0 max-w-full overflow-x-auto [border-radius:var(--fr-sc-radius,var(--radius-frayme))] [background:var(--fr-sc-track,var(--fr-surface-sunken,var(--color-muted)))] p-1', {
  variants: {
    size: { sm: 'gap-0.5 text-sm', md: 'gap-1', lg: 'gap-1 text-lg' },
    fullWidth: { true: 'flex w-full', false: '' },
    disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
  },
  defaultVariants: { size: 'md', fullWidth: false, disabled: false },
});

const scSeg = cva(
  // The keyboard focus ring derives from the `accent` channel (primary token
  // fallback in-var, byte-identical when unset) — accent is set on the CONTAINER
  // so every segment's ring follows an accent-themed control, matching the rest
  // of the family.
  // A segment is a real control, so it carries the pointer; `disabled:` must
  // accompany it because cursor inherits — a bare cursor-pointer would override
  // the track's not-allowed cursor on a disabled control.
  'cursor-pointer disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 [border-radius:var(--fr-sc-radius,var(--radius-frayme))] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:[--tw-ring-color:var(--fr-sc-accent,var(--fr-accent))]',
  {
    variants: {
      size: { sm: 'px-2.5 py-1', md: 'px-3 py-1.5', lg: 'px-4 py-2' },
      // shrink-0 so an overflowing track SCROLLS the segments (they keep size)
      // rather than squashing them; flex-1 still stretches them when fullWidth.
      fullWidth: { true: 'flex-1', false: 'shrink-0' },
      // the resting (unselected) label reads the `mutedColor` channel via the
      // text-color GROUP form (muted-foreground token folded in as the in-var fallback →
      // byte-identical when unset). The chain gained a --fr-surface-muted step: the
      // TRACK under this label now follows the surface, and a resting label pinned to the
      // global token measured 1.9:1 on it (#52525b on #252831). The hover moved with the
      // 1c pass. Never a bare
      // [color:…] beside a token class — the group form IS the sole source.
      selected: { true: 'shadow-sm', false: 'text-[color:var(--fr-sc-muted,var(--fr-surface-muted,var(--color-muted-foreground)))] hover:text-[color:var(--fr-surface-fg,var(--color-foreground))]' },
    },
    defaultVariants: { size: 'md', fullWidth: false, selected: false },
  },
);

export function SegmentedControl({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    options?: unknown;
    label?: string | null;
    value?: string | null;
    size?: 'sm' | 'md' | 'lg' | null;
    fullWidth?: boolean | null;
    iconOnly?: boolean | null;
    accent?: string | null;
    accentText?: string | null;
    trackColor?: string | null;
    mutedColor?: string | null;
    connectorColor?: string | null;
    disabled?: boolean | null;
    radiusValue?: string | number | null;
  };
  const options = safeOptions(p.options);
  const [value, setValue] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const fullWidth = p.fullWidth === true;
  const iconOnly = p.iconOnly === true;
  const disabled = p.disabled === true;

  function select(val: string): void {
    if (disabled || val === value) return;
    setValue(val);
    emitWith('change', { value: val });
  }

  const label = typeof p.label === 'string' && p.label.length > 0 ? p.label : null;
  const track = (
    <div
      className={cn(scTrack({ size, fullWidth, disabled }))}
      role="group"
      aria-label={label ?? undefined}
      aria-disabled={disabled || undefined}
      // Track + connector are resting-state channels: the track rail behind the
      // pills (trackColor) and the thin dividers between unselected segments
      // (connectorColor). Both carry token fallbacks via styleVars omission.
      style={styleVars(
        { var: '--fr-sc-track', value: p.trackColor, kind: 'color' },
        { var: '--fr-sc-connector', value: p.connectorColor, kind: 'color' },
        // resting label colour — set on the CONTAINER so every unselected segment
        // reads it via the scSeg false-variant group form.
        { var: '--fr-sc-muted', value: p.mutedColor, kind: 'color' },
        // accent on the CONTAINER so every segment (not just the selected pill,
        // which also sets it inline) reads it for the focus ring.
        { var: '--fr-sc-accent', value: p.accent, kind: 'color' },
        // One exact corner radius shared by the rail + the pills (set on the
        // container so it cascades to the segment buttons); wins over the
        // var-chain default. The pill var-chain reads this inherited value.
        { var: '--fr-sc-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
    >
      {options.map((o, i) => {
        const isSel = o.value === value;
        const showIcon = typeof o.icon === 'string' && hasIcon(o.icon);
        // A 1px divider sits between two adjacent RESTING segments only — it is
        // suppressed beside the raised selected pill (whose surface replaces it).
        // EXCEPT when connectorColor is explicitly set: that is an explicit ask
        // for dividers, and the adjacency gate would otherwise render the channel
        // fully inert (e.g. middle-of-3 selected suppresses every divider).
        const prevSel = i > 0 && options[i - 1].value === value;
        const showDivider = i > 0 && (p.connectorColor != null || (!isSel && !prevSel));
        return (
          <Fragment key={o.value}>
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  'my-1 w-px self-stretch shrink-0',
                  showDivider ? '[background:var(--fr-sc-connector,var(--color-border))]' : 'bg-transparent',
                )}
              />
            )}
            <button
              type="button"
              aria-pressed={isSel}
              aria-label={iconOnly ? o.label : undefined}
              disabled={disabled}
              className={cn(
                scSeg({ size, fullWidth, selected: isSel }),
                // Selected pill: token surface by default, the model's accent when named.
                isSel && (p.accent != null ? '[background:var(--fr-sc-accent)]' : '[background:var(--fr-surface-raised,var(--color-card))]'),
                // Label color is an INDEPENDENT channel from the accent fill. With an
                // accent, fall back to the primary-foreground token so a saturated fill
                // never leaves the label at low contrast; without one, an explicit
                // accentText still applies (falling back to the default foreground token
                // if the value fails color validation and the var is omitted).
                isSel &&
                  (p.accent != null
                    ? '[color:var(--fr-sc-accent-text,var(--color-primary-foreground))]'
                    : p.accentText != null
                      ? '[color:var(--fr-sc-accent-text,var(--color-foreground))]'
                      : 'text-[color:var(--fr-surface-fg,var(--color-foreground))]'),
              )}
              style={
                isSel
                  ? styleVars(
                      { var: '--fr-sc-accent', value: p.accent, kind: 'color' },
                      { var: '--fr-sc-accent-text', value: p.accentText, kind: 'color' },
                    )
                  : undefined
              }
              onClick={() => select(o.value)}
            >
              {showIcon && (
                <span className="shrink-0">
                  <Icon name={o.icon as string} size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
                </span>
              )}
              {/* truncate EARNED: scTrack is a horizontally SCROLLING rail
                  (overflow-x-auto) and a resting segment is shrink-0, so the label
                  keeps its natural width and the excess scrolls — the clip never
                  fires. It only becomes live under `fullWidth`, where the segments
                  share one row by explicit contract (same deal as fitted Tabs). */}
              {!iconOnly && <span className="break-words" title={o.label || undefined}>{o.label}</span>}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
  // Unlabelled, the control is byte-identical to before. Labelled, it takes the
  // same label-over-control column every other field uses, so a labelled
  // neighbour in the same row lines up on the CONTROL line instead of sitting a
  // label's height higher.
  if (label == null) return track;
  return (
    <div className="flex w-fit flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {track}
    </div>
  );
}
