/**
 * Frayme media-extended — 5 long-tail media schemas on the locked
 * truly-dynamic foundation.
 *
 * Same contract as the shipped components: bounded ENUM atoms (the bounded menu a spec draws from) + the two validated VALUE channels (`colorSchema` for a color,
 * `dimensionSchema` for a length). Every enum/value prop is `.nullable()` +
 * `.describe()` (one sentence naming WHEN to reach for it); defaults live in the renderer's CVA `defaultVariants`, so a
 * props-less spec still renders polished.
 *
 * SECURITY / media-specific contract (non-negotiable):
 *  - Every media `src`/`poster` is spec text. The renderer scheme-checks it at the
 *    point of use — a navigable/media URL through `safeUrl` (rejects
 *    javascript:/data:text/html), a raster image through `safeImageSrc` (http/https
 *    + raster data: only, svg+xml + blob: rejected). An invalid/absent value
 *    renders a muted placeholder, never an active resource.
 *  - No `<video>`/`<audio>` ever gets custom JS controls or capture — native
 *    `controls` only. `autoplay` forces `muted` + `playsInline` (browser policy
 *    AND no surprise audio).
 *  - Marquee/Figure/Thumbnail content is rendered as ESCAPED React text nodes —
 *    never markup, never innerHTML.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE) · D dimension (VALUE).
 *
 * Components: VideoPlayer · AudioPlayer · Marquee · Figure · Thumbnail · YouTube.
 */

import { z } from 'zod';
import { Aspect, BorderStyle, colorSchema, dimensionSchema, Opacity, Radius } from './_shared.js';

/* An exact square-size VALUE (gate DIM_KEY `sizeValue`) — a real CSS length for
 * BOTH width and height of the square thumbnail box, applied via the renderer's
 * `--fr-thumb-size` var; an invalid/absent value lets the `size` enum win. */
const thumbSizeValue = dimensionSchema({ units: ['px', 'rem'], min: 16, max: 256 });

/* Corner-rounding ENUM (the shared menu) — reused by the media surfaces. */
const mediaRadius = Radius.describe('Corner rounding of the media frame: none · sm · md (default) · lg · full.');

/* Exact corner-radius VALUE (gate DIM_KEY `radiusValue`) — a real CSS length for
 * the media frame, applied via the renderer's `--fr-<comp>-radius` var; an
 * invalid/absent value lets the `radius` enum win. */
const mediaRadiusValue = dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe(
  'Exact corner radius of the media frame (e.g. "12px" / "0.75rem"; 0–64px). Overrides the `radius` enum, which is the default.',
);

/* A width VALUE (gate DIM_KEY `width`) — a real CSS length, applied via the
 * renderer's `--fr-<comp>-width` var; an invalid/absent value lets the natural
 * width win. */
const mediaWidth = dimensionSchema({ units: ['px', 'rem', '%'], max: 1600 }).describe(
  'Width of the media block (e.g. "480px", "100%"; default fills the container). Applied as a fixed width, not a max-width — a value wider than the parent column will overflow rather than shrink.',
);

/* Secondary/muted text VALUE (gate COLOR_KEY `mutedColor`) — the caption/credit
 * colour; an invalid/absent value lets the muted-foreground token win. */
const mediaMutedColor = colorSchema.describe(
  'Secondary/muted text colour — captions and credit lines below the media (default the muted-foreground token).',
);

export const mediaExtendedComponents = {
  // =========================================================================
  // VideoPlayer — native <video controls> wrapper (no custom controls)
  // =========================================================================
  VideoPlayer: {
    props: z.object({
      src: z.string().nullable().describe('Video URL (http/https). Scheme-checked; javascript:/data:text/html are rejected → placeholder.'),
      poster: z.string().nullable().describe('Still-image shown before playback (raster image src; svg+xml/blob rejected).'),
      controls: z.boolean().nullable().describe('Show the browser’s native playback controls (default true). Never custom JS controls.'),
      autoplay: z.boolean().nullable().describe('Begin playback on load (default false). Forces muted + inline playback per browser policy.'),
      loop: z.boolean().nullable().describe('Restart the clip automatically from the beginning when it ends (default false). Reach for it on short ambient/background loops; leave off for normal watch-once playback.'),
      muted: z.boolean().nullable().describe('Start playback muted with volume at zero (default false). Forced on when `autoplay` is set, per browser policy; set it explicitly for a silent hero video the viewer un-mutes.'),
      aspect: Aspect.describe(
        'Aspect ratio of the frame: 16/9 (default, widescreen) · 4/3 · 3/2 · 1/1 (square) · 21/9 (cinematic) · 3/4 (portrait) · auto.',
      ),
      radius: mediaRadius,
      radiusValue: mediaRadiusValue,
      width: mediaWidth,
      caption: z.string().nullable().describe(
        'Muted caption line below the player frame (e.g. "Product demo — 90s"). Omit for no caption; rendered only when non-empty.',
      ),
      mutedColor: mediaMutedColor.describe(
        'Secondary/muted text colour — the caption below the player (default the muted-foreground token).',
      ),
      borderColor: colorSchema.describe('Frame border colour of the video box (default the border token). Part of the media-family border group (AudioPlayer/Figure/Thumbnail/YouTube).'),
      borderStyle: BorderStyle.describe('Border line style of the video frame: solid (default) · dashed · dotted.'),
      opacity: Opacity.describe('Dim the player frame for a preview/inactive look: full (default) · 90 · 75 · 50 · 25.'),
    }),
    description:
      'A native HTML5 video player (browser controls only — no custom UI, no capture). Aspect-locked frame; an invalid/absent `src` shows a muted placeholder. `autoplay` forces muted+inline.',
    example: { src: 'https://example.com/demo.mp4', aspect: '16/9', controls: true },
  },

  // =========================================================================
  // AudioPlayer — native <audio controls> wrapper inside a small card
  // =========================================================================
  AudioPlayer: {
    props: z.object({
      src: z.string().nullable().describe('Audio URL (http/https). Scheme-checked; unsafe schemes are rejected → "No audio" state.'),
      title: z.string().nullable().describe(
        'Track title shown above the controls (e.g. "Episode 12 — Shipping MCP Apps"). Omit for no title line; tints with `accent`.',
      ),
      controls: z.boolean().nullable().describe('Show the browser’s native play/scrub/volume controls (default true). Turn off only when a surrounding UI drives playback; there is never a custom JS control bar.'),
      loop: z.boolean().nullable().describe('Restart the track automatically from the start when it ends (default false). Reach for it on looping ambience or a short sample; leave off for a normal listen-once track.'),
      accent: colorSchema.describe('Accent color of the surrounding card — tints the left card edge (default the border token, i.e. a neutral edge until set) and the title text (default the foreground token).'),
      borderColor: colorSchema.describe('Card border colour (default the border token). Part of the media-family border group (VideoPlayer/Figure/Thumbnail/YouTube); set a brand value to match a surrounding surface.'),
      borderStyle: BorderStyle.describe('Border line style of the card: solid (default) · dashed · dotted.'),
      radius: mediaRadius,
      radiusValue: mediaRadiusValue,
      width: mediaWidth,
      opacity: Opacity.describe('Dim the audio card for a preview/inactive look: full (default) · 90 · 75 · 50 · 25.'),
    }),
    description:
      'A native HTML5 audio player in a compact card (title + browser controls). An invalid/absent `src` shows a muted "No audio" state. `accent` tints the card edge.',
    example: { src: 'https://example.com/track.mp3', title: 'Episode 12 — Shipping MCP Apps' },
  },

  // =========================================================================
  // Marquee — auto-scrolling strip (CSS-keyframed, seamless loop)
  // =========================================================================
  Marquee: {
    props: z.object({
      items: z
        .array(z.string())
        .nullable()
        .describe('The strip’s text items (rendered as escaped text). When omitted, the element’s children are scrolled instead.'),
      direction: z
        .enum(['left', 'right', 'up', 'down'])
        .nullable()
        .describe('Scroll direction: left (default) · right · up · down.'),
      speed: z.enum(['slow', 'normal', 'fast']).nullable().describe('Scroll speed: slow (~28s) · normal (~18s, default) · fast (~10s).'),
      pauseOnHover: z.boolean().nullable().describe('Pause the animation while the pointer is over it (default true).'),
      gap: z
        .enum(['none', 'sm', 'md', 'lg', 'xl'])
        .nullable()
        .describe('Spacing between items: none · sm · md (default) · lg · xl.'),
      fade: z.boolean().nullable().describe('Fade the leading/trailing edges with a mask (default false).'),
      opacity: Opacity.describe('Dim the whole strip for a background/inactive look: full (default) · 90 · 75 · 50 · 25.'),
      color: colorSchema.describe('Text colour of the strip items (default the foreground token). Set a muted value for a subtle logo-cloud tone, or a brand value for a loud ticker.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Item text size: sm (0.75rem) · md (0.875rem, default) · lg (1rem). Logo-cloud marquees typically run larger.'),
      height: dimensionSchema({ units: ['px', 'rem'], min: 24, max: 800 }).describe('Viewport height of the VERTICAL strip (direction up/down; e.g. "16rem"; default 12rem). No effect on horizontal marquees.'),
    }),
    description:
      'An auto-scrolling marquee strip. Supply `items` (escaped text) or children; the content is duplicated for a seamless CSS loop. `speed`/`direction` are fixed enums; `pauseOnHover` and `fade` polish it; `color`/`size` tune the item tone and `height` sizes the vertical viewport.',
    example: { items: ['Acme', 'Globex', 'Initech', 'Umbrella'], speed: 'normal' },
  },

  // =========================================================================
  // Figure — image with a caption (semantic <figure>)
  // =========================================================================
  Figure: {
    props: z.object({
      src: z.string().nullable().describe('Image URL (raster image src; svg+xml/blob rejected → placeholder).'),
      alt: z.string().nullable().describe('Alternative text describing the image for screen readers and when the image fails to load (a11y; default empty). Set it on every content image; leave empty only for purely decorative figures.'),
      caption: z.string().nullable().describe(
        'Muted caption line under the image (e.g. "Q4 revenue by product line"). Combines with `credit` on one line ("caption — credit"); omit for no caption.',
      ),
      credit: z.string().nullable().describe('Optional attribution line appended to the caption (e.g. "Photo: NASA").'),
      align: z.enum(['start', 'center', 'end']).nullable().describe('Horizontal alignment of the figure block (default center).'),
      ratio: z
        .enum(['auto', '16/9', '4/3', '1/1', '21/9', '3/2'])
        .nullable()
        .describe(
          'Aspect ratio of the image frame: auto (natural, default) · 16/9 · 4/3 · 1/1 · 21/9 (ultrawide/panoramic) · 3/2.',
        ),
      fit: z
        .enum(['cover', 'contain'])
        .nullable()
        .describe('How the image fills a locked `ratio` frame: cover (crop to fill, default) · contain (letterbox the whole image on a muted mat — use for charts/diagrams/screenshots where cropping loses content). No effect when `ratio` is auto.'),
      radius: mediaRadius,
      radiusValue: mediaRadiusValue,
      bordered: z.boolean().nullable().describe(
        'Draw a border around the image frame using `borderColor`/`borderStyle` (default false — no border).',
      ),
      borderColor: colorSchema.describe('Border colour when `bordered` is set (default the border token).'),
      borderStyle: BorderStyle.describe('Border line style when `bordered` is set: solid (default) · dashed · dotted.'),
      width: mediaWidth,
      mutedColor: colorSchema.describe(
        'Secondary/muted text colour — the caption and credit line under the image (default the muted-foreground token).',
      ),
      opacity: Opacity.describe('Dim/watermark the figure: full (default) · 90 · 75 · 50 · 25.'),
    }),
    description:
      'A semantic figure: an image with a muted caption (and optional credit). An invalid/absent `src` shows an aspect-locked placeholder. `ratio` locks the frame; `align` positions the block.',
    example: { src: 'https://example.com/chart.png', alt: 'Revenue chart', caption: 'Q4 revenue by product line' },
  },

  // =========================================================================
  // Thumbnail — small fixed-size preview image with initials fallback
  // =========================================================================
  Thumbnail: {
    props: z.object({
      src: z.string().nullable().describe('Image URL (raster image src; svg+xml/blob rejected → initials fallback).'),
      alt: z.string().nullable().describe('Alternative text describing the thumbnail image for screen readers and on load failure (a11y; default empty). Set it to the person or object shown (e.g. a name for an avatar); leave empty for a decorative tile.'),
      size: z
        .enum(['xs', 'sm', 'md', 'lg', 'xl'])
        .nullable()
        .describe('Fixed square size: xs (24px) · sm (32px) · md (48px, default) · lg (64px) · xl (96px).'),
      sizeValue: thumbSizeValue.describe(
        'Exact square size, both width and height (e.g. "40px" / "2.5rem"; 16–256px). Overrides the `size` enum, which is the default.',
      ),
      radius: Radius.describe('Corner rounding: none · sm · md (default) · lg · full (circle).'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], min: 0, max: 64 }).describe(
        'Exact corner radius of the thumbnail (e.g. "10px" / "0.5rem"; 0–64px). Overrides the `radius` enum, which is the default.',
      ),
      bordered: z.boolean().nullable().describe('Draw a subtle border around the thumbnail using `borderColor`/`borderStyle` (default false — no border). Reach for it to separate a light image from a light card, or to ring an avatar.'),
      borderColor: colorSchema.describe('Border colour when `bordered` is set (default the border token).'),
      borderStyle: BorderStyle.describe('Border line style when `bordered` is set: solid (default) · dashed · dotted.'),
      fallbackInitials: z
        .string()
        .nullable()
        .describe('Initials shown in a muted block when `src` is missing/invalid (e.g. "AC").'),
      opacity: Opacity.describe('Dim the thumbnail: full (default) · 90 · 75 · 50 · 25.'),
    }),
    description:
      'A small fixed-size preview image (object-cover) for lists and cards. An invalid/absent `src` falls back to a muted block with `fallbackInitials` centered. Reach for it as an avatar or list-row thumbnail where you want a guaranteed square that never breaks layout — pick the box with the `size` enum or an exact `sizeValue`, and set `radius` to `full` for a circular avatar.',
    example: { src: 'https://example.com/avatar.png', alt: 'Ada Lovelace', size: 'md', fallbackInitials: 'AL' },
  },

  // =========================================================================
  // YouTube — privacy-light video card (thumbnail + play + link; NO iframe)
  // =========================================================================
  YouTube: {
    props: z.object({
      videoId: z
        .string()
        .nullable()
        .describe('The 11-character YouTube video id (e.g. "dQw4w9WgXcQ"). Takes precedence over `url`; validated to [A-Za-z0-9_-]{11} before any URL is built.'),
      url: z
        .string()
        .nullable()
        .describe('A full YouTube URL (watch?v=… · youtu.be/… · /embed/… · /shorts/…) to parse the id from when `videoId` is absent.'),
      title: z.string().nullable().describe('Title shown under the thumbnail (escaped text; default empty). Set the real video title so the card reads clearly and the link is labelled; hide the line entirely with `showTitle: false`.'),
      duration: z.string().nullable().describe('Optional runtime badge shown bottom-right over the thumbnail (e.g. "12:34", "1:02:00"). Pre-formatted escaped text — Frayme never fetches it. Omit for no badge.'),
      thumbnailQuality: z
        .enum(['default', 'mq', 'hq', 'sd', 'maxres'])
        .nullable()
        .describe('Thumbnail resolution: default (120p) · mq (320p) · hq (480p, default) · sd (640p) · maxres (1280p — may 404 for older videos).'),
      aspect: Aspect.describe(
        'Aspect ratio of the thumbnail frame: 16/9 (default) · 4/3 · 3/2 · 1/1 · 21/9 · 3/4 · auto.',
      ),
      showTitle: z.boolean().nullable().describe('Show the title line under the thumbnail (default true).'),
      radius: mediaRadius,
      radiusValue: mediaRadiusValue,
      width: mediaWidth,
      borderColor: colorSchema.describe('Thumbnail-frame border colour (default the border token).'),
      borderStyle: BorderStyle.describe('Border line style of the thumbnail frame: solid (default) · dashed · dotted.'),
      color: colorSchema.describe('Primary text colour of the title line under the thumbnail (default the foreground token). Also labels the invalid-id placeholder card.'),
      opacity: Opacity.describe('Dim the card for a preview/inactive look: full (default) · 90 · 75 · 50 · 25.'),
    }),
    description:
      'A lightweight YouTube card: the video thumbnail with a play-button overlay that LINKS OUT to youtube.com in a new tab, plus an optional `duration` corner badge. NO iframe is embedded — sandbox-safe, no third-party cookies, zero CSP frame-src. Provide `videoId` or a `url` to parse; an invalid id renders a muted placeholder.',
    example: { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', thumbnailQuality: 'hq', duration: '3:33' },
  },
};
