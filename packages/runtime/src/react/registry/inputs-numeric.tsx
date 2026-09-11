'use client';
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars, weightClass, trackingClass } from './_style.js';
import { Icon } from './icons.js';

/* Catalog group: NumberInput, RangeSlider, Rating, OTPInput.
 *
 * The value-ENTRY family — discrete numeric / code inputs that sit alongside the
 * base controls (Input/Select/Slider in forms.tsx). Same truly-dynamic contract
 * as Phases 1–4:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (color the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities. The class set stays a
 *     closed, build-time set (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing/absent
 *     value so the token fallback wins (props-less → polished).
 *
 * Defaults live in CVA `defaultVariants`, never the schema (schema props are
 * `.nullable()`), so a props-less spec still renders polished. Every array is
 * Array.isArray-guarded and every number Number.isFinite-filtered — a streamed
 * element can arrive before its props patch and must not crash. These are
 * RENDER-ONLY GenUI controls: they render state + emit signals; the host wires
 * the handlers (no privileged side effects). */

/** Clamp `n` into [lo, hi] (either bound may be undefined → unbounded). */
function clamp(n: number, lo?: number, hi?: number): number {
  let v = n;
  if (typeof lo === 'number' && Number.isFinite(lo) && v < lo) v = lo;
  if (typeof hi === 'number' && Number.isFinite(hi) && v > hi) v = hi;
  return v;
}

/* ── NumberInput ──────────────────────────────────────────────────────────── */

/* The bordered stepper group. `accent` drives the focus ring; border/bg route
   through their own vars. */
const numberWrap = cva(
  // `w-fit`: a stepper is a COMPACT control — inside a
  // flex-col FormField the default cross-axis stretch was blowing it up to a
  // full-width bordered bar with the −/value/+ clumped left.
  // An explicit width defeats stretch without touching vertical
  // alignment when the stepper sits in a horizontal row.
  'inline-flex w-fit items-center border transition-[border-color,box-shadow] focus-within:ring-2 [border-color:var(--fr-number-border,var(--color-border))] [background:var(--fr-number-bg,var(--color-card))] focus-within:[border-color:var(--fr-number-accent,var(--fr-accent))] focus-within:[--tw-ring-color:color-mix(in_srgb,var(--fr-number-accent,var(--fr-accent))_20%,transparent)]',
  {
    variants: {
      size: { sm: 'h-8 rounded-sm text-sm', md: 'h-10 rounded-frayme', lg: 'h-12 rounded-2xl text-lg' },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', disabled: false },
  },
);

// The −/+ glyphs are the same secondary-chrome role as prefix/suffix, so their
// resting colour reads the SAME muted var (token fallback inside — unset is
// byte-identical); hover keeps the conventional foreground pop. The focus ring
// binds the accent var so keyboard focus matches the field's focus treatment
// (previously unbound → Tailwind's currentColor default).
const stepButton = cva(
  'inline-flex h-full shrink-0 items-center justify-center text-[color:var(--fr-number-muted,var(--color-muted-foreground))] transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] hover:text-[color:var(--fr-surface-fg,var(--color-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:[--tw-ring-color:var(--fr-number-accent,var(--fr-accent))] disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      size: { sm: 'w-7', md: 'w-9', lg: 'w-11' },
      edge: { left: '', right: '' },
    },
    defaultVariants: { size: 'md', edge: 'left' },
  },
);

// ::placeholder joins the muted coherence group (DatePicker parity) — the var
// chain with the muted-foreground token inside, so unset stays byte-identical.
// entered-value text color routes through --fr-number-fg with `inherit`
// as the in-var fallback (byte-identical to the prior text-inherit unset) — so a
// dark custom `bg` can pair with a readable value color.
const numberControl = cva('h-full min-w-0 border-0 bg-transparent text-center font-[inherit] tabular-nums [color:var(--fr-number-fg,inherit)] outline-none placeholder:text-[color:var(--fr-number-muted,var(--color-muted-foreground))]', {
  variants: {
    size: { sm: 'w-12 px-1 text-sm', md: 'w-16 px-1.5', lg: 'w-20 px-2 text-lg' },
  },
  defaultVariants: { size: 'md' },
});

export function NumberInput({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    value?: number | null;
    min?: number | null;
    max?: number | null;
    step?: number | null;
    label?: string | null;
    placeholder?: string | null;
    prefix?: string | null;
    suffix?: string | null;
    size?: 'sm' | 'md' | 'lg' | null;
    disabled?: boolean | null;
    accent?: string | null;
    borderColor?: string | null;
    bg?: string | null;
    mutedColor?: string | null;
    color?: string | null;
    emitOnChange?: boolean | null;
  };
  const [value, setValue] = useBoundProp<number>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = (p.disabled ?? false) as true | false;
  const min = typeof p.min === 'number' && Number.isFinite(p.min) ? p.min : undefined;
  const max = typeof p.max === 'number' && Number.isFinite(p.max) ? p.max : undefined;
  const step = typeof p.step === 'number' && Number.isFinite(p.step) && p.step > 0 ? p.step : 1;
  const current = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  const atMin = current != null && min != null && current <= min;
  const atMax = current != null && max != null && current >= max;
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;
  /* A field label. Stepper, TimeInput, ColorPicker, PhoneInput and PinInput all
     render one; NumberInput was the only numeric control without it, so a
     `label: "Target price"` produced a bare "$" box. Same caption
     treatment as those siblings, and it also NAMES the input — the aria-label
     used to fall back to the literal string "Number". */
  const label = typeof p.label === 'string' && p.label.length > 0 ? p.label : null;

  const nudge = (dir: 1 | -1) => {
    if (disabled) return;
    const base = current ?? min ?? 0;
    const next = clamp(base + dir * step, min, max);
    setValue(next);
    emitWith('change', { value: next });
  };

  const control = (
    <div
      className={cn(numberWrap({ size, disabled }))}
      style={styleVars(
        { var: '--fr-number-accent', value: p.accent, kind: 'color' },
        { var: '--fr-number-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-number-bg', value: p.bg, kind: 'color' },
        { var: '--fr-number-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-number-fg', value: p.color, kind: 'color' },
      )}
    >
      <button
        type="button"
        className={cn(stepButton({ size, edge: 'left' }))}
        aria-label="Decrease"
        disabled={disabled || atMin}
        onClick={() => nudge(-1)}
      >
        <Icon name="minus" size={iconSize} />
      </button>
      {p.prefix != null && <span className="pl-1 text-sm [color:var(--fr-number-muted,var(--color-muted-foreground))]">{p.prefix}</span>}
      <input
        className={cn(numberControl({ size }))}
        type="number"
        role="spinbutton"
        inputMode="decimal"
        placeholder={p.placeholder ?? undefined}
        value={current ?? ''}
        disabled={p.disabled ?? undefined}
        min={min}
        max={max}
        step={step}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-label={label ?? p.placeholder ?? 'Number'}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            setValue(undefined as never);
            if (p.emitOnChange !== false) emitWith('change', { value: null });
            return;
          }
          const n = Number(raw);
          if (!Number.isFinite(n)) return;
          const next = clamp(n, min, max);
          setValue(next);
          if (p.emitOnChange !== false) emitWith('change', { value: next });
        }}
      />
      {p.suffix != null && <span className="pr-1 text-sm [color:var(--fr-number-muted,var(--color-muted-foreground))]">{p.suffix}</span>}
      <button
        type="button"
        className={cn(stepButton({ size, edge: 'right' }))}
        aria-label="Increase"
        disabled={disabled || atMax}
        onClick={() => nudge(1)}
      >
        <Icon name="plus" size={iconSize} />
      </button>
    </div>
  );

  if (label === null) return control;
  // <label> wrapping the control, the same caption treatment the sibling
  // specialised inputs use (break-words, never truncate: it sits alone in a
  // column above its control, so a clip only ever deletes words).
  return (
    <label className="inline-flex flex-col gap-1.5">
      <span className="break-words text-sm font-medium text-foreground" title={label}>{label}</span>
      {control}
    </label>
  );
}

/* ── RangeSlider ──────────────────────────────────────────────────────────── */

/* The active range fill reads `accent`; the inactive track reads `trackColor`.
   Both fall back to tokens. */
const rangeRoot = cva('[width:var(--fr-range-w,100%)] max-w-full', {
  variants: {
    disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
  },
  defaultVariants: { disabled: false },
});

const rangeTrack = cva('relative w-full rounded-full [background:var(--fr-range-track,var(--color-border))]', {
  variants: {
    size: { sm: 'h-1', md: 'h-1.5', lg: 'h-2' },
  },
  defaultVariants: { size: 'md' },
});

const rangeThumb = cva(
  'pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow-sm [background:var(--fr-range-accent,var(--fr-accent))]',
  {
    variants: {
      size: { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' },
    },
    defaultVariants: { size: 'md' },
  },
);

export function RangeSlider({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    min?: number | null;
    max?: number | null;
    step?: number | null;
    valueMin?: number | null;
    valueMax?: number | null;
    showHistogram?: boolean | null;
    histogram?: number[] | null;
    marks?: boolean | null;
    showValues?: boolean | null;
    valuePrefix?: string | null;
    valueSuffix?: string | null;
    size?: 'sm' | 'md' | 'lg' | null;
    width?: string | number | null;
    disabled?: boolean | null;
    accent?: string | null;
    trackColor?: string | null;
    mutedColor?: string | null;
    emitOnChange?: boolean | null;
  };
  const [vMin, setVMin] = useBoundProp<number>(p.valueMin ?? undefined, bindings?.valueMin);
  const [vMax, setVMax] = useBoundProp<number>(p.valueMax ?? undefined, bindings?.valueMax);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = (p.disabled ?? false) as true | false;
  const min = typeof p.min === 'number' && Number.isFinite(p.min) ? p.min : 0;
  const max = typeof p.max === 'number' && Number.isFinite(p.max) ? p.max : 100;
  const span = max > min ? max - min : 1;
  const step = typeof p.step === 'number' && Number.isFinite(p.step) && p.step > 0 ? p.step : 1;

  const lo = clamp(typeof vMin === 'number' && Number.isFinite(vMin) ? vMin : min, min, max);
  const hi = clamp(typeof vMax === 'number' && Number.isFinite(vMax) ? vMax : max, min, max);
  // Keep lo <= hi for the visual fill regardless of authoring order.
  const loV = Math.min(lo, hi);
  const hiV = Math.max(lo, hi);
  const loPct = ((loV - min) / span) * 100;
  const hiPct = ((hiV - min) / span) * 100;

  const bars = (Array.isArray(p.histogram) ? p.histogram : []).filter((n): n is number => Number.isFinite(n));
  const barMax = bars.reduce((m, n) => (n > m ? n : m), 0);
  const showHist = p.showHistogram === true && bars.length > 0;
  // selected-band readout. `showValues` renders a "lo – hi" label above
  // the track, currency/unit-decorated via valuePrefix/valueSuffix (default off).
  const vPrefix = typeof p.valuePrefix === 'string' ? p.valuePrefix : '';
  const vSuffix = typeof p.valueSuffix === 'string' ? p.valueSuffix : '';
  const fmt = (n: number) => `${vPrefix}${n}${vSuffix}`;

  const onLow = (n: number) => {
    if (disabled) return;
    const next = clamp(n, min, hiV); // never cross the upper thumb
    setVMin(next);
    if (p.emitOnChange !== false) emitWith('change', { valueMin: next, valueMax: hiV });
  };
  const onHigh = (n: number) => {
    if (disabled) return;
    const next = clamp(n, loV, max); // never cross the lower thumb
    setVMax(next);
    if (p.emitOnChange !== false) emitWith('change', { valueMin: loV, valueMax: next });
  };

  return (
    <div
      className={cn(rangeRoot({ disabled }))}
      role="group"
      aria-label="Range"
      style={styleVars(
        { var: '--fr-range-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 900 } },
        { var: '--fr-range-accent', value: p.accent, kind: 'color' },
        { var: '--fr-range-track', value: p.trackColor, kind: 'color' },
        { var: '--fr-range-muted', value: p.mutedColor, kind: 'color' },
      )}
    >
      {p.showValues === true && (
        <div className="mb-1 flex justify-center text-sm font-medium tabular-nums [color:var(--fr-range-muted,var(--color-muted-foreground))]" aria-hidden>
          {fmt(loV)} – {fmt(hiV)}
        </div>
      )}
      {showHist && (
        <div className="flex h-8 items-end gap-px" aria-hidden>
          {bars.map((h, i) => {
            const center = (i / Math.max(bars.length - 1, 1)) * 100;
            const inRange = center >= loPct && center <= hiPct;
            return (
              <span
                key={i}
                // 'inactive surfaces' coherence group: out-of-range bars read the
                // SAME trackColor var as the inactive track — the muted token stays
                // the fallback INSIDE the var so unset bars are byte-identical.
                className={cn('flex-1 rounded-t-[1px]', inRange ? '[background:var(--fr-range-accent,var(--fr-accent))]' : '[background:var(--fr-range-track,var(--color-muted))]')}
                style={{ height: `${barMax > 0 ? Math.max((h / barMax) * 100, 4) : 4}%` }}
              />
            );
          })}
        </div>
      )}
      <div className={cn(rangeTrack({ size }), 'my-3')}>
        {/* active selected segment */}
        <span
          className="absolute top-0 bottom-0 rounded-full [background:var(--fr-range-accent,var(--fr-accent))]"
          style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
        />
        {/* two overlaid native range inputs — SSR-safe, no measuring.
            HIT AREA (WCAG 2.5.8, 24×24 CSS px): these inputs used to be `inset-0
            h-full`, i.e. exactly the TRACK's height — 4px at size sm, 6px md, 8px
            lg. The native ::-webkit-slider-thumb / ::-moz-range-thumb is 1.25rem
            (frayme.css), so it overflowed a 6px-tall box and we were relying on
            engines hit-testing an overflowing pseudo-element — which webkit does
            and Gecko's ::-moz-range-thumb does NOT reliably. Centring a 24px-tall
            box on the track (top-1/2 + -translate-y-1/2, min-h-6 so h-full still
            wins when a future track is taller) puts the whole thumb inside its own
            element box in every engine.
            Safe because frayme.css already sets `pointer-events:none` on the input
            and `auto` on the thumb ONLY — that is what keeps the two overlaid
            thumbs independently grabbable — so the taller box captures nothing it
            did not already capture, and the histogram/marks around it stay clickable.
            REJECTED: growing the visible track to 24px. The track is the component's
            whole visual identity at 4-8px and a 24px bar reads as a progress meter.
            RESIDUAL: the thumb pseudo itself is still 1.25rem = 20px WIDE, 4px short
            of 24 on the horizontal axis. That size lives in
            packages/runtime/src/styles/frayme.css (unlayered, so no className can
            override it) — see the report. */}
        <input
          type="range"
          className="fr-range-thumb absolute inset-x-0 top-1/2 m-0 h-full min-h-6 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent"
          min={min}
          max={max}
          step={step}
          value={loV}
          disabled={disabled ? true : undefined}
          aria-label="Minimum"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={loV}
          onChange={(e) => onLow(Number(e.target.value))}
        />
        <input
          type="range"
          className="fr-range-thumb absolute inset-x-0 top-1/2 m-0 h-full min-h-6 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent"
          min={min}
          max={max}
          step={step}
          value={hiV}
          disabled={disabled ? true : undefined}
          aria-label="Maximum"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={hiV}
          onChange={(e) => onHigh(Number(e.target.value))}
        />
        {/* visible thumb handles (decorative; the native inputs above carry interaction) */}
        <span className={cn(rangeThumb({ size }))} style={{ left: `${loPct}%` }} aria-hidden />
        <span className={cn(rangeThumb({ size }))} style={{ left: `${hiPct}%` }} aria-hidden />
      </div>
      {p.marks === true && (
        <div className="flex justify-between text-[0.6875rem] tabular-nums [color:var(--fr-range-muted,var(--color-muted-foreground))]">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}

/* ── Rating ───────────────────────────────────────────────────────────────── */

/* Filled icons read `color` (warning fallback); empty are muted. `accent` is the
   hover-preview color when interactive. */
const ratingRoot = cva('inline-flex items-center', {
  variants: {
    size: { sm: 'gap-0.5', md: 'gap-1', lg: 'gap-1.5' },
  },
  defaultVariants: { size: 'md' },
});

export function Rating({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    value?: number | null;
    max?: number | null;
    icon?: 'star' | 'heart' | null;
    allowHalf?: boolean | null;
    readOnly?: boolean | null;
    size?: 'sm' | 'md' | 'lg' | null;
    color?: string | null;
    accent?: string | null;
    mutedColor?: string | null;
    emitOnChange?: boolean | null;
  };
  const [value, setValue, frozen] = useBoundProp<number>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const iconName = p.icon === 'heart' ? 'heart' : 'star';
  const rawMax = typeof p.max === 'number' && Number.isFinite(p.max) ? Math.floor(p.max) : 5;
  const max = Math.min(Math.max(rawMax, 1), 20);
  const rawVal = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const current = Math.min(Math.max(rawVal, 0), max);
  /* Rating freezes through readOnly, NOT a new `disabled`. It already declares
     readOnly ("display-only — no hover/click") and the renderer honours it fully:
     it gates the click handler (:436), the hover preview (:422), the glyph branch
     (:467) and the ARIA role (:496). Adding a second prop that means the same thing
     would give an author two ways to say it and the model two shapes to learn —
     the ambiguity that produced the headerColor mess. `frozen` is the param freeze
     from useLocalOrBound, true once an action this control feeds has committed. */
  const readOnly = p.readOnly === true || frozen;
  const allowHalf = p.allowHalf === true;
  const glyphSize = size === 'sm' ? 16 : size === 'lg' ? 28 : 22;

  // interactive hover-preview. While the pointer is over icon N, icons
  // 1..N fill in the accent treatment (whole steps, no half); mouseleave reverts
  // to `value`. Keyboard focus does NOT preview (ring only). Motion-free.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const previewing = !readOnly && hoverIndex != null;
  // The fill boundary: the hovered count while previewing, else the bound value.
  const shown = previewing ? hoverIndex! : current;

  const fillFor = (i: number): 'full' | 'half' | 'empty' => {
    const pos = i + 1;
    // Preview fills whole steps only (no half) up to the hovered icon.
    if (previewing) return shown >= pos ? 'full' : 'empty';
    if (current >= pos) return 'full';
    if (allowHalf && current >= pos - 0.5) return 'half';
    return 'empty';
  };

  const set = (n: number) => {
    if (readOnly) return;
    setValue(n);
    emitWith('change', { value: n });
  };

  const icons = Array.from({ length: max }, (_, i) => {
    const fill = fillFor(i);
    const glyph = (
      <span className="relative inline-flex">
        {/* empty/base layer — unfilled icon color routes through the
            settable mutedColor channel (muted-foreground token fallback inside). */}
        <span className="inline-flex [color:var(--fr-rating-muted,var(--color-muted-foreground))]">
          <Icon name={iconName} size={glyphSize} />
        </span>
        {/* filled overlay, clipped to half when needed. During hover-preview the
            fill reads the accent; resting fill reads `color`. */}
        {fill !== 'empty' && (
          <span
            className={cn(
              'absolute inset-0 inline-flex overflow-hidden',
              previewing
                ? '[color:var(--fr-rating-accent,var(--fr-accent))]'
                : '[color:var(--fr-rating-fill,var(--color-warning))]',
              fill === 'half' && 'w-1/2',
            )}
          >
            <Icon name={iconName} size={glyphSize} filled />
          </span>
        )}
      </span>
    );
    if (readOnly) return <span key={i}>{glyph}</span>;
    return (
      <button
        key={i}
        type="button"
        role="radio"
        aria-checked={Math.round(current) === i + 1}
        aria-label={`${i + 1} of ${max}`}
        // HIT AREA (WCAG 2.5.8): the button was shrink-wrapped to the glyph, so the
        // target was 16×16 at size sm and 22×22 at md (the DEFAULT) — only lg's 28px
        // cleared 24. min-h-6/min-w-6 (not h-6/w-6) so lg keeps its 28px box.
        // REJECTED: a 24×24 ::before overlay like InlineCitation's. Stars sit 2-6px
        // apart, so 24px overlays would OVERLAP and the later star would win the
        // shared band — on a value picker, hitting the neighbour is worse than a
        // small target. Growing the boxes makes them tile instead: at the md default
        // this is +1px per side per star, at sm +4px.
        className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fr-rating-accent,var(--fr-accent))]"
        onMouseEnter={() => setHoverIndex(i + 1)}
        onMouseLeave={() => setHoverIndex(null)}
        onClick={() => set(i + 1)}
      >
        {glyph}
      </button>
    );
  });

  return (
    <span
      className={cn(ratingRoot({ size }))}
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={readOnly ? `Rated ${current} of ${max}` : 'Rating'}
      style={styleVars(
        { var: '--fr-rating-fill', value: p.color, kind: 'color' },
        { var: '--fr-rating-accent', value: p.accent ?? p.color, kind: 'color' },
        { var: '--fr-rating-muted', value: p.mutedColor, kind: 'color' },
      )}
    >
      {icons}
    </span>
  );
}

/* ── OTPInput ─────────────────────────────────────────────────────────────── */

/* A row of single-char segment boxes. The active/next segment shows the accent
   ring; resting border/bg route through their own vars. */
// entered-char color routes through --fr-otp-fg (foreground token
// fallback inside — byte-identical unset). size sets the DEFAULT radius
// var (byte-identical to the prior rounded-*); an exact radiusValue →
// --fr-otp-radius wins via the exact→default chain.
const otpBox = cva(
  // The focused cell must not fall back to the browser's native (blue) :focus
  // outline — suppress it and paint the SAME neutral accent ring the `active`
  // (next-to-fill) box uses, so a cell focused by click/keyboard reads neutral too.
  'inline-flex items-center justify-center border text-center font-[inherit] font-medium tabular-nums [color:var(--fr-otp-fg,var(--color-foreground))] transition-[border-color,box-shadow] [border-radius:var(--fr-otp-radius,var(--fr-otp-radius-default,var(--radius-frayme)))] [border-color:var(--fr-otp-border,var(--color-border))] [background:var(--fr-otp-bg,var(--color-card))] focus:outline-none focus:ring-2 focus:[--tw-ring-color:color-mix(in_srgb,var(--fr-otp-accent,var(--fr-accent))_20%,transparent)] focus:[border-color:var(--fr-otp-accent,var(--fr-accent))]',
  {
    variants: {
      size: {
        sm: 'h-9 w-8 [--fr-otp-radius-default:0.25rem] text-sm',
        md: 'h-11 w-10 [--fr-otp-radius-default:var(--radius-frayme)] text-lg',
        lg: 'h-14 w-12 [--fr-otp-radius-default:1rem] text-2xl',
      },
      active: {
        true: 'ring-2 [border-color:var(--fr-otp-accent,var(--fr-accent))] [--tw-ring-color:color-mix(in_srgb,var(--fr-otp-accent,var(--fr-accent))_20%,transparent)]',
        false: '',
      },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', active: false, disabled: false },
  },
);

export function OTPInput({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    length?: number | null;
    value?: string | null;
    mask?: boolean | null;
    pattern?: 'numeric' | 'alphanumeric' | null;
    size?: 'sm' | 'md' | 'lg' | null;
    disabled?: boolean | null;
    accent?: string | null;
    borderColor?: string | null;
    bg?: string | null;
    color?: string | null;
    radiusValue?: string | number | null;
    label?: string | null;
    weight?: string | null;
    tracking?: string | null;
    groupSize?: number | null;
    separator?: string | null;
    emitOnChange?: boolean | null;
  };
  const [value, setValue] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = (p.disabled ?? false) as true | false;
  const rawLen = typeof p.length === 'number' && Number.isFinite(p.length) ? Math.floor(p.length) : 6;
  const length = Math.min(Math.max(rawLen, 2), 12);
  const pattern = p.pattern === 'alphanumeric' ? 'alphanumeric' : 'numeric';
  const allowed = pattern === 'numeric' ? /[^0-9]/g : /[^0-9a-zA-Z]/g;
  const code = (value ?? '').replace(allowed, '').slice(0, length);
  const filledLen = code.length;
  // optional visual grouping (e.g. 3-3). A separator is drawn AFTER every
  // `groupSize` boxes except the last group; groupSize<1 or >= length is inert.
  const rawGroup = typeof p.groupSize === 'number' && Number.isFinite(p.groupSize) ? Math.floor(p.groupSize) : 0;
  const groupSize = rawGroup > 0 && rawGroup < length ? rawGroup : 0;
  const separator = typeof p.separator === 'string' && p.separator.length > 0 ? p.separator : '-';

  const write = (next: string) => {
    if (disabled) return;
    const clean = next.replace(allowed, '').slice(0, length);
    setValue(clean);
    if (p.emitOnChange !== false) emitWith('change', { value: clean });
    // Fire 'commit' only on the transition into a full code (not on every
    // keystroke while it stays full — e.g. editing the last segment).
    if (clean.length === length && code.length < length) emitWith('commit', { value: clean });
  };

  const row = (
    <div
      className={cn('inline-flex gap-2', groupSize > 0 && 'items-center', disabled && 'cursor-not-allowed opacity-60')}
      role="group"
      aria-label={p.label ?? 'One-time code'}
      style={styleVars(
        { var: '--fr-otp-accent', value: p.accent, kind: 'color' },
        { var: '--fr-otp-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-otp-bg', value: p.bg, kind: 'color' },
        { var: '--fr-otp-fg', value: p.color, kind: 'color' },
        { var: '--fr-otp-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
    >
      {Array.from({ length }, (_, i) => {
        const ch = code[i] ?? '';
        const isActive = i === filledLen && !disabled;
        // group separator drawn between box i-1 and box i when at a group boundary
        // (only when grouped — unset groupSize yields the bare input row).
        const showSep = groupSize > 0 && i > 0 && i % groupSize === 0;
        const box = (
          <input
            key={i}
            className={cn(otpBox({ size, active: isActive, disabled }))}
            type="text"
            inputMode={pattern === 'numeric' ? 'numeric' : 'text'}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={ch ? (p.mask === true ? '•' : ch) : ''}
            disabled={p.disabled ?? undefined}
            aria-label={`${pattern === 'numeric' ? 'Digit' : 'Character'} ${i + 1}`}
            onChange={(e) => {
              const typed = e.target.value.replace(allowed, '');
              if (typed === '') {
                // backspace/clear this segment
                write(code.slice(0, i));
                return;
              }
              // append the latest char onto the confirmed prefix
              write(code.slice(0, i) + typed.slice(-1));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && ch === '' && i > 0) {
                write(code.slice(0, i - 1));
              }
            }}
          />
        );
        if (!showSep) return box;
        return [
          <span key={`sep-${i}`} className="select-none [color:var(--fr-otp-fg,var(--color-foreground))]" aria-hidden>
            {separator}
          </span>,
          box,
        ];
      })}
    </div>
  );

  // an optional field label above the segments (family parity). Unset →
  // the bare box row (byte-identical). The row carries its own role=group label.
  if (p.label == null) return row;
  return (
    <div className="inline-flex flex-col gap-1.5">
      <span
        className={cn(
          // break-words, never truncate: the caption sits alone in a COLUMN above
          // the segment row, so nothing shares its width — a clip only ever
          // deleted words. Wrapping costs a line.
          'break-words text-sm font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))]',
          // typography channels dedupe-win their tw-merge group; unset → cn drops.
          weightClass(p.weight),
          trackingClass(p.tracking),
        )}
        title={p.label || undefined}
      >
        {p.label}
      </span>
      {row}
    </div>
  );
}
