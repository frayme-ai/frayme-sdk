'use client';
import type { ReactNode } from 'react';
import { Fragment, createContext, useContext } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../cn.js';
import { styleVars, fontClass, weightClass, trackingClass, leadingClass } from './_style.js';
import { Icon, hasIcon } from './icons.js';
import { safeUrl, linkTargetRel } from './url-safety.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import type { ComponentRenderProps } from '../upstream.js';

/* A Sidebar collapses to an icon-only rail; the flag flows to descendant
   SidebarItems through context (the flat spec tree mounts them as React
   descendants, so context propagates). Default false = a standalone SidebarItem
   renders full-width. */
const SidebarCollapsedCtx = createContext(false);

/* Catalog group: Breadcrumb, Sidebar, SidebarItem, Navbar
 *
 * Same truly-dynamic contract as layout/data-display/actions/forms:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (colors the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities. The class set stays a
 *     closed build-time set (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing/absent
 *     value so the token fallback wins (props-less → polished).
 *
 * value > enum precedence (Sidebar/Navbar `bg` over the variant surface;
 * SidebarItem `accent` over the token highlight): the SAME conditional-override
 * -class technique as data-display.tsx — the `[background:var(--fr-…)]` utility
 * is only added to cn() when the model supplied that value (`p.bg != null`), so
 * the variant class wins when absent and the var wins when present.
 *
 * Every navigable href is scheme-guarded at point-of-use (`safeUrl`), external
 * links get `{...linkTargetRel(external)}` (the spec sets only the boolean
 * `external`, never target/rel). Icons are NAMES resolved against the closed
 * icons.ts registry — never raw SVG; an unknown/absent name renders nothing.
 */

/* ── Breadcrumb ───────────────────────────────────────────────────────────── */

/* The separator glyph is a CLOSED enum → a literal character (never spec text). */
const BREADCRUMB_SEP: Record<'slash' | 'chevron' | 'dot' | 'arrow', string> = {
  slash: '/',
  chevron: '›',
  dot: '•',
  arrow: '→',
};

/* Trail font size: the `size` ENUM is the DEFAULT; the exact `fontSize` value
   channel wins via the two-step var chain (each size step sets a DEFAULT var —
   never a text-* utility, which would beat the base's arbitrary font-size rule
   by stylesheet order). text-sm/text-lg bundled a line-height, so sm/lg carry
   an explicit leading-* matching the prior bundled value (byte-identical). */
/* The muted trail colour is NOT set here any more. It used to ride the <ol> and
   every crumb inherited it — which meant the CURRENT-page crumb had to climb back
   out with a `text-[color:var(--fr-surface-fg,var(--color-foreground))]` reset, and that reset is the bug: inside an
   authored `Card {bg:"#12161f", color:"#e2e6f0"}` the aria-current crumb rendered
   rgb(24,24,27) on dark navy (the 1.00-1.02 contrast class). The current crumb
   can only INHERIT the authored colour if what it
   inherits is the card's ink, not the trail's grey — so the grey moved down onto
   the three nodes that actually want it (link / plain / separator), each of which
   already declared it explicitly. Byte-identical: no descendant of the <ol> was
   relying on the inherited value except the two nodes patched below. */
const breadcrumb = cva('flex flex-wrap items-center gap-1.5 [font-size:var(--fr-crumb-fs,var(--fr-crumb-fs-default))]', {
  variants: {
    size: {
      sm: '[--fr-crumb-fs-default:0.875rem] leading-[calc(1.25/0.875)]',
      md: '[--fr-crumb-fs-default:0.9375rem]',
      lg: '[--fr-crumb-fs-default:1.125rem] leading-[calc(1.75/1.125)]',
    },
  },
  defaultVariants: { size: 'md' },
});

// Link REST state belongs to the muted-trail role (`mutedColor`) ONLY — `accent`
// owns the current/last item and the link HOVER (exactly what both describes
// claim). --fr-crumb-accent was dropped from the rest chain so a set accent no
// longer silently owns the rest state and makes mutedColor inert on links.
const crumbLink = cva(
  // hover:[color:var(--fr-crumb-accent,var(--color-foreground))] is the SOLE hover
  // color source (its fallback = the exact prior hover token); no hover:text-foreground
  // — the token utility would win the cascade and make the hover accent inert.
  'cursor-pointer rounded-sm no-underline transition-colors hover:underline underline-offset-2 [color:var(--fr-crumb-muted,var(--color-muted-foreground))] hover:[color:var(--fr-crumb-accent,var(--color-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
);

// A collapse sentinel injected into the rendered trail when maxItems is exceeded.
// It is NEVER a real item (no href) — it renders the ellipsis glyph, non-clickable.
type CrumbItem = { label: string; href?: string | null };
const CRUMB_ELLIPSIS = Symbol('crumb-ellipsis');
type RenderedCrumb = CrumbItem | typeof CRUMB_ELLIPSIS;

/** Collapse a long trail to [first, …, last (maxItems-2) items] when it exceeds
 *  `maxItems` (shadcn BreadcrumbEllipsis convention): keep the FIRST crumb, drop
 *  the middle to a single '…' sentinel, and keep the trailing tail so the current
 *  page always shows. Returns the items unchanged when maxItems is null/unset or
 *  the trail already fits (≤ maxItems), so short trails are byte-identical. */
function collapseTrail(items: CrumbItem[], maxItems: number | null): RenderedCrumb[] {
  if (maxItems == null || items.length <= maxItems) return items;
  // Need at least 3 visible slots to collapse meaningfully (first · … · lastN).
  const cap = Math.max(maxItems, 3);
  if (items.length <= cap) return items;
  const tailCount = cap - 2; // slots left for the trailing tail after first + ellipsis
  return [items[0], CRUMB_ELLIPSIS, ...items.slice(items.length - tailCount)];
}

export function Breadcrumb({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    items?: Array<{ label: string; href?: string | null }> | null;
    separator?: 'slash' | 'chevron' | 'dot' | 'arrow' | null;
    size?: 'sm' | 'md' | 'lg' | null;
    maxItems?: number | null;
    accent?: string | null;
    mutedColor?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const rawItems = Array.isArray(p.items) ? p.items : [];
  // maxItems: clamp a valid finite count to ≥3 (any smaller can't collapse); an
  // absent/invalid value leaves the trail intact (byte-identical unset render).
  const maxItems =
    typeof p.maxItems === 'number' && Number.isFinite(p.maxItems) ? Math.max(Math.round(p.maxItems), 3) : null;
  const items = collapseTrail(rawItems, maxItems);
  const sepKey = (p.separator as 'slash' | 'chevron' | 'dot' | 'arrow' | null) ?? 'chevron';
  const sep = BREADCRUMB_SEP[sepKey] ?? BREADCRUMB_SEP.chevron;
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  return (
    <nav
      aria-label="Breadcrumb"
      style={styleVars(
        { var: '--fr-crumb-accent', value: p.accent, kind: 'color' },
        { var: '--fr-crumb-muted', value: p.mutedColor, kind: 'color' },
        // exact trail font size — wins over the size-enum default var.
        { var: '--fr-crumb-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {/* closed Font enum → a static font-* utility; the whole trail inherits it. */}
      <ol className={cn(breadcrumb({ size }), 'm-0 list-none p-0', fontClass(p.font))}>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          // The collapse sentinel → a non-interactive '…' entry (never a link).
          if (item === CRUMB_ELLIPSIS) {
            return (
              <Fragment key={i}>
                <li className="inline-flex shrink-0 items-center">
                  <span className="select-none px-0.5 [color:var(--fr-crumb-muted,var(--color-muted-foreground))]" aria-label="Show hidden pages" title="Hidden pages">
                    …
                  </span>
                </li>
                {!last && (
                  <li className="inline-flex shrink-0 select-none items-center [color:color-mix(in_srgb,var(--fr-crumb-muted,var(--color-muted-foreground))_70%,transparent)]" aria-hidden>
                    {sep}
                  </li>
                )}
              </Fragment>
            );
          }
          return (
            <Fragment key={i}>
              {/* No max-w cap on the crumb: a fixed cap clips a long page name at
                  every viewport width, not only a narrow one, and the trail is a
                  flex-WRAP row (see `breadcrumb`) — a long crumb takes a second
                  line instead of losing its tail. */}
              <li className="inline-flex min-w-0 items-center">
                {last ? (
                  // The current page: plain text, no link, value > token accent.
                  <span
                    aria-current="page"
                    className={cn(
                      // break-words, not truncate: a page name is a short string that
                      // must survive — the row wraps, so nothing has to be deleted.
                      // No min-w-0 either (matching the two crumb forms below): the
                      // `li` carries the shrink floor, and on this LEAF removing the
                      // min-content floor lets break-words split the name per char.
                      // INHERITED FOREGROUND: this used to be `text-[color:var(--fr-surface-fg,var(--color-foreground))]`, a
                      // reset to the global token, because the <ol> painted the muted
                      // trail over it. With the grey moved onto the trail nodes (see
                      // `breadcrumb` above) the current crumb simply inherits, and
                      // currentColor on `color` computes to that inherited value — at
                      // the top level .frayme-root's colour IS --color-foreground, so
                      // the default render is byte-identical, while inside an authored
                      // card the current page finally reads on it. The hierarchy is
                      // unchanged: the trail is muted-foreground, this one is the
                      // surface's own full-strength ink plus font-medium.
                      'break-words font-medium text-[color:currentColor]',
                      p.accent != null && 'text-[color:var(--fr-crumb-accent)]',
                      // weight/tracking/leading closed enums → static utilities, LAST so a
                      // set value dedupe-wins its group (font-medium stays the default).
                      weightClass(p.weight),
                      trackingClass(p.tracking),
                      leadingClass(p.leading),
                    )}
                    title={item.label}
                  >
                    {item.label}
                  </span>
                ) : item.href != null ? (
                  <a
                    className={cn(crumbLink(), 'break-words', weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))}
                    href={safeUrl(item.href)}
                    title={item.label}
                  >
                    {item.label}
                  </a>
                ) : (
                  // A hrefless, non-current crumb: part of the muted TRAIL. It used
                  // to take that grey by inheritance from the <ol>; now that the <ol>
                  // no longer paints it (so the current crumb can inherit the card's
                  // ink instead) it declares the same chain the link/separator
                  // declare — byte-identical computed colour, stated locally.
                  <span className={cn('break-words [color:var(--fr-crumb-muted,var(--color-muted-foreground))]', weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))} title={item.label}>
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                // separators join the muted-trail role: 70% of the muted var (token
                // fallback inside the var → unset computes the exact prior
                // muted-foreground at 70%) so a set `mutedColor` tints them WITH
                // the trail text instead of leaving theme-grey glyphs.
                <li className="inline-flex shrink-0 select-none items-center [color:color-mix(in_srgb,var(--fr-crumb-muted,var(--color-muted-foreground))_70%,transparent)]" aria-hidden>
                  {sep}
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/* ── Sidebar ──────────────────────────────────────────────────────────────── */

/* Rail width: the `size` ENUM is the DEFAULT (sm/md/lg → 12/16/20rem); the exact
   `width` value channel WINS when set. Pattern A (var-chain): each size variant
   sets a DEFAULT width var (NOT a w-* utility) and the renderer reads it through
   the exact-override var on a single width declaration — so the enum default is
   byte-identical (sm/md/lg reproduce 12/16/20rem) and an exact width overrides
   without a tw-merge collision. `collapsed` overrides to a fixed narrow rail and
   the width channel is suppressed (gated off `collapsed` in the renderer). */
const sidebar = cva(
  'flex flex-col gap-1 [background:var(--fr-sidebar-bg,var(--color-card))] [border-color:var(--fr-sidebar-border,var(--color-border))]',
  {
    variants: {
      variant: {
        default: 'border-r p-3',
        floating: 'rounded-frayme border shadow-lg m-3 p-3',
        ghost: 'border-0 bg-transparent p-3',
      },
      size: {
        sm: '[--fr-sidebar-w-default:12rem]',
        md: '[--fr-sidebar-w-default:16rem]',
        lg: '[--fr-sidebar-w-default:20rem]',
      },
      collapsed: {
        true: 'w-16 items-stretch',
        false: '',
      },
      sticky: {
        true: 'sticky top-0 self-start max-h-screen overflow-y-auto',
        false: '',
      },
    },
    // ghost has no surface, so its bg var fallback should stay transparent — the
    // conditional override class (below) still applies a model-named bg when set.
    compoundVariants: [{ variant: 'ghost', class: '[background:transparent]' }],
    defaultVariants: { variant: 'default', size: 'md', collapsed: false, sticky: false },
  },
);

export function Sidebar({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title?: string | null;
    variant?: 'default' | 'floating' | 'ghost' | null;
    collapsed?: boolean | null;
    size?: 'sm' | 'md' | 'lg' | null;
    width?: string | number | null;
    sticky?: boolean | null;
    bg?: string | null;
    borderColor?: string | null;
    accent?: string | null;
    mutedColor?: string | null;
  };
  const collapsed = (p.collapsed ?? false) as true | false;
  const variant = (p.variant as 'default' | 'floating' | 'ghost' | null) ?? undefined;
  return (
    <aside
      className={cn(
        sidebar({
          variant,
          // when collapsed the width enum is ignored (fixed narrow rail).
          size: collapsed ? undefined : (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined,
          collapsed,
          sticky: (p.sticky ?? false) as true | false,
        }),
        // Rail width (Pattern A): NOT collapsed → one width declaration reading the
        // exact-override var (p.width) over the size-enum default var (12/16/20rem,
        // md=16rem the props-less default). collapsed → omit entirely so the fixed
        // w-16 narrow rail is the only width class (the exact channel is suppressed).
        !collapsed && '[width:var(--fr-sidebar-w,var(--fr-sidebar-w-default,16rem))] max-w-full',
        // value > variant surface: a model-named bg recolors the rail; otherwise
        // the variant/token surface owns it (ghost stays transparent). The token
        // fallback is defence-in-depth (an invalid bg on the ungated path keeps
        // the card token instead of rendering transparent).
        p.bg != null && '[background:var(--fr-sidebar-bg,var(--color-card))]',
        p.borderColor != null && '[border-color:var(--fr-sidebar-border,var(--color-border))]',
      )}
      // Propagate the rail accent so child SidebarItems inherit it for their
      // active highlight unless they name their own.
      style={styleVars(
        { var: '--fr-sidebar-bg', value: p.bg, kind: 'color' },
        { var: '--fr-sidebar-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-nav-accent', value: p.accent, kind: 'color' },
        { var: '--fr-sidebar-muted', value: p.mutedColor, kind: 'color' },
        // exact rail width — suppressed when collapsed (fixed narrow rail wins).
        { var: '--fr-sidebar-w', value: collapsed ? null : p.width, kind: 'dim', opts: { units: ['px', 'rem'], min: 120, max: 640 } },
      )}
    >
      {p.title != null && !collapsed && (
        <div
          className={cn(
            'mb-1 px-2 pt-1 pb-2 text-xs font-semibold uppercase tracking-wide [color:var(--fr-sidebar-muted,var(--color-muted-foreground))]',
            p.accent != null && '[color:var(--fr-nav-accent)]',
          )}
        >
          {p.title}
        </div>
      )}
      {/* propagate `collapsed` to descendant SidebarItems (icon-only rows). */}
      <SidebarCollapsedCtx.Provider value={collapsed}>
        <nav className="flex flex-col gap-0.5" aria-label={p.title ?? 'Sidebar'}>
          {children}
        </nav>
      </SidebarCollapsedCtx.Provider>
    </aside>
  );
}

/* ── SidebarItem ──────────────────────────────────────────────────────────── */

/* `accent` (the active highlight) inherits from the parent Sidebar's
   `--fr-nav-accent` when this item doesn't name its own — so a rail-level accent
   recolors every active item, and an item can still override locally. */
/* Row font size: the `size` ENUM is the DEFAULT; the exact `fontSize` value
   channel wins via the two-step var chain (each sized step sets a DEFAULT var —
   never a text-* utility, which would beat the base's arbitrary font-size rule
   by stylesheet order). md set no size, so the chain bottoms out at `inherit`;
   sm/lg carry an explicit leading-* matching the size bundled with the prior
   text-sm/text-lg (byte-identical when unset). */
const sidebarItem = cva(
  'flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent text-left font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))] no-underline transition-colors [font-size:var(--fr-item-fs,var(--fr-item-fs-default,inherit))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40',
  {
    variants: {
      size: {
        sm: 'rounded-[calc(var(--radius-frayme)/1.5)] px-2.5 py-1.5 [--fr-item-fs-default:0.875rem] leading-[calc(1.25/0.875)]',
        md: 'rounded-frayme px-3 py-2',
        lg: 'rounded-frayme px-3.5 py-2.5 [--fr-item-fs-default:1.125rem] leading-[calc(1.75/1.125)]',
      },
      active: {
        // active highlight reads --fr-item-accent (own) → --fr-nav-accent
        // (inherited from the rail) → primary token.
        true: '[background:color-mix(in_srgb,var(--fr-item-accent,var(--fr-nav-accent,var(--color-foreground)))_14%,transparent)] text-[color:var(--fr-item-accent,var(--fr-nav-accent,var(--color-foreground)))]',
        false: '',
      },
      collapsed: {
        true: 'justify-center px-0',
        false: '',
      },
    },
    defaultVariants: { size: 'md', active: false, collapsed: false },
  },
);

export function SidebarItem({ element, emit, on }: ComponentRenderProps): ReactNode {
  const emitWith = useIntrinsicEmit(emit, element);
  const p = (element.props ?? {}) as {
    label: string;
    href?: string | null;
    badge?: string | null;
    icon?: string | null;
    active?: boolean | null;
    size?: 'sm' | 'md' | 'lg' | null;
    external?: boolean | null;
    accent?: string | null;
    trackColor?: string | null;
    color?: string | null;
    mutedColor?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const active = p.active === true;
  const external = p.external === true;
  // `collapsed` flows from the parent Sidebar (icon-only rail) via context.
  const collapsed = useContext(SidebarCollapsedCtx);
  // Collapsed rows hide the label (sr-only), so a sighted user gets an unlabeled
  // icon — mirror the VS Code / Linear / shadcn icon-rail convention and surface
  // the label as a native tooltip via the `title` attr (approved exception: only
  // set when collapsed, so the expanded default is byte-identical).
  const titleAttr = collapsed ? p.label : undefined;
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const glyph = p.icon != null ? <Icon name={p.icon} size={18} /> : null;
  const style = styleVars(
    { var: '--fr-item-accent', value: p.accent, kind: 'color' },
    { var: '--fr-item-track', value: p.trackColor, kind: 'color' },
    { var: '--fr-item-rest', value: p.color, kind: 'color' },
    { var: '--fr-item-muted', value: p.mutedColor, kind: 'color' },
    // exact row font size — wins over the size-enum default var.
    { var: '--fr-item-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
  );
  // Resting-state channels apply to the UNSELECTED item ONLY — the active item
  // keeps its accent tint/text. A resting bg uses the conditional override form
  // (token-default transparent wins when unset); the resting text uses the
  // text-color group form (added LAST) so tw-merge dedupes-and-wins over the
  // CVA base `[color:inherit]`/`text-[color:var(--fr-surface-fg,var(--color-foreground))]`.
  const className = cn(
    sidebarItem({ size, active: active as true | false, collapsed: collapsed as true | false }),
    // Hover (moved out of the cva base): mutually-exclusive on `accent` so the two
    // hovers are never co-located (an arbitrary [background:color-mix] hover does
    // NOT dedupe a hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] utility → byte-identical requires exactly one).
    // accent SET → the 8% accent tint (below the 14% active fill); accent UNSET →
    // the EXACT prior `hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]` (literally byte-identical).
    p.accent != null
      ? 'hover:[background:color-mix(in_srgb,var(--fr-item-accent,var(--fr-nav-accent,var(--color-foreground)))_8%,transparent)]'
      : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
    !active && p.trackColor != null && '[background:var(--fr-item-track)]',
    !active && p.color != null && 'text-[color:var(--fr-item-rest,var(--color-foreground))]',
    // closed Font enum → a static font-* utility; the whole row inherits it.
    fontClass(p.font),
  );

  const inner = (
    <>
      {glyph && <span className="shrink-0">{glyph}</span>}
      {/* collapsed → the label stays in the DOM as the accessible name but is
          visually hidden (icon-only); badge/external glyph are dropped. */}
      {/* weight/tracking/leading closed enums → static utilities on the label; a set
          weight's own font-weight beats the root's inherited font-medium. */}
      {/* break-words, not truncate: the rail has a fixed WIDTH but no fixed row
          height (the padding sizes the row), so a long destination name takes a
          second line rather than losing its tail. flex-1 stays (the label owns
          the leftover row width); min-w-0 does NOT — this LEAF renders only the
          label, and below its min-content break-words splits it per character. */}
      <span className={cn('flex-1 break-words', collapsed && 'sr-only', weightClass(p.weight), trackingClass(p.tracking), leadingClass(p.leading))} title={p.label}>
        {p.label}
      </span>
      {!collapsed && p.badge != null && (
        // MUTUALLY-EXCLUSIVE pill fill: a SET mutedColor paints the WHOLE pill (a
        // soft 15% mix of it, matching the recolored pill text) so it never
        // clashes on a custom rail bg; unset keeps the EXACT prior bg-muted
        // (byte-identical) — never co-located (the tw-merge trap).
        <span
          className={cn(
            'shrink-0 rounded-full',
            p.mutedColor != null
              ? '[background:color-mix(in_srgb,var(--fr-item-muted,var(--color-muted-foreground))_15%,transparent)]'
              : 'bg-muted',
            'px-2 py-0.5 text-xs font-medium [color:var(--fr-item-muted,var(--color-muted-foreground))]',
          )}
        >
          {p.badge}
        </span>
      )}
      {!collapsed && external && (
        <span className="shrink-0 [color:var(--fr-item-muted,var(--color-muted-foreground))]" aria-hidden>
          <Icon name="external-link" size={13} />
        </span>
      )}
    </>
  );

  if (p.href != null) {
    const press = on('commit');
    return (
      <a
        className={className}
        href={safeUrl(p.href)}
        {...linkTargetRel(external)}
        aria-current={active ? 'page' : undefined}
        title={titleAttr}
        style={style}
        onClick={(e) => {
          if (press.shouldPreventDefault) e.preventDefault();
          if (press.bound) emitWith('commit', { label: p.label });
        }}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={className}
      aria-current={active ? 'page' : undefined}
      title={titleAttr}
      style={style}
      onClick={() => emitWith('commit', { label: p.label })}
    >
      {inner}
    </button>
  );
}

/* ── Navbar ───────────────────────────────────────────────────────────────── */

/* Bar height: the `size` ENUM is COMPOUND (height + X padding). The exact
   `height` value channel governs ONLY the height; the padding ramp stays the
   enum. Pattern A (var-chain): each size variant sets a DEFAULT height var (NOT
   an h-* utility) plus its own px-* padding, and the base reads height through
   the exact-override var on a single height declaration — so the enum default is
   byte-identical (sm/md/lg reproduce 3/3.5/4rem) and an exact height overrides
   without a tw-merge collision while padding keeps following `size`. */
const navbar = cva(
  'z-30 flex w-full items-center gap-4 [height:var(--fr-navbar-h,var(--fr-navbar-h-default,3.5rem))] [background:var(--fr-navbar-bg,var(--color-card))] [border-color:var(--fr-navbar-border,var(--color-border))]',
  {
    variants: {
      variant: {
        default: 'border-b',
        bordered: 'rounded-frayme border',
        floating: 'rounded-frayme border shadow-lg',
      },
      size: {
        sm: '[--fr-navbar-h-default:3rem] px-3',
        md: '[--fr-navbar-h-default:3.5rem] px-4',
        lg: '[--fr-navbar-h-default:4rem] px-6',
      },
      sticky: {
        true: 'sticky top-0',
        false: '',
      },
    },
    defaultVariants: { variant: 'default', size: 'md', sticky: false },
  },
);

const navItems = cva('flex min-w-0 flex-1 items-center gap-2', {
  variants: {
    justify: {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      // `between` only matters with a brand present; with no brand it falls back
      // to end so the items sit on the right. Handled in the renderer.
      between: 'justify-end',
    },
  },
  defaultVariants: { justify: 'between' },
});

export function Navbar({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    brand?: string | null;
    brandIcon?: string | null;
    variant?: 'default' | 'bordered' | 'floating' | null;
    sticky?: boolean | null;
    justify?: 'start' | 'center' | 'end' | 'between' | null;
    size?: 'sm' | 'md' | 'lg' | null;
    height?: string | number | null;
    bg?: string | null;
    borderColor?: string | null;
    color?: string | null;
    font?: string | null;
    weight?: string | null;
  };
  const variant = (p.variant as 'default' | 'bordered' | 'floating' | null) ?? undefined;
  const justify = (p.justify as 'start' | 'center' | 'end' | 'between' | null) ?? 'between';
  const hasBrand = p.brand != null;
  // Optional leading brand glyph by NAME (closed registry; unknown/absent → none).
  const brandGlyph = typeof p.brandIcon === 'string' && hasIcon(p.brandIcon) ? p.brandIcon : null;
  // `between` pushes items to the far edge from the brand. With no brand it has
  // nothing to push against, so the items container just right-aligns (navItems).
  return (
    <nav
      className={cn(
        navbar({
          variant,
          size: (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined,
          sticky: (p.sticky ?? false) as true | false,
        }),
        // value > variant surface: a model-named bg/border recolors the bar.
        // Token fallback = defence-in-depth (invalid bg on the ungated path).
        p.bg != null && '[background:var(--fr-navbar-bg,var(--color-card))]',
        p.borderColor != null && '[border-color:var(--fr-navbar-border,var(--color-border))]',
      )}
      aria-label={hasBrand ? p.brand ?? undefined : 'Primary'}
      style={styleVars(
        { var: '--fr-navbar-bg', value: p.bg, kind: 'color' },
        { var: '--fr-navbar-border', value: p.borderColor, kind: 'color' },
        // on-surface text — the brand label pairs with `bg` (surface-needs-text rule).
        { var: '--fr-navbar-fg', value: p.color, kind: 'color' },
        // exact bar height — overrides the size-enum height default (padding stays enum).
        { var: '--fr-navbar-h', value: p.height, kind: 'dim', opts: { units: ['px', 'rem'], min: 32, max: 160 } },
      )}
    >
      {hasBrand &&
        (brandGlyph != null ? (
          // WITH a leading glyph: the wordmark sits in a flex row beside the icon.
          // Both ride the on-surface fg chain; `font`/`weight` restyle the wordmark
          // (weight LAST → dedupe-wins over font-semibold). This branch only exists
          // when the model supplied a valid `brandIcon`, so the no-icon path stays
          // byte-identical to the prior single-span render.
          <span
            className={cn(
              'inline-flex min-w-0 max-w-[40%] shrink-0 items-center gap-2 text-[1.0625rem] font-semibold text-[color:var(--fr-navbar-fg,var(--color-foreground))]',
              fontClass(p.font),
              weightClass(p.weight),
            )}
          >
            <span className="shrink-0" aria-hidden>
              <Icon name={brandGlyph} size={20} />
            </span>
            {/* truncate KEPT: the bar is a FIXED-HEIGHT band
                (`[height:var(--fr-navbar-h,…)]`), so the wordmark has a genuine
                single-line contract — a wrapped brand paints outside the bar. The
                cap that makes it fire is proportional (max-w-[40%] on the wrapper),
                not a fixed rem cap, so it relaxes with the viewport. */}
            <span className="min-w-0 truncate" title={p.brand ?? undefined}>{p.brand}</span>
          </span>
        ) : (
          // NO glyph: the exact prior single-span wordmark. `font`/`weight` are the
          // only additions — appended LAST so a set value dedupe-wins; both helpers
          // return undefined (dropped by cn) when unset → BYTE-IDENTICAL default.
          // truncate KEPT for the same reason as the glyph branch: the fixed bar
          // height is a real single-line contract, and the 40% cap is proportional.
          <span
            className={cn(
              'min-w-0 max-w-[40%] shrink-0 truncate text-[1.0625rem] font-semibold text-[color:var(--fr-navbar-fg,var(--color-foreground))]',
              fontClass(p.font),
              weightClass(p.weight),
            )}
            title={p.brand ?? undefined}
          >
            {p.brand}
          </span>
        ))}
      <div className={cn(navItems({ justify }))}>{children}</div>
    </nav>
  );
}
