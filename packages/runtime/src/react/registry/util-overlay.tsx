'use client';
import { useState, useRef, useEffect, useId } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { cn } from '../cn.js';
import { styleVars, shadowClass, motionClass, fontClass, weightClass, trackingClass, leadingClass, FOCUS_RING } from './_style.js';
import { safeColor } from '@frayme/catalog/validate';
import { safeImageSrc } from './url-safety.js';
import { SafeImage } from './_img.js';
import { Icon, hasIcon } from './icons.js';

/* Catalog group (util-overlay): Toggletip · Backdrop · HoverCard · Kbd · Highlight.
 *
 * Same truly-dynamic contract as the rest of the catalog:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (an `accent`/`overlayColor`) NEVER become classes. They land in
 *     a `--fr-<comp>-<role>` var via `styleVars(...)`, read by a STATIC arbitrary
 *     color/background utility binding that var with a token fallback.
 *
 * SECURITY: these render ESCAPED React text only — no spec value ever reaches
 * innerHTML. Highlight builds an array of text nodes + <mark> elements (the
 * query is matched by indexOf scanning, never compiled into a RegExp from spec
 * text). HoverCard's image goes through `safeImageSrc`. Dark mode uses semantic
 * theme tokens (bg-card/border-border/text-foreground) — never a literal-white
 * surface; the only fixed-dark text is the caption OVER the colored scrim.
 *
 * INLINE + SSR friendly: no portal. Click-triggered disclosure (Toggletip) adds
 * outside-click + Escape close; hover disclosure (HoverCard) is mouse/focus.
 */

/* ── side → absolute-position classes for the floating bubble/card ──────────── */
const SIDE_POS: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

/* ════════════════════════════════════════════════════════════════════════════
 * Toggletip — click-to-reveal info bubble
 * ════════════════════════════════════════════════════════════════════════════ */
/* Both of these KEEP their --color-foreground fallback, verified per surface
 * rather than assumed from "it is a tooltip": the trigger paints `bg-muted` and
 * the bubble paints `bg-card`, and an authored Card's `bg` re-points neither (it
 * sets --fr-card-bg). Both are therefore still LIGHT slabs inside an authored
 * `Card { bg:"#12161f" }`, and their text belongs to the fill under it. The bubble
 * is absolutely positioned but NOT portalled, so it does sit inside the authored
 * container — that alone would argue for inheriting, and the opaque fill is what
 * overrules it. Inheriting here would put the card's near-white ink on a near-white
 * card slab: the inherited-foreground bug pointing the other way. */
const tipTrigger = cva(
  `inline-flex items-center justify-center gap-1.5 rounded-frayme border border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))] font-medium outline-none transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/70 ${FOCUS_RING} [color:var(--fr-toggletip-accent,var(--color-foreground))]`,
  {
    variants: {
      size: {
        sm: 'h-6 min-w-6 px-1.5 text-xs',
        md: 'h-7 min-w-7 px-2 text-sm',
        lg: 'h-8 min-w-8 px-2.5 text-base',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

const tipBubble = cva(
  'absolute z-30 w-max max-w-xs rounded-frayme border-2 bg-card px-3 py-2 text-sm [color:var(--fr-toggletip-fg,var(--color-foreground))] shadow-lg [border-color:var(--fr-toggletip-accent,var(--color-border))]',
  {
    variants: {
      size: { sm: 'max-w-[14rem] text-xs', md: 'max-w-xs text-sm', lg: 'max-w-sm text-sm' },
    },
    defaultVariants: { size: 'md' },
  },
);

export function Toggletip({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label?: string | null;
    icon?: string | null;
    content?: string | null;
    ariaLabel?: string | null;
    side?: 'top' | 'bottom' | 'left' | 'right' | null;
    accent?: unknown;
    color?: unknown;
    shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | null;
    motion?: 'none' | 'fast' | 'normal' | 'slow' | null;
    size?: 'sm' | 'md' | 'lg' | null;
  };
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  // The bubble's DOM id, so `aria-expanded` on the trigger names WHAT expanded.
  // Same scheme HoverCard uses below: `useId` is per-INSTANCE, so a row of
  // Toggletips never aims every trigger at the first bubble.
  const bubbleId = useId();
  // The bubble mounts only when there is something to put in it, but the
  // disclosure attributes below used to be emitted unconditionally — so a
  // Toggletip with no content announced "expanded" while pointing aria-controls
  // at an element that never exists. `content` is nullable in the catalog
  // schema, so a VALID spec reaches this. No bubble, no disclosure semantics.
  const hasBubble = p.content != null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const size = p.size ?? 'md';
  const side = p.side ?? 'top';
  const iconName = typeof p.icon === 'string' && hasIcon(p.icon) ? p.icon : 'info';
  // Frozen icon-only-trigger label defaults to the exact current English literal.
  const ariaLabel = typeof p.ariaLabel === 'string' ? p.ariaLabel : 'More information';
  const styles = styleVars(
    { var: '--fr-toggletip-accent', value: p.accent, kind: 'color' },
    { var: '--fr-toggletip-fg', value: p.color, kind: 'color' },
  );

  return (
    <span ref={ref} className="relative inline-flex" style={styles}>
      <button
        type="button"
        className={cn(tipTrigger({ size }), 'cursor-pointer')}
        aria-expanded={hasBubble ? open : undefined}
        aria-controls={hasBubble && open ? bubbleId : undefined}
        aria-haspopup={hasBubble ? 'dialog' : undefined}
        aria-label={p.label == null ? ariaLabel : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          // Consumed, not observed: an Escape that closes this bubble must not
          // travel on to the host UI wrapped around the renderer.
          if (e.key === 'Escape' && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {p.label != null ? <span>{p.label}</span> : <Icon name={iconName} size={size === 'lg' ? 18 : 16} />}
      </button>
      {open && p.content != null && (
        <span id={bubbleId} role="status" className={cn(tipBubble({ size }), SIDE_POS[side] ?? SIDE_POS.top, shadowClass(p.shadow), motionClass(p.motion))}>
          {p.content}
        </span>
      )}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Backdrop — a dimming scrim over a region
 * ════════════════════════════════════════════════════════════════════════════ */
const BLUR_CLS: Record<string, string> = {
  none: '',
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur-md',
  lg: 'backdrop-blur-lg',
};
/* opacity COMPOSES with overlayColor: the scrim fill is color-mix(tint, transparent)
 * at the enum's percentage, so a set overlayColor no longer silently bypasses the
 * opacity enum. Unset stays byte-identical: mixing the #000 fallback at 25/45/65%
 * computes to exactly the prior rgba(0,0,0,0.25/0.45/0.65) fills. */
const OPACITY_CLS: Record<string, string> = {
  light: 'bg-[color:color-mix(in_srgb,var(--fr-backdrop-fill,#000)_25%,transparent)]',
  medium: 'bg-[color:color-mix(in_srgb,var(--fr-backdrop-fill,#000)_45%,transparent)]',
  heavy: 'bg-[color:color-mix(in_srgb,var(--fr-backdrop-fill,#000)_65%,transparent)]',
};
const ZONE_CLS: Record<string, string> = {
  fill: 'inset-0 rounded-[inherit]',
  inset: 'inset-2 rounded-frayme',
  rounded: 'inset-0 rounded-frayme',
};

export function Backdrop({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    active?: boolean | null;
    blur?: 'none' | 'sm' | 'md' | 'lg' | null;
    overlayColor?: unknown;
    opacity?: 'light' | 'medium' | 'heavy' | null;
    label?: string | null;
    zone?: 'fill' | 'inset' | 'rounded' | null;
  };
  const active = p.active === true;
  const blur = p.blur ?? 'sm';
  const opacity = p.opacity ?? 'medium';
  const zone = p.zone ?? 'fill';
  // overlayColor (validated) supplies the scrim TINT via the var; the opacity
  // enum's color-mix percentage still applies on top (see OPACITY_CLS).
  const styles: CSSProperties = styleVars({ var: '--fr-backdrop-fill', value: p.overlayColor, kind: 'color' });

  return (
    <div className="relative">
      {children}
      {active && (
        <>
          {/* the dimming scrim is purely decorative */}
          <div
            aria-hidden
            className={cn(
              'absolute z-30 transition-opacity',
              ZONE_CLS[zone] ?? ZONE_CLS.fill,
              OPACITY_CLS[opacity] ?? OPACITY_CLS.medium,
              BLUR_CLS[blur] ?? BLUR_CLS.sm,
            )}
            style={styles}
          />
          {/* the caption is announced (role=status) and sits on its OWN fixed-dark
              chip so contrast holds regardless of the (spec-tinted) scrim colour */}
          {p.label != null && (
            <div className={cn('pointer-events-none absolute z-40 flex items-center justify-center', ZONE_CLS[zone] ?? ZONE_CLS.fill)}>
              <span role="status" aria-live="polite" className="rounded-frayme bg-black/65 px-3 py-1.5 text-sm font-medium text-white shadow">
                {p.label}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * HoverCard — reveal a rich card on hover / focus
 * ════════════════════════════════════════════════════════════════════════════ */
const hoverCardBox =
  // The accent arbitrary is the SOLE border-color source (its fallback = the
  // border token, so unset stays byte-identical); no co-located border-border —
  // it would win the cascade and make the accent card-border inert.
  // The width cap keeps the card inside the viewport on narrow surfaces (MCP panels).
  // `bg-card` is an OPAQUE token fill, so the card's own title/description below
  // keep their --color-foreground / --color-muted-foreground fallbacks (same
  // verified-per-surface call as the Toggletip bubble above); only the TRIGGER,
  // which paints nothing, joined the inherited-ink fix.
  'absolute z-30 w-64 max-w-[calc(100vw-2rem)] rounded-frayme border bg-card p-3 text-left shadow-lg [border-color:var(--fr-hovercard-accent,var(--color-border))]';

/* The notch that ties the floating card back to its trigger. It rides the card's
 * own border var and covers the border segment behind it (a child paints over the
 * parent's border), so the two lit edges read as one continuous outline. It must
 * stay a direct child of the card box: it is positioned against the card's own
 * padding box and hangs past its edge. */
const hoverCardArrow = 'absolute h-2.5 w-2.5 rotate-45 bg-card [border-color:var(--fr-hovercard-accent,var(--color-border))]';
const ARROW_POS: Record<string, string> = {
  top: 'bottom-[-0.3125rem] left-1/2 -ml-[0.3125rem] border-b border-r',
  bottom: 'top-[-0.3125rem] left-1/2 -ml-[0.3125rem] border-l border-t',
  left: 'right-[-0.3125rem] top-1/2 -mt-[0.3125rem] border-r border-t',
  right: 'left-[-0.3125rem] top-1/2 -mt-[0.3125rem] border-b border-l',
};

export function HoverCard({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    trigger?: string | null;
    title?: string | null;
    description?: string | null;
    imageSrc?: unknown;
    side?: 'top' | 'bottom' | 'left' | 'right' | null;
    accent?: unknown;
    color?: unknown;
    mutedColor?: unknown;
    shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | null;
    motion?: 'none' | 'fast' | 'normal' | 'slow' | null;
  };
  const [open, setOpen] = useState(false);
  const side = p.side ?? 'bottom';
  const img = safeImageSrc(p.imageSrc);
  const styles = styleVars(
    { var: '--fr-hovercard-accent', value: p.accent, kind: 'color' },
    { var: '--fr-hovercard-fg', value: p.color, kind: 'color' },
    { var: '--fr-hovercard-muted', value: p.mutedColor, kind: 'color' },
  );
  const cardId = useId();
  const hasCard = p.title != null || p.description != null || img != null;

  // Escape has to close a card opened by HOVER too — no element holds focus in
  // that path, so a trigger-local onKeyDown would never see the key.
  //
  // The key is CONSUMED here: the renderer only ever draws inside a host UI, and
  // an Escape that closes this card must not also travel on and close the host's
  // own dialog. Stopping at document (bubble) keeps sibling overlays on the same
  // node — a modal above this card — free to close on the same key.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span
      className="relative inline-flex"
      style={styles}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        // Every affordance below promises a card, so all of them hang off hasCard:
        // the keyboard stop and the help cursor must not advertise an explanation
        // that has no props to render. When there IS a card the trigger must be
        // focusable in both shapes — focus is the only pointer-free way to open it.
        tabIndex={hasCard ? 0 : undefined}
        role={hasCard && p.trigger != null ? 'button' : undefined}
        aria-describedby={open && hasCard ? cardId : undefined}
        className={cn(
          // flex-wrap, because this trigger wraps ARBITRARY children: given a
          // six-badge group it laid them on one 614px line inside a 142px
          // wrapper and overran the surface by 407px. Wrapping is the safe
          // lever here; `min-w-0` is not.
          // Letting a flex item shrink below min-content is exactly the
          // shattered-text defect (a title rendered one character per line),
          // so the fix that removes the overflow must not be the one that
          // re-creates that.
          // min-h-6 = 24px, the WCAG 2.5.8 target floor. This trigger is
          // FOCUSABLE (tabIndex 0 whenever it has a card), so it is a target,
          // and wrapping a Badge it measured 23px — one pixel short. Trivial
          // individually, but it is a real keyboard/touch target every time.
          // min-h, not h: a trigger wrapping taller content must still grow.
          'inline-flex min-h-6 flex-wrap items-center rounded-sm outline-none',
          hasCard && `cursor-help ${FOCUS_RING}`,
          // the string-trigger UNDERLINE applies ONLY when WE own the trigger; when
          // wrapping children we stay a plain inline wrapper so the child keeps its
          // own role/decoration (no nested-interactive role=button).
          //
          // `text-current`, not `text-foreground`: this trigger paints NO fill of
          // its own (the card below does; the trigger is a word in the running
          // text), so it inherits its surface and a reset to the global token is
          // the inherited-foreground defect — an authored `Card { bg:"#12161f",
          // color:"#e2e6f0" }` had the trigger snap back to rgb(24,24,27),
          // contrast 1.02 on dark navy.
          // Identical at the top level (frayme.css sets both `.frayme-root
          // { color }` and --color-foreground to --frayme-fg); on the `color`
          // property currentColor computes to the INHERITED value, not a cycle.
          // The dotted underline already rides `currentColor`, so the word and its
          // decoration now come from one source.
          hasCard && p.trigger != null &&
            'font-medium text-current underline decoration-dotted decoration-from-font underline-offset-4 [text-decoration-color:var(--fr-hovercard-accent,currentColor)]',
        )}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {p.trigger != null ? p.trigger : children}
      </span>
      {open && hasCard && (
        <span id={cardId} role="tooltip" className={cn(hoverCardBox, SIDE_POS[side] ?? SIDE_POS.bottom, shadowClass(p.shadow), motionClass(p.motion))}>
          <span aria-hidden className={cn(hoverCardArrow, ARROW_POS[side] ?? ARROW_POS.bottom)} />
          {/* The card sits offset from the trigger and closes on the wrapper's
              mouseleave, so the pointer can never travel into it — whatever the panel
              does not show outright is unreachable. The body must therefore stay
              unclamped and unbounded: it grows to fit the full text. */}
          <span className="flex items-start gap-3">
            {img != null && (
              <SafeImage
                src={img}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
                fallback={null}
              />
            )}
            <span className="flex min-w-0 flex-col gap-0.5">
              {p.title != null && <span className="text-sm font-semibold break-words [color:var(--fr-hovercard-fg,var(--color-foreground))]">{p.title}</span>}
              {p.description != null && (
                <span className="text-[0.8125rem] leading-snug break-words [color:var(--fr-hovercard-muted,var(--color-muted-foreground))]">{p.description}</span>
              )}
            </span>
          </span>
        </span>
      )}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Kbd — a keyboard-key glyph
 * ════════════════════════════════════════════════════════════════════════════ */
/* The base ink falls back to `currentColor` and the SOLID variant re-declares the
 * token, because the two variants sit on different surfaces:
 *   - `outline` is bg-TRANSPARENT — its surface is whatever contains it, so inside
 *     an authored `Card { bg:"#12161f", color:"#e2e6f0" }` a --color-foreground reset
 *     painted a near-black glyph on dark navy (the 1.02 contrast class). It must
 *     inherit.
 *   - `solid` paints its OWN opaque fill, [background:var(--fr-kbd-bg,
 *     var(--color-muted))]. Card's authored `bg` sets --fr-card-bg, never
 *     --color-muted, so that key stays a LIGHT slab inside a dark card and its
 *     glyph belongs to the fill — inheriting the card's light ink there would be
 *     the same bug pointing the other way.
 * Both forms are the arbitrary-property `[color:…]` (not `text-[color:…]`), which
 * is what makes tw-merge dedupe them: the two forms are DIFFERENT groups and would
 * otherwise both survive, with stylesheet order deciding. Variant classes come
 * after the base, so solid's token wins for solid and nothing overrides outline.
 * Unset → both resolve to --frayme-fg at the top level (frayme.css points
 * `.frayme-root { color }` and --color-foreground at the same var), so neither
 * variant's default render moves. */
const kbdChip = cva(
  'inline-flex items-center justify-center rounded-frayme border font-medium [color:var(--fr-kbd-fg,currentColor)]',
  {
    variants: {
      size: {
        sm: 'h-5 min-w-5 px-1 text-[0.6875rem]',
        md: 'h-6 min-w-6 px-1.5 text-xs',
        lg: 'h-7 min-w-7 px-2 text-sm',
      },
      variant: {
        // the solid fill reads the --fr-kbd-bg channel (muted token fallback inside
        // → byte-identical when unset) as the SOLE background source — a bare bg-muted
        // beside an arbitrary [background:var()] would NOT dedupe (the tw-merge trap). The
        // 3D key-lip shadow chains the SAME border var as the chip border so a custom
        // borderColor keeps a matching lip (border token fallback inside).
        solid: '[border-color:var(--fr-kbd-border,var(--color-border))] [background:var(--fr-kbd-bg,var(--color-muted))] [color:var(--fr-kbd-fg,var(--color-foreground))] shadow-[0_1px_0_var(--fr-kbd-border,var(--color-border))]',
        outline: '[border-color:var(--fr-kbd-border,var(--color-border))] bg-transparent',
      },
    },
    defaultVariants: { size: 'md', variant: 'solid' },
  },
);

export function Kbd({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    keys?: string | string[] | null;
    size?: 'sm' | 'md' | 'lg' | null;
    variant?: 'solid' | 'outline' | null;
    color?: unknown;
    mutedColor?: unknown;
    borderColor?: unknown;
    // chip fill (solid variant only) + a Font enum for the whole region so a
    // mono/display theme font can style the shortcut (the base was hardcoded font-sans).
    bg?: unknown;
    font?: string | null;
  };
  const size = p.size ?? 'md';
  const variant = p.variant ?? 'solid';
  const raw = p.keys;
  const keys = (Array.isArray(raw) ? raw : raw != null ? [raw] : []).filter(
    (k): k is string => typeof k === 'string' && k.length > 0,
  );
  if (keys.length === 0) return null;

  return (
    <span
      // the closed Font enum → a static font-* utility on the region; unset keeps
      // the base font-sans (fontClass(null) → undefined → dropped → byte-identical).
      className={cn('inline-flex items-center gap-1 align-middle font-sans', fontClass(p.font))}
      style={styleVars(
        { var: '--fr-kbd-fg', value: p.color, kind: 'color' },
        { var: '--fr-kbd-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-kbd-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-kbd-bg', value: p.bg, kind: 'color' },
      )}
    >
      {keys.map((k, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && (
            <span className="text-xs [color:var(--fr-kbd-muted,var(--color-muted-foreground))]" aria-hidden>
              +
            </span>
          )}
          <kbd className={cn(kbdChip({ size, variant }))}>{k}</kbd>
        </span>
      ))}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Highlight — mark matched substrings within text (search results)
 * ════════════════════════════════════════════════════════════════════════════ */
/* The semantic marks are ALPHA WASHES (25%/40% of a tone token over nothing), so
 * the pixels behind the matched word are 60-75% the surface the Highlight is
 * sitting on — they inherit, and `text-current` is what says so. `text-foreground`
 * reset them to the global token instead: inside an authored `Card { bg:"#12161f",
 * color:"#e2e6f0" }` a warning mark painted near-black ink over a 40% wash of a
 * dark navy card, the 1.02-contrast class.
 * `neutral` is the exception and KEEPS the token: bg-muted is an OPAQUE token fill
 * that an authored `bg` never re-points (Card's bg sets --fr-card-bg), so that
 * mark is still a light slab inside a dark card and its text belongs to it.
 * Identical at the top level either way — frayme.css points `.frayme-root
 * { color }` and --color-foreground at the same --frayme-fg. */
const TONE_MARK: Record<string, string> = {
  neutral: 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-foreground',
  success: 'bg-success/25 text-current',
  warning: 'bg-warning/40 text-current',
  critical: 'bg-danger/25 text-current',
  info: 'bg-info/25 text-current',
};

/** Word-boundary test using the chars on either side of a match (no RegExp on
 *  spec text — pure index inspection). */
function isWordChar(ch: string | undefined): boolean {
  return ch != null && /[\p{L}\p{N}_]/u.test(ch);
}

export function Highlight({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    text?: string | null;
    query?: string | null;
    caseSensitive?: boolean | null;
    wholeWord?: boolean | null;
    tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null;
    accent?: unknown;
    accentText?: unknown;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const text = typeof p.text === 'string' ? p.text : '';
  const queryRaw = typeof p.query === 'string' ? p.query : '';
  const caseSensitive = p.caseSensitive === true;
  const wholeWord = p.wholeWord === true;
  const tone = p.tone ?? 'warning';

  // Per-match background: a validated accent wins, else the tone token class.
  const safeAccent = safeColor(p.accent);
  const markStyle: CSSProperties = safeAccent != null ? { background: 'var(--fr-highlight-accent)' } : {};
  // On-fill text: a model-named accentText paints the mark text so a saturated
  // accent fill stays legible. The `the text-colour group form` group form (added LAST)
  // dedupes-and-wins over any text-* utility; defaults to the foreground token.
  // This branch KEEPS --color-foreground (it did not join the inherited-ink fix
  // applied to the washes in TONE_MARK): it only runs when `accent` VALIDATED, so
  // the mark paints an opaque author-named fill of its own, and inheriting a dark
  // card's near-white ink onto a pale highlighter would erase the match.
  const markClass = safeAccent != null
    ? cn('rounded-[2px] px-0.5', 'text-[color:var(--fr-highlight-accent-text,var(--color-foreground))]')
    : cn(TONE_MARK[tone] ?? TONE_MARK.warning, 'rounded-[2px] px-0.5');
  const wrapStyle = styleVars(
    { var: '--fr-highlight-accent', value: p.accent, kind: 'color' },
    { var: '--fr-highlight-accent-text', value: p.accentText, kind: 'color' },
    { var: '--fr-highlight-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
  );
  // Typography on the ROOT span (the whole displayed text — marks inherit): the
  // closed enums → static utilities (undefined when unset → dropped, byte-identical).
  // There is no baked font-size here (the text inherits), so the base var-chain
  // falls back to `inherit` and an exact --fr-highlight-fs wins only when set.
  const wrapClass = cn(
    '[font-size:var(--fr-highlight-fs,inherit)]',
    fontClass(p.font),
    weightClass(p.weight),
    trackingClass(p.tracking),
    leadingClass(p.leading),
  );

  // Space-split terms; longest first so a longer term wins an overlap.
  const terms = queryRaw
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .sort((a, b) => b.length - a.length);

  if (text.length === 0 || terms.length === 0) {
    return <span className={wrapClass} style={wrapStyle}>{text}</span>;
  }

  const hay = caseSensitive ? text : text.toLowerCase();
  const needles = caseSensitive ? terms : terms.map((t) => t.toLowerCase());

  // Scan with indexOf (no RegExp built from spec text). Collect non-overlapping
  // match ranges, leftmost-then-longest.
  const ranges: Array<[number, number]> = [];
  let pos = 0;
  while (pos < text.length) {
    let best = -1;
    let bestLen = 0;
    for (const n of needles) {
      if (n.length === 0) continue;
      // whole-word filter: advance PAST occurrences that fail the boundary test
      // (e.g. "test" inside "testing") to the next real occurrence of THIS term,
      // instead of abandoning the term at its first substring hit.
      let idx = hay.indexOf(n, pos);
      while (idx !== -1 && wholeWord && (isWordChar(text[idx - 1]) || isWordChar(text[idx + n.length]))) {
        idx = hay.indexOf(n, idx + 1);
      }
      if (idx === -1) continue;
      if (best === -1 || idx < best || (idx === best && n.length > bestLen)) {
        best = idx;
        bestLen = n.length;
      }
    }
    if (best === -1) break;
    ranges.push([best, best + bestLen]);
    pos = best + bestLen;
  }

  if (ranges.length === 0) {
    return <span className={wrapClass} style={wrapStyle}>{text}</span>;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) nodes.push(<span key={`t${i}`}>{text.slice(cursor, start)}</span>);
    nodes.push(
      <mark key={`m${i}`} className={markClass} style={markStyle}>
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>);

  return <span className={wrapClass} style={wrapStyle}>{nodes}</span>;
}
