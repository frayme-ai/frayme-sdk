'use client';
import type { CSSProperties, ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit, useCommitLatch } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { FormValidationProvider } from '../field-validation.js';
import { FieldDescriptionContext, FieldLabelContext, FieldRequiredContext, type FieldDescription } from './forms.js';
import { styleVars, fontClass, weightClass, trackingClass, leadingClass } from './_style.js';
import { Icon } from './icons.js';

/* Catalog group: Form, FormField, FieldError, Label, SearchInput.
 *
 * The field-CHROME family — the <form>, label, help/error, and search pieces
 * that sit AROUND the existing controls (Input/Textarea/Select/… in forms.tsx).
 * Same truly-dynamic contract as Phases 1–4:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (color/dimension the model names directly) NEVER become
 *     classes — they land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`,
 *     read by STATIC arbitrary `var(--fr-…, var(--color-…))` utilities. The class
 *     set stays closed (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing/absent
 *     value so the token fallback wins (props-less → polished).
 *
 * Defaults live in CVA `defaultVariants`, never the schema (schema props are
 * `.nullable()`), so a props-less spec still renders polished. Label/help/error
 * scaffolding mirrors forms.tsx (RequiredMark, the danger-toned error line). */

/* ── shared label/help/error scaffold (mirrors forms.tsx) ─────────────────── */

const labelRecipe = cva('flex items-center gap-1 font-medium', {
  variants: {
    placement: {
      top: '',
      left: '',
      // `hidden` keeps the label in the DOM for a11y but visually removes it.
      hidden: 'sr-only',
    },
    size: { sm: 'text-[0.8125rem]', md: 'text-sm', lg: 'text-base' },
  },
  defaultVariants: { placement: 'top', size: 'md' },
});

const helpRecipe = cva('', {
  variants: {
    kind: { help: '[color:var(--fr-formfield-muted,var(--color-muted-foreground))]', error: 'text-danger' },
    size: { sm: 'text-[0.75rem]', md: 'text-[0.8125rem]', lg: 'text-sm' },
  },
  defaultVariants: { kind: 'help', size: 'md' },
});

/** A small `*` marker appended to a required field's label. */
function RequiredMark({ required }: { required?: boolean | null }): ReactNode {
  return required === true ? (
    <span className="shrink-0 text-danger" aria-hidden>
      *
    </span>
  ) : null;
}

/** The muted help / danger error line under a field group (error wins). */
function HelpLine({
  helpText,
  errorText,
  size,
}: {
  helpText?: string | null;
  errorText?: string | null;
  size?: 'sm' | 'md' | 'lg';
}): ReactNode {
  if (errorText != null)
    return (
      <span className={cn(helpRecipe({ kind: 'error', size }), 'line-clamp-2 max-w-[65ch] break-words')} role="alert" title={errorText || undefined}>
        {errorText}
      </span>
    );
  // max-w-[65ch]: help/error copy wraps at a readable measure instead of stretching
  // to the full container width (the wide-help defect — a long help line ran
  // to the panel edge on wide surfaces). Narrow surfaces are already < 65ch so unaffected.
  // line-clamp-2 + break-words is the DECLARED-budget form: the copy flows and stops
  // on a visible second line, and a long token breaks rather than running out of the
  // clamp box. Never `truncate` here — a one-line clip reads as if the sentence ended.
  if (helpText != null) return <span className={cn(helpRecipe({ kind: 'help', size }), 'line-clamp-2 max-w-[65ch] break-words')} title={helpText || undefined}>{helpText}</span>;
  return null;
}

/* ── Form ─────────────────────────────────────────────────────────────────── */

/* A horizontal Form cascades a default `labelPlacement:'left'` to its FormFields
   (each field can still override its own). Propagates through json-render because
   the resolved children render as React descendants of the <form>. */
const FormLayoutContext = createContext<{ placement?: 'top' | 'left' | 'hidden' }>({});

const formRecipe = cva('flex [width:var(--fr-form-w,auto)] max-w-full', {
  variants: {
    layout: {
      vertical: 'flex-col',
      // horizontal = stacked field ROWS, each rendered label-beside-control via the
      // cascaded FormLayoutContext (placement:'left'); the form itself stacks them.
      horizontal: 'flex-col',
      inline: 'flex-row flex-wrap items-end',
    },
    gap: {
      none: 'gap-0',
      sm: 'gap-2',
      md: 'gap-4',
      lg: 'gap-6',
      xl: 'gap-10',
    },
  },
  defaultVariants: { layout: 'vertical', gap: 'md' },
});

/**
 * THE FORM'S OWN COMMIT, EXPOSED TO ITS SUBMIT CONTROL.
 *
 * A Form carries the declared action; the control that fires it is a Button
 * somewhere below, which knows nothing about it. Two things need that link:
 *
 *  1. THE LATCH. `useCommitLatch` latches the element that DECLARES the action —
 *     but here that element is the <form>, and a form has no disabled state a
 *     reader can see. So the button that fired stayed live after a confirmed
 *     commit. Observed as
 *     ("setPriceAlert/latch: control did NOT gain the disabled attribute"), and
 *     reproduced here: the param freeze engaged — the fields went read-only —
 *     while the button that had just sent them was still pressable. A half-frozen
 *     screen is worse than an unfrozen one, because it reads as working.
 *
 *  2. THE DEAD SUBMIT. `submit: true` renders `type="submit"` and the native
 *     submit reaches the form, which is how declared-commit Forms are almost always
 *     authored and why they work. The exception is a Button with neither
 *     `submit` nor an `on` of its own: at present it is wired to nothing at all and the
 *     press does literally nothing. A control with NO bindings can only gain
 *     behaviour from this, never lose it — and its press still meets the confirm
 *     gate before anything is sent.
 *
 * NOT A BLANKET "any button in a form submits it". A Button that carries its own
 * `on` is doing its own job (Back, Cancel, "Send code"); existing specs have those
 * and they must stay untouched.
 */
export interface FormCommit {
  /** Fire the Form's own on.commit with its collected field values. */
  submit: () => void;
  /** True once the Form's declared action has committed — the submit control dies with it. */
  latched: boolean;
  /** Whether the Form declares a commit at all (nothing to submit when it does not). */
  declared: boolean;
}

const FormCommitContext = createContext<FormCommit | null>(null);

/** The enclosing Form's commit, or null outside one. */
export function useFormCommit(): FormCommit | null {
  return useContext(FormCommitContext);
}

export function Form({ element, children, emit }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    layout?: 'vertical' | 'horizontal' | 'inline' | null;
    gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | null;
    width?: string | number | null;
    disabled?: boolean | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  // The Form is the element that DECLARES the action, so it is the element whose
  // mirror the latch reads. The submit control below reads the answer through
  // FormCommitContext, because the <form> itself has no disabled state to show.
  const latched = useCommitLatch(element, 'commit');
  const formRef = useRef<HTMLFormElement | null>(null);
  const declared = (() => {
    const b = (element as { on?: Record<string, unknown> }).on?.commit;
    return b != null;
  })();
  /* ONE commit path, whether it arrived by native submit, by a bindings-less
     button, or by Enter — so all three meet the same confirm gate, the same
     required-param guard (useIntrinsicEmit) and the same latch. */
  const commit = useCallback(() => {
    const node = formRef.current;
    const fields = node ? Object.fromEntries(new FormData(node).entries()) : {};
    emitWith('commit', { fields });
  }, [emitWith]);
  const formCommit = useMemo<FormCommit>(() => ({ submit: commit, latched, declared }), [commit, latched, declared]);
  const fieldPlacement = (p.layout ?? 'vertical') === 'horizontal' ? ('left' as const) : undefined;
  // Fields register their validators here so a submit can ask the whole form at
  // once — and so a submit attempt can REVEAL every failing field, not just the
  // first one the browser happens to reach.
  const cascade = (
    <FormValidationProvider>
      <FormCommitContext.Provider value={formCommit}>
        <FormLayoutContext.Provider value={{ placement: fieldPlacement }}>{children}</FormLayoutContext.Provider>
      </FormCommitContext.Provider>
    </FormValidationProvider>
  );
  return (
    <form
      className={cn(
        formRecipe({
          layout: (p.layout as 'vertical' | 'horizontal' | 'inline' | null) ?? undefined,
          gap: (p.gap as 'none' | 'sm' | 'md' | 'lg' | 'xl' | null) ?? undefined,
        }),
        p.width != null && '[width:var(--fr-form-w)] max-w-full',
      )}
      style={styleVars({ var: '--fr-form-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 900 } }) as CSSProperties}
      ref={formRef}
      onSubmit={(e) => {
        // Always stop the native full-page reload; commit carries the collected field values.
        e.preventDefault();
        if (latched) return;
        commit();
      }}
      onKeyDown={(e) => {
        /* ENTER IN A TEXT FIELD IS A SUBMIT. The browser's implicit submission is
           not reliable here — it needs a native submit button, and a Form whose
           only action control is a bindings-less Button has none — so the form
           does it itself. Scoped to single-line text entry: Enter inside a
           <textarea> is a newline, and Enter on a button or a link is that
           control's own press, which must not be hijacked.
           preventDefault() stops the browser ALSO submitting where it would have,
           so the commit fires exactly once. */
        if (e.key !== 'Enter' || e.defaultPrevented || latched || !declared) return;
        const t = e.target as HTMLElement | null;
        if (!t || t.tagName !== 'INPUT') return;
        const type = (t as HTMLInputElement).type;
        if (type === 'button' || type === 'submit' || type === 'reset' || type === 'checkbox' || type === 'radio') return;
        e.preventDefault();
        commit();
      }}
    >
      {/* form-level disable cascades to every native control via a
          <fieldset disabled> (zero per-field wiring). `display:contents` keeps the
          fieldset out of the box model so the form's flex layout still governs the
          field rows directly — unset render stays byte-identical (children render
          bare, no fieldset). */}
      {p.disabled === true ? (
        <fieldset disabled className="contents m-0 min-w-0 border-0 p-0">
          {cascade}
        </fieldset>
      ) : (
        cascade
      )}
    </form>
  );
}

/* ── FormField ────────────────────────────────────────────────────────────── */

const fieldGroup = cva('flex gap-1.5', {
  variants: {
    placement: {
      top: 'flex-col',
      // label beside the control; the help/error line still flows under the row.
      left: 'flex-row flex-wrap items-center',
      hidden: 'flex-col',
    },
  },
  defaultVariants: { placement: 'top' },
});

export function FormField({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label: string;
    helpText?: string | null;
    errorText?: string | null;
    required?: boolean | null;
    labelPlacement?: 'top' | 'left' | 'hidden' | null;
    size?: 'sm' | 'md' | 'lg' | null;
    mutedColor?: string | null;
    weight?: string | null;
    tracking?: string | null;
  };
  // Own labelPlacement wins; else inherit the parent Form's cascade (horizontal → left).
  const ctx = useContext(FormLayoutContext);
  const placement = (p.labelPlacement as 'top' | 'left' | 'hidden' | null) ?? ctx.placement ?? 'top';
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  // Deterministic ids so the group's visible label + help/error are programmatically
  // associated (the wrapped control usually self-labels with its own hidden <label>,
  // so this is a group caption — role=group + aria-labelledby — not a control <label>
  // with htmlFor, which would double up).
  const slug = (p.label ?? 'field').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'field';
  const labelId = `fr-ff-${slug}-label`;
  const descId = `fr-ff-${slug}-desc`;
  const hasDesc = p.errorText != null || p.helpText != null;
  // The one line printed below (error wins, exactly as HelpLine decides it),
  // handed to the control(s) inside so a control repeating it word for word does
  // not print it again. Memoised so a re-render does not re-render every consumer.
  const fieldLine = useMemo<FieldDescription>(
    () =>
      p.errorText != null
        ? { kind: 'error', text: p.errorText }
        : p.helpText != null
          ? { kind: 'help', text: p.helpText }
          : null,
    [p.errorText, p.helpText],
  );
  return (
    <div
      className={cn(fieldGroup({ placement }))}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={hasDesc ? descId : undefined}
      style={styleVars({ var: '--fr-formfield-muted', value: p.mutedColor, kind: 'color' })}
    >
      <span
        id={labelId}
        className={cn(
          labelRecipe({ placement, size }),
          'min-w-0',
          // 6i typography channels: a SET value dedupe-wins its tw-merge group over
          // the baked font-medium (weight); unset → undefined → cn drops it →
          // byte-identical default. Placed LAST so the override wins.
          weightClass(p.weight),
          trackingClass(p.tracking),
        )}
      >
        {/* The group caption wraps, never ellipsises: `truncate` is nowrap +
            overflow:hidden, and the overflow zeroes this flex item's automatic
            minimum — in a `left` placement the control beside it squeezed the
            caption down and deleted the words. No `min-w-0` either, for the same
            reason from the other side: this leaf's automatic minimum is its
            longest word, and zeroing it let the caption shatter to one character
            per line. `break-words` still breaks an over-wide token. (The
            enclosing caption row keeps its `min-w-0` — it is the container.) */}
        <span className="break-words" title={p.label || undefined}>{p.label}</span>
        <RequiredMark required={p.required} />
      </span>
      {/* The control(s) the field wraps. A required-marked FIELD makes its
          control genuinely required (native validation) via the cascade —
          the asterisk is never just decoration. */}
      <div className="flex w-full flex-col gap-1.5">
        <FieldRequiredContext.Provider value={p.required === true}>
          <FieldDescriptionContext.Provider value={fieldLine}>
            <FieldLabelContext.Provider value={typeof p.label === 'string' ? p.label : null}>{children}</FieldLabelContext.Provider>
          </FieldDescriptionContext.Provider>
        </FieldRequiredContext.Provider>
        {hasDesc && (
          <div id={descId}>
            <HelpLine helpText={p.helpText} errorText={p.errorText} size={size} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── FieldError ───────────────────────────────────────────────────────────── */

const fieldError = cva('inline-flex items-center gap-1 text-danger', {
  variants: {
    size: { sm: 'text-[0.75rem]', md: 'text-[0.8125rem]' },
  },
  defaultVariants: { size: 'sm' },
});

export function FieldError({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    message: string;
    size?: 'sm' | 'md' | null;
  };
  // The alert glyph scales WITH the size enum (sm→14 · md→16, mirroring
  // SearchInput's size-derived iconSize) so md text doesn't dwarf a fixed icon.
  // Default sm → 14 (byte-identical when unset).
  const iconSize = ((p.size as 'sm' | 'md' | null) ?? 'sm') === 'md' ? 16 : 14;
  return (
    <span className={cn(fieldError({ size: (p.size as 'sm' | 'md' | null) ?? undefined }), 'min-w-0')} role="alert">
      <span className="shrink-0">
        <Icon name="alert-circle" size={iconSize} />
      </span>
      {/* A validation message is the one line the user MUST read to proceed —
          it wraps under the alert glyph rather than losing its tail to an
          ellipsis. The glyph is shrink-0, so only this span takes the wrap.
          It is a leaf, so it carries NO `min-w-0`: the longest word is the
          floor the text needs to stay legible. The alert row around it keeps
          `min-w-0` — that is the flex container. */}
      <span className="break-words" title={p.message || undefined}>{p.message}</span>
    </span>
  );
}

/* ── Label ────────────────────────────────────────────────────────────────── */

/* Each `size` sets the DEFAULT font-size VAR (read by the base through the exact
 * `fontSize` override) instead of a `text-*` / arbitrary font-size utility — so
 * the exact channel and the enum never collide in tailwind-merge (same CSS
 * property, different group → both would survive, order-decided). The md/lg
 * variants ALSO carry an explicit leading-* to reproduce the line-height the
 * original `text-sm`/`text-base` utilities set; the sm variant used an arbitrary
 * font-size that set NO line-height, so it adds none. Defaults are byte-identical
 * to the prior font-size + line-height. */
const labelStandalone = cva(
  'inline-flex items-center gap-1 font-medium [color:var(--fr-label-fg,var(--color-foreground))] [font-size:var(--fr-label-fs,var(--fr-label-fs-default,0.875rem))]',
  {
    variants: {
      size: {
        sm: '[--fr-label-fs-default:0.8125rem]',
        md: '[--fr-label-fs-default:0.875rem] leading-[calc(1.25/0.875)]',
        lg: '[--fr-label-fs-default:1rem] leading-[calc(1.5/1)]',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export function Label({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    text: string;
    htmlFor?: string | null;
    required?: boolean | null;
    size?: 'sm' | 'md' | 'lg' | null;
    fontSize?: string | number | null;
    color?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
  };
  return (
    <label
      className={cn(
        labelStandalone({ size: (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined }),
        // font cascades from the root; unset → undefined → cn drops it.
        fontClass(p.font),
        // value > token: only override the color when the model named one.
        p.color != null && '[color:var(--fr-label-fg)]',
        // 6i typography channels: a SET value dedupe-wins its tw-merge group over
        // the baked font-medium / size-baked leading-[calc(...)]; unset → undefined
        // → cn drops it → byte-identical default. Placed LAST so the override wins.
        weightClass(p.weight),
        trackingClass(p.tracking),
        leadingClass(p.leading),
      )}
      htmlFor={p.htmlFor ?? undefined}
      style={styleVars(
        { var: '--fr-label-fg', value: p.color, kind: 'color' },
        { var: '--fr-label-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem', 'em'], min: 10, max: 48 } },
      )}
    >
      {/* A standalone Label names the control next to it; wrap it rather than
          clip it (the inline-flex row's only other item is the shrink-0 asterisk,
          so nothing squeezes back). No `min-w-0` on this leaf — its longest word
          is the minimum the label is allowed to shrink to; `break-words` handles
          the one token that is genuinely wider. */}
      <span className="break-words" title={p.text || undefined}>{p.text}</span>
      <RequiredMark required={p.required} />
    </label>
  );
}

/* ── SearchInput ──────────────────────────────────────────────────────────── */

/* The search box. `accent` drives the focus ring + leading-icon color via a var
   with a primary-token fallback; border/bg route through their own vars.
   Each radius step sets the DEFAULT corner-radius VAR (not a rounded-* utility),
   and the base reads border-radius through the exact override → default chain, so
   the exact `radiusValue` channel and the `radius` enum never collide in
   tailwind-merge (same CSS property, different group → both would survive,
   order-decided). Step values reproduce the prior rounded-* exactly:
   none=0 · sm=0.25rem · md=var(--radius-frayme) · lg=1rem (rounded-2xl) ·
   full=9999px (rounded-full). */
const searchWrap = cva(
  'relative inline-flex [width:var(--fr-search-w,100%)] max-w-full items-center border transition-[border-color,box-shadow] focus-within:ring-2 [border-color:var(--fr-search-border,var(--color-border))] [background:var(--fr-search-bg,var(--color-card))] focus-within:[border-color:var(--fr-search-accent,var(--fr-accent))] focus-within:[--tw-ring-color:color-mix(in_srgb,var(--fr-search-accent,var(--fr-accent))_20%,transparent)] [border-radius:var(--fr-search-radius,var(--fr-search-radius-default,var(--radius-frayme)))]',
  {
    variants: {
      size: {
        sm: 'h-8 text-sm',
        md: 'h-10',
        lg: 'h-12 text-lg',
      },
      radius: {
        none: '[--fr-search-radius-default:0px]',
        sm: '[--fr-search-radius-default:0.25rem]',
        md: '[--fr-search-radius-default:var(--radius-frayme)]',
        lg: '[--fr-search-radius-default:1rem]',
        full: '[--fr-search-radius-default:9999px]',
      },
      disabled: { true: 'cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', radius: 'md', disabled: false },
  },
);

/* The leading search glyph inherits `accent` via a var with a muted fallback. */
const searchIcon = cva('pointer-events-none flex shrink-0 items-center justify-center [color:var(--fr-search-accent,var(--color-muted-foreground))]', {
  variants: {
    size: { sm: 'pl-2.5', md: 'pl-3', lg: 'pl-3.5' },
  },
  defaultVariants: { size: 'md' },
});

const searchControl = cva('h-full w-full border-0 bg-transparent font-[inherit] text-inherit outline-none [&::placeholder]:[color:var(--fr-search-muted,var(--color-muted-foreground))]', {
  variants: {
    size: { sm: 'px-2 text-sm', md: 'px-2.5', lg: 'px-3 text-lg' },
  },
  defaultVariants: { size: 'md' },
});

export function SearchInput({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    placeholder?: string | null;
    value?: string | null;
    name?: string | null;
    width?: string | number | null;
    size?: 'sm' | 'md' | 'lg' | null;
    radius?: 'none' | 'sm' | 'md' | 'lg' | 'full' | null;
    radiusValue?: string | number | null;
    loading?: boolean | null;
    clearable?: boolean | null;
    disabled?: boolean | null;
    borderColor?: string | null;
    bg?: string | null;
    accent?: string | null;
    mutedColor?: string | null;
    emitOnChange?: boolean | null;
  };
  const [value, setValue] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = (p.disabled ?? false) as true | false;
  const loading = p.loading === true;
  const clearable = p.clearable ?? true;
  const hasValue = (value ?? '').length > 0;
  const iconSize = size === 'sm' ? 15 : size === 'lg' ? 19 : 17;
  return (
    <div
      className={cn(searchWrap({ size, radius: (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined, disabled }))}
      style={styleVars(
        { var: '--fr-search-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 900 } },
        { var: '--fr-search-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        { var: '--fr-search-accent', value: p.accent, kind: 'color' },
        { var: '--fr-search-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-search-bg', value: p.bg, kind: 'color' },
        { var: '--fr-search-muted', value: p.mutedColor, kind: 'color' },
      )}
    >
      <span className={cn(searchIcon({ size }))} aria-hidden>
        <Icon name="search" size={iconSize} />
      </span>
      <input
        className={cn(searchControl({ size }))}
        type="search"
        name={p.name ?? undefined}
        role="searchbox"
        placeholder={p.placeholder ?? undefined}
        value={value ?? ''}
        disabled={p.disabled ?? undefined}
        aria-label={p.placeholder ?? 'Search'}
        onChange={(e) => {
          // setValue is UNCONDITIONAL so bound spec.state (bindings.value) stays live
          // for an external Button; only the per-keystroke change STREAM is gated.
          setValue(e.target.value);
          if (p.emitOnChange !== false)
            emitWith('change', { value: e.target.value, name: p.name ?? null });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.repeat && !e.nativeEvent.isComposing)
            emitWith('commit', { value: value ?? '', name: p.name ?? null });
        }}
      />
      {loading ? (
        <span
          className="mr-2.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent [color:var(--fr-search-muted,var(--color-muted-foreground))]"
          aria-hidden
        />
      ) : (
        clearable &&
        hasValue &&
        !disabled && (
          <button
            type="button"
            className={cn(
              'mr-1.5 inline-flex shrink-0 items-center justify-center rounded-full p-1 [color:var(--fr-search-muted,var(--color-muted-foreground))]',
              // Mutually-exclusive hover: with a custom bg or
              // mutedColor the hover pill derives from the muted var via color-mix
              // (resting text color keeps the var read — no token snap); otherwise
              // the EXACT prior token hover — byte-identical when both are unset.
              p.bg != null || p.mutedColor != null
                ? 'hover:[background:color-mix(in_srgb,var(--fr-search-muted,var(--color-muted-foreground))_15%,transparent)]'
                : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] hover:text-[color:var(--fr-surface-fg,var(--color-foreground))]',
            )}
            aria-label="Clear search"
            onClick={() => {
              setValue('');
              emitWith('change', { value: '', name: p.name ?? null });
            }}
          >
            <Icon name="x" size={15} />
          </button>
        )
      )}
    </div>
  );
}
