'use client';
import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../cn.js';
import { borderStyleClass, fontClass, leadingClass, styleVars, surfaceField, surfaceInk, surfaceMuted, surfaceRaised, surfaceSunken, trackingClass, weightClass } from './_style.js';
import type { ComponentRenderProps } from '../upstream.js';

/* Catalog group: Box, Container, Section — the low-level layout primitives.
 *
 * VALUE channels (colors / dimensions the model names directly) NEVER become
 * classes — they land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read
 * by a STATIC arbitrary utility in the recipe (`var(--fr-box-bg,var(--color-…))`).
 * An unset/invalid value is omitted by `styleVars`, so the token default wins and
 * a props-less spec still renders polished. The arbitrary classes below are
 * literal strings so Tailwind's CSS build compiles them. A value NEVER becomes a
 * class; an enum NEVER becomes a style.
 *
 * `bg` is the one value channel that competes with no enum here, but it still
 * follows the project convention: a CONDITIONAL override class is added ONLY when
 * the model named a `bg`, with a token fallback inside the var() for
 * defence-in-depth on an untrusted path (an invalid bg leaves the var unset →
 * styleVars omits it → the token keeps a fill rather than rendering transparent). */

const box = cva(
  // `bg` is applied as a CONDITIONAL arbitrary class in the render (below), not
  // here, so a Box with no `bg` stays transparent (no token default fill). The
  // border color token-fallback IS baked here because the `bordered` variant owns
  // whether a border draws at all.
  // The `padding` ENUM sets a DEFAULT var (no `p-*` utility) and the base reads it
  // through the exact-override var `--fr-box-pad` — so the enum default and the
  // exact `paddingValue` resolve in ONE `padding` declaration (no tw-merge dedupe
  // hazard between `p-*` and an arbitrary padding utility). Enum defaults reproduce
  // the prior p-* rem values exactly (p-1.5=0.375 · p-3=0.75 · p-5=1.25 · p-8=2 · p-12=3).
  // The `radius` ENUM sets a DEFAULT var (no `rounded-*` utility) and the base
  // reads it through the exact-override var `--fr-box-radius` — so the enum default
  // and the exact `radiusValue` resolve in ONE `border-radius` declaration (no
  // tw-merge dedupe hazard between `rounded-*` and an arbitrary radius utility).
  // Enum defaults reproduce the prior rounded-* exactly (none=0 · sm=0.25rem ·
  // md=var(--radius-frayme) · lg [was rounded-2xl]=1rem · full [was rounded-3xl,
  // NOT a pill]=1.5rem).
  // The `borderWidthValue` exact override drives `--fr-box-bw` (default 1px); the
  // `bordered:true` variant draws via [border-width:var(--fr-box-bw,1px)] +
  // border-solid (no bare `border` utility, so the arbitrary width utility is not
  // shadowed). `borderStyle` is applied as a conditional border-style class in the
  // render so it dedupes against and wins over border-solid.
  // Children stack vertically with a small gap (matching Card's content column):
  // a plain <div> crammed multi-child Boxes together with ZERO spacing (icon +
  // label + field rendered as one run-on line). Single-child
  // renders are unchanged; horizontal rows are Stack's job. The align variant
  // pairs items-* with text-* so inline-flex children (Button, Badge) keep
  // hugging their content instead of stretching full-width.
  'flex flex-col gap-2 self-stretch [width:var(--fr-box-w,auto)] max-w-full [min-height:var(--fr-box-mh,auto)] [border-color:var(--fr-box-border,var(--color-border))] [padding:var(--fr-box-pad,var(--fr-box-pad-default,1.25rem))] [border-radius:var(--fr-box-radius,var(--fr-box-radius-default,var(--radius-frayme)))]',
  {
    variants: {
      padding: {
        none: '[--fr-box-pad-default:0px]',
        xs: '[--fr-box-pad-default:0.375rem]',
        sm: '[--fr-box-pad-default:0.75rem]',
        md: '[--fr-box-pad-default:1.25rem]',
        lg: '[--fr-box-pad-default:2rem]',
        xl: '[--fr-box-pad-default:3rem]',
      },
      radius: {
        none: '[--fr-box-radius-default:0px]',
        sm: '[--fr-box-radius-default:0.25rem]',
        md: '[--fr-box-radius-default:var(--radius-frayme)]',
        lg: '[--fr-box-radius-default:1rem]',
        full: '[--fr-box-radius-default:1.5rem]',
      },
      bordered: {
        true: 'border-solid [border-width:var(--fr-box-bw,1px)]',
        false: 'border-0',
      },
      shadow: {
        none: 'shadow-none',
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg',
        xl: 'shadow-xl',
      },
      align: {
        start: 'text-left items-start',
        center: 'text-center items-center',
        end: 'text-right items-end',
      },
    },
    defaultVariants: {
      padding: 'md',
      radius: 'md',
      bordered: false,
      shadow: 'none',
      align: 'start',
    },
  },
);

// The `padding` ENUM drives ONLY the X gutter via a DEFAULT var (no `px-*`
// utility); the base reads it through the exact-override var `--fr-cont-padx` as
// separate padding-left/right declarations, so the enum default and the exact
// `paddingValue` resolve without a tw-merge dedupe hazard. Enum defaults reproduce
// the prior px-* rem values exactly (px-4=1 · px-6=1.5 · px-10=2.5).
const container = cva('[width:var(--fr-cont-w,100%)] max-w-full [padding-left:var(--fr-cont-padx,var(--fr-cont-padx-default,1.5rem))] [padding-right:var(--fr-cont-padx,var(--fr-cont-padx-default,1.5rem))]', {
  variants: {
    maxWidth: {
      sm: 'max-w-[36rem]',
      md: 'max-w-[48rem]',
      lg: 'max-w-[64rem]',
      xl: 'max-w-[80rem]',
      full: 'max-w-none',
    },
    padding: {
      none: '[--fr-cont-padx-default:0px]',
      sm: '[--fr-cont-padx-default:1rem]',
      md: '[--fr-cont-padx-default:1.5rem]',
      lg: '[--fr-cont-padx-default:2.5rem]',
    },
    centered: {
      true: 'mx-auto',
      false: '',
    },
    align: {
      start: 'text-left',
      center: 'text-center',
      end: 'text-right',
    },
  },
  defaultVariants: {
    maxWidth: 'lg',
    padding: 'md',
    centered: true,
    align: 'start',
  },
});

// The `spacing` ENUM drives the vertical band padding via a DEFAULT var (no
// `py-*` utility); the base reads it through the exact-override var
// `--fr-section-pady` as separate padding-top/bottom declarations, so the enum
// default and the exact `paddingValue` resolve without a tw-merge dedupe hazard.
// Enum defaults reproduce the prior py-* rem values exactly (py-6=1.5 · py-10=2.5
// · py-16=4 · py-24=6).
const section = cva('w-full [padding-top:var(--fr-section-pady,var(--fr-section-pady-default,2.5rem))] [padding-bottom:var(--fr-section-pady,var(--fr-section-pady-default,2.5rem))]', {
  variants: {
    spacing: {
      none: '[--fr-section-pady-default:0px]',
      sm: '[--fr-section-pady-default:1.5rem]',
      md: '[--fr-section-pady-default:2.5rem]',
      lg: '[--fr-section-pady-default:4rem]',
      xl: '[--fr-section-pady-default:6rem]',
    },
    align: {
      start: 'text-left',
      center: 'text-center',
      end: 'text-right',
    },
  },
  defaultVariants: { spacing: 'md', align: 'start' },
});

// The Section's inner content column — a centered max-width wrapper mirroring
// Container's widths but on the Section's `width` enum vocabulary.
const sectionInner = cva('mx-auto w-full', {
  variants: {
    width: {
      narrow: 'max-w-[40rem]',
      default: 'max-w-[64rem]',
      wide: 'max-w-[80rem]',
      full: 'max-w-none',
    },
  },
  defaultVariants: { width: 'default' },
});

const sectionEyebrow = cva('m-0 mb-2 text-xs font-semibold uppercase tracking-wide [color:var(--fr-section-muted,var(--color-muted-foreground))]');
// The title font-size is the exact-override var `--fr-section-fs` with the prior
// baked 1.5rem as its fallback (byte-identical when unset; the exact `fontSize`
// value wins when set). It REPLACES the prior `text-[1.5rem]` rather than
// co-locating with it — an arbitrary [font-size:] does not reliably dedupe a
// `text-[..]` utility, so there is one font-size source. `leading-tight` keeps the
// line-height the arbitrary text-[1.5rem] never carried.
//
// `text-current`, not `text-[color:var(--fr-surface-fg,var(--color-foreground))]`: a Section paints a fill only when the
// model names `bg`, so this title INHERITS its surface, and a hard reset to the
// global token is the inherited-foreground defect: a spec authoring
// `Card { bg:"#12161f", color:"#e2e6f0" }` had that ink inherit correctly two
// levels down and then snap back to rgb(24,24,27) — contrast 1.02 on dark navy,
// with the spec doing nothing wrong. The two are the SAME value at the top level
// (frayme.css sets
// `.frayme-root { color: var(--frayme-fg) }` AND `--color-foreground:
// var(--frayme-fg)`), so a props-less render is unchanged; only the
// authored-container case moves. On the `color` property `currentColor` computes
// to the INHERITED colour, so this is not a cycle.
// It also makes the title agree with its own band: the eyebrow and every child of
// the content column already inherit — the h2 was the lone element that did not.
const sectionTitle = cva('m-0 mb-4 [font-size:var(--fr-section-fs,1.5rem)] font-semibold leading-tight text-current');

export function Box({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    padding?: string | null;
    paddingValue?: string | number | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    bordered?: boolean | null;
    borderStyle?: string | null;
    borderWidthValue?: string | number | null;
    shadow?: string | null;
    align?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    color?: string | null;
    width?: string | number | null;
    minHeight?: string | number | null;
    font?: string | null;
  };
  return (
    <div
      className={cn(
        box({
          padding: (p.padding as 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | null) ?? undefined,
          radius: (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
          bordered: (p.bordered as boolean | null) ?? undefined,
          shadow: (p.shadow as 'none' | 'sm' | 'md' | 'lg' | 'xl' | null) ?? undefined,
          align: (p.align as 'start' | 'center' | 'end' | null) ?? undefined,
        }),
        // Precedence: explicit value (props.bg) > transparent default. Emitted only
        // when the model named a bg, so an un-tinted Box stays transparent. The
        // `var(--color-card)` fallback is defence-in-depth: on an untrusted path an
        // INVALID non-null bg leaves --fr-box-bg unset (styleVars omits it), so the
        // token keeps a fill rather than rendering nothing.
        p.bg != null && '[background:var(--fr-box-bg,var(--color-card))]',
        // On-surface text channel — CONDITIONAL text-color group form on the box
        // root so every child inherits it (pairs with a custom bg). Unset →
        // class absent → byte-identical (children keep the theme foreground).
        //
        // The var's FALLBACK is `currentColor`, not the global token. This class
        // is emitted only when the model NAMED a colour, so the fallback is the
        // INVALID-value path (styleVars omits an unparseable colour) — and
        // resetting to --color-foreground there painted near-black ink on an
        // authored dark surface, the inherited-foreground defect (contrast
        // 1.02 on dark navy). Inheriting reduces an
        // invalid `color` to exactly what OMITTING `color` already does. The two
        // are the same value at the top level: frayme.css points both
        // `.frayme-root { color }` and --color-foreground at --frayme-fg. A Box
        // that names `bg` AND an invalid `color` is no worse than before — the
        // token was just as blind to that fill as the inherited ink is.
        // Applies when EITHER is authored. A container that paints a bg but names
        // no colour used to leave the LIGHT theme's ink on it (~1.05:1 contrast),
        // and 25 components downstream (Select, Input, Textarea, Popover…) expose
        // no `color` prop to fix it with, so no spec could. --fr-surface-fg is the
        // derived pairing, published beside --fr-surface. An authored colour still
        // wins: it sits earlier in the chain.
        (p.color != null || p.bg != null) && 'text-[color:var(--fr-box-fg,var(--fr-surface-fg,currentColor))]',
        // borderStyle — closed enum → static border-style utility (solid/dashed/
        // dotted). Same border-style group as the recipe's border-solid, so cn()
        // dedupes and this LAST class wins. Unset → undefined → cn drops it → keeps
        // the recipe's border-solid default (byte-identical).
        borderStyleClass(p.borderStyle),
        // Typeface cascade — closed Font enum → static font-* utility (LAST, so a
        // set value is the winning font-family class). Unset → undefined → cn drops
        // it → no font class → inherits the theme font (byte-identical default).
        fontClass(p.font),
      )}
      style={styleVars(
        { var: '--fr-box-bg', value: p.bg, kind: 'color' },
        // --fr-surface alone is not enough: 61 components accept `bg` and NONE
        // derives ink from it, and 25 of them expose no `color` prop at all. The
        // paired ink is published here so the whole subtree inherits it — see
        // surfaceStyle in _style.ts.
        { var: '--fr-surface', value: p.bg, kind: 'color' },
        { var: '--fr-surface-fg', value: surfaceInk(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-surface-muted', value: surfaceMuted(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-surface-field', value: surfaceField(p.bg) as string, kind: 'raw' },
        { var: '--fr-surface-sunken', value: surfaceSunken(p.bg) as string, kind: 'raw' },
        { var: '--fr-surface-raised', value: surfaceRaised(p.bg) as string, kind: 'raw' },
        { var: '--fr-box-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-box-fg', value: p.color, kind: 'color' },
        { var: '--fr-box-pad', value: p.paddingValue, kind: 'dim', opts: { units: ['px', 'rem'], max: 96 } },
        { var: '--fr-box-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        { var: '--fr-box-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
        { var: '--fr-box-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 1600 } },
        { var: '--fr-box-mh', value: p.minHeight, kind: 'dim', opts: { units: ['px', 'rem', 'vh'], max: 2000 } },
      )}
    >
      {children}
    </div>
  );
}

export function Container({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    maxWidth?: string | null;
    padding?: string | null;
    paddingValue?: string | number | null;
    centered?: boolean | null;
    align?: string | null;
    bg?: string | null;
    color?: string | null;
    width?: string | number | null;
    font?: string | null;
  };
  return (
    <div
      className={cn(
        container({
          maxWidth: (p.maxWidth as 'sm' | 'md' | 'lg' | 'xl' | 'full' | null) ?? undefined,
          padding: (p.padding as 'none' | 'sm' | 'md' | 'lg' | null) ?? undefined,
          centered: (p.centered as boolean | null) ?? undefined,
          align: (p.align as 'start' | 'center' | 'end' | null) ?? undefined,
        }),
        // bg value channel — conditional override (no enum competes), mirroring
        // Box's --fr-box-bg / Section's --fr-section-bg. Emitted ONLY when the model
        // named a bg, so an un-tinted Container stays transparent (byte-identical
        // default). The token fallback inside var() is defence-in-depth on an
        // untrusted path: an INVALID non-null bg leaves --fr-cont-bg unset (styleVars
        // omits it), so the token keeps a fill rather than rendering nothing.
        p.bg != null && '[background:var(--fr-cont-bg,var(--color-background))]',
        // On-surface text channel — CONDITIONAL text-color group form on the
        // wrapper root so the wrapped column inherits it (pairs with a custom
        // bg). Unset → class absent → byte-identical. `currentColor` fallback for
        // the same reason as Box above (invalid `color` inherits instead of
        // resetting an authored dark surface to near-black).
        // Applies when EITHER is authored. A container that paints a bg but names
        // no colour used to leave the LIGHT theme's ink on it (~1.05:1 contrast),
        // and 25 components downstream (Select, Input, Textarea, Popover…) expose
        // no `color` prop to fix it with, so no spec could. --fr-surface-fg is the
        // derived pairing, published beside --fr-surface. An authored colour still
        // wins: it sits earlier in the chain.
        (p.color != null || p.bg != null) && 'text-[color:var(--fr-cont-fg,var(--fr-surface-fg,currentColor))]',
        // Typeface cascade — closed Font enum → static font-* utility (LAST). Unset
        // → undefined → cn drops it → inherits the theme font (byte-identical default).
        fontClass(p.font),
      )}
      style={styleVars(
        { var: '--fr-cont-padx', value: p.paddingValue, kind: 'dim', opts: { units: ['px', 'rem'], max: 96 } },
        { var: '--fr-cont-bg', value: p.bg, kind: 'color' },
                // Publish the shared surface channel too — see Card/Stack/Grid. A descendant
        // compositing over "whatever is behind me" (the DataTable actions column) needs
        // the NEAREST painter, which only one shared name can give it.
        // --fr-surface alone is not enough: 61 components accept `bg` and NONE
        // derives ink from it, and 25 of them expose no `color` prop at all. The
        // paired ink is published here so the whole subtree inherits it — see
        // surfaceStyle in _style.ts.
        { var: '--fr-surface', value: p.bg, kind: 'color' },
        { var: '--fr-surface-fg', value: surfaceInk(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-surface-muted', value: surfaceMuted(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-surface-field', value: surfaceField(p.bg) as string, kind: 'raw' },
        { var: '--fr-surface-sunken', value: surfaceSunken(p.bg) as string, kind: 'raw' },
        { var: '--fr-surface-raised', value: surfaceRaised(p.bg) as string, kind: 'raw' },
        { var: '--fr-cont-fg', value: p.color, kind: 'color' },
        { var: '--fr-cont-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 1600 } },
      )}
    >
      {/* Same no-touching guarantee as Section/Box: children stack with a gap. */}
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function Section({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    spacing?: string | null;
    paddingValue?: string | number | null;
    maxWidth?: string | null;
    align?: string | null;
    eyebrow?: string | null;
    title?: string | null;
    bg?: string | null;
    color?: string | null;
    mutedColor?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  return (
    <section
      className={cn(
        section({
          // A Section WITH a background is a real full-bleed band and keeps the
          // generous `md` (2.5rem) default. A TRANSPARENT Section is almost always
          // an in-screen sub-group (a titled Stack in band's clothing) where band
          // padding just reads as dead space — default those to the tighter `sm`
          // (1.5rem). An explicit `spacing` always wins.
          spacing: (p.spacing as 'none' | 'sm' | 'md' | 'lg' | 'xl' | null) ?? (p.bg != null ? undefined : 'sm'),
          align: (p.align as 'start' | 'center' | 'end' | null) ?? undefined,
        }),
        // Transparent Sections are in-screen sub-groups, not real bands: drop the
        // band padding on any edge that faces a sibling, so the ONLY spacing
        // between stacked groups is the parent container's gap. This kills the
        // compounding voids created by stacking several padded transparent
        // Sections per screen — each `spacing:md` band pad ADDING to the parent
        // gap. Outer edges (first/last/only child) keep their padding for page
        // framing. A backgrounded band keeps ALL padding — its text must not
        // touch the fill.
        p.bg == null &&
          '[&:not(:first-child)]:[padding-top:0px] [&:not(:last-child)]:[padding-bottom:0px]',
        // bg value channel — conditional override (no enum competes). Token
        // fallback inside var() is defence-in-depth on an untrusted path.
        p.bg != null && '[background:var(--fr-section-bg,var(--color-muted))]',
        // On-band text: `color` cascades from the <section> root (like `font`)
        // so CHILDREN on a dark band stay legible too, completing the
        // bg/color/mutedColor on-band group. The h2 keeps its own override for
        // specificity. Unset → class absent → byte-identical. `currentColor`
        // fallback for the same reason as Box above.
        // Applies when EITHER is authored. A container that paints a bg but names
        // no colour used to leave the LIGHT theme's ink on it (~1.05:1 contrast),
        // and 25 components downstream (Select, Input, Textarea, Popover…) expose
        // no `color` prop to fix it with, so no spec could. --fr-surface-fg is the
        // derived pairing, published beside --fr-surface. An authored colour still
        // wins: it sits earlier in the chain.
        (p.color != null || p.bg != null) && 'text-[color:var(--fr-section-fg,var(--fr-surface-fg,currentColor))]',
        // Typeface cascade — closed Font enum → static font-* utility (LAST), so it
        // flows through the band header (eyebrow/title) and children. Unset →
        // undefined → cn drops it → inherits the theme font (byte-identical default).
        fontClass(p.font),
      )}
      style={styleVars(
        { var: '--fr-section-pady', value: p.paddingValue, kind: 'dim', opts: { units: ['px', 'rem'], max: 240 } },
        { var: '--fr-section-bg', value: p.bg, kind: 'color' },
        // --fr-surface alone is not enough: 61 components accept `bg` and NONE
        // derives ink from it, and 25 of them expose no `color` prop at all. The
        // paired ink is published here so the whole subtree inherits it — see
        // surfaceStyle in _style.ts.
        { var: '--fr-surface', value: p.bg, kind: 'color' },
        { var: '--fr-surface-fg', value: surfaceInk(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-surface-muted', value: surfaceMuted(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-surface-field', value: surfaceField(p.bg) as string, kind: 'raw' },
        { var: '--fr-surface-sunken', value: surfaceSunken(p.bg) as string, kind: 'raw' },
        { var: '--fr-surface-raised', value: surfaceRaised(p.bg) as string, kind: 'raw' },
        { var: '--fr-section-fg', value: p.color, kind: 'color' },
        { var: '--fr-section-muted', value: p.mutedColor, kind: 'color' },
        // Title font-size — exact-override var read by sectionTitle's
        // [font-size:var(--fr-section-fs,1.5rem)] on the descendant <h2> (set on the
        // <section> so it cascades, like --fr-section-fg). Unset → omitted → the
        // baked 1.5rem fallback wins (byte-identical default).
        { var: '--fr-section-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      <div className={cn(sectionInner({ width: (p.maxWidth as 'narrow' | 'default' | 'wide' | 'full' | null) ?? undefined }))}>
        {(p.eyebrow != null || p.title != null) && (
          <header>
            {p.eyebrow != null && <p className={cn(sectionEyebrow())}>{p.eyebrow}</p>}
            {p.title != null && (
              <h2
                className={cn(
                  sectionTitle(),
                  // on-fill title colour: the text-color group form (added LAST)
                  // dedupes against and wins over the base `text-current`. Only
                  // applied when the model named a colour; inherited otherwise.
                  // Same `currentColor` fallback as the <section> root above — an
                  // invalid `color` lands on the band's ink, not on the token.
                  // Applies when EITHER is authored. A container that paints a bg but names
        // no colour used to leave the LIGHT theme's ink on it (~1.05:1 contrast),
        // and 25 components downstream (Select, Input, Textarea, Popover…) expose
        // no `color` prop to fix it with, so no spec could. --fr-surface-fg is the
        // derived pairing, published beside --fr-surface. An authored colour still
        // wins: it sits earlier in the chain.
        (p.color != null || p.bg != null) && 'text-[color:var(--fr-section-fg,var(--fr-surface-fg,currentColor))]',
                  // Typography channels — closed enums → static font-*/tracking-*/
                  // leading-* utilities, each its own tw-merge group, placed LAST so a
                  // SET value dedupe-wins over the baked font-semibold/leading-tight
                  // (and adds tracking, which the base omits). Unset → undefined → cn
                  // drops it → baked style unchanged (byte-identical default).
                  weightClass(p.weight),
                  trackingClass(p.tracking),
                  leadingClass(p.leading),
                )}
              >
                {p.title}
              </h2>
            )}
          </header>
        )}
        {/* Content children stack with a gap so bare siblings never touch.
            Mirrors Box's flex-col-gap; the header above keeps its own title
            spacing. align → cross-axis so a centered Section centers its
            children. */}
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </section>
  );
}
