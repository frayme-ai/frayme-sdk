'use client';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { cn } from '../cn.js';
import { safeUrl, linkTargetRel } from './url-safety.js';
import { SafeImage } from './_img.js';
import { styleVars, borderStyleClass, shadowClass, aspectClass, weightClass, leadingClass } from './_style.js';
import { Icon, hasIcon } from './icons.js';
import { safeDimension } from '@frayme/catalog/validate';

/* Catalog group (ai-content): Sources, InlineCitation, Artifact, WebPreview,
 * Shimmer, DiffView — AI-native surfaces (citations, artifacts, streaming, diff).
 *
 * Same truly-dynamic contract as the shipped 57:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (a color the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     `var(--fr-…, var(--color-…))` utilities. The class set stays closed
 *     (no JIT, no injection); only the var's VALUE is model-supplied, and
 *     `styleVars` re-validates + omits any failing/absent value so the token
 *     fallback wins (props-less → polished).
 *
 * value > enum precedence is N/A here (no color VALUE competes with a tone enum);
 * the `accent` channels feed a var with a token fallback directly.
 *
 * SECURITY (non-negotiable):
 *   - URLs guarded at point-of-use: href={safeUrl(..)}; images render via
 *     `SafeImage` (src validated through safeImageSrc + onError fallback);
 *     external links get {...linkTargetRel(true)} (target=_blank + rel=noopener).
 *   - Artifact/DiffView text is rendered as ESCAPED React text (split into lines
 *     → spans), NEVER innerHTML / dangerouslySetInnerHTML.
 *   - Icons are NAMES resolved against the closed icons.ts registry, never SVG.
 *   - Shimmer reuses the existing `fr-shimmer` keyframe pattern (no new keyframe).
 */

/* ── shared helper: the hostname label for a URL ──────────────────────────── */
/** Extract a clean hostname for the muted source label. Never throws; falls back
 *  to a hand-parsed host, or '' when there is none (relative/empty). */
function hostnameOf(url: unknown): string {
  if (typeof url !== 'string' || url.length === 0) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // relative/fragment or unparsable — best-effort strip of scheme + path.
    const m = url.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
    return m ? m[1].replace(/^www\./, '') : '';
  }
}

/* ── Sources ──────────────────────────────────────────────────────────────── */

// Inner layout for the two variants. The `--fr-sources-accent` token default +
// the styleVars override both live on the OUTER section (inline wins over the
// class default), so these layout classes must NOT redeclare the var or the
// inner declaration would shadow the section's inline override.
const sourcesList = 'flex w-full flex-col gap-2';
// minmax min reads --fr-sources-mincol (exact override on the section) with a
// 13rem fallback track minimum. variant:list never reads it.
// auto-fit (never auto-fill): the track count is host-width driven, so a wide
// container otherwise keeps empty trailing tracks at the minimum and starves the
// real cards — auto-fit collapses them and the spare width goes to the cards.
// min(100%, …) around the track floor: without it a 13rem minimum stays 13rem
// inside a 200px column and the whole grid leaves the render surface.
// Grid's own auto-fit branch already guards this exact way; this one was missed.
const sourcesGrid =
  'grid w-full gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--fr-sources-mincol,13rem)),1fr))]';
// min-w-0: a grid item's automatic minimum is its min-content, so a long source
// title would push the track wider than the column that holds it.
const sourceCard =
  'group flex min-w-0 flex-col gap-1 rounded-frayme border border-border bg-card p-3 text-left no-underline transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]';

export function Sources({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    sources?: Array<{ title: string; url?: string | null; excerpt?: string | null }> | null;
    title?: string | null;
    variant?: string | null;
    minColWidth?: string | number | null;
    externalIcon?: string | null;
    accent?: string | null;
    mutedColor?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    shadow?: string | null;
  };
  const variant = (p.variant as 'list' | 'grid' | null) ?? 'list';
  const sources = (p.sources ?? []).filter((s) => s != null);
  const heading = p.title ?? 'Sources';
  // Glyph override resolves ONLY through the closed registry; unknown/absent → default.
  const extIcon = typeof p.externalIcon === 'string' && hasIcon(p.externalIcon) ? p.externalIcon : 'arrow-up-right';
  const style = styleVars(
    { var: '--fr-sources-accent', value: p.accent, kind: 'color' },
    { var: '--fr-sources-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-sources-bg', value: p.bg, kind: 'color' },
    { var: '--fr-sources-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-sources-mincol', value: p.minColWidth, kind: 'dim', opts: { units: ['px', 'rem'], min: 96, max: 480 } },
  );
  // Standard card-surface channels (family parity with Artifact/WebPreview):
  // CONDITIONAL so the token defaults win when absent; the border reader uses
  // the GROUP FORM so tw-merge dedupes the baked `border-border`. shadowClass
  // LAST so a set enum dedupe-wins; unset → undefined → cn drops it.
  const cardSurface = [
    p.bg != null && '[background:var(--fr-sources-bg,var(--color-card))]',
    p.borderColor != null && 'border-[color:var(--fr-sources-border,var(--color-border))]',
    shadowClass(p.shadow),
  ] as const;
  return (
    <section className="flex w-full flex-col gap-2 [--fr-sources-accent:var(--color-foreground)]" style={style}>
      {heading !== '' && (
        <h3 className="m-0 text-[0.8125rem] font-semibold uppercase tracking-wide [color:var(--fr-sources-muted,var(--color-muted-foreground))]">
          {heading}
        </h3>
      )}
      <div className={cn(variant === 'grid' ? sourcesGrid : sourcesList)}>
        {sources.map((s, i) => {
          const host = hostnameOf(s.url);
          // The headline is the card's only link text, so its accent needs a
          // luminance guard: a raw model colour carries no relation to the surface
          // it lands on. Mixing a fixed share of the theme foreground into the
          // accent keeps its hue/chroma while pulling it toward whichever end of
          // the current theme is legible (lighter on dark, darker on light).
          // The section's default IS --color-foreground and color-mix of a colour
          // with itself is the identity, so an unset accent is unchanged.
          // The headline wraps: the card is the source's only identification and the
          // grid rows are auto-height, so there is no fixed-line contract to buy the
          // ellipsis — the excerpt below carries the DECLARED budget.
          // No min-w-0 on this LEAF: the card above already carries it (that is where
          // the grid track's automatic minimum needed overriding). On the text node the
          // same class drops the box below its own longest word, and break-words then
          // breaks mid-word to fit — measured as a title set one character per line.
          const titleNode = (
            <span className="break-words font-medium leading-snug [color:color-mix(in_oklab,var(--fr-sources-accent),var(--color-foreground)_25%)]" title={s.title || undefined}>{s.title}</span>
          );
          const inner = (
            <>
              <span className="flex items-start justify-between gap-2">
                {titleNode}
                {s.url != null && (
                  <span className="mt-0.5 shrink-0 [color:var(--fr-sources-muted,var(--color-muted-foreground))] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                    <Icon name={extIcon} size={14} />
                  </span>
                )}
              </span>
              {/* A clipped hostname ("news.bbc.co…") reads as a different domain —
                  the value must survive, so it wraps instead. */}
              {host !== '' && (
                <span className="break-words text-[0.6875rem] [color:var(--fr-sources-muted,var(--color-muted-foreground))]" title={host}>{host}</span>
              )}
              {/* A DECLARED two-line budget is honest for prose; break-words keeps a
                  long URL inside the excerpt from blowing the card's width. */}
              {s.excerpt != null && (
                <span className="line-clamp-2 break-words text-[0.8125rem] leading-snug [color:var(--fr-sources-muted,var(--color-muted-foreground))]" title={s.excerpt || undefined}>{s.excerpt}</span>
              )}
            </>
          );
          if (s.url != null) {
            return (
              <a key={i} className={cn(sourceCard, ...cardSurface)} href={safeUrl(s.url)} {...linkTargetRel(true)}>
                {inner}
              </a>
            );
          }
          return (
            <div key={i} className={cn(sourceCard, 'hover:bg-card', ...cardSurface)}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── InlineCitation ───────────────────────────────────────────────────────── */

const citation =
  'mx-0.5 inline-flex items-center justify-center rounded-[0.25rem] bg-[color:var(--fr-surface-sunken,var(--color-muted))] px-1 align-super text-[0.625rem] font-semibold leading-none no-underline [color:var(--fr-cite-accent,var(--color-info))] hover:brightness-110';

/* HIT AREA (WCAG 2.5.8) for the LINKED citation only — the <sup> form is a marker,
 * not a pointer target, and gets none of this.
 *
 * The marker measures ~20×14 CSS px (0.625rem text, leading-none, px-1, py-0.5).
 * Enlarging the marker itself is not an option: it is `align-super` inside running
 * prose, so a 24px box would set the line height of every paragraph that cites a
 * source — that is the "damage the design" case. So the VISUAL stays and a 24×24
 * transparent ::before overlay, absolutely positioned and therefore out of flow,
 * carries the target. Zero layout delta, zero visual delta.
 *
 * Adjacent citations do NOT fight over the overlap: "[1][2]" puts marker centres
 * ~24px apart (20px marker + 2px mx-0.5 each side), so the two 24px overlays tile
 * edge-to-edge rather than intersecting. Vertically the overlay reaches ~5px into
 * the neighbouring line, but only over non-target prose.
 *
 * Worth noting we could have declined this one: 2.5.8's "Inline" exception exempts
 * a target whose size is constrained by the line-height of the sentence around it,
 * which is precisely what an inline citation is. We took the overlay anyway because
 * it costs nothing — an exemption still leaves a 14px-tall thing to hit on a phone. */
const citationHit =
  "relative py-0.5 before:absolute before:left-1/2 before:top-1/2 before:h-6 before:w-6 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']";

export function InlineCitation({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    index?: number | null;
    url?: string | null;
    excerpt?: string | null;
    accent?: string | null;
  };
  const n = typeof p.index === 'number' && Number.isFinite(p.index) ? p.index : 0;
  const marker = `[${n}]`;
  const style = styleVars({ var: '--fr-cite-accent', value: p.accent, kind: 'color' });
  const title = p.excerpt ?? undefined;
  if (p.url != null) {
    return (
      <a
        className={cn(citation, citationHit)}
        href={safeUrl(p.url)}
        {...linkTargetRel(true)}
        title={title}
        aria-label={p.excerpt != null ? `Citation ${n}: ${p.excerpt}` : `Citation ${n}`}
        style={style}
      >
        {marker}
      </a>
    );
  }
  return (
    <sup className={cn(citation, 'py-0.5')} title={title} aria-label={`Citation ${n}`} style={style}>
      {marker}
    </sup>
  );
}

/* ── Artifact ─────────────────────────────────────────────────────────────── */

const ARTIFACT_ICON: Record<string, string> = { code: 'copy', document: 'edit', preview: 'eye' };

// max-height reads --fr-artifact-maxh (exact override) with the 28rem fallback =
// the prior hardcoded cap. Replaces the old max-h utility (its own tw-merge
// group) outright so there is exactly one max-height declaration.
const artifactBody = cva(
  // Body text reads the fg var chain (foreground-token fallback → byte-identical
  // when `color` is unset) so a dark custom `bg` can carry a legible body text.
  'm-0 [max-height:var(--fr-artifact-maxh,28rem)] overflow-auto p-4 text-sm leading-relaxed text-[color:var(--fr-artifact-fg,var(--color-foreground))]',
  {
    variants: {
      kind: {
        code: 'whitespace-pre font-mono',
        document: 'whitespace-pre-wrap',
        preview: 'whitespace-pre-wrap',
      },
    },
    defaultVariants: { kind: 'document' },
  },
);

export function Artifact({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title?: string | null;
    content?: string | null;
    kind?: string | null;
    maxHeight?: string | number | null;
    copyLabel?: string | null;
    copiedLabel?: string | null;
    accent?: string | null;
    color?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    borderStyle?: string | null;
    borderWidthValue?: string | number | null;
    mutedColor?: string | null;
    shadow?: string | null;
  };
  const kind = (p.kind as 'code' | 'document' | 'preview' | null) ?? 'document';
  const content = typeof p.content === 'string' ? p.content : '';
  // Localisable copy-button labels — default to the current English literals
  // so an unset spec is byte-identical. Rendered as escaped React text.
  const copyLabel = typeof p.copyLabel === 'string' ? p.copyLabel : 'Copy';
  const copiedLabel = typeof p.copiedLabel === 'string' ? p.copiedLabel : 'Copied';
  const [copied, setCopied] = useState(false);
  const glyph = ARTIFACT_ICON[kind] ?? 'edit';
  const copy = (): void => {
    try {
      void navigator.clipboard?.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (no-op) */
    }
  };
  // Split into lines so code/preview bodies render as escaped text nodes — the
  // content can NEVER reach the DOM as markup.
  const lines = content.split('\n');
  return (
    <figure
      className={cn(
        // The outer panel border: explicit border-solid keeps the 1px frame
        // rendering, the width reads --fr-artifact-bw (default 1px, byte-identical
        // to the prior bare `border`). NEVER co-locate `border`/`border-2` here.
        'm-0 overflow-hidden rounded-frayme border-solid border-border [border-width:var(--fr-artifact-bw,1px)] bg-card',
        // value > token default: only override surface/border when the model named
        // one (CONDITIONAL so `bg-card`/`border-border` win when absent).
        p.bg != null && '[background:var(--fr-artifact-bg,var(--color-card))]',
        // Group form (border-color group) so tw-merge dedupes the base
        // `border-border` — the bare [border-color:…] arbitrary sorted earlier
        // in the compiled sheet and lost to the token.
        p.borderColor != null && 'border-[color:var(--fr-artifact-border,var(--color-border))]',
        // Closed border-style enum → static utility (border-style group; dedupes
        // against `border-solid` and wins). Unset → undefined → keeps solid.
        borderStyleClass(p.borderStyle),
        // Closed shadow enum → static box-shadow utility, LAST so a set value
        // dedupe-wins its tw-merge group. The panel bakes no shadow, so unset →
        // undefined → cn drops it → byte-identical flat default.
        shadowClass(p.shadow),
      )}
      style={styleVars(
        { var: '--fr-artifact-accent', value: p.accent, kind: 'color' },
        { var: '--fr-artifact-fg', value: p.color, kind: 'color' },
        { var: '--fr-artifact-bg', value: p.bg, kind: 'color' },
        { var: '--fr-artifact-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-artifact-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-artifact-maxh', value: p.maxHeight, kind: 'dim', opts: { units: ['px', 'rem', 'vh'], min: 120, max: 1600 } },
        { var: '--fr-artifact-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
      )}
    >
      <figcaption
        className={cn(
          'flex items-center justify-between gap-2 border-b border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))]/40 px-3 py-2',
          // Coherence 'panel frame': the header divider follows the outer border
          // channel (conditional, same pattern as the figure edge; side-specific
          // group form so it wins the bottom side over `border-border`).
          p.borderColor != null && 'border-b-[color:var(--fr-artifact-border,var(--color-border))]',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 [color:var(--fr-artifact-accent,var(--color-foreground))]" aria-hidden>
            <Icon name={glyph} size={15} />
          </span>
          {/* The artifact title names what the panel contains — it wraps rather than
              clips; the copy button beside it is already shrink-0, so the caption row
              grows in height instead of eating the title. min-w-0 belongs on the flex
              WRAPPER above, not here: on the leaf it lets the box shrink past its
              longest word and break-words then shatters the title mid-word. */}
          <span className="break-words text-[0.8125rem] font-medium [color:var(--fr-artifact-accent,var(--color-foreground))]" title={p.title ?? undefined}>
            {p.title ?? ''}
          </span>
        </span>
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[calc(var(--radius-frayme)/2)] border border-border bg-card px-2 py-1 text-[0.75rem] [color:var(--fr-artifact-muted,var(--color-muted-foreground))] transition hover:text-foreground',
            // Coherence 'panel fill': the copy-button chip follows the same surface
            // channels as the panel (conditional; group-form border dedupes the token).
            p.bg != null && '[background:var(--fr-artifact-bg,var(--color-card))]',
            p.borderColor != null && 'border-[color:var(--fr-artifact-border,var(--color-border))]',
          )}
          aria-label={copied ? copiedLabel : 'Copy artifact'}
          onClick={copy}
        >
          <Icon name={copied ? 'check' : 'copy'} size={13} />
          {copied ? copiedLabel : copyLabel}
        </button>
      </figcaption>
      <div
        className={cn(artifactBody({ kind }))}
        // Same keyboard contract as DiffView's columns below, same reasoning: the
        // body is this panel's scrollport (a hard 28rem max-height by default, and
        // kind:'code' is `whitespace-pre` so long lines scroll sideways too) and it
        // holds no focusable child — the copy button sits in the figcaption,
        // OUTSIDE it. group, not region, for the landmark reason.
        // Named after the panel's own caption, falling back to the component name
        // when the spec left the title empty (an unnamed tab stop announces bare
        // "group" and tells a reader nothing about what they landed in).
        // No Artifact has been observed overflowing, but it is the identical
        // shape to the DiffColumn that did, in the same file, so it is fixed with
        // it rather than left to be re-found later.
        role="group"
        aria-label={typeof p.title === 'string' && p.title !== '' ? p.title : 'Artifact'}
        tabIndex={0}
      >
        {/* React escapes every text node — content is never interpreted as HTML. */}
        {lines.map((line, i) => (
          <span key={i} className="block">
            {line.length > 0 ? line : '​'}
          </span>
        ))}
      </div>
    </figure>
  );
}

/* ── WebPreview ───────────────────────────────────────────────────────────── */

export function WebPreview({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    url?: string | null;
    title?: string | null;
    weight?: string | null;
    leading?: string | null;
    width?: string | number | null;
    description?: string | null;
    image?: string | null;
    aspect?: string | null;
    externalIcon?: string | null;
    accent?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    borderWidthValue?: string | number | null;
    mutedColor?: string | null;
    shadow?: string | null;
  };
  const host = hostnameOf(p.url);
  // Glyph override resolves ONLY through the closed registry; unknown/absent → default.
  const extIcon = typeof p.externalIcon === 'string' && hasIcon(p.externalIcon) ? p.externalIcon : 'external-link';
  const style = styleVars(
    { var: '--fr-webpreview-accent', value: p.accent, kind: 'color' },
    { var: '--fr-webpreview-bg', value: p.bg, kind: 'color' },
    { var: '--fr-webpreview-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-webpreview-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-webpreview-width', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], min: 120, max: 720 } },
    { var: '--fr-webpreview-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
  );
  return (
    <a
      className={cn(
        // max-width reads --fr-webpreview-width (exact override) with the 28rem
        // fallback = the prior max-w-md cap; replaces max-w-md outright (own
        // tw-merge group) so there is exactly one max-width declaration.
        // Border width reads --fr-webpreview-bw (default 1px, byte-identical to the
        // prior bare `border`); explicit border-solid keeps the frame rendering.
        // NEVER co-locate `border` with the arbitrary border-width here.
        'group flex w-full [max-width:var(--fr-webpreview-width,28rem)] flex-col overflow-hidden rounded-frayme border-solid border-border [border-width:var(--fr-webpreview-bw,1px)] bg-card no-underline transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
        // value > token default: only override the resting surface/border when the
        // model named one (CONDITIONAL; `hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]` is a separate variant so
        // hover still wins on hover).
        p.bg != null && '[background:var(--fr-webpreview-bg,var(--color-card))]',
        p.borderColor != null && '[border-color:var(--fr-webpreview-border,var(--color-border))]',
        // Closed shadow enum → static box-shadow utility, LAST so a set value
        // dedupe-wins its tw-merge group. The card bakes no shadow, so unset →
        // undefined → cn drops it → byte-identical flat default.
        shadowClass(p.shadow),
      )}
      href={safeUrl(p.url)}
      {...linkTargetRel(true)}
      style={style}
    >
      {/* NO IMAGE, NO MEDIA BLOCK. The 1.91:1 fallback exists for an image that
          was PROMISED and failed — it holds the slot the layout already gave
          away. When the spec names no `image` at all, nothing was promised, and
          painting the block turned every WebPreview tested
          into a ~400px grey slab over two lines of text (invisible inside
          a ListItem). A link card without an image is just a link card. */}
      {p.image != null && <SafeImage
        // aspect-ratio is its own tw-merge group: a SET p.aspect dedupe-wins the
        // baked aspect-[1.91/1]; unset → aspectClass undefined → cn drops it →
        // the baked OG ratio is preserved (byte-identical). Kept in sync with the
        // fallback span below.
        className={cn('aspect-[1.91/1] w-full object-cover', aspectClass(p.aspect))}
        src={p.image}
        alt={p.title ?? host}
        loading="lazy"
        fallback={
          <span
            className={cn(
              'flex aspect-[1.91/1] w-full items-center justify-center bg-[color:var(--fr-surface-sunken,var(--color-muted))] [color:var(--fr-webpreview-muted,var(--color-muted-foreground))]',
              aspectClass(p.aspect),
            )}
            aria-hidden
          >
            <Icon name={extIcon} size={28} />
          </span>
        }
      />}
      <span className="flex min-w-0 flex-col gap-1 p-3">
        {p.title != null && (
          <span
            className={cn(
              // The preview's headline wraps — the card is a flex COLUMN with no fixed
              // height, so an ellipsis bought nothing and deleted the page title.
              'break-words font-medium leading-snug [color:var(--fr-webpreview-accent,var(--color-foreground))]',
              // Typography channels: each is a same-group utility (font-*/leading-*)
              // placed LAST so a SET value dedupe-wins over the baked font-medium /
              // leading-snug; unset → helper returns undefined and cn drops it
              // (byte-identical default).
              weightClass(p.weight),
              leadingClass(p.leading),
            )}
            title={p.title}
          >
            {p.title}
          </span>
        )}
        {/* The 2-line box clamp is a DECLARED vertical budget (kept); break-words
            stops an unbroken URL in the description from widening the card. */}
        {p.description != null && (
          <span className="overflow-hidden break-words text-[0.8125rem] leading-snug [color:var(--fr-webpreview-muted,var(--color-muted-foreground))] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]" title={p.description}>
            {p.description}
          </span>
        )}
        {host !== '' && (
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[0.6875rem] [color:var(--fr-webpreview-muted,var(--color-muted-foreground))]">
            <span className="shrink-0" aria-hidden>
              <Icon name={extIcon} size={11} />
            </span>
            {/* Hostname wraps rather than clips — a half-shown domain misidentifies
                the link's destination. The row above is the flex item that needs
                min-w-0; on the leaf it would let a domain break one letter per line. */}
            <span className="break-words" title={host}>{host}</span>
          </span>
        )}
      </span>
    </a>
  );
}

/* ── Shimmer ──────────────────────────────────────────────────────────────── */

/* The streaming placeholder — N lines (last shorter), each animated via the
 * existing `fr-shimmer` keyframe (same after:* pattern as Skeleton's shimmer in
 * data-display.tsx). No new keyframe; aria-hidden (decorative). */
const shimmerLine =
  'h-3.5 rounded-frayme bg-[color:var(--fr-surface-sunken,var(--color-muted))] relative overflow-hidden after:absolute after:inset-0 after:animate-[fr-shimmer_1.4s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent';

/** Local count clamp for `lines` (mirrors the gate's count bounds 1-6). */
function safeLineCount(v: unknown): number {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return 3;
  return Math.min(Math.max(Math.round(n), 1), 6);
}

export function Shimmer({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as { lines?: string | number | null };
  const count = p.lines != null ? safeLineCount(p.lines) : 3;
  // Widths vary per line for a natural streaming look; the LAST line is shorter.
  const widths = ['100%', '92%', '96%', '88%', '94%', '60%'];
  return (
    <div className="flex w-full flex-col gap-2" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(shimmerLine)}
          style={{ width: i === count - 1 ? '60%' : widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

/* ── DiffView ─────────────────────────────────────────────────────────────── */

type DiffLine = { kind: 'added' | 'removed' | 'unchanged'; text: string };

/** A SIMPLE line-based diff (LCS) over the two text blocks. Output is a list of
 *  {kind,text} rows; the renderer maps each to an ESCAPED text line with a +/-
 *  gutter — never markup. O(n·m) on line counts (fine for artifact-sized text). */
function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const n = a.length;
  const m = b.length;
  // LCS length table.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'unchanged', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: 'removed', text: a[i] });
      i++;
    } else {
      out.push({ kind: 'added', text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ kind: 'removed', text: a[i++] });
  while (j < m) out.push({ kind: 'added', text: b[j++] });
  return out;
}

/* Per-row tint — static classes only; the +/- color is a token mix (flips in
 * dark mode because it mixes over the semantic success/danger tokens). */
const diffRow = cva('flex', {
  variants: {
    kind: {
      added: '[background:color-mix(in_srgb,var(--frayme-success)_14%,transparent)]',
      removed: '[background:color-mix(in_srgb,var(--frayme-danger)_14%,transparent)]',
      unchanged: '',
    },
  },
  defaultVariants: { kind: 'unchanged' },
});
const DIFF_SIGN: Record<DiffLine['kind'], string> = { added: '+', removed: '-', unchanged: ' ' };
const diffSign = cva('w-4 shrink-0 select-none text-center font-mono', {
  variants: {
    kind: {
      added: 'text-success',
      removed: 'text-danger',
      // mutedColor channel at the original 50% alpha — color-mix preserves the
      // tint; the muted-foreground token fallback keeps the unset default.
      unchanged: '[color:color-mix(in_srgb,var(--fr-diff-muted,var(--color-muted-foreground))_50%,transparent)]',
    },
  },
  defaultVariants: { kind: 'unchanged' },
});

/** One column of escaped diff rows (used for both unified + each split side).
 *  `side` filters which rows render content: the before column hides `added`
 *  rows, the after column hides `removed` rows; unified (no `side`) shows all.
 *  `name` is the caption the reader can already see — it names the scrollport. */
function DiffColumn({
  rows,
  showLineNumbers,
  side,
  name,
}: {
  rows: DiffLine[];
  showLineNumbers: boolean;
  side?: 'before' | 'after';
  name: string;
}): ReactNode {
  // A row is hidden in a split column when it belongs only to the other side.
  const isHidden = (kind: DiffLine['kind']): boolean =>
    (side === 'before' && kind === 'added') || (side === 'after' && kind === 'removed');
  let num = 0;
  // The accessible name of the scrollport: the caption, plus which half of a
  // split view this column is (the two columns are otherwise indistinguishable
  // to a reader that has just tabbed into one of them).
  const label = side === 'before' ? `${name}, before` : side === 'after' ? `${name}, after` : name;
  return (
    <div
      className="min-w-0 flex-1 overflow-x-auto py-2 font-mono text-[0.8125rem] leading-relaxed"
      // KEYBOARD (WCAG 2.1.1): every row is `whitespace-pre`, so a diff line wider
      // than the panel is reachable ONLY by scrolling this box sideways — and
      // nothing inside it can take focus (each child is a span). A scroll
      // container that cannot be focused cannot be scrolled without a pointer, so
      // the far end of every long line was simply unreachable from the keyboard.
      // The scrollport earns its own tab stop (scheduler.tsx precedent), and it is
      // NOT a redundant one: there is no focusable descendant to walk to instead.
      //
      // role="group", not "region": region is a LANDMARK, so a page showing three
      // diffs (six columns in split mode) would put six extra entries in a screen
      // reader's landmark list, competing with the page's real ones. A named group
      // announces the scrollport without that cost.
      role="group"
      aria-label={label}
      tabIndex={0}
    >
      {rows.map((row, i) => {
        const hidden = isHidden(row.kind);
        // A visible row consumes a line number for this column.
        const lineNo = hidden ? null : ++num;
        return (
          <div key={i} className={cn(diffRow({ kind: hidden ? 'unchanged' : row.kind }), 'px-2')}>
            {showLineNumbers && (
              // CONTRAST (WCAG 1.4.3): the gutter was the muted colour at 60% alpha,
              // which composites to #aaaaaf over the card = 2.31:1 light / 3.29:1
              // dark. A line number is INFORMATION (it is how a reader cites a hunk),
              // not decoration, so it needs 4.5:1 — and no alpha above transparent
              // gets there, because the muted token is only 4.83:1 to begin with.
              // Dropping the alpha lands it at 4.83:1 light / 6.91:1 dark while
              // staying visibly secondary to the body text (~16:1).
              // The +/- sign column next door keeps its 50% mix: its only
              // low-contrast case renders U+0020, so the colour paints nothing.
              <span className="mr-2 w-8 shrink-0 select-none text-right [color:var(--fr-diff-muted,var(--color-muted-foreground))]" aria-hidden>
                {lineNo ?? ''}
              </span>
            )}
            {!hidden && (
              <span className={cn(diffSign({ kind: row.kind }))} aria-hidden>
                {DIFF_SIGN[row.kind]}
              </span>
            )}
            {/* React escapes this text node — diff content is never HTML.
                CONTRAST (WCAG 1.4.3): this was `[color:inherit]`, and inheriting
                is the WRONG answer here — the inherited-foreground rule pointing
                the other way. The <figure> above paints its OWN opaque fill
                (`bg-card`, or --fr-diff-bg when the spec names one), so a spec's
                `Card { bg:"#12161f", color:"#e2e6f0" }` handed this span a
                near-white ink to put on the panel's own white surface. Measured,
                default panel inside that Card: the diff BODY read 1.25:1 while the
                caption two elements up read 17.72:1 — the code in a code diff was
                the one thing on the panel you could not see.
                The token is what the rest of this panel already uses (the caption
                is `text-foreground`, the gutter the muted chain), so this makes
                the body agree with its own frame rather than with its container.
                Identical at root, where inherit and --color-foreground are both
                --frayme-fg. The remaining authored-`bg` case is unchanged and
                panel-wide: with `bg:"#0d1117"` the caption and body both measure
                1.07:1, before and after this line — DiffView has `bg` and
                `mutedColor` channels but no ink channel to pair with them. */}
            <span className="whitespace-pre text-foreground">
              {hidden ? '​' : row.text.length > 0 ? row.text : '​'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DiffView({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    before?: string | null;
    after?: string | null;
    filename?: string | null;
    headerLabel?: string | null;
    mode?: string | null;
    maxHeight?: string | number | null;
    showLineNumbers?: boolean | null;
    bg?: string | null;
    borderColor?: string | null;
    borderWidthValue?: string | number | null;
    mutedColor?: string | null;
    shadow?: string | null;
  };
  // Frozen header fallback defaults to the exact current English literal.
  const headerLabel = typeof p.headerLabel === 'string' ? p.headerLabel : 'Changes';
  const before = typeof p.before === 'string' ? p.before : '';
  const after = typeof p.after === 'string' ? p.after : '';
  const mode = (p.mode as 'unified' | 'split' | null) ?? 'unified';
  const showLineNumbers = p.showLineNumbers === true;
  // Optional height cap — same units/bounds as Artifact's maxHeight. When
  // set, the body region becomes a vertical scroll container (CONDITIONAL wrapper
  // so an unset diff renders unbounded, byte-identical to before).
  // Gate on VALIDITY not != null: an invalid-unit maxHeight is omitted by styleVars,
  // so the overflow-y-auto scroll box must not engage without a real cap.
  const capped = safeDimension(p.maxHeight, { units: ['px', 'rem', 'vh'], min: 120, max: 1600 }) != null;
  const rows = diffLines(before, after);
  const added = rows.filter((r) => r.kind === 'added').length;
  const removed = rows.filter((r) => r.kind === 'removed').length;
  // The visible caption — also the accessible name of the body scrollport(s)
  // below, so a keyboard user landing in one hears the same words they can see.
  const caption = p.filename ?? headerLabel;
  const body =
    mode === 'split' ? (
      <div className="flex [&>*+*]:border-l [&>*+*]:border-border">
        <DiffColumn rows={rows} showLineNumbers={showLineNumbers} side="before" name={caption} />
        <DiffColumn rows={rows} showLineNumbers={showLineNumbers} side="after" name={caption} />
      </div>
    ) : (
      <DiffColumn rows={rows} showLineNumbers={showLineNumbers} name={caption} />
    );
  return (
    <figure
      className={cn(
        // Standard surface set (family parity with Artifact/ToolCall). The bare
        // `border` folds into border-solid + the --fr-diff-bw width chain
        // (default 1px, byte-identical); conditional value readers beat the
        // token defaults only when the model named a color; shadowClass LAST.
        'm-0 overflow-hidden rounded-frayme border-solid border-border [border-width:var(--fr-diff-bw,1px)] bg-card',
        p.bg != null && '[background:var(--fr-diff-bg,var(--color-card))]',
        p.borderColor != null && 'border-[color:var(--fr-diff-border,var(--color-border))]',
        shadowClass(p.shadow),
      )}
      style={styleVars(
        { var: '--fr-diff-bg', value: p.bg, kind: 'color' },
        { var: '--fr-diff-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-diff-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-diff-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
        { var: '--fr-diff-maxh', value: p.maxHeight, kind: 'dim', opts: { units: ['px', 'rem', 'vh'], min: 120, max: 1600 } },
      )}
    >
      <figcaption
        className={cn(
          'flex items-center justify-between gap-2 border-b border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))]/40 px-3 py-2',
          // Coherence 'panel frame': the header divider follows borderColor
          // (conditional side-specific group form, same as Artifact).
          p.borderColor != null && 'border-b-[color:var(--fr-diff-border,var(--color-border))]',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 [color:var(--fr-diff-muted,var(--color-muted-foreground))]" aria-hidden>
            <Icon name="edit" size={14} />
          </span>
          {/* A path clipped from the right ("src/react/registry/ai-cont…") loses the
              filename — the only part that identifies the diff. It wraps; the +/-
              stat beside it is shrink-0, so the caption grows in height. min-w-0 stays
              on the wrapping span above — on this leaf it would break the path below
              its longest segment. */}
          <span className="break-words text-[0.8125rem] font-medium text-foreground" title={caption}>{caption}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[0.75rem] tabular-nums">
          <span className="text-success">+{added}</span>
          <span className="text-danger">-{removed}</span>
        </span>
      </figcaption>
      {capped ? (
        // Scrollable body — reads --fr-diff-maxh (validated dim on the figure).
        // Only emitted when `maxHeight` is set → unset diffs keep the flat markup.
        // NO tab stop of its own, deliberately: the column(s) inside are focusable
        // now and they FILL this wrapper edge to edge, so a focused column already
        // scrolls this box vertically (arrow keys the focused element cannot
        // consume scroll the nearest scrollable ancestor). A stop here would be a
        // second one over the same pixels — a redundant stop, which is worse than
        // none: it makes a reader Tab twice to get past a single diff.
        <div className="[max-height:var(--fr-diff-maxh)] overflow-y-auto">{body}</div>
      ) : (
        body
      )}
    </figure>
  );
}
