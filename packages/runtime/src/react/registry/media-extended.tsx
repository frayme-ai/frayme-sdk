'use client';
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { cn } from '../cn.js';
import { styleVars, borderStyleClass, opacityClass, aspectClass } from './_style.js';
import { safeUrl, safeImageSrc, linkTargetRel } from './url-safety.js';
import { SafeImage } from './_img.js';

/* Catalog group (media-extended): VideoPlayer · AudioPlayer · Marquee · Figure · Thumbnail.
 *
 * Same truly-dynamic contract as the shipped components:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (a named `accent` color, a `width` length) NEVER become classes —
 *     they land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities. styleVars re-validates +
 *     omits any failing/absent value so the token fallback wins (props-less → polished).
 *
 * MEDIA SECURITY (non-negotiable): every spec `src`/`poster` is scheme-checked at the
 * point of use — a media URL through `safeUrl` (rejects javascript:/data:text/html), a
 * raster image through `safeImageSrc` (http/https + raster data: only; svg+xml + blob:
 * rejected). An invalid/absent value renders a muted PLACEHOLDER, never an active
 * resource. No <video>/<audio> ever gets custom JS controls or capture — native
 * `controls` only; `autoplay` forces `muted` + `playsInline`. All text (caption,
 * items, initials) is rendered as ESCAPED React text nodes, never markup.
 */

/* ── shared enum maps ─────────────────────────────────────────────────────── */
const RADIUS = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-frayme',
  lg: 'rounded-2xl',
  full: 'rounded-full',
} as const;
type RadiusKey = keyof typeof RADIUS;

/* Per-component radius VAR-CHAIN — replaces the shared
 * RADIUS[...] utility on the TARGET element ONLY (the shared map stays untouched
 * for every other component). The `radius` enum sets a scoped
 * `--fr-<comp>-radius-default` whose value reproduces the prior rounded-* exactly
 * (none=0, sm=0.25rem, md=var(--radius-frayme), lg=rounded-2xl=1rem,
 * full=rounded-full=9999px). styleVars sets `--fr-<comp>-radius` from radiusValue,
 * which WINS when present; an arbitrary border-radius reading the var-chain never
 * dedupes against a rounded-* utility, so we drop the utility entirely. */
const RADIUS_DEFAULT_VAR: Record<string, string> = {
  none: '0px',
  sm: '0.25rem',
  md: 'var(--radius-frayme)',
  lg: '1rem',
  full: '9999px',
};
/** The scoped default-var class for `radius` on a given component, e.g.
 *  radiusDefaultClass('video','md') → '[--fr-video-radius-default:var(--radius-frayme)]'. */
function radiusDefaultClass(comp: string, radius: RadiusKey): string {
  return '[--fr-' + comp + '-radius-default:' + (RADIUS_DEFAULT_VAR[radius] ?? RADIUS_DEFAULT_VAR.md) + ']';
}
/** The element's border-radius read for a given component's var-chain. */
function radiusReadClass(comp: string): string {
  return '[border-radius:var(--fr-' + comp + '-radius,var(--fr-' + comp + '-radius-default,var(--radius-frayme)))]';
}

/* Aspect-ratio enum → a static Tailwind aspect class. The keys ARE the enum the
 * model picks; never a spec-supplied ratio string. */
const VIDEO_ASPECT: Record<string, string> = {
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
  '21/9': 'aspect-[21/9]',
  '3/2': 'aspect-[3/2]',
  '3/4': 'aspect-[3/4]',
  auto: 'aspect-auto',
};
const FIGURE_RATIO: Record<string, string> = {
  auto: '',
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
  // 21/9 — the ultrawide/cinematic frame. VIDEO_ASPECT above has carried it all
  // along; Figure's narrower list did not, so an author asking for a panoramic
  // figure got a schema rejection for a ratio the renderer already understood.
  '21/9': 'aspect-[21/9]',
  '3/2': 'aspect-[3/2]',
};

/* A muted, aspect-locked placeholder box with a centered glyph (used when a media
 * src is missing/invalid). Pure OUR markup — never spec text. */
function MediaPlaceholder({ label, glyph }: { label: string; glyph: ReactNode }): ReactNode {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-full w-full items-center justify-center bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-muted-foreground"
    >
      <span className="flex flex-col items-center gap-1 text-xs">
        {glyph}
        <span>{label}</span>
      </span>
    </div>
  );
}

const PlayGlyph = (
  <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="9" />
    <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
  </svg>
);
/* Toggle glyphs for the Marquee stop/start control — OUR markup, never spec text. */
const PauseBars = (
  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="currentColor">
    <rect x="7" y="5" width="3.5" height="14" rx="1" />
    <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
  </svg>
);
const PlayTriangle = (
  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="currentColor">
    <path d="M8 5l11 7-11 7V5z" />
  </svg>
);

const ImageGlyph = (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M4 18l5-5 4 4 3-3 4 4" />
  </svg>
);

/* ── VideoPlayer ──────────────────────────────────────────────────────────── */

export function VideoPlayer({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    src?: string | null;
    poster?: string | null;
    controls?: boolean | null;
    autoplay?: boolean | null;
    loop?: boolean | null;
    muted?: boolean | null;
    aspect?: string | null;
    radius?: RadiusKey | null;
    radiusValue?: string | number | null;
    width?: string | number | null;
    caption?: string | null;
    mutedColor?: string | null;
    borderColor?: string | null;
    borderStyle?: string | null;
    opacity?: string | null;
  };
  const radius = (p.radius as RadiusKey | null) ?? 'md';
  const aspectClass = VIDEO_ASPECT[p.aspect ?? '16/9'] ?? VIDEO_ASPECT['16/9'];
  // safeUrl rejects javascript:/data:text/html (returns '#'); treat '#' as absent.
  const safeSrc = p.src != null ? safeUrl(p.src) : '#';
  const src = safeSrc !== '#' ? safeSrc : null;
  const poster = safeImageSrc(p.poster) ?? undefined;
  const autoplay = p.autoplay === true;
  // autoplay → muted + inline (browser policy + no surprise audio).
  const muted = autoplay || p.muted === true;
  const controls = p.controls !== false;

  return (
    <figure
      className={cn('m-0 flex flex-col gap-2 [width:var(--fr-video-width,100%)] max-w-full', opacityClass(p.opacity))}
      style={styleVars(
        { var: '--fr-video-width', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 1600 } },
        { var: '--fr-video-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-video-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-video-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
    >
      {/* The frame border reads the media-family borderColor channel (group form,
          token fallback) — every sibling (AudioPlayer/Figure/Thumbnail/YouTube)
          exposes it, so a themed page can tint all media frames coherently. */}
      <div
        className={cn(
          'relative w-full overflow-hidden border border-[color:var(--fr-video-border,var(--color-border))] bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
          borderStyleClass(p.borderStyle),
          aspectClass,
          radiusDefaultClass('video', radius),
          radiusReadClass('video'),
        )}
      >
        {src ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            controls={controls}
            autoPlay={autoplay}
            loop={p.loop === true}
            muted={muted}
            playsInline={autoplay}
            poster={poster}
            preload="metadata"
          >
            <source src={src} />
          </video>
        ) : (
          <div className="absolute inset-0">
            <MediaPlaceholder label="No video" glyph={PlayGlyph} />
          </div>
        )}
      </div>
      {typeof p.caption === 'string' && p.caption.length > 0 && (
        <figcaption className="text-xs [color:var(--fr-video-muted,var(--color-muted-foreground))]">{p.caption}</figcaption>
      )}
    </figure>
  );
}

/* ── AudioPlayer ──────────────────────────────────────────────────────────── */

export function AudioPlayer({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    src?: string | null;
    title?: string | null;
    controls?: boolean | null;
    loop?: boolean | null;
    accent?: string | null;
    borderColor?: string | null;
    borderStyle?: string | null;
    radius?: RadiusKey | null;
    radiusValue?: string | number | null;
    width?: string | number | null;
    opacity?: string | null;
  };
  const radius = (p.radius as RadiusKey | null) ?? 'md';
  const safeSrc = p.src != null ? safeUrl(p.src) : '#';
  const src = safeSrc !== '#' ? safeSrc : null;
  const controls = p.controls !== false;

  return (
    // Media-family channel group {width, opacity, borderColor(+style)}: the width
    // var-chain is the SOLE width source (100% fallback = the prior w-full), so
    // the channel is never inert next to a w-* utility.
    <div
      className={cn(
        'flex [width:var(--fr-audio-width,100%)] max-w-full flex-col gap-2 border border-l-4 bg-card p-3 [border-color:var(--fr-audio-border,var(--color-border))] [border-left-color:var(--fr-audio-accent,var(--color-border))]',
        borderStyleClass(p.borderStyle),
        radiusDefaultClass('audio', radius),
        radiusReadClass('audio'),
        opacityClass(p.opacity),
      )}
      style={styleVars(
        { var: '--fr-audio-accent', value: p.accent, kind: 'color' },
        { var: '--fr-audio-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-audio-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        { var: '--fr-audio-width', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 1600 } },
      )}
    >
      {typeof p.title === 'string' && p.title.length > 0 && (
        <span className="text-sm font-medium [color:var(--fr-audio-accent,var(--color-foreground))]">{p.title}</span>
      )}
      {src ? (
        <audio className="w-full" controls={controls} loop={p.loop === true} preload="metadata">
          <source src={src} />
        </audio>
      ) : (
        <span className="text-xs text-muted-foreground" role="img" aria-label="No audio">
          No audio
        </span>
      )}
    </div>
  );
}

/* ── Marquee ──────────────────────────────────────────────────────────────────
 * An auto-scrolling strip. The viewport carries `.fr-marquee` (overflow clip) and
 * the moving row carries `.fr-marquee-track`; direction is a `data-fr-marquee-dir`
 * attribute and duration is the inline `--fr-marquee-duration` var (a FIXED map from
 * the `speed` enum, never spec text). pauseOnHover adds `.fr-marquee-pause`. The
 * keyframes for those classes/var live centrally in frayme.css (see notes). Content
 * is duplicated twice for a seamless loop and rendered as ESCAPED text.
 *
 * MOTION CONTROL (non-negotiable): an infinite loop needs a stop that a pointer is
 * not required to reach, so the strip always ships a labelled toggle sitting OUTSIDE
 * the clipping viewport (a control inside the `role="img"` box would be invisible to
 * assistive tech, and inside a scroller it would scroll away). The stop is asserted
 * on the track inline so it holds no matter which selectors the stylesheet keys the
 * pause on; `data-fr-marquee-paused` mirrors it for the stylesheet. */

const SPEED_DURATION: Record<string, string> = { slow: '28s', normal: '18s', fast: '10s' };
const MARQUEE_GAP: Record<string, string> = {
  none: 'gap-0',
  sm: 'gap-3',
  md: 'gap-6',
  lg: 'gap-10',
  xl: 'gap-16',
};
/* Item text-size enum: md reproduces the prior `text-sm` byte-identically
 * (its bundled line-height is inert on an inline span), so an unset marquee is
 * unchanged; sm/lg give the muted-ticker vs loud-logo-cloud range. */
const MARQUEE_TEXT: Record<string, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

export function Marquee({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    items?: string[] | null;
    direction?: 'left' | 'right' | 'up' | 'down' | null;
    speed?: 'slow' | 'normal' | 'fast' | null;
    pauseOnHover?: boolean | null;
    gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | null;
    fade?: boolean | null;
    opacity?: string | null;
    color?: string | null;
    size?: 'sm' | 'md' | 'lg' | null;
    height?: string | number | null;
  };
  const direction = (p.direction as string | null) ?? 'left';
  const duration = SPEED_DURATION[p.speed ?? 'normal'] ?? SPEED_DURATION.normal;
  const gapClass = MARQUEE_GAP[p.gap ?? 'md'] ?? MARQUEE_GAP.md;
  const textClass = MARQUEE_TEXT[p.size ?? 'md'] ?? MARQUEE_TEXT.md;
  const pauseOnHover = p.pauseOnHover !== false;
  const vertical = direction === 'up' || direction === 'down';
  const [paused, setPaused] = useState(false);

  const items = (Array.isArray(p.items) ? p.items : []).filter((s): s is string => typeof s === 'string');
  const hasItems = items.length > 0;

  // The content of one "lane"; duplicated twice for a seamless loop. Item text
  // reads the `size` enum (font-size) + the `color` channel (--fr-marquee-fg,
  // foreground-token fallback → SOLE color source, so no baked text-foreground).
  const lane = (key: string): ReactNode =>
    hasItems ? (
      <div key={key} className={cn('flex shrink-0', vertical ? 'flex-col' : 'flex-row', gapClass)} aria-hidden={key === 'b'}>
        {items.map((it, i) => (
          // A HORIZONTAL ticker earns its nowrap: the track is `w-max` and slides
          // along the x-axis, so a one-line item overflows into the animation
          // rather than being cut — that IS the marquee contract.
          // A VERTICAL one does not: the track slides on y while the viewport
          // clips x (overflow-hidden), so a nowrap item longer than the column
          // was silently sliced at the right edge with no ellipsis and nothing
          // to scroll. Vertical items wrap inside the column instead.
          <span key={i} className={cn(vertical ? 'break-words' : 'whitespace-nowrap', 'text-[color:var(--fr-marquee-fg,var(--color-foreground))]', textClass)}>
            {it}
          </span>
        ))}
      </div>
    ) : (
      <div key={key} className={cn('flex shrink-0', vertical ? 'flex-col' : 'flex-row', gapClass)} aria-hidden={key === 'b'}>
        {children}
      </div>
    );

  const fadeMask = p.fade === true
    ? vertical
      ? '[mask-image:linear-gradient(to_bottom,transparent,#000_12%,#000_88%,transparent)]'
      : '[mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]'
    : '';

  return (
    <div className={cn('flex w-full items-center gap-2', opacityClass(p.opacity))}>
      <div
        className={cn(
          'fr-marquee relative min-w-0 flex-1 overflow-hidden',
          // Vertical viewport height via a var-chain: the token fallback
          // = the prior `h-48` (12rem), byte-identical unset; a model `height` wins.
          // (Vertical is ≥24px by construction — the height var floors at 24 and
          // defaults to 12rem — so the target floor below is a horizontal-only job.)
          //
          // HORIZONTAL: HIT AREA (WCAG 2.5.8). This box carries tabIndex={0} on
          // purpose, so the accessibility audit counts it as a target. Its height
          // was nothing but the ticker's line box —
          // 16px at size sm, 20px at md.
          // The criterion alone would be arguable (2.5.8 measures POINTER targets
          // and this box has no activation), but the reduced-motion mode settles
          // it: frayme.css turns this exact element into
          // `overflow-x:auto; scrollbar-width:thin` when motion is reduced, and a
          // classic thin scrollbar is ~11px — inside a 16-20px viewport that
          // leaves under half a line of text and a scrollbar too thin to grab.
          // 24px is bought for that scroller, not to quiet the audit.
          // min-h-6, not h-6: `size: lg` items are text-base (24px line) and must
          // still set the height themselves.
          // `content-center` (align-content on a BLOCK container) keeps the ticker
          // optically centred in the taller box instead of parking it at the top;
          // where it is unsupported it is ignored and the ticker sits exactly where
          // it does now. It must NOT reach the vertical case — that track
          // deliberately OVERFLOWS its fixed height, and centring an overflowing
          // child would shift the translateY(-50%) loop's origin.
          vertical ? '[height:var(--fr-marquee-h,12rem)]' : 'min-h-6 content-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          fadeMask,
        )}
        role="img"
        aria-label={hasItems ? `Scrolling: ${items.join(', ')}` : 'Scrolling content'}
        // Where motion is reduced the stylesheet turns this box into a scroller so the
        // parked track stays reachable, and a scroller has to take keyboard focus. The
        // tab stop is unconditional — the renderer cannot read a media query.
        tabIndex={0}
        data-fr-marquee-dir={direction}
        data-fr-marquee-paused={paused ? 'true' : undefined}
        style={{
          '--fr-marquee-duration': duration,
          ...styleVars(
            { var: '--fr-marquee-fg', value: p.color, kind: 'color' },
            // vertical-only exact height — omitted when horizontal (moot there).
            { var: '--fr-marquee-h', value: vertical ? p.height : null, kind: 'dim', opts: { units: ['px', 'rem'], min: 24, max: 800 } },
          ),
        } as CSSProperties}
      >
        <div
          className={cn(
            'fr-marquee-track flex',
            // Horizontal: `w-max` is the moving rail itself — the track must be
            // as wide as its content for the −50% x-loop to read as continuous.
            // Vertical: the loop is on y, so the track takes the viewport width
            // and its items wrap into it (w-max is max-content sizing, which
            // would suppress the wrapping the items now ask for).
            vertical ? 'w-full flex-col' : 'w-max flex-row',
            gapClass,
            pauseOnHover && 'fr-marquee-pause',
          )}
          // A fixed keyword, never a spec value: the hover/focus pause hook is opt-out
          // via `pauseOnHover`, so the toggle cannot depend on that class being present.
          style={paused ? ({ animationPlayState: 'paused' } as CSSProperties) : undefined}
        >
          {lane('a')}
          {lane('b')}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((v) => !v)}
        aria-pressed={paused}
        aria-label={paused ? 'Play scrolling content' : 'Pause scrolling content'}
        className="fr-marquee-toggle grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {paused ? PlayTriangle : PauseBars}
      </button>
    </div>
  );
}

/* ── Figure ───────────────────────────────────────────────────────────────── */

const figureAlign = cva('m-0 flex flex-col gap-2', {
  variants: {
    align: { start: 'items-start text-left', center: 'items-center text-center', end: 'items-end text-right' },
  },
  defaultVariants: { align: 'center' },
});

export function Figure({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    src?: string | null;
    alt?: string | null;
    caption?: string | null;
    credit?: string | null;
    align?: 'start' | 'center' | 'end' | null;
    ratio?: string | null;
    fit?: 'cover' | 'contain' | null;
    radius?: RadiusKey | null;
    radiusValue?: string | number | null;
    bordered?: boolean | null;
    borderColor?: string | null;
    borderStyle?: string | null;
    width?: string | number | null;
    mutedColor?: string | null;
    opacity?: string | null;
  };
  const radius = (p.radius as RadiusKey | null) ?? 'md';
  const align = (p.align as 'start' | 'center' | 'end' | null) ?? 'center';
  const ratioClass = FIGURE_RATIO[p.ratio ?? 'auto'] ?? '';
  // Object-fit under a locked `ratio`: cover (default, byte-identical)
  // crops to fill; contain letterboxes so a chart/diagram is never cropped, with
  // a bg-muted mat behind the letterbox. Only meaningful when a ratio is set.
  const fit = (p.fit as 'cover' | 'contain' | null) ?? 'cover';
  const objectFitClass = fit === 'contain' ? 'object-contain' : 'object-cover';
  const src = safeImageSrc(p.src);
  const alt = typeof p.alt === 'string' ? p.alt : '';
  const bordered = p.bordered === true;
  const hasCaption = typeof p.caption === 'string' && p.caption.length > 0;
  const hasCredit = typeof p.credit === 'string' && p.credit.length > 0;

  return (
    <figure
      className={cn(figureAlign({ align }), '[width:var(--fr-figure-width,100%)] max-w-full', opacityClass(p.opacity))}
      style={styleVars(
        { var: '--fr-figure-width', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 1600 } },
        { var: '--fr-figure-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-figure-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-figure-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden',
          ratioClass,
          // contain letterboxing needs a mat behind the image (only when a ratio
          // locks the frame — with `auto` the image sets the box, no letterbox).
          ratioClass && fit === 'contain' && 'bg-muted',
          radiusDefaultClass('figure', radius),
          radiusReadClass('figure'),
          bordered && cn('border [border-color:var(--fr-figure-border,var(--color-border))]', borderStyleClass(p.borderStyle)),
          !src && (ratioClass || 'aspect-video'),
        )}
      >
        <SafeImage
          src={src}
          alt={alt}
          className={cn('block w-full', ratioClass ? cn('absolute inset-0 h-full', objectFitClass) : 'h-auto')}
          loading="lazy"
          fallback={
            <div className={ratioClass ? 'absolute inset-0' : 'aspect-video w-full'}>
              <MediaPlaceholder label={alt.length > 0 ? alt : 'No image'} glyph={ImageGlyph} />
            </div>
          }
        />
      </div>
      {/* A two-line clamp is a DECLARED budget (it says how much caption fits and
          honours it at every width); break-words is what lets those two lines be
          two FULL lines instead of one long word overflowing the measure. */}
      {(hasCaption || hasCredit) && (
        <figcaption className="line-clamp-2 break-words text-xs [color:var(--fr-figure-muted,var(--color-muted-foreground))]" title={`${hasCaption ? p.caption : ''}${hasCredit ? `${hasCaption ? ' — ' : ''}${p.credit}` : ''}` || undefined}>
          {hasCaption && <span>{p.caption}</span>}
          {/* CONTRAST (WCAG 1.4.3): the credit used to sit at `opacity-70` ON TOP
              of the figcaption's already-muted colour, and the two compound —
              #52525b at 70% over the white card composites to #868689, which is
              3.62:1 (dark theme: 3.94:1) against a 4.5:1 floor for 12px text.
              The accessibility audit never reported it: its contrast pass reads
              getComputedStyle().color and composites background alpha only, so it
              scored this text at the token's own 7.73:1 and passed it. Measured by
              hand instead.
              The em-dash separator already subordinates the credit to the caption,
              so the dimming bought nothing the punctuation was not doing. Dropping
              it returns both halves to the muted token (7.73:1 / 6.63:1). */}
          {hasCredit && <span>{hasCaption ? ' — ' : ''}{p.credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}

/* ── Thumbnail ────────────────────────────────────────────────────────────── */

/* PATTERN A (VAR-CHAIN): the `size` enum sets the DEFAULT square extent through a
 * var (no w-x / h-x utility), so an exact `sizeValue` can override it without the
 * tw-merge trap (an arbitrary width/height class never dedupes against w-x / h-x).
 * Each variant reproduces its prior Tailwind size byte-identically
 * (h-6 = 1.5rem, h-8 = 2rem, h-12 = 3rem, h-16 = 4rem, h-24 = 6rem) and KEEPS the
 * initials font-size class (text-x is font-size — no conflict with the size vars). */
const THUMB_SIZE: Record<string, string> = {
  xs: '[--fr-thumb-size-default:1.5rem] text-[0.625rem]',
  sm: '[--fr-thumb-size-default:2rem] text-xs',
  md: '[--fr-thumb-size-default:3rem] text-sm',
  lg: '[--fr-thumb-size-default:4rem] text-base',
  xl: '[--fr-thumb-size-default:6rem] text-xl',
};

/* Thumbnail radius VAR-CHAIN (family coherence with VideoPlayer/AudioPlayer/
 * Figure/YouTube): the `radius` enum sets the scoped DEFAULT var (each value
 * reproduces the prior rounded-* byte-identically) and the base reads
 * [border-radius:var(--fr-thumb-radius,var(--fr-thumb-radius-default,…))], so an
 * exact `radiusValue` wins through the var with no tw-merge trap. LITERAL class
 * strings on purpose — Tailwind's static scanner never sees concatenated names. */
const THUMB_RADIUS: Record<string, string> = {
  none: '[--fr-thumb-radius-default:0px]',
  sm: '[--fr-thumb-radius-default:0.25rem]',
  md: '[--fr-thumb-radius-default:var(--radius-frayme)]',
  lg: '[--fr-thumb-radius-default:1rem]',
  full: '[--fr-thumb-radius-default:9999px]',
};

export function Thumbnail({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    src?: string | null;
    alt?: string | null;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | null;
    sizeValue?: string | number | null;
    radius?: RadiusKey | null;
    radiusValue?: string | number | null;
    bordered?: boolean | null;
    borderColor?: string | null;
    borderStyle?: string | null;
    fallbackInitials?: string | null;
    opacity?: string | null;
  };
  const size = (p.size as string | null) ?? 'md';
  const radius = (p.radius as RadiusKey | null) ?? 'md';
  const sizeClass = THUMB_SIZE[size] ?? THUMB_SIZE.md;
  const alt = typeof p.alt === 'string' ? p.alt : '';
  const initials = typeof p.fallbackInitials === 'string' ? p.fallbackInitials.slice(0, 3) : '';

  return (
    <span
      className={cn(
        // width/height read the exact `--fr-thumb-size` first, falling back to the
        // size-enum's `--fr-thumb-size-default` (set on sizeClass) — ONE declaration
        // each, so the enum default is byte-identical and an exact sizeValue wins.
        'inline-flex shrink-0 items-center justify-center overflow-hidden bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-muted-foreground [width:var(--fr-thumb-size,var(--fr-thumb-size-default,3rem))] max-w-full [height:var(--fr-thumb-size,var(--fr-thumb-size-default,3rem))] [border-radius:var(--fr-thumb-radius,var(--fr-thumb-radius-default,var(--radius-frayme)))]',
        sizeClass,
        THUMB_RADIUS[radius],
        p.bordered === true && cn('border [border-color:var(--fr-thumb-border,var(--color-border))]', borderStyleClass(p.borderStyle)),
        opacityClass(p.opacity),
      )}
      style={styleVars(
        { var: '--fr-thumb-size', value: p.sizeValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 16, max: 256 } },
        { var: '--fr-thumb-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        { var: '--fr-thumb-border', value: p.borderColor, kind: 'color' },
      )}
    >
      <SafeImage
        src={p.src}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        fallback={
          <span role="img" aria-label={alt || initials || 'Thumbnail'} className="font-medium uppercase">
            {initials}
          </span>
        }
      />
    </span>
  );
}

/* ── YouTube ──────────────────────────────────────────────────────────────────
 * A privacy-light YouTube card: the video THUMBNAIL + a play-button overlay that
 * LINKS OUT to youtube.com (new tab). NO iframe is embedded → no third-party
 * cookies, no CSP frame-src, sandbox-safe. The id is strictly validated to
 * [A-Za-z0-9_-]{11} BEFORE any URL is built; the thumbnail flows through SafeImage
 * (safeImageSrc + onError → placeholder) and the link through safeUrl +
 * linkTargetRel. Title is escaped React text. */
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_QUALITY: Record<string, string> = {
  default: 'default',
  mq: 'mqdefault',
  hq: 'hqdefault',
  sd: 'sddefault',
  maxres: 'maxresdefault',
};

/** Resolve a strictly-validated 11-char YouTube id from an explicit id or a URL. */
function youtubeId(videoId?: string | null, url?: string | null): string | null {
  if (typeof videoId === 'string' && YT_ID_RE.test(videoId)) return videoId;
  if (typeof url === 'string') {
    const m =
      url.match(/[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/) ||
      url.match(/youtu\.be\/([A-Za-z0-9_-]{11})(?:[?#/]|$)/) ||
      url.match(/\/embed\/([A-Za-z0-9_-]{11})(?:[?#/]|$)/) ||
      url.match(/\/shorts\/([A-Za-z0-9_-]{11})(?:[?#/]|$)/);
    if (m && YT_ID_RE.test(m[1])) return m[1];
  }
  return null;
}

export function YouTube({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    videoId?: string | null;
    url?: string | null;
    title?: string | null;
    duration?: string | null;
    thumbnailQuality?: string | null;
    aspect?: string | null;
    showTitle?: boolean | null;
    radius?: RadiusKey | null;
    radiusValue?: string | number | null;
    width?: string | number | null;
    borderColor?: string | null;
    borderStyle?: string | null;
    color?: string | null;
    opacity?: string | null;
  };
  const radius = (p.radius as RadiusKey | null) ?? 'md';
  // Shared Aspect enum via aspectClass; `?? '16/9'` keeps the prior unset default (aspect-video) byte-identical.
  const ytAspectClass = aspectClass(p.aspect ?? '16/9') ?? aspectClass('16/9');
  const widthStyle = styleVars(
    { var: '--fr-yt-width', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 1600 } },
    { var: '--fr-yt-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-yt-fg', value: p.color, kind: 'color' },
    { var: '--fr-yt-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
  );
  const ytRadiusDefault = radiusDefaultClass('yt', radius);
  const ytRadiusRead = radiusReadClass('yt');
  const id = youtubeId(p.videoId, p.url);
  const title = typeof p.title === 'string' ? p.title : '';
  const showTitle = p.showTitle !== false && title.length > 0;
  // Optional duration corner badge — escaped text; the model supplies it
  // (no API fetch). Rendered only when non-empty (byte-identical unset).
  const duration = typeof p.duration === 'string' && p.duration.length > 0 ? p.duration : null;

  if (!id) {
    return (
      <figure className={cn('m-0 flex max-w-full flex-col gap-2 [width:var(--fr-yt-width,100%)]', opacityClass(p.opacity))} style={widthStyle}>
        <div className={cn('relative w-full overflow-hidden border [border-color:var(--fr-yt-border,var(--color-border))] bg-[color:var(--fr-surface-sunken,var(--color-muted))]', borderStyleClass(p.borderStyle), ytAspectClass, ytRadiusDefault, ytRadiusRead)}>
          <div className="absolute inset-0">
            <MediaPlaceholder label="No video" glyph={PlayGlyph} />
          </div>
        </div>
        {/* A bad id falls back to a LABELED card: the title line renders here too
            (escaped text; --fr-yt-fg already rides widthStyle) instead of an
            anonymous grey box. Two-line clamp, same as the playable card. */}
        {showTitle && <figcaption className="min-w-0 line-clamp-2 break-words text-sm font-medium [color:var(--fr-yt-fg,var(--color-foreground))]" title={title || undefined}>{title}</figcaption>}
      </figure>
    );
  }

  const quality = YT_QUALITY[p.thumbnailQuality ?? 'hq'] ?? 'hqdefault';
  const thumb = 'https://img.youtube.com/vi/' + id + '/' + quality + '.jpg';
  const watch = 'https://www.youtube.com/watch?v=' + id;
  const linkLabel = title.length > 0 ? title + ' — play on YouTube' : 'Play on YouTube';

  return (
    <figure className={cn('m-0 flex max-w-full flex-col gap-2 [width:var(--fr-yt-width,100%)]', opacityClass(p.opacity))} style={widthStyle}>
      <a
        href={safeUrl(watch)}
        {...linkTargetRel(true)}
        aria-label={linkLabel}
        className={cn(
          'group relative block w-full overflow-hidden border [border-color:var(--fr-yt-border,var(--color-border))] bg-[color:var(--fr-surface-sunken,var(--color-muted))] outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-primary',
          borderStyleClass(p.borderStyle),
          ytAspectClass,
          ytRadiusDefault,
          ytRadiusRead,
        )}
      >
        <SafeImage
          src={thumb}
          // The thumbnail stands in for the video; the title is what it shows.
          alt={typeof title === 'string' && title.trim() ? title : 'Video thumbnail'}
          className="absolute inset-0 h-full w-full object-cover"
          fallback={
            <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-muted-foreground">
              {PlayGlyph}
            </span>
          }
        />
        {/* the iconic YouTube red play badge (brand affordance, fixed over the image) */}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="flex h-[2.125rem] w-[3rem] items-center justify-center rounded-[0.6rem] bg-[#f00] shadow-md transition-transform group-hover:scale-110">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" aria-hidden="true">
              <path d="M9 7.5v9l7.5-4.5z" />
            </svg>
          </span>
        </span>
        {/* duration corner badge — the standard bottom-right black pill */}
        {duration != null && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-[0.25rem] bg-black/70 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
            {duration}
          </span>
        )}
      </a>
      {/* The caption is a video TITLE — a real sentence, not a chip. One clipped
          line lost most of it below ~28rem, and the figure is a plain column
          (thumb then caption) with no height contract to defend, so the honest
          bound is a declared two lines rather than a silent cut. */}
      {showTitle && <figcaption className="min-w-0 line-clamp-2 break-words text-sm font-medium [color:var(--fr-yt-fg,var(--color-foreground))]" title={title || undefined}>{title}</figcaption>}
    </figure>
  );
}
