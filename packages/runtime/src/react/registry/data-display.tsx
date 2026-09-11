'use client';
import type { ReactNode } from 'react';
import { createElement, useState } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { SafeImage } from './_img.js';
import { fontClass, leadingClass, styleVars, trackingClass, weightClass } from './_style.js';
import { Icon, hasIcon } from './icons.js';
import { useLocalOrBound } from './_state.js';

/* Catalog group: Table, Heading, Text, Image, Avatar, Badge, Alert, Progress, Skeleton, Spinner
 *
 * VALUE channels (colors / dimensions the model names directly) NEVER become
 * classes — they land in `--fr-<component>-<role>` CSS vars via `styleVars(...)`,
 * read by a STATIC arbitrary utility in the recipe. The class set stays a closed,
 * build-time set (no runtime JIT, no injection); only the var's VALUE is
 * model-supplied.
 *
 * Precedence for components that have BOTH a tone/variant enum (which sets a color
 * class) AND a color value channel (Badge/Alert/Progress/Avatar/Spinner/Table/
 * Heading/Text): `safeColor value > tone (enum) > variant/type (enum) > token
 * default`. Implemented with a CONDITIONAL override class — the arbitrary
 * `[color:var(--fr-x)]` utility is only added to `cn()` when the model actually
 * supplied that value (`p.color != null`). When absent, the override class is
 * omitted so tailwind-merge keeps the tone/variant class; when present, the
 * override is added LAST so tailwind-merge keeps the var. `styleVars` only sets
 * the var when the value is valid, so an unsafe value silently falls back too. */

/* ── CVA recipes ──────────────────────────────────────────────────────────── */

/* Table — the divider color + header text color route through vars; every
   border uses `--fr-tbl-accent` (default border token) so a model-supplied
   `accent` recolors all dividers at once. */
const tableScroll = cva('w-full', {
  variants: {
    stickyHeader: { true: 'max-h-[28rem] overflow-y-auto', false: 'overflow-x-auto' },
  },
  defaultVariants: { stickyHeader: false },
});
const tableBase = cva(
  'w-full border-collapse [--fr-tbl-accent:var(--color-border)]',
  {
    variants: {
      size: { sm: 'text-[0.8125rem]', md: 'text-sm', lg: 'text-base' },
    },
    defaultVariants: { size: 'md' },
  },
);
const tableCaption = 'caption-bottom pt-2 text-[0.8125rem] [color:var(--fr-tbl-muted,var(--color-muted-foreground))]';

/* SHATTERED TEXT (320px) — the per-cell width floor, shared by th and td.
 *
 * Auto table layout gives a squeezed table each column its MIN-CONTENT width, and
 * min-content is the longest unbreakable run. `break-words` is
 * `overflow-wrap:break-word`, which deliberately does NOT lower min-content — so
 * for Latin text a column stays as wide as its longest word and the wrapper's
 * overflow-x-auto takes the strain, which is why Latin tables measure clean.
 * Text that breaks between EVERY character has no such floor. Measured at a 320px
 * viewport, spec = padded root › Card › Table(size:sm, density:compact), a
 * Japanese column: the cell rendered 33px wide × 341px tall — 21.8 lines, one
 * glyph per line — while the scroll wrapper it lives in sat at 214px client /
 * 217px scroll, i.e. it never scrolled, because the table had obligingly
 * collapsed to fit. CJK is the clearest case; a cell of 2-3 character tokens
 * reaches the same place.
 *
 * 5ch restores the floor min-content stopped providing. Being in ch it tracks the
 * size step (~36/39/44px content for sm/md/lg), and with the cell padding on top
 * every step clears the 3×font-size shattered-text threshold by ~1.5×. Where a column's
 * longest word already exceeds 5ch — nearly every Latin column — min-width is
 * inert, so the common table is byte-identical. Where it bites, the table's
 * min-content grows past the container and the wrapper does the job it was
 * already built for: scrolls, rather than crushing the column to a glyph. */
const tableCellFloor = 'min-w-[5ch]';

const tableHead = cva(
  `${tableCellFloor} border-b border-[var(--fr-tbl-accent)] font-medium [color:var(--fr-tbl-head,var(--color-muted-foreground))]`,
  {
    variants: {
      size: { sm: 'px-2.5 py-1.5', md: 'px-3 py-2.5', lg: 'px-4 py-3' },
      density: { comfortable: '', compact: 'py-1' },
      align: { left: 'text-left', center: 'text-center', right: 'text-right' },
      // The sticky band's fill routes through a var (card-token fallback) so a
      // custom-surfaced container/theme can repaint it (--fr-tbl-head-bg is a
      // theming hook with no schema channel).
      stickyHeader: { true: 'sticky top-0 z-10 [background:var(--fr-tbl-head-bg,var(--color-card))]', false: '' },
    },
    defaultVariants: { size: 'md', density: 'comfortable', align: 'left', stickyHeader: false },
  },
);
const tableCell = cva(tableCellFloor, {
  variants: {
    size: { sm: 'px-2.5 py-1.5', md: 'px-3 py-2.5', lg: 'px-4 py-3' },
    density: { comfortable: '', compact: 'py-1' },
    align: { left: 'text-left', center: 'text-center', right: 'text-right' },
    bordered: {
      none: '',
      rows: 'border-b border-[var(--fr-tbl-accent)]',
      grid: 'border border-[var(--fr-tbl-accent)]',
    },
  },
  defaultVariants: { size: 'md', density: 'comfortable', align: 'left', bordered: 'rows' },
});
// Zebra stripes + hover wash route through --fr-tbl-row-accent (muted-token
// fallback; the /40 tint is preserved via color-mix) — the same theming-hook
// pattern as --fr-tbl-head-bg, so row sub-surfaces are repaintable as one role.
const tableRow = cva('', {
  variants: {
    striped: { true: 'odd:[background:color-mix(in_srgb,var(--fr-tbl-row-accent,var(--color-muted))_40%,transparent)]', false: '' },
    hover: { true: 'hover:[background:var(--fr-tbl-row-accent,var(--color-muted))]', false: '' },
  },
  defaultVariants: { striped: false, hover: true },
});

// `tracking-normal` moves into the BASE (was a bespoke 3-value cva variant) so the
// renderer can apply the SHARED 5-step Tracking atom (tighter…wider) via trackingClass in
// cn() LAST — a set value dedupe-wins the base `tracking-normal`, unset keeps it
// (byte-identical). The clamp variant mirrors Text's line-clamp (count channel).
const heading = cva('m-0 leading-tight tracking-normal [font-size:var(--fr-heading-fs,var(--fr-heading-fs-default,1rem))] [color:var(--fr-heading-fg,var(--fr-heading-default,inherit))]', {
  variants: {
    // Visual size — DECOUPLED from the semantic `level` tag. When `size` is
    // omitted the renderer maps it from `level` so the default look is preserved.
    // Each step sets the DEFAULT font-size var (not a text-* utility, which
    // tailwind-merge would NOT dedupe against the base's arbitrary font-size
    // class) so an exact `fontSize` wins via the var chain while the enum stays
    // byte-identical. Line-height is unchanged: the base `leading-tight` already
    // owns line-height (it wins over text-*'s bundled value in the current
    // build), so dropping text-* leaves line-height identical. Sizes reproduce:
    // text-sm=0.875rem · text-base=1rem · then the prior arbitrary rem values.
    size: {
      xs: '[--fr-heading-fs-default:0.875rem]',
      sm: '[--fr-heading-fs-default:1rem]',
      md: '[--fr-heading-fs-default:1.125rem]',
      lg: '[--fr-heading-fs-default:1.375rem]',
      xl: '[--fr-heading-fs-default:1.75rem]',
      '2xl': '[--fr-heading-fs-default:2.25rem]',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    align: { left: 'text-left', center: 'text-center', right: 'text-right' },
    tone: {
      default: '',
      muted: '[--fr-heading-default:var(--color-muted-foreground)]',
      success: '[--fr-heading-default:var(--color-success)]',
      warning: '[--fr-heading-default:var(--color-warning)]',
      critical: '[--fr-heading-default:var(--color-danger)]',
      info: '[--fr-heading-default:var(--color-info)]',
    },
    // KEPT: this is the AUTHORED single-line contract — a schema channel the spec
    // has to switch on by name, defaulting off, with `clamp` next to it as the
    // multi-line alternative and `title` carrying the full string. Nothing bakes
    // it into a component the author didn't ask for.
    truncate: { true: 'truncate', false: '' },
    // multi-line clamp (count channel via --fr-heading-clamp), mirroring Text.clamp.
    clamp: { true: 'overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:var(--fr-heading-clamp)]' },
  },
  defaultVariants: { weight: 'semibold', truncate: false },
});

// The text colour is driven ENTIRELY by the --fr-text-fg → --fr-text-default →
// inherit var chain so a model-named `color` always wins; variants/tones set the
// DEFAULT token via --fr-text-default (never a `text-*` utility, which tw-merge
// would not let the arbitrary colour override beat).
// Font size flows through a single base declaration with a two-tier default
// chain: exact `fontSize` (--fr-text-fs) > the `size` enum (--fr-text-fs-sz) >
// the `variant` preset (--fr-text-fs-var) > inherit. Neither the size nor the
// variant emits a text-* utility for font-size (tailwind-merge would NOT dedupe
// it against the base's arbitrary font-size class, and stacking two var-setters
// would make stylesheet order — not cva order — decide size-vs-variant). The
// two-tier chain keeps `size` winning over `variant` regardless of order, and an
// exact `fontSize` winning over both, while the defaults stay byte-identical.
// Because named text-* utilities also bundle a line-height, each `size` step now
// carries an explicit leading-* matching the prior bundled value (the arbitrary
// caption/lead/code presets carried no line-height, so they need none).
const text = cva('m-0 [font-size:var(--fr-text-fs,var(--fr-text-fs-sz,var(--fr-text-fs-var,inherit)))] [color:var(--fr-text-fg,var(--fr-text-default,inherit))]', {
  variants: {
    variant: {
      body: '',
      caption: '[--fr-text-fs-var:0.8125rem] [--fr-text-default:var(--color-muted-foreground)]',
      muted: '[--fr-text-default:var(--color-muted-foreground)]',
      lead: '[--fr-text-fs-var:1.125rem]',
      code: 'font-mono [--fr-text-fs-var:0.85em] bg-[color:var(--fr-surface-sunken,var(--color-muted))] px-1.5 py-0.5 rounded-[calc(var(--radius-frayme)/2)]',
    },
    size: {
      xs: '[--fr-text-fs-sz:0.75rem] leading-[calc(1/0.75)]',
      sm: '[--fr-text-fs-sz:0.875rem] leading-[calc(1.25/0.875)]',
      md: '[--fr-text-fs-sz:1rem] leading-[calc(1.5/1)]',
      lg: '[--fr-text-fs-sz:1.125rem] leading-[calc(1.75/1.125)]',
      xl: '[--fr-text-fs-sz:1.25rem] leading-[calc(1.75/1.25)]',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
      justify: 'text-justify',
    },
    tone: {
      default: '',
      muted: '[--fr-text-default:var(--color-muted-foreground)]',
      success: '[--fr-text-default:var(--color-success)]',
      warning: '[--fr-text-default:var(--color-warning)]',
      critical: '[--fr-text-default:var(--color-danger)]',
      info: '[--fr-text-default:var(--color-info)]',
    },
    italic: { true: 'italic', false: '' },
    // KEPT for the same reason as Heading.truncate: an opt-in schema channel,
    // off by default, paired with `clamp` and a title fallback.
    truncate: { true: 'truncate', false: '' },
    mono: { true: 'font-mono', false: '' },
    clamp: { true: 'overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:var(--fr-text-clamp)]' },
  },
  defaultVariants: { variant: 'body' },
});

const image = cva(
  'block max-w-full object-[var(--fr-img-pos)] [border-radius:var(--fr-img-radius,var(--fr-img-radius-default,var(--radius-frayme)))] [border-color:var(--fr-img-border,var(--color-border))] [width:var(--fr-img-w,auto)] [height:var(--fr-img-h,auto)]',
  {
    variants: {
      aspect: {
        auto: '',
        '1/1': 'aspect-square',
        '4/3': 'aspect-[4/3]',
        '16/9': 'aspect-video',
        '3/2': 'aspect-[3/2]',
        '21/9': 'aspect-[21/9]',
        '3/4': 'aspect-[3/4]',
      },
      fit: { cover: 'object-cover', contain: 'object-contain', fill: 'object-fill', none: 'object-none' },
      position: {
        center: '[--fr-img-pos:center]',
        top: '[--fr-img-pos:top]',
        bottom: '[--fr-img-pos:bottom]',
        left: '[--fr-img-pos:left]',
        right: '[--fr-img-pos:right]',
      },
      radius: {
        none: '[--fr-img-radius-default:0px]',
        sm: '[--fr-img-radius-default:0.25rem]',
        md: '[--fr-img-radius-default:var(--radius-frayme)]',
        lg: '[--fr-img-radius-default:1rem]',
        full: '[--fr-img-radius-default:9999px]',
      },
      border: { true: 'border-solid [border-width:var(--fr-img-bw,1px)]', false: '' },
      shadow: { none: '', sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg' },
    },
    defaultVariants: { aspect: 'auto', fit: 'cover', position: 'center', radius: 'md', border: false, shadow: 'none' },
  },
);
const imagePlaceholder = cva(
  // Height defaults to `auto` (same as the <img>) so an `aspect`/`width` spec's
  // placeholder is sized by the aspect-* class and matches the loaded image's box;
  // `aspect:auto` (no ratio) keeps a 120px reserve so an unsized image still shows.
  //
  // The label is muted-foreground on this recipe's OWN `bg-muted`, and it is the
  // alt text of an image that failed to load — the only description of the
  // missing picture a sighted reader gets, at 13px (nowhere near the large-text
  // 3:1 exemption). That pair was an a11y finding here: 4.40:1 while
  // --frayme-muted-fg was #71717a. It is carried by the TOKEN (now #52525b →
  // 7.03:1 light, 5.88:1 dark), not by a local override — see the same note on
  // ColumnHeader in data-table.tsx for the local color-mix that was measured and
  // rejected, and test/table-a11y.test.tsx for the guard that re-measures it.
  'flex items-center justify-center bg-muted text-[0.8125rem] [color:var(--fr-img-muted,var(--color-muted-foreground))] [border-radius:var(--fr-img-radius,var(--fr-img-radius-default,var(--radius-frayme)))] [border-color:var(--fr-img-border,var(--color-border))] [width:var(--fr-img-w,auto)] max-w-full [height:var(--fr-img-h,auto)]',
  {
    variants: {
      aspect: {
        auto: 'min-h-[120px]',
        '1/1': 'aspect-square',
        '4/3': 'aspect-[4/3]',
        '16/9': 'aspect-video',
        '3/2': 'aspect-[3/2]',
        '21/9': 'aspect-[21/9]',
        '3/4': 'aspect-[3/4]',
      },
      radius: {
        none: '[--fr-img-radius-default:0px]',
        sm: '[--fr-img-radius-default:0.25rem]',
        md: '[--fr-img-radius-default:var(--radius-frayme)]',
        lg: '[--fr-img-radius-default:1rem]',
        full: '[--fr-img-radius-default:9999px]',
      },
      border: { true: 'border-solid [border-width:var(--fr-img-bw,1px)]', false: '' },
      shadow: { none: '', sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg' },
    },
    defaultVariants: { aspect: 'auto', radius: 'md', border: false, shadow: 'none' },
  },
);

const avatar = cva(
  // Box width/height read the exact-override var (--fr-avatar-size) then the
  // per-enum default var (--fr-avatar-size-default, set by the size variant),
  // then md=2.5rem. The size enum no longer emits h-*/w-* utilities (which
  // tailwind-merge would NOT dedupe against the arbitrary width/height classes),
  // so there is exactly one width + one height declaration; the initials
  // font-size (text-*) STAYS on the enum (sizeValue only drives the box).
  // `shrink-0` is what makes the declared width a REAL width: a face is a square
  // whose radius + object-fit crop it, so a flex row squeezing the box would crop
  // the portrait horizontally rather than scale it.
  // `--fr-avatar-fg` KEEPS its --color-foreground fallback (it did NOT join the
  // inherited-ink fix applied to TONE_TINT / the outline badge below): the initials
  // sit on the avatar's OWN fill, [background:var(--fr-avatar-bg,var(--color-muted))],
  // which is opaque and stays light inside an authored dark Card — Card's `bg` sets
  // --fr-card-bg, not --color-muted. Inheriting a dark card's light ink here would
  // put near-white initials on a near-white disc: a regression, not a fix.
  'inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold [width:var(--fr-avatar-size,var(--fr-avatar-size-default,2.5rem))] max-w-full [height:var(--fr-avatar-size,var(--fr-avatar-size-default,2.5rem))] [background:var(--fr-avatar-bg,var(--fr-surface-sunken,var(--color-muted)))] [color:var(--fr-avatar-fg,var(--fr-surface-fg,var(--color-foreground)))]',
  {
    variants: {
      // Box sizes set the default var (h-6/w-6=1.5rem · h-7=1.75rem ·
      // h-10=2.5rem · h-14=3.5rem · h-20=5rem); the text-* keeps the initials
      // font-size on the enum.
      size: {
        xs: '[--fr-avatar-size-default:1.5rem] text-[0.625rem]',
        sm: '[--fr-avatar-size-default:1.75rem] text-[0.6875rem]',
        md: '[--fr-avatar-size-default:2.5rem] text-sm',
        lg: '[--fr-avatar-size-default:3.5rem] text-[1.125rem]',
        xl: '[--fr-avatar-size-default:5rem] text-2xl',
      },
      shape: { circle: 'rounded-full', rounded: 'rounded-frayme', square: 'rounded-none' },
      // A status ring; the ring color defaults to the token for the chosen
      // status and is overridable by the `ringColor` value channel. The ring
      // OFFSET colour follows the surface token (shadcn's ring-offset-background
      // pattern) instead of the Tailwind white default, so the halo disappears
      // into the card on dark/tinted surfaces; --fr-avatar-ring-offset is the
      // future-channel hook (unfed for now → the card token).
      ring: {
        none: '',
        default:
          'ring-2 ring-offset-2 [--tw-ring-color:var(--fr-avatar-ring,var(--color-border))] [--tw-ring-offset-color:var(--fr-avatar-ring-offset,var(--color-card))]',
        success:
          'ring-2 ring-offset-2 [--tw-ring-color:var(--fr-avatar-ring,var(--color-success))] [--tw-ring-offset-color:var(--fr-avatar-ring-offset,var(--color-card))]',
        warning:
          'ring-2 ring-offset-2 [--tw-ring-color:var(--fr-avatar-ring,var(--color-warning))] [--tw-ring-offset-color:var(--fr-avatar-ring-offset,var(--color-card))]',
        critical:
          'ring-2 ring-offset-2 [--tw-ring-color:var(--fr-avatar-ring,var(--color-danger))] [--tw-ring-offset-color:var(--fr-avatar-ring-offset,var(--color-card))]',
        info:
          'ring-2 ring-offset-2 [--tw-ring-color:var(--fr-avatar-ring,var(--color-info))] [--tw-ring-offset-color:var(--fr-avatar-ring-offset,var(--color-card))]',
      },
      // The border colour reads `--fr-avatar-border` so a model-supplied
      // `borderColor` tints the edge; the token is the baked-in fallback.
      border: { true: 'border [border-color:var(--fr-avatar-border,var(--color-border))]', false: '' },
    },
    defaultVariants: { size: 'md', shape: 'circle', ring: 'none', border: false },
  },
);

/* Status pills are tinted, not saturated: a semantic tone paints a 12% wash of its
 * token and keeps the label in the token colour, matching Alert's subtle surfaces
 * rather than the old solid slab. Rows repeat these dozens of times, so a solid fill
 * reads as an alarm on every line. The label mixes 20% of the INHERITED ink into the
 * token to buy contrast on the wash — that self-corrects per surface, since the ink
 * is near-black on a light one (deepens the hue) and near-white on a dark one
 * (lifts it). `variant:"default"` stays solid as the deliberate loud-chip escape
 * hatch.
 *
 * That 20% used to be --color-foreground, and the "self-corrects per theme" claim
 * was only true at THEME level. The wash is mixed over `transparent`, so the pill's
 * real background is whatever contains it: inside a spec's `Card { bg:"#12161f",
 * color:"#e2e6f0" }` the surface went dark while the token stayed near-black and
 * pushed the label the WRONG way — a near-1:1 contrast ratio. currentColor is
 * the same value at the top level (.frayme-root
 * sets `color: var(--frayme-fg)` and --color-foreground IS var(--frayme-fg)), so
 * every props-less pill is byte-identical; the correction now follows the surface
 * the pill is actually sitting on. NOTE: board-nav.tsx carries a copy of this table
 * (KanbanCard) that needs the same change. */
const TONE_TINT = {
  success:
    'bg-[color-mix(in_srgb,var(--frayme-success)_12%,transparent)] text-[color:color-mix(in_srgb,var(--frayme-success)_80%,currentColor)]',
  warning:
    'bg-[color-mix(in_srgb,var(--frayme-warning)_12%,transparent)] text-[color:color-mix(in_srgb,var(--frayme-warning)_80%,currentColor)]',
  critical:
    'bg-[color-mix(in_srgb,var(--frayme-danger)_12%,transparent)] text-[color:color-mix(in_srgb,var(--frayme-danger)_80%,currentColor)]',
  info: 'bg-[color-mix(in_srgb,var(--frayme-info)_12%,transparent)] text-[color:color-mix(in_srgb,var(--frayme-info)_80%,currentColor)]',
} as const;

// fontSize two-step var chain: each size step sets --fr-badge-fs-default (folding the
// old text-[0.6875rem]/text-xs/text-sm, with text-xs/text-sm's paired line-height
// ratio preserved) and the base reads the exact --fr-badge-fs first — so a model-named
// fontSize wins over the enum and the unset path is byte-identical. NEVER co-locate
// the var class with a text-* class.
const badge = cva(
  'inline-flex items-center gap-1.5 font-medium [font-size:var(--fr-badge-fs,var(--fr-badge-fs-default,0.75rem))]',
  {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      // `secondary` / `neutral` KEEP text-foreground: they paint bg-muted, which
      // Card's authored `bg` does not re-point (it sets --fr-card-bg, never
      // --color-muted), so the chip stays a light slab and needs the dark token.
      secondary: 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-[color:var(--fr-surface-fg,var(--color-foreground))]',
      destructive: TONE_TINT.critical,
      // `outline` is bg-TRANSPARENT — its surface is the container's, so its label
      // inherits (`text-current`) instead of resetting to the global token. Inside
      // a spec's dark authored Card, text-[color:var(--fr-surface-fg,var(--color-foreground))] made this chip near-black on
      // near-black; the computed default is unchanged (see TONE_TINT's note).
      outline: 'border border-border bg-transparent text-current',
    },
    tone: {
      neutral: 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-[color:var(--fr-surface-fg,var(--color-foreground))]',
      success: TONE_TINT.success,
      warning: TONE_TINT.warning,
      critical: TONE_TINT.critical,
      info: TONE_TINT.info,
    },
    size: {
      sm: 'px-2 py-0.5 [--fr-badge-fs-default:0.6875rem]',
      md: 'px-2.5 py-0.5 [--fr-badge-fs-default:0.75rem] leading-[calc(1/0.75)]',
      lg: 'px-3 py-1 [--fr-badge-fs-default:0.875rem] leading-[calc(1.25/0.875)]',
    },
    shape: { pill: 'rounded-full', rounded: 'rounded-frayme', square: 'rounded-none' },
    uppercase: { true: 'uppercase tracking-wide', false: '' },
  },
  defaultVariants: { variant: 'default', size: 'md', shape: 'pill', uppercase: false },
  },
);

/* Coherence group "status accent": each SEMANTIC type/tone step also sets the
 * DEFAULT accent var (--fr-alert-accent-default) to its token, so the status icon
 * + the accentBar tint with the semantic colour by default (shadcn/Radix/Ant
 * behaviour); an explicit `accent` value still wins via --fr-alert-accent. The
 * neutral `type:info` surface sets NO default (a props-less alert stays
 * byte-identical: icon inherits, bar falls to the foreground token). `solid`
 * resets the default to currentColor so the icon/bar stay readable ON the
 * saturated solid fill instead of vanishing tone-on-tone. */
const alert = cva('flex flex-col gap-0.5 rounded-frayme border', {
  variants: {
    type: {
      info: 'border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
      success:
        'border-[color-mix(in_srgb,var(--frayme-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--frayme-success)_8%,transparent)] [--fr-alert-accent-default:var(--color-success)]',
      warning:
        'border-[color-mix(in_srgb,var(--frayme-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--frayme-warning)_8%,transparent)] [--fr-alert-accent-default:var(--color-warning)]',
      error:
        'border-[color-mix(in_srgb,var(--frayme-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--frayme-danger)_8%,transparent)] [--fr-alert-accent-default:var(--color-danger)]',
    },
    tone: {
      success:
        'border-[color-mix(in_srgb,var(--frayme-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--frayme-success)_8%,transparent)] [--fr-alert-accent-default:var(--color-success)]',
      warning:
        'border-[color-mix(in_srgb,var(--frayme-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--frayme-warning)_8%,transparent)] [--fr-alert-accent-default:var(--color-warning)]',
      critical:
        'border-[color-mix(in_srgb,var(--frayme-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--frayme-danger)_8%,transparent)] [--fr-alert-accent-default:var(--color-danger)]',
      info:
        'border-[color-mix(in_srgb,var(--frayme-info)_35%,transparent)] bg-[color-mix(in_srgb,var(--frayme-info)_8%,transparent)] [--fr-alert-accent-default:var(--color-info)]',
    },
    variant: {
      subtle: '',
      solid: 'text-card [&_*]:text-card [--fr-alert-accent-default:currentColor]',
      outline: 'bg-transparent',
    },
    size: { sm: 'px-3 py-2.5 text-sm', md: 'px-4 py-3.5', lg: 'px-5 py-4 text-[0.9375rem]' },
    align: { left: 'text-left', center: 'items-center text-center' },
    accentBar: {
      true: 'border-l-[3px] [border-left-color:var(--fr-alert-accent,var(--fr-alert-accent-default,var(--color-foreground)))]',
      false: '',
    },
  },
  // solid flips the tinted tone/type fill to a high-contrast solid surface.
  compoundVariants: [
    { variant: 'solid', type: 'info', class: 'bg-foreground border-foreground' },
    { variant: 'solid', type: 'success', class: 'bg-success border-success' },
    { variant: 'solid', type: 'warning', class: 'bg-warning border-warning' },
    { variant: 'solid', type: 'error', class: 'bg-danger border-danger' },
    { variant: 'solid', tone: 'success', class: 'bg-success border-success' },
    { variant: 'solid', tone: 'warning', class: 'bg-warning border-warning' },
    { variant: 'solid', tone: 'critical', class: 'bg-danger border-danger' },
    { variant: 'solid', tone: 'info', class: 'bg-info border-info' },
  ],
  defaultVariants: { type: 'info', variant: 'subtle', size: 'md', align: 'left', accentBar: false },
});

const field = 'flex flex-col gap-1.5';
const label = 'flex items-center justify-between text-sm font-medium';
const progressTrack = cva(
  // Track height reads the exact-override var (--fr-progress-h) then the
  // per-enum default var (set by the size variant), then sm=0.5rem. The size
  // enum no longer emits an h-* utility (tailwind-merge would NOT dedupe it
  // against the arbitrary height class), so there is one height declaration; the
  // inner bar is h-full and follows. Steps: h-1=0.25rem · h-2=0.5rem ·
  // h-3=0.75rem · h-4=1rem.
  'overflow-hidden [height:var(--fr-progress-h,var(--fr-progress-h-default,0.5rem))] [background:var(--fr-progress-track,var(--fr-surface-sunken,var(--color-muted)))]',
  {
    variants: {
      size: {
        xs: '[--fr-progress-h-default:0.25rem]',
        sm: '[--fr-progress-h-default:0.5rem]',
        md: '[--fr-progress-h-default:0.75rem]',
        lg: '[--fr-progress-h-default:1rem]',
      },
      shape: { pill: 'rounded-full', square: 'rounded-none' },
    },
    defaultVariants: { size: 'sm', shape: 'pill' },
  },
);
const progressBar = cva(
  'h-full rounded-[inherit] transition-[width] duration-200 [background:var(--fr-progress-bar,var(--color-primary))]',
  {
    variants: {
      tone: {
        default: '',
        success: '[--fr-progress-bar:var(--color-success)]',
        warning: '[--fr-progress-bar:var(--color-warning)]',
        critical: '[--fr-progress-bar:var(--color-danger)]',
        info: '[--fr-progress-bar:var(--color-info)]',
      },
      // The stripe scrim sits OVER the (model-settable) bar fill, so it is a
      // settable `overlayColor` channel — the original translucent white is the
      // var fallback, so an unset value renders byte-identically.
      striped: {
        true: 'bg-[length:1rem_1rem] [background-image:linear-gradient(45deg,var(--fr-progress-scrim,rgba(255,255,255,0.2))_25%,transparent_25%,transparent_50%,var(--fr-progress-scrim,rgba(255,255,255,0.2))_50%,var(--fr-progress-scrim,rgba(255,255,255,0.2))_75%,transparent_75%,transparent)]',
        false: '',
      },
      animated: { true: 'animate-pulse', false: '' },
      indeterminate: { true: 'w-2/5 animate-[fr-indet_1.2s_ease-in-out_infinite]', false: '' },
    },
    defaultVariants: { tone: 'default', striped: false, animated: false, indeterminate: false },
  },
);

const skeleton = cva('[background:var(--color-muted)]', {
  variants: {
    shape: {
      // line/rect take their rounding from the --fr-skel-radius var-chain appended
      // in the renderer (default --radius-frayme === the prior rounded-frayme), so
      // an exact radiusValue / radius enum wins via the var; circle/pill stay round.
      line: '',
      rect: '',
      circle: 'rounded-full',
      pill: 'rounded-full',
    },
    // The radius enum sets the DEFAULT radius var (not a rounded-* utility, which
    // tailwind-merge would NOT dedupe against the arbitrary border-radius class),
    // so an exact radiusValue wins via the var while the enum stays byte-identical.
    // Steps reproduce: none=0 · sm=0.25rem · md=var(--radius-frayme) · lg=1rem ·
    // full=9999px. Applied (with the base var-chain) ONLY on the line/rect/default
    // path; circle/pill keep rounded-full.
    radius: {
      none: '[--fr-skel-radius-default:0px]',
      sm: '[--fr-skel-radius-default:0.25rem]',
      md: '[--fr-skel-radius-default:var(--radius-frayme)]',
      lg: '[--fr-skel-radius-default:1rem]',
      full: '[--fr-skel-radius-default:9999px]',
    },
    animation: {
      pulse: 'animate-pulse',
      shimmer:
        'relative overflow-hidden after:absolute after:inset-0 after:animate-[fr-shimmer_1.4s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent',
      none: '',
    },
    tone: { default: '[--color-muted:var(--frayme-muted)]', subtle: 'opacity-60' },
  },
  defaultVariants: { shape: 'rect', animation: 'pulse', tone: 'default' },
});

const spinnerWrap = cva('inline-flex [color:var(--fr-spinner-muted,var(--color-muted-foreground))]', {
  variants: {
    labelPosition: {
      right: 'flex-row items-center gap-2',
      bottom: 'flex-col items-center gap-1.5',
      none: 'items-center',
    },
  },
  defaultVariants: { labelPosition: 'right' },
});
const spinner = cva(
  // Ring glyph width/height read the exact-override var (--fr-spinner-size) then
  // the per-enum default var (set by the size variant), then md=1.25rem. The
  // size enum no longer emits h-*/w-* utilities (tailwind-merge would NOT dedupe
  // them against the arbitrary width/height classes), so there is one width +
  // one height declaration. Steps: h-3/w-3=0.75rem · h-3.5=0.875rem · h-5=1.25rem
  // · h-8=2rem · h-12=3rem. (dots/bars sub-glyphs keep their proportional enum.)
  'inline-block rounded-full [width:var(--fr-spinner-size,var(--fr-spinner-size-default,1.25rem))] max-w-full [height:var(--fr-spinner-size,var(--fr-spinner-size-default,1.25rem))] border-[var(--fr-spinner-track,var(--color-border))] [border-top-color:var(--fr-spinner,var(--color-primary))] animate-spin',
  {
    variants: {
      size: {
        xs: '[--fr-spinner-size-default:0.75rem]',
        sm: '[--fr-spinner-size-default:0.875rem]',
        md: '[--fr-spinner-size-default:1.25rem]',
        lg: '[--fr-spinner-size-default:2rem]',
        xl: '[--fr-spinner-size-default:3rem]',
      },
      tone: {
        default: '',
        muted: '[--fr-spinner:var(--color-muted-foreground)]',
        success: '[--fr-spinner:var(--color-success)]',
        warning: '[--fr-spinner:var(--color-warning)]',
        critical: '[--fr-spinner:var(--color-danger)]',
        info: '[--fr-spinner:var(--color-info)]',
      },
      thickness: { thin: 'border', regular: 'border-2', thick: 'border-4' },
      speed: {
        slow: '[animation-duration:1.4s]',
        normal: '[animation-duration:0.7s]',
        fast: '[animation-duration:0.4s]',
      },
    },
    defaultVariants: { size: 'md', tone: 'default', thickness: 'regular', speed: 'normal' },
  },
);
// `dots`/`bars` alternate styles — bounded, not an open icon set.
const spinnerDot = cva('inline-block rounded-full [background:var(--fr-spinner,var(--color-primary))] animate-[fr-bounce_0.8s_infinite]', {
  variants: {
    size: { xs: 'h-1 w-1', sm: 'h-1.5 w-1.5', md: 'h-2 w-2', lg: 'h-3 w-3', xl: 'h-4 w-4' },
    tone: {
      default: '',
      muted: '[--fr-spinner:var(--color-muted-foreground)]',
      success: '[--fr-spinner:var(--color-success)]',
      warning: '[--fr-spinner:var(--color-warning)]',
      critical: '[--fr-spinner:var(--color-danger)]',
      info: '[--fr-spinner:var(--color-info)]',
    },
  },
  defaultVariants: { size: 'md', tone: 'default' },
});
const spinnerBar = cva('inline-block [background:var(--fr-spinner,var(--color-primary))] animate-[fr-bounce_0.8s_infinite]', {
  variants: {
    size: { xs: 'h-2.5 w-0.5', sm: 'h-3 w-0.5', md: 'h-4 w-1', lg: 'h-6 w-1', xl: 'h-9 w-1.5' },
    tone: {
      default: '',
      muted: '[--fr-spinner:var(--color-muted-foreground)]',
      success: '[--fr-spinner:var(--color-success)]',
      warning: '[--fr-spinner:var(--color-warning)]',
      critical: '[--fr-spinner:var(--color-danger)]',
      info: '[--fr-spinner:var(--color-info)]',
    },
  },
  defaultVariants: { size: 'md', tone: 'default' },
});

/* Alert status glyphs are REGISTRY icon NAMES (rendered
   via <Icon> at a fixed 16px), not platform-varying unicode chars — consistent with the
   closed SVG registry used everywhere else in these files (Tag/ListItem/EmptyState/Stat/
   Alert's own dismissIcon). The four statuses map to lucide-style names. */
const ALERT_ICON: Record<string, string> = {
  info: 'info',
  success: 'check-circle',
  warning: 'alert-triangle',
  error: 'alert-circle',
};

/* ── Renderers ────────────────────────────────────────────────────────────── */

// per-column alignment: a static text-* utility appended LAST to each th/td so it
// dedupes the table-wide `align` variant. Closed set (no value channel).
const COL_ALIGN: Record<'left' | 'center' | 'right', string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function Table({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    columns: unknown;
    rows: unknown;
    caption?: string | null;
    size?: string | null;
    density?: string | null;
    striped?: boolean | null;
    bordered?: string | null;
    hover?: boolean | null;
    align?: string | null;
    // optional per-column alignment, parallel to `columns`. Missing/invalid
    // entries fall back to the table-wide `align` (which defaults left).
    columnAlign?: Array<'left' | 'center' | 'right'> | null;
    stickyHeader?: boolean | null;
    headerTextColor?: string | null;
    accent?: string | null;
    mutedColor?: string | null;
  };
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const density = (p.density as 'comfortable' | 'compact' | null) ?? undefined;
  const align = (p.align as 'left' | 'center' | 'right' | null) ?? undefined;
  const bordered = (p.bordered as 'none' | 'rows' | 'grid' | null) ?? undefined;
  const stickyHeader = (p.stickyHeader as boolean | null) ?? undefined;
  // Per-column override class (or undefined → the table-wide align holds).
  const colAlign = Array.isArray(p.columnAlign) ? p.columnAlign : [];
  const colAlignClass = (j: number): string | undefined => {
    const a = colAlign[j];
    return a === 'left' || a === 'center' || a === 'right' ? COL_ALIGN[a] : undefined;
  };
  // Table is a plain string grid, but the model sometimes emits the DataTable
  // shape — object columns (`{key,header}`) and record rows (`{colKey: val}`).
  // Flatten both so a mis-shaped payload renders text instead of crashing on
  // `row.map` or rendering an object child blank.
  const cellText = (v: unknown): string =>
    v == null ? '' : typeof v === 'object' ? '' : String(v);
  const cols = (Array.isArray(p.columns) ? p.columns : []).map((c) =>
    c && typeof c === 'object'
      ? {
          label: cellText(
            (c as Record<string, unknown>).header ??
              (c as Record<string, unknown>).label ??
              (c as Record<string, unknown>).title ??
              (c as Record<string, unknown>).key,
          ),
          key: cellText(
            (c as Record<string, unknown>).key ??
              (c as Record<string, unknown>).header ??
              (c as Record<string, unknown>).label,
          ),
        }
      : { label: cellText(c), key: cellText(c) },
  );
  const rows = (Array.isArray(p.rows) ? p.rows : []).map((r) =>
    Array.isArray(r)
      ? r.map(cellText)
      : r && typeof r === 'object'
        ? cols.map((col) => cellText((r as Record<string, unknown>)[col.key]))
        : [],
  );
  return (
    <div className={cn(tableScroll({ stickyHeader }))}>
      <table
        className={cn(tableBase({ size }))}
        style={styleVars(
          { var: '--fr-tbl-head', value: p.headerTextColor, kind: 'color' },
          { var: '--fr-tbl-accent', value: p.accent, kind: 'color' },
          { var: '--fr-tbl-muted', value: p.mutedColor, kind: 'color' },
        )}
      >
        {p.caption != null && <caption className={cn(tableCaption)}>{p.caption}</caption>}
        <thead>
          <tr>
            {/* A column heading names the column — clipping it to "Outstanding
                bal…" costs the reader the only word that mattered. The old
                `max-w-[24rem] truncate` was a hard cap, not space pressure: it
                clipped the same at 2000px as at 320px. The cap goes and the
                label wraps; the wrapper still scrolls in x if the table needs it. */}
            {cols.map((col, j) => (
              <th key={`${col.key}-${j}`} scope="col" className={cn(tableHead({ size, density, align, stickyHeader }), 'break-words', colAlignClass(j))} title={col.label || undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                tableRow({ striped: (p.striped ?? false) as true | false, hover: (p.hover ?? true) as true | false }),
              )}
            >
              {/* Table has no fixed row height — nothing here earns a clipped
                  line. `truncate` is white-space:nowrap, so the cell was one
                  unbreakable line the 24rem cap then sliced. Wrapping costs a
                  row some height and keeps every word. */}
              {row.map((cell, j) => (
                <td key={j} className={cn(tableCell({ size, density, align, bordered }), 'break-words', colAlignClass(j))} title={cell || undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Heading({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    text: string;
    level?: string | number | null;
    size?: string | null;
    fontSize?: string | number | null;
    weight?: string | null;
    align?: string | null;
    tone?: string | null;
    truncate?: boolean | null;
    tracking?: string | null;
    leading?: string | null;
    color?: string | null;
    font?: string | null;
    // multi-line clamp count (mirrors Text.clamp).
    clamp?: string | number | null;
  };
  // Models sometimes emit level as a number (2) or bare digit ('2') mid-stream;
  // coerce instead of handing React an invalid element type.
  const digit = String(p.level ?? 'h2').replace(/^h/, '');
  const level = (['1', '2', '3', '4'].includes(digit) ? `h${digit}` : 'h2') as 'h1' | 'h2' | 'h3' | 'h4';
  // Visual size is DECOUPLED from the semantic level. When the author omits
  // `size` we map the level → its conventional display size so the default look
  // is preserved; an explicit `size` overrides (e.g. a display-large h2).
  const levelSize: Record<string, 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'> = {
    h1: 'xl', h2: 'lg', h3: 'md', h4: 'sm',
  };
  const size = (p.size as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | null) ?? levelSize[level];
  return createElement(
    level,
    {
      className: cn(
        heading({
          size,
          weight: (p.weight as 'normal' | 'medium' | 'semibold' | 'bold' | null) ?? undefined,
          align: (p.align as 'left' | 'center' | 'right' | null) ?? undefined,
          tone: (p.tone as 'default' | 'muted' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined,
          truncate: (p.truncate ?? false) as true | false,
          // opt-in multi-line clamp (only when a count is supplied).
          clamp: p.clamp != null ? true : undefined,
        }),
        // value > tone (enum) > token: only add the override class when supplied.
        p.color != null && '[color:var(--fr-heading-fg)]',
        // Closed Font enum → a static font-* utility (LAST in the font-family group
        // so a set value wins); unset/unknown → undefined → dropped (inherit).
        fontClass(p.font),
        // the SHARED 5-step Tracking atom (tighter…wider) → a static tracking-*
        // utility, LAST in its group so a set value dedupe-wins the base tracking-normal;
        // unset/unknown → undefined → dropped (tracking-normal stays, byte-identical).
        trackingClass(p.tracking),
        // Closed Leading enum → a static leading-* utility, placed LAST in the
        // line-height group so a set value dedupe-wins the base's baked leading-tight;
        // unset/unknown → undefined → dropped (line-height stays leading-tight, byte-identical).
        leadingClass(p.leading),
      ),
      style: styleVars(
        { var: '--fr-heading-fg', value: p.color, kind: 'color' },
        { var: '--fr-heading-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem', 'em'], min: 8, max: 96 } },
        // multi-line clamp count (mirrors Text.clamp bounds 1-6).
        { var: '--fr-heading-clamp', value: p.clamp, kind: 'dim', opts: { kind: 'count', min: 1, max: 6 } },
      ),
      // When truncate/clamp is active the ellipsised text is unrecoverable — expose
      // the full string on hover. Only set when a truncation channel is engaged.
      title: (p.truncate || p.clamp != null) ? (p.text || undefined) : undefined,
    },
    p.text,
  );
}

export function Text({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    text: string;
    variant?: string | null;
    size?: string | null;
    fontSize?: string | number | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    align?: string | null;
    tone?: string | null;
    italic?: boolean | null;
    truncate?: boolean | null;
    mono?: boolean | null;
    color?: string | null;
    bg?: string | null;
    clamp?: string | number | null;
    font?: string | null;
  };
  const variant = (p.variant ?? 'body') as 'body' | 'caption' | 'muted' | 'lead' | 'code';
  const className = cn(
    // Width law: flowing-copy variants self-cap at a reading measure (70ch,
    // frayme.css fr-text-measure) — the page never clamps, the paragraph does.
    // Short UI copy is untouched (max-width is inert below the cap); caption/
    // code are short-form by contract and skip the marker.
    (variant === 'body' || variant === 'lead' || variant === 'muted') && 'fr-text-measure',
    text({
      variant,
      size: (p.size as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | null) ?? undefined,
      weight: (p.weight as 'normal' | 'medium' | 'semibold' | 'bold' | null) ?? undefined,
      align: (p.align as 'left' | 'center' | 'right' | 'justify' | null) ?? undefined,
      tone: (p.tone as 'default' | 'muted' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined,
      italic: (p.italic ?? false) as true | false,
      truncate: (p.truncate ?? false) as true | false,
      mono: (p.mono ?? false) as true | false,
      clamp: p.clamp != null ? true : undefined,
    }),
    // Chip background channel, scoped to variant:code (group form so tw-merge
    // dedupes the variant's baked bg-muted; conditional → unset byte-identical).
    // Pair a dark `bg` with a light `color` for a brand code chip.
    variant === 'code' && p.bg != null && 'bg-[color:var(--fr-text-bg,var(--fr-surface-sunken,var(--color-muted)))]',
    // Closed Font enum → a static font-* utility, placed LAST in the font-family
    // group so a set value wins over the base/variant:code/mono font-mono (intended
    // override); unset/unknown → undefined → dropped (inherit, byte-identical).
    fontClass(p.font),
    // Closed Tracking/Leading enums → static tracking-*/leading-* utilities, placed
    // LAST in their groups so a set value dedupe-wins the size step's baked leading-*
    // (no baked tracking-*); unset/unknown → undefined → dropped (byte-identical).
    trackingClass(p.tracking),
    leadingClass(p.leading),
  );
  const style = styleVars(
    { var: '--fr-text-fg', value: p.color, kind: 'color' },
    { var: '--fr-text-bg', value: p.bg, kind: 'color' },
    { var: '--fr-text-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem', 'em'], min: 8, max: 96 } },
    { var: '--fr-text-clamp', value: p.clamp, kind: 'dim', opts: { kind: 'count', min: 1, max: 6 } },
  );
  // When truncate/clamp is active the ellipsised text is unrecoverable — expose the
  // full string on hover. Only set when a truncation channel is engaged.
  const title = (p.truncate || p.clamp != null) ? (p.text || undefined) : undefined;
  if (variant === 'code') {
    return <code className={className} style={style} title={title}>{p.text}</code>;
  }
  return <p className={className} style={style} title={title}>{p.text}</p>;
}

export function Image({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    src?: string | null;
    alt: string;
    width?: string | number | null;
    height?: string | number | null;
    aspect?: string | null;
    fit?: string | null;
    position?: string | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    border?: boolean | null;
    borderWidthValue?: string | number | null;
    shadow?: string | null;
    loading?: string | null;
    borderColor?: string | null;
    mutedColor?: string | null;
  };
  // width/height route through the dimension channel (styleVars → --fr-img-w/h);
  // the static recipe reads them via var() so the raw `<img width/height>` path
  // is closed. borderColor / borderWidthValue both imply a border. radiusValue /
  // borderWidthValue land in --fr-img-radius / --fr-img-bw (read by the shared
  // image + placeholder recipes) so an exact corner radius / border thickness
  // wins over the radius enum / 1px default; unset keeps the recipe default.
  const dimVars = styleVars(
    { var: '--fr-img-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 2048 } },
    { var: '--fr-img-h', value: p.height, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 2048 } },
    { var: '--fr-img-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
    { var: '--fr-img-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
    { var: '--fr-img-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-img-muted', value: p.mutedColor, kind: 'color' },
  );
  const aspect = (p.aspect as 'auto' | '1/1' | '4/3' | '16/9' | '3/2' | '21/9' | '3/4' | null) ?? undefined;
  const radius = (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined;
  const shadow = (p.shadow as 'none' | 'sm' | 'md' | 'lg' | null) ?? undefined;
  const border =
    p.borderColor != null || p.borderWidthValue != null ? true : (p.border as boolean | null) ?? undefined;
  return (
    <SafeImage
      className={cn(
        image({
          aspect,
          fit: (p.fit as 'cover' | 'contain' | 'fill' | 'none' | null) ?? undefined,
          position: (p.position as 'center' | 'top' | 'bottom' | 'left' | 'right' | null) ?? undefined,
          radius,
          border,
          shadow,
        }),
      )}
      src={p.src}
      alt={p.alt}
      loading={((p.loading as 'lazy' | 'eager' | null) ?? 'lazy')}
      style={dimVars}
      fallback={
        <div
          className={cn(imagePlaceholder({ aspect, radius, border, shadow }))}
          role="img"
          aria-label={p.alt}
          style={dimVars}
        >
          {p.alt}
        </div>
      }
    />
  );
}

export function Avatar({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    src?: string | null;
    name: string;
    size?: string | null;
    sizeValue?: string | number | null;
    shape?: string | null;
    ring?: string | null;
    border?: boolean | null;
    bg?: string | null;
    color?: string | null;
    borderColor?: string | null;
    ringColor?: string | null;
  };
  const initials = (p.name ?? '')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  // ringColor implies a ring (default token style) when `ring` isn't named.
  const ring =
    (p.ring as 'none' | 'default' | 'success' | 'warning' | 'critical' | 'info' | null) ??
    (p.ringColor != null ? 'default' : undefined);
  // borderColor implies a border (mirrors Image): a named edge colour turns the
  // border on so the tint is visible without also setting `border:true`.
  const border = p.borderColor != null ? true : (p.border ?? false);
  return (
    <span
      className={cn(
        avatar({
          size: (p.size as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | null) ?? undefined,
          shape: (p.shape as 'circle' | 'rounded' | 'square' | null) ?? undefined,
          ring,
          border: border as true | false,
        }),
      )}
      title={p.name}
      style={styleVars(
        { var: '--fr-avatar-bg', value: p.bg, kind: 'color' },
        { var: '--fr-avatar-fg', value: p.color, kind: 'color' },
        { var: '--fr-avatar-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-avatar-ring', value: p.ringColor, kind: 'color' },
        { var: '--fr-avatar-size', value: p.sizeValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 16, max: 160 } },
      )}
    >
      <SafeImage
        className="h-full w-full object-cover"
        src={p.src}
        alt={p.name}
        fallback={<span aria-hidden>{initials}</span>}
      />
    </span>
  );
}

export function Badge({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    text: string;
    variant?: string | null;
    tone?: string | null;
    size?: string | null;
    shape?: string | null;
    dot?: boolean | null;
    uppercase?: boolean | null;
    bg?: string | null;
    color?: string | null;
    borderColor?: string | null;
    dotColor?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  return (
    <span
      className={cn(
        badge({
          variant: (p.variant as 'default' | 'secondary' | 'destructive' | 'outline' | null) ?? undefined,
          tone: (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined,
          size: (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined,
          shape: (p.shape as 'pill' | 'rounded' | 'square' | null) ?? undefined,
          uppercase: (p.uppercase ?? false) as true | false,
        }),
        // Precedence: value > tone (enum) > variant (enum) > token. The override
        // class is only added when the model named the value, so an unset value
        // lets the tone/variant class win (tailwind-merge keeps the last class).
        p.bg != null && '[background:var(--fr-badge-bg)]',
        p.color != null && 'text-[color:var(--fr-badge-fg)]',
        // Group form (border-[color:…], NOT the bare [border-color:…] arbitrary
        // property) so tw-merge dedupes it against the outline variant's
        // `border-border` (and wins when added LAST); the arbitrary-property form
        // did not dedupe, letting the outline border swallow borderColor. Token
        // fallback inside the var keeps a valid border on an invalid value.
        p.borderColor != null && 'border border-[color:var(--fr-badge-border,var(--color-border))]',
        // Closed Font enum → a static font-* utility (the label inherits it);
        // weight/tracking/leading enums land LAST so a set value dedupe-wins its
        // group (font-medium / uppercase's tracking-wide stay the defaults).
        // Unset → undefined → dropped (byte-identical).
        fontClass(p.font),
        weightClass(p.weight),
        trackingClass(p.tracking),
        leadingClass(p.leading),
      )}
      style={styleVars(
        { var: '--fr-badge-bg', value: p.bg, kind: 'color' },
        { var: '--fr-badge-fg', value: p.color, kind: 'color' },
        { var: '--fr-badge-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-badge-dot', value: p.dotColor, kind: 'color' },
        // exact label font size → --fr-badge-fs wins over the size step's default var.
        { var: '--fr-badge-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {p.dot === true && (
        <span
          className="h-1.5 w-1.5 rounded-full [background:var(--fr-badge-dot,currentColor)]"
          aria-hidden
        />
      )}
      {p.text}
    </span>
  );
}

export function Alert({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  // Bindable dismissed state: seed from props.dismissed, and when a binding is
  // present the resolved boolean mirrors into spec.state on close so a
  // Button/agent can read/persist that the alert was hidden (FloorPlan pattern).
  const [dismissed, setDismissed] = useLocalOrBound<boolean>(
    ((element.props ?? {}) as { dismissed?: boolean | null }).dismissed ?? false,
    (bindings as { dismissed?: unknown } | undefined)?.dismissed,
  );
  const emitWith = useIntrinsicEmit(emit, element);
  if (dismissed) return null;
  const p = (element.props ?? {}) as {
    title: string;
    message?: string | null;
    type?: string | null;
    tone?: string | null;
    variant?: string | null;
    size?: string | null;
    align?: string | null;
    icon?: string | null;
    dismissible?: boolean | null;
    dismissed?: boolean | null;
    dismissLabel?: string | null;
    dismissIcon?: string | null;
    accentBar?: boolean | null;
    bg?: string | null;
    borderColor?: string | null;
    accent?: string | null;
    accentText?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const type = (p.type as 'info' | 'success' | 'warning' | 'error' | null) ?? 'info';
  const tone = (p.tone as 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined;
  // icon resolution → a REGISTRY NAME (rendered via <Icon>, never unicode).
  //   'none'  → no icon
  //   'auto'  → the status glyph derived from tone/type
  //   one of the four status enum values (info/success/warning/error) → its mapped glyph
  //   ANY other registry name (widened `icon` prop) → that glyph directly (hasIcon-guarded)
  //   an unknown name → fall back to the status glyph (never a broken/empty icon)
  const iconChoice = (p.icon as string | null) ?? 'auto';
  const statusGlyph = (): string => {
    const toneIcon = tone === 'critical' ? 'error' : tone;
    return ALERT_ICON[(toneIcon ?? type) as string] ?? ALERT_ICON.info;
  };
  let iconName: string | null = null;
  if (iconChoice === 'none') iconName = null;
  else if (iconChoice === 'auto') iconName = statusGlyph();
  else if (iconChoice in ALERT_ICON) iconName = ALERT_ICON[iconChoice];
  else if (hasIcon(iconChoice)) iconName = iconChoice;
  else iconName = statusGlyph();
  return (
    <div
      className={cn(
        alert({
          type,
          tone,
          variant: (p.variant as 'subtle' | 'solid' | 'outline' | null) ?? undefined,
          size: (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined,
          align: (p.align as 'left' | 'center' | null) ?? undefined,
          accentBar: (p.accentBar ?? false) as true | false,
        }),
        // Precedence: value > tone (enum) > type (enum) > token-mix default.
        p.bg != null && '[background:var(--fr-alert-bg,var(--fr-surface-sunken,var(--color-muted)))]',
        // Group form (border-[color:…], not the bare [border-color:…] arbitrary
        // property): tw-merge dedupes it against the type/tone border-* classes,
        // whose compiled rules would otherwise sort later and win.
        p.borderColor != null && 'border-[color:var(--fr-alert-border,var(--color-border))]',
        // On-fill text: when set, recolour the title/message so a saturated
        // `bg`/`variant:solid` stays legible. Added LAST in the text-color group
        // so tw-merge dedupes-and-wins over the `solid` variant's `text-card`;
        // the `[&_*]:` form overrides the matching child cascade `[&_*]:text-card`.
        p.accentText != null && 'text-[color:var(--fr-alert-accent-text,var(--color-primary-foreground))]',
        p.accentText != null && '[&_*]:text-[color:var(--fr-alert-accent-text,var(--color-primary-foreground))]',
        // Closed Font enum → a static font-* utility; the whole alert region
        // inherits it. Unset/unknown → undefined → dropped (byte-identical).
        fontClass(p.font),
      )}
      role="status"
      style={styleVars(
        { var: '--fr-alert-bg', value: p.bg, kind: 'color' },
        { var: '--fr-alert-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-alert-accent', value: p.accent, kind: 'color' },
        { var: '--fr-alert-accent-text', value: p.accentText, kind: 'color' },
        // exact title font size → --fr-alert-fs (read by the title's var chain).
        { var: '--fr-alert-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      <div className="flex items-start gap-2">
        {iconName && (
          <span
            className="mt-0.5 shrink-0 [color:var(--fr-alert-accent,var(--fr-alert-accent-default,inherit))]"
            aria-hidden
          >
            <Icon name={iconName} size={16} />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong
            className={cn(
              // fontSize is a single source: the baked 0.9375rem is the var fallback
              // (byte-identical when unset), and an exact fontSize wins via the var.
              '[font-size:var(--fr-alert-fs,0.9375rem)] font-semibold',
              // weight/tracking/leading closed enums → static utilities, LAST in cn()
              // so a set value dedupe-wins its group (font-semibold stays the default).
              weightClass(p.weight),
              trackingClass(p.tracking),
              leadingClass(p.leading),
            )}
          >
            {p.title}
          </strong>
          {p.message != null && <span className="text-sm opacity-90">{p.message}</span>}
        </div>
        {p.dismissible === true && (
          <button
            type="button"
            // The only interactive target in this file, and it was the smallest
            // thing on the alert: no padding, `text-lg leading-none`, so the box
            // was exactly its glyph — ~11x18px for the default `×`, 16x16 for an
            // <Icon> — against WCAG 2.5.8's 24x24. An automated a11y audit does not report
            // it, because its inline-target exemption tests `display:inline-block`
            // + "height is about one line box" and a padding-less button passes
            // both; but 2.5.8 exempts a target "in a sentence, or constrained by
            // the line-height of NON-target text", and this one is a standalone
            // control in a flex row, constrained by nothing. The instrument
            // under-reports here, so the measurement is the box, not the audit.
            //
            // min-h/min-w rather than a fixed h-6/w-6: a longer dismissLabel or a
            // larger glyph must still be able to grow the box, and a fixed height
            // would clip it. The centering pair is what keeps the glyph optically
            // where it was while the hit area grows around it; `-mr-1` still pulls
            // the enlarged box into the alert's own right padding.
            className="-mr-1 inline-flex min-h-6 min-w-6 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-sm border-0 bg-transparent text-lg leading-none opacity-70 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label={p.dismissLabel ?? 'Dismiss'}
            onClick={() => {
              setDismissed(true);
              emitWith('dismiss', { label: p.title ?? null });
            }}
          >
            {/* Glyph-name override resolves ONLY through the closed registry; an
                unknown/absent name keeps the literal × char (byte-identical default). */}
            {typeof p.dismissIcon === 'string' && hasIcon(p.dismissIcon) ? (
              <Icon name={p.dismissIcon} size={16} />
            ) : (
              '×'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function Progress({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    value: number;
    max?: number | null;
    label?: string | null;
    tone?: string | null;
    size?: string | null;
    height?: string | number | null;
    shape?: string | null;
    showValue?: string | null;
    striped?: boolean | null;
    animated?: boolean | null;
    indeterminate?: boolean | null;
    color?: string | null;
    trackColor?: string | null;
    overlayColor?: string | null;
    mutedColor?: string | null;
  };
  const max = p.max ?? 100;
  const indeterminate = p.indeterminate === true;
  const pct = Math.min(Math.max((p.value / max) * 100, 0), 100);
  const showValue = (p.showValue as 'none' | 'percent' | 'fraction' | null) ?? 'none';
  let readout: string | null = null;
  if (!indeterminate && showValue === 'percent') readout = `${Math.round(pct)}%`;
  else if (!indeterminate && showValue === 'fraction') readout = `${p.value}/${max}`;
  return (
    <div
      className={cn(field)}
      style={styleVars(
        // `color` value wins over the `tone` enum (the bar reads --fr-progress-bar,
        // which tone sets via a token and the value overrides directly).
        { var: '--fr-progress-bar', value: p.color, kind: 'color' },
        { var: '--fr-progress-track', value: p.trackColor, kind: 'color' },
        // Stripe scrim over the bar fill (cascades to the inner progressBar).
        { var: '--fr-progress-scrim', value: p.overlayColor, kind: 'color' },
        { var: '--fr-progress-muted', value: p.mutedColor, kind: 'color' },
        // Exact track height; cascades down to the progressTrack which reads it.
        { var: '--fr-progress-h', value: p.height, kind: 'dim', opts: { units: ['px', 'rem'], min: 2, max: 48 } },
      )}
    >
      {(p.label != null || readout != null) && (
        <span className={cn(label)}>
          {p.label != null && <span>{p.label}</span>}
          {readout != null && <span className="[color:var(--fr-progress-muted,var(--color-muted-foreground))]">{readout}</span>}
        </span>
      )}
      <div
        className={cn(progressTrack({
          size: (p.size as 'xs' | 'sm' | 'md' | 'lg' | null) ?? undefined,
          shape: (p.shape as 'pill' | 'square' | null) ?? undefined,
        }))}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : p.value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(progressBar({
            // value > enum: the tone class sets --fr-progress-bar ON the bar
            // element, which would beat the wrapper-inherited `color` var — so
            // the enum is only passed when no color value is set.
            tone: p.color == null ? ((p.tone as 'default' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined) : undefined,
            striped: (p.striped ?? false) as true | false,
            animated: (p.animated ?? false) as true | false,
            indeterminate: indeterminate as true | false,
          }))}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Skeleton({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    width?: string | number | null;
    height?: string | number | null;
    shape?: string | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    animation?: string | null;
    tone?: string | null;
    lines?: string | number | null;
  };
  // width/height are validated via the dimension channel: a model-supplied value
  // lands in --fr-skel-w/--fr-skel-h (closing the prior raw-string-to-style
  // injection hole); the static recipe falls back to 100% / 1rem when absent.
  const shape = (p.shape as 'line' | 'rect' | 'circle' | 'pill' | null) ?? undefined;
  // `radius` overrides the shape's default rounding for line/rect; circle/pill
  // keep their round form via shape (added later so it wins).
  const radius = (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined;
  // The corner rounding for the line/rect/default path comes from the
  // --fr-skel-radius var-chain (default --radius-frayme === the prior
  // rounded-frayme), so an exact radiusValue wins over the radius enum; the
  // var-chain class is added ONLY for that path so circle/pill stay rounded-full.
  const roundable = shape === 'line' || shape === 'rect' || shape == null;
  const base = cn(
    skeleton({
      shape,
      radius: roundable ? radius : undefined,
      animation: (p.animation as 'pulse' | 'shimmer' | 'none' | null) ?? undefined,
      tone: (p.tone as 'default' | 'subtle' | null) ?? undefined,
    }),
    roundable && '[border-radius:var(--fr-skel-radius,var(--fr-skel-radius-default,var(--radius-frayme)))]',
    '[width:var(--fr-skel-w,100%)] max-w-full',
    '[height:var(--fr-skel-h,1rem)]',
  );
  const style = styleVars(
    { var: '--fr-skel-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 2048 } },
    { var: '--fr-skel-h', value: p.height, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 2048 } },
    { var: '--fr-skel-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
  );
  // `lines` renders N stacked line skeletons (last shortened to 60%) — the
  // common text-block placeholder. Validate the count via the dimension channel.
  const lineCount = p.lines != null ? Number(safeDimensionCount(p.lines)) : 0;
  if (lineCount > 1) {
    return (
      <div className="flex flex-col gap-2" aria-hidden>
        {Array.from({ length: lineCount }).map((_, i) => (
          <div
            key={i}
            className={cn(base)}
            style={{ ...style, ...(i === lineCount - 1 ? { width: '60%' } : null) }}
          />
        ))}
      </div>
    );
  }
  return <div className={base} style={style} aria-hidden />;
}

/** Local count clamp for `lines` (mirrors the gate's count bounds). */
function safeDimensionCount(v: string | number): string {
  const n = typeof v === 'number' ? v : Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return '0';
  return String(Math.min(Math.max(Math.round(n), 1), 8));
}

export function Spinner({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    size?: string | null;
    sizeValue?: string | number | null;
    label?: string | null;
    tone?: string | null;
    variant?: string | null;
    speed?: string | null;
    thickness?: string | null;
    labelPosition?: string | null;
    color?: string | null;
    trackColor?: string | null;
    mutedColor?: string | null;
  };
  const size = (p.size as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | null) ?? undefined;
  // value > enum: the tone class sets --fr-spinner ON the glyph element, which
  // beats the inherited `color` value var (written on the dots/bars wrapper) —
  // so the enum is only passed when no color value is set.
  const tone = p.color == null
    ? ((p.tone as 'default' | 'muted' | 'success' | 'warning' | 'critical' | 'info' | null) ?? undefined)
    : undefined;
  const variant = (p.variant as 'ring' | 'dots' | 'bars' | null) ?? 'ring';
  const labelPosition = (p.labelPosition as 'right' | 'bottom' | 'none' | null) ?? 'right';
  const vars = styleVars(
    // `color` value wins over the `tone` enum (both feed --fr-spinner).
    { var: '--fr-spinner', value: p.color, kind: 'color' },
    { var: '--fr-spinner-track', value: p.trackColor, kind: 'color' },
  );
  // Exact glyph diameter applies to the ring variant only; dots/bars keep their
  // proportional size enum, so the var is scoped to the ring's style below.
  const ringVars = styleVars(
    { var: '--fr-spinner', value: p.color, kind: 'color' },
    { var: '--fr-spinner-track', value: p.trackColor, kind: 'color' },
    { var: '--fr-spinner-size', value: p.sizeValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 128 } },
  );
  let indicator: ReactNode;
  if (variant === 'dots') {
    indicator = (
      <span className="inline-flex items-center gap-1" aria-hidden style={vars}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn(spinnerDot({ size, tone }))} style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </span>
    );
  } else if (variant === 'bars') {
    indicator = (
      <span className="inline-flex items-end gap-0.5" aria-hidden style={vars}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn(spinnerBar({ size, tone }))} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </span>
    );
  } else {
    indicator = (
      <span
        className={cn(spinner({
          size,
          tone,
          thickness: (p.thickness as 'thin' | 'regular' | 'thick' | null) ?? undefined,
          speed: (p.speed as 'slow' | 'normal' | 'fast' | null) ?? undefined,
        }))}
        aria-hidden
        style={ringVars}
      />
    );
  }
  return (
    <span
      className={cn(spinnerWrap({ labelPosition }))}
      role="status"
      aria-label={p.label ?? 'Loading'}
      style={styleVars({ var: '--fr-spinner-muted', value: p.mutedColor, kind: 'color' })}
    >
      {indicator}
      {p.label != null && labelPosition !== 'none' && <span>{p.label}</span>}
    </span>
  );
}
