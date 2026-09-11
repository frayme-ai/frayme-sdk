/**
 * Frayme ai-chat-core — 4 schemas for the chat shell (Conversation, Message,
 * MessageContent, PromptInput).
 *
 * Rides the SAME truly-dynamic foundation as the shipped catalog: bounded
 * ENUM atoms (the bounded menu a spec draws from) + the validated VALUE channels
 * (`colorSchema` for color the model names directly; the renderer turns a valid
 * value into an inline `--fr-<comp>-<role>` CSS var — data, never a class). Every
 * enum/value prop is `.nullable()` + `.describe()` (one sentence naming WHEN to
 * reach for it); defaults live in the
 * renderer's CVA `defaultVariants`, so a props-less spec still renders polished.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE).
 *
 * `avatar` is an image source — guarded with the same isSafeImageSrc refine used
 * in shadcn-base.ts (kept local; no dep added) and re-sanitized at point-of-use
 * in the renderer (safeImageSrc). The Conversation is a scroll container that
 * holds Message children (slots:['default']); PromptInput is the composer.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema, Font, Weight, Tracking, Leading, Shadow } from './_shared.js';

// URL-scheme guard for image sources (defense-in-depth alongside the renderer's
// runtime safeImageSrc): reject specs carrying javascript:/vbscript:/file: in an
// avatar src (data: images are legitimate). Mirrors the helper in shadcn-base.ts
// (kept local — no dep added). Control chars stripped so `java\tscript:` can't slip past.
const stripWhitespace = (s: string): string => s.replace(/\s/g, '');
const isSafeImageSrc = (s: string): boolean =>
  !/^\s*(javascript|vbscript|file):/i.test(stripWhitespace(s));

export const aiChatComponents = {
  // =========================================================================
  // Conversation — the scrollable message log shell
  // =========================================================================
  Conversation: {
    props: z.object({
      density: z
        .enum(['compact', 'normal', 'comfortable'])
        .nullable()
        .describe('Vertical gap between messages: compact (dense logs) · normal (default) · comfortable (roomy).'),
      bordered: z
        .boolean()
        .nullable()
        .describe('Wrap the log in a bordered card surface — use when the chat sits inside a larger page; omit for a flush full-bleed thread.'),
      maxHeight: z
        .enum(['sm', 'md', 'lg', 'full'])
        .nullable()
        .describe('Scroll viewport height: sm · md (default) · lg · full (no cap; the page scrolls instead).'),
      autoScroll: z
        .boolean()
        .nullable()
        .describe('Keep the log pinned to the newest message as messages are appended (default true) — the expected live-thread behaviour. Set false to leave the reader\'s scroll position alone when new messages arrive.'),
      bg: colorSchema.describe('Exact background fill of the conversation surface (default card token).'),
      borderColor: colorSchema.describe('Border colour of the bordered card surface (default the border token; applies when `bordered`).'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact thickness of the bordered card surface border (e.g. "2px"; default 1px; applies when `bordered`).'),
    }),
    slots: ['default'],
    events: [],
    description:
      'The scrollable chat log shell — a vertical, auto-scrolling container (role="log", aria-live polite) that holds Message children. Wrap the messages of a chat thread in this; pair with a PromptInput below it. Reach for this as the outermost frame of any conversation surface — it owns the scroll viewport and live-region semantics so individual Message rows do not have to. By default `autoScroll` pins the log to the newest message as rows are appended (the live-thread behaviour); set `bordered` when the chat sits inside a larger page rather than filling it.',
    example: { density: 'normal', bordered: true },
  },

  // =========================================================================
  // Message — one chat row / bubble
  // =========================================================================
  Message: {
    props: z.object({
      content: z.string().describe('The message body text (rendered as escaped text, newlines preserved).'),
      role: z
        .enum(['user', 'assistant', 'system', 'tool'])
        .nullable()
        .describe('Who sent it: user (right-aligned accent bubble) · assistant (left card, default) · system / tool (muted, full-width note).'),
      author: z.string().nullable().describe('Display name shown above the bubble (also seeds the avatar initials when no avatar image).'),
      timestamp: z.string().nullable().describe('Pre-formatted time string shown next to the author (e.g. "2:14 PM"). Display only — not parsed.'),
      avatar: z
        .string()
        .refine(isSafeImageSrc, 'avatar uses an unsafe URL scheme')
        .nullable()
        .describe('Avatar image URL. When absent, initials are derived from `author`. http(s) or raster data: only.'),
      streaming: z
        .boolean()
        .nullable()
        .describe('Show a blinking caret after the content to signal the message is still being generated.'),
      accent: colorSchema.describe('Bubble fill + avatar fill for the user role / accent for the author label (default primary token). Wins over the role default; the assistant avatar deliberately stays the muted token.'),
      accentText: colorSchema.describe('Text colour ON the bubble fill — the user bubble always (default the on-primary token); assistant/system/tool bubbles when set (pair with a custom `bg` or `accent` so a dark repaint keeps legible text; their defaults are the card-/muted-foreground tokens).'),
      bg: colorSchema.describe('Exact background fill of the bubble/card (default per role). Wins over the role default.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the author meta row + timestamp (default the muted-foreground token).'),
      showAvatar: z
        .boolean()
        .nullable()
        .describe('Show the leading avatar bubble on user/assistant rows (default true). The bubble is auto-hidden anyway when there is neither an avatar image nor derivable author initials (an empty circle reads as a broken image); set false to force it off even when initials exist.'),
      font: Font.describe('Typeface for the whole message row; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the message body text (light · normal · medium · semibold · bold; default normal).'),
      tracking: Tracking.describe('Letter-spacing of the message body text (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the message body text (tight · snug · normal · relaxed · loose; default relaxed).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the message body text (e.g. "16px" / "1rem"). Default 0.875rem (0.8125rem for the system/tool roles).'),
    }),
    events: [],
    description:
      'A single chat row: avatar + author/timestamp + a role-styled bubble. `role` picks the layout — user bubbles align right in the accent color, assistant render as a left card, system/tool as a muted note. Place inside a Conversation.',
    example: { role: 'assistant', author: 'Frayme', content: 'Sure — here is a draft of the pricing page.' },
  },

  // =========================================================================
  // MessageContent — a composable message body block
  // =========================================================================
  MessageContent: {
    props: z.object({
      content: z.string().describe('The body text to render (escaped React text, whitespace preserved).'),
      variant: z
        .enum(['text', 'markdown'])
        .nullable()
        .describe('Rendering mode: text (plain, default) · markdown (a SAFE inline subset — bold, italic, inline code — tokenized into escaped React elements; never raw HTML or links).'),
      mono: z.boolean().nullable().describe('Render in a monospace font (e.g. for a tool result or a snippet).'),
      prose: z.boolean().nullable().describe('Apply relaxed reading width + paragraph spacing for a longer-form answer.'),
      font: Font.describe('Typeface for the whole content block; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the body text: light · normal (default) · medium · semibold · bold.'),
      tracking: Tracking.describe('Letter-spacing of the body text: tighter · tight · normal (default) · wide · wider.'),
      leading: Leading.describe('Line height of the body text: tight · snug · normal · relaxed (default) · loose; wins over the prose preset when set.'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the body text (e.g. "16px" / "1rem"). Default 0.875rem (0.85em when `mono`).'),
      color: colorSchema.describe('Primary text colour of the body block (default the foreground token).'),
    }),
    events: [],
    description:
      'A composable message-body block (escaped text, newlines preserved) for when a Message needs richer content than its own `content` string. Drop one or more inside a Message to build a multi-part answer. Reach for this when a single answer mixes formats — a prose paragraph, then a mono tool result, then more prose — each as its own block with its own `variant`/`mono`/`prose` treatment, rather than cramming everything into the Message `content` string. Set `variant:"markdown"` for a SAFE inline subset (bold, italic, inline code) tokenized into escaped React elements — never raw HTML or links.',
    example: { content: 'Here are the three options I found.', prose: true },
  },

  // =========================================================================
  // PromptInput — the composer (textarea + send)
  // =========================================================================
  PromptInput: {
    props: z.object({
      placeholder: z.string().nullable().describe('Greyed hint text inside the empty composer (e.g. "Ask anything…").'),
      value: z.string().nullable().describe('Current draft text. Bind via $bindState for a two-way controlled composer.'),
      name: z.string().nullable().describe('Form field name for the composed message (submitted on send).'),
      size: z
        .enum(['sm', 'md', 'lg'])
        .nullable()
        .describe('Composer height + font size: sm · md (default) · lg.'),
      disabled: z.boolean().nullable().describe('Grey out + block input (e.g. while not connected).'),
      loading: z.boolean().nullable().describe('Show a spinner on the send button + block submit while a reply is generating.'),
      attach: z.boolean().nullable().describe('Show a leading paperclip attach button. When clicked it emits `commit` with intrinsic params {control:"attach"} (not {value}), so a host can wire a file picker — no dedicated event/verb.'),
      accent: colorSchema.describe('Send button fill + focus ring color (default primary token).'),
      accentText: colorSchema.describe('Icon/text colour ON the filled send button — pair with a saturated `accent` so the glyph stays legible (default the on-primary token).'),
      borderColor: colorSchema.describe('Border color of the composer frame (default the border token). Name a brand color to tint the textarea outline; pair with `borderWidthValue` for a heavier frame.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact thickness of the composer border (e.g. "2px"; default 1px).'),
      bg: colorSchema.describe('Background fill of the composer textarea surface (default the card token). Set a custom fill to match the surrounding page. Keep it light enough for the foreground token, which is what the typed text uses — `accentText` colours only the SEND BUTTON glyph and cannot rescue an unreadable composer.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the greyed placeholder hint and the attach (paperclip) button icon (default the muted-foreground token).'),
      shadow: Shadow.describe('Drop shadow on the composer surface to lift it off the page: none (default, flat) · sm · md · lg · xl.'),
      emitOnChange: z
        .boolean()
        .nullable()
        .describe(
          'Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream.',
        ),
    }),
    events: ['change', 'commit'],
    eventsDoc: {
      change: 'Fires on every keystroke in the textarea (only when emitOnChange !== false); params carry {value} with the current draft text.',
      commit: 'Fires for the SEND action (Enter without Shift + not IME-composing, or a send-button click) — params carry {value} with the full draft; AND for the `attach` paperclip button — params carry {control:"attach"} (no value) so a host can distinguish it and open a file picker. Both no-op while `disabled` or `loading`.',
    },
    description:
      'The chat composer: a bordered textarea with a trailing send button. Enter (without Shift) emits `commit` with {value}; typing emits `change`. The optional attach button emits `commit` with {control:"attach"}. Bind `value` with $bindState to control the draft. Place directly below a Conversation.',
    example: { placeholder: 'Ask anything…', attach: true },
  },
};
