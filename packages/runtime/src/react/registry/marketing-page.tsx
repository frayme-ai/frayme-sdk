'use client';
import type { CSSProperties, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars, fontClass, weightClass, trackingClass, leadingClass, shadowClass } from './_style.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { Icon, hasIcon } from './icons.js';
import { safeImageSrc, safeUrl, linkTargetRel } from './url-safety.js';
import { SafeImage } from './_img.js';

/* Catalog group (marketing-page): Testimonial, FAQ, Footer, PricingTable,
 * PlanCard.
 *
 * Same truly-dynamic contract as the shipped components:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (colors the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities. The class set stays a
 *     closed, build-time set (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing/absent
 *     value so the token fallback wins (props-less → polished).
 *
 * INTERACTIVITY: FAQ rows expand/collapse via `useLocalOrBound` (the open-set),
 * so they work WITHOUT any spec binding — and when `openIndices` IS bound the
 * FULL resolved open-set is mirrored to spec.state on every toggle so an external
 * Button can read which questions are open. emit('change') is an ADDITIONAL host
 * signal, never the only effect. PricingTable / PlanCard CTAs are emit('commit')
 * / <a href> by design (host-routed plan choice). NO payment/card fields exist.
 *
 * Icons are NAMES resolved against the closed `icons.ts` registry (guarded by
 * hasIcon; unknown/null → nothing). Images go through safeImageSrc (raster only),
 * links through safeUrl + linkTargetRel. Quote/answer/feature bodies are plain
 * auto-escaped text — never markup. */

/* ── Testimonial ──────────────────────────────────────────────────────────── */

const testimonialWrap = cva('flex flex-col gap-4 [--fr-testimonial-accent:#f59e0b]', {
  variants: {
    variant: {
      // Width via a var-chain (default 1px) so a model `borderWidthValue` wins
      // without tw-merge keeping a co-located `border` width utility. Keep an
      // explicit `border-solid` so the style renders, and `border-border` for
      // the colour default. Only the card variant draws a border.
      card: 'rounded-frayme border-solid border-border [border-width:var(--fr-testimonial-bw,1px)] bg-card p-6',
      plain: 'p-0',
      large: 'gap-6 p-2',
    },
  },
  defaultVariants: { variant: 'card' },
});
// Font size flows through a two-step var chain (the Text/Button radius pattern):
// each variant sets ONLY the default var (never a text-* / arbitrary font-size
// utility — cva concatenation would leave stylesheet order, not cva order, to
// decide against the base's arbitrary rule), and the base reads exact `fontSize`
// (--fr-testimonial-fs) > the variant default. Unset → byte-identical sizes.
// Quote text colour reads the `color` channel via the text-color group
// form with the prior foreground token as the in-var fallback — the SOLE color
// source (no baked `text-foreground`, which would NOT dedupe against the
// arbitrary reader and would win source-order, making the channel inert). Unset
// → the token fallback computes the exact prior foreground (byte-identical).
const testimonialQuote = cva('m-0 text-[color:var(--fr-testimonial-fg,var(--color-foreground))] [font-size:var(--fr-testimonial-fs,var(--fr-testimonial-fs-default))]', {
  variants: {
    variant: {
      card: '[--fr-testimonial-fs-default:1.0625rem] leading-relaxed',
      plain: '[--fr-testimonial-fs-default:1.0625rem] leading-relaxed',
      large: '[--fr-testimonial-fs-default:1.5rem] font-medium leading-snug',
    },
  },
  defaultVariants: { variant: 'card' },
});

/** A 0–5 star row — filled stars up to the (clamped) rating, the rest muted. */
function StarRow({ rating }: { rating: number }): ReactNode {
  const n = Math.min(Math.max(Math.round(rating), 0), 5);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${n} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={i < n ? '[color:var(--fr-testimonial-accent)]' : 'text-muted-foreground/40'} aria-hidden>
          <Icon name="star" size={16} />
        </span>
      ))}
    </span>
  );
}

export function Testimonial({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    quote: string;
    authorName?: string | null;
    authorTitle?: string | null;
    avatarSrc?: string | null;
    rating?: number | null;
    variant?: string | null;
    accent?: string | null;
    color?: string | null;
    borderColor?: string | null;
    mutedColor?: string | null;
    borderWidthValue?: string | number | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const variant = (p.variant as 'card' | 'plain' | 'large' | null) ?? 'card';
  const rating = typeof p.rating === 'number' && Number.isFinite(p.rating) ? p.rating : null;
  const src = safeImageSrc(p.avatarSrc);
  const initials = (p.authorName ?? '')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const hasAuthor = p.authorName != null || p.authorTitle != null;
  // INHERITED FOREGROUND. `card` paints its OWN bg-card surface, so its copy
  // belongs to that fill and keeps the foreground TOKEN. `plain`/`large` paint
  // nothing — they sit directly on whatever an ancestor authored — so the token
  // was a RESET: inside an authored `Card {bg:"#12161f", color:"#e2e6f0"}` the
  // quote and the author name rendered rgb(24,24,27) on dark navy (the 1.00-1.02
  // contrast class). currentColor on the `color`
  // property computes to the INHERITED value, so it is byte-identical at the top
  // level (.frayme-root sets `color: var(--frayme-fg)` and --color-foreground IS
  // var(--frayme-fg)) and correct inside an authored container. --fr-testimonial-fg
  // stays at the head of the chain, so a SET `color` still wins in every variant.
  const bodyFg =
    variant === 'card'
      ? 'text-[color:var(--fr-testimonial-fg,var(--color-foreground))]'
      : 'text-[color:var(--fr-testimonial-fg,currentColor)]';
  return (
    <figure
      className={cn(
        testimonialWrap({ variant }),
        // Conditional border-colour override (card variant only) — token default
        // when unset, the model value wins when supplied (added last).
        variant === 'card' && p.borderColor != null && '[border-color:var(--fr-testimonial-border,var(--color-border))]',
        // Closed Font enum → a static font-* utility on the ROOT so the whole
        // testimonial inherits it. Unset/unknown → undefined → dropped (theme font).
        fontClass(p.font),
      )}
      style={styleVars(
        { var: '--fr-testimonial-accent', value: p.accent, kind: 'color' },
        // Primary text colour — quote body + author name travel together.
        { var: '--fr-testimonial-fg', value: p.color, kind: 'color' },
        { var: '--fr-testimonial-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-testimonial-muted', value: p.mutedColor, kind: 'color' },
        // Border thickness — only the card variant reads this var (its cva
        // applies `[border-width:var(--fr-testimonial-bw,1px)]`); unset → 1px.
        { var: '--fr-testimonial-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
        // Exact quote font size — wins over the variant default via the quote's
        // --fr-testimonial-fs → --fr-testimonial-fs-default chain; unset → omitted.
        { var: '--fr-testimonial-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {rating != null && <StarRow rating={rating} />}
      {/* Typography channels (6i) added LAST so a SET weight/tracking/leading
          dedupe-wins the variant-baked font-medium / leading-relaxed|snug; unset
          → undefined, cn drops them → byte-identical. Quote body only — not the
          author name/title. */}
      <blockquote
        className={cn(
          testimonialQuote({ variant }),
          // surface-relative ink (see `bodyFg`) — the text-COLOR group form, so it
          // dedupes-and-wins over the cva base's reader on the borderless variants
          // and collapses back to the identical class on `card`.
          bodyFg,
          weightClass(p.weight),
          trackingClass(p.tracking),
          leadingClass(p.leading),
        )}
      >
        {p.quote}
      </blockquote>
      {hasAuthor && (
        <figcaption className="flex items-center gap-3">
          {(src != null || initials) && (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-sm font-semibold text-[color:var(--fr-surface-fg,var(--color-foreground))]">
              <SafeImage
                className="h-full w-full object-cover"
                src={src}
                alt={p.authorName ?? 'Author'}
                fallback={<span aria-hidden>{initials}</span>}
              />
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            {/* Author name shares the `color` role with the quote body —
                the text-color group form is the SOLE source (drops text-foreground
                so the reader dedupe-wins); unset → the foreground token fallback. */}
            {/* Attribution wraps, never clips: a half-shown name ("Priya Raghunath…")
                or role is the one thing a testimonial cannot afford to lose, and the
                figcaption is a COLUMN with no height contract to defend. */}
            {p.authorName != null && <span className={cn('break-words font-medium', bodyFg)} title={p.authorName || undefined}>{p.authorName}</span>}
            {p.authorTitle != null && <span className="break-words text-[0.8125rem] [color:var(--fr-testimonial-muted,var(--color-muted-foreground))]" title={p.authorTitle || undefined}>{p.authorTitle}</span>}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────────── */

/* The default `--fr-faq-accent` is the OPEN row's ink. It was pinned to
   --color-foreground, which on an authored dark card painted the open question
   rgb(24,24,27) on dark navy. currentColor inside a custom property is
   substituted at the USE site — both readers apply it to `color` on a header
   span, where currentColor computes to the inherited value — so this resolves to
   exactly --color-foreground at the top level (byte-identical, and the quiet
   default of "no accent unless asked" is preserved: the open row already matched
   the closed one) while following an authored container. A SET `accent` still
   overrides the var via styleVars, unchanged. */
const faqWrap = cva('flex w-full flex-col [--fr-faq-accent:currentColor]', {
  variants: {
    variant: {
      bordered: 'divide-y divide-border overflow-hidden rounded-frayme border border-border',
      separated: 'gap-3',
      plain: 'divide-y divide-border',
    },
  },
  defaultVariants: { variant: 'bordered' },
});
const faqRow = cva('', {
  variants: {
    variant: {
      bordered: '',
      separated: 'rounded-frayme border border-border',
      plain: '',
    },
  },
  defaultVariants: { variant: 'bordered' },
});

export function FAQ({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    items?: Array<{ question?: string; answer?: string }> | null;
    allowMultiple?: boolean | null;
    variant?: string | null;
    defaultOpenIndex?: number | null;
    openIndices?: number[] | null;
    chevronIcon?: string | null;
    accent?: string | null;
    color?: string | null;
    borderColor?: string | null;
    mutedColor?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  // Glyph override resolves ONLY through the closed registry; unknown/absent → default.
  const chevron = typeof p.chevronIcon === 'string' && hasIcon(p.chevronIcon) ? p.chevronIcon : 'chevron-down';
  const items = Array.isArray(p.items)
    ? p.items.filter((it): it is { question?: string; answer?: string } => it != null && typeof it === 'object')
    : [];
  const variant = (p.variant as 'bordered' | 'separated' | 'plain' | null) ?? 'bordered';
  const allowMultiple = p.allowMultiple === true;
  const rawInitial =
    typeof p.defaultOpenIndex === 'number' && Number.isFinite(p.defaultOpenIndex)
      ? Math.trunc(p.defaultOpenIndex)
      : null;
  // Range-check against the items so an out-of-bounds index never opens a phantom row.
  const initial = rawInitial != null && rawInitial >= 0 && rawInitial < items.length ? rawInitial : null;
  // INTERNAL state — the accordion is live without any spec binding. When
  // `openIndices` is bound the FULL resolved open-set is mirrored to spec.state
  // on every toggle (so an external Button reads which questions are open); with
  // no binding it falls back to local state → byte-identical unbound rendering.
  const [openArr, setOpenArr] = useBoundProp<number[]>(
    p.openIndices ?? (initial != null ? [initial] : []),
    bindings?.openIndices,
  );
  // Derive the render-time set from the mirrored array.
  const open = new Set(Array.isArray(openArr) ? openArr : []);
  const emitWith = useIntrinsicEmit(emit, element);
  const toggle = (i: number): void => {
    // Compute the RESOLVED next open-set as an array and write it before emitting.
    const arr = Array.isArray(openArr) ? openArr : [];
    const has = open.has(i);
    let next: number[];
    if (has) next = arr.filter((x) => x !== i);
    else next = allowMultiple ? [...arr, i] : [i];
    setOpenArr(next);
    // Intrinsic payload: which row, its NEW open state, and its question text.
    emitWith('change', { index: i, open: !has, name: items[i]?.question ?? null });
  };

  return (
    <div
      className={cn(
        faqWrap({ variant }),
        // Divider/border colour override — the outer card border (bordered) and
        // the row dividers (`divide-y` sets border-color on `& > * + *`) default
        // to the border token; a model value recolors both. Conditional class so
        // the token default wins when unset.
        p.borderColor != null && '[border-color:var(--fr-faq-divider,var(--color-border))] [&>*+*]:[border-color:var(--fr-faq-divider,var(--color-border))]',
        // Closed Font enum → a static font-* utility on the ROOT so every row
        // inherits it. Unset/unknown → undefined → dropped (theme font).
        fontClass(p.font),
      )}
      style={styleVars(
        { var: '--fr-faq-accent', value: p.accent, kind: 'color' },
        { var: '--fr-faq-rest', value: p.color, kind: 'color' },
        { var: '--fr-faq-divider', value: p.borderColor, kind: 'color' },
        { var: '--fr-faq-muted', value: p.mutedColor, kind: 'color' },
        // Exact question-header font size — inherits down to every row's header
        // button, whose base reads var(--fr-faq-fs,0.9375rem); unset → omitted.
        { var: '--fr-faq-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {items.map((it, i) => {
        const isOpen = open.has(i);
        const baseId = `fr-faq-${(items[0]?.question ?? 'faq').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'faq'}`;
        const btnId = `${baseId}-h-${i}`;
        const panelId = `${baseId}-p-${i}`;
        return (
          <div
            key={i}
            className={cn(
              faqRow({ variant }),
              // separated rows carry their OWN border (no `divide`), so recolor
              // them here when a divider colour is set (token default otherwise).
              variant === 'separated' && p.borderColor != null && '[border-color:var(--fr-faq-divider,var(--color-border))]',
            )}
          >
            <h3 className="m-0">
              <button
                type="button"
                id={btnId}
                // fontSize is a single source: the baked 0.9375rem is the var
                // fallback (byte-identical when unset), and an exact fontSize wins
                // via the var. weight/tracking/leading closed enums → static
                // utilities, LAST in cn() so a set value dedupe-wins its group
                // (font-medium stays the default weight); unset → undefined →
                // dropped → byte-identical.
                className={cn(
                  // INHERITED FOREGROUND: no FAQ variant paints a fill (bordered
                  // draws a border, separated/plain nothing), so this header sits
                  // directly on the host surface and `text-foreground` was a reset
                  // to the global token — rgb(24,24,27) on an authored dark card.
                  // A <button> does not inherit `color` from the UA either, so
                  // currentColor is what turns the reset back into inheritance; on
                  // `color` it computes to the inherited value, byte-identical at
                  // the top level. The text-COLOR group form, so the resting
                  // `color` reader on the inner span is unaffected.
                  'flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-4 py-3.5 text-left [font-size:var(--fr-faq-fs,0.9375rem)] font-medium text-[color:currentColor] outline-none hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/50 focus-visible:ring-2 focus-visible:ring-primary/50',
                  weightClass(p.weight),
                  trackingClass(p.tracking),
                  leadingClass(p.leading),
                )}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(i)}
              >
                {/* Resting (closed) header text → `color` (text-color group form,
                    added LAST so it dedupes-and-wins over the button's
                    `text-foreground`); the OPEN header keeps the accent. */}
                <span
                  className={cn(
                    // The question IS the FAQ row — a nowrap ellipsis deleted the end of
                    // every real question ("How do I cancel my…"). It wraps; the chevron
                    // is shrink-0, so the header grows in height rather than clipping.
                    // No min-w-0: this is a text LEAF, and its automatic minimum (its
                    // longest word) is exactly the floor break-words must break against
                    // — released, the question wrapped one character per line.
                    'break-words',
                    isOpen
                      ? 'text-[color:var(--fr-faq-accent)]'
                      : p.color != null && 'text-[color:var(--fr-faq-rest,var(--color-foreground))]',
                  )}
                  title={it.question || undefined}
                >
                  {it.question ?? ''}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-muted-foreground transition-transform',
                    // closed-state chevron follows a SET `color` at reduced strength
                    // (the DatePicker-chevron model) — the text-color group form
                    // dedupes-and-wins over text-muted-foreground; unset keeps the
                    // exact token class (byte-identical).
                    !isOpen &&
                      p.color != null &&
                      'text-[color:color-mix(in_srgb,var(--fr-faq-rest,var(--color-foreground))_70%,transparent)]',
                    isOpen && 'rotate-180 text-[color:var(--fr-faq-accent)]',
                  )}
                  aria-hidden
                >
                  <Icon name={chevron} size={18} />
                </span>
              </button>
            </h3>
            {isOpen && (
              <div id={panelId} className="px-4 pb-4 text-sm leading-relaxed [color:var(--fr-faq-muted,var(--color-muted-foreground))]" role="region" aria-labelledby={btnId}>
                {it.answer ?? ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Footer ───────────────────────────────────────────────────────────────── */

/* `--fr-footer-accent` is read ONLY by the link/social `hover:[color:…]` rules,
   i.e. always as the `color` property. Pinned to --color-foreground it turned a
   hovered footer link rgb(24,24,27) on an authored dark card. currentColor is
   substituted at those use sites, where on `color` it computes to the INHERITED
   value — so it stays exactly --color-foreground at the top level (the resting
   muted grey and the hover still differ, since the resting rule sets the anchor's
   own colour and `color: currentColor` resolves to the PARENT's, not to it), and
   it follows an authored container. A SET `accent` overrides via styleVars. */
const footerWrap = cva('w-full [--fr-footer-accent:currentColor]', {
  variants: {
    variant: {
      columns: 'flex flex-col gap-8',
      simple: 'flex flex-col items-center gap-4 text-center',
    },
  },
  defaultVariants: { variant: 'columns' },
});

/** Render the social icon links (icon NAME guarded against the closed registry). */
function FooterSocials({ socials }: { socials: Array<{ icon?: string; href?: string }> }): ReactNode {
  if (socials.length === 0) return null;
  return (
    <div className="flex items-center gap-3">
      {socials.map((s, i) => {
        const name = typeof s.icon === 'string' && hasIcon(s.icon) ? s.icon : null;
        if (name == null) return null;
        return (
          <a
            key={i}
            // The social glyphs belong to the muted role: read --fr-footer-muted
            // (token fallback inside the var → unset computes the exact prior
            // muted-foreground) so a set `mutedColor` adapts them WITH the
            // tagline/headings/link rows beside them.
            className="inline-flex h-8 w-8 items-center justify-center rounded-full [color:var(--fr-footer-muted,var(--color-muted-foreground))] outline-none transition-colors hover:[color:var(--fr-footer-accent)] focus-visible:ring-2 focus-visible:ring-primary/50"
            href={safeUrl(s.href)}
            {...linkTargetRel(true)}
            aria-label={name}
          >
            <Icon name={name} size={18} />
          </a>
        );
      })}
    </div>
  );
}

export function Footer({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    brand?: string | null;
    tagline?: string | null;
    columns?: Array<{ heading?: string; links?: Array<{ label?: string; href?: string }> }> | null;
    socials?: Array<{ icon?: string; href?: string }> | null;
    bottomText?: string | null;
    variant?: string | null;
    accent?: string | null;
    bg?: string | null;
    color?: string | null;
    mutedColor?: string | null;
    borderColor?: string | null;
    weight?: string | null;
  };
  const variant = (p.variant as 'columns' | 'simple' | null) ?? 'columns';
  const columns = Array.isArray(p.columns)
    ? p.columns.filter((c): c is { heading?: string; links?: Array<{ label?: string; href?: string }> } => c != null && typeof c === 'object')
    : [];
  const socials = Array.isArray(p.socials)
    ? p.socials.filter((s): s is { icon?: string; href?: string } => s != null && typeof s === 'object')
    : [];
  const style = styleVars(
    { var: '--fr-footer-accent', value: p.accent, kind: 'color' },
    { var: '--fr-footer-bg', value: p.bg, kind: 'color' },
    { var: '--fr-footer-fg', value: p.color, kind: 'color' },
    { var: '--fr-footer-muted', value: p.mutedColor, kind: 'color' },
    // the fine-print divider line above bottomText (columns variant).
    { var: '--fr-footer-border', value: p.borderColor, kind: 'color' },
  );
  // Optional brand surface: a `bg` fill (transparent default) with a settable
  // brand-name colour. Conditional override classes so the unset footer keeps
  // its transparent surface + foreground brand name (token defaults).
  const surfaceClass = cn(
    p.bg != null && '[background:var(--fr-footer-bg,transparent)] rounded-2xl p-8',
  );
  // INHERITED FOREGROUND on the brand name. With NO `bg` the footer paints no
  // surface at all — it shows whatever an ancestor authored — so `text-foreground`
  // was a reset to the global token and rendered rgb(24,24,27) on an authored dark
  // `Card {bg:"#12161f", color:"#e2e6f0"}` (the 1.00-1.02 class). currentColor on
  // `color` computes to the inherited value, byte-identical at the top level.
  // With a `bg` SET the footer DOES paint its own surface, so the token stays:
  // its brand name belongs to that fill, not to the page behind it.
  const brandColor = p.color != null
    ? 'text-[color:var(--fr-footer-fg,var(--color-foreground))]'
    : p.bg != null
      ? 'text-foreground'
      : 'text-[color:currentColor]';

  const brandBlock = (p.brand != null || p.tagline != null) && (
    <div className="flex flex-col gap-1.5">
      {/* Weight channel (6i) added LAST so a SET weight dedupe-wins the baked
          font-semibold; unset → undefined, cn drops it → byte-identical. Brand
          name only — not the tagline. */}
      {p.brand != null && <span className={cn('text-base font-semibold', brandColor, weightClass(p.weight))}>{p.brand}</span>}
      {p.tagline != null && <span className="max-w-xs text-sm [color:var(--fr-footer-muted,var(--color-muted-foreground))]">{p.tagline}</span>}
    </div>
  );

  if (variant === 'simple') {
    return (
      <footer className={cn(footerWrap({ variant }), surfaceClass)} style={style}>
        {brandBlock}
        <FooterSocials socials={socials} />
        {p.bottomText != null && <span className="text-[0.8125rem] [color:var(--fr-footer-muted,var(--color-muted-foreground))]">{p.bottomText}</span>}
      </footer>
    );
  }

  return (
    <footer className={cn(footerWrap({ variant }), surfaceClass)} style={style}>
      <div className="flex flex-col justify-between gap-8 md:flex-row">
        <div className="flex flex-col gap-4">
          {brandBlock}
          <FooterSocials socials={socials} />
        </div>
        {columns.length > 0 && (
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:flex md:gap-12">
            {columns.map((col, ci) => {
              const links = Array.isArray(col.links)
                ? col.links.filter((l): l is { label?: string; href?: string } => l != null && typeof l === 'object')
                : [];
              return (
                <div key={ci} className="flex min-w-0 flex-col gap-2.5">
                  {col.heading != null && (
                    <span className="text-[0.8125rem] font-semibold uppercase tracking-wide [color:var(--fr-footer-muted,var(--color-muted-foreground))]">
                      {col.heading}
                    </span>
                  )}
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {links.map((l, li) => (
                      <li key={li}>
                        <a
                          className="text-sm [color:var(--fr-footer-muted,var(--color-muted-foreground))] no-underline outline-none transition-colors hover:[color:var(--fr-footer-accent)] focus-visible:ring-2 focus-visible:ring-primary/50"
                          href={safeUrl(l.href)}
                        >
                          {l.label ?? ''}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {p.bottomText != null && (
        // The fine-print divider reads the NEW borderColor channel through the
        // border-color group form (token fallback inside the var → unset computes
        // the exact prior border token) so a custom dark `bg` can carry a
        // matching rule instead of the theme line.
        <div className="border-t border-[color:var(--fr-footer-border,var(--color-border))] pt-6 text-[0.8125rem] [color:var(--fr-footer-muted,var(--color-muted-foreground))]">{p.bottomText}</div>
      )}
    </footer>
  );
}

/* ── plan CTA (shared by PricingTable + PlanCard) ─────────────────────────── */

/* A plan CTA: an <a> when ctaHref is set, else a button that emits `commit`.
   NEVER a payment field. `highlighted` fills it with the accent var (paired with
   a readable foreground); otherwise a bordered/neutral button whose fg/border/
   hover come from `neutralClasses` — LITERAL class strings built at each call
   site (the Tailwind scanner needs full literals) reading the owning card's
   on-surface fg + border var chains, so the neutral CTA follows the card's
   bg/color/borderColor channels instead of hardcoded theme tokens. */
function PlanCta({
  label,
  href,
  highlighted,
  accentVar,
  accentTextVar,
  neutralClasses,
  onChoose,
}: {
  label: string;
  href?: string | null;
  highlighted: boolean;
  accentVar: string;
  accentTextVar?: string;
  neutralClasses: string;
  onChoose: () => void;
}): ReactNode {
  const base =
    'mt-1 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-frayme px-4 py-2.5 text-sm font-medium no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50';
  // On-fill label uses the text-color group form so tw-merge dedupes-and-wins
  // over any inherited `text-*`; the var falls back to `card` (quiet defaults),
  // pairing the neutral high-contrast fill below.
  const onFillText = `text-[color:var(${accentTextVar ?? '--fr-unset'},var(--color-card))]`;
  // quiet defaults: the highlighted (recommended) plan's CTA is neutral
  // high-contrast by default, not a brand slab; a supplied `accent` still fills brand.
  const look = highlighted
    ? cn(base, `[background:var(${accentVar},var(--color-foreground))]`, onFillText)
    : cn(base, 'border bg-transparent', neutralClasses);
  if (href != null) {
    return (
      <a className={look} href={safeUrl(href)}>
        {label}
      </a>
    );
  }
  return (
    <button type="button" className={look} onClick={onChoose}>
      {label}
    </button>
  );
}

/** A check-marked feature list (plain-text items). */
function FeatureList({ features, accentVar }: { features: string[]; accentVar: string }): ReactNode {
  if (features.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {features.map((f, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className={`mt-0.5 shrink-0 [color:var(${accentVar},var(--color-primary))]`} aria-hidden>
            <Icon name="check" size={16} />
          </span>
          <span className="min-w-0">{f}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── PricingTable ─────────────────────────────────────────────────────────── */

// fr-pricing-fixed lets frayme.css collapse the tier columns on a narrow host:
// the column count is authored, so without a breakpoint three tiers stay three
// tiers at 360px and every feature line wraps to one character.
const pricingGrid = cva('fr-pricing-fixed grid w-full gap-5 [grid-template-columns:repeat(var(--fr-pricing-cols,1),minmax(0,1fr))]');

export function PricingTable({ element, emit }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    plans?: Array<{
      name?: string;
      price?: string;
      period?: string | null;
      description?: string | null;
      features?: string[] | null;
      badge?: string | null;
      highlighted?: boolean | null;
      ctaLabel?: string | null;
      ctaHref?: string | null;
    }> | null;
    period?: string | null;
    periodLabel?: string | null;
    columns?: number | null;
    accent?: string | null;
    bg?: string | null;
    color?: string | null;
    borderColor?: string | null;
    shadow?: string | null;
    mutedColor?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
    showCta?: boolean | null;
  };
  const plans = Array.isArray(p.plans)
    ? p.plans.filter((pl): pl is NonNullable<typeof pl> => pl != null && typeof pl === 'object')
    : [];
  // A per-plan CTA button renders by default. Set showCta:false for a STATIC
  // read-only comparison (no interactive/dead 'Choose plan' buttons).
  const showCta = p.showCta !== false;
  const period = (p.period as 'monthly' | 'yearly' | null) ?? null;
  // Billed-period caption: a free-form `periodLabel` renders verbatim
  // (localisation); else the `period` enum keeps the prior "Billed {period}"
  // English default, byte-identical. Null when neither is set (no caption).
  const billedCaption =
    typeof p.periodLabel === 'string' && p.periodLabel.length > 0
      ? p.periodLabel
      : period != null
        ? `Billed ${period}`
        : null;
  // Column count: the explicit count (clamped 1–12) else the plan count.
  const rawCols =
    typeof p.columns === 'number' && Number.isFinite(p.columns) ? Math.trunc(p.columns) : plans.length || 1;
  const cols = Math.min(Math.max(rawCols, 1), 12);
  const emitWith = useIntrinsicEmit(emit, element);

  return (
    <div
      className={cn(
        'flex flex-col gap-5',
        // Closed Font enum → a static font-* utility on the ROOT so every plan
        // card inherits it. Unset/unknown → undefined → dropped (theme font).
        fontClass(p.font),
      )}
      style={styleVars(
        { var: '--fr-pricing-accent', value: p.accent, kind: 'color' },
        { var: '--fr-pricing-muted', value: p.mutedColor, kind: 'color' },
        // Exact plan-name font size — inherits down to every plan-name node,
        // whose base reads var(--fr-pricing-fs,0.875rem); unset → omitted.
        { var: '--fr-pricing-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
        // Container-level card channels — set on the wrapper ROOT so the CSS
        // custom properties INHERIT down to every inline plan card (v1 cascade:
        // uniform across all plans, no per-plan style objects). Each card reads
        // them through a var-chain whose token fallback = the prior hardcoded
        // value, so an unset prop is byte-identical. `bg` pairs with `color`
        // (on-surface fg) for legibility; shadow is prop-threaded per card (an
        // enum via shadowClass), NOT inherited.
        { var: '--fr-pricing-card-bg', value: p.bg, kind: 'color' },
        { var: '--fr-pricing-card-fg', value: p.color, kind: 'color' },
        { var: '--fr-pricing-card-border', value: p.borderColor, kind: 'color' },
      )}
    >
      {billedCaption != null && (
        <span className="text-center text-[0.8125rem] font-medium uppercase tracking-wide [color:var(--fr-pricing-muted,var(--color-muted-foreground))]">
          {billedCaption}
        </span>
      )}
      <div className={cn(pricingGrid())} style={{ '--fr-pricing-cols': String(cols) } as CSSProperties}>
        {plans.map((plan, i) => {
          const highlighted = plan.highlighted === true;
          const features = Array.isArray(plan.features) ? plan.features.filter((f) => typeof f === 'string') : [];
          const badge = typeof plan.badge === 'string' && plan.badge.length > 0 ? plan.badge : null;
          return (
            <div
              key={i}
              className={cn(
                // Card surface via a var-chain (token fallback = the prior
                // `bg-card`) so a container `bg` cascades in; replaces the
                // hardcoded `bg-card`. Width stays a plain `border`.
                'flex flex-col gap-4 rounded-frayme border [background:var(--fr-pricing-card-bg,var(--color-card))] p-6',
                // A per-plan badge needs a positioning context for its ribbon;
                // gated on the badge so an unset plan stays byte-identical.
                badge != null && 'relative',
                highlighted
                  ? // The highlighted plan keeps its accent ring — DO NOT recolor
                    // its (transparent) border with the card-border var.
                    'border-transparent ring-2 [--tw-ring-color:var(--fr-pricing-accent,var(--color-primary))]'
                  : // Border-colour via a var-chain (token fallback = the prior
                    // `border-border`) so a container `borderColor` cascades in;
                    // replaces the hardcoded `border-border`.
                    '[border-color:var(--fr-pricing-card-border,var(--color-border))]',
                // bg+color COHERENCE (PlanCard onSurf parity): a table-level `color`
                // paints the card ROOT so ALL on-card copy — feature-list items
                // included, not just the name/price spans — reads the pair.
                // Conditional, so the unset default stays byte-identical.
                p.color != null && '[color:var(--fr-pricing-card-fg,var(--color-foreground))]',
                // Elevation channel added LAST so a SET shadow dedupe-wins its
                // box-shadow tw-merge group. Cards bake NO shadow (default none),
                // so unset → undefined, cn drops it → byte-identical.
                shadowClass(p.shadow),
              )}
            >
              {/* Per-plan ribbon badge — mirrors PlanCard's ribbon, tinted
                  by the table accent (on-primary text fallback). Escaped text. */}
              {badge != null && (
                <span className="absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold [background:var(--fr-pricing-accent,var(--color-foreground))] text-[color:var(--color-card)]">
                  {badge}
                </span>
              )}
              <div className="flex min-w-0 flex-col gap-1">
                {/* Plan name → the on-surface text-color group form is the SOLE color
                    source (no co-located text-foreground — tw-merge would not dedupe
                    the arbitrary colour against it, leaving source order to win →
                    the override would be inert). The var's token fallback keeps unset
                    byte-identical. fontSize folds the prior text-sm into the var
                    fallback (0.875rem) — text-sm also bundled a 1.25rem line-height,
                    so an explicit leading-[1.25rem] preserves it; tracking/leading
                    enums added LAST dedupe-win their groups, unset → dropped. */}
                <span
                  className={cn(
                    // Plan names wrap ("Business + Priority Support"): the pricing columns
                    // are a stack whose children carry min-width:0, so an ellipsis here
                    // deleted the name at exactly the width where columns get narrow.
                    'break-words [font-size:var(--fr-pricing-fs,0.875rem)] leading-[calc(1.25/0.875)] font-semibold text-[color:var(--fr-pricing-card-fg,var(--color-foreground))]',
                    trackingClass(p.tracking),
                    leadingClass(p.leading),
                  )}
                  title={plan.name || undefined}
                >
                  {plan.name ?? ''}
                </span>
                {/* DECLARED two-line budget for the blurb (kept) + break-words so a long
                    unbroken token cannot widen the column. */}
                {plan.description != null && (
                  <span className="line-clamp-2 break-words text-[0.8125rem] [color:var(--fr-pricing-muted,var(--color-muted-foreground))]" title={plan.description || undefined}>{plan.description}</span>
                )}
              </div>
              {/* flex-wrap is load-bearing for the un-truncated price: when the column
                  gets narrow the shrink-0 period drops to its own line FIRST, so the
                  amount keeps the full width instead of breaking mid-number. */}
              <div className="flex min-w-0 flex-wrap items-baseline gap-1">
                {/* Weight channel (6i) added LAST so a SET weight dedupe-wins
                    the baked font-semibold; unset → undefined, cn drops it →
                    byte-identical. The price value only — not the period suffix.
                    A single table-level `weight` applies to every plan price.
                    The amount is a LEAF and keeps its automatic minimum — at
                    2rem a min-w-0 let a narrow column break "£1,299" down the
                    page, one glyph per line; the wrapping row above is what
                    gives instead. */}
                <span className={cn('break-words text-[2rem] font-semibold leading-none text-foreground text-[color:var(--fr-pricing-card-fg,var(--color-foreground))]', weightClass(p.weight))} title={plan.price || undefined}>{plan.price ?? ''}</span>
                {plan.period != null && <span className="shrink-0 text-sm [color:var(--fr-pricing-muted,var(--color-muted-foreground))]">{plan.period}</span>}
              </div>
              <FeatureList features={features} accentVar="--fr-pricing-accent" />
              {showCta && (
              <PlanCta
                label={plan.ctaLabel ?? 'Choose plan'}
                href={plan.ctaHref}
                highlighted={highlighted}
                accentVar="--fr-pricing-accent"
                // Neutral-CTA coherence: label + border read the card's fg/border
                // var chains (token fallbacks inside the var → unset stays the
                // theme look); the hover is MUTUALLY-EXCLUSIVE on `bg` so a brand
                // fill never flashes the theme-muted swatch (fg-derived 10% tint),
                // while the unset path keeps the prior hover token, now via --fr-surface-sunken (byte-identical unpublished).
                neutralClasses={cn(
                  'text-[color:var(--fr-pricing-card-fg,var(--color-foreground))]',
                  'border-[color:var(--fr-pricing-card-border,var(--color-border))]',
                  p.bg != null
                    ? 'hover:[background:color-mix(in_srgb,var(--fr-pricing-card-fg,var(--color-foreground))_10%,transparent)]'
                    : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
                )}
                onChoose={() => emitWith('commit', { plan: plan.name ?? null, index: i, price: plan.price ?? null })}
              />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── PlanCard ─────────────────────────────────────────────────────────────── */

export function PlanCard({ element, emit }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    name: string;
    price: string;
    period?: string | null;
    description?: string | null;
    features?: string[] | null;
    badge?: string | null;
    highlighted?: boolean | null;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    accent?: string | null;
    accentText?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    color?: string | null;
    mutedColor?: string | null;
    borderWidthValue?: string | number | null;
    shadow?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const highlighted = p.highlighted === true;
  const features = Array.isArray(p.features) ? p.features.filter((f) => typeof f === 'string') : [];
  const emitWith = useIntrinsicEmit(emit, element);
  // A model `bg` repaints the card → the copy must read on it. When set, text
  // inherits the on-surface fg var (light default); muted items use opacity.
  const onSurf = p.bg != null;
  return (
    <div
      className={cn(
        'relative flex flex-col gap-4 rounded-frayme p-6',
        // value (bg) > token default; conditional override class so the token
        // surface wins when absent and the var wins when supplied (added last).
        // The in-var card-token fallback keeps an INVALID bg (var omitted by
        // styleVars) on the card surface instead of nuking it to transparent.
        p.bg != null ? '[background:var(--fr-plancard-bg,var(--color-card))]' : 'bg-card',
        onSurf && '[color:var(--fr-plancard-fg,var(--color-primary-foreground))]',
        highlighted
          ? // highlighted swaps the visible border for an accent ring; keep a
            // bare 1px transparent border (width is moot here — borderWidthValue
            // does NOT apply to a highlighted card).
            'border border-transparent ring-2 [--tw-ring-color:var(--fr-plancard-accent,var(--color-primary))]'
          : // Non-highlighted draws the card border. Width via a var-chain
            // (default 1px) so a model `borderWidthValue` wins without tw-merge
            // keeping a co-located `border` width utility; `border-solid` keeps
            // it rendering; border-colour via the UNCONDITIONAL var-chain (token
            // fallback = the prior `border-border`, so unset stays byte-identical)
            // — the SOLE border-color source, mirroring PricingTable.
            'border-solid [border-width:var(--fr-plancard-bw,1px)] [border-color:var(--fr-plancard-border,var(--color-border))]',
        // Elevation channel (6j) added LAST so a SET shadow dedupe-wins its
        // box-shadow tw-merge group. The card root bakes NO shadow (default
        // none) and the highlighted branch uses a ring, not a shadow — so unset
        // → undefined, cn drops it → byte-identical, and a set value still wins
        // while the highlighted ring/border styling above is preserved.
        shadowClass(p.shadow),
        // Closed Font enum → a static font-* utility on the ROOT so the whole
        // card inherits it. Unset/unknown → undefined → dropped (theme font).
        fontClass(p.font),
      )}
      style={styleVars(
        { var: '--fr-plancard-accent', value: p.accent, kind: 'color' },
        { var: '--fr-plancard-accent-text', value: p.accentText, kind: 'color' },
        { var: '--fr-plancard-bg', value: p.bg, kind: 'color' },
        { var: '--fr-plancard-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-plancard-fg', value: p.color, kind: 'color' },
        { var: '--fr-plancard-muted', value: p.mutedColor, kind: 'color' },
        // Border thickness — only the non-highlighted branch reads this var (it
        // applies `[border-width:var(--fr-plancard-bw,1px)]`); the highlighted
        // card uses a bare transparent border, so the value is moot there.
        { var: '--fr-plancard-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
        // Exact plan-name font size — the name node's base reads
        // var(--fr-plancard-fs,0.875rem); unset → omitted.
        { var: '--fr-plancard-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {p.badge != null && (
        <span className="absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold [background:var(--fr-plancard-accent,var(--color-foreground))] text-[color:var(--fr-plancard-accent-text,var(--color-card))]">
          {p.badge}
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        {/* Plan name — fontSize folds the prior text-sm into the var fallback
            (0.875rem); text-sm also bundled a 1.25rem line-height, so an explicit
            leading-[1.25rem] preserves it. tracking/leading enums added LAST
            dedupe-win their groups; unset → undefined → byte-identical. */}
        <span
          className={cn(
            // Plan name wraps — same reasoning as PricingTable: the card body is a
            // min-width:0 column, so nowrap+ellipsis deleted the name rather than
            // costing height the card does not ration.
            'break-words [font-size:var(--fr-plancard-fs,0.875rem)] leading-[calc(1.25/0.875)] font-semibold',
            !onSurf && 'text-foreground',
            trackingClass(p.tracking),
            leadingClass(p.leading),
          )}
          title={p.name || undefined}
        >
          {p.name}
        </span>
        {/* DECLARED two-line budget (kept) + break-words so a long token stays inside. */}
        {p.description != null && <span className={cn('line-clamp-2 break-words text-[0.8125rem]', onSurf ? 'opacity-80' : '[color:var(--fr-plancard-muted,var(--color-muted-foreground))]')} title={p.description || undefined}>{p.description}</span>}
      </div>
      {/* flex-wrap so the shrink-0 period drops to its own line before the
          un-truncated amount is forced to break mid-number. */}
      <div className="flex min-w-0 flex-wrap items-baseline gap-1">
        {/* Weight channel (6i) added LAST so a SET weight dedupe-wins the baked
            font-semibold; unset → undefined, cn drops it → byte-identical. The
            price value only — not the period suffix. No min-w-0: the amount is
            a LEAF, so its longest run of glyphs is its own floor — the
            flex-wrap row above gives before the number does. */}
        <span className={cn('break-words text-[2.25rem] font-semibold leading-none', !onSurf && 'text-foreground', weightClass(p.weight))} title={p.price || undefined}>{p.price}</span>
        {p.period != null && <span className={cn('shrink-0 text-sm', onSurf ? 'opacity-80' : '[color:var(--fr-plancard-muted,var(--color-muted-foreground))]')}>{p.period}</span>}
      </div>
      <FeatureList features={features} accentVar="--fr-plancard-accent" />
      <PlanCta
        label={p.ctaLabel ?? 'Choose plan'}
        href={p.ctaHref}
        highlighted={highlighted}
        accentVar="--fr-plancard-accent"
        accentTextVar="--fr-plancard-accent-text"
        // Neutral-CTA coherence: label + border read the card's fg/border var
        // chains (token fallbacks inside the var → unset stays the theme look);
        // hover is MUTUALLY-EXCLUSIVE on the brand surface (onSurf) so it never
        // flashes theme-muted over a custom `bg` (fg-derived 10% tint instead),
        // while the unset path keeps the prior hover token, now via --fr-surface-sunken (byte-identical unpublished).
        neutralClasses={cn(
          // fg fallback MIRRORS the card root's onSurf chain: on a brand `bg` the
          // label defaults to the same light on-fill token as the rest of the copy;
          // on the token card it keeps the exact foreground default.
          onSurf
            ? 'text-[color:var(--fr-plancard-fg,var(--color-primary-foreground))]'
            : 'text-[color:var(--fr-plancard-fg,var(--color-foreground))]',
          'border-[color:var(--fr-plancard-border,var(--color-border))]',
          onSurf
            ? 'hover:[background:color-mix(in_srgb,var(--fr-plancard-fg,var(--color-primary-foreground))_10%,transparent)]'
            : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
        )}
        onChoose={() => emitWith('commit', { name: p.name ?? null, price: p.price ?? null, label: p.ctaLabel ?? p.name ?? null })}
      />
    </div>
  );
}
