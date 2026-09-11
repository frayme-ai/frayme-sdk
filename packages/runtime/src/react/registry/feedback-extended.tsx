'use client';
import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { borderStyleClass, fontClass, leadingClass, styleVars, surfaceInk, trackingClass, weightClass } from './_style.js';
import { Icon, hasIcon } from './icons.js';
import { safeUrl, linkTargetRel } from './url-safety.js';

/* Catalog group (feedback-extended): Banner, Callout, InlineMessage,
 * LoadingOverlay, NotFound, Result.
 *
 * Same truly-dynamic contract as the shipped catalog:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (colors the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities with a TOKEN fallback.
 *     `styleVars` re-validates + omits any failing/absent value so the token
 *     fallback wins (props-less → polished).
 *
 * value > enum precedence (Banner/Callout `bg`/`accent` over tone/variant): the
 * CONDITIONAL override class is only added to cn() when the model supplied the
 * value (`p.bg != null`), so the enum class wins when absent and the var wins
 * when present (added LAST → tailwind-merge keeps it).
 *
 * INTERACTIVITY (rule #8): Banner/Callout own internal `dismissed` state (a ×
 * that returns null + emits `dismiss`) — copied from the Alert dismiss pattern,
 * works without a binding. LoadingOverlay's `visible` rides `useLocalOrBound`,
 * so it toggles locally when unbound and syncs when bound. NotFound/Result
 * actions are genuinely host-routed (href or emit('commit')) by design.
 *
 * Icons are NAMES resolved against the closed `icons.ts` registry, guarded by
 * hasIcon before rendering any spec-supplied name (unknown → nothing). URLs are
 * guarded at point-of-use (safeUrl + linkTargetRel for the external boolean).
 */

/* Shared tone → status glyph map (NAMES in the closed registry). */
const TONE_ICON: Record<string, string> = {
  neutral: 'info',
  success: 'check-circle',
  warning: 'alert-triangle',
  critical: 'alert-circle',
  info: 'info',
};

/* Result `status` → status glyph (NAMES in the closed registry). `pending`
   has no icon here — it renders OUR own spinner instead. */
const STATUS_ICON: Record<string, string> = {
  success: 'check-circle',
  error: 'alert-circle',
  warning: 'alert-triangle',
  info: 'info',
};

/** Resolve an `icon` prop that supports "auto" | "none" | a glyph name.
 *  auto → the tone's status glyph; none/unknown → null (renders nothing). */
function resolveIcon(icon: string | null | undefined, tone: string): string | null {
  if (icon === 'none') return null;
  if (icon == null || icon === 'auto') return TONE_ICON[tone] ?? 'info';
  return hasIcon(icon) ? icon : null;
}

/** Resolve a glyph-override prop against the closed registry, falling back to a
 *  default glyph name when the supplied name is absent/unknown (never raw SVG). */
function resolveGlyph(name: string | null | undefined, dflt: string): string {
  return typeof name === 'string' && hasIcon(name) ? name : dflt;
}

/* ── Banner ───────────────────────────────────────────────────────────────── */

const banner = cva(
  'flex w-full items-center gap-3 border [--fr-banner-accent:currentColor]',
  {
    variants: {
      // `text-foreground` stays ONLY on `neutral`: bg-muted is an OPAQUE token
      // fill, so the ink there must be that token's partner. The four tinted
      // tones paint a 10% wash — 90% of whatever is underneath shows through — so
      // they do NOT own their background. Inside an authored container
      // (Card bg:#12161f color:#e2e6f0) the wash stayed near-navy while the baked token repainted
      // the copy #18181b: 1.02:1, text the colour of its own background.
      // `text-inherit` is byte-identical at the top level — frayme.css sets
      // `.frayme-root { color: var(--frayme-fg) }` and --color-foreground to that
      // SAME value — and follows the container when there is one.
      tone: {
        neutral: 'border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-[color:var(--fr-surface-fg,var(--color-foreground))]',
        success:
          'border-[color-mix(in_srgb,var(--frayme-success)_35%,transparent)] [background:color-mix(in_srgb,var(--frayme-success)_10%,transparent)] text-inherit [--fr-banner-accent:var(--color-success)]',
        warning:
          'border-[color-mix(in_srgb,var(--frayme-warning)_35%,transparent)] [background:color-mix(in_srgb,var(--frayme-warning)_10%,transparent)] text-inherit [--fr-banner-accent:var(--color-warning)]',
        critical:
          'border-[color-mix(in_srgb,var(--frayme-danger)_35%,transparent)] [background:color-mix(in_srgb,var(--frayme-danger)_10%,transparent)] text-inherit [--fr-banner-accent:var(--color-danger)]',
        info:
          'border-[color-mix(in_srgb,var(--frayme-info)_35%,transparent)] [background:color-mix(in_srgb,var(--frayme-info)_10%,transparent)] text-inherit [--fr-banner-accent:var(--color-info)]',
      },
      align: { start: 'justify-start text-left', center: 'justify-center text-center' },
    },
    // The resting tone default is `neutral` (muted surface), not `info`
    // (blue tint); an explicit tone renders its own tint.
    defaultVariants: { tone: 'neutral', align: 'start' },
  },
);

export function Banner({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const emitWith = useIntrinsicEmit(emit, element);
  const p = (element.props ?? {}) as {
    message: string;
    title?: string | null;
    tone?: string | null;
    icon?: string | null;
    actionLabel?: string | null;
    actionHref?: string | null;
    actionExternal?: boolean | null;
    dismissible?: boolean | null;
    dismissed?: boolean | null;
    dismissLabel?: string | null;
    dismissIcon?: string | null;
    align?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    accent?: string | null;
    color?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  // `dismissed` rides useLocalOrBound: unbound it falls back to local state
  // (byte-identical to the prior useState(false) — `p.dismissed ?? false` seeds
  // false), and when bound the setter writes the resolved closed state into
  // spec.state so a host/agent can read/persist it (or seed true to pre-dismiss).
  const [dismissed, setDismissed] = useBoundProp<boolean>(
    p.dismissed ?? false,
    (bindings as Record<string, unknown> | undefined)?.dismissed,
  );
  if (dismissed) return null;
  // The resting tone default is `neutral` — matches the CVA
  // `defaultVariants` below. `TONE_ICON.neutral` is
  // already the same glyph as `info`, so the icon is unaffected either way.
  const tone = (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? 'neutral';
  const iconName = resolveIcon(p.icon, tone);
  const action =
    p.actionLabel != null ? (
      p.actionHref != null ? (
        <a
          className="shrink-0 rounded-sm px-2 py-1 text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current [color:var(--fr-banner-accent)]"
          href={safeUrl(p.actionHref)}
          {...linkTargetRel(p.actionExternal === true)}
        >
          {p.actionLabel}
        </a>
      ) : (
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded-sm border border-current bg-transparent px-2.5 py-1 text-sm font-medium hover:bg-current/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current [color:var(--fr-banner-accent)]"
          onClick={() => emitWith('commit', { label: p.actionLabel ?? null })}
        >
          {p.actionLabel}
        </button>
      )
    ) : null;
  return (
    <div
      className={cn(
        banner({
          tone: (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined,
          align: (p.align as 'start' | 'center' | null) ?? undefined,
        }),
        'px-4 py-3',
        // value > tone (enum) > token: only add the override class when supplied.
        p.bg != null && '[background:var(--fr-banner-bg,var(--fr-surface-sunken,var(--color-muted)))]',
        // Group form (border-[color:…]) so tw-merge dedupes the tone's border-color
        // class (border-border / border-[color-mix(…)]); the bare [border-color:…]
        // form is a different tw-merge group and loses by stylesheet order.
        p.borderColor != null && 'border-[color:var(--fr-banner-border,var(--color-border))]',
        p.accent != null && '[--fr-banner-accent:var(--fr-banner-accent-val)]',
        // Brand group: a custom `bg` flips the WHOLE surface to on-fill — the copy
        // reads the fg var at the root (group form dedupes the tone's
        // text-[color:var(--fr-surface-fg,var(--color-foreground))]) and, unless an explicit `accent` is set, the icon +
        // action follow it via currentColor, so one `bg` keeps the trio coherent.
        p.bg != null && 'text-[color:var(--fr-banner-fg,var(--color-primary-foreground))]',
        p.bg != null && p.accent == null && '[--fr-banner-accent:currentColor]',
        // `color` alone (no bg swap) is a legitimate text recolor over the
        // tone surface. When bg is unset but color is set, apply the fg reader with
        // the FOREGROUND token as fallback (the resting text default), so a
        // text-only recolor works. Gated on color so unset stays byte-identical.
        p.bg == null && p.color != null && 'text-[color:var(--fr-banner-fg,var(--color-foreground))]',
        // Closed Font enum → a static font-* utility; the whole banner inherits it.
        // Unset/unknown → undefined → dropped (inherit the theme font, byte-identical).
        fontClass(p.font),
      )}
      role="status"
      style={styleVars(
        { var: '--fr-banner-bg', value: p.bg, kind: 'color' },
        { var: '--fr-banner-border', value: p.borderColor, kind: 'color' },
        /* Ink DERIVED from the bg when the author names no colour. The reader on the
           line above flips on the mere PRESENCE of `bg` and falls back to
           --color-primary-foreground — a near-white ink applied whatever the bg
           actually is, so Banner{bg:"#FFFFFF"} rendered white-on-white. surfaceInk
           picks by luminance (crossover 0.179) and an authored `color` still wins,
           because it is passed in and returned first. */
        { var: '--fr-banner-fg', value: surfaceInk(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-banner-accent-val', value: p.accent, kind: 'color' },
        { var: '--fr-banner-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {iconName != null && (
        <span className="shrink-0 [color:var(--fr-banner-accent)]" aria-hidden>
          <Icon name={iconName} size={18} />
        </span>
      )}
      {/* On a custom bg the copy inherits the on-fill fg from the ROOT reader
          (single source — an element-scoped duplicate here would shadow it). */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {p.title != null && (
          // fontSize is a single source: the baked 0.9375rem is the var fallback
          // (byte-identical when unset), and an exact fontSize wins via the var.
          <strong className={cn('break-words [font-size:var(--fr-banner-fs,0.9375rem)] font-semibold leading-snug', weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}>{p.title}</strong>
        )}
        <span className={cn('break-words text-sm leading-snug', weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}>{p.message}</span>
      </div>
      {action}
      {p.dismissible === true && (
        <button
          type="button"
          className="-mr-1 shrink-0 cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-1 leading-none text-current opacity-70 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current"
          aria-label={p.dismissLabel ?? 'Dismiss'}
          onClick={() => {
            setDismissed(true);
            emitWith('dismiss', { label: p.title ?? null });
          }}
        >
          <Icon name={resolveGlyph(p.dismissIcon, 'x')} size={16} />
        </button>
      )}
    </div>
  );
}

/* ── Callout ──────────────────────────────────────────────────────────────── */

const callout = cva('flex gap-3 rounded-frayme border-solid [border-width:var(--fr-callout-bw,1px)] [--fr-callout-accent:var(--color-foreground)]', {
  variants: {
    tone: {
      neutral: '[--fr-callout-accent:var(--color-foreground)]',
      success: '[--fr-callout-accent:var(--color-success)]',
      warning: '[--fr-callout-accent:var(--color-warning)]',
      critical: '[--fr-callout-accent:var(--color-danger)]',
      info: '[--fr-callout-accent:var(--color-info)]',
    },
    variant: {
      subtle: '[background:color-mix(in_srgb,var(--fr-callout-accent)_8%,transparent)] [border-color:color-mix(in_srgb,var(--fr-callout-accent)_28%,transparent)]',
      // solid text reads the fg channel WITH white (the prior baked token) as the
      // var fallback, so `color` can fix contrast on a light tone/accent fill
      // (e.g. warning amber) while an unset value stays byte-identical white.
      solid: '[background:var(--fr-callout-accent)] border-transparent text-[color:var(--fr-callout-fg,white)] [&_*]:text-[color:var(--fr-callout-fg,white)]',
      outline: 'bg-transparent [border-color:color-mix(in_srgb,var(--fr-callout-accent)_45%,transparent)]',
      'left-accent':
        '[background:color-mix(in_srgb,var(--fr-callout-accent)_8%,transparent)] border-border border-l-[3px] [border-left-color:var(--fr-callout-accent)]',
    },
    size: { md: 'px-4 py-3.5' },
  },
  defaultVariants: { tone: 'info', variant: 'subtle', size: 'md' },
});

export function Callout({ element, children, emit, bindings }: ComponentRenderProps): ReactNode {
  const emitWith = useIntrinsicEmit(emit, element);
  const p = (element.props ?? {}) as {
    message?: string | null;
    title?: string | null;
    tone?: string | null;
    icon?: string | null;
    variant?: string | null;
    dismissible?: boolean | null;
    dismissed?: boolean | null;
    dismissLabel?: string | null;
    dismissIcon?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    accent?: string | null;
    color?: string | null;
    borderStyle?: string | null;
    borderWidthValue?: string | number | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  // `dismissed` rides useLocalOrBound: unbound it falls back to local state
  // (byte-identical to the prior useState(false) via `p.dismissed ?? false`), and
  // when bound the × writes the resolved closed state into spec.state so a host/
  // agent can read or drive it; seeding true starts the callout hidden.
  const [dismissed, setDismissed] = useBoundProp<boolean>(
    p.dismissed ?? false,
    (bindings as Record<string, unknown> | undefined)?.dismissed,
  );
  if (dismissed) return null;
  const tone = (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? 'info';
  const iconName = resolveIcon(p.icon, tone);
  const hasBody = p.message != null || children != null;
  return (
    <div
      className={cn(
        // Equal-frame law marker (frayme.css): a frame component — grows to
        // absorb slack when it is the last frame child of a stretched Grid
        // cell's Stack wrapper.
        'fr-frame',
        callout({
          tone: (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined,
          variant: (p.variant as 'subtle' | 'solid' | 'outline' | 'left-accent' | null) ?? undefined,
        }),
        // value > tone (enum) > token: only add the override class when supplied.
        p.accent != null && '[--fr-callout-accent:var(--fr-callout-accent-val)]',
        p.bg != null && '[background:var(--fr-callout-bg)]',
        // A custom bg surface (non-solid) needs readable on-surface copy; `solid`
        // already forces text-white over its colored fill.
        p.bg != null && p.variant !== 'solid' && '[color:var(--fr-callout-fg,var(--color-primary-foreground))]',
        // `color` alone (no bg swap) recolors the copy over the tone
        // surface. When bg is unset on a non-solid variant but color is set, apply
        // the fg reader with the FOREGROUND token as fallback (the resting text
        // default). Gated on color so unset stays byte-identical; solid handles
        // color via its own baked reader (--fr-callout-fg, white fallback).
        p.bg == null && p.variant !== 'solid' && p.color != null && '[color:var(--fr-callout-fg,var(--color-foreground))]',
        // value > variant/tone (enum) > token: override the variant-derived border.
        // Group form (border-[color:…]) so tw-merge dedupes solid's border-transparent
        // and left-accent's border-border; subtle/outline's bare [border-color:…] is
        // not deduped but sorts earlier than this utility, so the value still wins.
        p.borderColor != null && 'border-[color:var(--fr-callout-border,var(--color-border))]',
        // Closed border-style enum (unset → undefined → keeps the base solid).
        borderStyleClass(p.borderStyle),
        // Closed Font enum → a static font-* utility; the whole callout inherits it.
        // Unset/unknown → undefined → dropped (inherit the theme font, byte-identical).
        fontClass(p.font),
      )}
      role="note"
      style={styleVars(
        { var: '--fr-callout-bg', value: p.bg, kind: 'color' },
        { var: '--fr-callout-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-callout-fg', value: p.color, kind: 'color' },
        { var: '--fr-callout-accent-val', value: p.accent, kind: 'color' },
        { var: '--fr-callout-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
        { var: '--fr-callout-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {iconName != null && (
        <span
          className={cn('mt-0.5 shrink-0', p.variant !== 'solid' && '[color:var(--fr-callout-accent)]')}
          aria-hidden
        >
          <Icon name={iconName} size={18} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {p.title != null && (
          // fontSize is a single source: the baked 0.9375rem is the var fallback
          // (byte-identical when unset), and an exact fontSize wins via the var.
          <strong className={cn('break-words [font-size:var(--fr-callout-fs,0.9375rem)] font-semibold leading-snug', weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}>{p.title}</strong>
        )}
        {p.message != null && (
          <span className={cn('break-words text-sm leading-relaxed opacity-90', weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}>{p.message}</span>
        )}
        {children != null && <div className={cn(hasBody && p.message != null && 'mt-1', 'text-sm')}>{children}</div>}
      </div>
      {p.dismissible === true && (
        <button
          type="button"
          className="-mr-1 -mt-0.5 shrink-0 cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-1 leading-none text-current opacity-70 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current"
          aria-label={p.dismissLabel ?? 'Dismiss'}
          onClick={() => {
            setDismissed(true);
            emitWith('dismiss', { label: p.title ?? null });
          }}
        >
          <Icon name={resolveGlyph(p.dismissIcon, 'x')} size={16} />
        </button>
      )}
    </div>
  );
}

/* ── InlineMessage ────────────────────────────────────────────────────────── */

// Font size flows through a two-step var chain (the Text/Heading pattern): each
// `size` step sets the DEFAULT var and the base reads
// [font-size:var(--fr-inlinemsg-fs,var(--fr-inlinemsg-fs-default))], so an exact
// `fontSize` wins over the enum without co-locating a text-* utility (whose
// font-size would beat the bare arbitrary rule by stylesheet order). Sizes
// reproduce exactly: md was text-sm=0.875rem (its bundled line-height was
// already overridden by the base leading-snug), sm the prior 0.8125rem.
const inlineMessage = cva(
  'inline-flex items-center gap-1.5 leading-snug [font-size:var(--fr-inlinemsg-fs,var(--fr-inlinemsg-fs-default))]',
  {
    variants: {
      tone: {
        neutral: 'text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]',
        success: 'text-success',
        warning: 'text-warning',
        critical: 'text-danger',
        info: 'text-info',
      },
      size: { sm: '[--fr-inlinemsg-fs-default:0.8125rem]', md: '[--fr-inlinemsg-fs-default:0.875rem]' },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);
/* `color` recolors the text + icon together (one role). The reader is the
 * text-color group form so it dedupe-wins over the tone's `text-*` class; the
 * in-var fallback is the SAME tone token, so an INVALID/omitted color keeps the
 * tone colour byte-identical (and unset never adds the class at all). */
const INLINEMSG_FG_FALLBACK: Record<string, string> = {
  neutral: 'text-[color:var(--fr-inlinemsg-fg,var(--color-muted-foreground))]',
  success: 'text-[color:var(--fr-inlinemsg-fg,var(--color-success))]',
  warning: 'text-[color:var(--fr-inlinemsg-fg,var(--color-warning))]',
  critical: 'text-[color:var(--fr-inlinemsg-fg,var(--color-danger))]',
  info: 'text-[color:var(--fr-inlinemsg-fg,var(--color-info))]',
};

export function InlineMessage({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    message: string;
    tone?: string | null;
    icon?: string | null;
    size?: string | null;
    color?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const tone = (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? 'neutral';
  const size = (p.size as 'sm' | 'md' | null) ?? 'md';
  const iconName = resolveIcon(p.icon, tone);
  return (
    <span
      className={cn(
        inlineMessage({ tone: (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined, size: (p.size as 'sm' | 'md' | null) ?? undefined }),
        // `color` recolors text + icon together (the icon is currentColor).
        // The tone-keyed reader (added LAST) dedupe-wins the tone's text-* class;
        // its in-var fallback IS the tone token, so unset stays byte-identical.
        p.color != null && (INLINEMSG_FG_FALLBACK[tone] ?? INLINEMSG_FG_FALLBACK.neutral),
        // Closed Font enum → a static font-* utility; the message inherits it.
        // Unset/unknown → undefined → dropped (inherit the theme font, byte-identical).
        fontClass(p.font),
      )}
      role="status"
      style={styleVars(
        { var: '--fr-inlinemsg-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
        { var: '--fr-inlinemsg-fg', value: p.color, kind: 'color' },
      )}
    >
      {iconName != null && (
        <span className="shrink-0" aria-hidden>
          <Icon name={iconName} size={size === 'sm' ? 13 : 15} />
        </span>
      )}
      <span className={cn('break-words', weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}>{p.message}</span>
    </span>
  );
}

/* ── LoadingOverlay ───────────────────────────────────────────────────────── */

const overlayScrim = cva(
  'absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 [background:var(--fr-overlay-bg,color-mix(in_srgb,var(--color-background)_60%,transparent))]',
  {
    variants: {
      blur: { true: 'backdrop-blur-sm', false: '' },
    },
    defaultVariants: { blur: false },
  },
);
// The spinner HEAD reads the same `color` channel as the label (--fr-overlay-fg,
// set on the scrim) with the prior primary token as the var fallback, so a
// branded overlay recolors label + spinner as one role (unset → byte-identical).
const overlaySpinner = cva(
  'inline-block rounded-full border-[var(--color-border)] [border-top-color:var(--fr-overlay-fg,var(--color-primary))] animate-spin',
  {
    variants: {
      spinnerSize: {
        sm: 'h-5 w-5 border-2',
        md: 'h-8 w-8 border-2',
        lg: 'h-12 w-12 border-[3px]',
      },
    },
    defaultVariants: { spinnerSize: 'md' },
  },
);

export function LoadingOverlay({ element, children, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    active?: boolean | null;
    label?: string | null;
    blur?: boolean | null;
    spinnerSize?: string | null;
    overlayColor?: string | null;
    color?: string | null;
  };
  // `active` defaults to true; it stays reactive without a binding (local state
  // fallback) and syncs to a bound flag when present. (Named `active`, not
  // `visible` — `visible` is a reserved json-render element-level field.)
  const [active] = useBoundProp<boolean>(p.active ?? true, (bindings as Record<string, unknown> | undefined)?.active);
  const isVisible = active !== false;
  return (
    <div className="relative" aria-busy={isVisible}>
      {children}
      {isVisible && (
        <div
          className={cn(overlayScrim({ blur: (p.blur ?? false) as true | false }))}
          role="status"
          style={styleVars(
            { var: '--fr-overlay-bg', value: p.overlayColor, kind: 'color' },
            { var: '--fr-overlay-fg', value: p.color, kind: 'color' },
          )}
        >
          <span
            className={cn(overlaySpinner({ spinnerSize: (p.spinnerSize as 'sm' | 'md' | 'lg' | null) ?? undefined }))}
            aria-hidden
          />
          {p.label != null && <span className="text-sm font-medium [color:var(--fr-overlay-fg,var(--color-foreground))]">{p.label}</span>}
          <span className="sr-only">{p.label ?? 'Loading'}</span>
        </div>
      )}
    </div>
  );
}

/* ── NotFound ─────────────────────────────────────────────────────────────── */

const notFoundWrap = cva('flex flex-col gap-2 py-14', {
  variants: {
    align: { center: 'items-center text-center', start: 'items-start text-left' },
  },
  defaultVariants: { align: 'center' },
});

export function NotFound({ element, emit }: ComponentRenderProps): ReactNode {
  const emitWith = useIntrinsicEmit(emit, element);
  const p = (element.props ?? {}) as {
    title: string;
    code?: string | null;
    description?: string | null;
    icon?: string | null;
    actionLabel?: string | null;
    actionHref?: string | null;
    actionExternal?: boolean | null;
    align?: string | null;
    bg?: string | null;
    color?: string | null;
    mutedColor?: string | null;
    accent?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const iconName = p.icon != null && hasIcon(p.icon) ? p.icon : null;
  return (
    <div
      className={cn(
        notFoundWrap({ align: (p.align as 'center' | 'start' | null) ?? undefined }),
        // NEW surface channels (token-default): a brandable panel fill + title colour.
        '[background:var(--fr-notfound-bg,transparent)]',
        // The panel's own fill defaults to TRANSPARENT (line above), so unless `bg`
        // is authored this element does not own its background — it borrows the
        // container's. The fallback therefore inherits instead of repainting: with
        // the foreground token baked in, a NotFound inside an authored Card
        // (bg:#12161f color:#e2e6f0) reset the whole panel to #18181b over navy,
        // 1.02:1. currentColor on the `color` property computes to the INHERITED
        // colour (not circular), and at the root it IS --color-foreground —
        // frayme.css points both .frayme-root's color and --color-foreground at
        // --frayme-fg — so an unwrapped panel is byte-identical.
        'text-[color:var(--fr-notfound-fg,currentColor)]',
        // Closed Font enum → a static font-* utility; the whole panel inherits it.
        // Unset/unknown → undefined → dropped (inherit the theme font, byte-identical).
        fontClass(p.font),
      )}
      role="alert"
      style={styleVars(
        { var: '--fr-notfound-bg', value: p.bg, kind: 'color' },
        { var: '--fr-notfound-fg', value: p.color, kind: 'color' },
        { var: '--fr-notfound-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-notfound-accent', value: p.accent, kind: 'color' },
        { var: '--fr-notfound-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {iconName != null && (
        <span className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--fr-surface-sunken,var(--color-muted))] [color:var(--fr-notfound-muted,var(--fr-surface-muted,var(--color-muted-foreground)))]" aria-hidden>
          <Icon name={iconName} size={28} />
        </span>
      )}
      {p.code != null && (
        <span className="text-[2.5rem] font-bold leading-none tracking-tight [color:var(--fr-notfound-muted,var(--fr-surface-muted,var(--color-muted-foreground)))] tabular-nums">{p.code}</span>
      )}
      {/* fontSize is a single source: the baked 1.375rem is the var fallback
          (byte-identical when unset), and an exact fontSize wins via the var. */}
      <h2 className={cn('m-0 [font-size:var(--fr-notfound-fs,1.375rem)] font-semibold', weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}>{p.title}</h2>
      {p.description != null && <p className="m-0 max-w-prose text-sm [color:var(--fr-notfound-muted,var(--fr-surface-muted,var(--color-muted-foreground)))]">{p.description}</p>}
      {p.actionLabel != null && (
        <div className="mt-4">
          {p.actionHref != null ? (
            <a
              className="inline-flex items-center gap-1.5 rounded-frayme bg-[color:var(--fr-notfound-accent,var(--color-foreground))] px-4 py-2 text-sm font-medium text-card no-underline transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
              href={safeUrl(p.actionHref)}
              {...linkTargetRel(p.actionExternal === true)}
            >
              {p.actionLabel}
            </a>
          ) : (
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-frayme bg-[color:var(--fr-notfound-accent,var(--color-foreground))] px-4 py-2 text-sm font-medium text-card transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
              onClick={() => emitWith('commit', { label: p.actionLabel ?? null })}
            >
              {p.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Result ───────────────────────────────────────────────────────────────── */

const resultWrap = cva('flex flex-col gap-3 py-12', {
  variants: {
    align: { center: 'items-center text-center', start: 'items-start text-left' },
  },
  defaultVariants: { align: 'center' },
});
const resultIcon = cva('inline-flex items-center justify-center rounded-full', {
  variants: {
    status: {
      success: '[background:color-mix(in_srgb,var(--frayme-success)_14%,transparent)] text-success',
      error: '[background:color-mix(in_srgb,var(--frayme-danger)_14%,transparent)] text-danger',
      warning: '[background:color-mix(in_srgb,var(--frayme-warning)_14%,transparent)] text-warning',
      info: '[background:color-mix(in_srgb,var(--frayme-info)_14%,transparent)] text-info',
      pending: 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]',
    },
  },
  defaultVariants: { status: 'info' },
});
const resultActionBtn = cva(
  'inline-flex cursor-pointer items-center gap-1.5 rounded-frayme px-4 py-2 text-sm font-medium no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        // quiet defaults: the panel's main affordance is neutral high-contrast
        // (foreground/card) by default via the accent-fallback swap, not a brand slab;
        // a supplied `accent` still fills brand. secondary text reads the panel fg chain
        // so it follows a custom `color` instead of the baked foreground token.
        // primary KEEPS the foreground token: that chain is a BACKGROUND (the
        // button paints its own slab and prints `text-card` on it), so the pair
        // has to be two tokens — currentColor there would make the fill equal the
        // ink. secondary is bg-transparent: it borrows the panel's surface, so its
        // last resort inherits (see the panel root's note).
        primary: 'bg-[color:var(--fr-result-accent,var(--color-foreground))] text-card hover:opacity-90',
        secondary: 'border border-border bg-transparent text-[color:var(--fr-result-fg,currentColor)] hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);

type ResultAction = {
  label?: string | null;
  href?: string | null;
  external?: boolean | null;
  variant?: string | null;
};

export function Result({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const emitWith = useIntrinsicEmit(emit, element);
  const p = (element.props ?? {}) as {
    title: string;
    status?: string | null;
    description?: string | null;
    icon?: string | null;
    actions?: ResultAction[] | null;
    activeAction?: string | null;
    align?: string | null;
    bg?: string | null;
    color?: string | null;
    mutedColor?: string | null;
    accent?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const [, setActiveAction] = useBoundProp(
    p.activeAction ?? undefined,
    (bindings as Record<string, unknown> | undefined)?.activeAction,
  );
  const status = (p.status as 'success' | 'error' | 'warning' | 'info' | 'pending' | null) ?? 'info';
  // status conveyed by icon + color + text (never color-only). `pending` shows a
  // spinner; an explicit `icon` override wins (when it's a known glyph).
  const iconName = p.icon != null && hasIcon(p.icon) ? p.icon : STATUS_ICON[status] ?? null;
  const actions = Array.isArray(p.actions) ? p.actions.filter((a) => a != null && a.label != null) : [];
  return (
    <div
      className={cn(
        resultWrap({ align: (p.align as 'center' | 'start' | null) ?? undefined }),
        // NEW surface channels (token-default): a brandable panel fill + title colour.
        '[background:var(--fr-result-bg,transparent)]',
        // Same reasoning as NotFound above: the panel fill is transparent unless
        // `bg` is authored, so the resting ink INHERITS rather than repainting the
        // foreground token over a container the panel does not own. Byte-identical
        // at the root, where currentColor resolves to --frayme-fg.
        'text-[color:var(--fr-result-fg,currentColor)]',
        // Closed Font enum → a static font-* utility; the whole screen inherits it.
        // Unset/unknown → undefined → dropped (inherit the theme font, byte-identical).
        fontClass(p.font),
      )}
      role="status"
      style={styleVars(
        { var: '--fr-result-bg', value: p.bg, kind: 'color' },
        { var: '--fr-result-fg', value: p.color, kind: 'color' },
        { var: '--fr-result-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-result-accent', value: p.accent, kind: 'color' },
        { var: '--fr-result-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      <span className={cn(resultIcon({ status }), 'h-16 w-16')} aria-hidden>
        {status === 'pending' && p.icon == null ? (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] [border-top-color:var(--color-muted-foreground)]" />
        ) : (
          iconName != null && <Icon name={iconName} size={34} />
        )}
      </span>
      {/* fontSize is a single source: the baked 1.5rem is the var fallback
          (byte-identical when unset), and an exact fontSize wins via the var. */}
      <h2 className={cn('m-0 [font-size:var(--fr-result-fs,1.5rem)] font-semibold leading-tight', weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}>{p.title}</h2>
      {p.description != null && (
        <p className="m-0 max-w-prose text-sm [color:var(--fr-result-muted,var(--color-muted-foreground))]">{p.description}</p>
      )}
      {actions.length > 0 && (
        <div className={cn('mt-3 flex flex-wrap gap-2', (p.align ?? 'center') === 'center' && 'justify-center')}>
          {actions.map((a, i) => {
            const variant = (a.variant as 'primary' | 'secondary' | null) ?? (i === 0 ? 'primary' : 'secondary');
            const label = a.label as string;
            if (a.href != null) {
              return (
                <a
                  key={i}
                  className={cn(resultActionBtn({ variant }))}
                  href={safeUrl(a.href)}
                  {...linkTargetRel(a.external === true)}
                >
                  {label}
                </a>
              );
            }
            return (
              <button
                key={i}
                type="button"
                className={cn(resultActionBtn({ variant }))}
                onClick={() => {
                  setActiveAction(a.label ?? String(i));
                  emitWith('commit', { label: a.label ?? null, index: i });
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
