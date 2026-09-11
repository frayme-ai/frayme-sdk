'use client';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars, fontClass, weightClass, trackingClass, leadingClass, opacityClass, aspectClass } from './_style.js';
import { safeDimension } from '@frayme/catalog/validate';
import { Icon, hasIcon } from './icons.js';
import { safeUrl, linkTargetRel } from './url-safety.js';
import { SafeImage } from './_img.js';

/* Catalog group (social-media): FeedItem, AvatarGroup, Gallery, MediaGrid,
 * Lightbox, Comment, CommentThread.
 *
 * Same truly-dynamic contract as the shipped catalog:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (a model-named color/dimension) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities with a token fallback.
 *
 * SECURITY: every image renders via `SafeImage` (validates the src through
 * `safeImageSrc`, raster-only) — an unsafe/absent src OR a load failure (404/
 * blocked) renders the tinted placeholder box, never a broken <img>. Tile
 * links flow through `safeUrl` + `linkTargetRel`. Icons resolve against the
 * closed registry (guarded by `hasIcon`; unknown → nothing). Feed/comment bodies
 * render as plain escaped React children — no markdown/HTML parsing.
 *
 * INTERACTIVITY: Gallery's lightbox, the standalone Lightbox, and CommentThread's
 * collapse all stay live WITHOUT a binding — internal `useState` (Gallery/thread)
 * or `useLocalOrBound` (Lightbox index/open) drive them; `emit(...)` is an
 * ADDITIONAL host signal, never the only effect.
 */

/* ── Shared helpers ───────────────────────────────────────────────────────── */

type ActionItem = { icon?: string | null; label?: string | null; count?: number | null; active?: boolean | null };
type MediaItemT = { src: string; alt: string; caption?: string | null };

/** Deterministic ARIA id scope for a disclosure's trigger↔region pairing. React's
 *  `useId` diverges when a host SSRs the renderer inside a larger 'use client'
 *  tree (its ids are positional), so — as in layout.tsx/forms.tsx — the scope
 *  derives from a stable part: the element's own spec id, stamped into props as
 *  `__fid` by FraymeRenderer. Callers append their own per-item key (the thread's
 *  index path), so two threads on one page never share a region id. Absent
 *  outside a FraymeRenderer, where the scope alone carries it. */
function ariaId(scope: string, element: ComponentRenderProps['element']): string {
  const raw = (element as { props?: { __fid?: unknown } }).props?.__fid;
  const fid =
    typeof raw === 'string' ? raw.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') : '';
  return fid.length > 0 ? `frayme-${scope}-${fid}` : `frayme-${scope}`;
}

/** Compact number formatting (24000 → "24k", 1_200_000 → "1.2M"). Falls back to
 *  the plain locale string below 1000. Used by the social action counters when
 *  `countFormat:'compact'` (default plain → the raw number, byte-identical). */
function formatCount(n: number, mode: 'plain' | 'compact'): string {
  if (mode !== 'compact' || Math.abs(n) < 1000) return String(n);
  const units: Array<[number, string]> = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'k'],
  ];
  for (const [base, suffix] of units) {
    if (Math.abs(n) >= base) {
      const v = n / base;
      // one decimal, but drop a trailing .0 (24.0k → 24k)
      const s = (Math.round(v * 10) / 10).toString();
      return `${s}${suffix}`;
    }
  }
  return String(n);
}

/** Initials (max 2) from a person's name, for the avatar fallback. */
function initialsOf(name: unknown): string {
  return String(name ?? '')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** A square avatar: sanitized image, else initials. Pure display. */
function AvatarBlob({ src, name, px }: { src?: string | null; name: string; px: number }): ReactNode {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--fr-surface-sunken,var(--color-muted))] font-semibold text-[color:var(--fr-surface-fg,var(--color-foreground))]"
      style={{ width: px, height: px, fontSize: Math.max(10, Math.round(px * 0.4)) }}
      title={name}
    >
      <SafeImage
        className="h-full w-full object-cover"
        src={src}
        alt={name}
        fallback={<span aria-hidden>{initialsOf(name)}</span>}
      />
    </span>
  );
}

/** A media tile body: sanitized image, else a tinted placeholder with the alt. */
function MediaImg({ src, alt, className }: { src?: string | null; alt: string; className?: string }): ReactNode {
  return (
    <SafeImage
      className={cn('h-full w-full object-cover', className)}
      src={src}
      alt={alt}
      fallback={
        <div
          className={cn('flex items-center justify-center bg-[color:var(--fr-surface-sunken,var(--color-muted))] px-2 text-center text-[0.75rem] text-muted-foreground', className)}
          // With a meaningful alt, expose the placeholder as a named img; with no
          // alt it is decorative (an empty-named role="img" is an a11y violation).
          role={alt.length > 0 ? 'img' : undefined}
          aria-label={alt.length > 0 ? alt : undefined}
          aria-hidden={alt.length > 0 ? undefined : true}
        >
          {alt.length > 0 ? alt : null}
        </div>
      }
    />
  );
}

/** Footer/inline action buttons (like/comment/share/reply). Host-routed.
 *  `mutedClass` = the OWNING component's muted var reader (--fr-feed-muted /
 *  --fr-comment-muted, token fallback inside the var) so the action labels/
 *  icons/counters travel with the same mutedColor channel as the meta line
 *  they sit under — the old hardcoded text-muted-foreground split the surface
 *  into two greys when mutedColor was set. */
function ActionRow({
  actions,
  onAction,
  mutedClass,
  activeClass,
  countFormat = 'plain',
}: {
  actions: ActionItem[];
  onAction: (i: number) => void;
  mutedClass: string;
  // The OWNING component's accent-var reader (--fr-feed-accent / --fr-comment-accent,
  // token fallback inside the var). Applied to an action with active:true so the
  // whole button — icon + label + count — tints to the accent (the "liked" state).
  activeClass?: string;
  countFormat?: 'plain' | 'compact';
}): ReactNode {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {actions.map((a, i) => {
        const name = typeof a.icon === 'string' && hasIcon(a.icon) ? a.icon : null;
        const label = a.label ?? null;
        const count = typeof a.count === 'number' && Number.isFinite(a.count) ? a.count : null;
        const active = a.active === true;
        return (
          <button
            key={i}
            type="button"
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-frayme border-0 bg-transparent px-2 py-1 text-[0.8125rem] font-medium transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] hover:text-[color:var(--fr-surface-fg,var(--color-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              // Resting rows read the muted chain; an active row swaps to the accent
              // reader (added LAST so the accent group-form dedupe-wins the muted one).
              active && activeClass != null ? activeClass : mutedClass,
            )}
            aria-label={label ?? undefined}
            aria-pressed={active || undefined}
            onClick={() => onAction(i)}
          >
            {/* The glyph is a square with a fixed width/height attr; the label and
                count beside it are what may give way when the row is squeezed. */}
            {name != null && <Icon name={name} size={15} className="shrink-0" />}
            {label != null && <span>{label}</span>}
            {count != null && <span className="tabular-nums opacity-80">{formatCount(count, countFormat)}</span>}
          </button>
        );
      })}
    </div>
  );
}

const GAP_CLASS: Record<string, string> = {
  none: 'gap-0',
  sm: 'gap-1.5',
  md: 'gap-3',
  lg: 'gap-5',
  xl: 'gap-8',
};
const RATIO_CLASS: Record<string, string> = {
  square: 'aspect-square',
  video: 'aspect-video',
  portrait: 'aspect-[3/4]',
  wide: 'aspect-[21/9]',
  auto: '',
};
/** Clamp a model count into 1..max (props-less safe). */
function clampCount(v: unknown, dflt: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(Math.max(Math.round(n), lo), hi);
}

/* ── FeedItem ─────────────────────────────────────────────────────────────── */

const feedItem = cva('flex w-full gap-3', {
  variants: {
    variant: {
      card: 'rounded-frayme border border-border bg-card p-4',
      plain: 'py-3',
    },
  },
  defaultVariants: { variant: 'card' },
});

export function FeedItem({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    id?: string | null;
    authorName: string;
    authorTitle?: string | null;
    avatarSrc?: string | null;
    timestamp?: string | null;
    body: string;
    mediaSrc?: string | null;
    mediaAlt?: string | null;
    aspect?: string | null;
    actions?: ActionItem[] | null;
    activeAction?: string | null;
    countFormat?: string | null;
    variant?: string | null;
    accent?: string | null;
    mutedColor?: string | null;
    leading?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    fontSize?: string | number | null;
  };
  const actions = Array.isArray(p.actions) ? p.actions : [];
  const [, setActiveAction] = useBoundProp(p.activeAction ?? undefined, bindings?.activeAction);
  const emitWith = useIntrinsicEmit(emit, element);
  const countFormat = p.countFormat === 'compact' ? 'compact' : 'plain';
  return (
    <article
      className={cn(feedItem({ variant: (p.variant as 'card' | 'plain' | null) ?? undefined }), fontClass(p.font))}
      style={styleVars(
        { var: '--fr-feed-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-feed-accent', value: p.accent, kind: 'color' },
        { var: '--fr-feed-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      <AvatarBlob src={p.avatarSrc} name={p.authorName ?? ''} px={40} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* flex-wrap: with the name and title now wrapping rather than clipping,
            the header row must be allowed to break too, or the three items fight
            over one line and squeeze each other again. */}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {/* No baked text-size on the name — the fs var falls back to inherit (byte-identical when unset). */}
          {/* An author's name is the one string a post must render in full —
              it was clipping to "Aisha Okonkwo · Meridian Hea…". The header row
              below wraps. */}
          <span className={cn('break-words font-semibold [font-size:var(--fr-feed-fs,inherit)]', weightClass(p.weight), trackingClass(p.tracking))} title={p.authorName || undefined}>
            {p.authorName}
          </span>
          {p.authorTitle != null && (
            <span className="break-words text-[0.8125rem] [color:var(--fr-feed-muted,var(--color-muted-foreground))]" title={p.authorTitle || undefined}>{p.authorTitle}</span>
          )}
          {p.timestamp != null && (
            <span className="ml-auto shrink-0 text-[0.8125rem] [color:var(--fr-feed-muted,var(--color-muted-foreground))]">{p.timestamp}</span>
          )}
        </div>
        {p.body != null && (
          <p className={cn('m-0 whitespace-pre-wrap break-words text-sm leading-relaxed', leadingClass(p.leading))}>{p.body}</p>
        )}
        {p.mediaSrc != null && (
          <div className="mt-1 overflow-hidden rounded-frayme border border-border">
            <MediaImg src={p.mediaSrc} alt={p.mediaAlt ?? p.authorName ?? 'Attached media'} className={cn('aspect-video', aspectClass(p.aspect))} />
          </div>
        )}
        {actions.length > 0 && (
          <div className="mt-1">
            <ActionRow
              actions={actions}
              mutedClass="[color:var(--fr-feed-muted,var(--color-muted-foreground))]"
              activeClass="[color:var(--fr-feed-accent,var(--fr-accent))]"
              countFormat={countFormat}
              onAction={(i) => {
                setActiveAction(actions[i]?.label ?? String(i));
                emitWith('commit', {
                  id: p.id ?? null,
                  label: actions[i]?.label ?? null,
                  index: i,
                  active: actions[i]?.active === true,
                });
              }}
            />
          </div>
        )}
      </div>
    </article>
  );
}

/* ── AvatarGroup ──────────────────────────────────────────────────────────── */

const AVATAR_PX: Record<string, number> = { xs: 24, sm: 28, md: 40, lg: 56 };

/** Resolve an exact dimension VALUE to a clamped px NUMBER, or null when absent/
 *  invalid (so the enum px fallback wins). The value is first run through the
 *  dimension validator (defence in depth), then parsed to a leading number. */
function dimNum(v: unknown, lo: number, hi: number): number | null {
  const safe = safeDimension(v, { units: ['px', 'rem'], min: lo, max: hi });
  if (safe === null) return null;
  const n = parseFloat(safe);
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : null;
}

export function AvatarGroup({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    items?: Array<{ src?: string | null; name: string; alt?: string | null }> | null;
    max?: number | null;
    size?: string | null;
    sizeValue?: string | number | null;
    ring?: boolean | null;
    mutedColor?: string | null;
  };
  const items = Array.isArray(p.items) ? p.items.filter((it) => it && typeof it === 'object') : [];
  const size = (p.size as 'xs' | 'sm' | 'md' | 'lg' | null) ?? 'md';
  // Exact `sizeValue` (px number) wins; else the enum px (md=40). When unset the
  // px is byte-identical to before.
  const px = dimNum(p.sizeValue, 16, 160) ?? AVATAR_PX[size] ?? 40;
  const max = clampCount(p.max, 5, 1, 50);
  const ring = p.ring !== false;
  const shown = items.slice(0, max);
  const overflow = items.length - shown.length;
  const ringCls = ring ? 'ring-2 ring-card' : '';
  return (
    <div
      className="inline-flex items-center"
      role="group"
      style={styleVars({ var: '--fr-avatargroup-muted', value: p.mutedColor, kind: 'color' })}
    >
      {shown.map((it, i) => {
        const name = it.name ?? '';
        return (
          <span
            key={i}
            // `shrink-0` is what makes the declared `px` a REAL size: a face is a
            // square whose radius + object-fit crop it, so a squeezed flex row
            // would crop the portrait horizontally into an oval rather than
            // scale it. The group root may shrink; a face may not.
            className={cn(
              'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--fr-surface-sunken,var(--color-muted))] font-semibold text-[color:var(--fr-surface-fg,var(--color-foreground))]',
              ringCls,
              i > 0 && '-ml-2',
            )}
            style={{ width: px, height: px, fontSize: Math.max(10, Math.round(px * 0.4)), zIndex: shown.length - i }}
            title={name}
          >
            <SafeImage
              className="h-full w-full object-cover"
              src={it.src}
              alt={it.alt ?? name}
              fallback={<span aria-hidden>{initialsOf(name)}</span>}
            />
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          // Same square-or-nothing constraint as a face: the chip is round, so a
          // shrunk width against a fixed height would render it as an oval.
          className={cn(
            'relative -ml-2 inline-flex shrink-0 items-center justify-center rounded-full bg-[color:var(--fr-surface-sunken,var(--color-muted))] font-semibold [color:var(--fr-avatargroup-muted,var(--color-muted-foreground))]',
            ringCls,
          )}
          style={{ width: px, height: px, fontSize: Math.max(10, Math.round(px * 0.36)), zIndex: 0 }}
          aria-label={`${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

/* ── Lightbox overlay (shared internal view) ──────────────────────────────── */

/** The full-screen overlay used by BOTH Gallery (internal) and the standalone
 *  Lightbox. Controlled by the caller (index/onPrev/onNext/onClose); renders the
 *  scrim + image + caption + controls with role=dialog and keyboard handling. */
function LightboxOverlay({
  items,
  index,
  overlayColor,
  closeLabel,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  onClose,
}: {
  items: MediaItemT[];
  index: number;
  overlayColor?: string | null;
  closeLabel?: string | null;
  prevLabel?: string | null;
  nextLabel?: string | null;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}): ReactNode {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const multiple = items.length > 1;
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (multiple && (e.key === 'ArrowLeft')) onPrev();
      else if (multiple && (e.key === 'ArrowRight')) onNext();
    },
    [multiple, onClose, onPrev, onNext],
  );
  const current = items[index];
  if (!current) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.caption ?? current.alt ?? 'Media viewer'}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 [background:var(--fr-lightbox-scrim,rgba(0,0,0,0.88))]"
      style={styleVars({ var: '--fr-lightbox-scrim', value: overlayColor, kind: 'color' })}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        ref={closeRef}
        type="button"
        aria-label={closeLabel ?? 'Close'}
        className="absolute right-4 top-4 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0 bg-card/90 text-foreground shadow-md hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={onClose}
      >
        <Icon name="x" size={20} />
      </button>
      {multiple && (
        <button
          type="button"
          aria-label={prevLabel ?? 'Previous'}
          className="absolute left-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-card/90 text-foreground shadow-md hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={onPrev}
        >
          <Icon name="chevron-left" size={22} />
        </button>
      )}
      <figure className="m-0 flex max-h-full max-w-3xl flex-col items-center gap-3">
        <div className="flex min-h-[12rem] min-w-[16rem] items-center justify-center overflow-hidden rounded-frayme">
          <MediaImg src={current.src} alt={current.alt ?? ''} className="max-h-[70vh] !w-auto object-contain" />
        </div>
        {current.caption != null && (
          // The scrim is always dark — white caption reads in both themes (literal
          // white over a colored fill is the allowed knob/over-fill exception).
          <figcaption className="max-w-prose text-center text-sm text-white">{current.caption}</figcaption>
        )}
        {multiple && (
          <span className="text-[0.8125rem] tabular-nums text-white/80">
            {index + 1} / {items.length}
          </span>
        )}
      </figure>
      {multiple && (
        <button
          type="button"
          aria-label={nextLabel ?? 'Next'}
          className="absolute right-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-card/90 text-foreground shadow-md hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={onNext}
        >
          <Icon name="chevron-right" size={22} />
        </button>
      )}
    </div>
  );
}

/* ── Gallery ──────────────────────────────────────────────────────────────── */

export function Gallery({ element, emit }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    items?: MediaItemT[] | null;
    columns?: number | null;
    gap?: string | null;
    ratio?: string | null;
    lightbox?: boolean | null;
    opacity?: string | null;
    radiusValue?: string | number | null;
    borderColor?: string | null;
    overlayColor?: string | null;
    closeLabel?: string | null;
    prevLabel?: string | null;
    nextLabel?: string | null;
  };
  const items = Array.isArray(p.items) ? p.items.filter((it) => it && typeof it === 'object') : [];
  const cols = clampCount(p.columns, 3, 1, 6);
  const gap = GAP_CLASS[(p.gap as string) ?? 'md'] ?? GAP_CLASS.md;
  const ratio = RATIO_CLASS[(p.ratio as string) ?? 'square'] ?? RATIO_CLASS.square;
  const lightboxOn = p.lightbox !== false;
  const emitWith = useIntrinsicEmit(emit, element);

  // Internal lightbox state — works without a binding. null = closed.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = (i: number) => {
    if (lightboxOn) setOpenIndex(i);
    emitWith('change', { index: i, src: items[i]?.src ?? null });
  };
  const close = () => setOpenIndex(null);
  const step = (dir: number) =>
    setOpenIndex((cur) => (cur == null || items.length === 0 ? cur : (cur + dir + items.length) % items.length));

  return (
    <>
      <div
        className={cn('grid', gap, opacityClass(p.opacity))}
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          // Container cascade: set the tile radius/border vars on the grid root →
          // CSS custom properties INHERIT to every tile (unset → token fallback,
          // byte-identical).
          ...styleVars(
            { var: '--fr-gallery-tile-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], max: 64 } },
            { var: '--fr-gallery-tile-border', value: p.borderColor, kind: 'color' },
          ),
        }}
      >
        {items.map((it, i) => {
          const tileBody = (
            <MediaImg src={it.src} alt={it.alt ?? ''} className={cn(ratio || 'aspect-square')} />
          );
          if (lightboxOn) {
            return (
              <button
                key={i}
                type="button"
                className="block cursor-pointer overflow-hidden border bg-[color:var(--fr-surface-sunken,var(--color-muted))] p-0 [border-color:var(--fr-gallery-tile-border,var(--color-border))] [border-radius:var(--fr-gallery-tile-radius,var(--radius-frayme))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`Open ${it.alt ?? 'image'}`}
                onClick={() => open(i)}
              >
                {tileBody}
              </button>
            );
          }
          return (
            <div key={i} className="overflow-hidden border bg-[color:var(--fr-surface-sunken,var(--color-muted))] [border-color:var(--fr-gallery-tile-border,var(--color-border))] [border-radius:var(--fr-gallery-tile-radius,var(--radius-frayme))]">
              {tileBody}
            </div>
          );
        })}
      </div>
      {openIndex != null && items[openIndex] && (
        <LightboxOverlay
          items={items}
          index={openIndex}
          // One channel-set covers the overlay wherever it appears: the internal
          // lightbox takes the same scrim + a11y/localisation labels the
          // standalone Lightbox exposes.
          overlayColor={p.overlayColor}
          closeLabel={p.closeLabel}
          prevLabel={p.prevLabel}
          nextLabel={p.nextLabel}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onClose={close}
        />
      )}
    </>
  );
}

/* ── MediaGrid ────────────────────────────────────────────────────────────── */

export function MediaGrid({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    items?: Array<{ src: string; alt: string; label?: string | null; href?: string | null }> | null;
    columns?: number | null;
    gap?: string | null;
    ratio?: string | null;
    opacity?: string | null;
    radiusValue?: string | number | null;
    borderColor?: string | null;
  };
  const items = Array.isArray(p.items) ? p.items.filter((it) => it && typeof it === 'object') : [];
  const cols = clampCount(p.columns, 3, 1, 6);
  const gap = GAP_CLASS[(p.gap as string) ?? 'md'] ?? GAP_CLASS.md;
  const ratio = RATIO_CLASS[(p.ratio as string) ?? 'square'] ?? RATIO_CLASS.square;

  return (
    <div
      className={cn('grid', gap, opacityClass(p.opacity))}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        // Container cascade: set the tile radius/border vars on the grid root →
        // CSS custom properties INHERIT to every tile (unset → token fallback,
        // byte-identical).
        ...styleVars(
          { var: '--fr-mediagrid-tile-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], max: 64 } },
          { var: '--fr-mediagrid-tile-border', value: p.borderColor, kind: 'color' },
        ),
      }}
    >
      {items.map((it, i) => {
        const inner = (
          <>
            <MediaImg src={it.src} alt={it.alt ?? ''} className={cn(ratio || 'aspect-square')} />
            {it.label != null && (
              // The caption is what the tile SAYS about the image, and a one-column
              // grid at 320px is exactly where `truncate` deleted it. The overlay is
              // anchored to the bottom edge, so it grows upward into the tile: a
              // declared two-line budget, not a clipped line.
              <span className="absolute inset-x-0 bottom-0 line-clamp-2 break-words bg-gradient-to-t from-black/70 to-transparent px-2.5 py-2 text-[0.8125rem] font-medium text-white" title={it.label || undefined}>
                {it.label}
              </span>
            )}
          </>
        );
        const tileCls = 'relative block overflow-hidden border bg-[color:var(--fr-surface-sunken,var(--color-muted))] [border-color:var(--fr-mediagrid-tile-border,var(--color-border))] [border-radius:var(--fr-mediagrid-tile-radius,var(--radius-frayme))]';
        if (it.href != null) {
          return (
            <a
              key={i}
              href={safeUrl(it.href)}
              {...linkTargetRel(false)}
              className={cn(tileCls, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary')}
              aria-label={it.label ?? it.alt ?? undefined}
            >
              {inner}
            </a>
          );
        }
        return (
          <div key={i} className={cn(tileCls)}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/* ── Lightbox (standalone) ────────────────────────────────────────────────── */

export function Lightbox({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const emitWith = useIntrinsicEmit(emit, element);
  const p = (element.props ?? {}) as {
    items?: MediaItemT[] | null;
    index?: number | null;
    open?: boolean | null;
    closeLabel?: string | null;
    prevLabel?: string | null;
    nextLabel?: string | null;
    overlayColor?: string | null;
  };
  const items = Array.isArray(p.items) ? p.items.filter((it) => it && typeof it === 'object') : [];
  const startIndex = clampCount(p.index, 0, 0, Math.max(items.length - 1, 0));

  // Two-way when bound, local otherwise — both `open` and `index` stay live.
  const [open, setOpen] = useBoundProp<boolean>(p.open === true, bindings?.open);
  const [index, setIndex] = useBoundProp<number>(startIndex, bindings?.index);
  const cur = typeof index === 'number' && Number.isFinite(index) ? index : 0;

  const close = () => {
    setOpen(false);
    emitWith('dismiss', { index: cur });
  };
  const go = (dir: number) => {
    if (items.length === 0) return;
    // Navigate from the CLAMPED base (what's actually rendered) so an out-of-range
    // bound index doesn't make prev/next jump to the wrong slide.
    const base = Math.min(Math.max(cur, 0), items.length - 1);
    const next = (base + dir + items.length) % items.length;
    setIndex(next);
    emitWith('change', { index: next, src: items[next]?.src ?? null });
  };

  if (open !== true || items.length === 0) return null;
  const safeCur = Math.min(Math.max(cur, 0), items.length - 1);
  return (
    <LightboxOverlay
      items={items}
      index={safeCur}
      overlayColor={p.overlayColor}
      closeLabel={p.closeLabel}
      prevLabel={p.prevLabel}
      nextLabel={p.nextLabel}
      onPrev={() => go(-1)}
      onNext={() => go(1)}
      onClose={close}
    />
  );
}

/* ── Comment ──────────────────────────────────────────────────────────────── */

/** The presentational body of a single comment (avatar + header + text + actions
 *  + nested children). Shared by the `Comment` renderer and the recursive
 *  `CommentThread` so the recursion never has to synthesize a fake element. */
function CommentBody({
  authorName,
  avatarSrc,
  timestamp,
  body,
  actions,
  onAction,
  countFormat,
  leading,
  weight,
  tracking,
  children,
}: {
  authorName: string;
  avatarSrc?: string | null;
  timestamp?: string | null;
  body: string;
  actions: ActionItem[];
  onAction: (i: number) => void;
  countFormat?: 'plain' | 'compact';
  leading?: string | null;
  weight?: string | null;
  tracking?: string | null;
  children?: ReactNode;
}): ReactNode {
  return (
    <div className="flex w-full gap-2.5">
      <AvatarBlob src={avatarSrc} name={authorName ?? ''} px={32} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* flex-wrap: with the name and title now wrapping rather than clipping,
            the header row must be allowed to break too, or the three items fight
            over one line and squeeze each other again. */}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {/* fontSize single source: the baked 0.875rem (text-sm) is the var fallback
              (byte-identical when unset); an exact fontSize wins via --fr-comment-fs.
              weightClass LAST dedupes the baked font-semibold via tw-merge. */}
          {/* A person's name is the one string in a comment that may not lose
              characters — the header row above already wraps for exactly this. */}
          <span className={cn('break-words [font-size:var(--fr-comment-fs,0.875rem)] leading-[calc(1.25/0.875)] font-semibold', trackingClass(tracking), weightClass(weight))} title={authorName || undefined}>{authorName}</span>
          {timestamp != null && <span className="shrink-0 text-[0.75rem] [color:var(--fr-comment-muted,var(--color-muted-foreground))]">{timestamp}</span>}
        </div>
        {body != null && (
          <p className={cn('m-0 whitespace-pre-wrap break-words [font-size:var(--fr-comment-fs,0.875rem)] leading-relaxed', trackingClass(tracking), leadingClass(leading))}>{body}</p>
        )}
        {actions.length > 0 && (
          <ActionRow
            actions={actions}
            mutedClass="[color:var(--fr-comment-muted,var(--color-muted-foreground))]"
            activeClass="[color:var(--fr-comment-accent,var(--fr-accent))]"
            countFormat={countFormat}
            onAction={onAction}
          />
        )}
        {children != null && (
          // The nested-reply rail reads the thread's borderColor channel
          // (--fr-comment-rail, border-token fallback → byte-identical unset).
          <div className="mt-1 flex flex-col gap-3 border-l border-l-[color:var(--fr-comment-rail,var(--color-border))] pl-3">{children}</div>
        )}
      </div>
    </div>
  );
}

export function Comment({ element, children, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    id?: string | null;
    authorName: string;
    avatarSrc?: string | null;
    timestamp?: string | null;
    body: string;
    actions?: ActionItem[] | null;
    activeAction?: string | null;
    countFormat?: string | null;
    depth?: number | null;
    accent?: string | null;
    mutedColor?: string | null;
    leading?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    fontSize?: string | number | null;
  };
  const actions = Array.isArray(p.actions) ? p.actions : [];
  const [, setActiveAction] = useBoundProp(p.activeAction ?? undefined, bindings?.activeAction);
  const emitWith = useIntrinsicEmit(emit, element);
  const depth = clampCount(p.depth, 0, 0, 6);
  const indent = depth > 0 ? Math.min(depth, 6) * 20 : 0;
  const countFormat = p.countFormat === 'compact' ? 'compact' : 'plain';
  return (
    <div
      className={fontClass(p.font)}
      style={{
        ...(indent ? { marginLeft: indent } : {}),
        ...styleVars(
          { var: '--fr-comment-muted', value: p.mutedColor, kind: 'color' },
          { var: '--fr-comment-accent', value: p.accent, kind: 'color' },
          { var: '--fr-comment-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
        ),
      }}
    >
      <CommentBody
        authorName={p.authorName}
        avatarSrc={p.avatarSrc}
        timestamp={p.timestamp}
        body={p.body}
        actions={actions}
        onAction={(i) => {
          setActiveAction(actions[i]?.label ?? String(i));
          emitWith('commit', {
            id: p.id ?? null,
            label: actions[i]?.label ?? null,
            index: i,
            active: actions[i]?.active === true,
          });
        }}
        countFormat={countFormat}
        leading={p.leading}
        weight={p.weight}
        tracking={p.tracking}
      >
        {children}
      </CommentBody>
    </div>
  );
}

/* ── CommentThread ────────────────────────────────────────────────────────── */

type ThreadNode = {
  authorName: string;
  avatarSrc?: string | null;
  timestamp?: string | null;
  body: string;
  replies?: ThreadNode[] | null;
};

/** One recursive comment node. Depth is hard-capped by the caller via maxDepth;
 *  every level array-guards `replies`. Collapse state is lifted to the
 *  CommentThread root (a Set of collapsed node keys mirrored to spec.state), so
 *  an agent/Button can read which subtrees are hidden. `nodeKey` is the stable
 *  index path (e.g. "0.1.0") for THIS node; `onToggle(key)` flips it in the set.
 *
 *  BRANCHING drives the indent, not depth: a node with exactly ONE reply is a
 *  turn in a linear back-and-forth, so its continuation renders as a SIBLING —
 *  no rail, no per-level collapse toggle (indenting a two-party exchange eats
 *  the line length and implies a fork the data doesn't have). The nested
 *  treatment starts only where a node really has 2+ replies; a chain that later
 *  branches picks it up from that node down. Keys stay the full index path
 *  either way, so a bound `collapsed` array survives the flattening. */
function ThreadNodeView({
  node,
  nodeKey,
  idBase,
  depth,
  maxDepth,
  collapsible,
  collapsedSet,
  onToggle,
  onAction,
  leading,
  weight,
  tracking,
}: {
  node: ThreadNode;
  nodeKey: string;
  idBase: string;
  depth: number;
  maxDepth: number;
  collapsible: boolean;
  collapsedSet: Set<string>;
  onToggle: (key: string) => void;
  onAction: (i: number) => void;
  leading?: string | null;
  weight?: string | null;
  tracking?: string | null;
}): ReactNode {
  const replies =
    depth < maxDepth && Array.isArray(node.replies)
      ? node.replies.filter((r): r is ThreadNode => !!r && typeof r === 'object')
      : [];
  const branches = replies.length > 1;
  // Collapse state read from the lifted set (bindable at the thread root). Default expanded.
  const collapsed = collapsedSet.has(nodeKey);
  // The reply list's DOM id — what THIS node's toggle expanded. The thread's
  // spec id scopes it across threads; `nodeKey` (the index path) separates
  // siblings, so every "Hide replies" points at its OWN subtree. Dots are
  // swapped for dashes injectively (keys are digits + dots), keeping the id
  // selector-safe without ever merging two distinct paths.
  const repliesId = `${idBase}-r${nodeKey.replace(/\./g, '-')}`;
  const self = (
    <CommentBody
      authorName={node.authorName}
      avatarSrc={node.avatarSrc}
      timestamp={node.timestamp}
      body={node.body}
      actions={[]}
      onAction={onAction}
      leading={leading}
      weight={weight}
      tracking={tracking}
    >
      {/* null, never `false`: CommentBody opens the indent rail for ANY non-null
          child, so a non-branching node must pass nothing at all. */}
      {branches ? (
        <>
          {collapsible && (
            <button
              type="button"
              className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-frayme border-0 bg-transparent px-1.5 py-1 text-[0.75rem] font-medium [color:var(--fr-comment-muted,var(--color-muted-foreground))] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-expanded={!collapsed}
              aria-controls={repliesId}
              onClick={() => onToggle(nodeKey)}
            >
              {/* Fixed-size chevron: the label text absorbs a narrow rail, not the glyph. */}
              <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size={14} className="shrink-0" />
              {collapsed ? `Show ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : 'Hide replies'}
            </button>
          )}
          {/* ONE wrapper around the replies so the toggle above has a region to
              name in aria-controls (loose siblings gave it nothing to point at).
              It re-declares the parent rail's own `flex flex-col gap-3`, so every
              row lands exactly where it did before — layout-neutral. */}
          {!collapsed && (
            <div id={repliesId} className="flex flex-col gap-3">
              {replies.map((r, i) => (
                <ThreadNodeView
                  key={i}
                  node={r}
                  nodeKey={`${nodeKey}.${i}`}
                  idBase={idBase}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  collapsible={collapsible}
                  collapsedSet={collapsedSet}
                  onToggle={onToggle}
                  onAction={onAction}
                  leading={leading}
                  weight={weight}
                  tracking={tracking}
                />
              ))}
            </div>
          )}
        </>
      ) : null}
    </CommentBody>
  );
  const only = branches ? null : replies[0];
  if (!only) return self;
  // The single reply continues the conversation at THIS level; depth still ticks
  // so maxDepth keeps bounding the walk (and the recursion) exactly as before.
  return (
    <>
      {self}
      <ThreadNodeView
        node={only}
        nodeKey={`${nodeKey}.0`}
        idBase={idBase}
        depth={depth + 1}
        maxDepth={maxDepth}
        collapsible={collapsible}
        collapsedSet={collapsedSet}
        onToggle={onToggle}
        onAction={onAction}
        leading={leading}
        weight={weight}
        tracking={tracking}
      />
    </>
  );
}

export function CommentThread({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  // ThreadNodeView always renders with actions={[]}, so there are no per-comment
  // action-button emits here; the thread is display + collapse state. Collapse is
  // lifted to this root as a bindable string[] of collapsed node keys, and each
  // collapse/expand toggle ALSO mirrors the full resolved key set into
  // spec.state/_ui via `change` so the agent can read which reply subtrees are
  // hidden even when no prop is bound.
  const p = (element.props ?? {}) as {
    comments?: ThreadNode[] | null;
    maxDepth?: number | null;
    collapsible?: boolean | null;
    collapsed?: string[] | null;
    mutedColor?: string | null;
    borderColor?: string | null;
    leading?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    fontSize?: string | number | null;
  };
  const comments = Array.isArray(p.comments)
    ? p.comments.filter((c): c is ThreadNode => !!c && typeof c === 'object')
    : [];
  const maxDepth = clampCount(p.maxDepth, 4, 1, 6);
  const collapsible = p.collapsible !== false;
  // Collapse set MIRRORED to a bindable string[] (spec.state when bound; local
  // otherwise). Set-backed for O(1) .has() reads, array in the store.
  const [collapsedArr, setCollapsedArr] = useBoundProp<string[]>(
    Array.isArray(p.collapsed) ? p.collapsed : [],
    bindings?.collapsed,
  );
  const collapsedSet = new Set(Array.isArray(collapsedArr) ? collapsedArr : []);
  // Id scope for every reply region below; each node appends its own index path.
  const idBase = ariaId('thread', element);
  const emitWith = useIntrinsicEmit(emit, element);
  const toggleCollapsed = (key: string) => {
    const next = new Set(collapsedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // Write the FULL resolved key array into spec.state on every toggle, and ALSO
    // mirror it into spec.state/_ui via the intrinsic emit (resolved collapsed-key
    // array + the toggled key) so the collapse is captured even when unbound.
    const resolved = Array.from(next);
    emitWith('change', { collapsed: resolved, key });
    setCollapsedArr(resolved);
  };
  return (
    // Typography parity with the standalone Comment: font cascades from the root,
    // fontSize rides the shared --fr-comment-fs chain CommentBody already reads,
    // weight/tracking flow down to every author line / body. The reply rail reads
    // --fr-comment-rail (borderColor channel; border-token fallback when unset).
    <div
      className={cn('flex w-full flex-col gap-4', fontClass(p.font))}
      style={styleVars(
        { var: '--fr-comment-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-comment-rail', value: p.borderColor, kind: 'color' },
        { var: '--fr-comment-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {comments.map((c, i) => (
        <ThreadNodeView
          key={i}
          node={c}
          nodeKey={String(i)}
          idBase={idBase}
          depth={0}
          maxDepth={maxDepth}
          collapsible={collapsible}
          collapsedSet={collapsedSet}
          onToggle={toggleCollapsed}
          onAction={() => {}}
          leading={p.leading}
          weight={p.weight}
          tracking={p.tracking}
        />
      ))}
    </div>
  );
}

/* ── SocialBar — a row of icon-only social / contact links ────────────────────
 * Each item resolves to a CLOSED registry glyph (a brand `network` wins, else an
 * `icon` name); unknown → the item is skipped (never raw markup). Links flow
 * through `safeUrl` + `linkTargetRel(true)` (new tab, rel=noopener noreferrer).
 * `accent` lands in --fr-social-accent (the icon color, or the chip fill when
 * `variant:filled`). Icon-only → each link carries an aria-label. */
const SOCIAL_NET_LABEL: Record<string, string> = {
  twitter: 'X (Twitter)',
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  github: 'GitHub',
};
const SOCIAL_SIZE: Record<string, { box: string; icon: number }> = {
  sm: { box: 'h-8 w-8', icon: 16 },
  md: { box: 'h-9 w-9', icon: 18 },
  lg: { box: 'h-11 w-11', icon: 22 },
};
const SOCIAL_ALIGN: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

export function SocialBar({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    items?: Array<{ network?: string | null; icon?: string | null; href?: string | null; label?: string | null }> | null;
    size?: string | null;
    variant?: 'plain' | 'filled' | 'outline' | null;
    align?: string | null;
    accent?: unknown;
    accentText?: unknown;
  };
  const items = Array.isArray(p.items) ? p.items : [];
  const sz = SOCIAL_SIZE[p.size ?? 'md'] ?? SOCIAL_SIZE.md;
  const variant = (p.variant as 'plain' | 'filled' | 'outline' | null) ?? 'plain';
  const align = SOCIAL_ALIGN[p.align ?? 'start'] ?? SOCIAL_ALIGN.start;

  // Resolve each item to a known glyph (brand network wins, else a registry icon);
  // drop items that resolve to nothing so no broken link renders.
  const resolved = items
    .map((it) => {
      const glyph =
        typeof it.network === 'string' && hasIcon(it.network)
          ? it.network
          : typeof it.icon === 'string' && hasIcon(it.icon)
            ? it.icon
            : null;
      if (!glyph) return null;
      const label = (typeof it.label === 'string' && it.label) || SOCIAL_NET_LABEL[glyph] || glyph;
      return { glyph, href: safeUrl(it.href), label };
    })
    .filter((x): x is { glyph: string; href: string; label: string } => x != null);

  if (resolved.length === 0) return null;

  const linkCls = cn(
    'inline-flex shrink-0 items-center justify-center rounded-frayme outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-primary',
    sz.box,
    variant === 'filled' &&
      '[background:var(--fr-social-accent,var(--color-primary))] [color:var(--fr-social-accent-text,var(--color-primary-foreground))] hover:opacity-90',
    variant === 'outline' && 'border border-border [color:var(--fr-social-accent,var(--color-foreground))] hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
    variant === 'plain' && '[color:var(--fr-social-accent,var(--color-muted-foreground))] hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
  );

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', align)}
      role="group"
      aria-label="Social links"
      style={styleVars(
        { var: '--fr-social-accent', value: p.accent, kind: 'color' },
        { var: '--fr-social-accent-text', value: p.accentText, kind: 'color' },
      )}
    >
      {resolved.map((r, i) => (
        <a key={i} href={r.href} {...linkTargetRel(true)} aria-label={r.label} title={r.label} className={linkCls}>
          <Icon name={r.glyph} size={sz.icon} />
        </a>
      ))}
    </div>
  );
}
