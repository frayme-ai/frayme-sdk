/**
 * The value-channel applier — the ONE place a renderer is allowed to write an
 * inline `style`, and it only ever emits `--*` custom properties.
 *
 * The model authors a real color/dimension VALUE; we validate it (defence in
 * depth — the spec is untrusted even after the gate) and place it into a single
 * `--fr-<component>-<role>` CSS variable that a static CVA recipe reads through
 * `var(--x, <token>)`. A failing/absent value is OMITTED so the recipe falls
 * back to its design-token default — a minimal spec still looks great. A value
 * never becomes a class; the compiled Tailwind class set stays closed (no
 * runtime JIT, no injection).
 *
 * Convention: every var is named `--fr-<component>-<role>`
 * (e.g. `--fr-card-bg`, `--fr-grid-cols`, `--fr-skel-w`).
 */

import type { CSSProperties } from 'react';
import { safeColor, safeDimension, type DimOpts } from '@frayme/catalog/validate';
import { onFillInk } from '../../core/theme.js';

type ColorVar = { var: `--${string}`; value: unknown; kind: 'color' };
type DimVar = { var: `--${string}`; value: unknown; kind: 'dim'; opts?: DimOpts };
/** A grid track list, already proved against the closed grammar by safeTrackList. */
type TrackVar = { var: `--${string}`; value: string; kind: 'track' };
/** A value this module DERIVED rather than one the model authored — it bypasses
 *  safeColor, which only exists to prove untrusted input. */
type RawVar = { var: `--${string}`; value: string; kind: 'raw' };

/**
 * Build an inline-style object of validated `--*` CSS variables. Each entry is
 * re-validated here; any value that fails (or is null/undefined) is omitted, so
 * the recipe's `var(--x, <token>)` fallback wins.
 */
export function styleVars(...vars: Array<ColorVar | DimVar | TrackVar | RawVar>): CSSProperties {
  const out: Record<string, string> = {};
  for (const v of vars) {
    if (v.value == null) continue;
    const safe =
      // `raw` is a value this module DERIVED (see surfaceInk/surfaceMuted), not one
      // the model authored — safeColor has nothing to prove about it, and would
      // reject the color-mix outright.
      v.kind === 'raw' ? (v.value as string)
      : v.kind === 'track' ? (v.value as string) : v.kind === 'color' ? safeColor(v.value) : safeDimension(v.value, v.opts);
    if (safe !== null) out[v.var] = safe;
  }
  return out as CSSProperties;
}

/**
 * The ink for a label sitting on a component's OWN accent fill, as a styleVars
 * entry to spread beside the accent it pairs with.
 *
 * An authored `accentText` wins. Otherwise, when the spec set an `accent`, the ink
 * is picked against THAT colour, so a pale accent gets dark text instead of the
 * white it cannot carry. With neither, nothing is written and the class chain
 * falls through to the theme's `--fr-accent-ink`, then to `card`.
 *
 * `raw` for the derived case: `onFillInk` only ever returns one of two fixed inks,
 * never the model's string, so there is nothing for `safeColor` to prove.
 */
export function accentTextVar(name: `--${string}`, accent: unknown, accentText: unknown): ColorVar | RawVar {
  if (accentText != null) return { var: name, value: accentText, kind: 'color' };
  const fill = typeof accent === 'string' ? safeColor(accent) : null;
  // No accent of its own: write nothing, so the label falls through to the theme's
  // --fr-accent-ink, which WAS computed for the colour that fills it.
  if (fill === null) return { var: name, value: null, kind: 'color' };
  // The spec set its own accent, so it owns its ink. A colour we cannot read pins
  // `card`, the pair it always had. Falling through instead would print the theme
  // accent's ink on a different colour, and a wrong luminance is worse than none.
  return { var: name, value: onFillInk(fill) ?? 'var(--color-card)', kind: 'raw' };
}

/**
 * Map the closed `Font` enum (sans|serif|mono|rounded|display) to a STATIC
 * Tailwind font-family utility. An unknown/absent value → undefined, so the
 * element inherits the theme's `--frayme-font` (the unbranded default). Never a
 * spec-supplied font-family string (no @font-face / font-src oracle).
 */
const FONT_CLASS: Record<string, string> = {
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
  rounded: 'font-rounded',
  display: 'font-display',
};
export function fontClass(font?: string | null): string | undefined {
  return font != null ? FONT_CLASS[font] : undefined;
}

/**
 * Map the closed border-style enum (solid|dashed|dotted) to a STATIC Tailwind
 * border-style utility. An unknown/absent value → undefined (the element keeps
 * its recipe default). Never a spec-supplied `border-style` string.
 */
const BORDER_STYLE_CLASS: Record<string, string> = {
  solid: 'border-solid',
  dashed: 'border-dashed',
  dotted: 'border-dotted',
};
export function borderStyleClass(style?: string | null): string | undefined {
  return style != null ? BORDER_STYLE_CLASS[style] : undefined;
}

/**
 * Closed typography-polish enums → STATIC Tailwind utilities (6i). Each returns
 * undefined for an unknown/absent value so the element keeps its recipe default
 * (byte-identical when unset). Never a spec-supplied weight/spacing/height value.
 * Placed LAST in cn() by callers so a set value dedupes-and-wins its tw-merge group.
 */
const WEIGHT_CLASS: Record<string, string> = {
  light: 'font-light', normal: 'font-normal', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold',
};
const TRACKING_CLASS: Record<string, string> = {
  tighter: 'tracking-tighter', tight: 'tracking-tight', normal: 'tracking-normal', wide: 'tracking-wide', wider: 'tracking-wider',
};
const LEADING_CLASS: Record<string, string> = {
  tight: 'leading-tight', snug: 'leading-snug', normal: 'leading-normal', relaxed: 'leading-relaxed', loose: 'leading-loose',
};
export function weightClass(w?: string | null): string | undefined {
  return w != null ? WEIGHT_CLASS[w] : undefined;
}
export function trackingClass(t?: string | null): string | undefined {
  return t != null ? TRACKING_CLASS[t] : undefined;
}
export function leadingClass(l?: string | null): string | undefined {
  return l != null ? LEADING_CLASS[l] : undefined;
}

/**
 * Closed elevation/opacity enums → STATIC Tailwind utilities (6j). undefined for
 * an unknown/absent value (keeps the recipe default; byte-identical when unset).
 * Placed LAST in cn() so a set value dedupe-wins its tw-merge group (box-shadow /
 * opacity). Never a spec-supplied box-shadow / opacity value.
 */
const SHADOW_CLASS: Record<string, string> = {
  none: 'shadow-none', sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg', xl: 'shadow-xl',
};
const OPACITY_CLASS: Record<string, string> = {
  full: 'opacity-100', '90': 'opacity-90', '75': 'opacity-75', '50': 'opacity-50', '25': 'opacity-25',
};
export function shadowClass(s?: string | null): string | undefined {
  return s != null ? SHADOW_CLASS[s] : undefined;
}
export function opacityClass(o?: string | null): string | undefined {
  return o != null ? OPACITY_CLASS[o] : undefined;
}

/**
 * Closed aspect-ratio enum → STATIC Tailwind aspect-* utility (6k). undefined for
 * an unknown/absent value (keeps the recipe's baked ratio; byte-identical when
 * unset). Placed LAST in cn() so a set value dedupe-wins the aspect-ratio group.
 * Vocab matches the existing `aspect` convention (Image/YouTube/VideoPlayer).
 */
const ASPECT_CLASS: Record<string, string> = {
  auto: 'aspect-auto', '1/1': 'aspect-square', '4/3': 'aspect-[4/3]', '3/2': 'aspect-[3/2]', '16/9': 'aspect-video', '21/9': 'aspect-[21/9]', '3/4': 'aspect-[3/4]',
};
export function aspectClass(a?: string | null): string | undefined {
  return a != null ? ASPECT_CLASS[a] : undefined;
}

/**
 * Closed overlay-motion enum → a `motion-safe` enter-animation utility.
 * Opt-in: unset/`none` → undefined → NO animation (instant; byte-identical). The
 * `motion-safe:` prefix means prefers-reduced-motion users never see the animation.
 * The `fr-overlay-in` keyframes are defined in frayme.css. Security-static timings:
 * the model picks a SPEED from a closed enum, never a free duration/easing string.
 */
const MOTION_CLASS: Record<string, string> = {
  fast: 'motion-safe:animate-[fr-overlay-in_120ms_ease-out]',
  normal: 'motion-safe:animate-[fr-overlay-in_200ms_ease-out]',
  slow: 'motion-safe:animate-[fr-overlay-in_320ms_ease-out]',
};
export function motionClass(m?: string | null): string | undefined {
  return m != null ? MOTION_CLASS[m] : undefined;
}

/**
 * The one keyboard-focus indicator, shared by every interactive surface in the
 * registry. Append it to a recipe base; never hand-roll a per-component ring.
 *
 * Composites to `0 0 0 1px <card>, 0 0 0 3px <accent>` — a solid ring behind a
 * one-pixel halo.
 *
 * OPAQUE is the requirement, not a preference: WCAG 1.4.11 judges the indicator
 * against BOTH neighbouring colours, and a ring mixed toward `transparent` has no
 * contrast of its own — it inherits whatever sits behind it, so the same ring that
 * clears 3:1 over a dark panel falls under it over a light card. `--fr-accent`
 * resolves to the foreground token, which flips with the theme, so one string
 * holds in light and dark alike.
 *
 * The halo is load-bearing for controls whose OWN fill is the accent colour (a
 * primary button): there the ring's inner edge would otherwise abut an identical
 * colour, and the card-toned offset is the adjacent colour the ring is measured
 * against.
 *
 * Outset by design. Inset on a short pill paints the ring over the control's own
 * padding, both of its edges against one fill, inside a box too small to read it.
 * A scroll container that would clip this ring needs the room (padding /
 * scroll-padding) — the ring does not move inside the control to avoid the clip.
 *
 * `ring-[color:…]` (not a bare `[--tw-ring-color:…]`) keeps the ring in tw-merge's
 * ring-color group, so a stray ring colour on the same element dedupes instead of
 * racing this one in the cascade.
 */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--fr-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-card';

/**
 * THE INK A SURFACE IS PAIRED WITH, derived from the surface itself.
 *
 * Measured across the registry: 61 components accept a `bg` prop and NOT ONE of
 * them derives ink from it. A container painted dark keeps the light theme's near
 * black text, at ~1.05:1 — and 25 of those components (Select, Input, Textarea,
 * Popover…) expose no `color` prop at all, so a spec author literally cannot
 * correct it. It was never their job: the pairing depends on the luminance of a
 * value the model authored but cannot evaluate.
 *
 * So the CONTAINER derives it, once, and every descendant inherits. Nine call
 * sites publish `--fr-surface`; publishing the paired ink beside it covers the
 * whole tree beneath them, including the 25 components that have no way to ask.
 *
 * 0.179 is the WCAG crossover — the relative luminance at which black and white
 * carry equal contrast — so this picks whichever of the two the surface can
 * actually support, rather than assuming an authored fill is dark. That assumption
 * is a live bug in six components at present (Hero, CTA, Banner, Callout, PageHeader,
 * PlanCard flip ink on `bg` PRESENCE), and it renders white-on-white at 1:1 when
 * the fill turns out to be light.
 *
 * An authored `color` always wins: these are only the FALLBACK in each component's
 * existing var chain.
 */
const INK_LIGHT = '#fafafa';   // --frayme-fg in the dark palette
const INK_DARK = '#18181b';    // --frayme-fg in the light palette

/** sRGB relative luminance. Hex only — authored `bg` values are opaque 6-digit hex
 *  in practice, and safeColor has already proved the string. */
function relLuminance(hex: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/**
 * The ink paired with a surface. An AUTHORED colour wins outright — the surface's
 * ink is whatever the author said it is, and deriving over the top of that would
 * shadow it for every descendant (a Card with bg #12161f and color #e2e6f0 would
 * hand its children #fafafa instead of the #e2e6f0 it was given). Derivation is
 * only for the case the author left open.
 *
 * Returns null when there is neither, so the container publishes nothing and the
 * inherited surface ink stays whatever an ancestor set.
 */
export function surfaceInk(bg: unknown, color?: unknown): string | null {
  const authored = typeof color === "string" ? safeColor(color) : null;
  if (authored) return authored;
  if (typeof bg !== "string") return null;
  const L = relLuminance(bg);
  if (L == null) return null;
  return L <= 0.179 ? INK_LIGHT : INK_DARK;
}

/** Secondary ink for the same surface: between the paired ink and the surface.
 *  62% keeps it clearly subordinate while staying above 4.5:1 at both ends of the
 *  range — the relationship --frayme-muted-fg has to --frayme-fg in each palette. */
export function surfaceMuted(bg: unknown, color?: unknown): string | null {
  const fg = surfaceInk(bg, color);
  return fg ? `color-mix(in srgb, ${fg} 62%, ${bg as string})` : null;
}

/**
 * The FIELD fill paired with a surface — an input/select/textarea ground that
 * reads as a control rather than a white pill.
 *
 * `control()` falls back to var(--color-card), a LIGHT-THEME value painted
 * regardless of what is underneath, so a field on an authored dark card was a
 * white pill — and once the surface started handing down its own ink, the text
 * inside that pill went #fafafa on #ffffff and vanished. Same defect and same
 * recipe as .fr-band and .fr-dt-actions: shade relative to the surface.
 *
 * Deliberately built on the DERIVED ink, never the authored one: mixing 8% of a
 * saturated brand colour into every field would tint the whole form. 8% matches
 * .fr-raised, which is the same move in the other direction.
 *
 * Returns null when `bg` is absent or unparseable, so a page that authors no
 * surface publishes nothing and every field stays byte-identical to the default.
 */
/**
 * A RAISED ground paired with a surface — a selected pill, a chip that should read as
 * sitting ON the surface rather than in it.
 *
 * 16%, twice the sunken/field 8%. The magnitude is load-bearing, not taste: a
 * SegmentedControl puts a raised pill on a recessed track, and at the same 8% the two
 * are indistinguishable on a dark card — the selection simply vanishes. Doubling it
 * keeps the pill legible against its own track in both palettes.
 *
 * Built on the DERIVED ink like the others, never an authored colour: mixing a
 * saturated brand colour in would tint every raised chip on the page.
 */
export function surfaceRaised(bg: unknown): string | null {
  if (typeof bg !== "string") return null;
  const L = relLuminance(bg);
  if (L == null) return null;
  const ink = L <= 0.179 ? INK_LIGHT : INK_DARK;
  return `color-mix(in srgb, ${ink} 16%, ${bg})`;
}

/**
 * The SUNKEN ground paired with a surface — a chip, badge, track, avatar ground,
 * empty-state panel: anything that reads as recessed INTO the surface.
 *
 * Numerically identical to surfaceField, and deliberately a SEPARATE channel
 * anyway. The two differ in the case that actually matters — what they fall back
 * to when nothing is published. A field lands on var(--color-card); a sunken area
 * lands on var(--color-muted). Collapsing them into one var would flip every chip,
 * badge and track in a plain Card from #f4f4f5 to #ffffff in the light default and
 * #26262b to #1c1c20 in the dark one: a wholesale repaint of pages that author
 * no colour at all. Same value, different resting token, so both stay.
 */
export function surfaceSunken(bg: unknown): string | null {
  return surfaceField(bg);
}

export function surfaceField(bg: unknown): string | null {
  if (typeof bg !== "string") return null;
  const L = relLuminance(bg);
  if (L == null) return null;
  const ink = L <= 0.179 ? INK_LIGHT : INK_DARK;
  return `color-mix(in srgb, ${ink} 8%, ${bg})`;
}
