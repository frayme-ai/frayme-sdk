'use client';
import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { styleVars, borderStyleClass, fontClass, weightClass, trackingClass, leadingClass, aspectClass, surfaceField, surfaceInk, surfaceMuted, surfaceRaised, surfaceSunken } from './_style.js';
import { Icon } from './icons.js';
import { safeImageSrc, safeUrl, linkTargetRel } from './url-safety.js';
import { SafeImage } from './_img.js';

/* Catalog group (marketing-hero): Hero, CTA, FeatureGrid, FeatureCard, LogoCloud.
 *
 * Same truly-dynamic contract as the shipped catalog:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (colors/dimensions the model names directly) NEVER become
 *     classes — they land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`,
 *     read by STATIC arbitrary `var(--fr-…, var(--color-…))` utilities. The class
 *     set stays closed (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing/absent
 *     value so the token fallback wins (props-less → polished).
 *
 * value > enum precedence (a model `bg`/`gradient`/`accent` over the token
 * default): the override is a CONDITIONAL class — the `[background:var(--fr-…)]`
 * utility is only added to cn() when the model supplied the value, so the token
 * default wins when absent and the var wins when present (added LAST →
 * tailwind-merge keeps it). When a model `accent` becomes a SURFACE fill (a
 * primary CTA button), it is ALWAYS paired with a readable accent-text color.
 *
 * Icons are NAMES resolved against the closed `icons.ts` registry (Icon renders
 * nothing for an unknown/absent name). Action buttons carry a guarded <a> when
 * `href` is set (safeUrl + linkTargetRel) or a <button> that emits the band's
 * action event otherwise. Images go through safeImageSrc (raster-only); a
 * failed/absent src falls back to a tinted placeholder. No interactive open/selected
 * state lives in this family — Hero/CTA actions are host-routed (emit/href) by
 * design, FeatureCard is a link-or-press leaf. The one bindable state is the
 * `activeAction` discriminator on Hero/CTA: a multi-action band writes WHICH
 * action fired (its label or index) to a bound prop BEFORE emitting `commit`, so
 * the host can attribute the click; it is a no-op setter (byte-identical) when
 * unbound, and only the emit path (button, never an href <a>) writes it.
 */

/** Feature-card title tag. A card has no way to know its own depth in the page,
 *  so a legal heading outline is only reachable when the SPEC can name the level.
 *  A model writes it as 3, '3' or 'h3' interchangeably, so all three normalise.
 *  (Same normaliser as layout.tsx's private `headingTag` — kept local rather than
 *  shared so the two files can move independently; consolidate if a third needs it.) */
type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
const HEADING_TAGS = new Set<string>(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
function headingTag(value: unknown, fallback: HeadingTag): HeadingTag {
  if (value == null) return fallback;
  const tag = `h${String(value).trim().replace(/^[hH]/, '')}`;
  return HEADING_TAGS.has(tag) ? (tag as HeadingTag) : fallback;
}

/* ── shared action-button bits ────────────────────────────────────────────── */

type ActionItem = {
  label?: string | null;
  href?: string | null;
  external?: boolean | null;
  variant?: string | null;
  icon?: string | null;
};

// The recipe dresses BOTH renderings of a CTA — the guarded <a> and the emitting
// <button> — so the pointer belongs on the base, not on one branch.
// No whitespace-nowrap: CTA labels are author-supplied sentences ("Start your free
// 14-day trial"), and a nowrap flex item's min-content width is the WHOLE string —
// at 320px the button pushed past the band instead of wrapping inside it. The action
// rows are `flex flex-wrap`, so the label now wraps within the button box.
// text-center keeps the wrapped lines centred in BOTH renderings — a <button> centres
// via the UA sheet, an <a> would inherit left.
const ctaButton = cva(
  'cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-frayme px-4 py-2 text-center text-sm font-medium no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        // quiet defaults: the first (primary) CTA is neutral high-contrast by
        // default, not a brand slab; an author `accent` still fills brand via the
        // `accented` var path below (a set accent recolors the primary fill).
        primary: 'bg-[color:var(--fr-btn-fill,var(--color-foreground))] text-[color:var(--fr-btn-ink,var(--color-card))] hover:brightness-95',
        secondary: 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/80',
        outline: 'border border-border bg-transparent text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
        ghost: 'bg-transparent text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

/* On-surface treatment for the NON-primary variants when the band carries a
 * model-supplied surface (solid bg / gradient / background image): their label
 * (and the outline's border) must read the band's on-surface text var — the
 * same var the headline/subtitle read — instead of the theme foreground, or a
 * dark brand band renders dark-on-dark buttons beside adapted copy. Full
 * literal strings per band var so the Tailwind build compiles them; every
 * class shares a tw-merge group with the token it replaces (text-* dedupes
 * text-foreground, border-current dedupes border-border, bg-[color:…] dedupes
 * bg-muted and the hover token), so the token classes drop out when applied.
 * currentColor derives the fills/border from the on-surface text colour. */
const ON_SURFACE_CTA: Record<'--fr-hero-fg' | '--fr-cta-fg', Record<'secondary' | 'outline' | 'ghost', string>> = {
  '--fr-hero-fg': {
    secondary:
      'text-[color:var(--fr-hero-fg,var(--color-primary-foreground))] bg-[color:color-mix(in_srgb,currentColor_15%,transparent)] hover:bg-[color:color-mix(in_srgb,currentColor_25%,transparent)]',
    outline:
      'text-[color:var(--fr-hero-fg,var(--color-primary-foreground))] border-current hover:bg-[color:color-mix(in_srgb,currentColor_10%,transparent)]',
    ghost:
      'text-[color:var(--fr-hero-fg,var(--color-primary-foreground))] hover:bg-[color:color-mix(in_srgb,currentColor_10%,transparent)]',
  },
  '--fr-cta-fg': {
    secondary:
      'text-[color:var(--fr-cta-fg,var(--color-primary-foreground))] bg-[color:color-mix(in_srgb,currentColor_15%,transparent)] hover:bg-[color:color-mix(in_srgb,currentColor_25%,transparent)]',
    outline:
      'text-[color:var(--fr-cta-fg,var(--color-primary-foreground))] border-current hover:bg-[color:color-mix(in_srgb,currentColor_10%,transparent)]',
    ghost:
      'text-[color:var(--fr-cta-fg,var(--color-primary-foreground))] hover:bg-[color:color-mix(in_srgb,currentColor_10%,transparent)]',
  },
};

/** Render one CTA: a guarded <a> when href is set, else a <button> that emits. */
function ActionButton({
  action,
  primary,
  accent,
  accentText,
  surfaceFgVar,
  onPress,
}: {
  action: ActionItem;
  primary: boolean;
  accent?: string | null;
  accentText?: string | null;
  /** The band's on-surface text var — set ONLY when the band has a
   *  model-supplied surface, so a default band stays byte-identical. */
  surfaceFgVar?: '--fr-hero-fg' | '--fr-cta-fg' | null;
  onPress: () => void;
}): ReactNode {
  const variant =
    (action.variant as 'primary' | 'secondary' | 'outline' | 'ghost' | null) ?? (primary ? 'primary' : 'secondary');
  // A model `accent` recolors the primary (filled) button only, paired with a
  // readable accent-text token (settable via `accentText`) so a saturated accent
  // fill keeps a legible label.
  const accented = variant === 'primary' && accent != null;
  const className = cn(
    ctaButton({ variant }),
    // On-fill text MUST use the text-color group form (`the text-colour group form`) so
    // tailwind-merge dedupes-and-wins over the variant's `text-primary-foreground`
    // — a bare `a bare arbitrary colour class` arbitrary property does NOT dedupe vs `text-*`.
    // In-var primary-token fallback: an INVALID accent (var omitted by styleVars)
    // keeps the primary fill instead of nuking the button background.
    accented && '[background:var(--fr-cta-accent,var(--color-primary))] text-[color:var(--fr-cta-accent-text,var(--color-primary-foreground))] hover:opacity-90',
    surfaceFgVar != null && variant !== 'primary' && ON_SURFACE_CTA[surfaceFgVar][variant],
  );
  const style = accented
    ? styleVars(
        { var: '--fr-cta-accent', value: accent, kind: 'color' },
        { var: '--fr-cta-accent-text', value: accentText, kind: 'color' },
      )
    : undefined;
  const glyph = action.icon != null ? <Icon name={action.icon} size={16} /> : null;
  const label = action.label ?? '';
  if (action.href != null) {
    const external = action.external === true;
    return (
      <a className={className} href={safeUrl(action.href)} {...linkTargetRel(external)} style={style}>
        {glyph}
        {label}
        {external && <Icon name="arrow-up-right" size={14} />}
      </a>
    );
  }
  return (
    <button type="button" className={className} style={style} onClick={onPress}>
      {glyph}
      {label}
    </button>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */

const heroBand = cva('relative w-full overflow-hidden rounded-2xl', {
  variants: {
    size: {
      sm: 'px-6 py-10 md:px-10',
      md: 'px-6 py-14 md:px-12',
      lg: 'px-6 py-20 md:px-16',
    },
  },
  defaultVariants: { size: 'md' },
});
const heroInner = cva('mx-auto flex w-full gap-10', {
  variants: {
    maxWidth: {
      sm: 'max-w-2xl',
      md: 'max-w-4xl',
      lg: 'max-w-6xl',
      full: 'max-w-none',
    },
    layout: {
      stack: 'flex-col',
      'media-end': 'flex-col items-center md:flex-row',
      'media-start': 'flex-col items-center md:flex-row-reverse',
    },
  },
  defaultVariants: { maxWidth: 'lg', layout: 'stack' },
});
const heroCopy = cva('flex min-w-0 flex-1 flex-col gap-4', {
  variants: {
    align: { left: 'items-start text-left', center: 'items-center text-center' },
  },
  defaultVariants: { align: 'left' },
});
// Headline size: two-step var chain (Pattern A). Each `size` step sets a DEFAULT
// var (not a text-[…] utility, which tw-merge would NOT dedupe against the base's
// arbitrary font-size class), and the base reads exact `fontSize` (--fr-hero-fs)
// over the enum default — byte-identical when unset, the value wins when set.
const heroTitle = cva('m-0 [font-size:var(--fr-hero-fs,var(--fr-hero-fs-default,2.5rem))] font-bold leading-tight tracking-tight', {
  variants: {
    size: { sm: '[--fr-hero-fs-default:1.75rem]', md: '[--fr-hero-fs-default:2.5rem]', lg: '[--fr-hero-fs-default:3.25rem]' },
  },
  defaultVariants: { size: 'md' },
});

/* Background-media scrim: a CLOSED enum mapped to a bottom-up GRADIENT of the
 * `overlayColor` tint (`--fr-hero-overlay`, background-token fallback).
 *
 * A flat inset-0 wash at one opacity did two bad things at once —
 * it flattened the whole photograph into murk AND still left bright areas high
 * in the frame competing with the copy. A gradient puts the density where the
 * text is and lets the image breathe above it. Each step keeps its old identity
 * (light/medium/heavy) and its midpoint lands near the old flat value, so
 * contrast behind centred copy is preserved. */
const HERO_OVERLAY_OPACITY: Record<string, string> = {
  none: 'bg-[color:color-mix(in_srgb,var(--fr-hero-overlay,var(--color-background))_0%,transparent)]',
  light:
    'bg-[linear-gradient(to_top,color-mix(in_srgb,var(--fr-hero-overlay,var(--color-background))_45%,transparent)_0%,color-mix(in_srgb,var(--fr-hero-overlay,var(--color-background))_22%,transparent)_45%,color-mix(in_srgb,var(--fr-hero-overlay,var(--color-background))_8%,transparent)_100%)]',
  medium:
    'bg-[linear-gradient(to_top,color-mix(in_srgb,var(--fr-hero-overlay,var(--color-background))_78%,transparent)_0%,color-mix(in_srgb,var(--fr-hero-overlay,var(--color-background))_48%,transparent)_45%,color-mix(in_srgb,var(--fr-hero-overlay,var(--color-background))_18%,transparent)_100%)]',
  heavy:
    'bg-[linear-gradient(to_top,color-mix(in_srgb,var(--fr-hero-overlay,var(--color-background))_92%,transparent)_0%,color-mix(in_srgb,var(--fr-hero-overlay,var(--color-background))_72%,transparent)_45%,color-mix(in_srgb,var(--fr-hero-overlay,var(--color-background))_42%,transparent)_100%)]',
};

export function Hero({ element, children, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    eyebrow?: string | null;
    title: string;
    subtitle?: string | null;
    align?: string | null;
    size?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
    mediaSrc?: string | null;
    mediaPosition?: string | null;
    mediaAspect?: string | null;
    actions?: ActionItem[] | null;
    activeAction?: string | null;
    maxWidth?: string | null;
    bg?: string | null;
    gradientFrom?: string | null;
    gradientTo?: string | null;
    accent?: string | null;
    accentText?: string | null;
    color?: string | null;
    mutedColor?: string | null;
    overlayColor?: string | null;
    overlayOpacity?: string | null;
  };
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const align = (p.align as 'left' | 'center' | null) ?? 'left';
  const maxWidth = (p.maxWidth as 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined;
  const mediaPosition = (p.mediaPosition as 'end' | 'start' | 'background' | 'none' | null) ?? 'end';
  const actions = Array.isArray(p.actions) ? p.actions : [];
  // Multi-action discriminator: when the host binds `activeAction`, the emit path
  // writes WHICH action fired (its label, else its index) before emitting `commit`
  // so the click can be attributed. No-op setter (byte-identical) when unbound.
  const [, setActiveAction] = useBoundProp<string>(p.activeAction ?? undefined, bindings?.activeAction);
  const emitWith = useIntrinsicEmit(emit, element);
  const src = safeImageSrc(p.mediaSrc);
  const hasGradient = p.gradientFrom != null || p.gradientTo != null;
  const isBackground = mediaPosition === 'background' && src != null;
  // When the band carries a model-supplied surface (solid bg, gradient, or a
  // background image), the copy must read ON that surface — drive it from
  // `--fr-hero-fg` (settable via `color`) defaulting to the light on-fill token,
  // instead of the theme's foreground which only suits the card-token default.
  const hasSurface = p.bg != null || hasGradient || isBackground;
  // The band ALWAYS paints an opaque fill of its own — the three bandClass branches
  // are exact complements — and it hosts arbitrary spec children (catalog slots:['default']),
  // so the surface channel is published from here. Only the FLAT branches qualify:
  //  · a GRADIENT is not a colour. --fr-surface is consumed inside color-mix() by the
  //    muted/sunken/raised derivations, so a gradient there is invalid at computed-value
  //    time — and a var that IS set never falls back to a reader's token, so publishing
  //    nothing genuinely beats publishing something wrong.
  //  · a BACKGROUND PHOTO covers the fill (absolute inset-0, object-cover), so the card
  //    colour underneath is not what any child actually sits on.
  // flatColor is gated the same way, and for the same reason surfaceInk is: surfaceInk
  // returns an AUTHORED colour BEFORE it ever looks at bg, so a colour named on a
  // gradient or photo hero would otherwise pair an ink with a background that is not
  // there, and surfaceMuted would mix against a null ground.
  const flat = !hasGradient && !isBackground;
  const flatBg = flat ? (p.bg ?? null) : null;
  const flatColor = flat ? (p.color ?? null) : null;
  const layout = src != null && (mediaPosition === 'end' || mediaPosition === 'start')
    ? (mediaPosition === 'start' ? 'media-start' : 'media-end')
    : 'stack';

  // Band surface: solid bg (wins when set, per the catalog contract) > gradient
  // (from/to) > the card token. All conditional override classes, so an unset
  // band keeps the token default. The gradient class MUST be gated off when `bg`
  // is set: `[background:…]` and `[background-image:…]` are different tw-merge
  // groups (no dedupe) and background-image paints over the color, so co-adding
  // both would let the gradient win and make `bg` inert.
  const bandClass = cn(
    heroBand({ size }),
    !p.bg && !hasGradient && 'bg-card',
    // that branch REPAINTS with no authored bg, so it resets the channel to the token
    // it actually paints rather than leaving an outer surface described. Byte-identical:
    // republishing var(--color-card) is what the unpublished chain already resolved to.
    !p.bg && !hasGradient && !isBackground && '[--fr-surface:var(--color-card)] [--fr-surface-fg:var(--color-card-foreground)] [--fr-surface-muted:var(--color-muted-foreground)] [--fr-surface-sunken:var(--color-muted)] [--fr-surface-raised:var(--color-card)] [--fr-surface-field:var(--color-card)]',
    p.bg != null && '[background:var(--fr-hero-bg,var(--color-card))]',
    hasGradient && p.bg == null && '[background-image:linear-gradient(135deg,var(--fr-hero-from,var(--color-muted)),var(--fr-hero-to,var(--color-card)))]',
    // Closed Font enum → a static font-* utility on the band root; the whole hero
    // inherits it. Unset/unknown → undefined → dropped (theme font, byte-identical).
    fontClass(p.font),
  );
  const bandStyle = styleVars(
    { var: '--fr-hero-bg', value: p.bg, kind: 'color' },
    { var: '--fr-surface', value: flatBg, kind: 'color' },
    { var: '--fr-surface-fg', value: surfaceInk(flatBg, flatColor) as string, kind: 'raw' },
    { var: '--fr-surface-muted', value: surfaceMuted(flatBg, flatColor) as string, kind: 'raw' },
    { var: '--fr-surface-sunken', value: surfaceSunken(flatBg) as string, kind: 'raw' },
    { var: '--fr-surface-raised', value: surfaceRaised(flatBg) as string, kind: 'raw' },
    { var: '--fr-surface-field', value: surfaceField(flatBg) as string, kind: 'raw' },
    { var: '--fr-hero-from', value: p.gradientFrom, kind: 'color' },
    { var: '--fr-hero-to', value: p.gradientTo, kind: 'color' },
    { var: '--fr-hero-accent', value: p.accent, kind: 'color' },
    { var: '--fr-hero-fg', value: p.color, kind: 'color' },
    { var: '--fr-hero-muted', value: p.mutedColor, kind: 'color' },
    // Background-media scrim tint — cascades to the scrim div; token
    // fallback INSIDE the reader class = the prior background wash (byte-identical).
    { var: '--fr-hero-overlay', value: p.overlayColor, kind: 'color' },
    // exact headline size → --fr-hero-fs wins over the size-enum default var.
    { var: '--fr-hero-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
  );
  // Single source of the copy color (no `text-foreground` in the cva base — an
  // arbitrary [color:…] and a `text-*` utility are NOT deduped by tailwind-merge,
  // so the base would win). On a surface → light on-fill default; else the theme fg.
  //
  // Token fallback KEPT (not currentColor) in BOTH branches. hasSurface===false is
  // exactly the branch where `bandClass` adds `bg-card` (see above: the two
  // conditions are complements), so the band always paints an OPAQUE surface of
  // its own, and an authored Card sets --fr-card-bg, never --color-card — the band
  // stays #ffffff inside a dark card. Measured there: token 17.72:1, inherited
  // 1.25:1. The hasSurface branch is the band's own paint (a solid bg, a gradient,
  // or the scrim over a background photo), which is arbitrary MEDIA — the copy
  // belongs to the scrim, not to the page it sits on.
  const titleColor = hasSurface
    ? '[color:var(--fr-hero-fg,var(--color-primary-foreground))]'
    : '[color:var(--fr-hero-fg,var(--color-foreground))]';

  const copy = (
    <div className={cn(heroCopy({ align }))}>
      {p.eyebrow != null && (
        <span className="text-xs font-semibold uppercase tracking-wide [color:var(--fr-hero-accent,var(--color-primary))]">
          {p.eyebrow}
        </span>
      )}
      <h1 className={cn(heroTitle({ size }), titleColor, weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}>{p.title}</h1>
      {p.subtitle != null && (
        <p className={cn('m-0 max-w-prose text-[1.0625rem] leading-relaxed', hasSurface ? cn(titleColor, 'opacity-80') : '[color:var(--fr-hero-muted,var(--color-muted-foreground))]')}>{p.subtitle}</p>
      )}
      {children != null && <div className="w-full">{children}</div>}
      {actions.length > 0 && (
        <div className={cn('mt-2 flex flex-wrap gap-3', align === 'center' && 'justify-center')}>
          {actions.map((action, i) => (
            <ActionButton
              key={i}
              action={action}
              primary={i === 0}
              accent={p.accent}
              accentText={p.accentText}
              surfaceFgVar={hasSurface ? '--fr-hero-fg' : null}
              onPress={() => {
                setActiveAction(action.label ?? String(i));
                emitWith('commit', { label: action.label ?? null, index: i, href: action.href ?? null });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );

  const media =
    src != null && !isBackground ? (
      <div className="min-w-0 flex-1">
        <SafeImage
          className={cn('h-full max-h-[28rem] w-full rounded-frayme object-cover', aspectClass(p.mediaAspect))}
          src={src}
          alt=""
          fallback={null}
        />
      </div>
    ) : null;

  return (
    <section className={bandClass} style={bandStyle}>
      {isBackground && (
        <>
          <SafeImage className="absolute inset-0 h-full w-full object-cover" src={src} alt="" ariaHidden fallback={null} />
          {/* Scrim: overlayColor tint + overlayOpacity percentage. The
              `medium` default computes to the exact prior bg-background/60 wash,
              so an unset background hero is byte-identical. */}
          <div className={cn('absolute inset-0', HERO_OVERLAY_OPACITY[p.overlayOpacity ?? 'medium'] ?? HERO_OVERLAY_OPACITY.medium)} aria-hidden />
        </>
      )}
      <div className={cn(heroInner({ maxWidth, layout }), isBackground && 'relative')}>
        {copy}
        {media}
      </div>
    </section>
  );
}

/* ── CTA ──────────────────────────────────────────────────────────────────── */

/* Every variant paints an OPAQUE surface of its own — banner/split fill
   --fr-cta-surface (--color-muted by default), card fills bg-card — which is why
   the h2/description below KEEP `var(--color-foreground)` as their last resort
   instead of inheriting. An authored Card sets --fr-card-bg / --fr-card-fg, never
   --color-muted or --color-card, so this band is still #f4f4f5 / #ffffff inside a
   dark card: token 16.12:1 / 17.72:1 vs inherited 1.14:1 / 1.25:1. */
const ctaBand = cva('w-full [--fr-cta-surface:var(--color-muted)]', {
  variants: {
    variant: {
      banner: 'rounded-2xl px-6 py-10 [background:var(--fr-cta-surface)] md:px-10',
      // Borders & shape parity: the bare `border border-border` becomes an
      // explicit `border-solid` + an exact-width var-chain (--fr-cta-bw, default
      // 1px so `borderWidthValue` can win) + a border-color var-chain (token
      // fallback INSIDE the var = the prior border-border, byte-identical unset).
      // This is the SOLE border-color source: the tone compound variants set
      // `--fr-cta-border` to the tone token, and the renderer sets it inline from a
      // model `borderColor` (inline wins). No competing `border-{tone}` utility.
      card: 'rounded-2xl border-solid [border-width:var(--fr-cta-bw,1px)] [border-color:var(--fr-cta-border,var(--color-border))] bg-card px-6 py-10 shadow-sm md:px-10',
      split: 'rounded-2xl px-6 py-8 [background:var(--fr-cta-surface)] md:px-10',
    },
    tone: {
      neutral: '[--fr-cta-surface:var(--color-muted)]',
      success: '[--fr-cta-surface:color-mix(in_srgb,var(--frayme-success)_12%,transparent)]',
      warning: '[--fr-cta-surface:color-mix(in_srgb,var(--frayme-warning)_12%,transparent)]',
      critical: '[--fr-cta-surface:color-mix(in_srgb,var(--frayme-danger)_12%,transparent)]',
      info: '[--fr-cta-surface:color-mix(in_srgb,var(--frayme-info)_12%,transparent)]',
    },
  },
  // `card` keeps its bg-card surface — tone tints only the banner/split fill. A tone
  // sets the border COLOUR through the SAME `--fr-cta-border` var the base card
  // class already reads — NOT a `border-{tone}` utility. (NEW-3 fix: a `border-info`
  // utility does NOT tw-merge-dedupe against the base `[border-color:var(--fr-cta-
  // border,…)]` arbitrary property — they're different groups — so it would win by
  // stylesheet source order and swallow a model `borderColor`.) Routing the tone
  // through the var keeps ONE border-color source with a clean precedence: unset →
  // `var(--color-border)` token; tone set → the tone token (class-set var); model
  // `borderColor` → the inline var (inline always beats a class-set custom
  // property, so it wins over the tone). `var(--color-{tone})` is exactly what the
  // old `border-{tone}` utility resolved to → byte-identical for the tone case.
  compoundVariants: [
    { variant: 'card', tone: 'success', class: '[--fr-cta-border:var(--color-success)]' },
    { variant: 'card', tone: 'warning', class: '[--fr-cta-border:var(--color-warning)]' },
    { variant: 'card', tone: 'critical', class: '[--fr-cta-border:var(--color-danger)]' },
    { variant: 'card', tone: 'info', class: '[--fr-cta-border:var(--color-info)]' },
  ],
  defaultVariants: { variant: 'banner', tone: 'neutral' },
});
const ctaLayout = cva('mx-auto flex w-full max-w-5xl gap-6', {
  variants: {
    variant: { banner: 'flex-col', card: 'flex-col', split: 'flex-col md:flex-row md:items-center md:justify-between' },
    align: { left: 'items-start text-left', center: 'items-center text-center' },
  },
  // split forces a left copy block regardless of `align` (actions sit right).
  compoundVariants: [{ variant: 'split', align: 'center', class: 'md:items-center' }],
  defaultVariants: { variant: 'banner', align: 'center' },
});

export function CTA({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title: string;
    description?: string | null;
    variant?: string | null;
    align?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
    tone?: string | null;
    actions?: ActionItem[] | null;
    activeAction?: string | null;
    bg?: string | null;
    accent?: string | null;
    accentText?: string | null;
    color?: string | null;
    mutedColor?: string | null;
    borderColor?: string | null;
    borderStyle?: string | null;
    borderWidthValue?: string | number | null;
  };
  const variant = (p.variant as 'banner' | 'card' | 'split' | null) ?? 'banner';
  const align = (p.align as 'left' | 'center' | null) ?? (variant === 'split' ? 'left' : 'center');
  const tone = (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined;
  const actions = Array.isArray(p.actions) ? p.actions : [];
  // Multi-action discriminator: when the host binds `activeAction`, the emit path
  // writes WHICH action fired (its label, else its index) before emitting `commit`
  // so the click can be attributed. No-op setter (byte-identical) when unbound.
  const [, setActiveAction] = useBoundProp<string>(p.activeAction ?? undefined, bindings?.activeAction);
  const emitWith = useIntrinsicEmit(emit, element);
  // A model `bg` repaints the banner/split surface → the copy must read on it.
  const hasSurface = p.bg != null && variant !== 'card';

  const isCard = variant === 'card';
  const bandClass = cn(
    ctaBand({ variant, tone }),
    // A model `bg` overrides the tone/token surface (banner/split only — card
    // keeps its bordered card surface for legibility). In-var muted-token
    // fallback: an INVALID bg (var omitted by styleVars) keeps a visible
    // surface instead of going transparent under the on-surface palette.
    hasSurface && '[background:var(--fr-cta-bg,var(--color-muted))]',
    // (NEW-3) No conditional border-color override needed: the base `card` recipe
    // class is the single border-color reader, and a model `borderColor` flows in
    // via the inline `--fr-cta-border` var (set below), which beats the class-set
    // tone var. Re-asserting the same arbitrary property here was a no-op that
    // couldn't win over the old `border-{tone}` utility anyway — now removed.
    // Card-variant border-style enum (bordered card only): dedupes against the
    // recipe's `border-solid` (same group), so unset stays solid.
    isCard && borderStyleClass(p.borderStyle),
    // Closed Font enum → a static font-* utility on the band root; the whole band
    // inherits it. Unset/unknown → undefined → dropped (theme font, byte-identical).
    fontClass(p.font),
  );
  const bandStyle = styleVars(
    { var: '--fr-cta-bg', value: p.bg, kind: 'color' },
    { var: '--fr-cta-accent', value: p.accent, kind: 'color' },
    { var: '--fr-cta-fg', value: p.color, kind: 'color' },
    { var: '--fr-cta-muted', value: p.mutedColor, kind: 'color' },
    // Card-variant border colour + exact thickness — only the card
    // variant reads these vars (its recipe applies the border-color/-width
    // chains); the width var default is 1px so unset stays byte-identical.
    { var: '--fr-cta-border', value: isCard ? p.borderColor : null, kind: 'color' },
    { var: '--fr-cta-bw', value: isCard ? p.borderWidthValue : null, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
    // exact title size → --fr-cta-fs wins over the baked 1.5rem fallback.
    { var: '--fr-cta-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
  );

  return (
    <div className={bandClass} style={bandStyle}>
      <div className={cn(ctaLayout({ variant, align }))}>
        <div className={cn('flex min-w-0 flex-col gap-1.5', align === 'center' && variant !== 'split' && 'items-center')}>
          <h2 className={cn('m-0 [font-size:var(--fr-cta-fs,1.5rem)] font-semibold leading-tight', hasSurface ? '[color:var(--fr-cta-accent,var(--fr-cta-fg,var(--color-primary-foreground)))]' : '[color:var(--fr-cta-accent,var(--color-foreground))]', weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}>
            {p.title}
          </h2>
          {p.description != null && (
            <p className={cn('m-0 max-w-prose text-[0.9375rem]', hasSurface ? '[color:var(--fr-cta-fg,var(--color-primary-foreground))] opacity-80' : '[color:var(--fr-cta-muted,var(--color-muted-foreground))]')}>{p.description}</p>
          )}
        </div>
        {actions.length > 0 && (
          <div className={cn('flex flex-wrap gap-3', align === 'center' && variant !== 'split' && 'justify-center')}>
            {actions.slice(0, 2).map((action, i) => (
              <ActionButton
                key={i}
                action={action}
                primary={i === 0}
                accent={p.accent}
                accentText={p.accentText}
                surfaceFgVar={hasSurface ? '--fr-cta-fg' : null}
                onPress={() => {
                  setActiveAction(action.label ?? String(i));
                  emitWith('commit', { label: action.label ?? null, index: i, href: action.href ?? null });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── FeatureGrid ──────────────────────────────────────────────────────────── */

const featureGrid = cva(
  'grid w-full [grid-template-columns:repeat(var(--fr-fgrid-cols,3),minmax(0,1fr))] max-[640px]:!grid-cols-1',
  {
    variants: {
      gap: { none: 'gap-0', sm: 'gap-3', md: 'gap-6', lg: 'gap-8', xl: 'gap-10' },
    },
    defaultVariants: { gap: 'md' },
  },
);

type FeatureItem = { icon?: string | null; title?: string | null; description?: string | null };

export function FeatureGrid({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    columns?: string | number | null;
    gap?: string | null;
    align?: string | null;
    variant?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
    borderStyle?: string | null;
    borderWidthValue?: string | number | null;
    features?: FeatureItem[] | null;
    accent?: string | null;
    iconBg?: string | null;
    borderColor?: string | null;
    color?: string | null;
    mutedColor?: string | null;
    // the semantic rank of EVERY generated card `title` in the page outline.
    titleLevel?: string | number | null;
  };
  const align = (p.align as 'start' | 'center' | null) ?? undefined;
  const variant = (p.variant as 'plain' | 'bordered' | 'elevated' | null) ?? undefined;
  const features = Array.isArray(p.features) ? p.features : [];
  // Container-level CASCADE: set the leaf's accent/border/text vars on the grid
  // root. FeatureCardInner reads `--fr-fcard-accent` (icon), the border-colour +
  // border-width var-chains, and the title font-size var-chain, so CSS
  // custom-property INHERITANCE applies them uniformly to every rendered card
  // (each card can still override via its own prop). Omitted when unset → the
  // card's token default wins (byte-identical). The class-based channels
  // (font/weight/tracking/leading/borderStyle) cannot cascade as vars, so they
  // are PROP-THREADED into each generated card instead — completing the
  // uniform-styling group the `variant`/`weight` threading started.
  const style = styleVars(
    {
      var: '--fr-fgrid-cols',
      value: p.columns,
      kind: 'dim',
      opts: { kind: 'count', min: 1, max: 4 },
    },
    { var: '--fr-fcard-accent', value: p.accent, kind: 'color' },
    // uniform icon-chip fill — inherited by every generated card's chip.
    { var: '--fr-fcard-iconbg', value: p.iconBg, kind: 'color' },
    { var: '--fr-fcard-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-fcard-fg', value: p.color, kind: 'color' },
    { var: '--fr-fcard-muted', value: p.mutedColor, kind: 'color' },
    // uniform exact border thickness — read by each bordered/elevated card.
    { var: '--fr-fcard-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
    // uniform exact title font-size — read by each card title.
    { var: '--fr-fcard-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
  );
  return (
    <div className={cn(featureGrid({ gap: (p.gap as 'none' | 'sm' | 'md' | 'lg' | 'xl' | null) ?? undefined }))} style={style}>
      {features.length > 0
        ? features.map((f, i) => (
            <FeatureCardInner
              key={i}
              icon={f?.icon}
              title={f?.title ?? ''}
              description={f?.description}
              font={p.font}
              weight={p.weight}
              tracking={p.tracking}
              leading={p.leading}
              borderStyle={p.borderStyle}
              variant={variant}
              align={align}
              titleLevel={p.titleLevel}
            />
          ))
        : children}
    </div>
  );
}

/* ── FeatureCard ──────────────────────────────────────────────────────────── */

const featureCard = cva(
  'flex h-full flex-col gap-2 rounded-frayme p-5 text-inherit no-underline transition-colors',
  {
    variants: {
      variant: {
        plain: '',
        // Borders & shape: the bare `border` (1px solid) is replaced by an
        // explicit `border-solid` + an exact-width var-chain so `borderWidthValue`
        // (--fr-fcard-bw) can win; `border-style` then dedupes via borderStyleClass
        // and the width var defaults to 1px → byte-identical when unset. border-color
        // is the gate's [border-color:var(--fr-fcard-border,var(--color-border))] as the
        // SOLE source — NO baked border-border, which would NOT dedupe vs the arbitrary
        // class and would win source-order, making borderColor + the FeatureGrid cascade
        // inert. The var's token fallback keeps the unset case byte-identical.
        bordered: 'border-solid [border-width:var(--fr-fcard-bw,1px)]',
        elevated: 'border-solid [border-width:var(--fr-fcard-bw,1px)] bg-card shadow-sm',
      },
      align: { start: 'items-start text-left', center: 'items-center text-center' },
      interactive: { true: 'cursor-pointer outline-none hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/60 focus-visible:ring-2 focus-visible:ring-primary/50', false: '' },
    },
    defaultVariants: { variant: 'plain', align: 'start', interactive: false },
  },
);
// The chip FILL reads the `iconBg` value channel (`--fr-fcard-iconbg`) with the
// prior `bg-muted` token as the in-var fallback — a background group-form
// arbitrary utility is the SOLE fill source (no baked `bg-muted`, which would NOT
// dedupe against it and would win source-order, making the channel inert). Unset
// → the token fallback computes the exact prior muted chip (byte-identical), and
// an inherited `--fr-fcard-iconbg` set on a FeatureGrid container cascades in.
const featureIcon = cva(
  'inline-flex h-10 w-10 items-center justify-center rounded-frayme [background:var(--fr-fcard-iconbg,var(--fr-surface-sunken,var(--color-muted)))] [color:var(--fr-fcard-accent,var(--color-primary))]',
);

/** Shared inner used both as a standalone card and by FeatureGrid's data path. */
function FeatureCardInner({
  icon,
  title,
  description,
  font,
  weight,
  tracking,
  leading,
  fontSize,
  href,
  external,
  variant,
  align,
  accent,
  iconBg,
  borderColor,
  borderStyle,
  borderWidthValue,
  color,
  mutedColor,
  titleLevel,
  onPress,
}: {
  icon?: string | null;
  title: string;
  description?: string | null;
  font?: string | null;
  weight?: string | null;
  tracking?: string | null;
  leading?: string | null;
  fontSize?: string | number | null;
  href?: string | null;
  external?: boolean | null;
  variant?: 'plain' | 'bordered' | 'elevated' | null;
  align?: 'start' | 'center' | null;
  accent?: string | null;
  iconBg?: string | null;
  borderColor?: string | null;
  borderStyle?: string | null;
  borderWidthValue?: string | number | null;
  color?: string | null;
  mutedColor?: string | null;
  titleLevel?: string | number | null;
  onPress?: () => void;
}): ReactNode {
  const interactive = href != null || onPress != null;
  // Outline rank of the card title — authored, because only the spec knows what
  // sits above the grid. Unset → h3, and the default deliberately did NOT follow
  // Card to h2: feature-card titles are almost always sibling cards in one grid
  // (they move together) under a section h2 or h3 — correct at h3 — and only
  // rarely sit directly under the PageHeader h1 (h1→h3, a skip). h2 would repair
  // the rare case and outrank the section heading of the common one. A
  // FeatureCard is CONTENT inside a frame, not a frame; the rare case is what
  // this prop is for.
  const TitleTag = headingTag(titleLevel, 'h3');
  const hasBorder = variant === 'bordered' || variant === 'elevated';
  /* INHERITED FOREGROUND. `plain` and `bordered` paint NO fill — the recipe base
     is already `text-inherit`, i.e. the card takes BOTH its surface and its ink
     from whatever contains it — and then the title RESET the ink to the global
     token. That is the traced defect verbatim. Measured inside the authored card
     the trace came from (Card bg:#12161f color:#e2e6f0), with the DOM probed
     rather than assumed (the title is the one node in this card that paints from
     this chain; the description paints from --fr-fcard-muted):
         var(--color-foreground) #18181b on #12161f →  1.02:1
         currentColor            #e2e6f0 on #12161f → 14.49:1
     `elevated` KEEPS the token: it paints `bg-card`, and an authored Card sets
     --fr-card-bg / --fr-card-fg (never --color-card), so that slab is still
     #ffffff inside a dark card — token 17.72:1, inherited 1.25:1, the same bug
     pointing the other way.
     currentColor is byte-identical at the top level: frayme.css points BOTH
     `.frayme-root { color }` and --color-foreground at --frayme-fg, and on the
     `color` property currentColor computes to the INHERITED value (no cycle). */
  const titleColor =
    variant === 'elevated'
      ? '[color:var(--fr-fcard-fg,var(--color-foreground))]'
      : '[color:var(--fr-fcard-fg,currentColor)]';
  const className = cn(
    featureCard({ variant: variant ?? undefined, align: align ?? undefined, interactive: interactive as true | false }),
    // Border-colour var-chain (bordered/elevated only). Applied whenever the card
    // hasBorder — not gated on a per-card borderColor — so an INHERITED
    // `--fr-fcard-border` set by a FeatureGrid container cascades in. The token
    // fallback (var(--fr-fcard-border,var(--color-border))) keeps it byte-identical
    // to the recipe's `border-border` for a standalone card with the var unset, and
    // the arbitrary class (added last) dedupe-wins the border-color group.
    hasBorder && '[border-color:var(--fr-fcard-border,var(--color-border))]',
    // Border-style enum (bordered/elevated only): dedupes against the recipe's
    // `border-solid` (same border-style group), so the recipe default stays solid
    // when unset and the enum wins when set.
    hasBorder && borderStyleClass(borderStyle),
    // Closed Font enum → a static font-* utility on the card root; the whole card
    // inherits it. Unset/unknown → undefined → dropped (theme font, byte-identical).
    fontClass(font),
  );
  const style = styleVars(
    { var: '--fr-fcard-accent', value: accent, kind: 'color' },
    { var: '--fr-fcard-iconbg', value: iconBg, kind: 'color' },
    { var: '--fr-fcard-border', value: borderColor, kind: 'color' },
    // Exact border thickness (bordered/elevated only): feeds the width var-chain
    // in the recipe; omitted/invalid → the 1px var default wins (byte-identical).
    { var: '--fr-fcard-bw', value: hasBorder ? borderWidthValue : null, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
    { var: '--fr-fcard-fg', value: color, kind: 'color' },
    { var: '--fr-fcard-muted', value: mutedColor, kind: 'color' },
    // exact title size → --fr-fcard-fs wins over the baked 1rem fallback.
    { var: '--fr-fcard-fs', value: fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
  );
  const body = (
    <>
      {icon != null && (
        <span className={cn(featureIcon())} aria-hidden>
          <Icon name={icon} size={20} />
        </span>
      )}
      {/* fontSize single source: the baked text-base folds into the var fallback
          (byte-identical when unset — text-base bundles line-height 1.5, kept via
          the explicit leading-normal); an exact fontSize wins via the var. */}
      {/* The card title wraps: a feature card is a COLUMN with no fixed row height, so
          the ellipsis bought no alignment and deleted the feature's name. The
          description keeps its DECLARED three-line budget (+ break-words so a long
          token cannot widen the card). */}
      <TitleTag className={cn('m-0 w-full max-w-full break-words [font-size:var(--fr-fcard-fs,1rem)] leading-normal font-semibold', titleColor, weightClass(weight), trackingClass(tracking), leadingClass(leading))} title={title || undefined}>{title}</TitleTag>
      {description != null && <p className="m-0 line-clamp-3 break-words text-sm leading-relaxed [color:var(--fr-fcard-muted,var(--color-muted-foreground))]" title={description}>{description}</p>}
    </>
  );
  if (href != null) {
    return (
      <a className={className} href={safeUrl(href)} {...linkTargetRel(external === true)} style={style}>
        {body}
      </a>
    );
  }
  if (onPress != null) {
    return (
      <button type="button" className={cn(className, 'text-left')} style={style} onClick={onPress}>
        {body}
      </button>
    );
  }
  return (
    <div className={className} style={style}>
      {body}
    </div>
  );
}

export function FeatureCard({ element, emit }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    icon?: string | null;
    title: string;
    description?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
    href?: string | null;
    external?: boolean | null;
    variant?: string | null;
    align?: string | null;
    accent?: string | null;
    iconBg?: string | null;
    borderColor?: string | null;
    borderStyle?: string | null;
    borderWidthValue?: string | number | null;
    color?: string | null;
    mutedColor?: string | null;
    // the semantic rank of `title` in the page outline.
    titleLevel?: string | number | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  return (
    <FeatureCardInner
      icon={p.icon}
      title={p.title ?? ''}
      description={p.description}
      font={p.font}
      weight={p.weight}
      tracking={p.tracking}
      leading={p.leading}
      fontSize={p.fontSize}
      href={p.href}
      external={p.external}
      variant={(p.variant as 'plain' | 'bordered' | 'elevated' | null) ?? undefined}
      align={(p.align as 'start' | 'center' | null) ?? undefined}
      accent={p.accent}
      iconBg={p.iconBg}
      borderColor={p.borderColor}
      borderStyle={p.borderStyle}
      borderWidthValue={p.borderWidthValue}
      color={p.color}
      mutedColor={p.mutedColor}
      titleLevel={p.titleLevel}
      onPress={p.href != null ? undefined : () => emitWith('commit', { label: p.title ?? null })}
    />
  );
}

/* ── LogoCloud ────────────────────────────────────────────────────────────── */

const logoRow = cva(
  'grid w-full place-items-center items-center gap-x-10 gap-y-6 [grid-template-columns:repeat(var(--fr-logos-cols,5),minmax(0,1fr))] max-[640px]:!grid-cols-3 max-[400px]:!grid-cols-2',
);
// Pattern-A var-chain for the logo height: the `size` enum sets a DEFAULT var
// (not an h-* utility, which would NOT dedupe against an arbitrary height class),
// and the base reads it through the exact-override var. h-6=1.5rem, h-8=2rem,
// h-12=3rem reproduced exactly, so a props-less/unset spec is byte-identical;
// `height` (--fr-logos-h) wins when set. Width stays auto for aspect.
const logoImg = cva('w-auto max-w-full object-contain [height:var(--fr-logos-h,var(--fr-logos-h-default,2rem))]', {
  variants: {
    size: { sm: '[--fr-logos-h-default:1.5rem]', md: '[--fr-logos-h-default:2rem]', lg: '[--fr-logos-h-default:3rem]' },
    grayscale: { true: 'opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0', false: '' },
  },
  defaultVariants: { size: 'md', grayscale: true },
});
// The failed-logo alt-text fallback is the same muted-text role as the heading:
// it reads --fr-logos-muted (set on the root) with the token fallback, so a set
// mutedColor catches fallback logos too.
const logoFallback = cva('inline-flex items-center justify-center font-semibold [color:var(--fr-logos-muted,var(--color-muted-foreground))]', {
  variants: {
    size: { sm: 'h-6 text-sm', md: 'h-8 text-base', lg: 'h-12 text-lg' },
  },
  defaultVariants: { size: 'md' },
});

type LogoItem = { src?: string | null; alt?: string | null; href?: string | null };

export function LogoCloud({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    items?: LogoItem[] | null;
    title?: string | null;
    columns?: string | number | null;
    grayscale?: boolean | null;
    size?: string | null;
    height?: string | number | null;
    mutedColor?: string | null;
  };
  const items = Array.isArray(p.items) ? p.items : [];
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const grayscale = (p.grayscale ?? true) as true | false;
  const colsStyle = styleVars(
    {
      var: '--fr-logos-cols',
      value: p.columns,
      kind: 'dim',
      opts: { kind: 'count', min: 2, max: 8 },
    },
    // Exact logo height (Pattern A): set on the row so it cascades into each
    // logo img/fallback's height var-chain; omitted when unset/invalid so the
    // `size` enum default wins (byte-identical). Width stays auto.
    {
      var: '--fr-logos-h',
      value: p.height,
      kind: 'dim',
      opts: { units: ['px', 'rem'], min: 12, max: 96 },
    },
  );
  const mutedStyle = styleVars({ var: '--fr-logos-muted', value: p.mutedColor, kind: 'color' });
  return (
    <div className="flex w-full flex-col items-center gap-6" style={mutedStyle}>
      {p.title != null && (
        <span className="text-xs font-semibold uppercase tracking-wide [color:var(--fr-logos-muted,var(--color-muted-foreground))]">{p.title}</span>
      )}
      <div className={cn(logoRow())} style={colsStyle}>
        {items.map((item, i) => {
          const alt = item?.alt ?? '';
          const inner = (
            <SafeImage
              className={cn(logoImg({ size, grayscale }))}
              src={item?.src}
              alt={alt}
              fallback={<span className={cn(logoFallback({ size }))}>{alt}</span>}
            />
          );
          if (item?.href != null) {
            return (
              <a
                key={i}
                href={safeUrl(item.href)}
                className="inline-flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label={alt || undefined}
              >
                {inner}
              </a>
            );
          }
          return (
            <span key={i} className="inline-flex items-center justify-center">
              {inner}
            </span>
          );
        })}
      </div>
    </div>
  );
}
