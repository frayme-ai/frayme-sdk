'use client';
import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { safeUrl, linkTargetRel } from './url-safety.js';
import { styleVars, fontClass, weightClass, trackingClass, leadingClass, surfaceField, surfaceInk, surfaceMuted, surfaceRaised, surfaceSunken } from './_style.js';
import { Icon, hasIcon } from './icons.js';

/* Catalog group (data-display-extended): Tag, ListItem, PageHeader, Stat,
 * EmptyState, ErrorState.
 *
 * Same truly-dynamic contract as the shipped 36:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (colors the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities. The class set stays a
 *     closed, build-time set (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing/absent
 *     value so the token fallback wins (props-less → polished).
 *
 * value > enum precedence (Tag `bg`/`color` over tone/variant): the CONDITIONAL
 * override class — the `[background:var(--fr-…)]` utility is only added to cn()
 * when the model supplied that value (`p.bg != null`), so the enum class wins
 * when absent and the var wins when present (added LAST → tailwind-merge keeps it).
 *
 * Icons are NAMES resolved against the closed `icons.ts` registry (never raw
 * SVG; unknown/null name → nothing). URLs are guarded at point-of-use
 * (safeUrl + linkTargetRel for the external boolean). The Stat sparkline is OUR
 * own <polyline> drawn from a numeric data array — never spec markup.
 */

/** State-panel title tag. A panel has no way to know its own depth in the page,
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

/* ── Tag ──────────────────────────────────────────────────────────────────── */

// font-size is a VAR-CHAIN (same shape as PageHeader/Stat): each size step sets
// the DEFAULT font-size var (no text-* utility — the bare arbitrary font-size rule
// would LOSE to text-* by stylesheet order), and the base reads the exact-override
// var with the per-size default as its fallback. xs=0.75rem · sm=0.875rem, so a
// props-less / fontSize-unset chip is byte-identical; leading-none (baked) keeps
// line-height 1 with or without the old text-* line-height pairing.
const tag = cva('inline-flex items-center gap-1.5 font-medium leading-none [font-size:var(--fr-tag-fs,var(--fr-tag-fs-default,0.75rem))]', {
  variants: {
    variant: {
      solid: 'border border-transparent',
      soft: 'border border-transparent',
      outline: 'border bg-transparent',
    },
    tone: {
      neutral: '',
      success: '',
      warning: '',
      critical: '',
      info: '',
    },
    size: {
      sm: 'px-2 py-0.5 [--fr-tag-fs-default:0.6875rem]',
      md: 'px-2.5 py-1 [--fr-tag-fs-default:0.75rem]',
      lg: 'px-3 py-1.5 [--fr-tag-fs-default:0.875rem]',
    },
    shape: { pill: 'rounded-full', rounded: 'rounded-frayme', square: 'rounded-none' },
  },
  // tone × variant define the fill/text — solid = full token bg, soft = tinted,
  // outline = token border + text. No `danger`/`destructive`: `critical` IS the
  // danger sense (unified vocab). A model-named `bg`/`color` overrides via the
  // conditional class in the render.
  compoundVariants: [
    // solid
    { variant: 'solid', tone: 'neutral', class: 'bg-foreground text-card' },
    { variant: 'solid', tone: 'success', class: 'bg-success text-success-foreground' },
    { variant: 'solid', tone: 'warning', class: 'bg-warning text-warning-foreground' },
    { variant: 'solid', tone: 'critical', class: 'bg-danger text-danger-foreground' },
    { variant: 'solid', tone: 'info', class: 'bg-info text-info-foreground' },
    // soft (tinted)
    { variant: 'soft', tone: 'neutral', class: 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-[color:var(--fr-surface-fg,var(--color-foreground))]' },
    { variant: 'soft', tone: 'success', class: '[background:color-mix(in_srgb,var(--frayme-success)_14%,transparent)] text-success' },
    { variant: 'soft', tone: 'warning', class: '[background:color-mix(in_srgb,var(--frayme-warning)_14%,transparent)] text-warning' },
    { variant: 'soft', tone: 'critical', class: '[background:color-mix(in_srgb,var(--frayme-danger)_14%,transparent)] text-danger' },
    { variant: 'soft', tone: 'info', class: '[background:color-mix(in_srgb,var(--frayme-info)_14%,transparent)] text-info' },
    // outline (border + text)
    // `text-inherit`, NOT text-[color:var(--fr-surface-fg,var(--color-foreground))]: `outline` is the one variant that
    // paints NOTHING (bg-transparent above) — its surface is whatever holds the
    // chip. Measured in a spec's `Card { bg:"#12161f", color:"#e2e6f0" }`:
    // rgb(24,24,27) on rgb(18,22,31) = 1.02:1, a chip with a visible border and
    // an invisible word inside it. Inherited it reads 14.49:1, and at the top
    // level `.frayme-root { color }` and --color-foreground are the same
    // --frayme-fg (frayme.css:138), so an un-nested outline chip is unchanged.
    // The `soft`/`solid` neutral rows below/above KEEP their token — they paint
    // an opaque bg-muted / bg-foreground slab, where the card's light ink would
    // be light-on-light (16.12:1 → 1.1:1, the same bug reversed). A SEMANTIC
    // tone (success/warning/critical/info) also stays pinned: it names a meaning,
    // not a surface.
    { variant: 'outline', tone: 'neutral', class: 'border-border text-inherit' },
    { variant: 'outline', tone: 'success', class: 'border-success text-success' },
    { variant: 'outline', tone: 'warning', class: 'border-warning text-warning' },
    { variant: 'outline', tone: 'critical', class: 'border-danger text-danger' },
    { variant: 'outline', tone: 'info', class: 'border-info text-info' },
  ],
  defaultVariants: { variant: 'soft', tone: 'neutral', size: 'md', shape: 'pill' },
});

export function Tag({ element, emit }: ComponentRenderProps): ReactNode {
  const emitWith = useIntrinsicEmit(emit, element);
  const p = (element.props ?? {}) as {
    label: string;
    icon?: string | null;
    variant?: string | null;
    tone?: string | null;
    size?: string | null;
    shape?: string | null;
    removable?: boolean | null;
    removeLabel?: string | null;
    removeIcon?: string | null;
    bg?: string | null;
    color?: string | null;
    borderColor?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const glyph = p.icon != null ? <Icon name={p.icon} size={13} /> : null;
  // Glyph-name override resolves ONLY through the closed registry; unknown/absent
  // → the default "x" glyph (byte-identical default).
  const removeGlyph = typeof p.removeIcon === 'string' && hasIcon(p.removeIcon) ? p.removeIcon : 'x';
  return (
    <span
      className={cn(
        tag({
          variant: (p.variant as 'solid' | 'soft' | 'outline' | null) ?? undefined,
          tone: (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined,
          size: (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined,
          shape: (p.shape as 'pill' | 'rounded' | 'square' | null) ?? undefined,
        }),
        // Precedence: value > tone (enum) > variant (enum) > token. The override
        // class is only added when the model named the value, so an unset value
        // lets the tone/variant class win (tailwind-merge keeps the last class).
        p.bg != null && '[background:var(--fr-tag-bg)]',
        // text-[color:…] (text-color group) so the override dedupes with the variant/
        // tone `text-*` and wins (added last); a bare [color:…] arbitrary property does
        // NOT dedupe against a `text-*` utility and would lose the cascade.
        p.color != null && 'text-[color:var(--fr-tag-fg)]',
        // Group form (border-[color:…], NOT the bare [border-color:…] arbitrary
        // property): tw-merge dedupes it against the outline+tone `border-{tone}`
        // compound AND the solid/soft `border-transparent`, so this (added LAST)
        // wins. The bare arbitrary-property form did NOT dedupe those utilities, so
        // a tone/variant border silently swallowed borderColor. Token
        // fallback inside the var → an invalid value keeps the border token.
        p.borderColor != null && 'border border-[color:var(--fr-tag-border,var(--color-border))]',
        // 6i typography channels on the chip root (the label span inherits): same-group
        // utilities placed LAST so a SET value dedupe-wins over the baked font-medium/
        // leading-none; unset → helper returns undefined and cn drops it (byte-identical).
        fontClass(p.font),
        weightClass(p.weight),
        trackingClass(p.tracking),
        leadingClass(p.leading),
      )}
      style={styleVars(
        { var: '--fr-tag-bg', value: p.bg, kind: 'color' },
        { var: '--fr-tag-fg', value: p.color, kind: 'color' },
        { var: '--fr-tag-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-tag-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {glyph}
      {/* A hard max-width never relaxes: the label clipped at 2000px as readily
          as at 320px, which is not space pressure, it is a cap. A tag is short —
          let it size to its text and wrap if it must. No min-w-0 either: the label
          is a LEAF, so its automatic minimum (min-content = longest word) is the
          floor that stops a chip shrinking to a one-character-per-line column;
          break-words stays for the word that genuinely outgrows the chip. */}
      <span className="break-words" title={p.label}>{p.label}</span>
      {p.removable === true && (
        <button
          type="button"
          className="-mr-0.5 ml-0.5 inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-current opacity-70 hover:opacity-100"
          aria-label={p.removeLabel ?? `Remove ${p.label}`}
          onClick={(e) => {
            e.stopPropagation();
            emitWith('dismiss', { label: p.label ?? null });
          }}
        >
          <Icon name={removeGlyph} size={13} />
        </button>
      )}
    </span>
  );
}

/* ── ListItem ─────────────────────────────────────────────────────────────── */

/* The active row reads `accent` (title color + a leading active bar) via a var
   with a primary-token fallback; the override class is conditional on `active`. */
const listItem = cva(
  // flex-wrap + basis-[60%] on the text column below: with the title wrapping
  // instead of clipping, a rigid row let the leading icon and trailing text
  // squeeze the title to nothing — measured at 3px wide and 248px tall, one
  // character per line. A percentage basis gives the title a share it can
  // defend, and the row breaks rather than crushing it.
  'flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 border-0 bg-transparent text-left text-inherit no-underline transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
  {
    variants: {
      size: {
        sm: 'px-2.5 text-sm',
        md: 'px-3',
        lg: 'px-4 text-[1.0625rem]',
      },
      density: {
        compact: 'py-1.5',
        normal: 'py-2.5',
        comfortable: 'py-3.5',
      },
      active: {
        true: 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]/60 [box-shadow:inset_3px_0_0_0_var(--fr-listitem-accent,var(--fr-accent))]',
        false: '',
      },
    },
    defaultVariants: { size: 'md', density: 'normal', active: false },
  },
);

export function ListItem({ element, emit, on }: ComponentRenderProps): ReactNode {
  const emitWith = useIntrinsicEmit(emit, element);
  const p = (element.props ?? {}) as {
    title: string;
    value?: string | null;
    description?: string | null;
    leadingIcon?: string | null;
    trailingText?: string | null;
    badge?: string | null;
    href?: string | null;
    external?: boolean | null;
    active?: boolean | null;
    size?: string | null;
    density?: string | null;
    accent?: string | null;
    mutedColor?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const active = p.active === true;
  const className = cn(
    listItem({
      size: (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined,
      density: (p.density as 'compact' | 'normal' | 'comfortable' | null) ?? undefined,
      active: active as true | false,
    }),
    // value (accent) only matters on the active bar — render the override class
    // when supplied so the var beats the primary-token fallback.
    active && p.accent != null && '[box-shadow:inset_3px_0_0_0_var(--fr-listitem-accent)]',
    // 6i: typeface on the row root — cascades to title/description/meta.
    fontClass(p.font),
  );
  const style = styleVars(
    { var: '--fr-listitem-accent', value: p.accent, kind: 'color' },
    { var: '--fr-listitem-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-listitem-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
  );
  // The row's fields are separate flex children with no text between them, so a
  // name computed from contents concatenates them with nothing in between and
  // the boundaries are lost ("Paddington 2" + "2017 …" → "Paddington 22017").
  // Naming the row explicitly restores the boundaries without adding visible
  // text or changing the markup. One field alone has nothing to fuse with, so it
  // keeps the name-from-contents path (the attribute would be redundant).
  const nameParts = [p.title, p.description, p.trailingText, p.badge].filter(
    (s): s is string => typeof s === 'string' && s.trim() !== '',
  );
  const ariaLabel = nameParts.length > 1 ? nameParts.join(', ') : undefined;
  const inner = (
    <>
      {p.leadingIcon != null && (
        // The leading icon sits WITH the muted text, so it reads the mutedColor
        // chain (token fallback inside the var → unset computes the exact prior
        // muted-foreground). On an ACTIVE row it joins the accent group with the
        // title (nav-menu convention) — same arbitrary color property, so
        // tw-merge keeps the accent reader.
        <span
          className={cn(
            'shrink-0 [color:var(--fr-listitem-muted,var(--color-muted-foreground))]',
            active && '[color:var(--fr-listitem-accent,var(--fr-accent))]',
          )}
          aria-hidden
        >
          <Icon name={p.leadingIcon} size={18} />
        </span>
      )}
      {/* basis-[60%]: flex-1 alone is basis-0, so the column's share is decided
          entirely by what is left after the icon and trailing text take theirs —
          which at narrow widths is nothing. A percentage basis means the title
          claims most of the row up front and the row wraps instead. */}
      <span className="flex min-w-0 flex-1 basis-[60%] flex-col gap-0.5">
        <span
          className={cn(
            // A list row has NO fixed height, so nothing here earns a clipped
            // line: `truncate` is white-space:nowrap, which makes the title one
            // unbreakable line whose box then shrinks under it — at 320px a
            // frequent source of truncation. The title is short; letting it
            // wrap costs a line and keeps the words.
            'break-words font-medium',
            active && 'text-[color:var(--fr-listitem-accent,var(--fr-accent))]',
            // 6i typography channels on the title. The title has NO baked font-size
            // utility (it inherits the row `size` scale), so the exact override is a
            // CONDITIONAL single-declaration class — no var chain needed; unset stays
            // byte-identical (inherited). weight/tracking/leading are same-group
            // utilities placed LAST so a SET value dedupe-wins over font-medium.
            p.fontSize != null && '[font-size:var(--fr-listitem-fs)]',
            weightClass(p.weight),
            trackingClass(p.tracking),
            leadingClass(p.leading),
          )}
          title={p.title}
        >
          {p.title}
        </span>
        {p.description != null && (
          // The description wraps to a DECLARED two-line budget rather than
          // clipping at one: two honest lines beat one ellipsised line, and the
          // clamp keeps a long description from taking over the row.
          <span className="line-clamp-2 break-words text-[0.8125rem] [color:var(--fr-listitem-muted,var(--color-muted-foreground))]" title={p.description}>{p.description}</span>
        )}
      </span>
      {p.trailingText != null && (
        <span className="shrink-0 text-[0.8125rem] tabular-nums [color:var(--fr-listitem-muted,var(--color-muted-foreground))]">{p.trailingText}</span>
      )}
      {p.badge != null && (
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))]',
            // Coherence: a set mutedColor tints the badge chip fill via color-mix
            // (14%) so a tinted row keeps one grey family; mutually-exclusive with
            // the neutral token branch → byte-identical when mutedColor is unset.
            p.mutedColor != null
              ? '[background:color-mix(in_srgb,var(--fr-listitem-muted,var(--color-muted-foreground))_14%,transparent)]'
              : 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
          )}
        >
          {p.badge}
        </span>
      )}
    </>
  );

  // href → navigable <a> (guarded). The spec sets only the `external` boolean;
  // target/rel come from linkTargetRel, never from the spec directly.
  if (p.href != null) {
    const external = p.external === true;
    const press = on('commit');
    return (
      <a
        className={className}
        href={safeUrl(p.href)}
        {...linkTargetRel(external)}
        aria-label={ariaLabel}
        aria-current={active ? 'true' : undefined}
        style={style}
        onClick={(e) => {
          if (press.shouldPreventDefault) e.preventDefault();
          if (press.bound) emitWith('commit', { value: p.value ?? null, label: p.title ?? null, href: p.href ?? null });
        }}
      >
        {inner}
        {external && (
          // the external-link arrow rides the same muted chain as the trailing
          // meta text it sits beside (token fallback → unset byte-identical).
          <span className="shrink-0 [color:var(--fr-listitem-muted,var(--color-muted-foreground))]" aria-hidden>
            <Icon name="arrow-up-right" size={14} />
          </span>
        )}
      </a>
    );
  }

  // No href → an interactive button row that emits `commit`.
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      aria-current={active ? 'true' : undefined}
      style={style}
      onClick={() => emitWith('commit', { value: p.value ?? null, label: p.title ?? null, href: null })}
    >
      {inner}
    </button>
  );
}

/* ── PageHeader ───────────────────────────────────────────────────────────── */

// The accent channel's LAST RESORT is the inherited ink, not the global token.
// A header off a band paints no surface of its own, so its title sits on whatever
// holds it: inside a spec's `Card { bg:"#12161f", color:"#e2e6f0" }` the token
// printed rgb(24,24,27) on rgb(18,22,31) = 1.02:1 — the page title, invisible.
// currentColor there is 14.49:1, and at the top level `.frayme-root { color }`
// and --color-foreground are both --frayme-fg (frayme.css:138), so a header on
// the page's own surface is byte-identical. The BANDED path is untouched: `bg`
// makes styleVars set --fr-pageheader-accent to bandText explicitly, so the band
// still prints its own ink on its own fill (inheriting there would be the same
// bug reversed — the card's light ink on a light band).
const pageHeaderWrap = cva('flex w-full gap-4 [--fr-pageheader-accent:currentColor]', {
  variants: {
    align: {
      start: 'flex-row flex-wrap items-start justify-between',
      center: 'flex-col items-center text-center',
    },
  },
  defaultVariants: { align: 'start' },
});
// font-size is a VAR-CHAIN: the size variant sets the DEFAULT font-size var (no
// text-* / text-[…] utility), and the base reads the exact-override var with the
// per-size default as its fallback. So a props-less / fontSize-unset header is
// byte-identical to the prior text-[…] values, while an exact `fontSize` wins
// with a single declaration (no tw-merge group collision). Spacing is untouched
// (it lives on pageHeaderWrap), so the COMPOUND size enum keeps its spacing.
const pageHeaderTitle = cva(
  'm-0 font-semibold leading-tight [color:var(--fr-pageheader-accent)] [font-size:var(--fr-pageheader-fs,var(--fr-pageheader-fs-default,1.5rem))]',
  {
    variants: {
      size: {
        sm: '[--fr-pageheader-fs-default:1.125rem]',
        md: '[--fr-pageheader-fs-default:1.5rem]',
        lg: '[--fr-pageheader-fs-default:2rem]',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export function PageHeader({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    eyebrow?: string | null;
    title: string;
    description?: string | null;
    align?: string | null;
    size?: string | null;
    fontSize?: string | number | null;
    divider?: boolean | null;
    accent?: string | null;
    bg?: string | null;
    accentText?: string | null;
    mutedColor?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    font?: string | null;
  };
  const align = (p.align as 'start' | 'center' | null) ?? 'start';
  // Brand band: when `bg` is set the header becomes a filled, padded, rounded band
  // and ALL its text switches to `accentText` (default white, for contrast on a dark
  // fill) so it stays legible. Unset → byte-identical to the quiet default header.
  const banded = p.bg != null && p.bg !== '';
  const bandText = banded ? (p.accentText ?? '#ffffff') : null;
  // The surface channel's inputs, gated on `banded` exactly like the fill above. The
  // gate is load-bearing, not decorative: surfaceInk returns an AUTHORED colour BEFORE
  // it looks at `bg`, so an `accentText` named without a `bg` would otherwise hand
  // every descendant an ink with no matching background under it. Unbanded → both null
  // → every entry resolves null → styleVars omits all of them → byte-identical.
  const bandSurface = banded ? p.bg : null;
  const bandInk = banded ? p.accentText : null;
  return (
    <header
      className={cn(
        pageHeaderWrap({ align }),
        // Filled brand band (only when `bg` is set): background + padding + radius.
        banded && '[background:var(--fr-pageheader-bg)] [border-radius:var(--radius-frayme)] px-5 py-4',
        // Optional bottom divider (border-b + pb) separating the header from the
        // page content (shadcn dashboards / Ant PageHeader). Off by default →
        // byte-identical when `divider` is unset. A band is its own separation, so
        // skip the divider when banded.
        p.divider === true && !banded && 'border-b border-border pb-4',
        fontClass(p.font),
      )}
      style={styleVars(
        { var: '--fr-pageheader-bg', value: p.bg, kind: 'color' },
        // On a band, both the title (accent) and the eyebrow/description (muted)
        // channels read the band text colour so everything stays legible on the
        // fill; off a band they keep their normal accent/muted channels unchanged.
        { var: '--fr-pageheader-accent', value: banded ? bandText : p.accent, kind: 'color' },
        { var: '--fr-pageheader-muted', value: banded ? bandText : p.mutedColor, kind: 'color' },
        // ALSO publish the shared surface channel. A band is an OPAQUE fill this header
        // paints and then hosts ARBITRARY spec children on (the action cluster is
        // `children` — whatever the spec put there).
        { var: '--fr-surface', value: bandSurface, kind: 'color' },
        { var: '--fr-surface-fg', value: surfaceInk(bandSurface, bandInk) as string, kind: 'raw' },
        { var: '--fr-surface-muted', value: surfaceMuted(bandSurface, bandInk) as string, kind: 'raw' },
        { var: '--fr-surface-sunken', value: surfaceSunken(bandSurface) as string, kind: 'raw' },
        { var: '--fr-surface-raised', value: surfaceRaised(bandSurface) as string, kind: 'raw' },
        { var: '--fr-surface-field', value: surfaceField(bandSurface) as string, kind: 'raw' },
        { var: '--fr-pageheader-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 12, max: 72 } },
      )}
    >
      {/* Flex line-breaking measures the HYPOTHETICAL size (the 18rem basis), not the
          shrunken one, so a wide action cluster drops to its own line BEFORE the text
          column is squeezed — the narrow fix without reading the viewport. `grow` keeps
          the wide row identical (the column still absorbs the leftover). basis is
          MAIN-axis: start-only, since align:center makes the header a column and a basis
          there would set a height. */}
      <div className={cn('flex min-w-0 flex-col gap-1', align === 'center' ? 'items-center' : 'grow basis-[18rem]')}>
        {p.eyebrow != null && (
          // The eyebrow is the page's breadcrumb/section ("Billing · Invoices"), so
          // it wraps with the title rather than clipping — the header column has no
          // fixed height, and uppercase + tracking-wide make it run out of room
          // FIRST, not last.
          <span className="max-w-full break-words text-xs font-semibold uppercase tracking-wide [color:var(--fr-pageheader-muted,var(--color-muted-foreground))]" title={p.eyebrow}>{p.eyebrow}</span>
        )}
        <h1
          className={cn(
            pageHeaderTitle({ size: (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined }),
            // wrap to 2 lines before ellipsizing — "Week of 3…" hid the identity of the
            // page. break-words is the shear guard: a word longer than the column is
            // clipped mid-glyph by line-clamp ("Suppor") unless it may break.
            'max-w-full line-clamp-2 break-words',
            // 6i typography channels: each is a same-group utility (font-*/tracking-*/leading-*)
            // placed LAST so a SET value dedupe-wins over the baked font-semibold/leading-tight;
            // unset → helper returns undefined and cn drops it (byte-identical default).
            weightClass(p.weight),
            trackingClass(p.tracking),
            leadingClass(p.leading),
          )}
          title={p.title}
        >
          {p.title}
        </h1>
        {p.description != null && (
          <p className="m-0 max-w-prose text-sm [color:var(--fr-pageheader-muted,var(--color-muted-foreground))]">{p.description}</p>
        )}
      </div>
      {/* NOT shrink-0: once wrapped onto its own line a cluster wider than the header
          would push past the card edge instead of folding its own actions. */}
      {children != null && <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

/* ── Stat ─────────────────────────────────────────────────────────────────── */

// Same chain, same last resort as pageHeaderWrap above: a tile paints no surface,
// so the figure — the one datum the tile exists for — must end in the ink it
// inherits. Measured inside a spec's `Card { bg:"#12161f", color:"#e2e6f0" }`:
// "£48,210" came out rgb(24,24,27) on rgb(18,22,31) = 1.02:1, and every Stat in
// a StatGroup on that card with it. The SPLIT layout has never had the bug — its
// root is not statWrap, so --fr-stat-accent was simply unset there and `color:
// var(--fr-stat-accent)` fell back to inherit (measured 14.49:1). This makes the
// stack layout agree with the split one instead of contradicting it.
// The `accent` prop still wins (styleVars sets the same var), and the sparkline
// chain --fr-stat-spark → --fr-stat-accent follows the figure exactly as before:
// an unset sparklineColor is a mono trend line in the figure's own ink, which was
// equally invisible on the dark card.
const statWrap = cva('flex flex-col gap-1 [--fr-stat-accent:currentColor]', {
  variants: {
    align: { start: 'items-start text-left', center: 'items-center text-center' },
  },
  defaultVariants: { align: 'start' },
});
// font-size is a VAR-CHAIN (same shape as PageHeader): the size variant sets the
// DEFAULT font-size var, the base reads the exact-override var with the per-size
// default as its fallback. props-less / fontSize-unset → byte-identical to the
// prior text-[…] values; an exact `fontSize` wins via one declaration. Tile
// spacing is on statWrap, so the COMPOUND size enum keeps its spacing.
// `tracking-tight` on the figure: a large KPI
// number reads as premium/typeset with slightly condensed spacing rather than the
// default airy tracking — the single most "designed vs default" tell on a metric
// tile, and it costs nothing. An exact `tracking` prop still wins (placed LAST in
// the Stat render's cn), so this is only the new baked default.
const statValue = cva(
  'font-semibold leading-tight tracking-tight tabular-nums [color:var(--fr-stat-accent)] [font-size:var(--fr-stat-fs,var(--fr-stat-fs-default,2rem))]',
  {
    variants: {
      size: {
        sm: '[--fr-stat-fs-default:1.5rem]',
        md: '[--fr-stat-fs-default:2rem]',
        lg: '[--fr-stat-fs-default:2.75rem]',
      },
      // A stack tile's value is the hero (2rem); a SPLIT card sits it beside a
      // 12px label, so 2rem dominates and reads out of proportion (the value
      // overpowered the label). Dense drops the value ~a third at each size so a
      // dashboard card stays balanced. An exact `fontSize` still wins over both.
      dense: { true: '', false: '' },
    },
    compoundVariants: [
      { dense: true, size: 'sm', class: '[--fr-stat-fs-default:1.125rem]' },
      { dense: true, size: 'md', class: '[--fr-stat-fs-default:1.375rem]' },
      { dense: true, size: 'lg', class: '[--fr-stat-fs-default:1.75rem]' },
    ],
    defaultVariants: { size: 'md', dense: false },
  },
);
const statDelta = cva('inline-flex items-center gap-0.5 text-[0.8125rem] font-medium tabular-nums', {
  variants: {
    deltaType: {
      increase: 'text-success',
      decrease: 'text-danger',
      neutral: '[color:var(--fr-stat-muted,var(--fr-surface-muted,var(--color-muted-foreground)))]',
    },
  },
  defaultVariants: { deltaType: 'neutral' },
});

/** The tile's muted-text chain (label / caption / value annotations). */
const STAT_MUTED = '[color:var(--fr-stat-muted,var(--fr-surface-muted,var(--color-muted-foreground)))]';

/** Resolve an exact dimension prop to a clamped NUMBER for an SVG presentation
 *  attribute (chart-security contract = numeric attrs, never a class/css var),
 *  or null if it isn't a finite number — caller falls back to the enum constant. */
const dimNum = (v: unknown, lo: number, hi: number): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : null;
};

/** Build OUR own <polyline> points from the numeric series — the sparkline is
 *  author-controlled SVG; only the NUMBERS are data (never spec markup). */
function sparklinePoints(series: number[], w: number, h: number): string {
  if (series.length === 0) return '';
  if (series.length === 1) return `0,${h / 2} ${w},${h / 2}`;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const stepX = w / (series.length - 1);
  return series
    .map((n, i) => {
      const x = i * stepX;
      // higher value → higher on screen (smaller y); pad 1px top/bottom.
      const y = h - 1 - ((n - min) / span) * (h - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function Stat({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label: string;
    value: string;
    caption?: string | null;
    icon?: string | null;
    layout?: string | null;
    delta?: string | null;
    sparkline?: number[] | null;
    valuePrefix?: unknown;
    valueSuffix?: unknown;
    valueCaption?: unknown;
    strokeWidth?: string | number | null;
    deltaType?: string | null;
    size?: string | null;
    fontSize?: string | number | null;
    align?: string | null;
    accent?: string | null;
    sparklineColor?: string | null;
    mutedColor?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    font?: string | null;
  };
  const deltaType = (p.deltaType as 'increase' | 'decrease' | 'neutral' | null) ?? 'neutral';
  const series = Array.isArray(p.sparkline) ? p.sparkline.filter((n) => typeof n === 'number' && Number.isFinite(n)) : [];
  const asText = (v: unknown): string | null => {
    if (typeof v === 'string') return v.length > 0 ? v : null;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    return null;
  };
  const valuePrefix = asText(p.valuePrefix);
  const valueSuffix = asText(p.valueSuffix);
  const valueCaption = asText(p.valueCaption);
  const arrow = deltaType === 'increase' ? 'arrow-up' : deltaType === 'decrease' ? 'arrow-down' : null;
  // Exact sparkline thickness → clamped SVG attr; falls back to the hardcoded 1.5.
  const strokeW = dimNum(p.strokeWidth, 0.5, 6) ?? 1.5;

  // The heading carries the metric's identity, so it gets two lines before it
  // ellipsises — one line cannot hold a real label at the 200% text size WCAG 1.4.4
  // requires. break-words is the same shear guard the PageHeader title carries: a
  // word longer than the tile is cut mid-glyph by line-clamp unless it may break.
  const labelEl = (
    <span className="max-w-full line-clamp-2 break-words text-xs font-medium tracking-[0.01em] [color:var(--fr-stat-muted,var(--fr-surface-muted,var(--color-muted-foreground)))]" title={p.label}>{p.label}</span>
  );
  // Every tile carries a caption SLOT. Empty, it is out of flow (`hidden`) and
  // costs nothing; a StatGroup holding at least one real caption reveals the empty
  // ones (its `:has` rule), so the values below them start on one line across the
  // row without the author declaring anything. The zero-width space is what gives
  // a revealed slot exactly one caption line box.
  // A caption is where a derived figure states its provenance — the series behind
  // the average, the window behind the rate — so it wraps to two lines like the
  // label rather than trading its content for one line of tile geometry.
  const captionEl = p.caption != null ? (
    <span data-fr-stat-caption className="max-w-full line-clamp-2 break-words text-[0.75rem] [color:var(--fr-stat-muted,var(--fr-surface-muted,var(--color-muted-foreground)))]" title={p.caption}>{p.caption}</span>
  ) : (
    <span data-fr-stat-caption-slot aria-hidden className="hidden max-w-full text-[0.75rem]">{'\u200b'}</span>
  );
  // Split cards render the value at the dense (smaller) scale so it stays balanced
  // against the compact label/caption; stack keeps the hero scale.
  const isSplit = p.layout === 'split';
  // The figure is the one datum the tile exists for, so it must never clip: it wraps
  // instead (the root stylesheet's overflow-wrap:anywhere breaks a figure that has no
  // break opportunity), which holds at the 200% text size WCAG 1.4.4 requires and in a
  // narrow grid track.
  const valueEl = (
    <span
      // TRIED AND REVERTED: `break-normal whitespace-nowrap` to keep the figure
      // atomic. It stopped the shattering but an ANCESTOR with overflow:hidden
      // then clipped the number instead — clipped text became far commoner.
      // A cut-off figure loses information; a
      // shattered one at least shows every digit. The real fix is width for the
      // tile, not a wrapping rule on the text, so this stays as it was until
      // StatGroup's narrow-width collapse is revisited.
      className={cn(statValue({ size: (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined, dense: isSplit as true | false }), 'max-w-full', weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}
    >
      {/* `valuePrefix` / `valueSuffix` QUALIFY the figure — "Q4" before it, an
          "(est.)" after it. They ride at the muted caption scale so the KPI is
          still the loudest thing on the tile. Dropped silently until now, so a
          forecast tile printed "$65B" as if it were reported. */}
      {valuePrefix != null && <span className={cn('mr-1 align-middle text-[0.75rem] font-medium', STAT_MUTED)}>{valuePrefix}</span>}
      {p.value}
      {valueSuffix != null && <span className={cn('ml-0.5 align-middle text-[0.75rem] font-medium', STAT_MUTED)}>{valueSuffix}</span>}
    </span>
  );
  /* The provenance line UNDER the figure — "Q3 FY26 reported $57.0B". A second
     caption slot, not the label's: it belongs to the number, so in split it
     stays in the right-hand value column. */
  const valueCaptionEl =
    valueCaption != null ? (
      <span data-fr-stat-value-caption className={cn('max-w-full break-words text-[0.75rem]', STAT_MUTED)}>{valueCaption}</span>
    ) : null;
  // Stack tiles stretch to the tallest sibling of a StatGroup row, so the first
  // footer block absorbs the slack and every tile's footer lands on the row's
  // bottom line. A split tile is a content-height row with nothing to absorb.
  const footerFill = isSplit ? undefined : 'mt-auto';
  const deltaEl = p.delta != null ? (
    <span className={cn(statDelta({ deltaType }), footerFill)}>
      {arrow != null && <Icon name={arrow} size={13} />}
      {p.delta}
    </span>
  ) : null;
  /* The trend line. Defined ONCE and rendered by BOTH layouts: it used to live
     inline in the stack return only, so every `layout:"split"` tile carrying a
     `sparkline` drew nothing at all, series or no series. In split it takes its own full-width
     line under the row (the split root is flex-wrap). */
  const sparkEl =
    series.length > 0 ? (
      <svg
        // stroke = the sparkline chain: own `sparklineColor` var → `accent` var →
        // foreground. Unset --fr-stat-spark resolves to --fr-stat-accent exactly as
        // before (byte-identical); currentColor on the polyline paints from here.
        // A delta above it already carries the slack, so the trend line only
        // takes the auto margin when it is the tile's whole footer.
        className={cn(
          isSplit ? 'mt-1 basis-full' : deltaEl != null ? 'mt-1' : 'mt-auto',
          'w-full text-[var(--fr-stat-spark,var(--fr-stat-accent))]',
        )}
        viewBox="0 0 100 28"
        preserveAspectRatio="none"
        height={28}
        aria-hidden
      >
        <polyline
          points={sparklinePoints(series, 100, 28)}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    ) : null;

  // Muted category chip: a quiet rounded square with the icon
  // in muted chrome — an identifier for the metric TYPE, never coloured, never a
  // KPI's second voice. Sized to the split-layout tile.
  // The square is drawn only for a glyph that will actually appear in it — a registry
  // name or an emoji. An unknown name used to leave an EMPTY muted square on the tile
  // (found on a trip-summary strip), which reads as a broken icon, not a quiet cue.
  const iconEl = p.icon != null && hasIcon(p.icon) ? (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-frayme bg-[color:var(--fr-surface-sunken,var(--color-muted))] [color:var(--fr-stat-muted,var(--fr-surface-muted,var(--color-muted-foreground)))]" aria-hidden>
      <Icon name={p.icon} size={18} />
    </span>
  ) : null;

  // SPLIT layout: label+caption on the left, value+delta right-aligned on the right,
  // an optional icon leading — the dense dashboard card that holds four facts in one
  // row. `stack` (default) is unchanged and byte-identical when these props are unset.
  if (p.layout === 'split') {
    return (
      <div
        // fr-stat-split: sharing width pressure between the label and the value
        // sounded fair and measured badly — the value column collapsed to 52px
        // and "342.200,00 €" wrapped to three lines at 2rem. Nor can the value
        // simply refuse to shrink: this tile's grid ancestor is overflow:hidden,
        // so an unshrinkable figure gets CLIPPED instead (that is the mistake the
        // reverted whitespace-nowrap attempt made). It stacks instead — label
        // over figure, each with the full tile — driven from frayme.css on the
        // tile's own container width.
        className={cn('fr-stat-split flex w-full flex-wrap items-center gap-x-3 gap-y-1', fontClass(p.font))}
        style={styleVars(
          { var: '--fr-stat-accent', value: p.accent, kind: 'color' },
          { var: '--fr-stat-spark', value: p.sparklineColor, kind: 'color' },
          { var: '--fr-stat-muted', value: p.mutedColor, kind: 'color' },
          { var: '--fr-stat-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 14, max: 96 } },
        )}
      >
        {iconEl}
        {/* Width pressure is SHARED: the label keeps a readable floor (min-w-14)
            and the value column shrinks too, so neither column is squeezed away —
            each reflows inside its own column instead. */}
        <div className="fr-stat-split-label flex min-w-14 flex-1 flex-col gap-0.5">{labelEl}{captionEl}</div>
        {/* basis-[7rem]: the figure asks for a real share up front, so when the
            label and the figure cannot both fit the figure wraps to its own line
            with the whole tile — rather than being ground down to 52px and
            spelling "342.200,00 €" over three lines. Pure flex, no breakpoint:
            it self-adjusts at every width, including a tile in a narrow column
            of a wide page, which a page-level query would miss. */}
        <div className="fr-stat-split-value flex min-w-0 shrink grow basis-[7rem] flex-col items-end gap-0.5 text-right">{valueEl}{valueCaptionEl}{deltaEl}</div>
        {sparkEl}
      </div>
    );
  }

  return (
    <div
      className={cn(statWrap({ align: (p.align as 'start' | 'center' | null) ?? undefined }), fontClass(p.font))}
      style={styleVars(
        { var: '--fr-stat-accent', value: p.accent, kind: 'color' },
        // Sparkline stroke colour — its OWN channel, chaining to `accent` then the
        // foreground token so unset keeps the accent-coupled default (a neutral
        // KPI figure can carry a brand-colored trend line, the Tremor look).
        { var: '--fr-stat-spark', value: p.sparklineColor, kind: 'color' },
        { var: '--fr-stat-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-stat-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 14, max: 96 } },
      )}
    >
      {/* The label is the CATEGORY, deliberately quiet and consistent: a small
          muted eyebrow above the figure. A `caption` (when present) sits just
          under it as a second muted line — the stack tile gains context without
          the horizontal split. labelEl/valueEl/deltaEl are shared with the split
          layout above so the two paths cannot drift. */}
      {labelEl}
      {captionEl}
      {valueEl}
      {valueCaptionEl}
      {deltaEl}
      {sparkEl}
    </div>
  );
}

/* ── EmptyState ───────────────────────────────────────────────────────────── */

const stateWrap = cva('flex flex-col gap-2', {
  variants: {
    align: {
      center: 'items-center text-center',
      start: 'items-start text-left',
    },
    size: {
      sm: 'py-6',
      md: 'py-10',
      lg: 'py-16',
    },
  },
  defaultVariants: { align: 'center', size: 'md' },
});
const stateIcon = cva('inline-flex items-center justify-center rounded-full', {
  variants: {
    size: {
      sm: 'mb-1 h-9 w-9',
      md: 'mb-2 h-12 w-12',
      lg: 'mb-3 h-16 w-16',
    },
    tone: {
      muted: 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]',
      danger: '[background:color-mix(in_srgb,var(--frayme-danger)_12%,transparent)] text-danger',
    },
  },
  defaultVariants: { size: 'md', tone: 'muted' },
});
// stateTitle is SHARED by EmptyState + ErrorState. font-size is a VAR-CHAIN (same
// shape as Stat/Heading): each size step sets the DEFAULT font-size var, the base
// reads the exact-override var with that per-size default as its fallback. Both
// components feed --fr-statetitle-fs from their own `fontSize` prop, so an exact
// value wins via ONE declaration while the size enum stays byte-identical.
// Byte-identical mapping (v4): sm text-base = 1rem + bundled line-height 1.5
// (preserved as leading-normal — base has no leading of its own) · md
// text-[1.125rem] = 1.125rem (no line-height) · lg text-[1.375rem] = 1.375rem.
const stateTitle = cva('m-0 font-semibold [font-size:var(--fr-statetitle-fs,var(--fr-statetitle-fs-default,1.125rem))]', {
  variants: {
    size: {
      sm: '[--fr-statetitle-fs-default:1rem] leading-normal',
      md: '[--fr-statetitle-fs-default:1.125rem]',
      lg: '[--fr-statetitle-fs-default:1.375rem]',
    },
  },
  defaultVariants: { size: 'md' },
});
const ICON_PX: Record<string, number> = { sm: 18, md: 24, lg: 30 };

/* The action cluster under a state panel's copy — SHARED by EmptyState and
   ErrorState so the two panels cannot drift (they are one shape).
   `flex-wrap` is the whole fix. The row was a bare `flex items-center gap-2`,
   and a non-wrapping row's min-content is the SUM of its buttons, so the cluster
   sized past the panel that holds it instead of breaking: measured in a 200px
   lane at 320, three actions put the row 49px outside the surface, and the last
   label ("Contact support") was squeezed to 55x40 — two lines inside a button,
   1.3x off the shattered-text threshold. Two actions still escaped by 6px.
   Wrapping costs a line only when the line is genuinely too narrow; at any width
   where the cluster fits, a shrink-to-fit row has no free space to distribute, so
   flex-wrap and justify-* are both no-ops and the wide render is unchanged.
   NOT the alternative fixes: `min-w-0` would let the buttons compress instead
   (trading the overflow for the shatter this fix is here to remove), and a
   `truncate` on the labels would delete the verb the panel exists to offer.
   PageHeader's cluster (above) already wraps for exactly this reason — these two
   were the copies that were left behind. */
const stateActions = 'mt-3 flex max-w-full flex-wrap items-center gap-2';
/* A wrapped cluster's LINES align on their own axis, so once the row is forced to
   the panel width the second line would sit left under a centred panel. Follow the
   panel's own `align` (stateWrap's default is center) so the wrap stays symmetric. */
const stateActionsJustify = (align: 'center' | 'start' | undefined) =>
  align === 'start' ? 'justify-start' : 'justify-center';

export function EmptyState({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title: string;
    description?: string | null;
    icon?: string | null;
    size?: string | null;
    align?: string | null;
    mutedColor?: string | null;
    fontSize?: string | number | null;
    weight?: string | null;
    font?: string | null;
    tracking?: string | null;
    leading?: string | null;
    // the semantic rank of `title` in the page outline.
    titleLevel?: string | number | null;
  };
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const align = (p.align as 'center' | 'start' | null) ?? undefined;
  // Outline rank of the zero-data title — authored, because only the spec knows
  // what sits above this panel. Unset → h3, and the default deliberately did NOT
  // follow Card to h2: an EmptyState/ErrorState title usually sits INSIDE a titled
  // container (its h2 right above it) and only sometimes directly under the
  // PageHeader h1. h2 would repair the occasional skip and flatten the common case
  // into "No results" claiming equal rank with the panel that frames it. h3 is
  // right for the majority placement; the rest are what this prop is for. A
  // Card/Carousel is a FRAME and defaults h2 — a state panel is CONTENT inside
  // one, so it defaults one level lower.
  const TitleTag = headingTag(p.titleLevel, 'h3');
  return (
    <div
      className={cn(stateWrap({ align, size }), fontClass(p.font))}
      style={styleVars(
        { var: '--fr-emptystate-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-statetitle-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {p.icon != null && (
        // A SET mutedColor brand-tints the focal disk too: the glyph reads the
        // muted var via the text-color group form (dedupes the tone's
        // text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]) and the disk fill becomes a soft 12% mix of the
        // same var (over the tone's bg-muted). Unset → both conditionals drop →
        // the exact token disk (byte-identical).
        <span
          className={cn(
            stateIcon({ size, tone: 'muted' }),
            p.mutedColor != null &&
              'text-[color:var(--fr-emptystate-muted,var(--color-muted-foreground))] [background:color-mix(in_srgb,var(--fr-emptystate-muted,var(--color-muted-foreground))_12%,transparent)]',
          )}
          aria-hidden
        >
          <Icon name={p.icon} size={ICON_PX[size]} />
        </span>
      )}
      {/* weight/tracking/leading placed LAST so a SET value dedupe-wins over the
          baked font-semibold / sm leading-normal; unset → undefined → cn drops
          it (byte-identical). */}
      <TitleTag className={cn(stateTitle({ size }), weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}>{p.title}</TitleTag>
      {p.description != null && <p className="m-0 max-w-prose text-sm [color:var(--fr-emptystate-muted,var(--color-muted-foreground))]">{p.description}</p>}
      {children != null && <div className={cn(stateActions, stateActionsJustify(align))}>{children}</div>}
    </div>
  );
}

/* ── ErrorState ───────────────────────────────────────────────────────────── */

export function ErrorState({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title: string;
    detail?: string | null;
    icon?: string | null;
    size?: string | null;
    align?: string | null;
    mutedColor?: string | null;
    fontSize?: string | number | null;
    weight?: string | null;
    font?: string | null;
    tracking?: string | null;
    leading?: string | null;
    // the semantic rank of `title` in the page outline.
    titleLevel?: string | number | null;
  };
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const align = (p.align as 'center' | 'start' | null) ?? undefined;
  // Same contract and same h3 default as EmptyState above — the two panels are
  // one shape and must not disagree about their rank. See that comment for the
  // 11-nested-vs-6-page-level measurement behind the default staying at h3.
  const TitleTag = headingTag(p.titleLevel, 'h3');
  // default to the danger triangle; an explicit name overrides.
  const iconName = p.icon ?? 'alert-triangle';
  return (
    <div
      className={cn(stateWrap({ align, size }), fontClass(p.font))}
      role="alert"
      style={styleVars(
        { var: '--fr-errorstate-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-statetitle-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      <span className={cn(stateIcon({ size, tone: 'danger' }))} aria-hidden>
        <Icon name={iconName} size={ICON_PX[size]} />
      </span>
      {/* weight/tracking/leading placed LAST so a SET value dedupe-wins over the
          baked font-semibold / sm leading-normal; unset → undefined → cn drops
          it (byte-identical). */}
      <TitleTag className={cn(stateTitle({ size }), weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}>{p.title}</TitleTag>
      {p.detail != null && <p className="m-0 max-w-prose text-sm [color:var(--fr-errorstate-muted,var(--color-muted-foreground))]">{p.detail}</p>}
      {children != null && <div className={cn(stateActions, stateActionsJustify(align))}>{children}</div>}
    </div>
  );
}
