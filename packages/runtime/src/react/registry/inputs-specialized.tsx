'use client';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars, weightClass, trackingClass } from './_style.js';
import { safeColor } from '@frayme/catalog/validate';
import { Icon } from './icons.js';

/* Catalog group: ColorPicker, TimePicker, QuantityStepper, PhoneInput, CopyButton.
 *
 * The specialized value-ENTRY family — niche inputs
 * that round out the form controls. Same truly-dynamic contract as the rest of
 * the catalog:
 *   - ENUM props (size/variant) → static CVA classes (the bounded menu).
 *   - VALUE props (a color the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities, OR are re-validated via
 *     `safeColor` at point-of-use (the swatch fills). The class set stays a
 *     closed, build-time set (no JIT, no injection); only a var's VALUE is
 *     model-supplied, and `styleVars`/`safeColor` re-validate + omit any failing
 *     value so the token fallback wins (props-less → polished).
 *
 * Defaults live in CVA `defaultVariants` / `?? defaults`, never the schema. Every
 * array is Array.isArray-guarded and every number Number.isFinite-filtered — a
 * streamed element can arrive before its props patch and must not crash. These
 * are RENDER-ONLY GenUI controls: they render state + emit signals; the host
 * wires the handlers (CopyButton is the one exception — its clipboard write is a
 * safe, self-contained browser action that needs no host). */

/** Clamp `n` into [lo, hi] (either bound may be undefined → unbounded). */
function clamp(n: number, lo?: number, hi?: number): number {
  let v = n;
  if (typeof lo === 'number' && Number.isFinite(lo) && v < lo) v = lo;
  if (typeof hi === 'number' && Number.isFinite(hi) && v > hi) v = hi;
  return v;
}

/* ── ColorPicker ──────────────────────────────────────────────────────────── */

/* A default token-based palette so a props-less spec still shows real swatches.
   These are concrete safe hex values (validated again at render via safeColor). */
const DEFAULT_SWATCHES = ['#2563eb', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#0891b2', '#64748b', '#0f172a', '#f1f5f9', '#ffffff'];

const swatchSize = cva('', {
  variants: {
    size: { sm: 'h-6 w-6', md: 'h-7 w-7', lg: 'h-9 w-9' },
  },
  defaultVariants: { size: 'md' },
});

// preview chip border/bg route through the ColorPicker's own channels
// (family parity with TimePicker/QuantityStepper/PhoneInput). Token fallbacks
// live INSIDE the var so an unset picker is byte-identical. radiusValue
// overrides the default rounded-frayme via the exact→default var chain.
const previewChip = cva('inline-block border [border-radius:var(--fr-cp-radius,var(--radius-frayme))] [border-color:var(--fr-colorpicker-border,var(--color-border))] [background:var(--fr-colorpicker-bg,var(--color-card))]', {
  variants: {
    size: { sm: 'h-6 w-6', md: 'h-8 w-8', lg: 'h-10 w-10' },
  },
  defaultVariants: { size: 'md' },
});

export function ColorPicker({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    value?: string | null;
    swatches?: Array<{ color?: string | null; label?: string | null }> | null;
    showInput?: boolean | null;
    columns?: string | number | null;
    accent?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    radiusValue?: string | number | null;
    size?: 'sm' | 'md' | 'lg' | null;
    label?: string | null;
    weight?: string | null;
    tracking?: string | null;
    disabled?: boolean | null;
    emitOnChange?: boolean | null;
    mutedColor?: string | null;
  };
  const [value, setValue] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = p.disabled === true;
  const showInput = p.showInput !== false;

  // Build the swatch list — validate each color, fall back to defaults.
  const raw = Array.isArray(p.swatches) && p.swatches.length > 0
    ? p.swatches.map((s) => ({ color: safeColor(s?.color), label: typeof s?.label === 'string' ? s.label : null }))
    : DEFAULT_SWATCHES.map((c) => ({ color: safeColor(c), label: null }));
  const swatches = raw.filter((s): s is { color: string; label: string | null } => s.color !== null);

  const current = typeof value === 'string' ? value : undefined;
  const currentSafe = safeColor(current);

  const choose = (c: string) => {
    if (disabled) return;
    setValue(c);
    if (p.emitOnChange !== false) emitWith('change', { value: c });
  };
  // A swatch click is a DISCRETE PICK — it must ALWAYS reach the host, never be
  // silenced by emitOnChange. `choose` is shared with the hex <input> stream
  // (typing), so keep its `change` gated there; give the swatch its own
  // unconditional emit of the same `change` verb.
  const pick = (c: string) => {
    if (disabled) return;
    setValue(c);
    emitWith('change', { value: c });
  };

  return (
    <div
      className={cn('inline-flex flex-col gap-2', disabled && 'cursor-not-allowed opacity-60')}
      role="group"
      aria-label={p.label ?? 'Color picker'}
      style={styleVars(
        { var: '--fr-colorpicker-accent', value: p.accent, kind: 'color' },
        { var: '--fr-colorpicker-cols', value: p.columns ?? 6, kind: 'dim', opts: { kind: 'count', min: 1, max: 12 } },
        { var: '--fr-colorpicker-muted', value: p.mutedColor, kind: 'color' },
        // bg/border for the preview chip + hex field; exact radius.
        { var: '--fr-colorpicker-bg', value: p.bg, kind: 'color' },
        { var: '--fr-colorpicker-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-cp-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
    >
      {p.label != null && (
        <span
          className={cn(
            // break-words, never truncate: this caption sits alone in a COLUMN
            // above its control, so there is no sibling it could be sharing width
            // with — a clip here only ever deleted words the control cannot
            // re-explain. Wrapping costs a line.
            'break-words text-sm font-medium text-foreground',
            // typography channels: a SET value dedupe-wins its tw-merge group over
            // the baked font-medium; unset → undefined → cn drops it →
            // byte-identical default. Placed LAST so the override wins.
            weightClass(p.weight),
            trackingClass(p.tracking),
          )}
          title={p.label}
        >
          {p.label}
        </span>
      )}
      <div className="flex items-center gap-3">
        <span
          className={cn(previewChip({ size }), 'shrink-0')}
          aria-hidden
          style={currentSafe ? { background: currentSafe } : undefined}
        />
        {/* The hex readout is the picker's ONLY textual answer — "#7c3aed" clipped
            to "#7c3…" is worse than a broken line, so it wraps. It is leaf text,
            so it carries no `min-w-0`: the hex string is one token and its own
            width is the floor the readout keeps; `break-words` still breaks it
            if the frame is narrower than the token itself. The chip beside it
            is shrink-0 and never squeezes it back. */}
        <span className="break-words text-sm tabular-nums [color:var(--fr-colorpicker-muted,var(--color-muted-foreground))]" title={current ?? 'No color'}>{current ?? 'No color'}</span>
      </div>
      <div className="grid gap-1.5 [grid-template-columns:repeat(var(--fr-colorpicker-cols,6),minmax(0,1fr))]">
        {swatches.map((s, i) => {
          const selected = currentSafe != null && safeColor(s.color) === currentSafe;
          return (
            <button
              key={`${s.color}-${i}`}
              type="button"
              aria-label={s.label ?? s.color}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => pick(s.color)}
              className={cn(
                swatchSize({ size }),
                // `disabled:` must accompany the pointer here: cursor inherits, so a
                // bare cursor-pointer would override the group's not-allowed cursor.
                'cursor-pointer disabled:cursor-not-allowed rounded-md border border-border/60 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fr-colorpicker-accent,var(--fr-accent))]',
                selected && 'ring-2 ring-offset-2 ring-offset-card ring-[var(--fr-colorpicker-accent,var(--fr-accent))]',
              )}
              style={{ background: s.color }}
            />
          );
        })}
      </div>
      {showInput && (
        <input
          type="text"
          inputMode="text"
          spellCheck={false}
          placeholder="#000000"
          value={current ?? ''}
          disabled={disabled}
          aria-label="Hex color value"
          onChange={(e) => choose(e.target.value)}
          className="h-9 w-32 border px-2 font-mono text-sm tabular-nums text-foreground outline-none transition-[border-color,box-shadow] [border-radius:var(--fr-cp-radius,var(--radius-frayme))] [border-color:var(--fr-colorpicker-border,var(--color-border))] [background:var(--fr-colorpicker-bg,var(--color-card))] focus:[border-color:var(--fr-colorpicker-accent,var(--fr-accent))] focus:ring-2 focus:[--tw-ring-color:color-mix(in_srgb,var(--fr-colorpicker-accent,var(--fr-accent))_20%,transparent)]"
        />
      )}
    </div>
  );
}

/* ── TimePicker ───────────────────────────────────────────────────────────── */

// radiusValue channel family-wide. Each size sets the DEFAULT radius var
// (byte-identical to the prior rounded-* — sm=0.25rem · md=var(--radius-frayme)
// · lg=1rem); an exact `radiusValue` lands in --fr-time-radius and wins via the
// exact→default var chain, so the enum + the value channel never collide.
const timeWrap = cva(
  'inline-flex items-center gap-2 border transition-[border-color,box-shadow] focus-within:ring-2 [border-radius:var(--fr-time-radius,var(--fr-time-radius-default,var(--radius-frayme)))] [border-color:var(--fr-time-border,var(--color-border))] [background:var(--fr-time-bg,var(--color-card))] focus-within:[border-color:var(--fr-time-accent,var(--fr-accent))] focus-within:[--tw-ring-color:color-mix(in_srgb,var(--fr-time-accent,var(--fr-accent))_20%,transparent)]',
  {
    variants: {
      size: {
        sm: 'h-8 [--fr-time-radius-default:0.25rem] px-2 text-sm',
        md: 'h-10 [--fr-time-radius-default:var(--radius-frayme)] px-3',
        lg: 'h-12 [--fr-time-radius-default:1rem] px-3.5 text-lg',
      },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', disabled: false },
  },
);

export function TimePicker({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    value?: string | null;
    minuteStep?: number | null;
    accent?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    radiusValue?: string | number | null;
    size?: 'sm' | 'md' | 'lg' | null;
    label?: string | null;
    weight?: string | null;
    tracking?: string | null;
    disabled?: boolean | null;
    emitOnChange?: boolean | null;
  };
  const [value, setValue] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = (p.disabled ?? false) as true | false;
  const minuteStep = typeof p.minuteStep === 'number' && Number.isFinite(p.minuteStep) && p.minuteStep > 0 ? Math.floor(p.minuteStep) : 1;
  const stepSeconds = minuteStep * 60;
  const current = typeof value === 'string' ? value : '';
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  return (
    <label className="inline-flex flex-col gap-1.5">
      {p.label != null && (
        <span
          className={cn(
            // break-words, never truncate: this caption sits alone in a COLUMN
            // above its control, so there is no sibling it could be sharing width
            // with — a clip here only ever deleted words the control cannot
            // re-explain. Wrapping costs a line.
            'break-words text-sm font-medium text-foreground',
            // typography channels: a SET value dedupe-wins its tw-merge group over
            // the baked font-medium; unset → undefined → cn drops it →
            // byte-identical default. Placed LAST so the override wins.
            weightClass(p.weight),
            trackingClass(p.tracking),
          )}
          title={p.label}
        >
          {p.label}
        </span>
      )}
      <span
        className={cn(timeWrap({ size, disabled }))}
        style={styleVars(
          { var: '--fr-time-accent', value: p.accent, kind: 'color' },
          { var: '--fr-time-bg', value: p.bg, kind: 'color' },
          { var: '--fr-time-border', value: p.borderColor, kind: 'color' },
          { var: '--fr-time-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        )}
      >
        <span className="shrink-0 [color:var(--fr-time-accent,var(--color-muted-foreground))]" aria-hidden>
          <Icon name="clock" size={iconSize} />
        </span>
        <input
          type="time"
          className="min-w-0 flex-1 border-0 bg-transparent font-[inherit] tabular-nums text-inherit outline-none [color-scheme:light] dark:[color-scheme:dark]"
          value={current}
          step={stepSeconds}
          disabled={p.disabled ?? undefined}
          aria-label={p.label ?? 'Time'}
          onChange={(e) => {
            setValue(e.target.value);
            if (p.emitOnChange !== false) emitWith('change', { value: e.target.value });
          }}
        />
      </span>
    </label>
  );
}

/* ── QuantityStepper ──────────────────────────────────────────────────────── */

const qtyWrap = cva(
  'inline-flex items-center border transition-[border-color,box-shadow] [border-radius:var(--fr-qty-radius,var(--fr-qty-radius-default,var(--radius-frayme)))] [border-color:var(--fr-qty-border,var(--color-border))] [background:var(--fr-qty-bg,var(--color-card))]',
  {
    variants: {
      // size sets the DEFAULT radius var (byte-identical to the prior
      // rounded-*); an exact radiusValue → --fr-qty-radius wins.
      size: {
        sm: 'h-8 [--fr-qty-radius-default:0.25rem]',
        md: 'h-10 [--fr-qty-radius-default:var(--radius-frayme)]',
        lg: 'h-12 [--fr-qty-radius-default:1rem]',
      },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', disabled: false },
  },
);

// No `disabled:cursor-*` pairing here: `disabled:pointer-events-none` takes the
// disabled button out of hit-testing, so the wrapper's not-allowed cursor shows
// through on its own.
const qtyButton = cva(
  'cursor-pointer inline-flex h-full shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] hover:text-[var(--fr-qty-accent,var(--fr-accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--fr-qty-accent,var(--fr-accent))] disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      size: { sm: 'w-7', md: 'w-9', lg: 'w-11' },
    },
    defaultVariants: { size: 'md' },
  },
);

const qtyReadout = cva('h-full min-w-0 border-x border-[var(--fr-qty-border,var(--color-border))] bg-transparent text-center font-[inherit] font-medium tabular-nums text-foreground outline-none', {
  variants: {
    size: { sm: 'w-10 text-sm', md: 'w-12', lg: 'w-14 text-lg' },
  },
  defaultVariants: { size: 'md' },
});

export function QuantityStepper({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    value?: number | null;
    min?: number | null;
    max?: number | null;
    step?: number | null;
    accent?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    radiusValue?: string | number | null;
    size?: 'sm' | 'md' | 'lg' | null;
    label?: string | null;
    weight?: string | null;
    tracking?: string | null;
    disabled?: boolean | null;
    emitOnChange?: boolean | null;
  };
  const [value, setValue] = useBoundProp<number>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = (p.disabled ?? false) as true | false;
  const min = typeof p.min === 'number' && Number.isFinite(p.min) ? p.min : 0;
  const max = typeof p.max === 'number' && Number.isFinite(p.max) ? p.max : 99;
  const step = typeof p.step === 'number' && Number.isFinite(p.step) && p.step > 0 ? p.step : 1;
  const current = clamp(typeof value === 'number' && Number.isFinite(value) ? value : min, min, max);
  const atMin = current <= min;
  const atMax = current >= max;
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  const setTo = (n: number) => {
    if (disabled) return;
    const next = clamp(n, min, max);
    setValue(next);
    if (p.emitOnChange !== false) emitWith('change', { value: next });
  };
  // A +/- button press is a DISCRETE PICK — it must ALWAYS reach the host, never
  // be silenced by emitOnChange. `setTo` is shared with the number <input>
  // stream (typing), so keep its `change` gated there; give the stepper buttons
  // their own unconditional emit of the same `change` verb.
  const stepTo = (n: number) => {
    if (disabled) return;
    const next = clamp(n, min, max);
    setValue(next);
    emitWith('change', { value: next });
  };

  return (
    <div className="inline-flex flex-col gap-1.5">
      {p.label != null && (
        <span
          className={cn(
            // break-words, never truncate: this caption sits alone in a COLUMN
            // above its control, so there is no sibling it could be sharing width
            // with — a clip here only ever deleted words the control cannot
            // re-explain. Wrapping costs a line.
            'break-words text-sm font-medium text-foreground',
            // typography channels: a SET value dedupe-wins its tw-merge group over
            // the baked font-medium; unset → undefined → cn drops it →
            // byte-identical default. Placed LAST so the override wins.
            weightClass(p.weight),
            trackingClass(p.tracking),
          )}
          title={p.label}
        >
          {p.label}
        </span>
      )}
      <div
        className={cn(qtyWrap({ size, disabled }))}
        role="group"
        aria-label={p.label ?? 'Quantity'}
        style={styleVars(
          { var: '--fr-qty-accent', value: p.accent, kind: 'color' },
          { var: '--fr-qty-bg', value: p.bg, kind: 'color' },
          { var: '--fr-qty-border', value: p.borderColor, kind: 'color' },
          { var: '--fr-qty-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        )}
      >
        <button
          type="button"
          className={cn(qtyButton({ size }))}
          aria-label="Decrease"
          disabled={disabled || atMin}
          onClick={() => stepTo(current - step)}
        >
          <Icon name="minus" size={iconSize} />
        </button>
        <input
          className={cn(qtyReadout({ size }))}
          type="number"
          inputMode="numeric"
          value={current}
          disabled={p.disabled ?? undefined}
          min={min}
          max={max}
          step={step}
          aria-label={p.label ?? 'Quantity'}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            setTo(n);
          }}
        />
        <button
          type="button"
          className={cn(qtyButton({ size }))}
          aria-label="Increase"
          disabled={disabled || atMax}
          onClick={() => stepTo(current + step)}
        >
          <Icon name="plus" size={iconSize} />
        </button>
      </div>
    </div>
  );
}

/* ── PhoneInput ───────────────────────────────────────────────────────────── */

const DEFAULT_COUNTRIES: Array<{ code: string; dial: string; flag: string }> = [
  { code: 'GB', dial: '+44', flag: '🇬🇧' },
  { code: 'US', dial: '+1', flag: '🇺🇸' },
  { code: 'CA', dial: '+1', flag: '🇨🇦' },
  { code: 'IE', dial: '+353', flag: '🇮🇪' },
  { code: 'AU', dial: '+61', flag: '🇦🇺' },
  { code: 'DE', dial: '+49', flag: '🇩🇪' },
  { code: 'FR', dial: '+33', flag: '🇫🇷' },
  { code: 'IN', dial: '+91', flag: '🇮🇳' },
];

const phoneWrap = cva(
  'inline-flex items-stretch border transition-[border-color,box-shadow] focus-within:ring-2 [border-radius:var(--fr-phone-radius,var(--fr-phone-radius-default,var(--radius-frayme)))] [border-color:var(--fr-phone-border,var(--color-border))] [background:var(--fr-phone-bg,var(--color-card))] focus-within:[border-color:var(--fr-phone-accent,var(--fr-accent))] focus-within:[--tw-ring-color:color-mix(in_srgb,var(--fr-phone-accent,var(--fr-accent))_20%,transparent)]',
  {
    variants: {
      // size sets the DEFAULT radius var (byte-identical to the prior
      // rounded-*); an exact radiusValue → --fr-phone-radius wins.
      size: {
        sm: 'h-8 [--fr-phone-radius-default:0.25rem] text-sm',
        md: 'h-10 [--fr-phone-radius-default:var(--radius-frayme)]',
        lg: 'h-12 [--fr-phone-radius-default:1rem] text-lg',
      },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', disabled: false },
  },
);

export function PhoneInput({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    value?: string | null;
    countries?: Array<{ code?: string | null; dial?: string | null; flag?: string | null }> | null;
    country?: string | null;
    placeholder?: string | null;
    accent?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    mutedColor?: string | null;
    radiusValue?: string | number | null;
    size?: 'sm' | 'md' | 'lg' | null;
    label?: string | null;
    weight?: string | null;
    tracking?: string | null;
    disabled?: boolean | null;
    emitOnChange?: boolean | null;
  };
  const [value, setValue] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = (p.disabled ?? false) as true | false;

  const countries = (Array.isArray(p.countries) && p.countries.length > 0 ? p.countries : DEFAULT_COUNTRIES)
    .filter((c) => typeof c?.code === 'string' && typeof c?.dial === 'string')
    .map((c) => ({ code: c.code as string, dial: c.dial as string, flag: typeof c?.flag === 'string' ? c.flag : '' }));
  const list = countries.length > 0 ? countries : DEFAULT_COUNTRIES;

  // Route `country` through the bound/local hook so an external Submit reads the
  // FULL phone value (number + dial-code) off spec.state, not just the digits.
  const [boundCountry, setBoundCountry] = useBoundProp<string>(
    typeof p.country === 'string' ? p.country : undefined,
    (bindings as { country?: unknown } | undefined)?.country,
  );
  const country = typeof boundCountry === 'string' ? boundCountry : list[0].code;
  const setCountry = setBoundCountry;
  // Render the raw digits (not a re-grouped display) so mid-string edits don't
  // snap the caret to the end on every keystroke.
  const display = typeof value === 'string' ? value : '';

  return (
    <div className="inline-flex flex-col gap-1.5">
      {p.label != null && (
        <span
          className={cn(
            // break-words, never truncate: this caption sits alone in a COLUMN
            // above its control, so there is no sibling it could be sharing width
            // with — a clip here only ever deleted words the control cannot
            // re-explain. Wrapping costs a line.
            'break-words text-sm font-medium text-foreground',
            // typography channels: a SET value dedupe-wins its tw-merge group over
            // the baked font-medium; unset → undefined → cn drops it →
            // byte-identical default. Placed LAST so the override wins.
            weightClass(p.weight),
            trackingClass(p.tracking),
          )}
          title={p.label}
        >
          {p.label}
        </span>
      )}
      <span
        className={cn(phoneWrap({ size, disabled }))}
        style={styleVars(
          { var: '--fr-phone-accent', value: p.accent, kind: 'color' },
          { var: '--fr-phone-bg', value: p.bg, kind: 'color' },
          { var: '--fr-phone-border', value: p.borderColor, kind: 'color' },
          { var: '--fr-phone-muted', value: p.mutedColor, kind: 'color' },
          { var: '--fr-phone-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        )}
      >
        <select
          className="h-full shrink-0 rounded-l-[inherit] border-0 border-r border-[var(--fr-phone-border,var(--color-border))] bg-transparent pl-2.5 pr-1 font-[inherit] tabular-nums text-foreground outline-none focus-visible:bg-[color:var(--fr-surface-sunken,var(--color-muted))]"
          value={country}
          disabled={p.disabled ?? undefined}
          aria-label="Country dial code"
          onChange={(e) => {
            // A country <select> change is a DISCRETE PICK — always reach the
            // host, never silenced by emitOnChange. (The phone-number <input>
            // below is the stream and stays gated.)
            setCountry(e.target.value);
            emitWith('change', { value: display, country: e.target.value });
          }}
        >
          {list.map((c, i) => (
            <option key={`${c.code}-${i}`} value={c.code}>
              {(c.flag ? `${c.flag} ` : '') + c.dial}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          className="min-w-0 flex-1 border-0 bg-transparent px-2.5 font-[inherit] tabular-nums text-foreground outline-none placeholder:text-[color:var(--fr-phone-muted,var(--color-muted-foreground))]"
          value={display}
          placeholder={p.placeholder ?? undefined}
          disabled={p.disabled ?? undefined}
          aria-label={p.label ?? 'Phone number'}
          onChange={(e) => {
            const next = e.target.value.replace(/[^0-9]/g, '');
            setValue(next);
            if (p.emitOnChange !== false) emitWith('change', { value: next, country });
          }}
        />
      </span>
    </div>
  );
}

/* ── CopyButton ───────────────────────────────────────────────────────────── */

const copyBtn = cva(
  'cursor-pointer inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_70%,transparent)]',
  {
    variants: {
      variant: {
        default: 'border border-border bg-card text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
        primary: 'bg-primary text-primary-foreground hover:opacity-90',
        secondary: 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-[color:var(--fr-surface-fg,var(--color-foreground))] hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/70',
        ghost: 'text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
        outline: 'border border-border bg-transparent text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
      },
      size: { sm: 'h-8 rounded-sm px-2.5 text-sm', md: 'h-10 rounded-frayme px-3.5', lg: 'h-12 rounded-2xl px-4 text-lg' },
      copied: { true: 'text-success', false: '' },
    },
    // On the FILLED primary variant, green success text is low-contrast over the
    // brand fill — keep the readable on-fill foreground when copied instead.
    compoundVariants: [{ variant: 'primary', copied: true, class: 'text-primary-foreground' }],
    defaultVariants: { variant: 'default', size: 'md', copied: false },
  },
);

const ICON_MAP: Record<string, string> = { copy: 'copy', clipboard: 'clipboard', link: 'external-link' };

export function CopyButton({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    value?: string | null;
    label?: string | null;
    copiedLabel?: string | null;
    variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'outline' | null;
    size?: 'sm' | 'md' | 'lg' | null;
    icon?: 'copy' | 'clipboard' | 'link' | 'none' | null;
  };
  const variant = (p.variant as 'default' | 'primary' | 'secondary' | 'ghost' | 'outline' | null) ?? undefined;
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const iconKey = p.icon ?? 'copy';
  const iconName = iconKey === 'none' ? null : ICON_MAP[iconKey] ?? 'copy';
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const text = typeof p.value === 'string' ? p.value : '';
  const restLabel = p.label ?? 'Copy';
  const doneLabel = p.copiedLabel ?? 'Copied!';

  const copy = () => {
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    const flip = () => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    };
    if (clip?.writeText) {
      clip.writeText(text).then(flip).catch(() => flip());
    } else {
      flip();
    }
  };

  return (
    <button
      type="button"
      className={cn(copyBtn({ variant, size, copied }))}
      onClick={copy}
      aria-label={copied ? doneLabel : restLabel}
    >
      {copied ? (
        <span className="shrink-0">
          <Icon name="check" size={iconSize} />
        </span>
      ) : iconName ? (
        <span className="shrink-0">
          <Icon name={iconName} size={iconSize} />
        </span>
      ) : null}
      {/* truncate EARNED: copyBtn's size enum fixes the button height (h-8/h-10/h-12),
          so a wrapped label would paint outside its own border. A single line is a
          real contract here, and the strings are short by construction
          ("Copy"/"Copied!"); `title` carries any longer authored label in full. */}
      <span className="break-words" aria-live="polite" title={copied ? doneLabel : restLabel}>{copied ? doneLabel : restLabel}</span>
    </button>
  );
}
