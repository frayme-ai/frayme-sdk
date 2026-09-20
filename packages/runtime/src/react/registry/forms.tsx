'use client';
import type { CSSProperties, ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit, useCommitLatch } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { useFieldChecks, type FieldCheck, type ValidateOn } from '../field-validation.js';
import { styleVars } from './_style.js';
import { Icon, hasIcon } from './icons.js';

/** Deterministic field id, stable across SSR ↔ hydration. React's `useId` can
 *  diverge when a host app SSRs the renderer inside a larger 'use client' tree
 *  (the IDs are positional); deriving from the field's own binding path / name /
 *  label is order-independent, so the htmlFor↔id pair always matches. Unique
 *  within a spec (one binding path / name per field). */
function fieldId(...parts: unknown[]): string {
  const base = parts.find((s): s is string => typeof s === 'string' && s.length > 0) ?? 'field';
  const slug = base.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'field';
  return `frayme-${slug}`;
}

/* Catalog group: Input, Textarea, Select, Checkbox, Radio, Switch, Slider.
 * Values flow through `$bindState` two-way bindings (useBoundProp); interaction
 * events carry intrinsic payloads via `emitWith` (value/checked + name), while
 * focus/blur lifecycle emits stay pure signals.
 *
 * Truly dynamic: every form field shares ONE behavioral + visual
 * surface (`formFieldBase`: disabled/readonly/required/helpText/errorText/size/
 * labelPlacement/accent/width) plus a handful of component-specifics.
 * Shared conventions:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (color/dimension the model names directly) NEVER become
 *     classes — they land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`,
 *     read by STATIC arbitrary `var(--fr-…, var(--color-…))` utilities. The
 *     class set stays a closed, build-time set (no JIT, no injection); only the
 *     var's VALUE is model-supplied, and `styleVars` re-validates + omits any
 *     failing/absent value so the token fallback wins (props-less → polished).
 *
 * `accent` is the one brand lever for checkbox/radio/switch/slider: applied as
 * `accent-color: var(--fr-<c>-accent, var(--fr-accent))` — per-component accent
 * wins, else the global `--fr-accent` knob (neutral foreground by default), so
 * the NATIVE control derives box bg + border + focus ring from it (we do NOT split a
 * checkbox box bg/border from accent — that produces illegible combos and isn't
 * reliably stylable on native controls). */

/* ── shared bits ──────────────────────────────────────────────────────────── */

const field = cva('flex flex-col gap-2', {
  variants: { inline: { true: 'flex-row items-center gap-2' } },
});

/* The label TEXT inside this row carries `break-words`, never `truncate`: a field
   caption is the one string a user cannot guess back. `truncate` is nowrap +
   overflow:hidden, and overflow:hidden zeroes a flex item's automatic minimum
   size — so the caption box shrank to whatever the row left it and the words were
   deleted ("Preferred contact method" → "Preferred cont…"). Wrapping grows the
   label row by a line instead, which is a cost the reader can see. */
const labelRecipe = cva('flex items-center justify-between text-sm font-medium', {
  variants: {
    placement: {
      top: '',
      // `hidden` keeps the label in the DOM for a11y but visually removes it.
      hidden: 'sr-only',
    },
    disabled: { true: 'opacity-60', false: '' },
  },
  defaultVariants: { placement: 'top', disabled: false },
});

/** The text/select/textarea control. `accent` drives the focus ring via a var
 *  with a primary-token fallback; border/bg likewise route through vars. */
const control = cva(
  // radiusValue var-chain — SHARED by Input/Textarea/Select (each routes its
  // radiusValue into --fr-field-radius). The radius variant sets the per-enum default
  // var; an exact radiusValue wins. Steps byte-identical to the prior rounded-*:
  // 0 / 0.25rem / radius-frayme / 1rem / 9999px (full = pill, was rounded-full).
  // ::placeholder joins the muted-text coherence group (help line + adornments +
  // counter + placeholder), matching SearchInput's placeholder routing.
  // The BG fallback gained a --fr-surface-field step. var(--color-card) is a
  // LIGHT-THEME value painted regardless of what is underneath, so a field on an
  // authored dark card was a white pill — and once the surface handed its own ink
  // down, the text in that pill went #fafafa on #ffffff. --fr-surface-field is the
  // ground DERIVED from the surface, published beside --fr-surface by whichever
  // container painted it. Unpublished on a page that authors no bg, so the default
  // field is byte-identical to before. An authored --fr-field-bg still wins.
  // width var-chain (the sliderRecipe pattern): unset → 100%, a valid `width`
  // wins, an invalid value falls back to 100%. No `w-full` — tw-merge cannot
  // dedupe a w-* utility against the arbitrary property, and the utility would
  // win the cascade, making the width channel inert.
  // Native <select>/<input>/<textarea> use :focus, NOT :focus-visible — Chrome
  // does not match :focus-visible on a MOUSE-clicked <select>, so a focus-visible
  // outline-none leaves the browser's blue ring showing. :focus reliably suppresses
  // it and paints the neutral accent ring on any focus (mouse or keyboard).
  '[width:var(--fr-field-w,100%)] max-w-full border px-3 py-2.5 font-[inherit] text-inherit transition-[border-color,box-shadow] focus:outline-none focus:ring-2 [border-radius:var(--fr-field-radius,var(--fr-field-radius-default,var(--radius-frayme)))] [border-color:var(--fr-field-border,var(--color-border))] [background:var(--fr-field-bg,var(--fr-surface-field,var(--color-card)))] [&::placeholder]:[color:var(--fr-field-muted,var(--color-muted-foreground))] focus:[border-color:var(--fr-field-accent,var(--fr-accent))] focus:[--tw-ring-color:color-mix(in_srgb,var(--fr-field-accent,var(--fr-accent))_20%,transparent)]',
  {
    variants: {
      size: {
        sm: 'px-2.5 py-1.5 text-sm',
        md: 'px-3 py-2',
        lg: 'px-3.5 py-2.5 text-lg',
      },
      radius: {
        none: '[--fr-field-radius-default:0px]',
        sm: '[--fr-field-radius-default:0.25rem]',
        md: '[--fr-field-radius-default:var(--radius-frayme)]',
        lg: '[--fr-field-radius-default:1rem]',
        full: '[--fr-field-radius-default:9999px]',
      },
      align: { left: 'text-left', center: 'text-center', right: 'text-right' },
      multiline: { true: '' },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', radius: 'md', align: 'left', multiline: false, disabled: false },
  },
);

const resizeRecipe = cva('', {
  variants: {
    resize: { none: 'resize-none', vertical: 'resize-y', horizontal: 'resize-x', both: 'resize' },
  },
  defaultVariants: { resize: 'vertical' },
});

/* Input ADORNMENT WRAPPER. The bordered box that now holds the
 * `<input>` PLUS any prefix/suffix strings and a leading `icon` INSIDE the field
 * (shadcn/Ant/Tailwind-UI convention) — so adornments share the field bg and dim
 * with the disabled control. Mirrors SearchInput's `searchWrap`: border/bg/radius/
 * focus-ring/width/disabled all live HERE (moved off the `<input>`); the input
 * itself goes transparent + borderless (`inputField` below). The corner-radius,
 * border-color, bg and width var-chains are IDENTICAL to the old `control` base,
 * and `focus-within:` reproduces the old `focus-visible:` ring on the same vars,
 * so the resting + focused visuals are pixel-identical to the pre-refactor input. */
const inputWrap = cva(
  '[width:var(--fr-field-w,100%)] max-w-full flex items-center border transition-[border-color,box-shadow] focus-within:ring-2 [border-radius:var(--fr-field-radius,var(--fr-field-radius-default,var(--radius-frayme)))] [border-color:var(--fr-field-border,var(--color-border))] [background:var(--fr-field-bg,var(--fr-surface-field,var(--color-card)))] focus-within:[border-color:var(--fr-field-accent,var(--fr-accent))] focus-within:[--tw-ring-color:color-mix(in_srgb,var(--fr-field-accent,var(--fr-accent))_20%,transparent)]',
  {
    variants: {
      radius: {
        none: '[--fr-field-radius-default:0px]',
        sm: '[--fr-field-radius-default:0.25rem]',
        md: '[--fr-field-radius-default:var(--radius-frayme)]',
        lg: '[--fr-field-radius-default:1rem]',
        full: '[--fr-field-radius-default:9999px]',
      },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { radius: 'md', disabled: false },
  },
);

/* The bare `<input>` inside `inputWrap` — transparent + borderless, carrying only
 * the sizing/padding/text so the caret + text land EXACTLY where they did when
 * these classes lived on the bordered input (`min-w-0 flex-1` lets it fill the
 * flex wrapper). Padding + placeholder + text-size are byte-for-byte the old
 * `control` size variants. */
const inputField = cva(
  'min-w-0 flex-1 border-0 bg-transparent px-3 py-2 font-[inherit] text-inherit outline-none [&::placeholder]:[color:var(--fr-field-muted,var(--color-muted-foreground))]',
  {
    variants: {
      size: {
        sm: 'px-2.5 py-1.5 text-sm',
        md: 'px-3 py-2',
        lg: 'px-3.5 py-2.5 text-lg',
      },
      align: { left: 'text-left', center: 'text-center', right: 'text-right' },
      disabled: { true: 'cursor-not-allowed', false: '' },
    },
    defaultVariants: { size: 'md', align: 'left', disabled: false },
  },
);

/* Error-state border for the Input WRAPPER: same arbitrary-property
 * form as the wrapper's resting `[border-color:…]` so tailwind-merge dedupes it
 * (added LAST → danger wins). Distinct from `controlErrorCls` (used by the
 * still-input-bordered Textarea/Select) only in that it applies to the wrapper. */
const inputWrapErrorCls = '[border-color:var(--color-danger)]';

/* Leading/trailing adornment text (prefix/suffix) INSIDE the field box — reads
 * the muted-text coherence group, padded to sit snug against the input. */
const adornmentCls = 'shrink-0 text-sm [color:var(--fr-field-muted,var(--color-muted-foreground))]';

const helpRecipe = cva('text-[0.8125rem] leading-snug', {
  variants: {
    // Settable secondary/muted text — defaults to the muted-foreground token via
    // the var fallback (a props-less spec looks identical to the default). The field
    // root emits `--fr-field-muted` from `mutedColor`. `error` stays the semantic
    // danger token (NOT settable here).
    kind: { help: '[color:var(--fr-field-muted,var(--color-muted-foreground))]', error: 'text-danger' },
  },
  defaultVariants: { kind: 'help' },
});

/* A choice control (checkbox / radio dot / range) reads its fill from
   `accent-color: var(--fr-<c>-accent)`; the var carries the validated `accent`.
   quiet defaults: the checked box/dot defaults to neutral high-contrast
   (foreground → near-black, shadcn-style), not a saturated brand fill; a supplied
   `accent` still overrides. */
const checkboxBox = cva('shrink-0 [accent-color:var(--fr-check-accent,var(--fr-accent))]', {
  variants: {
    size: { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' },
    disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
  },
  defaultVariants: { size: 'md', disabled: false },
});

// Two-step default-var chain (like the field radius channel): the `gap` enum
// sets the per-enum DEFAULT var; an exact `gapValue` lands in `--fr-radio-gap`
// (inline on this same div) and wins. Unset → 0.375rem, byte-identical.
const radioGroupRecipe = cva('m-0 flex border-none p-0 [gap:var(--fr-radio-gap,var(--fr-radio-gap-default,0.375rem))]', {
  variants: {
    orientation: { vertical: 'flex-col', horizontal: 'flex-row flex-wrap items-center' },
    gap: { sm: '[--fr-radio-gap-default:0.375rem]', md: '[--fr-radio-gap-default:0.75rem]', lg: '[--fr-radio-gap-default:1.25rem]' },
  },
  defaultVariants: { orientation: 'vertical' },
});

const radioOption = cva('flex items-center gap-2 [accent-color:var(--fr-radio-accent,var(--fr-accent))]', {
  variants: {
    size: { sm: 'text-sm', md: 'text-[0.9375rem]', lg: 'text-lg' },
    disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
  },
  defaultVariants: { size: 'md', disabled: false },
});

/* Switch — the ON track reads `accent`, the OFF track reads `offColor`; both
   fall back to tokens. The ON track defaults to `--fr-accent` (foreground) which
   is near-WHITE in dark mode, so the thumb INVERTS with the on-state: `bg-card`
   when on (white on the near-black light track, near-black on the near-white dark
   track — same relationship as text-card on a bg-foreground button) and `bg-white`
   when off (legible on the muted OFF track in both themes). A fixed white thumb
   would vanish on the near-white dark-mode ON track. */
const switchTrack = cva(
  // The visible track is deliberately 16-20px tall at sm/md — making it 24 to
  // satisfy WCAG 2.5.8 would redesign the control. Instead the TARGET is grown
  // to 24px with a transparent ::before centred on the track: a finger or a
  // pointer gets the full 24px, the switch still looks like a switch. The track
  // is already `relative`, so the pseudo-element positions against it.
  'relative cursor-pointer rounded-full border-none p-0 transition-colors' +
    " before:absolute before:left-0 before:top-1/2 before:h-6 before:w-full before:-translate-y-1/2 before:content-['']",
  {
    variants: {
      size: { sm: 'h-4 w-7', md: 'h-5 w-9', lg: 'h-6 w-11' },
      on: {
        true: '[background:var(--fr-switch-accent,var(--fr-accent))]',
        false: '[background:var(--fr-switch-off,var(--color-border))]',
      },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', on: false, disabled: false },
  },
);
const switchThumb = cva('absolute top-0.5 left-0.5 rounded-full shadow-sm transition-transform', {
  variants: {
    size: { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' },
    on: { true: 'bg-card', false: 'bg-white' },
  },
  compoundVariants: [
    { size: 'sm', on: true, class: 'translate-x-3' },
    { size: 'md', on: true, class: 'translate-x-4' },
    { size: 'lg', on: true, class: 'translate-x-5' },
  ],
  defaultVariants: { size: 'md', on: false },
});

/* Slider — the range reads `accent` (filled track + thumb) and `trackColor`
   (unfilled track). `width` routes through the dimension channel. */
const sliderRecipe = cva(
  'accent-[var(--fr-slider-accent,var(--fr-accent))] [width:var(--fr-slider-w,100%)] max-w-full',
  {
    variants: {
      size: { sm: 'h-1', md: 'h-1.5', lg: 'h-2' },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', disabled: false },
  },
);

/* ── helpers ──────────────────────────────────────────────────────────────── */

/** Error-state coherence (Input/Textarea/Select): when `errorText` is set the
 *  control border joins the danger help line (shadcn/Ant/Radix convention) and
 *  the control is marked `aria-invalid`. Same arbitrary-property form as the
 *  base's resting `[border-color:…]` so tailwind-merge dedupes it (added LAST
 *  in cn() → the danger border wins). Unset → class + attr both absent, so a
 *  no-error field stays byte-identical. */
const controlErrorCls = '[border-color:var(--color-danger)]';

/** The field label's settable text colour (`labelColor` → --fr-field-label,
 *  carried on the field root). Conditional — a labelColor-less field keeps the
 *  inherited foreground byte-identically. */
const labelColorCls = 'text-[color:var(--fr-field-label,var(--color-foreground))]';

/** A field's shared behavioral + label/help/error scaffold. */
function useFieldChrome(p: {
  size?: string | null;
  disabled?: boolean | null;
  labelPlacement?: string | null;
  helpText?: string | null;
  errorText?: string | null;
  label?: string | null;
}) {
  const fieldLabel = useContext(FieldLabelContext);
  return {
    size: (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined,
    disabled: (p.disabled ?? false) as true | false,
    // T14: a LABELLESS control (typical inside FormField, which owns
    // the visible caption) hides its own label row — previously an empty label
    // still rendered, and with `required` it showed an ORPHAN asterisk (the
    // deal-reg screenshot bug). Explicit labelPlacement always wins.
    placement:
      (p.labelPlacement as 'top' | 'hidden' | null) ??
      ((p.label ?? '') === '' ? ('hidden' as const) : undefined) ??
      // The FormField around this control already prints this exact caption.
      // Keep it as the control's accessible name (sr-only) rather than print it
      // a second time. An explicit labelPlacement still wins, as above.
      (repeatsFieldLabel(fieldLabel, p.label) ? ('hidden' as const) : undefined),
  };
}

/** The control's label repeats the enclosing FormField's caption, once outer
 * whitespace is ignored. Strings on both sides, so a malformed prop never matches. */
function repeatsFieldLabel(fieldLabel: string | null, label: unknown): boolean {
  return (
    typeof fieldLabel === 'string' &&
    fieldLabel.trim() !== '' &&
    typeof label === 'string' &&
    fieldLabel.trim() === label.trim()
  );
}

/** FormField's help/error cascade: the ONE line the enclosing FormField prints
 * under its group (its error when set, else its help), or null outside a
 * FormField and inside one that prints nothing. The control inside reads it so
 * it does not print the same sentence a second time. Generating models repeat a
 * FormField's helpText on the control it wraps, and the reader saw the line
 * twice. This covers the help/error line only. A repeated LABEL is hidden only
 * when the spec itself sets labelPlacement hidden or an empty label (see
 * fieldChrome); a control that repeats the FormField label without either still
 * shows it twice. */
export type FieldDescription = { kind: 'help' | 'error'; text: string } | null;
export const FieldDescriptionContext = createContext<FieldDescription>(null);

/** FormField's caption, passed to the control it wraps: the label the FormField
 * already prints above the group, or null outside a FormField. Generating models
 * repeat that label on the control inside, and when they forget
 * labelPlacement hidden the caption prints twice. In the training data this is
 * the COMMON case: 14 of 529 FormField to control pairs repeat the label visibly.
 * The control reads it and keeps an identical label for screen readers only. */
export const FieldLabelContext = createContext<string | null>(null);

/** A control's line repeats the FormField's printed line: same kind, same text
 * once outer whitespace is ignored (HTML collapses it anyway). Deliberately
 * narrow. A help line never matches an error line, different wording always
 * prints, and a non-string value (a malformed prop) never matches. */
function repeatsFieldLine(printed: FieldDescription, kind: 'help' | 'error', text: unknown): boolean {
  return (
    printed != null &&
    printed.kind === kind &&
    typeof printed.text === 'string' &&
    typeof text === 'string' &&
    printed.text.trim() === text.trim()
  );
}

/** The muted help / danger error line under a field (error wins when present). */
function HelpLine({ helpText, errorText }: { helpText?: string | null; errorText?: string | null }): ReactNode {
  // role=alert on the error line — family parity with forms-extended's HelpLine /
  // FieldError, so a surfaced error is announced by screen readers.
  const fieldLine = useContext(FieldDescriptionContext);
  // Inside a FormField that already prints this exact line, print nothing. The
  // line the control WOULD print is what is compared (error wins, as below), so a
  // repeated error never falls back to showing the control's help instead. The
  // control keeps aria-invalid and its danger border; only the text is not
  // repeated. Outside a FormField fieldLine is null and this is a no-op.
  if (errorText != null) {
    if (repeatsFieldLine(fieldLine, 'error', errorText)) return null;
    return <span className={cn(helpRecipe({ kind: 'error' }))} role="alert">{errorText}</span>;
  }
  if (helpText != null) {
    if (repeatsFieldLine(fieldLine, 'help', helpText)) return null;
    return <span className={cn(helpRecipe({ kind: 'help' }))}>{helpText}</span>;
  }
  return null;
}


/** FormField's required cascade: a field whose LABEL is marked required
 * IS required — FormField provides true and the native control inside picks it
 * up as a default (its own explicit `required` prop always wins). Closes the
 * gap where a spec marks only the label and the control never enforces it. */
export const FieldRequiredContext = createContext<boolean>(false);

/** A small `*` marker appended to a required field's label. */
function RequiredMark({ required }: { required?: boolean | null }): ReactNode {
  return required === true ? <span className="ml-0.5 shrink-0 text-danger" aria-hidden>*</span> : null;
}

/* ── renderers ────────────────────────────────────────────────────────────── */

export function Input({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label: string;
    name: string;
    type?: string | null;
    placeholder?: string | null;
    value?: string | null;
    inputMode?: string | null;
    autocomplete?: string | null;
    autofocus?: boolean | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    align?: string | null;
    minLength?: number | null;
    maxLength?: number | null;
    min?: number | null;
    max?: number | null;
    step?: number | null;
    prefix?: string | null;
    suffix?: string | null;
    icon?: string | null;
    borderColor?: string | null;
    bg?: string | null;
    mutedColor?: string | null;
    disabled?: boolean | null;
    readonly?: boolean | null;
    required?: boolean | null;
    checks?: FieldCheck[] | null;
    validateOn?: ValidateOn | null;
    helpText?: string | null;
    errorText?: string | null;
    size?: string | null;
    labelPlacement?: string | null;
    accent?: string | null;
    width?: string | number | null;
    labelColor?: string | null;
    emitOnChange?: boolean | null;
  };
  const id = fieldId(bindings?.value, bindings?.checked, p.name, p.label);
  const [value, setValue, frozen] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  // `checks` / `validateOn`, wired. An authored errorText still wins.
  const { error: fieldError, onBlur: onChecksBlur } = useFieldChecks({
    id: String((element.props as { __fid?: unknown })?.__fid ?? p.name ?? "field"),
    value: value,
    checks: p.checks,
    validateOn: p.validateOn,
    required: p.required,
    errorText: p.errorText,
  });
  const emitWith = useIntrinsicEmit(emit, element);
  const fieldRequired = useContext(FieldRequiredContext);
  /* A frozen param READS as disabled, not just behaves as one. `frozen` is true once
     an action this control feeds has committed (param-freeze.tsx). Rule 3 says the
     params "become disabled"; the write-rejection in useLocalOrBound is the
     behaviour, this is the appearance. Merged BEFORE fieldChrome so the control, its
     label row and its help text all read one state rather than the control greying
     while its label does not. */
  const chrome = useFieldChrome(frozen ? { ...p, disabled: true } : p);
  // Leading icon size tracks the size enum (matches SearchInput's glyph scale).
  const iconSize = chrome.size === 'sm' ? 15 : chrome.size === 'lg' ? 19 : 17;
  const leadingIcon = p.icon != null && hasIcon(p.icon) ? p.icon : null;
  const style = styleVars(
    { var: '--fr-field-accent', value: p.accent, kind: 'color' },
    { var: '--fr-field-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-field-bg', value: p.bg, kind: 'color' },
    { var: '--fr-field-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 900 } },
    // exact corner radius → --fr-field-radius wins over the shared control's per-enum default.
    { var: '--fr-field-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
  ) as CSSProperties;
  // muted-text + label-colour vars carried on the field root so help/prefix/
  // suffix/label can recolour.
  const mutedStyle = styleVars(
    { var: '--fr-field-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-field-label', value: p.labelColor, kind: 'color' },
  ) as CSSProperties;
  return (
    <div className={cn(field())} style={mutedStyle}>
      <label
        className={cn(
          labelRecipe({ placement: chrome.placement, disabled: chrome.disabled }),
          p.labelColor != null && labelColorCls,
        )}
        htmlFor={id}
      >
        <span className="flex min-w-0 items-center">
          <span className="break-words" title={p.label || undefined}>{p.label}</span>
          <RequiredMark required={p.required} />
        </span>
      </label>
      {/* one bordered flex box holds the input PLUS the leading icon +
          prefix/suffix strings, so adornments share the field bg and dim with the
          disabled control. Border/bg/radius/focus-ring/width/disabled live on the
          wrapper (pixel-identical to the pre-refactor bordered input). */}
      <div
        className={cn(
          inputWrap({
            radius: (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
            disabled: chrome.disabled,
          }),
          fieldError != null && inputWrapErrorCls,
        )}
        style={style}
      >
        {leadingIcon != null && (
          <span className="pointer-events-none flex shrink-0 items-center pl-3 [color:var(--fr-field-muted,var(--color-muted-foreground))]" aria-hidden>
            <Icon name={leadingIcon} size={iconSize} />
          </span>
        )}
        {p.prefix != null && <span className={cn(adornmentCls, 'pl-3')}>{p.prefix}</span>}
        <input
          id={id}
          className={cn(
            inputField({
              size: chrome.size,
              align: (p.align as 'left' | 'center' | 'right' | null) ?? undefined,
              disabled: chrome.disabled,
            }),
            // Icon/prefix already supply the left padding → drop the input's left
            // pad so the caret sits snug against the adornment (shadcn convention).
            (leadingIcon != null || p.prefix != null) && 'pl-2',
            p.suffix != null && 'pr-2',
          )}
          aria-invalid={fieldError != null ? true : undefined}
          name={p.name}
          type={p.type ?? 'text'}
          inputMode={(p.inputMode as never) ?? undefined}
          autoComplete={p.autocomplete ?? undefined}
          autoFocus={p.autofocus ?? undefined}
          placeholder={p.placeholder ?? undefined}
          value={value ?? ''}
          disabled={p.disabled ?? undefined}
          readOnly={p.readonly ?? undefined}
          required={p.required ?? (fieldRequired || undefined)}
          minLength={p.minLength ?? undefined}
          maxLength={p.maxLength ?? undefined}
          min={p.min ?? undefined}
          max={p.max ?? undefined}
          step={p.step ?? undefined}
          onChange={(e) => {
            const next = e.target.value;
            // Keep the (bindable) state setter UNCONDITIONAL so bound spec.state stays
            // live; only the per-keystroke stream is gated behind emitOnChange.
            setValue(next);
            if (p.emitOnChange !== false) emitWith('change', { value: next, name: p.name ?? null });
          }}
          // "finished editing" = blur OR Enter → the canonical `commit` (carrying the value).
          onBlur={(e) => { onChecksBlur(); emitWith('commit', { value: e.target.value, name: p.name ?? null }); }}
          onKeyDown={(e) => {
            // Skip key auto-repeat and IME composition Enters (double-fire guard).
            if (e.key === 'Enter' && !e.repeat && !e.nativeEvent.isComposing) {
              emitWith('commit', { value: e.currentTarget.value, name: p.name ?? null });
            }
          }}
        />
        {p.suffix != null && <span className={cn(adornmentCls, 'pr-3')}>{p.suffix}</span>}
      </div>
      <HelpLine helpText={p.helpText} errorText={fieldError} />
    </div>
  );
}

export function Textarea({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label: string;
    name: string;
    placeholder?: string | null;
    rows?: number | null;
    value?: string | null;
    maxLength?: number | null;
    showCount?: boolean | null;
    resize?: string | null;
    autosize?: boolean | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    borderColor?: string | null;
    bg?: string | null;
    mutedColor?: string | null;
    minHeight?: string | number | null;
    maxHeight?: string | number | null;
    disabled?: boolean | null;
    readonly?: boolean | null;
    required?: boolean | null;
    checks?: FieldCheck[] | null;
    validateOn?: ValidateOn | null;
    helpText?: string | null;
    errorText?: string | null;
    size?: string | null;
    labelPlacement?: string | null;
    accent?: string | null;
    width?: string | number | null;
    labelColor?: string | null;
    emitOnChange?: boolean | null;
  };
  const id = fieldId(bindings?.value, bindings?.checked, p.name, p.label);
  const [value, setValue, frozen] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  // `checks` / `validateOn`, wired. An authored errorText still wins.
  const { error: fieldError, onBlur: onChecksBlur } = useFieldChecks({
    id: String((element.props as { __fid?: unknown })?.__fid ?? p.name ?? "field"),
    value: value,
    checks: p.checks,
    validateOn: p.validateOn,
    required: p.required,
    errorText: p.errorText,
  });
  const emitWith = useIntrinsicEmit(emit, element);
  const fieldRequired = useContext(FieldRequiredContext);
  /* A frozen param READS as disabled, not just behaves as one. `frozen` is true once
     an action this control feeds has committed (param-freeze.tsx). Rule 3 says the
     params "become disabled"; the write-rejection in useLocalOrBound is the
     behaviour, this is the appearance. Merged BEFORE fieldChrome so the control, its
     label row and its help text all read one state rather than the control greying
     while its label does not. */
  const chrome = useFieldChrome(frozen ? { ...p, disabled: true } : p);
  const style = styleVars(
    { var: '--fr-field-accent', value: p.accent, kind: 'color' },
    { var: '--fr-field-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-field-bg', value: p.bg, kind: 'color' },
    { var: '--fr-field-minh', value: p.minHeight, kind: 'dim', opts: { units: ['px', 'rem'], max: 900 } },
    { var: '--fr-field-maxh', value: p.maxHeight, kind: 'dim', opts: { units: ['px', 'rem'], max: 900 } },
    { var: '--fr-field-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 900 } },
    // exact corner radius → --fr-field-radius wins over the shared control's per-enum default.
    { var: '--fr-field-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
  ) as CSSProperties;
  const mutedStyle = styleVars(
    { var: '--fr-field-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-field-label', value: p.labelColor, kind: 'color' },
  ) as CSSProperties;
  // showCount alone now renders a bare `n` counter; with maxLength it
  // renders `n/max` (unchanged). Only fully off when showCount is not true.
  const count = p.showCount === true;
  return (
    <div className={cn(field())} style={mutedStyle}>
      <label
        className={cn(
          labelRecipe({ placement: chrome.placement, disabled: chrome.disabled }),
          p.labelColor != null && labelColorCls,
        )}
        htmlFor={id}
      >
        <span className="flex min-w-0 items-center">
          <span className="break-words" title={p.label || undefined}>{p.label}</span>
          <RequiredMark required={p.required} />
        </span>
        {count && <span className="shrink-0 [color:var(--fr-field-muted,var(--color-muted-foreground))] tabular-nums">{(value ?? '').length}{p.maxLength != null ? `/${p.maxLength}` : ''}</span>}
      </label>
      <textarea
        id={id}
        className={cn(
          control({
            size: chrome.size,
            radius: (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
            multiline: true,
            disabled: chrome.disabled,
          }),
          resizeRecipe({ resize: (p.resize as 'none' | 'vertical' | 'horizontal' | 'both' | null) ?? undefined }),
          // autosize: the box grows with content (CSS field-sizing) instead of the
          // fixed `rows` height; maxHeight (below) still caps the growth.
          p.autosize === true && 'field-sizing-content',
          p.minHeight != null && '[min-height:var(--fr-field-minh)]',
          p.maxHeight != null && '[max-height:var(--fr-field-maxh)]',
          fieldError != null && controlErrorCls,
        )}
        aria-invalid={fieldError != null ? true : undefined}
        name={p.name}
        rows={p.rows ?? 4}
        placeholder={p.placeholder ?? undefined}
        value={value ?? ''}
        disabled={p.disabled ?? undefined}
        readOnly={p.readonly ?? undefined}
        required={p.required ?? (fieldRequired || undefined)}
        maxLength={p.maxLength ?? undefined}
        style={style}
        onChange={(e) => {
          const next = e.target.value;
          // State setter stays unconditional (bound spec.state live); gate only the stream.
          setValue(next);
          if (p.emitOnChange !== false) emitWith('change', { value: next, name: p.name ?? null });
        }}
        onBlur={(e) => { onChecksBlur(); emitWith('commit', { value: e.target.value, name: p.name ?? null }); }}
        onKeyDown={(e) => {
          // Ctrl/Cmd+Enter = deliberate "done authoring" commit (mirrors chat inputs).
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.repeat && !e.nativeEvent.isComposing) {
            emitWith('commit', { value: e.currentTarget.value, name: p.name ?? null });
          }
        }}
      />
      <HelpLine helpText={p.helpText} errorText={fieldError} />
    </div>
  );
}

export function Select({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label: string;
    name: string;
    options: Array<string | { value: string; label: string }>;
    placeholder?: string | null;
    value?: string | null;
    clearable?: boolean | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    borderColor?: string | null;
    bg?: string | null;
    mutedColor?: string | null;
    disabled?: boolean | null;
    readonly?: boolean | null;
    required?: boolean | null;
    checks?: FieldCheck[] | null;
    validateOn?: ValidateOn | null;
    helpText?: string | null;
    errorText?: string | null;
    size?: string | null;
    labelPlacement?: string | null;
    accent?: string | null;
    width?: string | number | null;
    labelColor?: string | null;
  };
  const id = fieldId(bindings?.value, bindings?.checked, p.name, p.label);
  const [value, setValue, frozen] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  // `checks` / `validateOn`, wired. An authored errorText still wins.
  const { error: fieldError, onBlur: onChecksBlur } = useFieldChecks({
    id: String((element.props as { __fid?: unknown })?.__fid ?? p.name ?? "field"),
    value: value,
    checks: p.checks,
    validateOn: p.validateOn,
    required: p.required,
    errorText: p.errorText,
  });
  const emitWith = useIntrinsicEmit(emit, element);
  const fieldRequired = useContext(FieldRequiredContext);
  /* A frozen param READS as disabled, not just behaves as one. `frozen` is true once
     an action this control feeds has committed (param-freeze.tsx). Rule 3 says the
     params "become disabled"; the write-rejection in useLocalOrBound is the
     behaviour, this is the appearance. Merged BEFORE fieldChrome so the control, its
     label row and its help text all read one state rather than the control greying
     while its label does not. */
  const chrome = useFieldChrome(frozen ? { ...p, disabled: true } : p);
  const style = styleVars(
    { var: '--fr-field-accent', value: p.accent, kind: 'color' },
    { var: '--fr-field-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-field-bg', value: p.bg, kind: 'color' },
    { var: '--fr-field-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 900 } },
    // exact corner radius → --fr-field-radius wins over the shared control's per-enum default.
    { var: '--fr-field-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
  ) as CSSProperties;
  const mutedStyle = styleVars(
    { var: '--fr-field-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-field-label', value: p.labelColor, kind: 'color' },
  ) as CSSProperties;
  return (
    <div className={cn(field())} style={mutedStyle}>
      <label
        className={cn(
          labelRecipe({ placement: chrome.placement, disabled: chrome.disabled }),
          p.labelColor != null && labelColorCls,
        )}
        htmlFor={id}
      >
        <span className="flex min-w-0 items-center">
          <span className="break-words" title={p.label || undefined}>{p.label}</span>
          <RequiredMark required={p.required} />
        </span>
      </label>
      <select
        id={id}
        className={cn(
          control({
            size: chrome.size,
            radius: (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
            disabled: chrome.disabled,
          }),
          // Unselected placeholder reads muted (shadcn/Ant convention) — the
          // group form dedupes the base's text-inherit. A real selection drops
          // the class → full foreground, byte-identical to before.
          (value ?? '') === '' && 'text-[color:var(--fr-field-muted,var(--color-muted-foreground))]',
          fieldError != null && controlErrorCls,
        )}
        aria-invalid={fieldError != null ? true : undefined}
        name={p.name}
        value={value ?? ''}
        disabled={p.disabled ?? undefined}
        required={p.required ?? (fieldRequired || undefined)}
        style={style}
        onChange={(e) => {
          // native <select> has no readOnly attr — guard the change like
          // Checkbox/Radio/Switch/Slider so `readonly` matches the family contract.
          if (p.readonly === true) return;
          setValue(e.target.value);
          emitWith('change', { value: e.target.value, name: p.name ?? null });
        }}
      >
        {/* clearable keeps the placeholder selectable so the user can return to empty */}
        <option value="" disabled={!(p.clearable ?? false)}>
          {p.placeholder ?? 'Select…'}
        </option>
        {/* options accept plain strings OR {value,label} pairs (mirrors
            Slider.marks' union) — normalize to {value,label} once. */}
        {(p.options ?? [])
          .map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt))
          .filter((o): o is { value: string; label: string } => o != null && typeof o === 'object' && typeof o.value === 'string')
          .map((o, i) => (
            <option key={`${o.value}-${i}`} value={o.value}>
              {o.label ?? o.value}
            </option>
          ))}
      </select>
      <HelpLine helpText={p.helpText} errorText={fieldError} />
    </div>
  );
}

export function Checkbox({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label: string;
    name: string;
    checked?: boolean | null;
    indeterminate?: boolean | null;
    description?: string | null;
    mutedColor?: string | null;
    disabled?: boolean | null;
    readonly?: boolean | null;
    required?: boolean | null;
    checks?: FieldCheck[] | null;
    validateOn?: ValidateOn | null;
    helpText?: string | null;
    errorText?: string | null;
    size?: string | null;
    labelPlacement?: string | null;
    accent?: string | null;
    width?: string | number | null;
    labelColor?: string | null;
  };
  const id = fieldId(bindings?.value, bindings?.checked, p.name, p.label);
  const [checked, setChecked] = useBoundProp<boolean>(p.checked ?? undefined, bindings?.checked);
  // `checks` / `validateOn`, wired. An authored errorText still wins.
  const { error: fieldError, onBlur: onChecksBlur } = useFieldChecks({
    id: String((element.props as { __fid?: unknown })?.__fid ?? p.name ?? "field"),
    value: checked,
    checked: checked,
    checks: p.checks,
    validateOn: p.validateOn,
    required: p.required,
    errorText: p.errorText,
  });
  const emitWith = useIntrinsicEmit(emit, element);
  const fieldRequired = useContext(FieldRequiredContext);
  /* LATCH — ANY declared action latches its control, on any
     verb. Once it goes back to the agent the agent owns what happens next, so the
     control must not fire it twice. useCommitLatch watches every verb this element
     declares. */
  const latched = useCommitLatch(element);
  const disabled = ((p.disabled ?? false) || latched) as true | false;
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const rootStyle = styleVars(
    { var: '--fr-field-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-field-label', value: p.labelColor, kind: 'color' },
    // `width` constrains the whole field (box + label wrap), not the tiny box.
    { var: '--fr-field-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 900 } },
  ) as CSSProperties;
  return (
    <div className={cn(field(), p.width != null && '[width:var(--fr-field-w)] max-w-full')} style={rootStyle}>
      <div className={cn(field({ inline: true }))}>
        <input
          id={id}
          className={cn(checkboxBox({ size, disabled }))}
          type="checkbox"
          name={p.name}
          checked={checked ?? false}
          disabled={p.disabled ?? undefined}
          required={p.required ?? (fieldRequired || undefined)}
          aria-invalid={fieldError != null ? true : undefined}
          // native `indeterminate` is a DOM property, not an attribute — set via ref.
          ref={(el) => {
            if (el) el.indeterminate = p.indeterminate === true;
          }}
          style={styleVars({ var: '--fr-check-accent', value: p.accent, kind: 'color' })}
          onChange={(e) => {
            if (p.readonly === true) return;
            setChecked(e.target.checked);
            emitWith('change', { checked: e.target.checked, name: p.name ?? null });
          }}
        />
        <label
          className={cn(
            labelRecipe({ placement: (p.labelPlacement as 'top' | 'hidden' | null) ?? undefined, disabled }),
            // A `label[for]` toggles the box, so it IS part of the target — but a
            // 14x14 input beside a 20px-tall label gives a ~20px target, under the
            // 24px floor (WCAG 2.5.8), and the label advertised `cursor: default`
            // while being clickable. min-h-6 lifts the row to 24 and the pointer
            // tells the truth about it.
            'min-h-6 min-w-0 cursor-pointer',
            disabled && 'cursor-not-allowed',
            p.labelColor != null && labelColorCls,
          )}
          htmlFor={id}
        >
          <span className="flex min-w-0 items-center">
            <span className="break-words" title={p.label || undefined}>{p.label}</span>
            <RequiredMark required={p.required} />
          </span>
        </label>
      </div>
      {/* A DECLARED two-line budget at a 65ch measure, paired with break-words so a
          long token breaks instead of running past the clamp box. This is the honest
          form of a bound — unlike a single clipped line, the reader sees the copy
          flow and stop. */}
      {p.description != null && <span className="line-clamp-2 max-w-[65ch] break-words text-[0.8125rem] [color:var(--fr-field-muted,var(--color-muted-foreground))]" title={p.description || undefined}>{p.description}</span>}
      <HelpLine helpText={p.helpText} errorText={fieldError} />
    </div>
  );
}

export function Radio({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label: string;
    name: string;
    options: Array<string | { value: string; label: string }>;
    value?: string | null;
    orientation?: string | null;
    gap?: string | null;
    gapValue?: string | number | null;
    mutedColor?: string | null;
    disabled?: boolean | null;
    readonly?: boolean | null;
    required?: boolean | null;
    checks?: FieldCheck[] | null;
    validateOn?: ValidateOn | null;
    helpText?: string | null;
    errorText?: string | null;
    size?: string | null;
    labelPlacement?: string | null;
    accent?: string | null;
    width?: string | number | null;
    labelColor?: string | null;
  };
  const [value, setValue] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  // `checks` / `validateOn`, wired. An authored errorText still wins.
  const { error: fieldError, onBlur: onChecksBlur } = useFieldChecks({
    id: String((element.props as { __fid?: unknown })?.__fid ?? p.name ?? "field"),
    value: value,
    checks: p.checks,
    validateOn: p.validateOn,
    required: p.required,
    errorText: p.errorText,
  });
  const emitWith = useIntrinsicEmit(emit, element);
  const fieldRequired = useContext(FieldRequiredContext);
  /* LATCH — ANY declared action latches its control, on any
     verb. Once it goes back to the agent the agent owns what happens next, so the
     control must not fire it twice. useCommitLatch watches every verb this element
     declares. */
  const latched = useCommitLatch(element);
  const disabled = ((p.disabled ?? false) || latched) as true | false;
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  return (
    <fieldset
      className={cn(
        'm-0 flex flex-col gap-1.5 border-none p-0',
        // `width` constrains the whole group (options + label wrap), like Checkbox.
        p.width != null && '[width:var(--fr-field-w)] max-w-full',
      )}
      style={styleVars(
        { var: '--fr-radio-accent', value: p.accent, kind: 'color' },
        { var: '--fr-field-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-field-label', value: p.labelColor, kind: 'color' },
        { var: '--fr-field-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 900 } },
      )}
    >
      <legend
        className={cn(
          labelRecipe({ placement: (p.labelPlacement as 'top' | 'hidden' | null) ?? undefined, disabled }),
          p.labelColor != null && labelColorCls,
        )}
      >
        <span className="flex min-w-0 items-center">
          <span className="break-words" title={p.label || undefined}>{p.label}</span>
          <RequiredMark required={p.required} />
        </span>
      </legend>
      <div
        className={cn(
          radioGroupRecipe({
            orientation: (p.orientation as 'horizontal' | 'vertical' | null) ?? undefined,
            gap: (p.gap as 'sm' | 'md' | 'lg' | null) ?? undefined,
          }),
        )}
        // exact option spacing (master §9: `gapValue`, NOT `gap` — see schema note)
        // — inline on the SAME div as the enum's default var so it always wins.
        style={styleVars({ var: '--fr-radio-gap', value: p.gapValue, kind: 'dim', opts: { units: ['px', 'rem'], max: 32 } })}
      >
        {/* options accept plain strings OR {value,label} pairs (the same union
            Select takes) — normalize to {value,label} once. An object option used
            to reach the <span> below as a raw React child and throw "Objects are
            not valid as a React child", which blanked the entire card rather than
            just the field: generating models reach for [{label,value}] here
            because every other option component takes it. */}
        {(p.options ?? [])
          .map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt))
          .filter((o): o is { value: string; label: string } => o != null && typeof o === 'object' && typeof o.value === 'string')
          .map((o, i) => (
          <label key={`${o.value}-${i}`} className={cn(radioOption({ size, disabled }), 'min-w-0')}>
            <input
              className="shrink-0"
              type="radio"
              name={p.name}
              value={o.value}
              checked={value === o.value}
              disabled={p.disabled ?? undefined}
              required={p.required ?? (fieldRequired || undefined)}
              aria-invalid={fieldError != null ? true : undefined}
              onChange={() => {
                if (p.readonly === true) return;
                setValue(o.value);
                emitWith('change', { value: o.value, name: p.name ?? null });
              }}
            />
            {/* An option's text IS the choice — wrap it rather than ellipsising
                the thing being chosen. NO `min-w-0` on this leaf: its automatic
                minimum IS its longest word, and that floor is the one we want —
                overriding it let the row squeeze the text to a few px and spell
                the option one character per line. `break-words` stays, so a word
                genuinely wider than the row still breaks instead of escaping.
                The wrapping <label> keeps its `min-w-0` — that one IS a flex
                container and must be free to shrink. */}
            <span className="break-words" title={o.label || o.value || undefined}>{o.label ?? o.value}</span>
          </label>
        ))}
      </div>
      <HelpLine helpText={p.helpText} errorText={fieldError} />
    </fieldset>
  );
}

export function Switch({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label: string;
    name: string;
    checked?: boolean | null;
    offColor?: string | null;
    description?: string | null;
    mutedColor?: string | null;
    onLabel?: string | null;
    offLabel?: string | null;
    disabled?: boolean | null;
    readonly?: boolean | null;
    required?: boolean | null;
    checks?: FieldCheck[] | null;
    validateOn?: ValidateOn | null;
    helpText?: string | null;
    errorText?: string | null;
    size?: string | null;
    labelPlacement?: string | null;
    accent?: string | null;
    width?: string | number | null;
    labelColor?: string | null;
  };
  const id = fieldId(bindings?.value, bindings?.checked, p.name, p.label);
  const [checked, setChecked] = useBoundProp<boolean>(p.checked ?? undefined, bindings?.checked);
  // `checks` / `validateOn`, wired. An authored errorText still wins.
  const { error: fieldError, onBlur: onChecksBlur } = useFieldChecks({
    id: String((element.props as { __fid?: unknown })?.__fid ?? p.name ?? "field"),
    value: checked,
    checked: checked,
    checks: p.checks,
    validateOn: p.validateOn,
    required: p.required,
    errorText: p.errorText,
  });
  const emitWith = useIntrinsicEmit(emit, element);
  const isOn = checked ?? false;
  /* LATCH — ANY declared action latches its control, on any
     verb. Once it goes back to the agent the agent owns what happens next, so the
     control must not fire it twice. useCommitLatch watches every verb this element
     declares. */
  const latched = useCommitLatch(element);
  const disabled = ((p.disabled ?? false) || latched) as true | false;
  const inert = disabled || p.readonly === true;
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const sideLabel = isOn ? p.onLabel : p.offLabel;
  const rootStyle = styleVars(
    { var: '--fr-field-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-field-label', value: p.labelColor, kind: 'color' },
    // `width` constrains the whole field (track + label wrap), like Checkbox.
    { var: '--fr-field-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 900 } },
  ) as CSSProperties;
  return (
    <div className={cn(field(), p.width != null && '[width:var(--fr-field-w)] max-w-full')} style={rootStyle}>
      <div className={cn(field({ inline: true }))}>
        <button
          id={id}
          type="button"
          role="switch"
          className={cn(switchTrack({ size, on: isOn as true | false, disabled }))}
          aria-checked={isOn}
          data-checked={isOn}
          aria-invalid={fieldError != null ? true : undefined}
          disabled={inert ? true : undefined}
          style={styleVars(
            { var: '--fr-switch-accent', value: p.accent, kind: 'color' },
            { var: '--fr-switch-off', value: p.offColor, kind: 'color' },
          )}
          onClick={() => {
            if (inert) return;
            setChecked(!isOn);
            emitWith('change', { checked: !isOn, name: p.name ?? null });
          }}
        >
          <span className={cn(switchThumb({ size, on: isOn as true | false }))} />
        </button>
        {sideLabel != null && <span className="shrink-0 text-sm [color:var(--fr-field-muted,var(--color-muted-foreground))] tabular-nums">{sideLabel}</span>}
        <label
          className={cn(
            labelRecipe({ placement: (p.labelPlacement as 'top' | 'hidden' | null) ?? undefined, disabled }),
            // A `label[for]` toggles the box, so it IS part of the target — but a
            // 14x14 input beside a 20px-tall label gives a ~20px target, under the
            // 24px floor (WCAG 2.5.8), and the label advertised `cursor: default`
            // while being clickable. min-h-6 lifts the row to 24 and the pointer
            // tells the truth about it.
            'min-h-6 min-w-0 cursor-pointer',
            disabled && 'cursor-not-allowed',
            p.labelColor != null && labelColorCls,
          )}
          htmlFor={id}
        >
          <span className="flex min-w-0 items-center">
            <span className="break-words" title={p.label || undefined}>{p.label}</span>
            <RequiredMark required={p.required} />
          </span>
        </label>
      </div>
      {/* A DECLARED two-line budget at a 65ch measure, paired with break-words so a
          long token breaks instead of running past the clamp box. This is the honest
          form of a bound — unlike a single clipped line, the reader sees the copy
          flow and stop. */}
      {p.description != null && <span className="line-clamp-2 max-w-[65ch] break-words text-[0.8125rem] [color:var(--fr-field-muted,var(--color-muted-foreground))]" title={p.description || undefined}>{p.description}</span>}
      <HelpLine helpText={p.helpText} errorText={fieldError} />
    </div>
  );
}

export function Slider({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label?: string | null;
    name?: string | null;
    min?: number | null;
    max?: number | null;
    step?: number | null;
    value?: number | null;
    showValue?: boolean | null;
    trackColor?: string | null;
    valueSuffix?: string | null;
    marks?: Array<number | { value: number; label: string }> | null;
    mutedColor?: string | null;
    disabled?: boolean | null;
    readonly?: boolean | null;
    required?: boolean | null;
    checks?: FieldCheck[] | null;
    validateOn?: ValidateOn | null;
    helpText?: string | null;
    errorText?: string | null;
    size?: string | null;
    labelPlacement?: string | null;
    accent?: string | null;
    width?: string | number | null;
    labelColor?: string | null;
    emitOnChange?: boolean | null;
  };
  const id = fieldId(bindings?.value, bindings?.checked, p.name, p.label);
  const [value, setValue] = useBoundProp<number>(p.value ?? undefined, bindings?.value);
  // `checks` / `validateOn`, wired. An authored errorText still wins.
  const { error: fieldError, onBlur: onChecksBlur } = useFieldChecks({
    id: String((element.props as { __fid?: unknown })?.__fid ?? p.name ?? "field"),
    value: value,
    checks: p.checks,
    validateOn: p.validateOn,
    required: p.required,
    errorText: p.errorText,
  });
  const emitWith = useIntrinsicEmit(emit, element);
  const min = p.min ?? 0;
  const max = p.max ?? 100;
  /* UNRESOLVED VALUE. `const current = value ?? min` printed a confident number
     for a value that does not exist. It became a LIVE path the day `$computed`
     got a function registry: a REGISTERED function returning `undefined` — which
     is the whole contract of `divide({a:1,b:0})`, of `sum` over an unseeded
     collection, of every refusal in functions.ts — arrived here and rendered as
     the readout "0", the DOM `value="0"` a Form then submits, and a screen reader
     announcing "0". Before the registry nothing resolved at all, so this fallback
     never fired on a computed value.

     Sliders almost always bind `$bindState`, and some bind a path the spec never
     seeds — "Session timeout 5 minutes", "Two-factor recovery codes 0" — each a
     figure the reader has no way to tell from a real one. None authors
     `value: null`, so showing the empty state costs a legal spec nothing.

     Same treatment as Gauge and ProgressCircle: an en dash where the number goes,
     the words "no value" for the screen reader (a dash carries nothing in audio),
     and no filled track. A literal 0 is a REAL reading and still renders as 0 —
     only a non-numeric arrival is empty. */
  const resolved = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const hasValue = resolved !== null;
  const current = resolved ?? min;
  // Fill % for the custom-track gradient (only used when `trackColor` is set; the
  // bound value re-renders this so the fill tracks the thumb). No value → no fill:
  // a painted track is a claim about where the thumb is.
  const pct = hasValue && max > min ? Math.min(Math.max(((current - min) / (max - min)) * 100, 0), 100) : 0;
  /* LATCH — ANY declared action latches its control, on any
     verb. Once it goes back to the agent the agent owns what happens next, so the
     control must not fire it twice. useCommitLatch watches every verb this element
     declares. */
  const latched = useCommitLatch(element);
  const disabled = ((p.disabled ?? false) || latched) as true | false;
  const inert = disabled || p.readonly === true;
  const showValue = p.showValue ?? true;
  const suffix = p.valueSuffix ?? '';
  const marks = (p.marks ?? [])
    .map((m) => (typeof m === 'number' ? { value: m, label: String(m) } : m))
    .filter((m): m is { value: number; label: string } => m != null && typeof m === 'object');
  const mutedStyle = styleVars(
    { var: '--fr-field-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-field-label', value: p.labelColor, kind: 'color' },
  ) as CSSProperties;
  // labelPlacement:'hidden' makes the WHOLE label sr-only — the live readout must
  // then move OUT of the label (a visible sibling), else showValue is silently
  // inert. The visible-label path below is untouched (byte-identical defaults).
  const hiddenLabel = ((p.labelPlacement as 'top' | 'hidden' | null) ?? 'top') === 'hidden';
  return (
    <div className={cn(field())} style={mutedStyle}>
      {(p.label != null || showValue) && (
        <label
          className={cn(
            labelRecipe({ placement: (p.labelPlacement as 'top' | 'hidden' | null) ?? undefined, disabled }),
            p.labelColor != null && labelColorCls,
          )}
          htmlFor={id}
        >
          <span className="flex min-w-0 items-center">
            <span className="break-words" title={p.label || undefined}>{p.label}</span>
            <RequiredMark required={p.required} />
          </span>
          {showValue && !hiddenLabel && (
            <span className="shrink-0 tabular-nums [color:var(--fr-field-muted,var(--color-muted-foreground))]">
              {hasValue ? current : '–'}
              {hasValue ? suffix : ''}
            </span>
          )}
        </label>
      )}
      {showValue && hiddenLabel && (
        <span className="shrink-0 self-end text-sm font-medium tabular-nums [color:var(--fr-field-muted,var(--color-muted-foreground))]">
          {hasValue ? current : '–'}
          {hasValue ? suffix : ''}
        </span>
      )}
      <input
        id={id}
        className={cn(
          sliderRecipe({ size: (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined, disabled }),
          // (no conditional width class — the recipe base already reads
          // [width:var(--fr-slider-w,100%)] max-w-full on this element, fallback included)
          // trackColor switches the slider to a custom appearance (native
          // accent-color can't recolour the unfilled track); see frayme.css.
          p.trackColor != null && 'fr-slider-custom',
        )}
        type="range"
        /* NAME ONLY WHEN THERE IS A VALUE. `Form` collects its `commit` payload
           with `new FormData(node)` (forms-extended.tsx), which reads the DOM —
           so an unresolved slider used to submit `budget: 0`, a fabricated figure
           that no reader and no handler can distinguish from a real one. A range
           input cannot be value-less in the DOM (dropping `value` makes the
           browser park the thumb at the MIDPOINT — a bigger invention than min),
           so the field is instead simply ABSENT from the payload until it has a
           value. A missing key is a defect the caller can catch; a confident 0 is
           not. Dragging the thumb resolves the value and the name comes back. */
        name={hasValue ? (p.name ?? undefined) : undefined}
        min={min}
        max={max}
        step={p.step ?? 1}
        value={current}
        /* The thumb has to sit somewhere; `aria-valuetext` stops the screen
           reader reading that resting position as the value, and the data
           attribute lets an automated check (and any host CSS) see the empty state. */
        aria-valuetext={hasValue ? undefined : 'no value'}
        data-fr-unresolved={hasValue ? undefined : ''}
        disabled={inert ? true : undefined}
        aria-invalid={fieldError != null ? true : undefined}
        style={{
          ...styleVars(
            { var: '--fr-slider-accent', value: p.accent, kind: 'color' },
            { var: '--fr-slider-track', value: p.trackColor, kind: 'color' },
            { var: '--fr-slider-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 900 } },
          ),
          ...(p.trackColor != null ? ({ '--fr-slider-pct': `${pct}%` } as CSSProperties) : {}),
        }}
        onChange={(e) => {
          if (inert) return;
          const next = Number(e.target.value);
          // Setter stays unconditional (bound spec.state live); gate only the per-tick stream.
          setValue(next);
          if (p.emitOnChange !== false) emitWith('change', { value: next, name: p.name ?? null });
        }}
        // Settled-value signal: one `commit` per interaction — the value at pointer
        // release (drag end) or after a keyboard nudge — always fired even when the
        // per-tick `change` stream is off. Reads the element's own value (in-scope).
        onPointerUp={(e) => {
          if (inert) return;
          emitWith('commit', { value: Number(e.currentTarget.value), name: p.name ?? null });
        }}
        onKeyUp={(e) => {
          if (inert) return;
          emitWith('commit', { value: Number(e.currentTarget.value), name: p.name ?? null });
        }}
      />
      {marks.length > 0 && (
        // Each mark sits at its TRUE value position along the track (Ant/MUI
        // convention): absolute left = ((value-min)/(max-min))% with a -50%
        // shift, so non-uniform marks like [0, 10, 100] land at 0/10/100%, not
        // spaced evenly. The inline `left` is a clamped derived percentage.
        <div className="relative h-4 w-full text-[0.6875rem] [color:var(--fr-field-muted,var(--color-muted-foreground))]">
          {marks.map((m, i) => {
            const mv = typeof m.value === 'number' && Number.isFinite(m.value) ? m.value : min;
            const mpct = max > min ? Math.min(Math.max(((mv - min) / (max - min)) * 100, 0), 100) : 0;
            return (
              // nowrap EARNED: an absolutely-positioned tick label has no column of
              // its own — shrink-to-fit would wrap "50%" to one glyph per line at
              // the track edge. It carries no overflow:hidden, so nothing is ever
              // deleted; a long mark label simply paints past its tick.
              <span key={i} className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${mpct}%` }}>
                {m.label}
              </span>
            );
          })}
        </div>
      )}
      <HelpLine helpText={p.helpText} errorText={fieldError} />
    </div>
  );
}
