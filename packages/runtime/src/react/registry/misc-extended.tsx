'use client';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { cva } from 'class-variance-authority';
import { useStateValue, type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit, useCommitLatch } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars, fontClass, weightClass, trackingClass, leadingClass, shadowClass, motionClass } from './_style.js';
import { Icon, hasIcon } from './icons.js';

/* Catalog group: IconButton, Toast, CodeBlock (misc-extended)
 *
 * Same truly-dynamic contract as Phases 1-4:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (color the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities. The class set stays a
 *     closed, build-time set (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing value so
 *     the token fallback wins (props-less → polished).
 *
 * value > enum precedence (IconButton/Toast accent over variant/tone) uses the
 * same CONDITIONAL-override-class technique as data-display.tsx / actions.tsx —
 * the `[background:var(--fr-…)]` utility is only added to cn() when the model
 * supplied that value (`p.accent != null`), so the enum class wins when absent
 * and the var wins when present.
 *
 * Icons are NAMES resolved against the closed `icons.ts` registry (never raw
 * SVG; unknown name → nothing). CodeBlock renders its `code` as ESCAPED React
 * text — split into lines and mapped to elements, never innerHTML.
 */

/* ── shared enum map (radius — mirrors actions.tsx) ───────────────────────── */
const RADIUS = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-frayme',
  lg: 'rounded-2xl',
  full: 'rounded-full',
} as const;
type RadiusKey = keyof typeof RADIUS;
type SizeKey = 'sm' | 'md' | 'lg';

/* ── IconButton ───────────────────────────────────────────────────────────── */

/* IconButton owns a SCOPED radius var-chain (it does NOT mutate the shared RADIUS
   map): each enum step sets a DEFAULT var, and the base reads
   var(--fr-iconbtn-radius, <default>) so the exact `radiusValue` channel (set on
   --fr-iconbtn-radius by styleVars) WINS, while a props-less spec keeps the prior
   rounded-* values byte-for-byte. Step values re-derive the old shared-map
   classes: none rounded-none=0 · sm rounded-sm=0.25rem · md rounded-frayme=
   var(--radius-frayme) · lg rounded-2xl=1rem · full rounded-full=9999px (circular). */
const ICONBTN_RADIUS = {
  none: '[--fr-iconbtn-radius-default:0px]',
  sm: '[--fr-iconbtn-radius-default:0.25rem]',
  md: '[--fr-iconbtn-radius-default:var(--radius-frayme)]',
  lg: '[--fr-iconbtn-radius-default:1rem]',
  full: '[--fr-iconbtn-radius-default:9999px]',
} as const;

/* variant = visual hierarchy, tone = semantic intent. `accent` routes through an
   inline var read by the conditional override class, so the model-named value
   beats the variant/tone fill. Square footprint: width follows the height enum. */
const iconButton = cva(
  // Resting shadow dropped for Button parity — Button carries no shadow, and a
  // toolbar of shadowed icon buttons read as a row of floating chips. The
  // `shadow-none` on the flat variants below is now redundant but kept, exactly as
  // Button keeps its own (a props-less spec must stay byte-identical either way).
  'inline-flex cursor-pointer items-center justify-center border border-transparent transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [border-radius:var(--fr-iconbtn-radius,var(--fr-iconbtn-radius-default,var(--radius-frayme)))]',
  {
    variants: {
      variant: {
        // Button parity: NEUTRAL high-contrast primary, not a
        // saturated brand slab. An IconButton lives in toolbars and table rows where
        // the brand fill repeated per row was the loudest thing on the screen.
        primary: 'bg-foreground text-card',
        secondary: 'border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-foreground shadow-none',
        ghost: 'border-transparent bg-transparent text-foreground shadow-none hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
        outline: 'border-[var(--fr-iconbtn-border,var(--color-border))] bg-transparent text-foreground shadow-none',
        // "still red but not in the eyes" — the quieter destructive of Button's
        // `danger`: NO resting fill, a hairline red border (30% mix), a red glyph
        // (currentColor), the red wash only on hover. A table-row Delete icon repeated
        // per row no longer reads as a column of pink chips. border-transparent from the
        // base is deduped by the border-[color:…] group form added here.
        danger: 'border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[color:var(--color-danger)] hover:[background:color-mix(in_srgb,var(--color-danger)_10%,transparent)]',
      },
      tone: {
        neutral: 'border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-foreground shadow-none',
        // Non-destructive semantic tones are tinted, not saturated slabs — a
        // toolbar of tone-coloured icon buttons was four competing alarms.
        // `critical` is the destructive tone, so it takes the quieter no-fill +
        // hairline-red-border + hover-only-wash treatment, identical to `variant:danger`.
        success: '[background:color-mix(in_srgb,var(--color-success)_12%,transparent)] border-[color:var(--color-success)] text-[color:var(--color-success)]',
        warning: '[background:color-mix(in_srgb,var(--color-warning)_12%,transparent)] border-[color:var(--color-warning)] text-[color:var(--color-warning)]',
        critical: 'border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[color:var(--color-danger)] hover:[background:color-mix(in_srgb,var(--color-danger)_10%,transparent)]',
        info: '[background:color-mix(in_srgb,var(--color-info)_12%,transparent)] border-[color:var(--color-info)] text-[color:var(--color-info)]',
      },
      size: {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
      },
      radius: ICONBTN_RADIUS,
    },
    defaultVariants: { variant: 'primary', size: 'md', radius: 'md' },
  },
);

/** Icon pixel size paired with each button size enum. */
const ICONBTN_GLYPH: Record<SizeKey, number> = { sm: 15, md: 18, lg: 22 };

export function IconButton({ element, emit }: ComponentRenderProps): ReactNode {
  const latched = useCommitLatch(element);
  const emitWith = useIntrinsicEmit(emit, element);
  const p = (element.props ?? {}) as {
    icon: string;
    label: string;
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | null;
    tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null;
    size?: SizeKey | null;
    radius?: RadiusKey | null;
    radiusValue?: string | number | null;
    disabled?: boolean | null;
    loading?: boolean | null;
    accent?: string | null;
    accentText?: string | null;
    borderColor?: string | null;
  };
  const size = (p.size as SizeKey | null) ?? 'md';
  const loading = p.loading === true;
  // tone provides a token fill; an explicit accent value wins (so don't apply the
  // tone class when accent is named — keeps the value > tone precedence clean).
  const toneArg = p.accent == null ? (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined : undefined;
  return (
    <button
      type="button"
      className={cn(
        iconButton({
          variant: (p.variant as 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | null) ?? undefined,
          tone: toneArg,
          size,
          radius: (p.radius as RadiusKey | null) ?? undefined,
        }),
        // value > variant/tone: a model-named accent recolors the fill. Added LAST
        // so tailwind-merge keeps the var over the variant/tone bg-*. The border
        // half uses the GROUP form (border-[color:…]) so it shares the tw-merge
        // border-color group with border-border / border-[var(…)] and, added
        // LAST, dedupe-wins them (a bare [border-color:…] arbitrary property
        // would not dedupe and loses the cascade to the token class).
        p.accent != null && '[background:var(--fr-iconbtn-accent)] border-[color:var(--fr-iconbtn-accent)]',
        // on-fill glyph colour MUST be the text-color group form so it dedupes
        // against (and wins over) the variant's `text-*` utility — a bare
        // a bare arbitrary colour class arbitrary property does NOT dedupe vs text-* and is inert.
        p.accentText != null && 'text-[color:var(--fr-iconbtn-accent-text)]',
      )}
      // icon-only: the label is the accessible name, never visible text.
      aria-label={p.label}
      disabled={(p.disabled ?? false) || loading || latched}
      aria-busy={loading || undefined}
      style={styleVars(
        { var: '--fr-iconbtn-accent', value: p.accent, kind: 'color' },
        { var: '--fr-iconbtn-accent-text', value: p.accentText, kind: 'color' },
        // feeds the previously-dead --fr-iconbtn-border the `outline` variant
        // reads; CONDITIONAL token fallback stays inside the var (outline keeps
        // the border token when unset). The `accent` border override (added LAST
        // in cn) still wins for the filled case.
        { var: '--fr-iconbtn-border', value: p.borderColor, kind: 'color' },
        // exact radius channel: the base reads var(--fr-iconbtn-radius, <enum
        // default>), so a named value WINS over the radius enum; unset → omitted →
        // the enum's default var stays (byte-identical).
        { var: '--fr-iconbtn-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
      onClick={() => {
        if (loading) return;
        emitWith('commit', { label: p.label });
      }}
    >
      {loading ? (
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        <Icon name={p.icon} size={ICONBTN_GLYPH[size]} />
      )}
    </button>
  );
}

/* ── Toast ────────────────────────────────────────────────────────────────── */

/* Render-on-condition: the toast shows ONLY while the boolean `openPath` state is
   truthy (mirrors Dialog/Drawer via useOpenPath). position is a CLOSED enum → a
   trusted position:fixed corner recipe (not spec-borne arbitrary CSS). tone sets
   the accent + auto icon; `bg`/`accent` value channels override via the
   conditional-override-class technique. */
const toast = cva(
  'pointer-events-auto fixed z-50 flex max-w-sm items-start gap-3 border p-4 shadow-lg [background:var(--fr-toast-bg,var(--color-card))] [border-color:var(--fr-toast-border,var(--color-border))]',
  {
    variants: {
      position: {
        'top-right': 'right-4 top-4',
        'top-left': 'left-4 top-4',
        'bottom-right': 'bottom-4 right-4',
        'bottom-left': 'bottom-4 left-4',
        'top-center': 'left-1/2 top-4 -translate-x-1/2',
        'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
      },
      variant: {
        solid: 'text-card [&_*]:text-card',
        subtle: '',
        outline: 'bg-transparent',
      },
      tone: {
        neutral: '',
        success: '[--fr-toast-accent:var(--color-success)]',
        warning: '[--fr-toast-accent:var(--color-warning)]',
        critical: '[--fr-toast-accent:var(--color-danger)]',
        info: '[--fr-toast-accent:var(--color-info)]',
      },
    },
    // solid flips the tinted surface to a high-contrast tone fill.
    compoundVariants: [
      { variant: 'solid', tone: 'neutral', class: 'border-foreground bg-foreground' },
      { variant: 'solid', tone: 'success', class: 'border-success bg-success' },
      { variant: 'solid', tone: 'warning', class: 'border-warning bg-warning' },
      { variant: 'solid', tone: 'critical', class: 'border-danger bg-danger' },
      { variant: 'solid', tone: 'info', class: 'border-info bg-info' },
    ],
    defaultVariants: { position: 'bottom-right', variant: 'subtle', tone: 'neutral' },
  },
);

/* Auto status icon by tone — registry glyph NAMES, never raw SVG. */
const TOAST_ICON: Record<string, string> = {
  neutral: 'info',
  success: 'check-circle',
  warning: 'alert-triangle',
  critical: 'alert-circle',
  info: 'info',
};

/* auto-dismiss durations — a CLOSED map (the Motion-enum principle: the model
   picks a SPEED, never a free ms value). `sticky` (default) = no auto-dismiss, exactly
   the original behavior. On timeout the toast sets openPath false + emits dismiss {auto:true}. */
const TOAST_DURATION: Record<string, number | null> = {
  short: 3000,
  normal: 5000,
  long: 8000,
  sticky: null,
};

/** Read + write a boolean state-path (same shape as overlay-surfaces.tsx). */
function useOpenPath(openPath: string): [boolean, (next: boolean) => void] {
  const open = useStateValue(openPath) as boolean | undefined;
  const [, setOpen] = useBoundProp<boolean>(undefined, openPath);
  return [open ?? false, setOpen];
}

export function Toast({ element, emit }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title: string;
    message?: string | null;
    openPath: string;
    tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center' | null;
    variant?: 'solid' | 'subtle' | 'outline' | null;
    duration?: 'short' | 'normal' | 'long' | 'sticky' | null;
    dismissible?: boolean | null;
    dismissLabel?: string | null;
    dismissIcon?: string | null;
    icon?: 'auto' | 'none' | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
    shadow?: string | null;
    motion?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    accent?: string | null;
  };
  const [open, setOpen] = useOpenPath(p.openPath);
  // hook must run unconditionally — keep it above the render-on-condition return.
  const emitWith = useIntrinsicEmit(emit, element);
  // auto-dismiss: when a bounded `duration` is set and the toast is open, close it
  // after the mapped delay (setOpen false + emit dismiss {auto:true}). `sticky` (default,
  // ms == null) never schedules a timer → byte-identical to the original. The timer is cleared
  // on unmount, on manual dismiss (open flips), and when duration changes.
  const durationMs = TOAST_DURATION[(p.duration as 'short' | 'normal' | 'long' | 'sticky' | null) ?? 'sticky'];
  useEffect(() => {
    if (!open || durationMs == null) return;
    const id = window.setTimeout(() => {
      setOpen(false);
      emitWith('dismiss', { label: p.title ?? null, auto: true });
    }, durationMs);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, durationMs]);
  if (!open) return null;
  const tone = (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? 'neutral';
  const variant = (p.variant as 'solid' | 'subtle' | 'outline' | null) ?? 'subtle';
  const dismissible = p.dismissible ?? true;
  // Frozen label defaults to the exact current English; glyph resolves ONLY through
  // the closed registry (unknown/absent → the default "x").
  const dismissLabel = typeof p.dismissLabel === 'string' ? p.dismissLabel : 'Dismiss';
  const dismissIcon = typeof p.dismissIcon === 'string' && hasIcon(p.dismissIcon) ? p.dismissIcon : 'x';
  const iconChoice = (p.icon as 'auto' | 'none' | null) ?? 'auto';
  const iconName = iconChoice === 'none' ? null : TOAST_ICON[tone];
  // On the solid surface the icon inherits the card text; otherwise it takes the
  // accent (value > tone via the override var below).
  const iconAccent = variant === 'solid' ? undefined : 'shrink-0 [color:var(--fr-toast-accent,var(--color-foreground))]';
  return (
    <div
      className={cn(
        toast({
          position: (p.position as 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center' | null) ?? undefined,
          variant,
          tone,
        }),
        'rounded-frayme',
        // typeface for the whole toast region (cascades via font inheritance);
        // unset → undefined → cn drops it → inherits the theme font.
        fontClass(p.font),
        // value > variant/tone for the surface: a model-named bg recolors it via
        // the override class (added LAST so tailwind-merge keeps the var). The
        // `accent` value needs no override class — it lands in --fr-toast-accent
        // as an INLINE style below, which always beats the tone class's var def.
        p.bg != null && '[background:var(--fr-toast-bg,var(--color-card))]',
        // value > variant/tone for the edge: feeds the previously-dead
        // --fr-toast-border var. The conditional class (added LAST) lets it beat
        // the solid compound variants' border-* token (e.g. border-success).
        // Group form so tw-merge dedupes the solid compound variants' border-*
        // utilities — a bare arbitrary property loses to them by stylesheet order.
        p.borderColor != null && 'border-[color:var(--fr-toast-border,var(--color-border))]',
        // accent bar (schema: accent colors "the leading icon + accent bar"): the
        // icon is the only other consumer and it can be absent (icon:'none') or
        // card-colored (solid), so the bar keeps the channel live in every shape.
        // Bare longhand on purpose: [border-left-color:...] sorts AFTER the
        // border-color tokens AND the bare [border-color:...] rules in the
        // compiled sheet (property-name order), so it wins the left edge in every
        // variant — same proven pattern as Alert.accentBar/Callout. (The group
        // form border-l-[color:...] does NOT compile here.) The bar shows for a
        // set `accent` AND for any non-neutral tone (subtle/outline — on solid
        // the surface IS the tone fill, a same-color bar would be invisible), so
        // the taught tone channel reaches the schema's accent-bar affordance.
        // Neutral/props-less → both classes drop → byte-identical default.
        (p.accent != null || (tone !== 'neutral' && variant !== 'solid')) &&
          'border-l-[3px] [border-left-color:var(--fr-toast-accent,var(--color-border))]',
        // elevation channel: shadow-* is its own tw-merge group, so a SET value
        // dedupe-wins the baked shadow-lg here (placed LAST). Unset → undefined →
        // cn drops it → the baked shadow-lg is unchanged (byte-identical).
        shadowClass(p.shadow),
        // motion channel (opt-in): a SET speed adds a motion-safe enter animation
        // on the toast surface as it mounts. animate-* is its own group (no
        // conflict). Unset/none → undefined → cn drops it → appears instantly
        // (byte-identical).
        motionClass(p.motion),
      )}
      role="status"
      aria-live="polite"
      style={styleVars(
        { var: '--fr-toast-bg', value: p.bg, kind: 'color' },
        { var: '--fr-toast-border', value: p.borderColor, kind: 'color' },
        // value > tone: the inline --fr-toast-accent overrides the tone class's
        // own --fr-toast-accent definition (inline wins over a class-set var).
        { var: '--fr-toast-accent', value: p.accent, kind: 'color' },
      )}
    >
      {iconName && (
        <span className={cn(iconAccent)} aria-hidden>
          <Icon name={iconName} size={18} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong
          // fontSize is a single source: the baked 0.9375rem is the var fallback
          // (byte-identical when unset), and an exact fontSize wins via the var.
          className={cn(
            // A toast has no fixed height — it is a shrink-to-content surface in a
            // min-w-0 flex column, so `truncate` (nowrap) let the box collapse under
            // the title and ate the alert's own words. It wraps; the message below
            // already does.
            'break-words [font-size:var(--fr-toast-fs,0.9375rem)] font-semibold leading-snug',
            weightClass(p.weight),
            trackingClass(p.tracking),
            leadingClass(p.leading),
          )}
          style={styleVars({ var: '--fr-toast-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } })}
          title={p.title || undefined}
        >
          {p.title}
        </strong>
        {p.message != null && <span className="text-sm opacity-90">{p.message}</span>}
      </div>
      {dismissible && (
        <button
          type="button"
          // TARGET SIZE (WCAG 2.5.8): the box was the 16px glyph and nothing else —
          // no padding, no floor — so the dismiss target measured 16x16 against the
          // 24x24 minimum, on the one control a toast has. min-h-6/min-w-6, never
          // h-6/w-6: a fixed box would CAP it, and a larger `dismissIcon` has to
          // still be able to grow it. inline-flex + centring so the floor is a box
          // the glyph sits in the middle of rather than dead space beside it.
          // This is the fix Alert's dismiss already carries (data-display.tsx) —
          // same shape, same file family, missed on Toast. The negative margins are
          // left exactly as they were, as they were on Alert: the extra 8px grows
          // into the toast's own p-4 gutter, which is empty.
          className="-mr-1 -mt-0.5 inline-flex min-h-6 min-w-6 shrink-0 cursor-pointer appearance-none items-center justify-center border-0 bg-transparent text-current opacity-70 hover:opacity-100"
          aria-label={dismissLabel}
          onClick={() => {
            setOpen(false);
            emitWith('dismiss', { label: p.title ?? null });
          }}
        >
          <Icon name={dismissIcon} size={16} />
        </button>
      )}
    </div>
  );
}

/* ── CodeBlock ────────────────────────────────────────────────────────────── */

/* Read-only code. The `code` string is rendered as ESCAPED React text — split
   into lines and mapped to elements — so it can NEVER reach the DOM as markup
   (no innerHTML, no dangerouslySetInnerHTML). No syntax highlighting (deferred);
   `language` is a display LABEL only. */
const codeBlockWrap = cva('overflow-hidden rounded-frayme border border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))]', {
  variants: {
    size: { sm: 'text-[0.8125rem]', md: 'text-sm' },
  },
  defaultVariants: { size: 'md' },
});
const codeBlockHeader = 'flex items-center justify-between gap-2 border-b border-border bg-card/60 px-3 py-1.5';
const codeBlockPre = cva('m-0 overflow-x-auto font-mono leading-relaxed text-foreground', {
  variants: {
    size: { sm: 'p-3', md: 'p-4' },
    wrap: { true: 'whitespace-pre-wrap break-words', false: 'whitespace-pre' },
  },
  defaultVariants: { size: 'md', wrap: false },
});

/* `theme` forces a fixed surface independent of the page/workspace theme — a
 * CLOSED enum (no spec colors) that re-points the design tokens the CodeBlock's
 * existing classes already read (bg-muted/bg-card/text-foreground/border/
 * muted-foreground), scoped to the block's subtree. Values mirror frayme.css's
 * light + dark palettes, so a forced block stays on-brand. `auto` = no override
 * (follows ambient dark mode like every other component).
 *
 * SOURCE OF TRUTH: src/styles/frayme.css — the `.frayme-root` light root and the
 * `.frayme-root[data-theme='dark']` block. Every row below is a COPY of one
 * `--frayme-*` value, and a copy goes stale. Two had:
 *   - `--color-muted-foreground` light stayed #71717a after `--frayme-muted-fg`
 *     moved to #52525b. Measured on the surfaces this very
 *     table forces, #71717a reads 4.40:1 on the wrapper's own bg-muted #f4f4f5
 *     (where the line-number gutter sits), 4.67 on the bg-card/60 header strip
 *     #fbfbfb (the language chip, 0.6875rem) and 4.83 on the copy button's
 *     bg-card — i.e. a forced-LIGHT block painted small muted text at the exact
 *     ratio the rest of the system had just rejected, and did it on the only
 *     code path a workspace cannot re-theme its way out of. #52525b reads
 *     7.03 / 7.47 / 7.73 on the same three.
 *   - `--color-border` dark was #2e2e33 and the dark root has been #3f3f46 since
 *     the initial release — never a mirror, which is what made the muted-fg
 *     drift invisible: one wrong row among five right ones reads as a bug, one
 *     among four reads as a table of deliberate local values. Neither hex is
 *     text, so this half is not a contrast fix (1.11:1 → 1.44:1 against the
 *     block's own fill, both far under 1.4.11's 3:1 — a rounded code slab is
 *     identified by its bg-muted fill and mono type, not by its hairline); it is
 *     aligned so the mirror claim above is true for all six rows and the guard
 *     needs no exemption. test/code-theme-mirror.test.tsx re-reads frayme.css
 *     and fails the next time any row drifts.
 *
 * Why literals and not var(): this table exists to DEFEAT the ambient theme, and
 * every `--frayme-*` var flips with it — `var(--frayme-muted-fg)` in the light
 * row resolves to dark's #a1a1aa on a dark-OS page, 2.32:1 against the #ffffff
 * card the same row forces, which is precisely the failure `theme:'light'` is
 * asked to prevent. Rejected — re-declaring `--frayme-muted-fg` here and letting
 * `.frayme-root`'s `--color-muted-foreground: var(--frayme-muted-fg)` carry it:
 * custom properties are substituted at computed-value time on the element that
 * DECLARES them, so `--color-muted-foreground` is already resolved at
 * `.frayme-root` and a descendant redefining its input changes nothing. Rejected
 * — putting `frayme-light`/`frayme-dark` on this wrapper to reuse the
 * stylesheet's own forced-palette blocks (the durable fix, and the one to reach
 * for if this table ever outgrows six rows): all three of their selector forms
 * require a `.frayme-root`, self or descendant, and this wrapper is neither, so
 * it needs a new selector in frayme.css. */
const CODE_THEME: Record<'dark' | 'light', CSSProperties> = {
  dark: {
    '--color-card': '#1c1c20',
    '--color-card-foreground': '#fafafa',
    '--color-foreground': '#fafafa',
    '--color-border': '#3f3f46',
    '--color-muted': '#26262b',
    '--color-muted-foreground': '#a1a1aa',
  } as CSSProperties,
  light: {
    '--color-card': '#ffffff',
    '--color-card-foreground': '#18181b',
    '--color-foreground': '#18181b',
    '--color-border': '#e4e4e7',
    '--color-muted': '#f4f4f5',
    '--color-muted-foreground': '#52525b',
  } as CSSProperties,
};

export function CodeBlock({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    code: string;
    filename?: string | null;
    language?: string | null;
    showLineNumbers?: boolean | null;
    wrap?: boolean | null;
    maxHeight?: string | number | null;
    size?: 'sm' | 'md' | null;
    theme?: 'auto' | 'light' | 'dark' | null;
    mutedColor?: string | null;
    showCopy?: boolean | null;
    copyLabel?: string | null;
    copiedLabel?: string | null;
  };
  const [copied, setCopied] = useState(false);
  const code = typeof p.code === 'string' ? p.code : '';
  const theme = (p.theme as 'auto' | 'light' | 'dark' | null) ?? 'auto';
  const size = (p.size as 'sm' | 'md' | null) ?? 'md';
  const showLineNumbers = p.showLineNumbers === true;
  const wrap = p.wrap === true;
  const language = (p.language as string | null) ?? 'plaintext';
  // EXACT maxHeight channel (new): when the model names a value, cap the scrolling
  // <pre> and add vertical scroll. Unset → no class + no inline style on the <pre>,
  // so the block stays uncapped exactly as before (byte-identical default).
  const capped = p.maxHeight != null;
  // Split on newlines; each line is rendered as escaped text (React escapes it).
  const lines = code.split('\n');
  const showHeader = p.filename != null || language !== 'plaintext';
  // the copy affordance is decoupled from header presence. When the header is
  // absent, a corner copy button floats over the code so a bare snippet still has copy.
  // Default true = a headerless block GAINS a corner button (approved additive: the copy
  // affordance was previously missing there). A block WITH a header is byte-identical
  // (the header copy button is unchanged, no floating one is added).
  const showCopy = p.showCopy ?? true;
  // i18n: the frozen English literals become defaults; escaped text overrides.
  const copyLabel = typeof p.copyLabel === 'string' ? p.copyLabel : 'Copy';
  const copiedLabel = typeof p.copiedLabel === 'string' ? p.copiedLabel : 'Copied';
  const copy = (): void => {
    try {
      void navigator.clipboard?.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (no-op) */
    }
  };
  const gutterWidth = String(lines.length).length;
  const floatingCopy = !showHeader && showCopy;
  // Accessible name for the <pre> scrollport (see the tab-stop comment on it):
  // whatever the header already shows — the filename, else the language — and a
  // bare "Code" for a headerless block, which by definition shows neither.
  const codeLabel = p.filename ?? (language !== 'plaintext' ? `${language} code` : 'Code');
  return (
    <div
      // `relative` is added ONLY when the floating corner copy button renders (headerless
      // + showCopy), so it anchors that button. A block with a header is byte-identical
      // (no `relative`, no floating button).
      className={cn(codeBlockWrap({ size }), floatingCopy && 'relative')}
      data-code-theme={theme}
      style={{
        ...(theme === 'auto' ? undefined : CODE_THEME[theme]),
        ...styleVars({ var: '--fr-codeblock-muted', value: p.mutedColor, kind: 'color' }),
      }}
    >
      {showHeader && (
        <div className={cn(codeBlockHeader)}>
          <div className="flex min-w-0 items-center gap-2">
            {p.filename != null && (
              // The filename is the snippet's identity and a path loses it from the
              // FRONT when clipped ("…/utils/format.ts" → "src/component…"). The
              // header has no fixed height and both siblings (language chip, copy
              // button) are shrink-0, so this column can wrap without squeezing them.
              <span className="break-words text-[0.8125rem] font-medium text-foreground" title={p.filename}>{p.filename}</span>
            )}
            {language !== 'plaintext' && (
              <span className="shrink-0 text-[0.6875rem] uppercase tracking-wide [color:var(--fr-codeblock-muted,var(--color-muted-foreground))]">{language}</span>
            )}
          </div>
          <button
            type="button"
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[calc(var(--radius-frayme)/2)] border border-border bg-card px-2 py-1 text-[0.75rem] [color:var(--fr-codeblock-muted,var(--color-muted-foreground))] transition hover:text-foreground"
            aria-label={copied ? copiedLabel : copyLabel}
            onClick={copy}
          >
            <Icon name={copied ? 'check' : 'copy'} size={13} />
            {copied ? copiedLabel : copyLabel}
          </button>
        </div>
      )}
      {/* floating corner copy button when there is NO header, so a bare snippet
          still has a copy affordance. The `relative` on the wrapper (added above only in
          this case) anchors it. */}
      {floatingCopy && (
        <button
          type="button"
          className="absolute right-2 top-2 z-10 inline-flex cursor-pointer items-center gap-1 rounded-[calc(var(--radius-frayme)/2)] border border-border bg-card px-2 py-1 text-[0.75rem] [color:var(--fr-codeblock-muted,var(--color-muted-foreground))] shadow-sm transition hover:text-foreground"
          aria-label={copied ? copiedLabel : copyLabel}
          onClick={copy}
        >
          <Icon name={copied ? 'check' : 'copy'} size={13} />
          {copied ? copiedLabel : copyLabel}
        </button>
      )}
      <pre
        className={cn(
          codeBlockPre({ size, wrap: wrap as true | false }),
          // exact maxHeight: cap + vertical scroll, ONLY when the model named it
          // (no max-h-* utility on the base, so no tailwind-merge conflict; the
          // y-axis scroll is a separate group from the base overflow-x-auto).
          capped && '[max-height:var(--fr-codeblock-maxh)] overflow-y-auto',
        )}
        style={capped ? styleVars({ var: '--fr-codeblock-maxh', value: p.maxHeight, kind: 'dim', opts: { units: ['px', 'rem', 'vh'], min: 80, max: 1200 } }) : undefined}
        // KEYBOARD (WCAG 2.1.1): the <pre> is a horizontal scrollport in the
        // DEFAULT shape (`whitespace-pre` unless wrap:true) and a vertical one too
        // once maxHeight caps it — and it holds no focusable child, because both
        // copy affordances sit OUTSIDE it (in the header, or absolutely positioned
        // over the wrapper). A scroll container that cannot be focused cannot be
        // scrolled without a pointer, so any code past the right edge was
        // unreachable from the keyboard. Tab stop + name; no redundancy risk,
        // there is nothing inside to walk to instead.
        // role="group", not "region": region is a LANDMARK, so a docs page with a
        // dozen snippets would bury its real landmarks under a dozen code blocks
        // in a screen reader's navigation list.
        role="group"
        aria-label={codeLabel}
        tabIndex={0}
      >
        <code>
          {lines.map((line, i) => (
            <span key={i} className="block">
              {showLineNumbers && (
                <span
                  // Line numbers ARE muted text — they read the same channel as
                  // the header label + copy button (kept at 70% via color-mix).
                  className="mr-3 inline-block select-none text-right text-[color:color-mix(in_srgb,var(--fr-codeblock-muted,var(--color-muted-foreground))_70%,transparent)]"
                  style={{ width: `${gutterWidth}ch` }}
                  aria-hidden
                >
                  {i + 1}
                </span>
              )}
              {/* React escapes this text node — code is never interpreted as HTML. */}
              {line.length > 0 ? line : '​'}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
