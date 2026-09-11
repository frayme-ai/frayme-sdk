'use client';
import type { CSSProperties, KeyboardEvent, ReactNode, UIEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { useAriaId } from './_aria.js';
import { cn } from '../cn.js';
import { useScrollEdgesOn } from '../use-scroll-edges.js';
import { borderStyleClass, fontClass, leadingClass, styleVars, surfaceField, surfaceInk, surfaceMuted, surfaceRaised, surfaceSunken, trackingClass, weightClass } from './_style.js';
import { safeDimension, safeTrackList } from '@frayme/catalog/validate';
import { hasIcon, Icon } from './icons.js';
import { SafeImage } from './_img.js';
import { useIsColumnLayout } from '../element-types.js';

/* Catalog group: Card, Stack, Grid, Separator, Tabs, Accordion, Collapsible, Carousel */

/* ARIA ids for the tab↔panel and header↔region pairings come from `useAriaId`
 * (registry/_aria.ts), not from a local spec-id helper.
 *
 * The local helper this file used to carry derived the id from the element's own
 * spec id alone, on the reasoning "unique within a spec — one spec id per
 * element". That holds for a flat spec and breaks under `repeat`: json-render
 * re-renders ONE element per row from a single `__fid`, so two rows of a
 * repeated Accordion emitted the identical header/region ids and row two's
 * header pointed a screen reader at row one's panel. `_aria.ts` names this file's
 * Accordion and Tabs pairings as carrying that shape, and aria-repeat-ids.test.tsx
 * already pins the fix for the pairings migrated before them.
 *
 * `useAriaId` folds React's per-INSTANCE `useId()` into the same string and
 * carries the SSR-divergence argument that motivated the local helper: the
 * trigger and its panel are rendered by ONE component reading ONE value, so a
 * divergence moves both sides together and the pairing cannot break. */

/** Container title tag. A container has no way to know its own depth in the
 *  page, so a legal heading outline is only reachable when the SPEC can name the
 *  level; an unnamed level keeps the component's own tag. A model writes the
 *  level as 2, '2' or 'h2' interchangeably, so all three normalise. */
type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
const HEADING_TAGS = new Set<string>(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
function headingTag(value: unknown, fallback: HeadingTag): HeadingTag {
  if (value == null) return fallback;
  const tag = `h${String(value).trim().replace(/^[hH]/, '')}`;
  return HEADING_TAGS.has(tag) ? (tag as HeadingTag) : fallback;
}

/* A layout effect never runs on the server and React warns when one is mounted
 * during SSR; the effect below only places a scroll offset, which is a paint
 * concern, so it falls back to a passive effect where there is no DOM. */
const useIsomorphicLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

/* Focus-visible ring shared with Button (actions.tsx) and the DataTable sort
 * headers — one keyboard-focus signal across every interactive surface. */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_40%,transparent)]';

/* CVA recipes — one per component, faithful to the legacy frayme.css design.
 *
 * VALUE channels (colors / dimensions the model names directly) NEVER become
 * classes — they land in `--fr-<component>-<role>` CSS vars via `styleVars(...)`,
 * and a STATIC arbitrary utility in the recipe base reads each var with a design
 * -token fallback (`var(--fr-card-bg, var(--color-card))`). An unset/invalid
 * value is omitted by `styleVars`, so the token default wins and a props-less
 * spec still renders polished. The arbitrary classes below are literal strings so
 * Tailwind's CSS build compiles them. */

const card = cva(
  // `bg-card` (group bg-color) is the token default so twMerge correctly dedupes
  // it against the `surface:glass` `bg-card/70` (also bg-color) — glass keeps its
  // translucency. The model-supplied `bg` override is applied as a CONDITIONAL
  // arbitrary class in the render (below), NOT here — an unconditional
  // background shorthand reading the card-bg var would paint over glass/70.
  // `padding` reads the exact-override var, falling back to the per-enum default
  // var (set by the `padding` variant below), then md=1.25rem. The enum no longer
  // emits a p-* utility (which tailwind-merge would NOT dedupe against the
  // arbitrary padding class), so there is exactly ONE padding declaration.
  // Border WIDTH is a var-chain applied in the `bordered:true` variant ONLY
  // (border-solid + [border-width:var(--fr-card-bw,1px)]) — NOT in the base. Co-
  // locating the arbitrary [border-width] in the base with `bordered:false`'s
  // border-0 does NOT dedupe in tailwind-merge (different groups), and the
  // arbitrary rule wins in compiled order → it would leak a 1px border onto a
  // borderless card. Keeping the width var on `bordered:true` (mirrors Box) makes
  // border-0 the sole width source when borderless. radiusValue reads a var-chain
  // off the per-enum default var set by the `radius` variant below.
  // max-w-full beside the authored width: the whole architecture renders into
  // host panels of UNKNOWN width, so a spec that says width:"480px" must mean
  // "480px if there is 480px", never "480px regardless". Without the clamp the
  // card simply left the surface.
  'bg-card text-card-foreground shadow-sm [width:var(--fr-card-w,auto)] max-w-full [padding:var(--fr-card-pad,var(--fr-card-pad-default,1.25rem))] [border-radius:var(--fr-card-radius,var(--fr-card-radius-default,var(--radius-frayme)))] [border-color:var(--fr-card-border,var(--color-border))]',
  {
    variants: {
      maxWidth: {
        full: '',
        sm: 'max-w-[24rem]',
        md: 'max-w-[32rem]',
        lg: 'max-w-[48rem]',
      },
      centered: {
        true: 'mx-auto',
        false: '',
      },
      // `surface` — the SPEC-DRIVEN visual treatment. The model selects it per card
      // (props.surface); the recipe defines what each looks like. Not a baked default.
      surface: {
        solid: '',
        gradient:
          'border-transparent [background:linear-gradient(to_bottom_right,var(--fr-card-grad-from,color-mix(in_oklab,var(--fr-card-accent,var(--color-primary))_14%,transparent)),var(--fr-card-bg,var(--color-card)),var(--fr-card-grad-to,color-mix(in_oklab,var(--color-info)_14%,transparent)))]',
        glass: 'bg-card/70 backdrop-blur-md',
        elevated: 'shadow-lg',
      },
      // Sets the DEFAULT padding var (not a p-* utility) so the base's
      // The base's padding var-chain reads the exact override first, then this
      // per-enum default var, so an exact paddingValue wins while the enum stays
      // byte-identical: 0 / 0.75rem (p-3) / 1.25rem (p-5) / 2rem (p-8).
      padding: {
        none: '[--fr-card-pad-default:0px]',
        sm: '[--fr-card-pad-default:0.75rem]',
        md: '[--fr-card-pad-default:1.25rem]',
        lg: '[--fr-card-pad-default:2rem]',
      },
      // radius sets the per-enum DEFAULT radius var (not a rounded-* utility) so the
      // base's [border-radius:var(--fr-card-radius,var(--fr-card-radius-default,…))]
      // chain lets an exact radiusValue win while the enum stays byte-identical to the
      // prior rounded-* steps: 0 / 0.25rem (rounded-sm in v4) / radius-frayme / 1rem
      // (2xl) / 1.5rem (3xl).
      radius: {
        none: '[--fr-card-radius-default:0px]',
        sm: '[--fr-card-radius-default:0.25rem]',
        md: '[--fr-card-radius-default:var(--radius-frayme)]',
        lg: '[--fr-card-radius-default:1rem]',
        full: '[--fr-card-radius-default:1.5rem]',
      },
      align: {
        start: 'text-left',
        center: 'text-center',
        end: 'text-right',
      },
      bordered: {
        true: 'border-solid [border-width:var(--fr-card-bw,1px)]',
        false: 'border-0',
      },
    },
    defaultVariants: {
      maxWidth: 'full',
      centered: false,
      surface: 'solid',
      padding: 'md',
      radius: 'md',
      align: 'start',
      bordered: true,
    },
  },
);

const stack = cva('flex', {
  variants: {
    direction: {
      vertical: 'flex-col',
      horizontal: 'flex-row',
    },
    gap: {
      none: 'gap-0',
      sm: 'gap-2',
      md: 'gap-4',
      lg: 'gap-6',
      xl: 'gap-10',
    },
    align: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
    },
    justify: {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
    },
    // `false` emits NO class: nowrap is already the flex default, and the
    // narrow-container rule for `.fr-stack.flex-row` in frayme.css outranks any
    // single utility — a row that would burst a narrow container wraps there
    // regardless of what this variant says.
    wrap: {
      true: 'flex-wrap',
      false: '',
    },
    // Padding is UNSET by default on Stack: the enum only sets a DEFAULT padding
    // var (no p-* utility), and the render adds the arbitrary padding reader
    // class ONLY when padding/paddingValue is named — so a props-less stack has
    // NO padding (byte-identical). Enum steps: 0 / 0.75rem (p-3) / 1.25rem (p-5)
    // / 2rem (p-8).
    padding: {
      none: '[--fr-stack-pad-default:0px]',
      sm: '[--fr-stack-pad-default:0.75rem]',
      md: '[--fr-stack-pad-default:1.25rem]',
      lg: '[--fr-stack-pad-default:2rem]',
    },
    // `bg` value channel — omitted by styleVars → transparent (no fallback token).
    bg: {
      true: '[background:var(--fr-stack-bg)]',
    },
  },
  defaultVariants: { direction: 'vertical', gap: 'md' },
});

const grid = cva('grid', {
  variants: {
    gap: {
      sm: 'gap-2',
      md: 'gap-4',
      lg: 'gap-6',
      xl: 'gap-10',
    },
    align: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
    },
    // Padding is UNSET by default on Grid (mirrors Stack): the enum only sets a
    // DEFAULT padding var (no p-* utility), and the render adds the arbitrary
    // padding reader class ONLY when padding/paddingValue is named — so a
    // props-less grid has NO padding (byte-identical). Enum steps: 0 / 0.75rem
    // (p-3) / 1.25rem (p-5) / 2rem (p-8).
    padding: {
      none: '[--fr-grid-pad-default:0px]',
      sm: '[--fr-grid-pad-default:0.75rem]',
      md: '[--fr-grid-pad-default:1.25rem]',
      lg: '[--fr-grid-pad-default:2rem]',
    },
    bg: {
      true: '[background:var(--fr-grid-bg)]',
    },
  },
  defaultVariants: { gap: 'md', align: 'stretch' },
});

const separator = cva(
  '[border-color:var(--fr-sep-color,var(--color-border))]',
  {
    variants: {
      orientation: {
        horizontal: 'border-0 border-t [width:var(--fr-sep-len,100%)] max-w-full',
        vertical: 'w-0 self-stretch border-0 border-l [height:var(--fr-sep-len,1.5rem)]',
      },
      thickness: {
        hairline: 'border-t-[1px] border-l-[1px]',
        thin: 'border-t-[2px] border-l-[2px]',
        thick: 'border-t-[4px] border-l-[4px]',
      },
      // `spacing` is the BLOCK axis only. A horizontal rule's box is
      // [width:var(--fr-sep-len,100%)] max-w-full and margins sit OUTSIDE that box, so any
      // inline margin puts its right edge past the parent at every container
      // width — arithmetically unavoidable, whatever the length value is.
      spacing: {
        none: 'my-0',
        sm: 'my-2',
        md: 'my-4',
        lg: 'my-6',
      },
      style: {
        solid: 'border-solid',
        dashed: 'border-dashed',
        dotted: 'border-dotted',
      },
    },
    // A vertical rule is `w-0`, so its inline margins add no width to overflow
    // with — inline is its breathing axis, and it takes the same scale there.
    compoundVariants: [
      { orientation: 'vertical', spacing: 'none', class: 'mx-0' },
      { orientation: 'vertical', spacing: 'sm', class: 'mx-2' },
      { orientation: 'vertical', spacing: 'md', class: 'mx-4' },
      { orientation: 'vertical', spacing: 'lg', class: 'mx-6' },
    ],
    defaultVariants: { orientation: 'horizontal', thickness: 'hairline', spacing: 'sm', style: 'solid' },
  },
);

// A labelled separator renders as a flex row with the rule on either side of the
// label, so it can't be a plain <hr>. The rule segments share the same vars.
const separatorLabelWrap = cva('flex items-center', {
  variants: {
    spacing: {
      none: 'my-0',
      sm: 'my-2',
      md: 'my-4',
      lg: 'my-6',
    },
  },
  defaultVariants: { spacing: 'sm' },
});
const separatorLabelLine = cva(
  'flex-1 border-0 border-t [border-color:var(--fr-sep-color,var(--color-border))]',
  {
    variants: {
      thickness: {
        hairline: 'border-t-[1px] border-l-[1px]',
        thin: 'border-t-[2px] border-l-[2px]',
        thick: 'border-t-[4px] border-l-[4px]',
      },
      style: {
        solid: 'border-solid',
        dashed: 'border-dashed',
        dotted: 'border-dotted',
      },
    },
    defaultVariants: { thickness: 'hairline', style: 'solid' },
  },
);
// NEW-1: the VERTICAL twin of the label line — a rule drawn with the LEFT border on
// a flex-1 element inside a flex column, so a labelled vertical divider ("OR" between
// two side-by-side panels) draws a segment above and below the centered label. Purely
// additive — the horizontal `separatorLabelLine` above is untouched (zero regression
// on the working case). Shares the same `--fr-sep-color` var so line/label colours
// stay independent exactly as on the horizontal path.
const separatorLabelLineVertical = cva(
  'flex-1 border-0 border-l [border-color:var(--fr-sep-color,var(--color-border))]',
  {
    variants: {
      thickness: {
        hairline: 'border-l-[1px]',
        thin: 'border-l-[2px]',
        thick: 'border-l-[4px]',
      },
      style: {
        solid: 'border-solid',
        dashed: 'border-dashed',
        dotted: 'border-dotted',
      },
    },
    defaultVariants: { thickness: 'hairline', style: 'solid' },
  },
);

// fr-tabscroll: the rail scrolls horizontally rather than hard-cutting labels
// (at ~700px the labels clipped mid-glyph with no ellipsis and
// no scroll fallback). The edge fade + thin scrollbar live in frayme.css.
const tablist = cva('fr-tabscroll mb-4 flex overflow-x-auto', {
  variants: {
    // The resting tablist RAIL reads the `trackColor` channel with a token fallback:
    // the underline/enclosed bottom border falls back to the border token, the pill
    // track background falls back to the muted token. An unset/invalid trackColor is
    // omitted by styleVars so the token default wins.
    variant: {
      underline: 'gap-1 border-b [border-color:var(--fr-tabs-track,var(--color-border))]',
      // pill track radius: the baked rounded-frayme becomes the var fallback so an
      // exact radiusValue (--fr-tabs-radius) wins; only the pill variant draws this
      // track, so it's inherently gated to variant:pill (byte-identical when unset).
      pill: 'gap-1 [border-radius:var(--fr-tabs-radius,var(--radius-frayme))] [background:var(--fr-tabs-track,var(--fr-surface-sunken,var(--color-muted)))] p-1',
      enclosed: 'gap-1 border-b [border-color:var(--fr-tabs-track,var(--color-border))]',
    },
    align: {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      stretch: '',
    },
    fitted: {
      true: '',
      false: '',
    },
  },
  defaultVariants: { variant: 'underline', align: 'start', fitted: false },
});

const tabRecipe = cva(
  // text-[color:…] (the text-color group, not an arbitrary [color:…] property) so it
  // dedupes with the active-state `text-foreground`/accent overrides — last wins,
  // while the inactive tab still reads the mutedColor channel.
  // The ring is INSET: the rail is an overflow-x scroller, so an outset ring on
  // the first/last tab would be clipped by the rail's own scroll box.
  `cursor-pointer appearance-none border-0 bg-none px-3.5 py-2 font-[inherit] text-[color:var(--fr-tabs-muted,var(--color-muted-foreground))] ${FOCUS_RING} focus-visible:ring-inset`,
  {
    variants: {
      variant: {
        underline: 'border-b-2 border-transparent',
        pill: 'rounded-[calc(var(--radius-frayme)-0.25rem)]',
        // Resting enclosed-tab edge reads the `borderColor` channel (transparent
        // fallback so an unset value keeps the borderless look); the selected
        // compoundVariant below re-asserts `border-border` and wins.
        enclosed: 'rounded-t-frayme border [border-color:var(--fr-tabs-rest-border,transparent)] border-b-0',
      },
      size: {
        sm: 'px-2.5 py-1 text-sm',
        md: 'px-3.5 py-2',
        lg: 'px-5 py-2.5 text-lg',
      },
      fitted: {
        true: 'flex-1 text-center',
        false: '',
      },
      selected: {
        true: 'font-medium text-foreground',
        false: '',
      },
    },
    compoundVariants: [
      {
        // The INDICATOR carries the raw accent (a 3px rule is a non-text
        // contrast target); the LABEL carries the accent blended toward the
        // surface foreground, because a mid-luminance brand colour used as
        // small text falls under 4.5:1 on the dark surface. See the ink var on
        // the Tabs wrapper.
        variant: 'underline',
        selected: true,
        class: 'border-b-[color:var(--fr-tabs-accent)] text-[color:var(--fr-tabs-ink)]',
      },
      {
        variant: 'pill',
        selected: true,
        // fr-raised, not bg-card: the pill lifts the SURFACE it sits on, so it is
        // white-on-white by default and a lifted navy on a navy page. `bg-card
        // text-foreground` painted a white pill with dark ink onto any authored
        // background.
        class: 'fr-raised shadow-sm',
      },
      {
        // The selected enclosed tab's side/top edges share the `trackColor`
        // channel with the rail it visually merges into (border token fallback,
        // byte-identical when unset); border-b-card still knocks out the bottom
        // edge so the tab stays fused into the panel.
        variant: 'enclosed',
        selected: true,
        class: 'border-[color:var(--fr-tabs-track,var(--color-border))] border-b-card bg-card text-foreground',
      },
    ],
    defaultVariants: { variant: 'underline', size: 'md', fitted: false, selected: false },
  },
);

const accordionWrap = cva(
  // radiusValue var-chain on the WRAPPER; the separated accordionItem reads the
  // SAME inherited chain, so the one radius channel covers both the boxed
  // container and the separated cards. The radius variant sets the per-enum
  // default var; an exact radiusValue (--fr-acc-radius) wins. Steps
  // byte-identical to the prior rounded-*: 0 / 0.25rem / radius-frayme / 1rem /
  // 1.5rem.
  //
  // --fr-acc-accent is the QUIET default for the open header's ink (its only
  // consumer — accordionTrigger's `open:true`), and it is `currentColor`, not
  // --color-foreground. The trigger is `bg-none` and no wrapper variant paints a
  // fill, so an open header inherits its surface: inside an authored
  // `Card { bg:"#12161f", color:"#e2e6f0" }` the token reset it to rgb(24,24,27)
  // — contrast 1.02 on dark navy. "Neutral high-contrast" can only mean the ink of
  // the surface you are on. At the top level the two are the same value
  // (frayme.css sets `.frayme-root { color: var(--frayme-fg) }` and
  // `--color-foreground: var(--frayme-fg)`), so the props-less render does not
  // move, and a model-named `accent` still overrides the var via styleVars. On
  // the `color` property currentColor computes to the INHERITED value, no cycle.
  '[--fr-acc-accent:currentColor] [border-radius:var(--fr-acc-radius,var(--fr-acc-radius-default,var(--radius-frayme)))] [border-color:var(--fr-acc-border,var(--color-border))]',
  {
    variants: {
      variant: {
        bordered: 'overflow-hidden border',
        separated: 'flex flex-col gap-2',
        ghost: '',
      },
      radius: {
        none: '[--fr-acc-radius-default:0px]',
        sm: '[--fr-acc-radius-default:0.25rem]',
        md: '[--fr-acc-radius-default:var(--radius-frayme)]',
        lg: '[--fr-acc-radius-default:1rem]',
        full: '[--fr-acc-radius-default:1.5rem]',
      },
    },
    defaultVariants: { variant: 'bordered', radius: 'md' },
  },
);

const accordionItem = cva('[border-color:var(--fr-acc-border,var(--color-border))]', {
  variants: {
    variant: {
      bordered: '[&+&]:border-t',
      // Each separated card reads the wrapper's radius var-chain via CSS custom-
      // property inheritance (the wrapper draws no border on this variant), so
      // radius/radiusValue cover the separated cards too. The radius-frayme
      // fallback keeps the unset default byte-identical to the prior
      // rounded-frayme.
      separated:
        'overflow-hidden [border-radius:var(--fr-acc-radius,var(--fr-acc-radius-default,var(--radius-frayme)))] border',
      ghost: '[&+&]:border-t',
    },
  },
  defaultVariants: { variant: 'bordered' },
});

const accordionTrigger = cva(
  // Inset ring: the bordered/separated wrappers clip with overflow-hidden, so an
  // outset ring on the first/last header would be cut by the wrapper.
  `flex min-h-6 w-full cursor-pointer items-center justify-between border-0 bg-none font-medium ${FOCUS_RING} focus-visible:ring-inset`,
  {
    variants: {
      size: {
        sm: 'px-3 py-2 text-sm',
        md: 'px-4 py-3',
        lg: 'px-5 py-4 text-lg',
      },
      open: {
        true: 'text-[color:var(--fr-acc-accent)]',
        false: '',
      },
    },
    defaultVariants: { size: 'md', open: false },
  },
);

// The body holds ARBITRARY authored children and had padding but no rhythm rule,
// so two stacked children rendered with a 0px seam: a trailing note welded to the
// bottom of the description grid above it, reading as one run-on block (a
// trailing note flush against its <dl>).
//
// `[&>*+*]` and not flex/gap on purpose: it is purely additive, so a single-child
// body — the overwhelmingly common case — stays byte-identical, and the block
// layout model is untouched (no flex-item sizing surprises on authored children).
const accordionBody = cva('[color:var(--fr-acc-muted,var(--color-muted-foreground))]', {
  variants: {
    size: {
      sm: 'px-3 pb-2.5 text-sm [&>*+*]:mt-2',
      md: 'px-4 pb-3.5 [&>*+*]:mt-3',
      lg: 'px-5 pb-4 [&>*+*]:mt-3.5',
    },
  },
  defaultVariants: { size: 'md' },
});

const collapsibleWrap = cva(
  // radiusValue var-chain on the box; the radius variant sets the per-enum default
  // var, an exact radiusValue (--fr-coll-radius) wins. Steps byte-identical to the
  // prior rounded-*: 0 / 0.25rem / radius-frayme / 1rem / 1.5rem.
  // --fr-coll-accent is `currentColor` for the same reason as --fr-acc-accent
  // above, and it bites harder here: collapsibleTrigger reads it in its BASE
  // (every state, not just open), and neither `bordered` nor `ghost` paints a
  // fill, so on an authored dark card the whole header was the near-black reset.
  '[--fr-coll-accent:currentColor] [border-radius:var(--fr-coll-radius,var(--fr-coll-radius-default,var(--radius-frayme)))] [border-color:var(--fr-coll-border,var(--color-border))]',
  {
    variants: {
      variant: {
        bordered: 'border',
        ghost: '',
      },
      radius: {
        none: '[--fr-coll-radius-default:0px]',
        sm: '[--fr-coll-radius-default:0.25rem]',
        md: '[--fr-coll-radius-default:var(--radius-frayme)]',
        lg: '[--fr-coll-radius-default:1rem]',
        full: '[--fr-coll-radius-default:1.5rem]',
      },
    },
    defaultVariants: { variant: 'bordered', radius: 'md' },
  },
);

const collapsibleTrigger = cva(
  'flex min-h-6 w-full cursor-pointer items-center justify-between border-0 bg-none font-medium text-[color:var(--fr-coll-accent)]',
  {
    variants: {
      size: {
        sm: 'px-3 py-2 text-sm',
        md: 'px-4 py-3',
        lg: 'px-5 py-4 text-lg',
      },
      iconPosition: {
        start: 'flex-row-reverse justify-end gap-2',
        end: '',
      },
    },
    defaultVariants: { size: 'md', iconPosition: 'end' },
  },
);

// The collapsible BODY scales with the same `size` enum as its trigger (the
// coherence group), reusing accordionBody's padding steps so the body's left
// gutter always aligns with the trigger title. md reproduces the prior
// hard-coded padding byte-identically.
// Same 0px-seam fix as accordionBody, and this is the wrapper that actually
// produced the measured defect — see the note there for why `[&>*+*]` rather
// than flex/gap. The steps stay in lockstep with accordionBody's (the coherence
// group), so a Collapsible and an Accordion holding the same children agree.
const collapsibleBody = cva('', {
  variants: {
    size: {
      sm: 'px-3 pb-2.5 [&>*+*]:mt-2',
      md: 'px-4 pb-3.5 [&>*+*]:mt-3',
      lg: 'px-5 pb-4 [&>*+*]:mt-3.5',
    },
  },
  defaultVariants: { size: 'md' },
});

const caret = cva('inline-block transition-transform duration-150', {
  variants: {
    open: {
      true: 'rotate-180',
      false: '',
    },
    iconPosition: {
      start: 'mr-0',
      end: 'ml-2',
    },
  },
  defaultVariants: { open: false, iconPosition: 'end' },
});

// tabIndex/role/label are applied at the render site: a rail that scrolls but
// cannot be focused is unreachable by keyboard — its slides simply do not
// exist for that user.
const carouselTrack = cva('flex snap-x snap-mandatory overflow-x-auto pb-2', {
  variants: {
    gap: {
      sm: 'gap-2',
      md: 'gap-4',
      lg: 'gap-6',
      xl: 'gap-10',
    },
    align: {
      start: '[&>*]:snap-start',
      center: '[&>*]:snap-center',
    },
  },
  defaultVariants: { gap: 'md', align: 'start' },
});

const carouselCard = cva(
  // radiusValue var-chain on each card; the radius variant sets the per-enum default
  // var, an exact radiusValue (--fr-car-radius) wins. Steps byte-identical to the
  // prior rounded-*: 0 / 0.25rem / radius-frayme / 1rem / 1.5rem.
  'shrink-0 grow-0 [flex-basis:var(--fr-car-w,14rem)] border [background:var(--fr-car-bg,var(--color-card))] [border-radius:var(--fr-car-radius,var(--fr-car-radius-default,var(--radius-frayme)))] [border-color:var(--fr-car-border,var(--color-border))] p-4',
  {
    variants: {
      radius: {
        none: '[--fr-car-radius-default:0px]',
        sm: '[--fr-car-radius-default:0.25rem]',
        md: '[--fr-car-radius-default:var(--radius-frayme)]',
        lg: '[--fr-car-radius-default:1rem]',
        full: '[--fr-car-radius-default:1.5rem]',
      },
    },
    defaultVariants: { radius: 'md' },
  },
);

export function Card({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title?: string | null;
    description?: string | null;
    maxWidth?: string | null;
    centered?: boolean | null;
    surface?: string | null;
    padding?: string | null;
    paddingValue?: string | number | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    align?: string | null;
    bordered?: boolean | null;
    borderStyle?: string | null;
    borderWidthValue?: string | number | null;
    bg?: string | null;
    borderColor?: string | null;
    accent?: string | null;
    gradientFrom?: string | null;
    gradientTo?: string | null;
    width?: string | number | null;
    color?: string | null;
    mutedColor?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
    // intra-card vertical rhythm of the content column. Closed enum; default md
    // (gap-4) is byte-identical to the prior hardcoded gap.
    gap?: 'none' | 'sm' | 'md' | 'lg' | null;
    // the semantic rank of the header `title` in the page outline.
    titleLevel?: string | number | null;
  };
  // content-gap enum → a static gap-* utility on the children column. md maps to
  // gap-4 (the prior literal), so an unset card renders byte-identically.
  const CARD_GAP = { none: 'gap-0', sm: 'gap-2', md: 'gap-4', lg: 'gap-6' } as const;
  const contentGap = CARD_GAP[(p.gap as 'none' | 'sm' | 'md' | 'lg' | null) ?? 'md'];
  // Outline rank of the card title — authored, because only the spec knows what
  // sits above this card. Unset → h3 (the card's own level).
  // h2, not h3. PageHeader emits h1, so an h3 default meant every screen with a
  // page header and a card skipped a level, and it was read as an authoring
  // problem when it is this one default.
  // A Card is the first structural level under the page title; an author who
  // genuinely nests deeper still sets `titleLevel`.
  const TitleTag = headingTag(p.titleLevel, 'h2');
  return (
    <section
      className={cn(
        // Equal-frame law marker (frayme.css): a frame component — grows to
        // absorb slack when it is the last frame child of a stretched Grid
        // cell's Stack wrapper.
        'fr-frame',
        card({
          maxWidth: (p.maxWidth as 'full' | 'sm' | 'md' | 'lg' | null) ?? undefined,
          centered: (p.centered as boolean | null) ?? undefined,
          surface: (p.surface as 'solid' | 'gradient' | 'glass' | 'elevated' | null) ?? undefined,
          padding: (p.padding as 'none' | 'sm' | 'md' | 'lg' | null) ?? undefined,
          radius: (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
          align: (p.align as 'start' | 'center' | 'end' | null) ?? undefined,
          bordered: (p.bordered as boolean | null) ?? undefined,
        }),
        // Precedence: explicit value (props.bg) > surface treatment > token default.
        // Emitted only when the model named a bg, so the surface variant owns the
        // background otherwise (keeps glass translucent + gradient/elevated/solid correct).
        // The `var(--color-card)` fallback is defence-in-depth: on an ungated/untrusted
        // path an INVALID non-null bg leaves --fr-card-bg unset (styleVars omits it), so
        // without the fallback the card would render transparent — the token keeps a fill.
        p.bg != null && '[background:var(--fr-card-bg,var(--color-card))]',
        // The card ALWAYS paints — `bg-card` sits in the cva base — so when no bg is
        // authored the channel is reset to that token rather than left describing an
        // outer surface. See stale-channel note in _style.ts.
        p.bg == null && '[--fr-surface:var(--color-card)] [--fr-surface-fg:var(--color-card-foreground)] [--fr-surface-muted:var(--color-muted-foreground)] [--fr-surface-sunken:var(--color-muted)] [--fr-surface-raised:var(--color-card)] [--fr-surface-field:var(--color-card)]',
        // On-surface text channel — CONDITIONAL text-color group form, added LAST
        // so tw-merge dedupes the base text-card-foreground. It rides the card
        // ROOT so children inherit; the title keeps its own accent behavior (its
        // accent var falls back to inherit → follows this colour when accent is
        // unset) and the description keeps mutedColor. Unset → class absent →
        // byte-identical defaults.
        // Applies when EITHER is authored. A container that paints a bg but names no
        // colour used to leave the LIGHT theme's ink on it (~1.05:1 contrast), and 25
        // components downstream (Select,
        // Input, Textarea, Popover…) expose no `color` prop to fix it with, so no
        // spec could. --fr-surface-fg is the derived pairing, published beside
        // --fr-surface. An authored colour still wins: it sits earlier in the chain.
        (p.color != null || p.bg != null) && 'text-[color:var(--fr-card-fg,var(--fr-surface-fg,var(--color-card-foreground)))]',
        // Closed Font enum → a static font-* utility (LAST in the font-family group
        // so a set value wins); the whole card region inherits it. Unset/unknown →
        // undefined → dropped (inherit the theme font, byte-identical).
        fontClass(p.font),
        // Closed border-style enum → a static border-* utility (border-style group,
        // LAST so a set value wins over the base border-solid). Unset → undefined →
        // dropped (keeps border-solid, byte-identical). Meaningful only when bordered.
        borderStyleClass(p.borderStyle),
      )}
      style={styleVars(
        // ALSO publish the shared surface channel. Each container names its own
        // background var, which is right for its own recipe but useless to a
        // DESCENDANT that needs to composite over "whatever is behind me": reading
        // them in a fixed order picks wrongly the moment a Card sits inside a Stack,
        // because the nearer ancestor is not the one the fallback chain prefers.
        // One shared name inherits correctly by construction — the nearest painting
        // ancestor wins, which is exactly the question being asked. A DataTable on a
        // dark page Stack had a WHITE actions column for precisely this reason.
        { var: '--fr-card-bg', value: p.bg, kind: 'color' },
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
        { var: '--fr-card-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-card-accent', value: p.accent, kind: 'color' },
        { var: '--fr-card-grad-from', value: p.gradientFrom, kind: 'color' },
        { var: '--fr-card-grad-to', value: p.gradientTo, kind: 'color' },
        // on-surface base text: children + the title-when-accent-unset read it.
        { var: '--fr-card-fg', value: p.color, kind: 'color' },
        { var: '--fr-card-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-card-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 1200 } },
        { var: '--fr-card-pad', value: p.paddingValue, kind: 'dim', opts: { units: ['px', 'rem'], max: 96 } },
        // exact corner radius → --fr-card-radius wins over the per-enum default var.
        { var: '--fr-card-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        // exact border thickness → --fr-card-bw wins over the 1px base default.
        { var: '--fr-card-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
      )}
    >
      {(p.title != null || p.description != null) && (
        <header className="mb-4">
          {p.title != null && (
            <TitleTag
              className={cn(
                // fontSize is a single source: the baked 1.0625rem is the var fallback
                // (byte-identical when unset), and an exact fontSize wins via the var.
                // A card grows to its content; a clipped title is information the
                // card exists to carry. break-words, never truncate.
                'm-0 mb-1 break-words [font-size:var(--fr-card-fs,1.0625rem)] font-semibold text-[color:var(--fr-card-accent,inherit)]',
                // weight/tracking/leading closed enums → static utilities, LAST in cn()
                // so a set value dedupe-wins its group; unset → undefined → byte-identical
                // (font-semibold stays the default weight).
                weightClass(p.weight),
                trackingClass(p.tracking),
                leadingClass(p.leading),
              )}
              style={styleVars({ var: '--fr-card-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } })}
              title={p.title}
            >
              {p.title}
            </TitleTag>
          )}
          {p.description != null && (
            // max-w-prose: the subtitle wraps at a reading measure instead of
            // running the full width of a wide host (the PageHeader treatment).
            // Capping the box makes its own alignment visible, so a centered /
            // end-aligned card has to place the capped box too — text-center on
            // a left-hugging 65ch box reads as off-centre.
            <p
              className={cn(
                'm-0 max-w-prose text-sm [color:var(--fr-card-muted,var(--color-muted-foreground))]',
                p.align === 'center' && 'mx-auto',
                p.align === 'end' && 'ml-auto',
              )}
            >
              {p.description}
            </p>
          )}
        </header>
      )}
      <div className={cn('flex flex-col', contentGap)}>{children}</div>
    </section>
  );
}

export function Stack({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    direction?: string | null;
    gap?: string | null;
    align?: string | null;
    justify?: string | null;
    wrap?: boolean | null;
    padding?: string | null;
    paddingValue?: string | number | null;
    bg?: string | null;
    color?: string | null;
    gapValue?: string | number | null;
    font?: string | null;
  };
  // Normalise ONCE, and fail to the documented default rather than to the bare
  // cva base. An out-of-enum value reached cva as-is, matched no key, and cva
  // then skipped its own defaultVariants because a value WAS supplied — so the
  // class list collapsed to the bare `flex` base, which is a ROW: the exact
  // opposite of the documented `vertical` default, and silent.
  //
  // Not hypothetical. A spec authored `direction:"column"` (a plausible
  // synonym for `vertical` that is not in the enum) and its whole page — a
  // PageHeader, seven Cards, a separator and a Sources block, 16 children —
  // rendered as one unwrapped row at 624px with every child crushed to 2-66px.
  //
  // Byte-identical for every VALID input: absent/null still resolve to
  // 'vertical' (what cva's defaultVariants produced) and 'horizontal' is
  // untouched. Only the previously-broken inputs change.
  const direction = p.direction === 'horizontal' || p.direction === 'vertical' ? p.direction : 'vertical';
  // Default wrap: horizontal stacks wrapped historically; preserve that unless
  // the author opts out (wrap:false). Vertical stacks never wrap.
  const horizontal = direction === 'horizontal';
  const wrap = p.wrap ?? (horizontal ? true : false);
  // Responsive keystone: a horizontal Stack holding ≥2 block
  // containers is a COLUMN LAYOUT — mark it so frayme.css can stack it
  // full-width on narrow containers instead of wrapping children at intrinsic
  // width (the "orphan side-card" defect). Inline rows (icon+text, button
  // groups) never match; outside a FraymeRenderer the hook returns false and
  // the render is byte-identical to before.
  const isColumns = useIsColumnLayout((element as { children?: unknown }).children);
  return (
    <div
      className={cn(
        stack({
          direction,
          gap: (p.gap as 'none' | 'sm' | 'md' | 'lg' | 'xl' | null) ?? undefined,
          align: (p.align as 'start' | 'center' | 'end' | 'stretch' | null) ?? undefined,
          justify:
            (p.justify as 'start' | 'center' | 'end' | 'between' | 'around' | null) ?? undefined,
          wrap: horizontal ? wrap : false,
          padding: (p.padding as 'none' | 'sm' | 'md' | 'lg' | null) ?? undefined,
          bg: p.bg != null ? true : undefined,
        }),
        horizontal && isColumns && 'fr-hcols',
        // An authored `wrap:false` row cannot reflow, so on a narrow container
        // its children have nowhere to go but smaller — and `min-width:0` (set
        // just below for every stack child) lets them shrink past their own
        // content, which is where the ellipsis comes from. Measured at 320px:
        // nearly every truncated element sat inside a nowrap flex row; none
        // sat inside a grid, which already collapses.
        // The marker lets frayme.css return the row's wrapping below 32em —
        // rigid where there is room to be rigid, reflowing where there is not.
        horizontal && !wrap && 'fr-row-rigid',
        // Equal-frame law marker (frayme.css): a Stack that is a stretched Grid
        // cell passes the fill through to its last frame child (Card/Callout).
        'fr-stack',
        // Group form (gap-[…]) so tw-merge dedupes the gap-* enum class — the bare
        // arbitrary-property form loses to the enum by compiled-stylesheet order.
        // Gate on VALIDITY (same opts as the styleVars entry): an invalid value must
        // keep the enum gap, not dedupe it away and collapse to 0.
        safeDimension(p.gapValue, { units: ['px', 'rem'], max: 160 }) != null &&
          'gap-[var(--fr-stack-gap)]',
        // Padding reader: only when padding/paddingValue is named, so an unset
        // stack stays padding-less. paddingValue (--fr-stack-pad) wins; otherwise
        // the enum's --fr-stack-pad-default applies.
        (p.padding != null || p.paddingValue != null) &&
          '[padding:var(--fr-stack-pad,var(--fr-stack-pad-default,0px))]',
        // On-surface text channel — CONDITIONAL text-color group form on the
        // stack root so every child inherits it (pairs with a custom bg). Unset
        // → class absent → byte-identical (children keep the theme foreground).
        //
        // The var's FALLBACK is `currentColor`: this class is emitted only when
        // the model NAMED a colour, so the fallback is the INVALID-value path
        // (styleVars omits an unparseable colour). Resetting to --color-foreground
        // there painted near-black on an authored dark ancestor — the
        // inherited-foreground defect (1.02 on dark navy) — while inheriting
        // reduces an invalid `color`
        // to exactly what OMITTING it already does. Same value at the top level:
        // frayme.css points `.frayme-root { color }` and --color-foreground at
        // --frayme-fg. A Stack with a `bg` and an invalid `color` is no worse
        // than before, since the token was just as blind to that fill.
        // Applies when EITHER is authored. A container that paints a bg but names no
        // colour used to leave the LIGHT theme's ink on it (~1.05:1 contrast), and 25
        // components downstream (Select,
        // Input, Textarea, Popover…) expose no `color` prop to fix it with, so no
        // spec could. --fr-surface-fg is the derived pairing, published beside
        // --fr-surface. An authored colour still wins: it sits earlier in the chain.
        (p.color != null || p.bg != null) && 'text-[color:var(--fr-stack-fg,var(--fr-surface-fg,currentColor))]',
        // Closed Font enum → a static font-* utility (LAST in the font-family group
        // so a set value wins); the whole stack region inherits it. Unset/unknown →
        // undefined → dropped (inherit the theme font, byte-identical).
        fontClass(p.font),
      )}
      style={styleVars(
        { var: '--fr-stack-bg', value: p.bg, kind: 'color' },
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
        { var: '--fr-stack-fg', value: p.color, kind: 'color' },
        { var: '--fr-stack-gap', value: p.gapValue, kind: 'dim', opts: { units: ['px', 'rem'], max: 160 } },
        { var: '--fr-stack-pad', value: p.paddingValue, kind: 'dim', opts: { units: ['px', 'rem'], max: 96 } },
      )}
    >
      {children}
    </div>
  );
}

export function Grid({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    columns?: string | number | null;
    gap?: string | null;
    align?: string | null;
    padding?: string | null;
    paddingValue?: string | number | null;
    bg?: string | null;
    color?: string | null;
    gapValue?: string | number | null;
    minColWidth?: string | number | null;
    template?: string | null;
    rows?: string | number | null;
    font?: string | null;
  };
  // `columns` / `gapValue` / `minColWidth` / `rows` land in vars (data, never a
  // class); the static recipe reads them via var() with sensible fallbacks.
  // `minColWidth`, when set, switches to a responsive auto-fit template.
  const useAutoFit = p.minColWidth != null;
  const trackList = safeTrackList(p.template);
  return (
    <div
      className={cn(
        grid({
          gap: (p.gap as 'sm' | 'md' | 'lg' | 'xl' | null) ?? undefined,
          align: (p.align as 'start' | 'center' | 'end' | 'stretch' | null) ?? undefined,
          padding: (p.padding as 'none' | 'sm' | 'md' | 'lg' | null) ?? undefined,
          bg: p.bg != null ? true : undefined,
        }),
        // Equal-frame law marker (frayme.css): stamped ONLY when align resolves
        // to stretch (the cva default), so an authored align:start/center/end
        // keeps its meaning — the pass-through rule never fights authored align.
        (p.align == null || p.align === 'stretch') && 'fr-grid',
        // An explicit track list wins: it is the only way to give a matrix
        // columns of DIFFERENT widths, and a header row and its data rows share
        // it so their fields line up as real columns.
        // fr-grid-tracks carries the narrow-width collapse (frayme.css): an
        // authored track list is absolute — CSS will honour `13rem 4.5rem …`
        // straight past the container edge — so it needs the same phone-width
        // stack every other fixed template already gets, or a matrix that lines
        // up beautifully at desk width escapes the render surface at 320px.
        trackList != null
          ? '[grid-template-columns:var(--fr-grid-template)] fr-grid-tracks'
          : useAutoFit
          ? '[grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--fr-grid-mincol)),1fr))]'
          : // Responsive keystone. The authored `columns` count is a
            // TARGET, not a lock: a hard repeat(N) template only ever collapsed via
            // the 480px container query below, which measures the RENDER ROOT — so a
            // nested grid could never stack until the whole screen was phone-width,
            // and two charts sat side by side at 216px each on a 512px host.
            // auto-fit keys off THIS grid's own box instead, and each track carries
            // two floors: the authored share (92% leaves room for gaps) and an
            // absolute minimum that shrinks as the column count rises — a 4-up grid
            // expects less per cell than a 2-up one. min(100%,…) keeps the floor from
            // exceeding the container (which would overflow instead of stacking).
            '[grid-template-columns:repeat(auto-fit,minmax(min(100%,calc(max(40rem,92%)/var(--fr-grid-cols,2))),1fr))] fr-grid-fixed',
        p.rows != null && '[grid-template-rows:repeat(var(--fr-grid-rows),minmax(0,auto))]',
        // gap group form so tw-merge drops the recipe's gap-* enum class (a bare
        // [gap:…] arbitrary property is a different group and loses to gap-4).
        // Gated on VALIDITY (same opts as the styleVars entry): an invalid value
        // must keep the enum gap, not dedupe it away and collapse to 0.
        safeDimension(p.gapValue, { units: ['px', 'rem'], max: 160 }) != null &&
          'gap-[var(--fr-grid-gap)]',
        // Padding reader (mirrors Stack): only when padding/paddingValue is named,
        // so a props-less grid stays padding-less. paddingValue (--fr-grid-pad) wins;
        // otherwise the enum's --fr-grid-pad-default applies.
        (p.padding != null || p.paddingValue != null) &&
          '[padding:var(--fr-grid-pad,var(--fr-grid-pad-default,0px))]',
        // On-surface text channel — CONDITIONAL text-color group form on the
        // grid root so every cell inherits it (pairs with a custom bg). Unset →
        // class absent → byte-identical (cells keep the theme foreground).
        // `currentColor` fallback for the same reason as Stack above (an invalid
        // `color` inherits instead of resetting an authored dark surface).
        // Applies when EITHER is authored. A container that paints a bg but names no
        // colour used to leave the LIGHT theme's ink on it (~1.05:1 contrast), and 25
        // components downstream (Select,
        // Input, Textarea, Popover…) expose no `color` prop to fix it with, so no
        // spec could. --fr-surface-fg is the derived pairing, published beside
        // --fr-surface. An authored colour still wins: it sits earlier in the chain.
        (p.color != null || p.bg != null) && 'text-[color:var(--fr-grid-fg,var(--fr-surface-fg,currentColor))]',
        // Closed Font enum → a static font-* utility (family parity with Card/
        // Stack/Box/Container/Section); the whole grid region inherits it. Unset/
        // unknown → undefined → dropped (inherit the theme font, byte-identical).
        fontClass(p.font),
      )}
      style={styleVars(
        { var: '--fr-grid-cols', value: p.columns, kind: 'dim', opts: { kind: 'count', min: 1, max: 6 } },
        { var: '--fr-grid-rows', value: p.rows, kind: 'dim', opts: { kind: 'count', min: 1, max: 12 } },
        { var: '--fr-grid-mincol', value: p.minColWidth, kind: 'dim', opts: { units: ['px', 'rem'], min: 80, max: 600 } },
        { var: '--fr-grid-gap', value: p.gapValue, kind: 'dim', opts: { units: ['px', 'rem'], max: 160 } },
        { var: '--fr-grid-pad', value: p.paddingValue, kind: 'dim', opts: { units: ['px', 'rem'], max: 96 } },
        { var: '--fr-grid-bg', value: p.bg, kind: 'color' },
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
        { var: '--fr-grid-fg', value: p.color, kind: 'color' },
        // proved against the closed track grammar, so it rides as a plain var
        ...(trackList != null ? [{ var: '--fr-grid-template' as const, value: trackList, kind: 'track' as const }] : []),
      )}
    >
      {children}
    </div>
  );
}

export function Separator({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    orientation?: string | null;
    thickness?: string | null;
    spacing?: string | null;
    style?: string | null;
    color?: string | null;
    labelColor?: string | null;
    length?: string | number | null;
    label?: string | null;
  };
  const colorVars = styleVars(
    { var: '--fr-sep-color', value: p.color, kind: 'color' },
    { var: '--fr-sep-label', value: p.labelColor, kind: 'color' },
    { var: '--fr-sep-len', value: p.length, kind: 'dim', opts: { units: ['px', 'rem', '%'] } },
  );

  // Labelled divider: a flex line with the rule on each side of the label. Works in
  // BOTH orientations (NEW-1) — horizontal = a row with the label between two
  // horizontal segments; vertical = a column with the label between two vertical
  // segments (e.g. "OR" between two side-by-side panels).
  if (p.label != null) {
    const isVertical = (p.orientation ?? 'horizontal') === 'vertical';
    if (isVertical) {
      const vline = separatorLabelLineVertical({
        thickness: (p.thickness as 'hairline' | 'thin' | 'thick' | null) ?? undefined,
        style: (p.style as 'solid' | 'dashed' | 'dotted' | null) ?? undefined,
      });
      // Vertical spacing maps to horizontal margins (mirrors the mx-* the plain
      // vertical hr gets). `self-stretch` takes the flex parent's height; when the
      // model names a `length` it wins, else a 4rem default gives the two segments
      // room around the label (the plain vertical hr defaults to 1.5rem, too short
      // to also fit a label). Invalid length → var omitted → the 4rem fallback.
      const vSpacing =
        ({ none: 'mx-0', sm: 'mx-2', md: 'mx-4', lg: 'mx-6' } as const)[
          (p.spacing as 'none' | 'sm' | 'md' | 'lg' | null) ?? 'sm'
        ] ?? 'mx-2';
      return (
        <div
          className={cn('flex flex-col items-center self-stretch', vSpacing, '[height:var(--fr-sep-len,4rem)]')}
          role="separator"
          aria-orientation="vertical"
          aria-label={p.label}
          style={colorVars}
        >
          <span className={cn(vline)} aria-hidden />
          <span className="my-2 text-xs font-medium text-[color:var(--fr-sep-label,var(--color-muted-foreground))]">{p.label}</span>
          <span className={cn(vline)} aria-hidden />
        </div>
      );
    }
    const line = separatorLabelLine({
      thickness: (p.thickness as 'hairline' | 'thin' | 'thick' | null) ?? undefined,
      style: (p.style as 'solid' | 'dashed' | 'dotted' | null) ?? undefined,
    });
    return (
      <div
        className={cn(
          separatorLabelWrap({ spacing: (p.spacing as 'none' | 'sm' | 'md' | 'lg' | null) ?? undefined }),
          // `length` reader — CONDITIONAL (only when the model named a length) so
          // an unset labelled divider stays byte-identical. The 100% in-var
          // fallback + mx-auto make a short centered divider work with a label
          // exactly as it does on the plain hr path (an invalid value omits the
          // var, so the fallback keeps full width).
          p.length != null && '[width:var(--fr-sep-len,100%)] max-w-full mx-auto',
        )}
        role="separator"
        aria-label={p.label}
        style={colorVars}
      >
        <span className={cn(line)} aria-hidden />
        {/* The label reads its OWN channel (labelColor) with the prior muted
            token folded in as the in-var fallback — line-vs-label colour stay
            independent by default. */}
        <span className="mx-3 text-xs font-medium text-[color:var(--fr-sep-label,var(--color-muted-foreground))]">{p.label}</span>
        <span className={cn(line)} aria-hidden />
      </div>
    );
  }

  return (
    <hr
      className={cn(
        separator({
          orientation: (p.orientation as 'horizontal' | 'vertical' | null) ?? undefined,
          thickness: (p.thickness as 'hairline' | 'thin' | 'thick' | null) ?? undefined,
          spacing: (p.spacing as 'none' | 'sm' | 'md' | 'lg' | null) ?? undefined,
          style: (p.style as 'solid' | 'dashed' | 'dotted' | null) ?? undefined,
        }),
        // The thickness variant carries both sides so it can serve a vertical
        // rule; a horizontal one zeroes the side it does not use.
        (p.orientation as string) !== 'vertical' && 'border-l-0',
      )}
      style={colorVars}
    />
  );
}

export function Tabs({ element, children, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    // tabs may carry an optional leading `icon` (registry NAME) and a `count`
    // badge, in addition to {label, value}. Absent → byte-identical to a bare tab.
    tabs: Array<{ label: string; value: string; icon?: string | null; count?: number | null }>;
    defaultValue?: string | null;
    value?: string | null;
    variant?: string | null;
    size?: string | null;
    align?: string | null;
    // typed to what an untrusted spec can actually deliver, not to what the
    // catalog schema promises — the normalisation below is the reason.
    fitted?: boolean | string | null;
    accent?: string | null;
    mutedColor?: string | null;
    trackColor?: string | null;
    borderColor?: string | null;
    radiusValue?: string | number | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const [bound, setBound] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  const [local, setLocal] = useState<string | undefined>(undefined);
  const tabs = Array.isArray(p.tabs) ? p.tabs : [];
  const active = bound ?? local ?? p.defaultValue ?? tabs[0]?.value;
  const variant = (p.variant as 'underline' | 'pill' | 'enclosed' | null) ?? undefined;
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  // Normalise ONCE to a real boolean — the cva lookup and the class ternary at
  // the render site below must never disagree about what `fitted` means.
  //
  // They could, and the failure was silent. cva looks a variant up by
  // String(value), so `fitted:"false"` matched the `false` key (no flex-1) while
  // the ternary saw a truthy string and took the FITTED branch (break-words, no
  // shrink-0). The tab then had neither flex-1 nor shrink-0 — i.e. the flex
  // default `0 1 auto` — INSIDE fr-tabscroll, which is an overflow-x scroller.
  // A shrinkable child in a scrolling rail is a whole layout defect
  // class: at 320px in the sibling attached rails, labels with internal
  // break opportunities ("All · 6", "Wk 1 · start") collapsed to 16-40px wide and
  // 60px tall — the rail scrolled nothing and the words shattered instead.
  // Off-enum props reaching cva as-is is the same shape as the Stack `direction`
  // bug (see Stack below): a plausible-but-wrong value silently produced the
  // opposite of the documented default.
  //
  // Byte-identical for every VALID input: true stays fitted; false/null/absent
  // all resolve to the `false` variant, which is what cva's defaultVariants
  // already produced. 'true' keeps rendering fitted (what it did before). Only
  // the previously-broken off-type inputs change, and they fail to the
  // documented default — non-fitted, i.e. shrink-0 in the scroller.
  const fitted = p.fitted === true || p.fitted === 'true';
  // WAI-ARIA tabs pairing. One panel element exists (the spec supplies its
  // content as this element's children), so every tab points at that region and
  // the region is labelled by whichever tab is currently selected. The panel is
  // mounted in every state, so aria-controls here always resolves — the id only
  // has to be unique per INSTANCE (two repeat rows are two instances of one
  // spec id), which is what useAriaId gives.
  const tabsAriaId = useAriaId('tabs', element);
  const tabDomId = (value: string): string => tabsAriaId('tab', value);
  const panelId = tabsAriaId('panel');
  // A bound value that names no tab leaves the strip with no selected tab; the
  // roving tabindex then falls to the first tab so the strip stays reachable by
  // Tab, and the panel drops its (otherwise dangling) label reference.
  const activeIndex = tabs.findIndex((t) => t?.value === active);
  const rovingValue = activeIndex >= 0 ? active : tabs[0]?.value;
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const railRef = useRef<HTMLDivElement | null>(null);
  // Right-edge fade gated on real overflow (see use-scroll-edges).
  useScrollEdgesOn(railRef);
  useIsomorphicLayoutEffect(() => {
    const node = typeof active === 'string' ? tabRefs.current.get(active) : undefined;
    const rail = railRef.current;
    if (node == null || rail == null) return;
    // Scroll the RAIL, never scrollIntoView: that walks every ancestor
    // scrollport including the document, so a strip below the fold drags the
    // whole page to it on mount. Nothing moves unless the tab is actually
    // outside the rail's own scroll window.
    const left = node.offsetLeft;
    const right = left + node.offsetWidth;
    const viewLeft = rail.scrollLeft;
    const viewRight = viewLeft + rail.clientWidth;
    if (left < viewLeft) rail.scrollLeft = left;
    else if (right > viewRight) rail.scrollLeft = right - rail.clientWidth;
  }, [active]);
  const select = (tab: { label: string; value: string }): void => {
    setBound(tab.value);
    setLocal(tab.value);
    emitWith('change', { value: tab.value, label: tab.label ?? null });
  };
  const onTabKeyDown = (index: number) => (e: KeyboardEvent<HTMLButtonElement>): void => {
    const last = tabs.length - 1;
    if (last < 0) return;
    const to =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (to == null) return;
    // The strip owns these keys: unhandled they reach the embedding host and fire
    // its own shortcuts (and Home/End scroll the host document). A consumed key
    // must stop BOTH the default action and the walk up to the host's own
    // listeners — one ArrowRight is one intent, not two.
    e.preventDefault();
    e.stopPropagation();
    const next = tabs[to];
    if (next == null) return;
    select(next);
    tabRefs.current.get(next.value)?.focus();
  };
  return (
    <div
      // quiet defaults: the active underline tab defaults to neutral
      // high-contrast (foreground), matching NavigationMenu's neutral accent default;
      // a supplied `accent` still brands the underline + label via styleVars below.
      //
      // `--fr-tabs-ink` is the accent as SMALL TEXT: a brand colour that clears
      // 4.5:1 on the light surface can sit near 3:1 on the dark one, and CSS
      // cannot measure contrast, so the label is always carried 35% toward the
      // surface foreground — which tracks the theme, so the blend lightens on
      // dark and darkens on light. The neutral default blends the surface ink
      // with itself, i.e. it stays exactly the inherited ink.
      //
      // Both vars now say `currentColor` where they said `var(--color-foreground)`,
      // and "the SURFACE foreground" in the paragraph above is why: that claim was
      // only true at THEME level. A tablist paints no fill (underline/enclosed are
      // borders; only the pill TRACK has one), so inside an authored
      // `Card { bg:"#12161f", color:"#e2e6f0" }` the selected label mixed 65%
      // near-black with 35% near-black and measured 1.02 against the card. The
      // 2px indicator
      // read the same token and was equally invisible on that card; it resolves
      // through the tab's own `color` (which IS the ink), so the rule and its
      // label stay one colour. Nothing moves at the top level — frayme.css points
      // `.frayme-root { color }` and --color-foreground at the same --frayme-fg —
      // and a model-named `accent` still overrides --fr-tabs-accent via styleVars
      // below, keeping the 35%-toward-the-surface contrast guard for brand colours.
      //
      // `--fr-tabs-ink-fill` is the SAME blend against the token, and it exists
      // because the pill and enclosed selected tabs paint their own `bg-card`
      // slab. Card's authored `bg` sets --fr-card-bg, never --color-card, so that
      // slab stays LIGHT inside a dark card: pulling its accent label 35% toward
      // the card's near-white ink would wash a brand colour off a pale pill —
      // the inherited-ink bug pointing the other way. It is the current
      // --fr-tabs-ink definition verbatim, so that branch does not move at all.
      //
      // min-w-0: this wrapper is routinely a flex/grid item, whose automatic
      // minimum size is its min-content — the full un-scrolled width of the
      // rail. Frozen there, the rail's overflow-x scroller reports
      // clientWidth === scrollWidth, so the trailing tabs paint outside the
      // container with nothing to scroll and no clip. A block-level wrapper
      // already computes min-width:0, so this only speaks where it must.
      className="min-w-0 [--fr-tabs-accent:currentColor] [--fr-tabs-ink:color-mix(in_oklab,var(--fr-tabs-accent)_65%,currentColor)] [--fr-tabs-ink-fill:color-mix(in_oklab,var(--fr-tabs-accent)_65%,var(--color-foreground))]"
      style={styleVars(
        { var: '--fr-tabs-accent', value: p.accent, kind: 'color' },
        { var: '--fr-tabs-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-tabs-track', value: p.trackColor, kind: 'color' },
        { var: '--fr-tabs-rest-border', value: p.borderColor, kind: 'color' },
        // exact pill-track corner radius → --fr-tabs-radius (set on the wrapper,
        // cascades to the pill tablist) wins over the baked rounded-frayme fallback.
        { var: '--fr-tabs-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
    >
      <div
        className={cn(
          tablist({
            variant,
            align: (p.align as 'start' | 'center' | 'end' | 'stretch' | null) ?? undefined,
            fitted,
          }),
        )}
        role="tablist"
        ref={railRef}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={tabDomId(tab.value)}
            aria-selected={tab.value === active}
            aria-controls={panelId}
            // Roving tabindex: the strip is ONE tab stop; ArrowLeft/Right (and
            // Home/End) move within it.
            tabIndex={tab.value === rovingValue ? 0 : -1}
            ref={(node) => {
              if (node) tabRefs.current.set(tab.value, node);
              else tabRefs.current.delete(tab.value);
            }}
            className={cn(
              tabRecipe({ variant, size, fitted, selected: tab.value === active }),
              // Non-fitted tabs keep their natural width and the RAIL scrolls
              // (clipping a label mid-glyph is never the right answer). The
              // nowrap is EARNED here and only here: fr-tabscroll is a
              // horizontally scrolling rail, so a one-line tab overflows INTO
              // the scroller rather than being cut. Fitted tabs are flex-1 —
              // they can never reach that scroller, so a truncate on them was
              // pure deletion (4 tabs at 320px ⇒ 80px each ⇒ "Paym…"). Fitted
              // tabs wrap instead; flex items stretch, so the strip stays even.
              // The fitted tab keeps its AUTOMATIC minimum (min-content = its
              // longest word) — that is what makes "wrap instead" mean wrap at
              // a word boundary. A min-w-0 here let flex-1 shrink the button
              // under its own longest word and break-words then broke
              // mid-glyph: 4 tabs in a narrow rail spelled one character per
              // line. Below that floor the rail (overflow-x-auto) scrolls,
              // which is the same last resort the non-fitted branch takes.
              fitted ? 'break-words' : 'shrink-0 whitespace-nowrap',
              // `accent` = the active-tab colour on EVERY variant, read through
              // the same contrast-guarded ink blend as the underline label — but
              // the ON-FILL one: these two variants paint a `bg-card` slab under
              // the label (see the ink note on the wrapper), so the blend's other
              // 35% is the token that partners that fill, not the inherited ink.
              // The underline compoundVariant reads --fr-tabs-ink statically;
              // pill/enclosed bake a text-foreground selected state, so the reader
              // is appended CONDITIONALLY (only when the model named an accent)
              // and LAST so tw-merge dedupes the compound's text-foreground. The
              // wrapper always defines the var, so no in-var fallback is needed
              // here; unset accent → class absent → byte-identical defaults.
              p.accent != null &&
                tab.value === active &&
                (variant === 'pill' || variant === 'enclosed') &&
                'text-[color:var(--fr-tabs-ink-fill)]',
            )}
            onClick={() => select(tab)}
            onKeyDown={onTabKeyDown(index)}
          >
            {/* A leading icon (registry NAME → nothing on unknown) and/or a
                trailing count chip. When BOTH are absent the bare label renders alone. */}
            {(typeof tab.icon === 'string' && hasIcon(tab.icon)) || typeof tab.count === 'number' ? (
              // max-w-full caps this inline-flex at the button's content box —
              // without it the span sized to its content and escaped the
              // button, so a fitted tab's label reflowed outside its own box.
              <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
                {typeof tab.icon === 'string' && hasIcon(tab.icon) && (
                  <span className="shrink-0" aria-hidden>
                    <Icon name={tab.icon} size={14} />
                  </span>
                )}
                {/* icon + count are shrink-0, so the label is the only item that
                    can give — it wraps rather than losing its tail. On a
                    non-fitted tab the button's own nowrap still holds it to one
                    line and the rail scrolls (break-words cannot override it).
                    No min-w-0: the label is a text LEAF, so its automatic
                    minimum IS its longest word — the floor break-words must
                    never be allowed to break under. */}
                <span className="break-words" title={tab.label}>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className="shrink-0 rounded-full bg-[color:var(--fr-surface-sunken,var(--color-muted))] px-1.5 text-xs tabular-nums [color:var(--fr-tabs-muted,var(--color-muted-foreground))]">
                    {tab.count}
                  </span>
                )}
              </span>
            ) : (
              tab.label
            )}
          </button>
        ))}
      </div>
      {/* The panel CONTENT belongs to the spec (these are the Tabs element's own
          children, not per-tab slots the component owns), so there is one panel
          region for the whole strip rather than one per tab. */}
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={activeIndex >= 0 && typeof active === 'string' ? tabDomId(active) : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export function Accordion({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    items: Array<{ title: string; content: string }>;
    type?: 'single' | 'multiple' | null;
    defaultOpenIndex?: number | number[] | null;
    variant?: string | null;
    size?: string | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    borderColor?: string | null;
    accent?: string | null;
    mutedColor?: string | null;
    chevronIcon?: string | null;
    openIndexes?: number[] | null;
  };
  const variant = (p.variant as 'bordered' | 'separated' | 'ghost' | null) ?? 'bordered';
  // CONTENT glyph: an icon NAME resolved through the closed registry; unknown/absent
  // → the literal ▾ default (byte-identical for a props-less spec). Never raw markup.
  const chevron = typeof p.chevronIcon === 'string' && hasIcon(p.chevronIcon) ? p.chevronIcon : null;
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  // The caret glyph scales 14/16/18 with the size enum
  // so it stays proportional to the trigger text (was a fixed 16). md=16 is byte-identical
  // to the prior fixed size for a default/props-less Accordion. Only affects the registry
  // <Icon> caret (the ▾ literal fallback is a text glyph that already tracks font-size).
  const caretSize = ({ sm: 14, md: 16, lg: 18 } as const)[size ?? 'md'];
  // Array-backed expansion set: the hook stores a plain number[] (mirror in/out,
  // matching FloorPlan/NodeGraph) so spec.state can hold the whole resolved
  // expansion set for a bound Button/agent to read. Seed from `openIndexes` when
  // provided, else normalise the uncontrolled `defaultOpenIndex` to an array.
  const seedIndexes = (): number[] => {
    if (Array.isArray(p.openIndexes)) return p.openIndexes;
    const d = p.defaultOpenIndex;
    if (d == null) return [];
    return Array.isArray(d) ? d : [d];
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const [openArr, setOpenArr] = useBoundProp<number[]>(
    seedIndexes(),
    (bindings as { openIndexes?: unknown } | undefined)?.openIndexes,
  );
  // Derive a Set for the existing membership reads; never stored, always rebuilt.
  const open = new Set(Array.isArray(openArr) ? openArr : []);
  // Hoisted out of the items loop below: useAriaId is a hook, so it is called
  // once per render and the per-item parts ride the returned minter.
  const accAriaId = useAriaId('acc', element);
  const toggle = (i: number): void => {
    const next = new Set(open);
    if (next.has(i)) next.delete(i);
    else {
      if ((p.type ?? 'single') === 'single') next.clear();
      next.add(i);
    }
    // Write the FULL resolved index array (never a delta) so bound state always
    // holds the complete expansion set.
    const resolved = Array.from(next);
    // ALSO mirror the resolved expansion set into spec.state/_ui via the intrinsic
    // emit so the interaction is captured for the agent even when no prop is bound.
    emitWith('change', { openIndexes: resolved });
    setOpenArr(resolved);
  };
  return (
    <div
      className={cn(
        accordionWrap({
          variant,
          radius: (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
        }),
      )}
      style={styleVars(
        { var: '--fr-acc-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-acc-accent', value: p.accent, kind: 'color' },
        { var: '--fr-acc-muted', value: p.mutedColor, kind: 'color' },
        // exact wrapper corner radius → --fr-acc-radius wins over the per-enum default.
        { var: '--fr-acc-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
    >
      {(p.items ?? []).map((item, i) => {
        const headerId = accAriaId('h', i);
        const regionId = accAriaId('r', i);
        const isOpen = open.has(i);
        return (
          <div key={i} className={cn(accordionItem({ variant }))}>
            <button
              type="button"
              id={headerId}
              className={cn(accordionTrigger({ size, open: isOpen }))}
              aria-expanded={isOpen}
              // The region below mounts ONLY while open, so a closed header
              // published an id that is not in the document — and an Accordion
              // usually rests with its items closed. A dangling IDREF is strictly
              // WORSE than no reference: a reader who follows it lands nowhere,
              // whereas aria-controls is only RECOMMENDED for a disclosure, so
              // omitting it while there is nothing to name costs nothing.
              // `aria-expanded` stays in BOTH states — the header is a disclosure
              // either way. Same fix as Toggletip, ai-flow and the
              // inputs-longtail pickers.
              aria-controls={isOpen ? regionId : undefined}
              onClick={() => toggle(i)}
            >
              {/* The header title is the ONLY way to know what the panel holds,
                  so it wraps. The caret is shrink-0, the row is not nowrap, and
                  the trigger has no fixed height — nothing here needs one line.
                  text-left because a <button> centres its text by default, and a
                  wrapped last line would otherwise sit centred under a
                  left-aligned first line. No min-w-0: a text LEAF's automatic
                  minimum is its longest word, and letting the row shrink past
                  it turned break-words into a mid-word break. */}
              <span className="break-words text-left" title={item.title}>{item.title}</span>
              <span className={cn(caret({ open: isOpen }), 'shrink-0')} aria-hidden>
                {chevron ? <Icon name={chevron} size={caretSize} /> : '▾'}
              </span>
            </button>
            {isOpen && (
              <div id={regionId} role="region" aria-labelledby={headerId} className={cn(accordionBody({ size }))}>
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Collapsible({ element, children, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title: string;
    defaultOpen?: boolean | null;
    open?: boolean | null;
    variant?: string | null;
    size?: string | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    iconPosition?: string | null;
    borderColor?: string | null;
    accent?: string | null;
    chevronIcon?: string | null;
  };
  // CONTENT glyph: registry NAME → our SVG; unknown/absent → the literal ▾ default.
  const chevron = typeof p.chevronIcon === 'string' && hasIcon(p.chevronIcon) ? p.chevronIcon : null;
  const emitWith = useIntrinsicEmit(emit, element);
  const [bound, setBound] = useBoundProp<boolean>(p.open ?? undefined, bindings?.open);
  const [local, setLocal] = useState(p.defaultOpen ?? false);
  const open = bound ?? local;
  const iconPosition = (p.iconPosition as 'start' | 'end' | null) ?? 'end';
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  // The caret glyph scales 14/16/18 with size.
  // md=16 keeps a default/props-less Collapsible byte-identical.
  const caretSize = ({ sm: 14, md: 16, lg: 18 } as const)[size ?? 'md'];
  const toggle = (): void => {
    const next = !open;
    // ALSO mirror the resolved open flag into spec.state/_ui via the intrinsic emit
    // so the expand/collapse is captured for the agent even when no prop is bound.
    emitWith('change', { open: next });
    setBound(next);
    setLocal(next);
  };
  return (
    <div
      className={cn(
        collapsibleWrap({
          variant: (p.variant as 'bordered' | 'ghost' | null) ?? undefined,
          radius: (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
        }),
      )}
      style={styleVars(
        { var: '--fr-coll-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-coll-accent', value: p.accent, kind: 'color' },
        // exact box corner radius → --fr-coll-radius wins over the per-enum default.
        { var: '--fr-coll-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
    >
      <button
        type="button"
        className={cn(collapsibleTrigger({ size, iconPosition }))}
        aria-expanded={open}
        onClick={toggle}
      >
        {/* Same contract as the Accordion header: wraps, never clips (caret is
            shrink-0, trigger height is content-driven). text-left keeps a
            wrapped line from centring under the button's default text-align.
            No min-w-0 either — the title is a LEAF, so its longest word is the
            floor break-words breaks against, never below. */}
        <span className="break-words text-left" title={p.title}>{p.title}</span>
        <span className={cn(caret({ open, iconPosition }), 'shrink-0')} aria-hidden>
          {chevron ? <Icon name={chevron} size={caretSize} /> : '▾'}
        </span>
      </button>
      {open && <div className={cn(collapsibleBody({ size }))}>{children}</div>}
    </div>
  );
}

export function Carousel({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    // each item may carry an optional `image` (URL string, safeImageSrc-guarded)
    // or `icon` (registry NAME) media slot, in addition to {title, description}.
    items: Array<{ title?: string | null; description?: string | null; image?: string | null; icon?: string | null }>;
    gap?: string | null;
    align?: string | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    showControls?: boolean | null;
    // opt-in pagination dots (default false → byte-identical unset).
    showDots?: boolean | null;
    activeIndex?: number | null;
    cardBg?: string | null;
    borderColor?: string | null;
    itemWidth?: string | number | null;
    mutedColor?: string | null;
    weight?: string | null;
    fontSize?: string | number | null;
    prevLabel?: string | null;
    nextLabel?: string | null;
    prevIcon?: string | null;
    nextIcon?: string | null;
    // the semantic rank of each card `title` in the page outline.
    titleLevel?: string | number | null;
  };
  const items = Array.isArray(p.items) ? p.items : [];
  const showDots = p.showDots === true;
  const showControls = p.showControls === true;
  // Outline rank of a card title — authored, because only the spec knows what
  // sits above the carousel. Unset → h4 (the carousel's own level).
  // h3, following Card's h2 — a carousel slide title sits one level under the
  // card that frames it, and an h4 default would reintroduce the skip one level
  // further down.
  // h2, because that "card that frames it" is not measurably there. A Carousel
  // is a FRAME in its own right, like Card — it emits no title of its own, so an
  // item title is the FIRST heading under whatever precedes the strip. In practice
  // an item title follows a sibling item (they move together, no chain effect) or
  // the PageHeader h1 directly — h1→h3, a skip — and where it follows a section h2
  // this default flattens it to h2→h2 (legal, no skip). A carousel that genuinely
  // nests deeper sets `titleLevel`; that is what the prop is for.
  const ItemTitleTag = headingTag(p.titleLevel, 'h2');
  // dots: track which card is nearest the scroll start so the active dot follows
  // the user's scroll. Only wired when showDots (the listener + state are inert
  // otherwise). Kept deterministic: index = round(scrollLeft / itemStride).
  // Bindable: when `activeIndex` binds, the scrolled-to card mirrors into spec.state
  // so an external Button/agent can read it; unbound it falls back to local state.
  const [activeDot, setActiveDot] = useBoundProp<number>(p.activeIndex ?? 0, bindings?.activeIndex);
  const emitWith = useIntrinsicEmit(emit, element);
  const trackRef = useRef<HTMLDivElement | null>(null);
  // CONTENT labels default to the current English; CONTENT glyphs to the ‹/› literals.
  const prevLabel = typeof p.prevLabel === 'string' ? p.prevLabel : 'Previous';
  const nextLabel = typeof p.nextLabel === 'string' ? p.nextLabel : 'Next';
  const prevIcon = typeof p.prevIcon === 'string' && hasIcon(p.prevIcon) ? p.prevIcon : null;
  const nextIcon = typeof p.nextIcon === 'string' && hasIcon(p.nextIcon) ? p.nextIcon : null;
  const trackVars = styleVars(
    { var: '--fr-car-w', value: p.itemWidth, kind: 'dim', opts: { units: ['px', 'rem'], min: 120, max: 480 } },
    { var: '--fr-car-bg', value: p.cardBg, kind: 'color' },
    { var: '--fr-car-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-car-muted', value: p.mutedColor, kind: 'color' },
    // exact per-card corner radius → --fr-car-radius (set on the outer wrapper,
    // cascades to the cards) wins over each card's per-enum default var.
    { var: '--fr-car-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
    // exact per-card title font-size → --fr-car-fs (set on the outer wrapper,
    // cascades to each card title) wins over the baked 1.0625rem fallback. The
    // var rides the wrapper precisely so the SEMANTIC level (`titleLevel`) can
    // move without touching the type scale.
    { var: '--fr-car-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
  ) as CSSProperties;
  // On-surface ink for the things that paint the `--fr-car-bg` fill — the cards
  // and the arrow chips. A fill has to arrive with the ink it is partnered with;
  // these painted one and named no ink, so the title (which sets no colour of
  // its own) inherited whatever an authored ANCESTOR had chosen for ITS surface.
  // Measured on a shelf layout whose page Stack authors
  // bg:#150b10 / color:#f2e7ec:
  //
  //   DIV (Stack)   color #f2e7ec  bg #150b10        <- authored, correct
  //   DIV (card)    bg #ffffff  (--color-card)       <- its OWN surface
  //   H2  (title)   color #f2e7ec on #ffffff         <- 1.21:1, invisible
  //   BUTTON (‹ ›)  color #f2e7ec on #ffffff         <- 1.21:1, invisible
  //
  // Byte-identical unset: --color-card-foreground and the .frayme-root ink are
  // the same value in both modes (#18181b light, #fafafa dark), so a carousel on
  // the page's own surface keeps exactly the ink it inherited before.
  //
  // NOT applied when `cardBg` IS authored. The catalog gives the strip no
  // per-card text colour, so on an author's own fill the inherited ink is the
  // only source that can be right — pinning the token there would print #18181b
  // on a #12161f card (1.02:1) and turn a working card into an invisible one.
  // Keyed off the styleVars OUTPUT rather than the raw prop, because styleVars
  // drops an INVALID cardBg: the fill then falls back to the token, and the
  // pairing has to fall back with it.
  const onCardInk = '--fr-car-bg' in trackVars ? undefined : 'text-card-foreground';
  const radius = (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined;
  // Arrows and dots are only real controls while the track can actually scroll:
  // a viewport already showing every card gives them nothing to move. Measured
  // from the track's OWN box (the renderer never reads the viewport) after mount
  // and on every resize of that box.
  const [scrollState, setScrollState] = useState({ scrollable: true, atStart: true, atEnd: false });
  const syncScrollState = useCallback((el: HTMLElement): void => {
    // A zero client width is a track that has not been laid out (pre-hydration,
    // a hidden ancestor, a headless DOM) — not evidence that the cards fit.
    if (el.clientWidth === 0) return;
    const max = el.scrollWidth - el.clientWidth;
    const x = el.scrollLeft;
    // Sub-pixel track widths make an exact comparison flicker at both ends.
    const next = { scrollable: max > 1, atStart: x <= 1, atEnd: x >= max - 1 };
    setScrollState((prev) =>
      prev.scrollable === next.scrollable && prev.atStart === next.atStart && prev.atEnd === next.atEnd
        ? prev
        : next,
    );
  }, []);
  const controlsRequested = showControls || showDots;
  useEffect(() => {
    const el = trackRef.current;
    if (el == null || !controlsRequested) return;
    syncScrollState(el);
    if (typeof ResizeObserver === 'undefined') return;
    // The track's own box, not the window: the renderer is host-width agnostic,
    // and this same carousel can sit in a sidebar and a full-bleed row at once.
    const ro = new ResizeObserver(() => syncScrollState(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, [controlsRequested, syncScrollState, items.length]);
  const scrollBy = (dir: 1 | -1) => (): void => {
    const track = trackRef.current;
    if (track != null) track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: 'smooth' });
  };
  // dots: derive the active card from the track scroll offset (item stride =
  // scrollWidth / count). Only computed when showDots is on.
  const onTrackScroll = (e: UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget;
    // Arrow enablement follows the live offset, so this runs whenever either
    // control surface is on.
    syncScrollState(el);
    if (!showDots || items.length === 0) return;
    const stride = el.scrollWidth / items.length;
    const idx = stride > 0 ? Math.round(el.scrollLeft / stride) : 0;
    const resolved = Math.min(Math.max(idx, 0), items.length - 1);
    // Emit ONCE on the resolved snapped index (not per scroll pixel) so the agent
    // sees which card settled into view even when activeIndex is unbound.
    if (resolved !== activeDot) emitWith('page', { activeIndex: resolved });
    setActiveDot(resolved);
  };
  const scrollToDot = (i: number): void => {
    const el = trackRef.current;
    if (!el || items.length === 0) return;
    const stride = el.scrollWidth / items.length;
    // Emit on the discrete dot-click with the resolved target index.
    emitWith('page', { activeIndex: i });
    el.scrollTo({ left: stride * i, behavior: 'smooth' });
  };
  return (
    // The value-channel vars ride the OUTER wrapper (not the track) so they
    // cascade to the prev/next control buttons AND the track's cards — the
    // controls are siblings of the track and would never inherit track-scoped
    // vars. Unset channels are omitted by styleVars, so a props-less carousel
    // stays byte-identical.
    <div className="relative" style={trackVars}>
      {showControls && scrollState.scrollable && (
        <button
          type="button"
          aria-label={prevLabel}
          // h-9/w-9: the arrow is the smallest pointer target in the component,
          // so it carries a real 36px box rather than sitting exactly on the
          // 24px floor. `disabled` at the start of the scroll — an arrow that
          // cannot move the track must say so.
          className={cn(
            'absolute left-1 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border [border-color:var(--fr-car-border,var(--color-border))] [background:var(--fr-car-bg,var(--color-card))] shadow-sm disabled:cursor-default disabled:opacity-40',
            // the chip paints the same fill as a card, so it carries the same ink
            onCardInk,
            FOCUS_RING,
          )}
          disabled={scrollState.atStart}
          onClick={scrollBy(-1)}
        >
          {prevIcon ? <Icon name={prevIcon} size={16} /> : '‹'}
        </button>
      )}
      <div
        data-carousel-track
        ref={trackRef}
        onScroll={controlsRequested ? onTrackScroll : undefined}
        className={cn(
          carouselTrack({
            gap: (p.gap as 'sm' | 'md' | 'lg' | 'xl' | null) ?? undefined,
            align: (p.align as 'start' | 'center' | null) ?? undefined,
          }),
        )}
        // A named role="region" is a LANDMARK: every carousel on a page would
        // then compete with the page's real landmarks in that navigation list.
        // The cards are a labelled group, not a section of the document.
        role="group"
        aria-label="Carousel"
        // A rail that scrolls but cannot be FOCUSED is unreachable by keyboard —
        // its slides do not exist for that user. The label above says what it is;
        // this makes it possible to get there and arrow through it.
        tabIndex={0}
      >
        {items.map((item, i) => {
          // Media slot: a safeImageSrc-guarded image wins; else a registry icon;
          // else nothing (a text-only card). Never raw markup.
          const iconName = typeof item.icon === 'string' && hasIcon(item.icon) ? item.icon : null;
          const hasImage = typeof item.image === 'string' && item.image.length > 0;
          return (
            <div key={i} className={cn(carouselCard({ radius }), onCardInk)}>
              {hasImage ? (
                <SafeImage
                  src={item.image}
                  alt={item.title ?? ''}
                  className="mb-2 h-32 w-full rounded-[calc(var(--radius-frayme)/1.5)] object-cover"
                  fallback={
                    iconName ? (
                      <span className="mb-2 flex h-32 w-full items-center justify-center rounded-[calc(var(--radius-frayme)/1.5)] bg-[color:var(--fr-surface-sunken,var(--color-muted))] [color:var(--fr-car-muted,var(--color-muted-foreground))]" aria-hidden>
                        <Icon name={iconName} size={40} />
                      </span>
                    ) : null
                  }
                />
              ) : iconName != null ? (
                <span className="mb-2 flex h-32 w-full items-center justify-center rounded-[calc(var(--radius-frayme)/1.5)] bg-[color:var(--fr-surface-sunken,var(--color-muted))] [color:var(--fr-car-muted,var(--color-muted-foreground))]" aria-hidden>
                  <Icon name={iconName} size={40} />
                </span>
              ) : null}
              {item.title != null && (
                <ItemTitleTag
                  className={cn(
                    // fontSize single source: baked 1.0625rem is the var fallback
                    // (byte-identical when unset); an exact fontSize wins via --fr-car-fs.
                    // The card is a FIXED 14rem basis, so a truncate here clipped
                    // every title longer than ~20 characters at EVERY viewport —
                    // and the description below it already wraps freely, so the
                    // card never had a fixed height to protect. break-words.
                    'm-0 mb-1 break-words [font-size:var(--fr-car-fs,1.0625rem)] font-semibold',
                    // weight closed enum → static utility LAST so a set value dedupe-wins;
                    // unset → undefined → byte-identical (font-semibold stays the default).
                    weightClass(p.weight),
                  )}
                  title={item.title}
                >
                  {item.title}
                </ItemTitleTag>
              )}
              {item.description != null && (
                <p className="m-0 text-sm [color:var(--fr-car-muted,var(--color-muted-foreground))]">{item.description}</p>
              )}
            </div>
          );
        })}
      </div>
      {showControls && scrollState.scrollable && (
        <button
          type="button"
          aria-label={nextLabel}
          className={cn(
            'absolute right-1 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border [border-color:var(--fr-car-border,var(--color-border))] [background:var(--fr-car-bg,var(--color-card))] shadow-sm disabled:cursor-default disabled:opacity-40',
            // the chip paints the same fill as a card, so it carries the same ink
            onCardInk,
            FOCUS_RING,
          )}
          disabled={scrollState.atEnd}
          onClick={scrollBy(1)}
        >
          {nextIcon ? <Icon name={nextIcon} size={16} /> : '›'}
        </button>
      )}
      {/* opt-in pagination dots, one per card. Absent by default.
          These are PLAIN buttons, not a tablist: nothing here is a tab panel,
          and a pagination strip that claims the tab pattern owes a roving
          tabindex + aria-controls it cannot honour. `aria-current` carries the
          selected state instead.
          Each button is a >=24px transparent target around the 6px dot, and the
          hit boxes sit flush so the targets never overlap. */}
      {showDots && items.length > 0 && scrollState.scrollable && (
        <div className="mt-3 flex items-center justify-center" role="group" aria-label="Carousel pagination">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              aria-current={i === activeDot ? 'true' : undefined}
              aria-label={
                typeof item?.title === 'string' && item.title.length > 0
                  ? `Go to ${item.title}`
                  : `Go to item ${i + 1}`
              }
              className={cn('flex h-6 cursor-pointer items-center justify-center rounded-full px-[9px]', FOCUS_RING)}
              onClick={() => scrollToDot(i)}
            >
              <span
                aria-hidden
                className={cn(
                  'block h-1.5 rounded-full transition-all',
                  i === activeDot ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/40',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
