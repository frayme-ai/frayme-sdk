/**
 * Frayme ai-chat-flow — 6 schemas for the agent reasoning + action surface.
 *
 * These ride the SAME truly-dynamic foundation as the shipped catalog:
 * bounded ENUM atoms from `_shared.ts` (the bounded menu a spec draws from) + the
 * validated VALUE channel (`colorSchema` for a color the model names directly).
 * Every enum/value prop is `.nullable()` + `.describe()` (one sentence naming
 * WHEN to reach for it); defaults live in
 * the renderer's CVA `defaultVariants`, so a props-less spec still renders
 * polished.
 *
 * This family models the *agent's own turn* inside a chat: its private
 * reasoning trace (Reasoning), the tool calls it makes (ToolCall), a checklist
 * of steps it is working through (Task), an inline approve/deny gate
 * (Confirmation), tappable follow-up prompts (Suggestion), and the "agent is
 * typing" placeholder (TypingIndicator).
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE).
 *
 * Components: Reasoning · ToolCall · Task · Confirmation · Suggestion · TypingIndicator.
 */

import { z } from 'zod';
import { BorderStyle, colorSchema, dimensionSchema, Font, Leading, Shadow, Tone, Tracking, Weight } from './_shared.js';

export const aiFlowComponents = {
  // =========================================================================
  // Reasoning — collapsible "thinking" trace
  // =========================================================================
  Reasoning: {
    props: z.object({
      content: z.string().describe('The model\'s thinking / chain-of-thought text, shown in the collapsed body (rendered as plain escaped text, never markup).'),
      duration: z
        .string()
        .nullable()
        .describe('Human-readable time spent thinking, shown in the header (e.g. "4s", "1m 12s"). Renders "Thought for {duration}" when set, otherwise just "Thought process".'),
      headerLabel: z
        .string()
        .nullable()
        .describe('Localised header text overriding the built-in English. Use the literal `{duration}` placeholder to position the duration (substituted with `duration`, or empty when none) — e.g. "Réfléchi pendant {duration}". Unset → the default "Thought for {duration}" / "Thought process". Escaped text.'),
      defaultOpen: z
        .boolean()
        .nullable()
        .describe('Start expanded (default collapsed — reasoning is hidden behind a disclosure to keep the transcript tidy).'),
      open: z
        .boolean()
        .nullable()
        .describe('Whether the reasoning trace is expanded; mirrored back into spec.state when the user toggles it. Bind with { $bindState } so an external element can read whether the trace is open. Use defaultOpen for the one-time initial state.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the header label, the sparkles header icon, the expand chevron, and the reasoning body trace (default the muted-foreground token).'),
    }),
    description:
      'A collapsible, muted "thinking" trace for an agent\'s private reasoning. Header shows a sparkles icon + "Thought for {duration}"; click to reveal the reasoning text. Place above the agent\'s final answer. Bind `open` with `{ $bindState }` so the agent (or a sibling control) can read whether the reasoning trace is expanded from spec.state.',
    example: { content: 'The user wants Q3 revenue. I should query the sales table, group by month, then sum.', duration: '4s' },
  },

  // =========================================================================
  // ToolCall — a single tool invocation card
  // =========================================================================
  ToolCall: {
    props: z.object({
      name: z.string().describe('The tool / function name being called (e.g. "search_web", "run_sql"). Shown in the header next to a tool icon.'),
      input: z
        .string()
        .nullable()
        .describe('The arguments passed to the tool, shown in the expanded body as mono escaped text (e.g. a JSON string). Never rendered as markup.'),
      output: z
        .string()
        .nullable()
        .describe('The result returned by the tool, shown in the expanded body as mono escaped text. Never rendered as markup.'),
      state: z
        .enum(['pending', 'running', 'success', 'error'])
        .nullable()
        .describe('Lifecycle of the call, shown as a colored pill: pending (queued) · running (in flight, animated) · success (done) · error (failed). Default pending.'),
      defaultOpen: z
        .boolean()
        .nullable()
        .describe('Start expanded to show input/output (default collapsed).'),
      stateLabels: z
        .object({
          pending: z.string().nullable(),
          running: z.string().nullable(),
          success: z.string().nullable(),
          error: z.string().nullable(),
        })
        .partial()
        .nullable()
        .describe('Localised text for the state pill, per state — any subset of {pending, running, success, error}. Each falls back to its English default (Pending / Running / Done / Failed). Escaped text.'),
      inputLabel: z.string().nullable().describe('Section heading above the tool input in the expanded body (default "Input"). Escaped text — set for localization.'),
      outputLabel: z.string().nullable().describe('Section heading above the tool output in the expanded body (default "Output"). Escaped text — set for localization.'),
      bg: colorSchema.describe('Background fill of the tool-call card surface (default card token).'),
      borderColor: colorSchema.describe('Border colour of the card frame — the outer edge AND the internal divider above the expanded Input/Output body (default the border token).'),
      borderStyle: BorderStyle.describe('Card border line style: solid (default) · dashed · dotted.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact card border thickness (e.g. "2px"; default 1px).'),
      mutedColor: colorSchema.describe('Secondary/muted colour — the header tool icon, the expand chevron, and the Input/Output section labels (default the muted-foreground token).'),
      shadow: Shadow.describe('Drop-shadow elevation of the tool-call card: none · sm · md · lg · xl. Raise it to make the call float above the transcript (default flat).'),
    }),
    description:
      'A collapsible card for a single agent tool call: header is a tool icon + name + a state pill (colored by `state`); the body shows the input and output as mono escaped text. Use one per tool invocation. Reach for this when you want the transcript to expose HOW the agent acted — the concrete function, its arguments, and its result — rather than just narrating it in prose. Stack several between the Reasoning trace and the final Message to show a chain of calls; drive `state` from pending→running→success/error as the call progresses, and set `defaultOpen` to reveal the input/output without a click.',
    example: { name: 'search_web', input: '{ "query": "frayme pricing" }', state: 'running' },
  },

  // =========================================================================
  // Task — a status step row
  // =========================================================================
  Task: {
    props: z.object({
      title: z.string().describe('The step / task label (e.g. "Fetch the dataset"). Shown next to a status icon.'),
      detail: z
        .string()
        .nullable()
        .describe('Secondary muted line under the title (e.g. progress note or sub-step).'),
      state: z
        .enum(['pending', 'active', 'done', 'error'])
        .nullable()
        .describe('Step status, shown as the leading icon + color: pending (empty circle, muted) · active (spinner, accent) · done (check, success) · error (x, danger). Default pending.'),
      accent: colorSchema.describe('Override color for the status icon + title. A supplied accent replaces the state tone in EVERY state (including done-green and error-red), not just active; when unset, the active state uses the primary token.'),
      mutedColor: colorSchema.describe('Secondary/muted text colour — the detail line under the title (default the muted-foreground token).'),
    }),
    description:
      'A single status row in an agent task list / plan: a state icon (circle/spinner/check/x, colored by `state`) + title + optional detail. Stack several inside a Card or Stack to show a multi-step plan progressing. Reach for this when you want a lightweight checklist of the steps an agent is working through, as opposed to a ToolCall card that details one concrete function invocation. Advance each row through `state` (pending→active→done, or error) as work lands so the reader watches the plan complete in place; the `active` row shows an animated spinner tinted by the state tone (or `accent`).',
    example: { title: 'Querying the sales table', state: 'active' },
  },

  // =========================================================================
  // Confirmation — inline approve / deny gate
  // =========================================================================
  Confirmation: {
    props: z.object({
      message: z.string().describe('The question / action to approve, shown above the two buttons (e.g. "Send this email to 12 recipients?").'),
      confirmLabel: z
        .string()
        .nullable()
        .describe('Label for the primary approve button (default "Approve").'),
      denyLabel: z
        .string()
        .nullable()
        .describe('Label for the secondary deny button (default "Deny").'),
      cancelLabel: z
        .string()
        .nullable()
        .describe('Accepted alias of `denyLabel` for the secondary deny button — the shared `confirm:{…}` block and DataTable\'s row editor both spell this button `cancelLabel`, so it is honoured here too. `denyLabel` is the canonical name and wins when both are set.'),
      tone: Tone.describe('Semantic color of the confirm button (default neutral → primary). Use `critical` for destructive actions, `success` for safe ones.'),
      bg: colorSchema.describe('Background fill of the confirmation card surface (default card token).'),
      color: colorSchema.describe(
        'On-surface text colour — the confirmation `message` AND the Deny button label — pair it with a custom `bg` so the gate stays legible over a saturated fill (defaults: the foreground token for the message, muted-foreground for Deny).',
      ),
      borderColor: colorSchema.describe('Border colour of the confirmation card (default the border token).'),
      borderStyle: BorderStyle.describe('Card border line style: solid (default) · dashed · dotted.'),
      borderWidthValue: dimensionSchema({ units: ['px'], min: 0, max: 8 }).describe('Exact card border thickness (e.g. "2px"; default 1px).'),
      shadow: Shadow.describe('Drop-shadow elevation of the confirmation card: none · sm · md · lg · xl. Raise it to make the approval gate float above the transcript (default flat).'),
      font: Font.describe('Typeface for the whole confirmation region; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the confirmation `message` (light · normal · medium · semibold · bold; default normal).'),
      tracking: Tracking.describe('Letter-spacing of the confirmation `message` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the confirmation `message` (tight · snug · normal · relaxed · loose; default normal).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the confirmation `message` (e.g. "20px" / "1.25rem"). Default 0.875rem.'),
      decision: z
        .enum(['approved', 'denied'])
        .nullable()
        .describe(
          'The user\'s verdict once the gate is answered — "approved" after the confirm button, "denied" after the deny button; null until answered. Bind with { $bindState } so an external element (e.g. a sibling Button) can read whether Approve or Deny was pressed; the renderer writes it into spec.state before emitting commit/dismiss.',
        ),
    }),
    events: ['commit', 'dismiss'],
    eventsDoc: {
      commit: 'The approve button (`confirmLabel`, default "Approve") was clicked; params carry {label} with that button\'s text.',
      dismiss: 'The deny button (`denyLabel`, default "Deny") was clicked; params carry {label} with that button\'s text.',
    },
    description:
      'An inline human-in-the-loop gate: a message + an Approve button (emits `commit`) and a Deny button (emits `dismiss`). Use to pause an agent for explicit approval before a consequential action. Bind `decision` with `{ $bindState }` so the agent (or a sibling control) can read the user\'s verdict ("approved" / "denied", null until answered) from spec.state.',
    example: { message: 'Delete 3 files from the project?', confirmLabel: 'Delete', tone: 'critical' },
  },

  // =========================================================================
  // Suggestion — a tappable suggested-prompt chip
  // =========================================================================
  Suggestion: {
    props: z.object({
      label: z.string().describe('The suggested prompt text shown on the chip (e.g. "Summarize this thread").'),
      icon: z
        .string()
        .nullable()
        .describe('Optional leading icon glyph by NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "sparkles", "search"). Never raw SVG; unknown names render nothing.'),
      size: z
        .enum(['sm', 'md'])
        .nullable()
        .describe('Chip padding + font size: sm (compact) · md (default).'),
      accent: colorSchema.describe('Resting border + leading-icon color (defaults: the border token for the border, muted-foreground for the icon). Hover and focus-ring styling are fixed (muted hover, primary ring) and unaffected. Names a brand color for the chip.'),
      font: Font.describe('Typeface for the whole suggestion chip; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font.'),
      weight: Weight.describe('Font weight of the chip `label` (light · normal · medium · semibold · bold; default medium).'),
      tracking: Tracking.describe('Letter-spacing of the chip `label` (tighter · tight · normal · wide · wider; default normal).'),
      leading: Leading.describe('Line-height of the chip `label` (tight · snug · normal · relaxed · loose; default normal).'),
      fontSize: dimensionSchema({ units: ['px', 'rem'], min: 8, max: 96 }).describe('Exact font size of the chip `label` (e.g. "20px" / "1.25rem"). Overrides the `size` enum default (sm 0.8125rem · md 0.875rem).'),
    }),
    events: ['commit'],
    eventsDoc: {
      commit: 'The chip was clicked; params carry {label} with the suggested prompt text — typically fed straight into the composer/send flow.',
    },
    description:
      'A tappable suggested-prompt chip-button that emits `commit` when clicked. Render several in a row/wrap under a chat to offer quick follow-up prompts. Reach for this when you want to nudge the user toward likely next questions instead of leaving the composer blank — a one-tap shortcut that skips typing. On click it emits `commit` with `{label}` carrying the chip text, which a host typically feeds straight into the PromptInput / send flow; add an `icon` glyph to hint the prompt category.',
    example: { label: 'Summarize this thread', icon: 'sparkles' },
  },

  // =========================================================================
  // TypingIndicator — animated "agent is typing" dots
  // =========================================================================
  TypingIndicator: {
    props: z.object({
      label: z
        .string()
        .nullable()
        .describe('Optional text shown before the dots (e.g. "Assistant is thinking"). Omit for just the three dots.'),
      mutedColor: colorSchema.describe('Secondary/muted colour — the label shown before the dots AND the three bouncing dots themselves (default the muted-foreground token).'),
    }),
    description:
      'An "agent is typing" placeholder: three animated bouncing dots with an optional leading label. Show while waiting for the agent\'s next message. Reach for this when the assistant has not started streaming yet and you want a low-key liveness cue — as opposed to the Shimmer placeholder that mocks up the shape of arriving text. Drop it in the Conversation where the next Message will land and swap it out once the real content begins; add a `label` (e.g. "Assistant is thinking") for context, or leave it as just the dots.',
    example: { label: 'Assistant is typing' },
  },
};
