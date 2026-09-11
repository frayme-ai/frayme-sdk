/**
 * Frayme social-media — 7 schemas for feed, media, and comment surfaces.
 *
 * The truly-dynamic, secure slice for
 * social/community UIs: a feed entry, an overlapping avatar stack, an image
 * gallery (with an internal lightbox), a media tile grid, a standalone lightbox
 * overlay, and a single/threaded comment surface.
 *
 * Same foundation as the shipped catalog: bounded ENUM atoms from `_shared.ts`
 * (the bounded menu a spec draws from) + the two validated VALUE channels
 * (`colorSchema` for color, `dimensionSchema(opts)` for lengths/counts). Every
 * enum/value prop is `.nullable()` + `.describe()` (one sentence naming WHEN to
 * reach for it); defaults live in the
 * renderer's CVA `defaultVariants`, so a props-less spec still renders polished.
 *
 * SECURITY: ALL images flow through `safeImageSrc` (raster-only) in the renderer;
 * a failed/absent src renders a tinted placeholder box, never a broken <img>.
 * Tile links flow through `safeUrl` + `linkTargetRel`. Icons are NAMES against
 * the closed registry. Comment/feed bodies are plain escaped text — no markup.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE) · CT count (VALUE).
 *
 * Components: FeedItem · AvatarGroup · Gallery · MediaGrid · Lightbox · Comment ·
 * CommentThread.
 */

import { z } from 'zod';
import { Aspect, colorSchema, dimensionSchema, Font, Leading, Opacity, Tracking, Weight } from './_shared.js';

/* A feed/comment action button descriptor: an icon NAME (closed registry) + an
 * optional label + an optional numeric count (a like/comment/share counter) + an
 * optional active/pressed flag. The count is a PLAIN number (not a visual
 * dimension) — it renders as text (compact when the parent sets countFormat). */
const actionItem = z.object({
  icon: z.string().nullable().describe('Icon glyph NAME from the closed registry (e.g. "heart", "message-circle" — verify it exists; unknown names render nothing).'),
  label: z.string().nullable().describe('Optional visible label next to the icon (e.g. "Like").'),
  count: z.number().nullable().describe('Optional numeric counter shown after the label (e.g. likes = 24). Plain text, not a dimension; formatted per the parent\'s `countFormat`.'),
  active: z.boolean().nullable().describe('Mark this action pressed/liked (default false) — the whole button (icon + label + count) tints to the parent\'s `accent` channel and gets aria-pressed. Use to reflect the host-written "liked" state.'),
});

/* A media tile descriptor shared by Gallery / Lightbox. */
const mediaItem = z.object({
  src: z.string().describe('Image URL (raster only; sanitized by the renderer — a bad/absent src shows a tinted placeholder).'),
  alt: z.string().describe('Alt text for the image (required for accessibility).'),
  caption: z.string().nullable().describe('Optional caption shown in the lightbox view only (Gallery grid tiles do not display it).'),
});

export const socialMediaComponents = {
  // =========================================================================
  // FeedItem — a social feed entry
  // =========================================================================
  FeedItem: {
    props: z.object({
      id: z.string().nullable().describe('Stable identifier for THIS post/feed item (e.g. a post id or slug). Echoed in the `commit` payload so the host knows which post an action fired on when several FeedItems share a feed.'),
      authorName: z.string().describe('The post author\'s name (required) — shown bold beside the avatar and used to derive its initials fallback.'),
      authorTitle: z.string().nullable().describe('Secondary line under the author name (e.g. a handle, role, or "@username").'),
      avatarSrc: z.string().nullable().describe('Author avatar image URL (raster only; falls back to initials from authorName).'),
      timestamp: z.string().nullable().describe('Right-aligned time/meta text (e.g. "2h", "Jun 24").'),
      body: z.string().describe('The post text (plain escaped text — no markdown/HTML parsing).'),
      mediaSrc: z.string().nullable().describe('Optional attached media image URL (raster only; bad/absent → a tinted placeholder).'),
      mediaAlt: z.string().nullable().describe('Alt text for the attached media image (accessibility). Falls back to `authorName` when the image loads but no alt is set; only shown as visible text if the image fails.'),
      aspect: Aspect.describe('Aspect ratio of the attached-media frame: auto · 1/1 · 4/3 · 3/2 · 16/9 (default) · 21/9 · 3/4.'),
      actions: z.array(actionItem).nullable().describe('Footer action buttons (e.g. like / comment / share). Each shows an icon + optional label + optional count + optional `active` (pressed/liked) flag; clicking emits `commit`.'),
      activeAction: z.string().nullable().describe('Write target for WHICH action/item the user triggered: bind with { $bindState } and the renderer writes the triggered action label (or its index) here before emitting, so the host can attribute the action. Emit-only when unbound.'),
      countFormat: z
        .enum(['plain', 'compact'])
        .nullable()
        .describe('How action counters render: plain (raw number, e.g. 24000, default) · compact (abbreviated, e.g. 24k / 1.2M). Applies to every action count in this item.'),
      variant: z
        .enum(['card', 'plain'])
        .nullable()
        .describe('Surface treatment: card (bordered surface, default) · plain (no border/background, for tight feeds).'),
      accent: colorSchema.describe('Brand color for a pressed/liked action (an action with `active:true` tints its icon + label + count to this; default the primary token). Names the "liked" color.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the author handle/title, the timestamp, and the resting footer action buttons (icons/labels/counters) (default the muted-foreground token).'),
      leading: Leading.describe('Line height of the post body text: tight · snug · normal · relaxed (default) · loose.'),
      font: Font.describe('Typeface for the whole feed item region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the author name (light · normal · medium · semibold · bold; default semibold).'),
      tracking: Tracking.describe('Letter-spacing of the author name (tighter · tight · normal · wide · wider; default normal).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the author name (e.g. "20px" / "1.25rem"). Default inherited (1rem).'),
    }),
    events: ['commit'],
    eventsDoc: {
      commit: 'A footer action button (like/comment/share) was pressed; params carry {id, label, index, active} — this post\'s `id`, the pressed action\'s label, its 0-based index in the actions array, and its `active`/liked state at press time. `activeAction` (when bound) is written first so the host can attribute which action fired.',
    },
    description:
      'A social feed entry: author avatar + name/title + timestamp, a text body, optional attached media, and a row of footer action buttons (like/comment/share) that emit `commit` (host-routed). An action can be marked `active` (pressed/liked, tinted by `accent`); `countFormat:"compact"` abbreviates counters (24k). Group several in a Stack for a feed. Bind `activeAction` with `{ $bindState }` so the agent (or a sibling control) can read which action label (or index) the user triggered from spec.state.',
    example: {
      authorName: 'Ada Lovelace',
      authorTitle: '@ada',
      timestamp: '2h',
      body: 'Just shipped the new analytics dashboard.',
      countFormat: 'compact',
      actions: [
        { icon: 'heart', label: 'Like', count: 24000, active: true },
        { icon: 'send', label: 'Share', count: 3 },
      ],
    },
  },

  // =========================================================================
  // AvatarGroup — overlapping avatar stack + overflow
  // =========================================================================
  AvatarGroup: {
    props: z.object({
      items: z
        .array(
          z.object({
            src: z.string().nullable().describe('Avatar image URL (raster only; falls back to initials from name).'),
            name: z.string().describe('Person name — used for initials fallback + the title/aria label.'),
            alt: z.string().nullable().describe('Optional alt text override for the avatar image (defaults to name).'),
          }),
        )
        .describe('The people in the stack. The first `max` render as overlapping avatars; the rest collapse into a "+N" chip.'),
      max: z.number().nullable().describe('How many avatars to show before collapsing the rest into a "+N" overflow chip (plain number; default 5).'),
      size: z.enum(['xs', 'sm', 'md', 'lg']).nullable().describe('Avatar diameter enum: xs (24px) · sm (28px) · md (40px, default) · lg (56px). Overridden by the exact `sizeValue` channel when set.'),
      sizeValue: dimensionSchema({ units: ['px', 'rem'], min: 16, max: 160 }).describe('Exact avatar diameter (e.g. 48px / 3rem). Overrides the `size` enum, which is the default.'),
      ring: z.boolean().nullable().describe('Add a card-colored ring between overlapping avatars so they read as separate (default true).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the "+N" overflow chip (default the muted-foreground token).'),
    }),
    description:
      'An overlapping stack of avatars with a "+N" overflow chip — for showing who is on a team / who reacted. Each avatar is an image (sanitized) or an initials fallback from the name. Reach for it wherever a compact "who" summary beats a full list: set `max` to cap how many faces show before the rest collapse into the "+N" chip, and `size`/`sizeValue` to scale the whole row.',
    example: {
      items: [{ name: 'Ada Lovelace' }, { name: 'Alan Turing' }, { name: 'Grace Hopper' }, { name: 'Edsger Dijkstra' }],
      max: 3,
    },
  },

  // =========================================================================
  // Gallery — image grid with an optional lightbox
  // =========================================================================
  Gallery: {
    props: z.object({
      items: z.array(mediaItem).describe('The images in the grid. Each has a src + alt + optional caption.'),
      columns: z.number().nullable().describe('Number of grid columns 1–6 (count channel; default 3).'),
      gap: z.enum(['none', 'sm', 'md', 'lg', 'xl']).nullable().describe('Spacing between tiles: none (0) · sm (0.375rem) · md (0.75rem, default) · lg (1.25rem) · xl (2rem). Same menu as MediaGrid.'),
      ratio: z
        .enum(['square', 'video', 'portrait', 'wide', 'auto'])
        .nullable()
        .describe('Tile aspect ratio: square (1:1, default) · video (16:9) · portrait (3:4) · wide (21:9) · auto (natural height). Same menu as MediaGrid.'),
      lightbox: z
        .boolean()
        .nullable()
        .describe('When true, clicking a tile opens a full-screen overlay at that image with prev/next + close (works without a binding). Default true.'),
      overlayColor: colorSchema.describe('Backdrop scrim color behind the lightbox image (default a fixed dark scrim, always dark in both themes). Only applies when `lightbox` is on.'),
      closeLabel: z.string().nullable().describe('Accessible label for the lightbox close (×) button (default "Close"). Set for localisation; feeds aria-label — escaped text.'),
      prevLabel: z.string().nullable().describe('Accessible label for the lightbox previous-image arrow (default "Previous"). Only shown with multiple images; escaped text.'),
      nextLabel: z.string().nullable().describe('Accessible label for the lightbox next-image arrow (default "Next"). Only shown with multiple images; escaped text.'),
      opacity: Opacity.describe('Dim the whole gallery to de-emphasise it: full (default) · 90 · 75 · 50 · 25.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], max: 64 }).describe('Corner rounding applied UNIFORMLY to every tile (e.g. "12px" / "0.75rem"; default the frayme radius). Cascades to all tiles via CSS inheritance.'),
      borderColor: colorSchema.describe('Border colour applied UNIFORMLY to every tile (default the border token). Cascades to all tiles via CSS inheritance.'),
    }),
    events: ['change'],
    eventsDoc: {
      change: 'A tile was clicked, opening the internal lightbox at that image (fires even when `lightbox` is off); params carry {index, src} — the clicked tile\'s position and image URL.',
    },
    description:
      'A responsive image grid with an optional built-in lightbox. Set `columns` for the grid width and `ratio` for tile shape. When `lightbox` is on, clicking a tile opens an internal full-screen overlay (arrows change image, Esc/close hides) and emits `change` — no binding required.',
    example: {
      items: [
        { src: 'https://example.com/a.jpg', alt: 'Mountain' },
        { src: 'https://example.com/b.jpg', alt: 'Lake' },
        { src: 'https://example.com/c.jpg', alt: 'Forest' },
      ],
      columns: 3,
    },
  },

  // =========================================================================
  // MediaGrid — responsive media tiles (display-only)
  // =========================================================================
  MediaGrid: {
    props: z.object({
      items: z
        .array(
          z.object({
            src: z.string().describe('Tile image URL (raster only; bad/absent → a tinted placeholder).'),
            alt: z.string().describe('Alt text for the tile image.'),
            label: z.string().nullable().describe('Optional caption overlaid at the bottom of the tile.'),
            href: z.string().nullable().describe('Optional navigation target — makes the whole tile a link (sanitized).'),
          }),
        )
        .describe('The media tiles. A tile with `href` becomes a link; otherwise it is a static display tile.'),
      columns: z.number().nullable().describe('Number of grid columns 1–6 (count channel; default 3).'),
      gap: z.enum(['none', 'sm', 'md', 'lg', 'xl']).nullable().describe('Spacing between tiles: none (0) · sm (0.375rem) · md (0.75rem, default) · lg (1.25rem) · xl (2rem). Same menu as Gallery.'),
      ratio: z
        .enum(['square', 'video', 'portrait', 'wide', 'auto'])
        .nullable()
        .describe('Tile aspect ratio: square (1:1, default) · video (16:9) · portrait (3:4) · wide (21:9) · auto (natural height). Same menu as Gallery.'),
      opacity: Opacity.describe('Dim the whole media grid to de-emphasise it: full (default) · 90 · 75 · 50 · 25.'),
      radiusValue: dimensionSchema({ units: ['px', 'rem'], max: 64 }).describe('Corner rounding applied UNIFORMLY to every tile (e.g. "12px" / "0.75rem"; default the frayme radius). Cascades to all tiles via CSS inheritance.'),
      borderColor: colorSchema.describe('Border colour applied UNIFORMLY to every tile (default the border token). Cascades to all tiles via CSS inheritance.'),
    }),
    description:
      'A responsive grid of media tiles for galleries, logos, or link cards. Display-only (no lightbox). A tile with `href` renders as a safe link; a `label` shows as a caption overlay. Use `columns` for grid width and `ratio` for tile shape.',
    example: {
      items: [
        { src: 'https://example.com/1.jpg', alt: 'Cover', label: 'Featured' },
        { src: 'https://example.com/2.jpg', alt: 'Album', href: 'https://example.com/album' },
      ],
      columns: 2,
    },
  },

  // =========================================================================
  // Lightbox — standalone full-screen media overlay
  // =========================================================================
  Lightbox: {
    props: z.object({
      items: z.array(mediaItem).describe('The images in the overlay (src + alt + optional caption). Prev/next steps through them.'),
      index: z.number().nullable().describe('Which image to show first (0-based; default 0). Bind it to drive the current image externally.'),
      open: z.boolean().nullable().describe('Whether the overlay is shown (default false). Bind it to open/close from elsewhere; the internal close button still works.'),
      closeLabel: z.string().nullable().describe('Accessible label for the close (×) button (default "Close"). Set for localisation; feeds aria-label — escaped text.'),
      prevLabel: z.string().nullable().describe('Accessible label for the previous-image arrow (default "Previous"). Only shown with multiple images; escaped text.'),
      nextLabel: z.string().nullable().describe('Accessible label for the next-image arrow (default "Next"). Only shown with multiple images; escaped text.'),
      overlayColor: colorSchema.describe('Backdrop scrim color behind the image (default a fixed dark scrim, always dark in both themes).'),
    }),
    events: ['change', 'dismiss'],
    eventsDoc: {
      change: 'A prev/next arrow (or an Arrow-key press) moved to another image; params carry {index, src} — the new image\'s position and URL.',
      dismiss: 'The overlay was closed (× button or Esc); params carry {index} — the index it was showing when closed.',
    },
    description:
      'A standalone full-screen media overlay (role=dialog). Prev/next arrows change the current image (internal state, seeded from `index`), close/Esc hides it (seeded from `open`) — all interactive without a binding. Bind `index`/`open` for external control. Emits `change` on navigation and `dismiss` on close.',
    example: {
      items: [
        { src: 'https://example.com/a.jpg', alt: 'Slide 1', caption: 'The first slide' },
        { src: 'https://example.com/b.jpg', alt: 'Slide 2' },
      ],
      open: true,
    },
  },

  // =========================================================================
  // Comment — a single threaded comment
  // =========================================================================
  Comment: {
    props: z.object({
      id: z.string().nullable().describe('Stable identifier for THIS comment (e.g. a comment id). Echoed in the `commit` payload so the host knows which comment an action (reply/like) fired on when several Comments are on screen.'),
      authorName: z.string().describe('The commenter\'s name (required) — shown bold beside the avatar and used to derive its initials fallback.'),
      avatarSrc: z.string().nullable().describe('Author avatar image URL (raster only; falls back to initials from authorName).'),
      timestamp: z.string().nullable().describe('Muted meta text next to the author name (e.g. "5m ago").'),
      body: z.string().describe('The comment text (plain escaped text — no markdown/HTML parsing).'),
      actions: z
        .array(actionItem)
        .nullable()
        .describe('Footer action buttons (e.g. reply / like). Each shows an icon + optional label + optional count + optional `active` (pressed/liked) flag; clicking emits `commit`.'),
      activeAction: z.string().nullable().describe('Write target for WHICH action/item the user triggered: bind with { $bindState } and the renderer writes the triggered action label (or its index) here before emitting, so the host can attribute the action. Emit-only when unbound.'),
      countFormat: z
        .enum(['plain', 'compact'])
        .nullable()
        .describe('How action counters render: plain (raw number, default) · compact (abbreviated, e.g. 24k / 1.2M). Applies to every action count on this comment.'),
      depth: z.number().nullable().describe('Nesting depth 0–6 — indents the comment to show it is a reply (plain number; default 0).'),
      accent: colorSchema.describe('Brand color for a pressed/liked action (an action with `active:true` tints its icon + label + count to this; default the primary token).'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the timestamp/meta next to the author name and the resting action buttons (icons/labels) (default the muted-foreground token).'),
      leading: Leading.describe('Line height of the comment body text: tight · snug · normal · relaxed (default) · loose.'),
      font: Font.describe('Typeface for the whole comment region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the author name (light · normal · medium · semibold · bold; default semibold).'),
      tracking: Tracking.describe('Letter-spacing of the author name + comment body (tighter · tight · normal · wide · wider; default normal).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the author name + comment body (e.g. "16px" / "1rem"). Default 0.875rem.'),
    }),
    events: ['commit'],
    eventsDoc: {
      commit: 'A footer action button (reply/like) was pressed; params carry {id, label, index, active} — this comment\'s `id`, the pressed action\'s label, its 0-based index in the actions array, and its `active`/liked state at press time. `activeAction` (when bound) is written first so the host can attribute which action fired.',
    },
    slots: ['default'],
    description:
      'A single comment: author avatar + name + timestamp, the comment text, and a row of action buttons (reply/like) that emit `commit`. Set `depth` to indent a reply, or nest replies as children (a Comment or CommentThread in the default slot). Bind `activeAction` with `{ $bindState }` so the agent (or a sibling control) can read which action label (or index) the user triggered from spec.state.',
    example: {
      authorName: 'Grace Hopper',
      timestamp: '5m ago',
      body: 'Great work — shipping this unblocks the whole team.',
      actions: [{ icon: 'send', label: 'Reply' }, { icon: 'heart', label: 'Like' }],
    },
  },

  // =========================================================================
  // CommentThread — a list of comments with nested replies
  // =========================================================================
  CommentThread: {
    props: z.object({
      comments: z
        .array(
          z.object({
            authorName: z.string(),
            avatarSrc: z.string().nullable().describe('Author avatar image URL (raster only; initials fallback).'),
            timestamp: z.string().nullable().describe('Muted meta text next to the author name.'),
            body: z.string().describe('The comment text (plain escaped text).'),
            replies: z.array(z.any()).nullable().describe('Nested replies (same comment shape). Recursion is capped at `maxDepth` and array-guarded at every level.'),
          }),
        )
        .describe('The top-level comments. Each may carry a `replies` array of the same shape, rendered recursively up to `maxDepth`.'),
      maxDepth: z.number().nullable().describe('Hard cap on reply nesting 1–6 — guards against deep/cyclic trees (default 4). Replies past the cap are not rendered.'),
      collapsible: z.boolean().nullable().describe('When true, each comment with replies shows a toggle to collapse/expand its reply subtree (works without a binding). Default true.'),
      collapsed: z
        .array(z.string())
        .nullable()
        .describe('The stable keys of comment subtrees the user has collapsed. Bind with { $bindState } so an agent/Button can read which reply threads are currently hidden; the full collapsed-key set is mirrored back here on every collapse/expand toggle.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — per-comment timestamps/meta and the collapse/expand reply toggle (default the muted-foreground token).'),
      borderColor: colorSchema.describe('Colour of the nested-reply rail — the vertical line down the left of each reply group (default the border token).'),
      leading: Leading.describe('Line height of every comment body in the thread: tight · snug · normal · relaxed (default) · loose.'),
      font: Font.describe('Typeface for the whole thread; cascades to every comment via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of every author name in the thread (light · normal · medium · semibold · bold; default semibold). Matches the standalone Comment channel.'),
      tracking: Tracking.describe('Letter-spacing of author names + comment bodies across the thread (tighter · tight · normal · wide · wider; default normal). Matches the standalone Comment channel.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of author names + comment bodies across the thread (e.g. "16px" / "1rem"). Default 0.875rem. Matches the standalone Comment channel.'),
    }),
    events: ['change'],
    eventsDoc: {
      change: 'A reply subtree was collapsed or expanded; params carry {collapsed, key} — the full resolved array of collapsed subtree keys plus the `key` of the subtree just toggled.',
    },
    description:
      'A recursive comment thread: top-level comments each with optional nested `replies` (same shape), indented per level and hard-capped at `maxDepth`. When `collapsible`, each subtree can be collapsed/expanded inline (internal state). For per-comment action buttons (reply/like), use the standalone Comment component. Bind `collapsed` with `{ $bindState }` so the agent (or a sibling control) can read the live set of collapsed reply-subtree keys from spec.state.',
    example: {
      comments: [
        {
          authorName: 'Ada Lovelace',
          timestamp: '1h',
          body: 'Loving the new feed layout.',
          replies: [{ authorName: 'Alan Turing', timestamp: '50m', body: 'Agreed — much cleaner.' }],
        },
      ],
      maxDepth: 4,
    },
  },

  // =========================================================================
  // SocialBar — a row of icon-only social / contact links
  // =========================================================================
  SocialBar: {
    props: z.object({
      items: z
        .array(
          z.object({
            network: z
              .enum(['twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'github'])
              .nullable()
              .describe('A known brand → its filled brand glyph. Use this OR `icon`; `network` wins when both are set.'),
            icon: z
              .string()
              .nullable()
              .describe('A registry glyph NAME for a non-brand link (e.g. "mail", "external-link"). Ignored when `network` is set.'),
            href: z.string().nullable().describe('Link target (http/https/mailto; unsafe schemes are neutralized). Opens in a new tab.'),
            label: z.string().nullable().describe('Accessible label / tooltip (defaults to the brand name).'),
          }),
        )
        .nullable()
        .describe('The social/contact links — each renders as an icon-only link. Items that resolve to no known glyph are skipped.'),
      size: z.enum(['sm', 'md', 'lg']).nullable().describe('Icon button diameter + glyph scale together: sm · md (default) · lg. Use `sm` for a footer strip, `lg` for a prominent contact row.'),
      variant: z
        .enum(['plain', 'filled', 'outline'])
        .nullable()
        .describe('plain (bare icon, default) · filled (accent chip with on-accent icon) · outline (bordered chip).'),
      align: z.enum(['start', 'center', 'end']).nullable().describe('Horizontal alignment of the icon row within its container: start (left, default) · center · end (right). Set `center` for a centered footer bar or `end` to right-align.'),
      accent: colorSchema.describe('Accent color — the icon color (plain/outline) or the chip fill (filled). Default is variant-dependent: muted-foreground (plain) · foreground (outline) · primary (filled).'),
      accentText: colorSchema.describe('On-accent icon color for the `filled` variant (pair with a custom `accent` so the icon stays legible on the fill; default = the on-primary token).'),
    }),
    description:
      'A row of icon-only social/contact links — Twitter/X, Facebook, Instagram, LinkedIn, YouTube, GitHub (via `network`), or any registry glyph (via `icon`). Each link opens in a new tab (rel=noopener noreferrer). `variant` sets the chip treatment, `accent` tints it. Pairs with Footer.socials.',
    example: {
      items: [
        { network: 'github', href: 'https://github.com/frayme' },
        { network: 'twitter', href: 'https://twitter.com/frayme' },
        { network: 'linkedin', href: 'https://www.linkedin.com/company/frayme' },
      ],
      variant: 'plain',
      size: 'md',
    },
  },
};
