'use client';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { cva } from 'class-variance-authority';
import type { ComponentRenderProps } from '../upstream.js';
import { useStateValue } from '../upstream.js';
import { useIntrinsicEmit, useCommitLatch } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars, borderStyleClass, shadowClass, fontClass, weightClass, trackingClass, leadingClass } from './_style.js';
import { useLocalOrBound } from './_state.js';
import { useAriaId } from './_aria.js';
import { Icon } from './icons.js';

/* Catalog group (ai-chat-flow): Reasoning, ToolCall, Task, Confirmation,
 * Suggestion, TypingIndicator — the agent reasoning + action surface.
 *
 * Same truly-dynamic contract as the shipped 57:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (a color the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities. The class set stays a
 *     closed, build-time set (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing/absent
 *     value so the token fallback wins (props-less → polished).
 *
 * value > enum precedence (Task `accent` over the state tokens): the CONDITIONAL
 * override class — the GROUP-FORM `text-[color:var(--fr-…)]` utility is only
 * added to cn() when the model supplied that value (`p.accent != null`), so the
 * enum/state class wins when absent and the var wins when present (added LAST →
 * tailwind-merge dedupes the competing text-* token).
 *
 * Icons are NAMES resolved against the closed `icons.ts` registry (never raw
 * SVG; unknown/null name → nothing). Reasoning/ToolCall bodies (content/input/
 * output) render as ESCAPED React text — split into lines and mapped to spans —
 * so spec text can NEVER reach the DOM as markup. TypingIndicator reuses the
 * existing `fr-bounce` keyframe via the same staggered classes as the Spinner
 * `dots` variant (no new keyframe added). */

/* ── tiny shared bits ─────────────────────────────────────────────────────── */

/** Render a (possibly null) string as escaped, line-broken mono text.
 *
 *  `text-foreground` KEPT (not inherited): both readers paint their own surface —
 *  Reasoning's `bg-muted/50` and ToolCall's opaque `bg-card` — and an authored
 *  Card sets --fr-card-bg, never --color-muted/--color-card, so both stay LIGHT
 *  inside a dark card. Measured on Card bg:#12161f color:#e2e6f0: on the 50% wash
 *  the token reads 4.80:1 and the inherited ink 2.96:1; on bg-card, 17.72:1 vs
 *  1.25:1. Inheriting here is the same bug pointing the other way. (The 50% wash
 *  is the closest call in this file — at 30% the arithmetic flips, which is why
 *  each translucent surface is composited rather than eyeballed.) */
function MonoText({ text }: { text: string }): ReactNode {
  const lines = text.split('\n');
  return (
    <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[0.8125rem] leading-relaxed text-foreground">
      {lines.map((line, i) => (
        <span key={i} className="block">
          {/* React escapes this text node — never interpreted as HTML. */}
          {line.length > 0 ? line : '​'}
        </span>
      ))}
    </pre>
  );
}

/* ── Reasoning ────────────────────────────────────────────────────────────── */

const reasoningWrap = 'rounded-frayme border border-border bg-muted/50 text-sm';
const reasoningHeader =
  'flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-[0.8125rem] font-medium [color:var(--fr-reason-muted,var(--color-muted-foreground))] transition-colors hover:text-foreground';

export function Reasoning({ element, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    content: string;
    duration?: string | null;
    headerLabel?: string | null;
    defaultOpen?: boolean | null;
    open?: boolean | null;
    mutedColor?: string | null;
  };
  // Disclosure state mirrored into spec.state when the model binds `open`; falls
  // back to local state (byte-identical unbound), seeded from open ?? defaultOpen.
  const [open, setOpen] = useLocalOrBound<boolean>(p.open ?? p.defaultOpen === true, (bindings as { open?: unknown } | undefined)?.open);
  const content = typeof p.content === 'string' ? p.content : '';
  // Localisable header. A supplied headerLabel substitutes the `{duration}`
  // placeholder with the duration (empty when none). Unset → the exact current
  // English literals (byte-identical): "Thought for {duration}" / "Thought process".
  const headerText =
    typeof p.headerLabel === 'string'
      ? p.headerLabel.replace('{duration}', p.duration ?? '')
      : p.duration != null
        ? `Thought for ${p.duration}`
        : 'Thought process';
  // The reasoning body's DOM id — what the header's `aria-expanded` expanded.
  // Instance-unique (not spec-id-only): json-render's `repeat` re-renders this
  // element once per row reusing one spec id, which put the SAME id on every
  // row's body and pointed row two's header at row one's. Measured, not assumed.
  const bodyId = useAriaId('reasoning', element)();
  return (
    <div
      className={cn(reasoningWrap)}
      data-open={open}
      style={styleVars({ var: '--fr-reason-muted', value: p.mutedColor, kind: 'color' })}
    >
      <button
        type="button"
        className={cn(reasoningHeader)}
        aria-expanded={open === true}
        // The body is MOUNTED only while open, so aria-controls is emitted only
        // while open. It shipped unconditional, which meant a collapsed Reasoning
        // pointed a reader at an id that is not in the document — the same defect
        // Toggletip was fixed for (see toggletip-disclosure.test.tsx): a dangling
        // IDREF is strictly worse than none, because the reader follows it and
        // lands nowhere instead of just reading the trigger. ARIA only RECOMMENDS
        // aria-controls for a disclosure, so dropping it while collapsed costs
        // nothing; keeping the promise resolvable is the part that matters.
        aria-controls={open === true ? bodyId : undefined}
        onClick={() => setOpen(!open)}
      >
        {/* No own colour class: the icon inherits the header's var-driven muted
            colour (like the chevron), so a custom mutedColor keeps one-tone. */}
        <span className="shrink-0" aria-hidden>
          <Icon name="sparkles" size={15} />
        </span>
        {/* The header carries a localisable label — a nowrap ellipsis would delete
            the author's own words at narrow widths, and the disclosure row has no
            fixed height to defend. It wraps; the icon/chevron stay shrink-0.
            flex-1 without min-w-0: the leaf keeps its automatic minimum (its longest
            word) as the floor, so break-words only fires on a word genuinely wider
            than the row instead of shattering the label one letter per line. */}
        <span className="flex-1 break-words" title={headerText || undefined}>{headerText}</span>
        <span className={cn('shrink-0 transition-transform', open && 'rotate-180')} aria-hidden>
          <Icon name="chevron-down" size={15} />
        </span>
      </button>
      {open && (
        <div id={bodyId} className="border-t border-border px-3 py-2.5 text-[0.8125rem] leading-relaxed [color:var(--fr-reason-muted,var(--color-muted-foreground))]">
          <MonoText text={content} />
        </div>
      )}
    </div>
  );
}

/* ── ToolCall ─────────────────────────────────────────────────────────────── */

const toolCallWrap =
  'overflow-hidden rounded-frayme border-solid border-border [border-width:var(--fr-tool-bw,1px)] bg-card text-sm';
const toolCallHeader =
  'flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/50';
/* state pill — a tiny closed tone menu (color by call lifecycle). */
const toolCallPill = cva('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium leading-none', {
  variants: {
    state: {
      pending: 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-muted-foreground',
      running: '[background:color-mix(in_srgb,var(--frayme-info)_14%,transparent)] text-info',
      success: '[background:color-mix(in_srgb,var(--frayme-success)_14%,transparent)] text-success',
      error: '[background:color-mix(in_srgb,var(--frayme-danger)_14%,transparent)] text-danger',
    },
  },
  defaultVariants: { state: 'pending' },
});
const TOOLCALL_PILL_LABEL: Record<string, string> = {
  pending: 'Pending',
  running: 'Running',
  success: 'Done',
  error: 'Failed',
};

export function ToolCall({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    name: string;
    input?: string | null;
    output?: string | null;
    state?: string | null;
    defaultOpen?: boolean | null;
    stateLabels?: Partial<Record<'pending' | 'running' | 'success' | 'error', string>> | null;
    inputLabel?: string | null;
    outputLabel?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    borderStyle?: string | null;
    borderWidthValue?: string | number | null;
    mutedColor?: string | null;
    shadow?: string | null;
  };
  const [open, setOpen] = useState(p.defaultOpen === true);
  const state = (p.state as 'pending' | 'running' | 'success' | 'error' | null) ?? 'pending';
  const hasBody = p.input != null || p.output != null;
  // Localisable labels. A per-state override wins for the pill; the two
  // section headers take their own channels. Each falls back to the current
  // English literal (byte-identical when unset). Only a string override is used.
  const sl = p.stateLabels;
  const stateLabel =
    sl != null && typeof sl === 'object' && typeof sl[state] === 'string' ? sl[state]! : TOOLCALL_PILL_LABEL[state];
  const inputLabel = typeof p.inputLabel === 'string' ? p.inputLabel : 'Input';
  const outputLabel = typeof p.outputLabel === 'string' ? p.outputLabel : 'Output';
  // The input/output body's DOM id — what the header's `aria-expanded` expanded.
  // Instance-unique for the same reason as Reasoning above: a `repeat` of tool
  // calls shares one spec id, so a spec-id-only scheme cross-wired the rows.
  const bodyId = useAriaId('toolcall', element)();
  return (
    <div
      className={cn(
        toolCallWrap,
        // value > token default: only override the card surface/border when the
        // model named one (CONDITIONAL so `bg-card`/`border-border` win when absent).
        p.bg != null && '[background:var(--fr-tool-bg,var(--color-card))]',
        // group form (border-[color:…]) so tw-merge drops the base `border-border`
        // (a bare [border-color:…] sorts earlier in the stylesheet and loses).
        p.borderColor != null && 'border-[color:var(--fr-tool-border,var(--color-border))]',
        // border-style enum (dedupes against the base `border-solid`); unset → keeps solid.
        borderStyleClass(p.borderStyle),
        // elevation enum — own tw-merge group; LAST so a set value wins; unset → undefined (flat default).
        shadowClass(p.shadow),
      )}
      data-state={state}
      data-open={open}
      style={styleVars(
        { var: '--fr-tool-bg', value: p.bg, kind: 'color' },
        { var: '--fr-tool-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-tool-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
        { var: '--fr-tool-muted', value: p.mutedColor, kind: 'color' },
      )}
    >
      <button
        type="button"
        className={cn(toolCallHeader)}
        // No body, no disclosure. `input`/`output` are both nullable in the
        // catalog schema, so a VALID spec produces a ToolCall with nothing to
        // reveal — and with `defaultOpen: true` that header announced itself
        // EXPANDED while pointing aria-controls at an id that never mounts. That
        // is the exact Toggletip defect (toggletip-disclosure.test.tsx), and the
        // button is already `disabled` in this state, so the honest markup is an
        // inert header carrying neither attribute.
        aria-expanded={hasBody ? open : undefined}
        // Mounted only on `open && hasBody` — so referenced only then, for the
        // same reason as Reasoning above.
        aria-controls={open && hasBody ? bodyId : undefined}
        disabled={!hasBody}
        onClick={() => hasBody && setOpen((o) => !o)}
      >
        <span className="shrink-0 text-[color:var(--fr-tool-muted,var(--color-muted-foreground))]" aria-hidden>
          <Icon name="settings" size={15} />
        </span>
        {/* Tool names are identifiers (mcp__server__tool) — the tail is the part that
            identifies the call, so an ellipsis deletes exactly the load-bearing end.
            break-words breaks the identifier only when it cannot fit; the pill and
            chevron are shrink-0, so the row grows in height, not squeeze.
            No min-w-0 — this leaf's automatic minimum IS the identifier, and dropping
            below it is what turned `mcp__server__tool` into a vertical column. */}
        <span className="flex-1 break-words font-mono text-[0.8125rem] font-medium text-foreground" title={p.name || undefined}>
          {p.name}
        </span>
        <span className={cn(toolCallPill({ state }))}>
          {state === 'running' && (
            <span
              className="inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent"
              aria-hidden
            />
          )}
          {stateLabel}
        </span>
        {hasBody && (
          <span
            className={cn('shrink-0 text-[color:var(--fr-tool-muted,var(--color-muted-foreground))] transition-transform', open && 'rotate-180')}
            aria-hidden
          >
            <Icon name="chevron-down" size={15} />
          </span>
        )}
      </button>
      {open && hasBody && (
        <div
          id={bodyId}
          className={cn(
            'flex flex-col gap-2.5 border-t border-border px-3 py-2.5',
            // Coherence group "card frame": the internal divider follows the same
            // conditional --fr-tool-border chain as the outer edge (tw-merge drops
            // the token class); unset keeps the class list byte-identical.
            p.borderColor != null && 'border-[color:var(--fr-tool-border,var(--color-border))]',
          )}
        >
          {p.input != null && (
            <div className="flex flex-col gap-1">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wide [color:var(--fr-tool-muted,var(--color-muted-foreground))]">{inputLabel}</span>
              <MonoText text={p.input} />
            </div>
          )}
          {p.output != null && (
            <div className="flex flex-col gap-1">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wide [color:var(--fr-tool-muted,var(--color-muted-foreground))]">{outputLabel}</span>
              <MonoText text={p.output} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Task ─────────────────────────────────────────────────────────────────── */

/* The active spinner + active title read `accent` via a var (primary-token
   fallback); a SUPPLIED accent additionally overrides the state tone in any
   state via a conditional group-form text-[color:…] class (value > enum).

   INHERITED FOREGROUND (both recipes). A Task row paints NOTHING — its root is
   `flex w-full items-start gap-2.5 py-1`, no fill anywhere — so its ink belongs
   to whatever contains it, and the neutral states were RESETTING that to the
   global token. Probed in the DOM inside the authored card the trace came from
   (Card bg:#12161f color:#e2e6f0): the title and its sr-only state word both
   painted from this chain, #18181b on #12161f → 1.02:1; currentColor/inherit
   gives #e2e6f0 → 14.49:1. Byte-identical at the top level, where frayme.css
   points BOTH `.frayme-root { color }` and --color-foreground at --frayme-fg.
   The SEMANTIC states (muted / success / danger) are unchanged — a tone names a
   meaning, not a surface — and the sr-only label still carries the state to AT. */
const taskIcon = cva('inline-flex shrink-0 items-center justify-center', {
  variants: {
    state: {
      pending: 'text-muted-foreground',
      // quiet defaults: an active task's default emphasis is neutral
      // high-contrast (the inherited ink), not the brand accent — a supplied
      // `accent` still overrides via the var. Keeps the active row emphasised
      // without a brand shout.
      active: '[color:var(--fr-task-accent,currentColor)]',
      done: 'text-success',
      error: 'text-danger',
    },
  },
  defaultVariants: { state: 'pending' },
});
/* The title wraps rather than truncates: a task row is a stack child (min-width:0),
   so a nowrap ellipsis deleted the end of "Reading src/…/registry.tsx" — the row has
   no fixed height contract to protect. */
const taskTitle = cva('break-words text-sm font-medium', {
  variants: {
    state: {
      pending: 'text-inherit',
      // active title follows the same neutral-inherited default as taskIcon (accent overrides).
      active: '[color:var(--fr-task-accent,currentColor)]',
      done: 'text-inherit',
      error: 'text-danger',
    },
  },
  defaultVariants: { state: 'pending' },
});
/* Spoken state word — the glyph is aria-hidden + color is not a sole signal, so
   the state must reach AT via text (WCAG 1.4.1: don't convey by colour alone). */
const TASK_STATE_LABEL: Record<'pending' | 'active' | 'done' | 'error', string> = {
  pending: 'Pending',
  active: 'In progress',
  done: 'Done',
  error: 'Failed',
};

export function Task({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title: string;
    detail?: string | null;
    state?: string | null;
    accent?: string | null;
    mutedColor?: string | null;
  };
  const state = (p.state as 'pending' | 'active' | 'done' | 'error' | null) ?? 'pending';
  // value > enum/state token: a supplied accent overrides the state tone in ANY
  // state. Group form (text-[color:…]) so tw-merge drops the competing text-*
  // token from the state recipe; state still reaches AT via the sr-only label.
  const accentOverride = p.accent != null;
  let glyph: ReactNode;
  if (state === 'active') {
    glyph = (
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden
      />
    );
  } else if (state === 'done') {
    glyph = <Icon name="check-circle" size={17} />;
  } else if (state === 'error') {
    glyph = <Icon name="alert-circle" size={17} />;
  } else {
    glyph = (
      <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current" aria-hidden />
    );
  }
  return (
    <div
      className="flex w-full items-start gap-2.5 py-1"
      aria-current={state === 'active' ? 'step' : undefined}
      style={styleVars(
        { var: '--fr-task-accent', value: p.accent, kind: 'color' },
        { var: '--fr-task-muted', value: p.mutedColor, kind: 'color' },
      )}
    >
      <span
        className={cn(taskIcon({ state }), 'mt-0.5', accentOverride && 'text-[color:var(--fr-task-accent)]')}
        aria-hidden
      >
        {glyph}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn(taskTitle({ state }), accentOverride && 'text-[color:var(--fr-task-accent)]')} title={p.title || undefined}>
          <span className="sr-only">{TASK_STATE_LABEL[state]}: </span>
          {p.title}
        </span>
        {/* Same as the title — the detail line is the only place the step says what
            it actually did, so it wraps in the column instead of clipping. */}
        {p.detail != null && (
          <span className="break-words text-[0.8125rem] text-[color:var(--fr-task-muted,var(--color-muted-foreground))]" title={p.detail}>{p.detail}</span>
        )}
      </span>
    </div>
  );
}

/* ── Confirmation ─────────────────────────────────────────────────────────── */

/* The confirm button takes its look by `tone` (neutral → the primary action). No color
   VALUE channel here — tone is the lever — so a plain closed-enum recipe.
   Brought to Button parity. This is the single most destructive button in the
   catalog ("Delete 3 files from the project?" is the registry's own example) and it was
   a full saturated red slab. Every tone is now Button's treatment — neutral = the
   NEUTRAL high-contrast primary (still unmistakably the confirming action, just not a
   brand shout), the semantic tones = a 12% tint with a coloured border and label.
   Resting shadow dropped for the same parity. */
const confirmBtn = cva(
  'inline-flex cursor-pointer items-center justify-center rounded-frayme border border-transparent px-3.5 py-2 text-sm font-medium transition hover:brightness-95 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
  {
    variants: {
      tone: {
        neutral: 'bg-[color:var(--fr-btn-fill,var(--color-foreground))] text-[color:var(--fr-btn-ink,var(--color-card))]',
        success:
          '[background:color-mix(in_srgb,var(--color-success)_12%,transparent)] border-[color:var(--color-success)] text-[color:var(--color-success)]',
        warning:
          '[background:color-mix(in_srgb,var(--color-warning)_12%,transparent)] border-[color:var(--color-warning)] text-[color:var(--color-warning)]',
        // critical = the destructive confirm (e.g. a Delete gate). Quiet-red:
        // no resting fill, hairline red border (30% mix), red label + icon, hover-only
        // red wash. success/warning/info keep their 12% tint (rule 2).
        critical:
          'border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[color:var(--color-danger)] hover:[background:color-mix(in_srgb,var(--color-danger)_10%,transparent)]',
        info: '[background:color-mix(in_srgb,var(--color-info)_12%,transparent)] border-[color:var(--color-info)] text-[color:var(--color-info)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);
/* Coherence group "card fill + on-fill text": the deny label reads the same
   --fr-confirm-fg chain as the message (muted-foreground token fallback) so a
   custom `color` paired with a saturated `bg` keeps the whole gate legible. */
const denyBtn =
  'inline-flex cursor-pointer items-center justify-center rounded-frayme border border-transparent bg-transparent px-3.5 py-2 text-sm font-medium text-[color:var(--fr-confirm-fg,var(--color-muted-foreground))] transition hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] hover:text-[color:var(--fr-surface-fg,var(--color-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

export function Confirmation({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    message: string;
    confirmLabel?: string | null;
    denyLabel?: string | null;
    /* Accepted alias of `denyLabel` — the rest of the vocabulary (the shared
       `confirm:{…}` block, DataTable's row editor) spells this `cancelLabel`,
       and the model writes what the vocabulary taught it. */
    cancelLabel?: string | null;
    tone?: string | null;
    bg?: string | null;
    color?: string | null;
    borderColor?: string | null;
    borderStyle?: string | null;
    borderWidthValue?: string | number | null;
    shadow?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
    decision?: string | null;
    /* CONTROLLED VISIBILITY. Not a catalog prop — the model reaches for it anyway
       (`openPath: "/confirmOpen"`) because the gate is
       plainly meant to appear only once something opens it. The runtime ignored it,
       so a card reading "This will permanently cancel this session. This cannot be
       undone." sat at the bottom of the page at FIRST PAINT with two live buttons.
       Honoured here so the spec's own intent holds; `open` is the same lever for a
       spec that binds it directly. */
    openPath?: string | null;
    open?: boolean | null;
  };
  const tone = (p.tone as 'neutral' | 'success' | 'warning' | 'critical' | 'info' | null) ?? 'neutral';
  const confirmLabel = p.confirmLabel ?? 'Approve';
  const denyLabel = p.denyLabel ?? p.cancelLabel ?? 'Deny';
  const emitWith = useIntrinsicEmit(emit, element);
  /* THE GATE ANSWERS ONCE. Confirmation declares commit (Approve) and dismiss
     (Deny); either is a verdict, and a verdict cannot be given twice. Without this
     the buttons stayed live after Approve had already dispatched — observed as
     "applyChanges/latch: control did NOT gain the disabled attribute". Watches
     BOTH verbs (no `event` argument), so answering either kills both. */
  const answered = useCommitLatch(element);
  /* Hooks run unconditionally (Rules of Hooks); a path-less read is inert.
     `undefined` — a path nothing in `state` declares — is NOT "closed": it is
     unspecified, and hiding on it would blank a gate whose author simply never
     seeded the key. Only an explicit falsy (false / null / 0 / "") closes it. */
  const openState = useStateValue<unknown>(
    typeof p.openPath === 'string' && p.openPath.trim()
      ? `/${p.openPath.trim().replace(/^\//, '')}`
      : '/_ui/__frayme_inert__',
  );
  const closed =
    (typeof p.openPath === 'string' && p.openPath.trim() && openState !== undefined && !openState) ||
    p.open === false;
  // Make the human verdict agent-readable: on Approve/Deny write the resolved
  // decision into spec.state (via the binding when the model bound `decision`),
  // ADDITIVE to the existing commit/dismiss emits (FloorPlan pattern).
  const [, setDecision] = useLocalOrBound<'approved' | 'denied'>(
    p.decision as 'approved' | 'denied' | undefined,
    (bindings as { decision?: unknown } | undefined)?.decision,
  );
  // AFTER every hook (Rules of Hooks) — an early return above useLocalOrBound
  // would change the hook count the moment the gate opened.
  if (closed) return null;
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-frayme border-solid border-border [border-width:var(--fr-confirm-bw,1px)] bg-card p-4',
        // value > token default: only override surface/border when the model named
        // one (CONDITIONAL so `bg-card`/`border-border` win when absent).
        p.bg != null && '[background:var(--fr-confirm-bg,var(--color-card))]',
        // group form (border-[color:…]) so tw-merge drops the base `border-border`
        // (a bare [border-color:…] sorts earlier in the stylesheet and loses).
        p.borderColor != null && 'border-[color:var(--fr-confirm-border,var(--color-border))]',
        // border-style enum (dedupes against the base `border-solid`); unset → keeps solid.
        borderStyleClass(p.borderStyle),
        // elevation enum — own tw-merge group; LAST so a set value wins; unset → undefined (flat default).
        shadowClass(p.shadow),
        // Closed Font enum → static font-* utility on the root so the whole gate
        // (message + buttons) inherits it. Unset → undefined → theme font.
        fontClass(p.font),
      )}
      role="group"
      style={styleVars(
        { var: '--fr-confirm-bg', value: p.bg, kind: 'color' },
        { var: '--fr-confirm-fg', value: p.color, kind: 'color' },
        { var: '--fr-confirm-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-confirm-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
        { var: '--fr-confirm-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {/* fontSize single source: text-sm folded into the var fallback (its bundled
          line-height preserved by the explicit leading ratio, byte-identical when
          unset); weight/tracking/leading enums LAST so a set value dedupe-wins. */}
      <p
        className={cn(
          // On-fill text channel: the message reads --fr-confirm-fg with the
          // foreground token folded in as the var fallback (byte-identical when
          // unset) so a saturated custom bg can carry a legible paired colour.
          'm-0 [font-size:var(--fr-confirm-fs,0.875rem)] leading-[calc(1.25/0.875)] text-[color:var(--fr-confirm-fg,var(--color-foreground))]',
          weightClass(p.weight),
          trackingClass(p.tracking),
          leadingClass(p.leading),
        )}
      >
        {p.message}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={cn(confirmBtn({ tone }), 'disabled:cursor-not-allowed disabled:opacity-50')}
          disabled={answered}
          onClick={() => {
            setDecision('approved');
            emitWith('commit', { label: confirmLabel });
          }}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          className={cn(denyBtn, 'disabled:cursor-not-allowed disabled:opacity-50')}
          disabled={answered}
          onClick={() => {
            setDecision('denied');
            emitWith('dismiss', { label: denyLabel });
          }}
        >
          {denyLabel}
        </button>
      </div>
    </div>
  );
}

/* ── Suggestion ───────────────────────────────────────────────────────────── */

/* A tappable suggested-prompt chip. `accent` recolors the border + icon via a
   var (border/primary-token fallback); the override class is conditional.
   fontSize rides the two-step var chain: each `size` step sets the DEFAULT var
   (not a text-* utility, which tw-merge would NOT dedupe against the base's
   arbitrary font-size class) so an exact fontSize wins while the enum stays
   byte-identical (md's prior text-sm bundled line-height is preserved by the
   explicit leading ratio; sm's arbitrary size carried none, so it needs none). */
const suggestion = cva(
  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-card font-medium text-foreground transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [border-color:var(--fr-suggestion-accent,var(--color-border))] [font-size:var(--fr-suggestion-fs,var(--fr-suggestion-fs-default))]',
  {
    variants: {
      size: {
        sm: 'px-2.5 py-1 [--fr-suggestion-fs-default:0.8125rem]',
        md: 'px-3.5 py-1.5 [--fr-suggestion-fs-default:0.875rem] leading-[calc(1.25/0.875)]',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export function Suggestion({ element, emit }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label: string;
    icon?: string | null;
    size?: string | null;
    accent?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const size = (p.size as 'sm' | 'md' | null) ?? 'md';
  const emitWith = useIntrinsicEmit(emit, element);
  return (
    <button
      type="button"
      className={cn(
        suggestion({ size }),
        // typography enums LAST so a set value dedupe-wins its tw-merge group
        // (weight beats the baked font-medium); unset → undefined → byte-identical.
        fontClass(p.font),
        weightClass(p.weight),
        trackingClass(p.tracking),
        leadingClass(p.leading),
      )}
      style={styleVars(
        { var: '--fr-suggestion-accent', value: p.accent, kind: 'color' },
        { var: '--fr-suggestion-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
      onClick={() => emitWith('commit', { label: p.label ?? null })}
    >
      {p.icon != null && (
        <span
          className={cn('shrink-0', p.accent != null ? '[color:var(--fr-suggestion-accent)]' : 'text-muted-foreground')}
          aria-hidden
        >
          <Icon name={p.icon} size={size === 'sm' ? 14 : 15} />
        </span>
      )}
      {/* A suggestion chip carries a whole prompt ("Explain this in simpler terms"),
          not one token — so it does NOT earn the one-line chip exemption. It wraps
          inside the pill, beside the shrink-0 icon. No min-w-0: this leaf's automatic
          minimum is its longest word, and that is exactly the floor break-words needs
          — overriding it let the prompt break to one character per line. */}
      <span className="break-words" title={p.label || undefined}>{p.label}</span>
    </button>
  );
}

/* ── TypingIndicator ──────────────────────────────────────────────────────── */

/* Three bouncing dots reusing the existing `fr-bounce` keyframe (same staggered
   technique as the Spinner `dots` variant). The animation is referenced by a
   STATIC class — never an author-supplied timing/keyframe value. */
/* The dots paint with bg-current so they inherit the wrapper's mutedColor var
   chain (muted-foreground token fallback) — setting mutedColor recolors the
   label AND the dots together (the component's primary visual). */
const typingDot = 'inline-block h-1.5 w-1.5 rounded-full bg-current animate-[fr-bounce_0.8s_infinite]';

export function TypingIndicator({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    label?: string | null;
    mutedColor?: string | null;
  };
  const ariaLabel = p.label != null ? `${p.label}…` : 'Assistant is typing';
  return (
    <span
      className="inline-flex items-center gap-2 text-sm [color:var(--fr-typing-muted,var(--color-muted-foreground))]"
      role="status"
      aria-label={ariaLabel}
      style={styleVars({ var: '--fr-typing-muted', value: p.mutedColor, kind: 'color' })}
    >
      {p.label != null && <span>{p.label}</span>}
      <span className="inline-flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={typingDot} style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </span>
    </span>
  );
}
