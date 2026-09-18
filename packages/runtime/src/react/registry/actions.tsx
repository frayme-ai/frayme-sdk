'use client';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit, useCommitLatch } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { useFormValidation } from '../field-validation.js';
import { useFormCommit } from './forms-extended.js';
import { useScrollEdges } from '../use-scroll-edges.js';
import { safeUrl, linkTargetRel } from './url-safety.js';
import { safeDimension } from '@frayme/catalog/validate';
import { accentTextVar, fontClass, leadingClass, motionClass, styleVars, trackingClass, weightClass } from './_style.js';
import { useAriaId } from './_aria.js';
import { Icon, hasIcon } from './icons.js';

/* Catalog group: Button, Link, DropdownMenu, Toggle, ToggleGroup, ButtonGroup, Pagination
 *
 * Truly dynamic: every action component shares ONE surface
 * (`actionShared`: accent/accentText/radius/size/fullWidth/align) plus its own
 * specifics. Shared conventions:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (color/dimension the model names directly) NEVER become
 *     classes — they land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`,
 *     read by STATIC arbitrary `var(--fr-…, var(--color-…))` utilities. The class
 *     set stays closed (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing value so
 *     the token fallback wins (props-less → polished).
 *
 * value > enum precedence (Button accent over variant/tone; ButtonGroup/
 * DropdownMenu/Pagination accent over variant): same CONDITIONAL-override-class
 * technique as data-display.tsx — the `[background:var(--fr-…)]` utility is only
 * added to cn() when the model supplied that value (`p.accent != null`), so the
 * enum class wins when absent and the var wins when present.
 *
 * Toggle/ToggleGroup pressed/active color (the documented `activeColor`/
 * `activeText` exception, master §2) reads through the `aria-pressed:` Tailwind
 * variant — `aria-pressed:[background:var(--fr-toggle-active)]` — so the value
 * recolors ONLY the pressed/selected state. `accent` (from actionShared) is
 * accepted as a fallback for `activeColor` so the surfaces stay consistent.
 *
 * Icons are NAMES resolved against the closed `icons.ts` registry (never raw
 * SVG; unknown name → nothing).
 */

/* ── shared enum maps (reused across recipes) ─────────────────────────────── */
const RADIUS = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-frayme',
  lg: 'rounded-2xl',
  full: 'rounded-full',
} as const;
type RadiusKey = keyof typeof RADIUS;
type SizeKey = 'sm' | 'md' | 'lg';

/* ── Button ───────────────────────────────────────────────────────────────── */

/* variant = visual hierarchy, tone = semantic intent (tone wins via tailwind-merge
   later bg-*). `accent`/gradient/borderColor route through inline vars read by the
   conditional override classes, so the model-named value beats the enum. */
const button = cva(
  // radiusValue var-chain SCOPED to the button (the shared RADIUS map is NOT mutated —
  // Toggle/ToggleGroup/ButtonGroup reuse it). The radius variant below sets
  // --fr-btn-radius-default per step in place of the shared RADIUS class on the button;
  // an exact radiusValue (--fr-btn-radius) wins. Steps byte-identical to the shared
  // RADIUS map: 0 / 0.25rem / radius-frayme / 1rem / 9999px (full = pill).
  // The min-width var-chain FLOORS AT 0, not auto: a flex item's automatic minimum
  // size is its label's intrinsic width, which no descendant `min-w-0` can lower —
  // the button then paints outside a narrow host panel instead of shrinking. 0
  // hands the shrink back to the flex line and lets the label span WRAP inside the
  // button (see the label span below — break-words, never truncate: a clipped
  // action label is an action the reader cannot identify); a model-named `minWidth`
  // still wins through --fr-btn-minw, and outside a flex/grid line auto and 0
  // compute identically.
  // `bg-transparent` IN THE BASE. A <button> that declares no background does not
  // paint nothing — it paints the UA's `buttonface`, and that keyword is resolved
  // from `color-scheme`, not from this file's tokens. `.frayme-root` sets
  // `color-scheme: dark` in dark mode, so the UA hands back #6b6b6b (luminance
  // 0.147 — lighter than every dark surface here: bg 0.007, card 0.010, muted
  // 0.020) and #efefef in light. Measured in headless Chromium over the compiled
  // utilities, `variant:danger` — "no resting fill, a HAIRLINE red border" per the
  // comment on it — painted a grey slab in BOTH modes and its own red label read
  // 1.93:1 dark / 4.20:1 light on it. The same button on HOVER read 6.70:1,
  // because the hover rule is the first thing in the recipe that actually
  // declares a background and so evicts the UA fill: it was more legible hovered
  // than at rest. `ghost`/`outline` never showed this only because they happen to
  // say `bg-transparent` themselves.
  // Declaring it once here closes the whole class rather than the two variants
  // that trip it at present. It is inert everywhere else: cva emits the base FIRST, so
  // every variant/tone that paints its own fill (primary's bg-foreground,
  // secondary + tone:neutral's bg-muted, the tone tints, surface soft/gradient)
  // is a later class in the same tailwind-merge group and dedupe-wins over it —
  // verified button-by-button across the 75-cell variant x tone x surface matrix,
  // where the only two painted surfaces that changed were the two UA ones.
  'inline-flex cursor-pointer items-center justify-center gap-1.5 border border-transparent bg-transparent font-medium transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)] [border-radius:var(--fr-btn-radius,var(--fr-btn-radius-default,var(--radius-frayme)))] [min-width:var(--fr-btn-minw,0px)]',
  {
    variants: {
      variant: {
        // NEUTRAL HIGH-CONTRAST primary. A saturated brand
        // fill made every primary button shout — and inside a `repeat` ONE authored
        // primary renders once per row, so a 9-invoice list became a wall of blue.
        // foreground/card invert by mode, so this is a near-white button with dark
        // text in dark mode and a near-black button with light text in light mode
        // — the modern default, and unmistakably the page's main action without
        // competing with status colour. A spec-supplied `accent` still overrides
        // (the "unless asked in the prompt/spec" rule).
        primary: 'bg-[color:var(--fr-btn-fill,var(--color-foreground))] text-[color:var(--fr-btn-ink,var(--color-card))]',
        secondary: 'border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-foreground shadow-none',
        // danger is QUIETER still — red, but not shouting:
        // no resting fill, a HAIRLINE red border (30% mix), a red label + red glyph
        // (icon inherits currentColor), and the red wash only appears on hover. A row
        // of Delete buttons is now red text behind a faint outline, not a wall of pink
        // slabs. Replaces the earlier 12%-fill + full-strength-border treatment, which
        // repeated per table row still read too loud.
        danger: 'border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[color:var(--color-danger)] hover:[background:color-mix(in_srgb,var(--color-danger)_10%,transparent)]',
        // INHERITED FOREGROUND. ghost/outline paint NO fill of their own — they
        // show whatever surface an ancestor painted — so `text-foreground` was a
        // RESET to the global token rather than the surface's own ink. A spec
        // authoring `Card {bg:"#12161f", color:"#e2e6f0"}` got rgb(24,24,27) on
        // dark navy — text effectively the same colour as its background. The spec
        // did nothing wrong; the component overrode it.
        // `currentColor` on the `color` property computes to the INHERITED value
        // (CSS Color 4 treats it as `color: inherit` there — it is not circular),
        // and `.frayme-root` sets `color: var(--frayme-fg)` while
        // `--color-foreground` IS `var(--frayme-fg)` — so this is byte-identical
        // at the top level and correct inside an authored container.
        // Kept as the text-COLOR group form (never a bare `[color:…]`) so the
        // accentText override added in cn() still dedupes-and-wins over it.
        // The variants that paint their OWN fill keep the token: `primary`
        // (bg-foreground/text-card), `secondary` + `tone.neutral` (bg-muted) —
        // their label belongs to that fill, not to the page behind it.
        ghost:
          // The hover wash follows the label for the same reason: `hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]`
          // is a token fill, so on a dark authored card it painted a LIGHT chip
          // under the now-light label (light-on-light — a defect traded, not
          // fixed). An 8% mix of currentColor is the tint this file already uses
          // for surface-relative hovers (SidebarItem 8%, Pagination 10%,
          // DropdownMenu/Toggle 12%) and it darkens or lightens with the surface.
          // NOT byte-identical: measured over white it lands ~#ebebec against
          // bg-muted's #f4f4f5 — a hair deeper, accepted so the hover cannot go
          // invisible on any surface.
          'border-transparent bg-transparent text-[color:currentColor] shadow-none hover:[background:color-mix(in_srgb,currentColor_8%,transparent)]',
        outline: 'border-[var(--fr-btn-border,var(--color-border))] bg-transparent text-[color:currentColor] shadow-none',
      },
      // Non-destructive semantic tones are a tinted surface with a coloured border
      // and label, not a saturated slab — a toolbar of tone-coloured buttons was
      // four competing alarms. `critical` is the destructive tone, so it takes the
      // quieter destructive treatment (no resting fill, hairline red border,
      // red label, hover-only red wash) — identical to `variant:danger` above.
      tone: {
        neutral: 'border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-foreground shadow-none',
        success:
          '[background:color-mix(in_srgb,var(--color-success)_12%,transparent)] border-[color:var(--color-success)] text-[color:var(--color-success)]',
        warning:
          '[background:color-mix(in_srgb,var(--color-warning)_12%,transparent)] border-[color:var(--color-warning)] text-[color:var(--color-warning)]',
        // `critical` states its no-fill EXPLICITLY, unlike its four siblings which
        // each paint a 12% tint. Without it the tone only changed the label, and
        // the variant's fill stayed underneath: the props-less
        // `Button {tone:"critical"}` is variant `primary`, so a red label landed on
        // primary's bg-foreground slab — #f87171 on #fafafa, 2.65:1 in dark
        // (#dc2626 on #18181b, 3.67:1 in light), and secondary+critical read 4.39:1
        // in light. This file's own header says tone wins the surface ("tone wins
        // via tailwind-merge later bg-*"); cva emits tone AFTER variant, so saying
        // it here is what makes that true for the one tone that wants NO surface.
        critical:
          'border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-transparent text-[color:var(--color-danger)] hover:[background:color-mix(in_srgb,var(--color-danger)_10%,transparent)]',
        info: '[background:color-mix(in_srgb,var(--color-info)_12%,transparent)] border-[color:var(--color-info)] text-[color:var(--color-info)]',
      },
      // fontSize var-chain: the baked text-sm/text-lg become the var fallback (with the
      // size step's paired line-height ratio preserved) so an exact fontSize
      // (--fr-btn-fs) wins; md bakes NO font-size (UA default), so its reader is added
      // conditionally in cn() only when the model supplied a fontSize (byte-identical
      // when unset). NEVER co-locate the var class with a text-* class.
      size: {
        sm: 'px-3 py-1.5 [font-size:var(--fr-btn-fs,0.875rem)] leading-[calc(1.25/0.875)]',
        // md BAKES 0.875rem: most specs never set `size`, so md is the de-facto
        // button, and at the inherited 1rem it rendered visibly larger than the
        // labels, help text and table cells around it.
        // An exact fontSize still wins via --fr-btn-fs (same var-chain as sm/lg).
        md: 'px-3.5 py-1.5 [font-size:var(--fr-btn-fs,0.875rem)] leading-[calc(1.25/0.875)]',
        lg: 'px-5 py-2.5 [font-size:var(--fr-btn-fs,1.125rem)] leading-[calc(1.75/1.125)]',
      },
      radius: {
        none: '[--fr-btn-radius-default:0px]',
        sm: '[--fr-btn-radius-default:0.25rem]',
        md: '[--fr-btn-radius-default:var(--radius-frayme)]',
        lg: '[--fr-btn-radius-default:1rem]',
        full: '[--fr-btn-radius-default:9999px]',
      },
      surface: {
        solid: '',
        gradient:
          'border-transparent text-primary-foreground [background-image:linear-gradient(to_right,var(--fr-btn-grad-from,var(--color-primary)),var(--fr-btn-grad-to,var(--color-primary)))]',
        soft: 'border-transparent [background:color-mix(in_srgb,var(--fr-btn-accent,var(--color-primary))_14%,transparent)] text-[color:var(--fr-btn-accent,var(--color-primary))] shadow-none hover:brightness-100',
      },
      // A button is sized to its text (canon CON-5). Without a width it
      // STRETCHES in any stretch-aligned parent — a flex column, a grid cell —
      // and a primary action ends up spanning the card with its label pushed to
      // one end.
      fullWidth: { true: 'w-full', false: 'w-fit' },
      align: { start: 'justify-start', center: 'justify-center', end: 'justify-end' },
    },
    defaultVariants: { variant: 'primary', size: 'md', radius: 'md', surface: 'solid', fullWidth: false, align: 'center' },
  },
);

/** Builtin state mutations — presses wiring ONLY these are local toggles/cancels,
 *  not submits, and must not trigger form validation. */
const PRESS_BUILTINS = new Set(['setState', 'pushState', 'removeState']);
/** Whether this element's press/commit wiring carries a NAMED (non-builtin)
 *  action — the submit surface. Used to gate native form validation. */
function wiresNamedSubmit(element: ComponentRenderProps['element']): boolean {
  const on = (element as { on?: Record<string, unknown> }).on;
  if (!on || typeof on !== 'object') return false;
  return ['press', 'commit'].some((verb) => {
    const bind = (on as Record<string, unknown>)[verb];
    if (!bind) return false;
    return (Array.isArray(bind) ? bind : [bind]).some((b) => {
      const a = (b as { action?: unknown } | null)?.action;
      return typeof a === 'string' && !PRESS_BUILTINS.has(a);
    });
  });
}

export function Button({ element, emit }: ComponentRenderProps): ReactNode {
  const fv = useFormValidation();
  const emitWith = useIntrinsicEmit(emit, element);
  // Latch after a DECLARED action commits — see useCommitLatch. Builtins never latch,
  // and a declined confirm never latches, because the mirror is written past that gate.
  const latched = useCommitLatch(element);
  /* THE ENCLOSING FORM'S COMMIT (forms-extended.tsx). A Form carries the declared
     action; this button fires it. Two consequences, both observed broken:
       · the latch belongs to the FORM's mirror, not this button's — so a button
         that had just sent the form's fields stayed live while the fields it sent
         were already frozen read-only;
       · a Button with NO bindings of its own inside such a Form was wired to
         nothing at all and its press did literally nothing.
     Scoped narrowly: `submit: true` (how declared-commit Forms are almost always
     authored) or a button carrying no `on` whatsoever. A button with its
     own binding is doing its own job — Back, Cancel, "Send code" — and is untouched. */
  const formCommit = useFormCommit();
  const p = (element.props ?? {}) as {
    label: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | null;
    tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null;
    disabled?: boolean | null;
    loading?: boolean | null;
    submit?: boolean | null;
    icon?: string | null;
    iconPosition?: 'start' | 'end' | null;
    ariaLabel?: string | null;
    surface?: 'solid' | 'gradient' | 'soft' | null;
    gradientFrom?: string | null;
    gradientTo?: string | null;
    borderColor?: string | null;
    minWidth?: string | number | null;
    accent?: string | null;
    accentText?: string | null;
    radius?: RadiusKey | null;
    radiusValue?: string | number | null;
    size?: SizeKey | null;
    fullWidth?: boolean | null;
    align?: 'start' | 'center' | 'end' | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const surface = (p.surface as 'solid' | 'gradient' | 'soft' | null) ?? undefined;
  const loading = p.loading === true;
  const iconStart = (p.iconPosition ?? 'start') === 'start';
  // the glyph scales with the `size` enum (sm 14 · md 16 · lg 18), mirroring
  // IconButton's ICONBTN_GLYPH map, so a size:lg Button no longer shows a 16px glyph
  // dwarfed by the larger label. Default md=16 is byte-identical to the prior fixed 16.
  const btnGlyphSize = ({ sm: 14, md: 16, lg: 18 } as const)[(p.size as SizeKey | null) ?? 'md'];
  const glyph = p.icon != null ? <Icon name={p.icon} size={btnGlyphSize} /> : null;
  const ownBindings = (element as { on?: Record<string, unknown> }).on;
  const hasOwnBinding = !!ownBindings && Object.keys(ownBindings).length > 0;
  // This button IS the form's submit surface.
  const formSubmits = !!formCommit?.declared && (p.submit === true || !hasOwnBinding);
  // A bindings-less button must still SUBMIT natively where it can (nothing else
  // would), but it must not ALSO fire through the context — one press, one commit.
  const dispatchesFormCommit = formSubmits && p.submit !== true;
  return (
    <button
      // submit=true renders type=submit so an enclosing Form commits natively on click/Enter.
      type={p.submit === true ? 'submit' : 'button'}
      className={cn(
        button({
          variant: (p.variant as 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | null) ?? undefined,
          tone: (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined,
          size: (p.size as SizeKey | null) ?? undefined,
          radius: (p.radius as RadiusKey | null) ?? undefined,
          surface,
          fullWidth: (p.fullWidth ?? false) as true | false,
          align: (p.align as 'start' | 'center' | 'end' | null) ?? undefined,
        }),
        // With the button hugging its text, `align` reads as WHERE THE BUTTON
        // SITS in its row rather than where its label sits inside it — which is
        // what an author means by align:"end" on an action. Only when explicitly
        // set, so an unset button still takes its parent's alignment.
        !(p.fullWidth ?? false) &&
          (p.align === 'end' ? 'self-end' : p.align === 'center' ? 'self-center' : p.align === 'start' ? 'self-start' : undefined),
        // value > enum: a model-named `accent` recolors the fill (solid surface
        // only; gradient/soft read their own vars). The override is added LAST so
        // tailwind-merge keeps the var over the variant/tone bg-*.
        p.accent != null && surface !== 'gradient' && surface !== 'soft' && '[background:var(--fr-btn-accent)]',
        // accent ALSO owns the border edge (IconButton parity — misc-extended sets
        // background AND border together): the BORDER-COLOR group form dedupes the
        // variant border-* (secondary's border-border, the base border-transparent)
        // so a recolored secondary button has no surviving token edge. The explicit
        // borderColor override below shares the group and is added LATER, so it
        // still dedupe-wins when both are named.
        p.accent != null && surface !== 'gradient' && surface !== 'soft' && 'border-[color:var(--fr-btn-accent,var(--color-border))]',
        // on-fill text: TEXT-COLOR group form (added LAST) so it dedupes-and-wins
        // over the variant/tone `text-*` utility — a bare `a bare arbitrary colour class` would be inert.
        p.accentText != null && 'text-[color:var(--fr-btn-accent-text,var(--color-primary-foreground))]',
        // BORDER-COLOR group form (was a bare arbitrary property, which loses to a
        // co-present border-border by stylesheet order) — dedupes the variant token
        // edge and, being LAST in the group, wins over the accent border above.
        p.borderColor != null && 'border-[color:var(--fr-btn-border,var(--color-border))]',
        // exact fontSize on size:md (no baked font-size to fold): the reader is only
        // added when the value is VALID — a present-but-invalid value would tw-merge
        // away the sm/lg fallback reader while styleVars omits the var (inherit leak).
        // (md now bakes its own font-size var-chain like sm/lg, so no conditional
        // reader is needed — the exact fontSize folds into --fr-btn-fs for every size.)
        // Closed Font enum → a static font-* utility (the whole button region inherits
        // it); weight/tracking/leading enums land LAST so a set value dedupe-wins its
        // group (the base font-medium stays the default weight). Unset → undefined →
        // dropped (byte-identical).
        fontClass(p.font),
        weightClass(p.weight),
        trackingClass(p.tracking),
        leadingClass(p.leading),
      )}
      disabled={(p.disabled ?? false) || loading || latched || (formSubmits && !!formCommit?.latched)}
      aria-busy={loading || undefined}
      // Icon-only button (empty label + an icon) needs an accessible name; also lets
      // any button override its computed name. Falls back to the visible label.
      aria-label={(typeof p.ariaLabel === 'string' && p.ariaLabel.trim()) ? p.ariaLabel : (typeof p.label === 'string' && p.label.trim() ? undefined : p.icon ?? undefined)}
      title={(typeof p.label === 'string' && p.label.trim()) ? undefined : (typeof p.ariaLabel === 'string' ? p.ariaLabel : undefined)}
      style={styleVars(
        { var: '--fr-btn-accent', value: p.accent, kind: 'color' },
        { var: '--fr-btn-accent-text', value: p.accentText, kind: 'color' },
        { var: '--fr-btn-grad-from', value: p.gradientFrom, kind: 'color' },
        { var: '--fr-btn-grad-to', value: p.gradientTo, kind: 'color' },
        { var: '--fr-btn-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-btn-minw', value: p.minWidth, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 640 } },
        // exact corner radius → --fr-btn-radius wins over the per-enum default var.
        { var: '--fr-btn-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        // exact label font size → --fr-btn-fs wins over the size step's baked fallback.
        { var: '--fr-btn-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
      onClick={(e) => {
        if (loading) return;
        // Required-field enforcement: a NAMED-action press inside a
        // <form> is the submit surface — run native validation first so
        // `required` inputs actually gate, with the browser's own bubbles/focus.
        // Builtin-only presses (cancel / setState toggles) skip: not submits.
        const form = (e.currentTarget as HTMLButtonElement).form;
        // Validation gates BOTH named submits AND explicit submit:true
        // buttons — a builtin-only chain (pushState draft + setState clear) on a
        // submit button used to bypass `required` entirely: pressing an empty
        // form pushed a blank row AND wiped the draft.
        // Plain builtin toggles/cancels (no submit:true) still skip.
        if (form && (p.submit === true || wiresNamedSubmit(element)) && !form.reportValidity()) return;
        // Frayme `checks` run ALONGSIDE native validation, not instead of it.
        // reportValidity() shows ONE browser tooltip on the FIRST invalid field;
        // validateAll() marks EVERY failing field, so the reader sees the whole of
        // what is wrong at once. Same condition, so a plain builtin toggle still
        // skips both.
        if (fv && (p.submit === true || formSubmits || wiresNamedSubmit(element)) && !fv.validateAll()) return;
        // Fire the enclosing Form's declared commit when this button is its submit
        // surface but carries no native submit of its own. `submit: true` keeps the
        // NATIVE path (type="submit" → the form's onSubmit), which already works.
        if (dispatchesFormCommit) formCommit?.submit();
        emitWith('commit', { label: p.label });
      }}
    >
      {loading && (
        <span
          className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {!loading && glyph && iconStart && <span className="shrink-0">{glyph}</span>}
      {/* break-words, not truncate: a button label is the promise the press makes —
          "Save chan…" is not a promise. The button has no fixed height, so a long
          label takes a second line inside it. */}
      <span className={cn('break-words', loading && 'opacity-70')} title={p.label || undefined}>{p.label}</span>
      {!loading && glyph && !iconStart && <span className="shrink-0">{glyph}</span>}
    </button>
  );
}

/* ── Link ─────────────────────────────────────────────────────────────────── */

// fontSize two-step var chain: each size step sets --fr-link-fs-default (folding the
// old text-sm/base/lg, with the paired line-height ratio preserved) and the base reads
// the exact --fr-link-fs first — so a model-named fontSize wins over the enum, and the
// unset path is byte-identical. NEVER co-locate the var class with a text-* class.
const link = cva(
  'inline-flex cursor-pointer items-center gap-1 [color:var(--fr-link,var(--color-primary))] [font-size:var(--fr-link-fs,var(--fr-link-fs-default,1rem))]',
  {
  variants: {
    variant: {
      inline: '',
      subtle: '[color:var(--fr-link,var(--color-muted-foreground))] hover:[color:var(--color-foreground)]',
      // button-surface radius: the baked rounded-frayme becomes the var fallback so an
      // exact radiusValue (--fr-link-radius) wins; only variant:button draws this
      // surface, so it's inherently gated to it (byte-identical when unset; inline/subtle
      // text links never get a border-radius).
      // this surface had drifted off Button entirely — a saturated brand fill,
      // a resting shadow, and the px-4 py-2 / 1rem sizing Button abandoned the same day.
      // A link rendered AS a button must be indistinguishable from a Button, so it takes
      // Button's neutral high-contrast primary and md footprint. The font size lands via
      // the compoundVariant below (the `size` block emits after this one in cva order).
      button:
        '[border-radius:var(--fr-link-radius,var(--radius-frayme))] border border-transparent bg-[color:var(--fr-btn-fill,var(--color-foreground))] px-3.5 py-1.5 font-medium text-[color:var(--fr-btn-ink,var(--color-card))] no-underline hover:brightness-95',
    },
    tone: {
      // INHERITED FOREGROUND (same class as Button ghost/outline above). A text
      // link paints no surface, and `neutral` means "the body-text colour here",
      // not "the global token" — pinned to --color-foreground it rendered
      // rgb(24,24,27) on an authored dark card. `currentColor` on `color`
      // computes to the inherited value, so it is byte-identical at the top level
      // (.frayme-root's colour IS --color-foreground) and follows an authored
      // container. The SEMANTIC tones below stay pinned: success/warning/critical/
      // info name a meaning, not a surface, so they must not drift.
      neutral: '[color:currentColor]',
      success: '[color:var(--color-success)]',
      warning: '[color:var(--color-warning)]',
      critical: '[color:var(--color-danger)]',
      info: '[color:var(--color-info)]',
    },
    size: {
      sm: '[--fr-link-fs-default:0.875rem] leading-[calc(1.25/0.875)]',
      md: '[--fr-link-fs-default:1rem] leading-[calc(1.5/1)]',
      lg: '[--fr-link-fs-default:1.125rem] leading-[calc(1.75/1.125)]',
    },
    weight: { normal: 'font-normal', medium: 'font-medium', semibold: 'font-semibold' },
    underline: { always: 'underline underline-offset-2', hover: 'no-underline hover:underline underline-offset-2', none: 'no-underline' },
  },
  // The button surface's md step is Button's md (0.875rem), not the link's 1rem. It has
  // to be re-asserted here rather than inside variant.button because cva emits variants
  // in key order — `size` lands AFTER `variant`, and tw-merge dedupes the custom property
  // by name, so a variant-set --fr-link-fs-default would lose to the size step. An exact
  // fontSize (--fr-link-fs) still wins over both, and an explicit size sm/lg keeps its
  // own step; only the default/md button link changes.
  compoundVariants: [
    { variant: 'button', size: 'md', class: '[--fr-link-fs-default:0.875rem] leading-[calc(1.25/0.875)]' },
  ],
  defaultVariants: { variant: 'inline', size: 'md', weight: 'normal', underline: 'always' },
  },
);

export function Link({ element, emit, on }: ComponentRenderProps): ReactNode {
  const emitWith = useIntrinsicEmit(emit, element);
  const p = (element.props ?? {}) as {
    label: string;
    href: string;
    external?: boolean | null;
    variant?: 'inline' | 'subtle' | 'button' | null;
    tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null;
    size?: SizeKey | null;
    weight?: 'normal' | 'medium' | 'semibold' | null;
    underline?: 'always' | 'hover' | 'none' | null;
    color?: string | null;
    accent?: string | null;
    accentText?: string | null;
    radiusValue?: string | number | null;
    icon?: string | null;
    // CONTENT/glyph override (i18n): the external-link affordance glyph
    // NAME, resolved through the closed icon registry. Default 'arrow-up-right'
    // (byte-identical to the current literal). Unknown/absent → the default glyph.
    externalIcon?: string | null;
    font?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const press = on('commit');
  const external = p.external === true;
  const variant = (p.variant as 'inline' | 'subtle' | 'button' | null) ?? undefined;
  const glyph = p.icon != null ? <Icon name={p.icon} size={14} /> : null;
  // Glyph NAME resolves only through the closed registry; unknown → the current default.
  const externalGlyph = p.externalIcon != null && hasIcon(p.externalIcon) ? p.externalIcon : 'arrow-up-right';
  return (
    <a
      className={cn(
        link({
          variant,
          tone: (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined,
          size: (p.size as SizeKey | null) ?? undefined,
          weight: (p.weight as 'normal' | 'medium' | 'semibold' | null) ?? undefined,
          underline: variant === 'button' ? undefined : (p.underline as 'always' | 'hover' | 'none' | null) ?? undefined,
        }),
        // value > tone (enum) > token: only override when supplied and not a button surface.
        p.color != null && variant !== 'button' && '[color:var(--fr-link)]',
        // the BUTTON surface accepts the actionShared accent/accentText vocabulary
        // (Button parity — the one button-shaped Link surface could not be recoloured):
        // accent repaints the neutral bg-foreground fill, accentText the on-fill label
        // via the TEXT-COLOR group form (dedupes-and-wins over the variant's text-card).
        // Both gated to variant:button; `color` keeps owning the text variants.
        p.accent != null && variant === 'button' && '[background:var(--fr-link-accent,var(--color-primary))]',
        p.accentText != null && variant === 'button' && 'text-[color:var(--fr-link-accent-text,var(--color-primary-foreground))]',
        // Closed Font enum → a static font-* utility (the label inherits it);
        // tracking/leading enums land LAST so a set value dedupe-wins its group
        // (the size step's folded leading-* stays the default). Unset → undefined →
        // dropped (byte-identical).
        fontClass(p.font),
        trackingClass(p.tracking),
        leadingClass(p.leading),
      )}
      href={safeUrl(p.href)}
      {...linkTargetRel(external)}
      style={styleVars(
        { var: '--fr-link', value: p.color, kind: 'color' },
        // button-surface fill + on-fill label (variant:button only — the readers
        // above are gated the same way, so text links never carry the vars).
        { var: '--fr-link-accent', value: variant === 'button' ? p.accent : null, kind: 'color' },
        { var: '--fr-link-accent-text', value: variant === 'button' ? p.accentText : null, kind: 'color' },
        // exact button-surface corner radius → --fr-link-radius wins over the baked
        // rounded-frayme fallback; only meaningful for variant:button (the only reader).
        { var: '--fr-link-radius', value: variant === 'button' ? p.radiusValue : null, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        // exact label font size → --fr-link-fs wins over the size step's default var.
        { var: '--fr-link-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
      onClick={(e) => {
        if (press.shouldPreventDefault) e.preventDefault();
        if (press.bound) emitWith('commit', { href: safeUrl(p.href), label: p.label, external });
      }}
    >
      {glyph && <span className="shrink-0">{glyph}</span>}
      {/* break-words, not truncate: a link label is the destination's name — the
          anchor is inline-flex with no height contract, so it wraps. */}
      <span className="break-words" title={p.label || undefined}>{p.label}</span>
      {external && (
        <span className="shrink-0" aria-hidden>
          <Icon name={externalGlyph} size={13} />
        </span>
      )}
    </a>
  );
}

/* ── DropdownMenu ─────────────────────────────────────────────────────────── */

const ddMenu = cva(
  // radiusValue var-chain SCOPED to the menu panel (the shared RADIUS map is NOT
  // mutated — Button/Toggle/ToggleGroup/ButtonGroup reuse it). The radius variant
  // below sets --fr-menu-radius-default per step in place of the shared RADIUS class
  // on ddMenu; an exact radiusValue (--fr-menu-radius) wins. Steps byte-identical to
  // the prior RADIUS map: 0 / 0.25rem / radius-frayme / 1rem / 9999px (full = pill).
  'absolute top-[calc(100%+0.25rem)] z-40 flex max-h-[var(--fr-menu-maxh,none)] min-w-full flex-col overflow-y-auto border border-border p-1 [border-radius:var(--fr-menu-radius,var(--fr-menu-radius-default,var(--radius-frayme)))] [width:var(--fr-menu-w,auto)] max-w-full',
  {
    variants: {
      menuSurface: {
        solid: 'bg-card shadow-md',
        elevated: 'bg-card shadow-xl',
        glass: 'bg-card/80 shadow-lg backdrop-blur-md',
      },
      radius: {
        none: '[--fr-menu-radius-default:0px]',
        sm: '[--fr-menu-radius-default:0.25rem]',
        md: '[--fr-menu-radius-default:var(--radius-frayme)]',
        lg: '[--fr-menu-radius-default:1rem]',
        full: '[--fr-menu-radius-default:9999px]',
      },
      align: { start: 'left-0', end: 'right-0', center: 'left-0' },
    },
    defaultVariants: { menuSurface: 'solid', radius: 'md', align: 'start' },
  },
);
const ddItem = cva(
  // NOTE: the resting `hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]` was MOVED OUT of this base into the per-item
  // render cn() so the accent-derived hover (--fr-menu-accent, 12% over transparent)
  // and the token hover stay mutually-exclusive — an arbitrary [background:color-mix]
  // hover does NOT dedupe a co-located `hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]` utility (the tw-merge trap).
  // shared focus-visible ring recipe (Button parity) so keyboard focus on a menu
  // item is visible — consistent across the action family.
  // break-words, not truncate: a menu item's label IS the choice, and the panel has
  // no fixed row height (it is `max-h-… overflow-y-auto`, so it scrolls in the
  // BLOCK axis) — a long option takes a second line instead of losing its tail.
  'block w-full cursor-pointer break-words rounded-[calc(var(--radius-frayme)/2)] border-none bg-none px-2.5 py-1.5 text-left text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)]',
  {
    variants: {
      // selected-item accent text: TEXT-COLOR group form so it dedupes-and-wins
      // over the base `text-inherit`; a bare `a bare arbitrary colour class` would be inert.
      selected: { true: 'font-semibold text-[color:var(--fr-menu-accent,var(--fr-accent))]', false: '' },
      size: { sm: 'text-sm', md: '', lg: 'text-lg' },
    },
    defaultVariants: { selected: false, size: 'md' },
  },
);

export function DropdownMenu({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  // The renderer canonicalizes on.press -> on.commit before the component sees it,
  // but check both so a hand-authored spec is not silently ignored.
  const __on = (element as { on?: Record<string, unknown> }).on;
  const commitBound = !!(__on && (__on.commit ?? __on.press));
  const emitWith = useIntrinsicEmit(emit, element);
  // LATCH — only meaningful when the menu IS the action (commitBound). A picker menu
  // that merely selects a sort order carries no declared action, so useCommitLatch
  // returns false and the menu keeps working exactly as it does now.
  const latched = useCommitLatch(element);
  const p = (element.props ?? {}) as {
    disabled?: boolean | null;
    label: string;
    items: Array<{ label: string; value: string }>;
    value?: string | null;
    placeholder?: string | null;
    triggerVariant?: 'primary' | 'secondary' | 'ghost' | 'outline' | null;
    menuSurface?: 'solid' | 'elevated' | 'glass' | null;
    triggerColor?: string | null;
    menuBg?: string | null;
    borderColor?: string | null;
    menuWidth?: string | number | null;
    maxHeight?: string | number | null;
    motion?: string | null;
    radiusValue?: string | number | null;
    accent?: string | null;
    accentText?: string | null;
    radius?: RadiusKey | null;
    size?: SizeKey | null;
    fullWidth?: boolean | null;
    // align comes from actionShared (start·center·end); only start/end are meaningful here.
    align?: 'start' | 'center' | 'end' | null;
    // CONTENT/glyph override (i18n): the trigger caret glyph NAME, resolved
    // through the closed icon registry. Default = the literal ▾ char (byte-identical
    // props-less); a known name swaps in <Icon/>, an unknown name keeps the ▾.
    caretIcon?: string | null;
  };
  const [value, setValue, frozen] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  // DropdownMenu already declares `latched` above (it was already latching).
  const isDisabled = (p.disabled ?? false) || frozen || latched;
  const [open, setOpen] = useState(false);
  // light-dismiss — outside-mousedown + Escape close the open menu (copy of the
  // Toggletip listener pattern; listeners attach ONLY while open). Re-clicking the
  // trigger still toggles it. shadcn/Radix menus behave this way.
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const selected = (p.items ?? []).find((i) => i.value === value);
  const radius = (p.radius as RadiusKey | null) ?? undefined;
  const size = (p.size as SizeKey | null) ?? undefined;
  // actionShared `align` is start·center·end; the menu edge is start·end — map center→start.
  const menuAlign = (p.align === 'end' ? 'end' : 'start') as 'start' | 'end';
  // aria-expanded on the trigger promises a panel; aria-controls names WHICH one.
  // The panel is mounted ONLY while open, so aria-controls is emitted only while
  // open too. It used to ride the trigger unconditionally, which is the Toggletip
  // /ai-flow defect (toggletip-disclosure.test.tsx, ai-flow-filter-disclosure.
  // test.tsx): a closed trigger named an id that is not in the document, and a
  // closed menu is the state a menu spends nearly all of its life in, so a
  // dangling reference is the common case, not the edge. ARIA only RECOMMENDS
  // aria-controls beside aria-haspopup, so dropping it costs a reader nothing,
  // while following a dangling IDREF lands them nowhere. The id is
  // INSTANCE-unique, not spec-id-only: json-render's
  // `repeat` re-renders this element once per row reusing one spec id, so the old
  // scheme gave every row's trigger the same aria-controls (measured: two rows
  // both emitted `frayme-menu-sut`), aiming row two at row one's menu.
  const menuId = useAriaId('menu', element)();
  return (
    <div
      ref={ref}
      className={cn('relative inline-block', p.fullWidth === true && 'block w-full')}
      data-open={open}
      style={styleVars(
        { var: '--fr-menu-accent', value: p.accent, kind: 'color' },
        // accentText lives on the WRAPPER (not the trigger) so BOTH readers — the
        // trigger label and the selected menu item — inherit it.
        { var: '--fr-menu-accent-text', value: p.accentText, kind: 'color' },
        // panel fill (value over the menuSurface enum) + panel border colour.
        { var: '--fr-menu-bg', value: p.menuBg, kind: 'color' },
        { var: '--fr-menu-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-menu-w', value: p.menuWidth, kind: 'dim', opts: { units: ['px', 'rem'], min: 80, max: 480 } },
        { var: '--fr-menu-maxh', value: p.maxHeight, kind: 'dim', opts: { units: ['px', 'rem'], min: 80, max: 480 } },
        // exact menu-panel corner radius → --fr-menu-radius (set on the wrapper,
        // cascades to ddMenu) wins over the panel's scoped per-enum default var.
        { var: '--fr-menu-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
    >
      <button
        type="button"
        disabled={isDisabled}
        className={cn(
          button({
            variant: (p.triggerVariant as 'primary' | 'secondary' | 'ghost' | 'outline' | null) ?? 'secondary',
            size,
            radius,
            fullWidth: (p.fullWidth ?? false) as true | false,
          }),
          p.triggerColor != null && '[background:var(--fr-menu-trigger)]',
          // on-fill text on the trigger: TEXT-COLOR group form so it dedupes-and-wins
          // over the trigger button's `text-*` (a bare `a bare arbitrary colour class` would be inert).
          p.accentText != null && 'text-[color:var(--fr-menu-accent-text,var(--color-primary-foreground))]',
        )}
        style={styleVars(
          { var: '--fr-menu-trigger', value: p.triggerColor, kind: 'color' },
          // radiusValue rounds the TRIGGER too (not only the panel): it feeds the
          // trigger's own Button radius chain — --fr-btn-radius wins over the
          // per-enum default already baked into the button cva base.
          { var: '--fr-btn-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
      >
        {/* break-words, not truncate: the trigger shows the CURRENT selection —
            clipping it hides what the control is set to. Button parity. */}
        <span className="break-words" title={(selected?.label ?? p.placeholder ?? p.label) || undefined}>{selected?.label ?? p.placeholder ?? p.label}</span>
        <span className="ml-2 inline-flex shrink-0 transition-transform" aria-hidden>
          {p.caretIcon != null && hasIcon(p.caretIcon) ? <Icon name={p.caretIcon} size={14} /> : '▾'}
        </span>
      </button>
      {open && (
        <div
          className={cn(
            ddMenu({ menuSurface: (p.menuSurface as 'solid' | 'elevated' | 'glass' | null) ?? undefined, radius, align: menuAlign }),
            // value > enum: a model-named menuBg repaints the panel fill over the
            // menuSurface bg-card classes (glass keeps its blur/shadow); a named
            // borderColor dedupes the base border-border via the group form. Both
            // conditional — unset stays byte-identical to the token panel.
            p.menuBg != null && '[background:var(--fr-menu-bg,var(--color-card))]',
            p.borderColor != null && 'border-[color:var(--fr-menu-border,var(--color-border))]',
            // OPT-IN enter animation on the mounted menu panel. Its own animate-*
            // group (no conflict). Unset/none → undefined → cn drops it → no animation,
            // byte-identical (the open menu appears instantly, exactly as before).
            motionClass(p.motion),
          )}
          id={menuId}
          role="menu"
        >
          {(p.items ?? []).map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitem"
              className={cn(
                ddItem({ selected: item.value === value, size }),
                // MUTUALLY-EXCLUSIVE hover: accent-derived tint (12% over transparent,
                // below the active fill) when accent is SET, else the EXACT prior token
                // hover. Never co-located — byte-identical to `hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]` when unset.
                p.accent != null
                  ? 'hover:[background:color-mix(in_srgb,var(--fr-menu-accent)_12%,transparent)]'
                  : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
                // accentText pairs with accent on the SELECTED item too (actionShared
                // contract): the group form dedupes-and-wins over the ddItem selected
                // accent reader; the in-var fallback keeps the accent chain when the
                // value fails validation. Conditional — unset stays byte-identical.
                p.accentText != null &&
                  item.value === value &&
                  'text-[color:var(--fr-menu-accent-text,var(--fr-menu-accent,var(--fr-accent)))]',
              )}
              data-selected={item.value === value}
              // The label is wrapped, not clipped, but a long option still reads
              // better as one hover string — expose the full text.
              title={item.label || undefined}
              onClick={() => {
                setValue(item.value);
                setOpen(false);
                emitWith('select', { value: item.value, label: item.label ?? null });
                // A menu is BOTH a picker and an action surface, and the two want
                // different verbs. `select` is the value semantics — an item was
                // chosen — and every existing spec relies on it. `commit` is the
                // terminal "do it" signal, which is what an Actions ▾ menu actually
                // performs, and what the action contract counts: validateActionContract
                // only sees bindings that canonicalize to commit, so a required action
                // fired from on.select was invisible to it and reported unbound.
                // EVENT_CONTRACT already says a "palette/menu action" IS a commit; only
                // DropdownMenu.events[] disagreed.
                //
                // Fired ONLY when the spec actually binds it. A picker menu (choose a
                // sort order) keeps exactly its current behaviour rather than
                // gaining a spurious second emit, and no existing spec changes.
                if (commitBound && !latched) emitWith('commit', { value: item.value, label: item.label ?? null });
              }}
            >
              {/* the selected item is marked by a trailing check glyph (registry
                  'check'), tinted by the selection accent (the ddItem selected variant
                  already reads --fr-menu-accent for the accent text). The row is a flex
                  so the check right-aligns; only the SELECTED item renders it, so an
                  unselected item stays the plain block label the recipe wraps. */}
              {item.value === value ? (
                <span className="flex items-center justify-between gap-2">
                  {/* break-words, not truncate: same contract as the ddItem base —
                      the check glyph beside it is shrink-0, so only this gives way. */}
                  <span className="break-words" title={item.label || undefined}>{item.label}</span>
                  <span className="shrink-0" aria-hidden>
                    <Icon name="check" size={14} />
                  </span>
                </span>
              ) : (
                item.label
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Toggle ───────────────────────────────────────────────────────────────── */

/* actionShared `align` → content justification within the control. It takes effect
   where the control has free width (fullWidth single controls; align-set groups
   whose items are not stretched). Shared by Toggle/ToggleGroup/ButtonGroup. */
const ALIGN_JUSTIFY: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

/* The pressed color is the value channel: `activeColor`/`activeText` (or `accent`
   as a fallback) land in --fr-toggle-active/-text and read through the
   `aria-pressed:` variant, so the value recolors ONLY the pressed state. */
const toggle = cva(
  // on-fill (pressed) text uses the TEXT-COLOR group form (`the aria-pressed text-colour group form`)
  // so it dedupes-and-wins over the resting `text-foreground`; a bare arbitrary
  // `a bare arbitrary colour class` would not dedupe. Tone variants below mirror the group form.
  // radiusValue var-chain SCOPED to the toggle (the shared RADIUS map is NOT mutated —
  // Button/ButtonGroup reuse it). The radius variant below sets --fr-toggle-radius-default
  // per step in place of the shared RADIUS class; an exact radiusValue (--fr-toggle-radius)
  // wins. Steps byte-identical to the shared RADIUS map: 0 / 0.25rem / radius-frayme / 1rem /
  // 9999px. Shared by Toggle + ToggleGroup; the attached/segmented case forces enum `none`
  // AND omits the per-item --fr-toggle-radius, then rounds ONLY the outer end-cap corners
  // via the group-level --fr-tgroup-radius chain (ButtonGroup parity — see ToggleGroup).
  // The pressed-state FALLBACK (when no activeColor/accent/tone
  // is named) is NEUTRAL — a muted fill + foreground text — matching shadcn/Radix
  // Toggle. activeColor/accent/tone still opt back into
  // a colored pressed state exactly as before (same var chain — only the trailing token
  // fallback moved, so a SET value is unaffected).
  // Shared focus-visible ring recipe (copied from
  // Button) so keyboard focus is visible on toggle/segment items — consistent across
  // the action family. The RESTING hover feedback is NOT baked here — it is added
  // in the render cn() so the accent-derived hover (--fr-toggle-active, 12% tint) and the
  // token hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] stay MUTUALLY-EXCLUSIVE (an arbitrary [background:color-mix]
  // hover does NOT dedupe a co-located hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] utility — the tw-merge trap).
  'inline-flex cursor-pointer items-center gap-1.5 border bg-card text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)] [border-radius:var(--fr-toggle-radius,var(--fr-toggle-radius-default,var(--radius-frayme)))] aria-pressed:border-[var(--fr-toggle-active,var(--fr-surface-sunken,var(--color-muted)))] aria-pressed:[background:var(--fr-toggle-active,var(--fr-surface-sunken,var(--color-muted)))] aria-pressed:text-[color:var(--fr-toggle-active-text,var(--fr-surface-fg,var(--color-foreground)))]',
  {
    variants: {
      variant: {
        default: 'border-border',
        outline: 'border-border bg-transparent',
      },
      size: { sm: 'px-2.5 py-1 text-sm', md: 'px-3.5 py-1.5', lg: 'px-4 py-2 text-lg' },
      radius: {
        none: '[--fr-toggle-radius-default:0px]',
        sm: '[--fr-toggle-radius-default:0.25rem]',
        md: '[--fr-toggle-radius-default:var(--radius-frayme)]',
        lg: '[--fr-toggle-radius-default:1rem]',
        full: '[--fr-toggle-radius-default:9999px]',
      },
      // A labelled toggle clears its automatic-minimum floor so a long label can
      // WRAP inside a narrow host panel instead of pushing the control out of it
      // (break-words on the label span — never truncate: a clipped toggle label is
      // an unreadable state). The icon-only box has no wrappable content, so it
      // keeps the floor and stays square.
      iconOnly: { true: 'aspect-square justify-center px-0', false: 'min-w-0' },
      tone: {
        neutral: 'aria-pressed:!border-foreground aria-pressed:[background:var(--color-foreground)] aria-pressed:text-[color:var(--color-card)]',
        // Non-destructive pressed tones are TINTED, not saturated. These use
        // the arbitrary-PROPERTY form ([background:…]) rather than bg-*, which is why
        // they survived the first pass's `bg-danger` grep — a pressed Toggle was
        // still a full red slab. `critical` is destructive, so it drops the
        // red wash entirely: a hairline red border (30% mix) + red label over the
        // base neutral pressed surface — no red fill, matching Button's danger.
        success: 'aria-pressed:!border-success aria-pressed:[background:color-mix(in_srgb,var(--color-success)_12%,transparent)] aria-pressed:text-[color:var(--color-success)]',
        warning: 'aria-pressed:!border-warning aria-pressed:[background:color-mix(in_srgb,var(--color-warning)_12%,transparent)] aria-pressed:text-[color:var(--color-warning)]',
        critical: 'aria-pressed:!border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] aria-pressed:text-[color:var(--color-danger)]',
        info: 'aria-pressed:!border-info aria-pressed:[background:color-mix(in_srgb,var(--color-info)_12%,transparent)] aria-pressed:text-[color:var(--color-info)]',
      },
    },
    defaultVariants: { variant: 'default', size: 'md', radius: 'md', iconOnly: false },
  },
);

/** Build the pressed-state inline vars common to Toggle + ToggleGroup. */
function activeVars(activeColor?: string | null, accent?: string | null, activeText?: string | null, accentText?: string | null) {
  return styleVars(
    // activeColor is canonical; accent (from actionShared) is the fallback.
    { var: '--fr-toggle-active', value: activeColor ?? accent, kind: 'color' },
    { var: '--fr-toggle-active-text', value: activeText ?? accentText, kind: 'color' },
  );
}

/** Build the RESTING (unpressed/unselected) inline vars common to Toggle +
   ToggleGroup. trackColor = resting base fill; borderColor = resting border;
   color = resting label text (Pagination parity — completes the resting trio).
   Only the pressed state reads the active vars, so these never touch it. */
function restingVars(trackColor?: string | null, borderColor?: string | null, color?: string | null) {
  return styleVars(
    { var: '--fr-toggle-track', value: trackColor, kind: 'color' },
    { var: '--fr-toggle-border', value: borderColor, kind: 'color' },
    { var: '--fr-toggle-fg', value: color, kind: 'color' },
  );
}

/* Resting-state conditional override classes shared by Toggle + ToggleGroup. They
   recolor ONLY the resting state — the pressed look uses the `aria-pressed:` variant
   in the cva (modifier group, never deduped by tw-merge), which wins when pressed.
   Added LAST in cn() so they dedupe-and-win over the resting `bg-card`/`border-border`;
   only present when the model named the value, so the token default holds otherwise.
   The border MUST be the group form `border-[color:…]` (not bare `[border-color:…]`):
   tw-merge doesn't dedupe a bare arbitrary property against `border-border`, and bare
   arbitrary rules sort earlier in the compiled sheet, so the token would win. */
function restingClasses(trackColor?: string | null, borderColor?: string | null, color?: string | null) {
  return cn(
    trackColor != null && '[background:var(--fr-toggle-track,var(--color-card))]',
    borderColor != null && 'border-[color:var(--fr-toggle-border,var(--color-border))]',
    // Resting label text (the text-color GROUP form so it dedupes-and-wins over the
    // base text-foreground); the pressed text still reads the higher-specificity
    // aria-pressed: variant. Token fallback inside → invalid values fall back safely.
    color != null && 'text-[color:var(--fr-toggle-fg,var(--color-foreground))]',
  );
}

/* resting hover feedback shared by Toggle + ToggleGroup items. When an
   accent/activeColor is named, hover the resting item with a faint 12% tint of that
   colour (matching the DropdownMenu/Pagination accent-hover convention); otherwise the
   EXACT prior neutral token hover (now the sunken channel read, which resolves to that same token when nothing is published). MUTUALLY-EXCLUSIVE — never co-located, so
   the arbitrary color-mix hover and the token hover never both survive tw-merge. The
   pressed/selected item overrides via the higher-specificity aria-pressed: variant. */
function restingHover(activeColor?: string | null, accent?: string | null): string {
  return activeColor != null || accent != null
    ? 'hover:[background:color-mix(in_srgb,var(--fr-toggle-active)_12%,transparent)]'
    : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]';
}

export function Toggle({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label: string;
    disabled?: boolean | null;
    pressed?: boolean | null;
    variant?: 'default' | 'outline' | null;
    size?: SizeKey | null;
    radius?: RadiusKey | null;
    iconOnly?: boolean | null;
    tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null;
    activeColor?: string | null;
    activeText?: string | null;
    accent?: string | null;
    accentText?: string | null;
    trackColor?: string | null;
    borderColor?: string | null;
    color?: string | null;
    radiusValue?: string | number | null;
    icon?: string | null;
    fullWidth?: boolean | null;
    align?: 'start' | 'center' | 'end' | null;
  };
  const [pressed, setPressed, frozen] = useBoundProp<boolean>(p.pressed ?? undefined, bindings?.pressed);
  const emitWith = useIntrinsicEmit(emit, element);
  const iconOnly = p.iconOnly === true;
  /* LATCH — ANY declared action latches its control, on any
     verb. Once it goes back to the agent the agent owns what happens next, so the
     control must not fire it twice. useCommitLatch watches every verb this element
     declares. */
  const latched = useCommitLatch(element);
  const isDisabled = (p.disabled ?? false) || frozen || latched;
  const glyph = p.icon != null ? <Icon name={p.icon} /> : null;
  return (
    <button
      type="button"
      className={cn(
        toggle({
          variant: (p.variant as 'default' | 'outline' | null) ?? undefined,
          size: (p.size as SizeKey | null) ?? undefined,
          radius: (p.radius as RadiusKey | null) ?? undefined,
          iconOnly: iconOnly as true | false,
          // tone provides a token pressed color; an explicit activeColor wins (var on the same prop).
          tone: p.activeColor == null && p.accent == null ? (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined : undefined,
        }),
        // resting hover (accent-tint when activeColor/accent set, else the token
        // hover). Placed BEFORE restingClasses so a set trackColor's [background:…]
        // override still wins the resting FILL; the hover is a :hover pseudo-state on a
        // separate modifier, so it is never deduped by the base fill.
        restingHover(p.activeColor, p.accent),
        // RESTING-state overrides (unpressed only — the pressed look reads the
        // higher-specificity aria-pressed: variant in the cva). Added LAST so they
        // dedupe-and-win over the resting bg-card/border-border/text-foreground.
        restingClasses(p.trackColor, p.borderColor, p.color),
        p.fullWidth === true && cn('w-full', p.align ? ALIGN_JUSTIFY[p.align] : 'justify-center'),
        // Same greyed treatment the rest of the registry uses for disabled.
        isDisabled && 'cursor-not-allowed opacity-60',
      )}
      /* A10 + lifecycle rules 3/4. Two reasons this exists:
         · an author could not ask for a disabled toggle at all — it was the one
           action-family control with no `disabled` channel, in schema or renderer;
         · `frozen` is the param freeze. useLocalOrBound returns it true once an
           action this control feeds has committed, and it already REJECTS the write.
           Without a disabled attribute the control kept looking live while silently
           ignoring presses, which is the "looks live but is inert" failure the
           freeze exists to prevent. */
      disabled={isDisabled}
      aria-pressed={pressed ?? false}
      // iconOnly hides the label visually but keeps it as the accessible name.
      aria-label={iconOnly ? p.label : undefined}
      // exact corner radius → --fr-toggle-radius wins over the per-enum default var.
      // Standalone Toggle is never attached, so it always applies.
      style={{
        ...activeVars(p.activeColor, p.accent, p.activeText, p.accentText),
        ...restingVars(p.trackColor, p.borderColor, p.color),
        ...styleVars({ var: '--fr-toggle-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } }),
      }}
      onClick={() => {
        const next = !(pressed ?? false);
        setPressed(next);
        emitWith('change', { pressed: next });
      }}
    >
      {glyph && <span className="shrink-0">{glyph}</span>}
      {/* break-words, not truncate: the label names the state being toggled. */}
      {!iconOnly && <span className="break-words" title={p.label || undefined}>{p.label}</span>}
    </button>
  );
}

/* ── ToggleGroup ──────────────────────────────────────────────────────────── */

export function ToggleGroup({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  // Gates the right-edge fade on real overflow (see use-scroll-edges).
  const railRef = useScrollEdges<HTMLDivElement>();
  const p = (element.props ?? {}) as {
    disabled?: boolean | null;
    items: Array<{ label: string; value: string }>;
    type?: 'single' | 'multiple' | null;
    value?: string | null;
    size?: SizeKey | null;
    radius?: RadiusKey | null;
    orientation?: 'horizontal' | 'vertical' | null;
    attached?: boolean | null;
    variant?: 'default' | 'outline' | null;
    tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null;
    fullWidth?: boolean | null;
    activeColor?: string | null;
    activeText?: string | null;
    accent?: string | null;
    accentText?: string | null;
    trackColor?: string | null;
    borderColor?: string | null;
    color?: string | null;
    gapValue?: string | number | null;
    radiusValue?: string | number | null;
    align?: 'start' | 'center' | 'end' | null;
    // optional per-item leading icons (registry NAMES), parallel to items —
    // ButtonGroup parity. Unknown/absent names render nothing (hasIcon guard).
    icons?: string[] | null;
    emitOnChange?: boolean | null;
  };
  const [value, setValue, frozen] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  /* LATCH — ANY declared action latches its control, on any
     verb. Once it goes back to the agent the agent owns what happens next, so the
     control must not fire it twice. useCommitLatch watches every verb this element
     declares. */
  const latched = useCommitLatch(element);
  const isDisabled = (p.disabled ?? false) || frozen || latched;
  const emitWith = useIntrinsicEmit(emit, element);
  const icons = Array.isArray(p.icons) ? p.icons : [];
  const multiple = p.type === 'multiple';
  const attached = p.attached === true;
  const vertical = p.orientation === 'vertical';
  const fullWidth = p.fullWidth === true;
  /* A `type:"multiple"` group binds a LIST, and the model binds a real array
     (a preferences group, say, binds a list path). `.split` is not a function on an
     array: the render threw, the error boundary swallowed the whole group, and
     the segments simply were not there. Both shapes are read here;
     the comma string stays the wire format on the way back out. */
  const selectedRaw = Array.isArray(value)
    ? (value as unknown[]).filter((v): v is string => typeof v === 'string').join(',')
    : typeof value === 'string'
      ? value
      : '';
  const selected = new Set(selectedRaw.split(',').filter(Boolean));
  const size = (p.size as SizeKey | null) ?? undefined;
  const radius = (p.radius as RadiusKey | null) ?? undefined;
  const variant = (p.variant as 'default' | 'outline' | null) ?? undefined;
  const toneArg = p.activeColor == null && p.accent == null ? (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined : undefined;
  // ATTACHED end caps (ButtonGroup parity): the segmented control rounds ONLY its
  // outer corners — first/last item, fed by radius (per-enum default var, the map
  // byte-identical to the shared RADIUS steps) with an exact radiusValue winning
  // via --fr-tgroup-radius. Inner edges stay square. The override is the 4-value
  // border-radius SHORTHAND (not per-corner longhands) ON PURPOSE: the toggle cva
  // base bakes a border-radius shorthand reader, and tw-merge dedupes only a
  // same-property arbitrary class — the shorthand override therefore becomes the
  // SOLE radius declaration on the end cap (a longhand would coexist with the
  // base shorthand and leave stylesheet order to decide). Literal class strings
  // so the Tailwind scanner compiles them.
  const TGROUP_RADIUS_DEFAULT: Record<RadiusKey, string> = {
    none: '0px',
    sm: '0.25rem',
    md: 'var(--radius-frayme)',
    lg: '1rem',
    full: '9999px',
  };
  const tgroupCapStart = vertical
    ? '[border-radius:var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))_var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))_0_0]'
    : '[border-radius:var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))_0_0_var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))]';
  const tgroupCapEnd = vertical
    ? '[border-radius:0_0_var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))_var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))]'
    : '[border-radius:0_var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))_var(--fr-tgroup-radius,var(--fr-tgroup-radius-default,var(--radius-frayme)))_0]';
  const itemCount = (p.items ?? []).length;
  return (
    <div
      ref={railRef}
      className={cn(
        // Same escape hatch as ButtonGroup: min-w-0 clears the wrapper's own
        // automatic-minimum floor (it is a flex item in most cards) and flex-wrap
        // carries items that no longer fit onto a second line, so a control group
        // in a narrow host panel gives way instead of painting outside it. Wrapping
        // rather than scrolling — every control stays reachable without a gesture.
        // A vertical group flows down the block axis already, so it keeps nowrap.
        'inline-flex min-w-0',
        vertical ? 'flex-col' : 'flex-row flex-wrap',
        fullWidth && cn('flex w-full', p.align ? ALIGN_JUSTIFY[p.align] : ''),
        // attached = segmented (joined, no gap); otherwise spaced by --fr-tgroup-gap.
        // The 1px seam overlap rides on EVERY item and the wrapper carries a matching
        // 1px gutter that absorbs it, so no segment's border box hangs outside the
        // wrapper. This is what makes the seam survive a WRAP: a DOM-keyed overlap
        // (`:not(:first-child)`) is only correct while there is one row — the segment
        // that starts row 2 is not `:first-child`, so it would pull 1px outside the
        // box. Overlap-on-all + gutter is correct per VISUAL row, which is the only
        // row CSS can see. The cross-axis pair (`pt-px` + `-mt-px`) does the same for
        // the seam BETWEEN wrapped rows, so rows join with the same 1px line as the
        // segments inside a row instead of a doubled 2px border. Unwrapped geometry is
        // identical to a DOM-keyed overlap: the gutter (+1px) and the first segment's
        // own overlap (-1px) cancel, on both axes and under every justify/flex-1 mode.
        // An ATTACHED strip is one continuous control: its end caps are the
        // block's outer corners, so it cannot wrap — a wrapped row would end
        // square mid-strip and start square on the next line. It scrolls
        // instead (fr-tabscroll-card carries the fade + thin scrollbar), which
        // keeps the geometry honest at any width. A DETACHED group is just
        // buttons, so it wraps.
        // `max-w-full` is what makes that scroll REACHABLE in a BLOCK parent.
        // The strip is inline-flex, so its width is shrink-to-fit — and a
        // shrink-to-fit box floors at its content, not at the container.
        // Measured in headless Chromium against the compiled utilities, three
        // segments in a 166px block host: the strip laid out 268px wide and
        // painted 102px outside the host, with scrollWidth === clientWidth ===
        // 268 (nothing to scroll, and the overflow moved to the PAGE). Capped
        // at 100% it becomes a 166px port over a 268px track — the same
        // geometry a flex parent already imposed. Only the horizontal branch
        // takes the cap; a vertical strip overflows on the block axis, where a
        // max-WIDTH says nothing.
        attached
          ? vertical
            ? 'pt-px [&>*]:-mt-px'
            : 'fr-tabscroll-card max-w-full flex-nowrap overflow-x-auto pl-px pt-px [&>*]:-ml-px [&>*]:-mt-px'
          : '[gap:var(--fr-tgroup-gap,0.25rem)]',
      )}
      role="group"
      style={{
        ...styleVars({ var: '--fr-tgroup-gap', value: p.gapValue, kind: 'dim', opts: { units: ['px', 'rem'], max: 32 } }),
        ...activeVars(p.activeColor, p.accent, p.activeText, p.accentText),
        ...restingVars(p.trackColor, p.borderColor, p.color),
        // exact per-item corner radius → --fr-toggle-radius (set on the group, cascades
        // to each item button) wins over the per-enum default. When ATTACHED the
        // per-item chain is omitted (items force enum `none`, inner edges square) and
        // radius/radiusValue feed the END-CAP chain instead: the per-enum default var
        // below + the exact --fr-tgroup-radius, read only by the first/last outer corners.
        ...(attached
          ? {
              '--fr-tgroup-radius-default': TGROUP_RADIUS_DEFAULT[radius ?? 'md'],
              ...styleVars({ var: '--fr-tgroup-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } }),
            }
          : styleVars({ var: '--fr-toggle-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } })),
      } as CSSProperties}
    >
      {(p.items ?? []).map((item, i) => {
        const isOn = multiple ? selected.has(item.value) : value === item.value;
        // per-item leading icon (registry NAME, hasIcon-guarded → nothing unknown).
        const iconName = icons[i];
        const glyph = iconName != null && hasIcon(iconName) ? iconName : null;
        return (
          <button
            key={item.value}
            type="button"
            /* A10 + lifecycle rules 3/4: an author could not ask for a disabled
               segment, and `frozen` (the param freeze from useLocalOrBound) already
               rejects the write — without this the control looked live while
               silently ignoring presses. */
            disabled={isDisabled}
            className={cn(
              toggle({ variant, size, radius: attached ? 'none' : radius, tone: toneArg }),
              // resting hover (accent-tint when activeColor/accent set, else the
              // token hover) — mutually-exclusive, never co-located. The selected item
              // overrides via the aria-pressed: variant.
              restingHover(p.activeColor, p.accent),
              // RESTING-state overrides on the UNSELECTED items (the pressed/selected
              // look reads the aria-pressed: variant). Added LAST so they dedupe-and-win
              // over the resting bg-card/border-border/text-foreground.
              restingClasses(p.trackColor, p.borderColor, p.color),
              // attached end caps: outer-corner rounding on the first/last item only
              // (dedupes the base shorthand reader — see the comment above the map).
              attached && (i === 0 ? tgroupCapStart : i === itemCount - 1 ? tgroupCapEnd : null),
              // A SCROLLING strip's items must keep their intrinsic width, or the
              // track has nothing to scroll and the scroller is decoration. The
              // items carry `min-w-0` (see the cva base), which hands the flex line
              // permission to squeeze them to nothing — correct for the detached,
              // WRAPPING group, fatal for the attached one. Measured in headless
              // Chromium, three segments labelled Yesterday/This week/This quarter
              // in a 166px host: 89·90·101px of content compressed to 54·55·59px,
              // every label broken onto two lines (30px tall → 45px), and
              // scrollWidth === clientWidth === 166 — the strip could not be
              // scrolled to the text it had just hidden. With shrink-0 the items
              // hold 89·90·101 and the track reports 278 over a 166px port.
              // MUTUALLY EXCLUSIVE with the fullWidth `flex-1` below rather than
              // co-located: `flex-1` is `flex: 1 1 0%`, so the two disagree about
              // flex-shrink and tw-merge keeps both (different property groups),
              // leaving stylesheet order to decide. fullWidth is an explicit
              // one-row contract — the same deal as a fitted tab or a fullWidth
              // SegmentedControl segment — so there the labels wrap instead.
              attached && !vertical && !(fullWidth && p.align == null) && 'shrink-0',
              fullWidth && (p.align == null ? 'flex-1 justify-center' : 'justify-center'),
            )}
            aria-pressed={isOn}
            onClick={() => {
              let nextValue = item.value;
              if (multiple) {
                const next = new Set(selected);
                if (isOn) next.delete(item.value);
                else next.add(item.value);
                nextValue = [...next].join(',');
              }
              // Setter stays unconditional so the (bindable) selection state stays live
              // and an external Button can read the accumulated value; gate only the emit.
              setValue(nextValue);
              emitWith('change', { value: nextValue, toggled: item.value ?? null });
            }}
          >
            {glyph != null && <span className="shrink-0"><Icon name={glyph} size={15} /></span>}
            {/* break-words, not truncate — in BOTH modes. Detached, the group is a
                flex-WRAP row, so a long segment label simply takes a second line.
                Attached, the strip is a real rail now (shrink-0 items over a
                capped track), so a label CAN reach the reader by scrolling — but
                only when it is not `flex-1`: a fullWidth strip still divides one
                row between its segments, and there a truncate would delete the
                label outright. One rule for both states is the readable one, and
                break-words never hides a character. */}
            <span className="break-words" title={item.label || undefined}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── ButtonGroup ──────────────────────────────────────────────────────────── */

/* A segmented, single-select control (always joined). The selected segment fill
   reads `accent` (value > the solid/outline variant enum) via the conditional
   override class; `borderColor` recolors the dividers. */
const bgItem = cva(
  // shared focus-visible ring recipe (Button parity) so keyboard focus on a
  // segment is visible. resting hover is added conditionally in the render cn()
  // (accent-tint vs token hover, mutually-exclusive) — NOT baked here, to avoid the
  // co-located tw-merge trap.
  // min-w-0: a segment carrying one long label is wider than a narrow host panel on
  // its own, and wrapping the STRIP cannot help a single item — clearing the
  // automatic-minimum floor lets the segment shrink so its label span wraps inside
  // it (break-words on the span — never truncate: a clipped segment label is a
  // choice the reader cannot read).
  // The 1px seam overlap is NOT baked here: it is axis-dependent (a column joins on
  // the block axis, a row on the inline axis) and it must pair with the matching
  // gutter on the wrapper that absorbs it, so it rides on the wrapper — see there.
  'inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.5 border bg-card text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)] [border-color:var(--fr-bgroup-border,var(--color-border))]',
  {
    variants: {
      size: { sm: 'px-3 py-1 text-sm', md: 'px-3.5 py-1.5', lg: 'px-4 py-2 text-lg' },
      // The pressed border COLOUR flows through the same `--fr-bgroup-border` var the
      // base reader (above) consumes — a var-SETTER, never a `border-{tone}` utility.
      // (Audit BUG: a pressed `border-{tone}` utility does NOT tw-merge-dedupe the
      // base `[border-color:var(--fr-bgroup-border,…)]` reader and, being aria-pressed-
      // scoped, wins by specificity → borderColor was inert on a pressed toned
      // segment. And var-setters DO dedupe by property name, so `tone` still overrides
      // `variant.solid` by cva order — byte-identical pressed colour when unset.) A
      // model `borderColor` sets `--fr-bgroup-border` inline → beats every class-set
      // var → wins. `outline` keeps its distinct pressed ACCENT channel (--fr-bgroup-
      // accent), a separate documented behaviour, untouched.
      variant: {
        // the pressed segment now takes Button's neutral high-contrast primary
        // (bg-foreground/text-card) instead of the brand fill — identical to tone
        // `neutral` below, which is the point: an un-toned segmented control should
        // read as "selected", not as a second brand accent competing with the page.
        solid: 'aria-pressed:[--fr-bgroup-border:var(--fr-btn-fill,var(--color-foreground))] aria-pressed:bg-[color:var(--fr-btn-fill,var(--color-foreground))] aria-pressed:text-[color:var(--fr-btn-ink,var(--color-card))]',
        // INHERITED FOREGROUND on the RESTING outline segment: `bg-transparent`
        // dedupes the base `bg-card`, so an unpressed outline segment shows the
        // ancestor's surface while the base `text-foreground` reset its label to
        // the global token — the 1.00-1.02 class again. currentColor on `color`
        // computes to the inherited value (byte-identical at the top level). The
        // PRESSED look is untouched: `aria-pressed:` is a modifier group, and its
        // rule outranks a plain class by specificity. `solid` keeps the token —
        // it inherits the base's own bg-card fill.
        outline: 'bg-transparent text-[color:currentColor] aria-pressed:[color:var(--fr-bgroup-accent,var(--fr-accent))] aria-pressed:[border-color:var(--fr-bgroup-accent,var(--fr-accent))]',
      },
      tone: {
        neutral: 'aria-pressed:[--fr-bgroup-border:var(--fr-btn-fill,var(--color-foreground))] aria-pressed:bg-[color:var(--fr-btn-fill,var(--color-foreground))] aria-pressed:text-[color:var(--fr-btn-ink,var(--color-card))]',
        // Tinted like `critical` below — a pressed segment marks a selection, it is
        // not an alarm (an earlier pass tinted critical alone, which left one
        // recipe speaking two languages).
        success: 'aria-pressed:[--fr-bgroup-border:var(--color-success)] aria-pressed:bg-success/10 aria-pressed:text-success',
        warning: 'aria-pressed:[--fr-bgroup-border:var(--color-warning)] aria-pressed:bg-warning/10 aria-pressed:text-warning',
        // Destructive is quieter still: the pressed segment
        // carries the selection with a red border + red label and NO fill. The
        // `aria-pressed:bg-transparent` is load-bearing — this tone compounds with the
        // default `solid` variant, whose `aria-pressed:bg-foreground` would otherwise
        // bleed a near-black slab through once the old danger fill was removed; the
        // transparent utility dedupes-and-wins it (tone declared after variant → later
        // in the class string). Border still routes through --fr-bgroup-border.
        critical: 'aria-pressed:[--fr-bgroup-border:var(--color-danger)] aria-pressed:bg-transparent aria-pressed:text-danger',
        info: 'aria-pressed:[--fr-bgroup-border:var(--color-info)] aria-pressed:bg-info/10 aria-pressed:text-info',
      },
    },
    defaultVariants: { size: 'md', variant: 'solid' },
  },
);

export function ButtonGroup({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  // Gates the right-edge fade on real overflow (see use-scroll-edges).
  const railRef = useScrollEdges<HTMLDivElement>();
  const p = (element.props ?? {}) as {
    disabled?: boolean | null;
    buttons: Array<{ label: string; value: string }>;
    selected?: string | null;
    size?: SizeKey | null;
    radius?: RadiusKey | null;
    orientation?: 'horizontal' | 'vertical' | null;
    variant?: 'solid' | 'outline' | null;
    tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null;
    fullWidth?: boolean | null;
    borderColor?: string | null;
    trackColor?: string | null;
    icons?: string[] | null;
    accent?: string | null;
    accentText?: string | null;
    radiusValue?: string | number | null;
    align?: 'start' | 'center' | 'end' | null;
  };
  const [selected, setSelected, frozen] = useBoundProp<string>(p.selected ?? undefined, bindings?.selected);
  /* LATCH — ANY declared action latches its control, on any
     verb. Once it goes back to the agent the agent owns what happens next, so the
     control must not fire it twice. useCommitLatch watches every verb this element
     declares. */
  const latched = useCommitLatch(element);
  const isDisabled = (p.disabled ?? false) || frozen || latched;
  const emitWith = useIntrinsicEmit(emit, element);
  const vertical = p.orientation === 'vertical';
  const fullWidth = p.fullWidth === true;
  const size = (p.size as SizeKey | null) ?? undefined;
  const variant = (p.variant as 'solid' | 'outline' | null) ?? undefined;
  const radius = (p.radius as RadiusKey | null) ?? 'md';
  const toneArg = p.accent == null ? (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined : undefined;
  const icons = Array.isArray(p.icons) ? p.icons : [];
  // Outer rounding on the end items only. radiusValue feeds ONLY the OUTER end-cap
  // corners; the joined inner edges stay square. The shared RADIUS map is NOT
  // mutated — a SCOPED per-enum default var (--fr-bgroup-radius-default, byte-identical
  // to the RADIUS shorthand: 0 / 0.25rem / radius-frayme / 1rem / 9999px) is set on the
  // group below, and the end-cap corners read --fr-bgroup-radius (exact) over that
  // default. Per-corner LONGHAND props (not the rounded-* shorthand) round only the
  // outer corners; the inner corners get nothing (square), byte-identical to the prior
  // `RADIUS[radius] + rounded-r-none` end caps. The corner classes MUST be LITERAL
  // strings so Tailwind's static scanner compiles them (a runtime-interpolated
  // arbitrary class would never be generated).
  const BGROUP_RADIUS_DEFAULT: Record<RadiusKey, string> = {
    none: '0px',
    sm: '0.25rem',
    md: 'var(--radius-frayme)',
    lg: '1rem',
    full: '9999px',
  };
  const endRadiusStart = vertical
    ? '[border-top-left-radius:var(--fr-bgroup-radius,var(--fr-bgroup-radius-default,var(--radius-frayme)))] [border-top-right-radius:var(--fr-bgroup-radius,var(--fr-bgroup-radius-default,var(--radius-frayme)))]'
    : '[border-top-left-radius:var(--fr-bgroup-radius,var(--fr-bgroup-radius-default,var(--radius-frayme)))] [border-bottom-left-radius:var(--fr-bgroup-radius,var(--fr-bgroup-radius-default,var(--radius-frayme)))]';
  const endRadiusEnd = vertical
    ? '[border-bottom-left-radius:var(--fr-bgroup-radius,var(--fr-bgroup-radius-default,var(--radius-frayme)))] [border-bottom-right-radius:var(--fr-bgroup-radius,var(--fr-bgroup-radius-default,var(--radius-frayme)))]'
    : '[border-top-right-radius:var(--fr-bgroup-radius,var(--fr-bgroup-radius-default,var(--radius-frayme)))] [border-bottom-right-radius:var(--fr-bgroup-radius,var(--fr-bgroup-radius-default,var(--radius-frayme)))]';
  return (
    <div
      ref={railRef}
      className={cn(
        // The group draws into host panels of unknown width, so a horizontal row of
        // segments must be able to give way. min-w-0 drops the wrapper's own
        // automatic-minimum floor (it is a flex item in most cards, where that floor
        // is the whole strip's intrinsic width) and flex-wrap carries the segments
        // that no longer fit onto a second line. Wrapping rather than scrolling:
        // every control in a group has to stay reachable without a gesture.
        // A vertical group already flows down the block axis and keeps nowrap —
        // wrapping a column would spill sideways instead.
        // The 1px seam overlap rides on EVERY segment and the wrapper carries a
        // matching 1px gutter that absorbs it, so no segment's border box hangs
        // outside the wrapper. This is what makes the seam survive a WRAP: a DOM-keyed
        // overlap (`:not(:first-child)`) is only correct while there is one row — the
        // segment that starts row 2 is not `:first-child`, so it would pull 1px outside
        // the box. Overlap-on-all + gutter is correct per VISUAL row, which is the only
        // row CSS can see. On a wrapping row the cross-axis pair (`pt-px` + `-mt-px`)
        // does the same for the seam BETWEEN rows, so rows join with the same 1px line
        // as the segments inside a row instead of a doubled 2px border. A column joins
        // on the block axis only and takes no inline-axis overlap — an inline one has
        // no seam to close there and only pushes the segments outside the wrapper.
        // Unwrapped geometry is identical to a DOM-keyed overlap: the gutter (+1px) and
        // the first segment's own overlap (-1px) cancel, on both axes and under every
        // justify/flex-1 mode.
        'inline-flex min-w-0',
        // Same rule as ToggleGroup: a joined horizontal strip scrolls rather
        // than wraps, so its end caps stay the block's outer corners. And the
        // same `max-w-full` cap, for the same measured reason — an inline-flex
        // strip is shrink-to-fit, which floors at its CONTENT: three segments
        // (Overview/Transactions/Settings) in a 166px block host laid out 268px
        // wide, 102px of it outside the host, with scrollWidth === clientWidth
        // === 268. Capped, the same strip is a 166px port over a 268px track.
        vertical
          ? 'flex-col pt-px [&>*]:-mt-px'
          : 'fr-tabscroll-card max-w-full flex-row flex-nowrap overflow-x-auto pl-px pt-px [&>*]:-ml-px [&>*]:-mt-px',
        fullWidth && cn('flex w-full', p.align ? ALIGN_JUSTIFY[p.align] : ''),
      )}
      role="group"
      style={{
        // per-enum end-cap radius default (byte-identical to the prior RADIUS shorthand),
        // scoped to this group — does NOT mutate the shared RADIUS map. Cascades to the
        // end-cap corner longhand props on the segments below.
        '--fr-bgroup-radius-default': BGROUP_RADIUS_DEFAULT[radius],
        ...styleVars(
          { var: '--fr-bgroup-accent', value: p.accent, kind: 'color' },
          { var: '--fr-bgroup-border', value: p.borderColor, kind: 'color' },
          { var: '--fr-bgroup-track', value: p.trackColor, kind: 'color' },
          // exact end-cap corner radius → --fr-bgroup-radius wins over the per-enum default.
          { var: '--fr-bgroup-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        ),
      } as CSSProperties}
    >
      {(p.buttons ?? []).map((b, i) => {
        const isOn = selected === b.value;
        const first = i === 0;
        const last = i === (p.buttons ?? []).length - 1;
        const iconName = icons[i];
        // borderColor must ride EACH BUTTON, not just the group wrapper: the pressed
        // segment's own `aria-pressed:[--fr-bgroup-border:var(--color-{tone})]` class sets
        // the var ON the button, which BEATS a value merely INHERITED from the group's
        // inline var → the tone would win the pressed border and borderColor stayed inert.
        // Setting borderColor inline on the button (same element as the tone
        // class) makes the value channel win on the pressed segment too. Unset → styleVars
        // omits it → the tone class-set var applies (byte-identical).
        const btnVars: CSSProperties = {
          ...styleVars({ var: '--fr-bgroup-border', value: p.borderColor, kind: 'color' }),
          ...(isOn && p.accentText != null ? styleVars({ var: '--fr-bgroup-accent-text', value: p.accentText, kind: 'color' }) : {}),
        };
        return (
          <button
            key={b.value}
            type="button"
            /* A10 + lifecycle rules 3/4: an author could not ask for a disabled
               segment, and `frozen` (the param freeze from useLocalOrBound) already
               rejects the write — without this the control looked live while
               silently ignoring presses. */
            disabled={isDisabled}
            className={cn(
              bgItem({ size, variant, tone: toneArg }),
              // resting hover on the UNSELECTED segments only: accent-derived 12%
              // tint when accent is set, else the token hover, now read through --fr-surface-sunken. Mutually-exclusive
              // (never co-located → no tw-merge trap). The selected segment reads the
              // higher-specificity aria-pressed: variant, so it is untouched.
              !isOn && (p.accent != null
                ? 'hover:[background:color-mix(in_srgb,var(--fr-bgroup-accent)_12%,transparent)]'
                : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]'),
              first ? endRadiusStart : last ? endRadiusEnd : 'rounded-none',
              // The horizontal strip is a SCROLLER, so its segments have to keep
              // their intrinsic width — otherwise the track never exceeds the port
              // and the scroll is decoration. Measured in headless Chromium, the
              // three segments above in a 166px flex host: 86·106·78px of content
              // squeezed to 54·63·51px (the bgItem base carries `min-w-0`, which
              // hands the flex line permission to take them below their content),
              // each label span left WIDER than the button containing it (56/76/48
              // inside 54/63/51) and scrollWidth === clientWidth === 166. With
              // shrink-0 the segments hold 86·106·78 and the track reports 268.
              // MUTUALLY EXCLUSIVE with `flex-1` rather than co-located: `flex-1`
              // is `flex: 1 1 0%`, so the two disagree about flex-shrink, and
              // tw-merge keeps both (separate property groups) leaving stylesheet
              // order to pick a winner. fullWidth is an explicit one-row contract,
              // so there the segments share the row and their labels wrap.
              // A vertical group joins on the block axis and never scrolls in x.
              !vertical && !(fullWidth && p.align == null) && 'shrink-0',
              fullWidth && p.align == null && 'flex-1',
              // RESTING-state override: recolor the UNSELECTED segment base fill. The
              // selected fill reads the higher-specificity aria-pressed: variant, so this
              // never touches the selected segment. Added LAST so it dedupes-and-wins over
              // the resting bg-card (and the outline variant's bg-transparent).
              p.trackColor != null && '[background:var(--fr-bgroup-track,var(--color-card))]',
              // value > variant enum: when an accent is named, the solid selected fill
              // is recolored by the var (only on the pressed segment).
              variant !== 'outline' && p.accent != null && 'aria-pressed:[background:var(--fr-bgroup-accent)] aria-pressed:[border-color:var(--fr-bgroup-accent)]',
              // on-fill text on the selected segment: TEXT-COLOR group form so it
              // dedupes-and-wins over `aria-pressed:text-*-foreground` (bare would be inert).
              isOn && p.accentText != null && 'text-[color:var(--fr-bgroup-accent-text,var(--color-primary-foreground))]',
            )}
            aria-pressed={isOn}
            data-selected={isOn}
            style={Object.keys(btnVars).length ? btnVars : undefined}
            onClick={() => {
              setSelected(b.value);
              emitWith('change', { value: b.value, label: b.label ?? null, index: i });
            }}
          >
            {iconName != null && <span className="shrink-0"><Icon name={iconName} size={15} /></span>}
            {/* break-words, not truncate: same contract as ToggleGroup's segments.
                The joined strip is a real rail now (shrink-0 segments over a capped
                track), but a fullWidth strip is still `flex-1` and divides one row,
                and there a truncate would delete the label rather than defer it to
                a scroll. One rule for both states, and break-words hides nothing. */}
            <span className="break-words" title={b.label || undefined}>{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Pagination ───────────────────────────────────────────────────────────── */

const pageBtn = cva(
  // shared focus-visible ring recipe (Button parity) so keyboard focus on a page
  // cell is visible — consistent across the action family.
  'inline-flex h-8 min-w-8 cursor-pointer items-center justify-center border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_50%,transparent)] disabled:cursor-not-allowed disabled:opacity-40 [border-color:var(--color-border)]',
  {
    variants: {
      size: { sm: 'h-7 min-w-7 text-sm', md: 'h-8 min-w-8', lg: 'h-10 min-w-10 text-lg' },
      shape: { square: 'rounded-none', rounded: 'rounded-[calc(var(--radius-frayme)/1.5)]', circle: 'rounded-full' },
      // INHERITED FOREGROUND: `outline` (the DEFAULT variant) and `ghost` paint
      // no fill, so the base `text-foreground` reset every numeral to the global
      // token on top of whatever an ancestor authored — a props-less Pagination
      // inside `Card {bg:"#12161f", color:"#e2e6f0"}` rendered rgb(24,24,27) on
      // dark navy. currentColor on `color` computes to the inherited value, so it
      // is byte-identical at the top level (.frayme-root's colour IS
      // --color-foreground) and follows the authored card. `solid` KEEPS the
      // token: it paints its own bg-card, and its numerals belong to that fill.
      // The text-COLOR group form, so the `selected` variant (declared after) and
      // the resting `color` reader added in cn() still dedupe-and-win over it.
      variant: {
        solid: 'bg-card',
        outline: 'bg-transparent text-[color:currentColor]',
        ghost: 'border-transparent bg-transparent text-[color:currentColor]',
      },
      selected: {
        // Accent fill/border via var chains with primary-token fallbacks — the
        // SOLE bg/border-color sources (no co-located bg-primary/border-primary:
        // tw-merge cannot dedupe token vs arbitrary-property, and border-primary
        // would win the cascade, leaving the accent border inert). On-fill text
        // uses the TEXT-COLOR group form (added LAST) so it dedupes-and-wins
        // over `text-primary-foreground`.
        true: 'text-card [background:var(--fr-page-accent,var(--fr-accent))] [border-color:var(--fr-page-accent,var(--fr-accent))] text-[color:var(--fr-page-accent-text,var(--fr-accent-ink,var(--color-card)))]',
        false: '',
      },
    },
    defaultVariants: { size: 'md', shape: 'rounded', variant: 'outline', selected: false },
  },
);

export function Pagination({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    totalPages?: number | null;
    page?: number | null;
    size?: SizeKey | null;
    shape?: 'square' | 'rounded' | 'circle' | null;
    variant?: 'solid' | 'outline' | 'ghost' | null;
    showEdges?: boolean | null;
    showPrevNext?: boolean | null;
    siblingCount?: string | number | null;
    accent?: string | null;
    accentText?: string | null;
    color?: string | null;
    borderColor?: string | null;
    mutedColor?: string | null;
    align?: 'start' | 'center' | 'end' | null;
    // CONTENT/LABEL overrides (i18n): the frozen English aria-labels on the
    // prev/next/first/last affordances. Each defaults to its current literal; they feed
    // aria-label (escaped text), not visible copy.
    prevLabel?: string | null;
    nextLabel?: string | null;
    firstLabel?: string | null;
    lastLabel?: string | null;
    // CONTENT/glyph overrides (i18n): the prev/next/first/last glyph NAMES,
    // resolved through the closed icon registry. Default = the current literal char
    // (‹ › « »); a known name swaps in <Icon/>, an unknown name keeps the char.
    prevIcon?: string | null;
    nextIcon?: string | null;
    firstIcon?: string | null;
    lastIcon?: string | null;
  };
  const totalPages = p.totalPages ?? 1;
  const [page, setPage] = useBoundProp<number>(p.page ?? undefined, bindings?.page);
  const emitWith = useIntrinsicEmit(emit, element);
  const current = page ?? 1;
  const showEdges = p.showEdges ?? true;
  const showPrevNext = p.showPrevNext ?? true;
  // siblingCount: how many numbers flank the current page (1-7, default 3). The
  // visible window is (2*sibling + 1), capped to totalPages.
  const sibRaw = p.siblingCount != null ? Number(p.siblingCount) : 3;
  const sibling = Number.isFinite(sibRaw) ? Math.min(Math.max(Math.round(sibRaw), 1), 7) : 3;
  const windowSize = Math.min(totalPages, sibling * 2 + 1);
  let start = Math.max(1, current - sibling);
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const go = (next: number): void => {
    const clamped = Math.min(Math.max(next, 1), totalPages);
    setPage(clamped);
    // Canonical pagination verb is `page` (matches DataTable/data-longtail pagers
    // + the EVENT_CONTRACT); payload already carries the 1-based target page.
    emitWith('page', { page: clamped });
  };
  const size = (p.size as SizeKey | null) ?? undefined;
  const shape = (p.shape as 'square' | 'rounded' | 'circle' | null) ?? undefined;
  const variant = (p.variant as 'solid' | 'outline' | 'ghost' | null) ?? undefined;
  const align = p.align === 'center' ? 'justify-center' : p.align === 'end' ? 'justify-end' : 'justify-start';
  // Glyph NAME resolves only through the closed registry; unknown/absent → the
  // current default unicode char (byte-identical props-less). Never raw markup.
  const glyphFor = (name: string | null | undefined, fallbackChar: string): ReactNode =>
    name != null && hasIcon(name) ? <Icon name={name} size={15} /> : fallbackChar;
  const cell = (key: string, label: ReactNode, opts: { onClick?: () => void; disabled?: boolean; selected?: boolean; ariaLabel?: string; ariaCurrent?: boolean }) => (
    <button
      key={key}
      type="button"
      className={cn(
        pageBtn({ size, shape, variant, selected: (opts.selected ?? false) as true | false }),
        // RESTING-state overrides on the UNSELECTED page buttons only (the selected
        // page reads accent/accentText via the cva `selected` variant). Added LAST so
        // they dedupe-and-win over the base `text-foreground` / `[border-color:…border]`.
        !opts.selected && p.color != null && 'text-[color:var(--fr-page-resting,var(--color-foreground))]',
        !opts.selected && p.borderColor != null && '[border-color:var(--fr-page-border,var(--color-border))]',
        // NEW accent-derived hover on UNSELECTED cells only — GATED on accent so unset
        // means NO hover (byte-identical to the earlier default, where resting cells had none). An
        // accent adds a faint 10% tint over transparent (below the selected fill).
        // Selected/disabled cells are untouched.
        !opts.selected && p.accent != null && 'hover:[background:color-mix(in_srgb,var(--fr-page-accent)_10%,transparent)]',
      )}
      disabled={opts.disabled}
      data-selected={opts.selected || undefined}
      aria-current={opts.ariaCurrent ? 'page' : undefined}
      aria-label={opts.ariaLabel}
      onClick={opts.onClick}
    >
      {label}
    </button>
  );
  return (
    <nav
      className={cn('inline-flex items-center gap-1', align)}
      aria-label="Pagination"
      style={styleVars(
        { var: '--fr-page-accent', value: p.accent, kind: 'color' },
        accentTextVar('--fr-page-accent-text', p.accent, p.accentText),
        { var: '--fr-page-resting', value: p.color, kind: 'color' },
        { var: '--fr-page-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-page-muted', value: p.mutedColor, kind: 'color' },
      )}
    >
      {showEdges && cell('first', glyphFor(p.firstIcon, '«'), { onClick: () => go(1), disabled: current <= 1, ariaLabel: p.firstLabel ?? 'First page' })}
      {showPrevNext && cell('prev', glyphFor(p.prevIcon, '‹'), { onClick: () => go(current - 1), disabled: current <= 1, ariaLabel: p.prevLabel ?? 'Previous page' })}
      {start > 1 && <span className="px-1 [color:var(--fr-page-muted,var(--color-muted-foreground))]">…</span>}
      {pages.map((n) =>
        cell(String(n), n, { onClick: () => go(n), selected: n === current, ariaCurrent: n === current }),
      )}
      {end < totalPages && <span className="px-1 [color:var(--fr-page-muted,var(--color-muted-foreground))]">…</span>}
      {showPrevNext && cell('next', glyphFor(p.nextIcon, '›'), { onClick: () => go(current + 1), disabled: current >= totalPages, ariaLabel: p.nextLabel ?? 'Next page' })}
      {showEdges && cell('last', glyphFor(p.lastIcon, '»'), { onClick: () => go(totalPages), disabled: current >= totalPages, ariaLabel: p.lastLabel ?? 'Last page' })}
    </nav>
  );
}
