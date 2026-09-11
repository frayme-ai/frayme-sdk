'use client';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { SafeImage } from './_img.js';
import { styleVars, fontClass, weightClass, trackingClass, leadingClass, shadowClass, surfaceField, surfaceInk, surfaceMuted, surfaceRaised, surfaceSunken } from './_style.js';
import { Icon } from './icons.js';

/* Catalog group (ai-chat-core): Conversation, Message, MessageContent, PromptInput.
 *
 * Same truly-dynamic contract as the shipped 57:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (colors the model names directly) NEVER become classes — they
 *     land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities. The class set stays a
 *     closed, build-time set (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing/absent
 *     value so the token fallback wins (props-less → polished).
 *
 * value > enum precedence (Message `bg`/`accent` over the role default) uses the
 * CONDITIONAL override class — the `[background:var(--fr-…)]` utility is only
 * added to cn() when the model supplied that value (`p.bg != null`), so the role
 * class wins when absent and the var wins when present (added LAST → tw-merge keeps it).
 *
 * All message/content text is rendered as ESCAPED React text with
 * `whitespace-pre-wrap` (newlines preserved) — never innerHTML. Avatar sources are
 * rendered via `SafeImage` (validates src + falls back to initials on an unsafe
 * src or a load failure). Icons are NAMES from the
 * closed `icons.ts` registry (never raw SVG). Dark mode flips for free: only
 * semantic token classes (bg-card/bg-muted/text-foreground/border-border/the tone
 * colors) are used — no literal white/black surfaces. The user bubble's accent
 * fill uses a token default + a translucent-white text treatment that reads on any
 * colored fill.
 */

/* ── Conversation ─────────────────────────────────────────────────────────── */

const conversation = cva(
  // No unconditional background here — the `bordered` variant owns the surface
  // (bg-card) and a model-named `bg` is applied via the CONDITIONAL override in
  // the render (an unconditional `[background:...]` shorthand would override the
  // bordered bg-card in the cascade → a transparent bordered conversation).
  'flex flex-col overflow-y-auto',
  {
    variants: {
      density: {
        compact: 'gap-2',
        normal: 'gap-4',
        comfortable: 'gap-6',
      },
      bordered: {
        // bare width utility replaced by an arbitrary var-chain so a model-named
        // borderWidthValue beats the default; border-color/style kept, width = 1px default.
        true: 'rounded-frayme border-solid border-border [border-width:var(--fr-conv-bw,1px)] bg-card p-4',
        false: '',
      },
      maxHeight: {
        sm: 'max-h-[20rem]',
        md: 'max-h-[32rem]',
        lg: 'max-h-[44rem]',
        full: '',
      },
    },
    defaultVariants: { density: 'normal', bordered: false, maxHeight: 'md' },
  },
);

export function Conversation({ element, children }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    density?: string | null;
    bordered?: boolean | null;
    maxHeight?: string | null;
    autoScroll?: boolean | null;
    bg?: string | null;
    borderColor?: string | null;
    borderWidthValue?: string | number | null;
  };
  // Stick-to-bottom: when autoScroll is on (default), pin the log to the newest
  // message as children change so an appended reply isn't hidden below the fold.
  // A layout effect after each render sets scrollTop to the full scrollHeight;
  // this runs on the DOM node only (byte-identical markup — no class/attr added).
  const logRef = useRef<HTMLDivElement | null>(null);
  const autoScroll = p.autoScroll !== false;
  useEffect(() => {
    if (!autoScroll) return;
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });
  return (
    <div
      ref={logRef}
      className={cn(
        conversation({
          density: (p.density as 'compact' | 'normal' | 'comfortable' | null) ?? undefined,
          bordered: (p.bordered ?? false) as true | false,
          maxHeight: (p.maxHeight as 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
        }),
        // value > token default: only override the surface fill when the model
        // named a bg (added LAST so tw-merge keeps the var over the bordered bg-card).
        // Token fallback = defence-in-depth for an invalid bg on the ungated path.
        p.bg != null && '[background:var(--fr-conv-bg,var(--color-card))]',
        // The bordered variant ALWAYS paints (bg-card sits in its cva class), so when it
        // paints and no bg was authored the channel is RESET to the token actually
        // painted rather than left describing an outer surface. Byte-identical:
        // republishing var(--color-card) is what the unpublished chain resolved to.
        (p.bordered ?? false) === true && p.bg == null && '[--fr-surface:var(--color-card)] [--fr-surface-fg:var(--color-card-foreground)] [--fr-surface-muted:var(--color-muted-foreground)] [--fr-surface-sunken:var(--color-muted)] [--fr-surface-raised:var(--color-card)] [--fr-surface-field:var(--color-card)]',
        // value > token default: only recolor the bordered border when the model
        // named one (the bordered variant owns `border-border`; CONDITIONAL so the
        // token default wins when absent). GROUP form (border-[color:...]) so
        // tw-merge dedupes `border-border` — the bare [border-color:...] arbitrary
        // property is a different group and loses to the token in the cascade.
        p.borderColor != null && 'border-[color:var(--fr-conv-border,var(--color-border))]',
      )}
      role="log"
      aria-live="polite"
      aria-label="Conversation"
      style={styleVars(
        { var: '--fr-conv-bg', value: p.bg, kind: 'color' },
        // ALSO publish the shared surface channel. This container paints an OPAQUE fill
        // of its own — bg-card from the bordered variant, or --fr-conv-bg when the model
        // names one — and hosts arbitrary children (slots: ['default']). It already
        // matters inside THIS file: the assistant avatar and the system/tool bubbles read
        // --fr-surface-sunken / -muted / -fg, so unpublished they derive their grounds
        // from the PAGE rather than from the Conversation they actually sit in.
        { var: '--fr-surface', value: p.bg, kind: 'color' },
        { var: '--fr-surface-fg', value: surfaceInk(p.bg, undefined) as string, kind: 'raw' },
        { var: '--fr-surface-muted', value: surfaceMuted(p.bg, undefined) as string, kind: 'raw' },
        { var: '--fr-surface-sunken', value: surfaceSunken(p.bg) as string, kind: 'raw' },
        { var: '--fr-surface-raised', value: surfaceRaised(p.bg) as string, kind: 'raw' },
        { var: '--fr-surface-field', value: surfaceField(p.bg) as string, kind: 'raw' },
        { var: '--fr-conv-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-conv-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
      )}
    >
      {children}
    </div>
  );
}

/* ── Message ──────────────────────────────────────────────────────────────── */

/* role drives the row layout + the bubble surface. user = right-aligned accent
   bubble (token-default primary, overridable via `accent`/`bg`); assistant =
   left card; system/tool = a centered muted note. The bubble reads
   --fr-msg-bg/--fr-msg-accent through the conditional override class so a
   model-named color beats the role default. */
const messageRow = cva('flex w-full gap-2.5', {
  variants: {
    role: {
      user: 'flex-row-reverse',
      assistant: 'flex-row',
      system: 'flex-row justify-center',
      tool: 'flex-row justify-center',
    },
  },
  defaultVariants: { role: 'assistant' },
});

// fontSize is a single var chain: an exact fontSize (--fr-msg-fs) > the role
// default (--fr-msg-fs-default, set only by system/tool) > the baked 0.875rem.
// The old baked text-sm / text-[0.8125rem] fold into the chain — NOT co-located
// (a bare arbitrary font-size rule loses to text-* by stylesheet order).
const messageBubble = cva('max-w-[80%] whitespace-pre-wrap break-words [font-size:var(--fr-msg-fs,var(--fr-msg-fs-default,0.875rem))] leading-relaxed', {
  variants: {
    role: {
      // quiet defaults: the user bubble defaults to neutral high-contrast
      // (foreground/card), not a brand slab; a supplied `accent`/`bg` still fills brand.
      user: 'rounded-2xl rounded-tr-sm px-3.5 py-2 [background:var(--fr-msg-bg,var(--fr-msg-accent,var(--color-foreground)))] text-[color:var(--fr-msg-accent-text,var(--color-card))]',
      assistant: 'rounded-2xl rounded-tl-sm border border-border px-3.5 py-2 text-card-foreground [background:var(--fr-msg-bg,var(--color-card))]',
      system: 'rounded-frayme px-3 py-1.5 text-center [--fr-msg-fs-default:0.8125rem] text-[color:var(--fr-surface-muted,var(--color-muted-foreground))] [background:var(--fr-msg-bg,var(--fr-surface-sunken,var(--color-muted)))]',
      tool: 'rounded-frayme border border-border px-3 py-1.5 text-center font-mono [--fr-msg-fs-default:0.8125rem] text-[color:var(--fr-surface-muted,var(--color-muted-foreground))] [background:var(--fr-msg-bg,var(--fr-surface-sunken,var(--color-muted)))]',
    },
  },
  defaultVariants: { role: 'assistant' },
});

// Each role OWNS its avatar background — no base var read. The old base
// `[background:var(--fr-msg-accent,…)]` co-located with the assistant variant's
// `bg-muted` (different tw-merge groups → both survived; stylesheet order picked
// the winner). Deliberate coverage now: `accent` tints the USER avatar only; the
// assistant avatar stays the muted token.
const avatarBubble = cva(
  'inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[0.6875rem] font-semibold text-foreground',
  {
    variants: {
      role: {
        user: '[background:var(--fr-msg-accent,var(--color-foreground))] text-card',
        assistant: 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-[color:var(--fr-surface-fg,var(--color-foreground))]',
        system: 'hidden',
        tool: 'hidden',
      },
    },
    defaultVariants: { role: 'assistant' },
  },
);

function initialsOf(name: string | null | undefined): string {
  return (name ?? '')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Message({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    content?: string | null;
    role?: string | null;
    author?: string | null;
    timestamp?: string | null;
    avatar?: string | null;
    streaming?: boolean | null;
    accent?: string | null;
    accentText?: string | null;
    bg?: string | null;
    mutedColor?: string | null;
    showAvatar?: boolean | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
  };
  const role = (p.role as 'user' | 'assistant' | 'system' | 'tool' | null) ?? 'assistant';
  const content = typeof p.content === 'string' ? p.content : '';
  const initials = initialsOf(p.author);
  // The avatar bubble renders for user/assistant rows only when: NOT explicitly
  // suppressed (showAvatar:false), AND there is something to show — an avatar
  // image OR derived initials. With neither, an empty grey circle reads as a
  // broken image, so we drop the bubble.
  const showSideColumn =
    (role === 'user' || role === 'assistant') &&
    p.showAvatar !== false &&
    (p.avatar != null || initials.length > 0);
  const style = styleVars(
    { var: '--fr-msg-accent', value: p.accent, kind: 'color' },
    { var: '--fr-msg-accent-text', value: p.accentText, kind: 'color' },
    { var: '--fr-msg-bg', value: p.bg, kind: 'color' },
    { var: '--fr-msg-muted', value: p.mutedColor, kind: 'color' },
    // exact body-text size → --fr-msg-fs wins over the role default in the bubble chain.
    { var: '--fr-msg-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
  ) as CSSProperties;
  return (
    // Closed Font enum → a static font-* utility on the row root; the whole message
    // (meta + bubble) inherits it. Unset → undefined → dropped (byte-identical).
    <div className={cn(messageRow({ role }), fontClass(p.font))} style={style} data-role={role}>
      {showSideColumn && (
        <span className={cn(avatarBubble({ role }))} aria-hidden title={p.author ?? undefined}>
          <SafeImage
            className="h-full w-full object-cover"
            src={p.avatar}
            alt=""
            fallback={<span>{initials}</span>}
          />
        </span>
      )}
      <div className={cn('flex min-w-0 flex-col gap-1', role === 'user' && 'items-end')}>
        {(p.author != null || p.timestamp != null) && role !== 'system' && role !== 'tool' && (
          <div className="flex items-center gap-2 px-1 text-[0.6875rem] [color:var(--fr-msg-muted,var(--color-muted-foreground))]">
            {/* The author's name wraps rather than clips — the meta row has no fixed
                height and the timestamp beside it is shrink-0, so a nowrap ellipsis
                only ever deleted the name. No min-w-0 on the leaf: the name's own
                min-content is the floor break-words should break AT, not below —
                overriding it stacked the author one character per line. */}
            {p.author != null && (
              <span className="break-words font-medium [color:var(--fr-msg-accent,var(--color-foreground))]" title={p.author || undefined}>
                {p.author}
              </span>
            )}
            {p.timestamp != null && <span className="shrink-0 tabular-nums">{p.timestamp}</span>}
          </div>
        )}
        <div
          className={cn(
            messageBubble({ role }),
            // value > role default: the override class is added only when the model
            // named the color (added LAST → tw-merge keeps the var over the role bg).
            p.bg != null && '[background:var(--fr-msg-bg)]',
            role === 'user' && p.bg == null && p.accent != null && '[background:var(--fr-msg-accent)]',
            // Coherence 'bubble fill + on-fill text': a set accentText recolors the
            // NON-user bubbles too (pairs with a custom `bg` so a dark repaint keeps
            // legible text). Conditional + role-token fallback INSIDE the var so an
            // invalid value falls back to the role default; the text-color group form
            // dedupe-wins the variant's token class.
            role === 'assistant' && p.accentText != null && 'text-[color:var(--fr-msg-accent-text,var(--color-card-foreground))]',
            (role === 'system' || role === 'tool') && p.accentText != null && 'text-[color:var(--fr-msg-accent-text,var(--color-muted-foreground))]',
            // 6i typography channels on the body text: each is a same-group utility
            // placed LAST so a SET value dedupe-wins (leading over the baked
            // leading-relaxed); unset → undefined → cn drops it (byte-identical).
            weightClass(p.weight),
            trackingClass(p.tracking),
            leadingClass(p.leading),
          )}
        >
          {/* React escapes this text node — content never reaches the DOM as markup. */}
          {content}
          {p.streaming === true && (
            <span
              className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-pulse bg-current align-middle"
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── MessageContent ───────────────────────────────────────────────────────── */

/* A composable body block for richer Message content. The text is ALWAYS rendered
   as escaped React text (whitespace-pre-wrap) — `variant:markdown` does NOT enable
   raw HTML. It tokenizes a SAFE inline subset (**bold**, *italic*, `code`) into
   React elements whose children are plain escaped text; everything else stays
   literal text. No raw HTML, no link parsing, no spec colors, no markup channel. */
// fontSize is a single var chain: an exact fontSize (--fr-msgcontent-fs) > the
// mono preset (--fr-msgcontent-fs-default:0.85em) > the baked 0.875rem. The old
// baked text-sm / text-[0.85em] fold into the chain — NOT co-located (a bare
// arbitrary font-size rule loses to text-* by stylesheet order).
const messageContent = cva('m-0 whitespace-pre-wrap break-words [font-size:var(--fr-msgcontent-fs,var(--fr-msgcontent-fs-default,0.875rem))] leading-relaxed [color:var(--fr-msgcontent-fg,var(--color-foreground))]', {
  variants: {
    variant: {
      text: '',
      markdown: 'space-y-2',
    },
    mono: {
      true: 'font-mono [--fr-msgcontent-fs-default:0.85em]',
      false: '',
    },
    prose: {
      true: 'max-w-prose leading-7',
      false: '',
    },
  },
  defaultVariants: { variant: 'text', mono: false, prose: false },
});

/**
 * Tokenize a SAFE inline-markdown subset — `code`, **bold**, *italic* — into React
 * nodes. Each delimiter's INNER text becomes the children of a <code>/<strong>/<em>
 * element, so it is escaped by React (never innerHTML). Unmatched text (incl.
 * newlines, preserved by whitespace-pre-wrap) stays a literal text node. The
 * patterns are non-nested + linear (no ReDoS); unknown/odd markers stay literal.
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (m[1]) {
      out.push(
        <code key={key++} className="rounded-[0.25rem] bg-[color:var(--fr-surface-sunken,var(--color-muted))] px-1 py-0.5 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (m[2]) {
      out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MessageContent({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    content?: string | null;
    variant?: string | null;
    mono?: boolean | null;
    prose?: boolean | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
    color?: string | null;
  };
  const content = typeof p.content === 'string' ? p.content : '';
  const variant = (p.variant as 'text' | 'markdown' | null) ?? 'text';
  return (
    <p
      className={cn(
        messageContent({
          variant,
          mono: (p.mono ?? false) as true | false,
          prose: (p.prose ?? false) as true | false,
        }),
        // 6i typography channels: each is a same-group utility (font-*/tracking-*/leading-*)
        // placed LAST so a SET value dedupe-wins over the baked text-sm/leading-relaxed and
        // the prose leading-7; unset → helper returns undefined and cn drops it (byte-identical default).
        weightClass(p.weight),
        trackingClass(p.tracking),
        leadingClass(p.leading),
        // Closed Font enum → a static font-* utility (font-family group, LAST so a
        // set value dedupe-wins over the mono preset's font-mono); the block +
        // descendants inherit it. Unset → undefined → dropped (byte-identical).
        fontClass(p.font),
      )}
      style={styleVars(
        { var: '--fr-msgcontent-fg', value: p.color, kind: 'color' },
        // exact body size → --fr-msgcontent-fs wins over the mono default in the chain.
        { var: '--fr-msgcontent-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } },
      )}
    >
      {/* Escaped React text/elements — never innerHTML, even for variant:markdown. */}
      {variant === 'markdown' ? renderInlineMarkdown(content) : content}
    </p>
  );
}

/* ── PromptInput ──────────────────────────────────────────────────────────── */

/* The composer: a bordered region with a textarea + a trailing send IconButton.
   `value` is two-way via useBoundProp; Enter (no Shift) emits `commit`, typing
   emits `change`. accent/borderColor/bg are VALUE channels (token-fallback vars).
   size is a CLOSED enum (textarea min-height + font). */
const promptWrap = cva(
  // bare `border` width utility replaced by an arbitrary var-chain so a model-named
  // borderWidthValue beats the default; border-color/style kept, width = 1px default.
  // Single background source: the [background:var(--fr-prompt-bg,var(--color-card))]
  // var-chain (token fallback keeps unset byte-identical) — no co-located bg-card.
  'flex items-end gap-2 rounded-frayme border-solid [border-width:var(--fr-prompt-bw,1px)] p-2 transition focus-within:ring-2 focus-within:ring-[color:var(--fr-prompt-accent,var(--fr-accent))]/40 [background:var(--fr-prompt-bg,var(--color-card))] [border-color:var(--fr-prompt-border,var(--color-border))]',
  {
    variants: {
      disabled: {
        true: 'cursor-not-allowed opacity-60',
        false: '',
      },
    },
    defaultVariants: { disabled: false },
  },
);

const promptTextarea = cva(
  'min-w-0 flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 font-[inherit] text-foreground outline-none placeholder:[color:var(--fr-prompt-muted,var(--color-muted-foreground))] disabled:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'min-h-[2.25rem] text-sm',
        md: 'min-h-[2.75rem] text-[0.9375rem]',
        lg: 'min-h-[3.5rem] text-base',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

const SEND_GLYPH: Record<'sm' | 'md' | 'lg', { btn: string; icon: number }> = {
  sm: { btn: 'h-8 w-8', icon: 15 },
  md: { btn: 'h-9 w-9', icon: 17 },
  lg: { btn: 'h-11 w-11', icon: 20 },
};

export function PromptInput({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    placeholder?: string | null;
    value?: string | null;
    name?: string | null;
    size?: string | null;
    disabled?: boolean | null;
    loading?: boolean | null;
    attach?: boolean | null;
    accent?: string | null;
    accentText?: string | null;
    borderColor?: string | null;
    borderWidthValue?: string | number | null;
    bg?: string | null;
    mutedColor?: string | null;
    shadow?: string | null;
    emitOnChange?: boolean | null;
  };
  const [value, setValue] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  const emitWith = useIntrinsicEmit(emit, element);
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? 'md';
  const disabled = p.disabled === true;
  const loading = p.loading === true;
  const blocked = disabled || loading;
  const send = SEND_GLYPH[size] ?? SEND_GLYPH.md;
  const style = styleVars(
    { var: '--fr-prompt-accent', value: p.accent, kind: 'color' },
    { var: '--fr-prompt-accent-text', value: p.accentText, kind: 'color' },
    { var: '--fr-prompt-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-prompt-bw', value: p.borderWidthValue, kind: 'dim', opts: { units: ['px'], min: 0, max: 8 } },
    { var: '--fr-prompt-bg', value: p.bg, kind: 'color' },
    { var: '--fr-prompt-muted', value: p.mutedColor, kind: 'color' },
  ) as CSSProperties;
  const submit = (): void => {
    if (blocked) return;
    emitWith('commit', { value: value ?? '' });
  };
  return (
    <div
      className={cn(
        promptWrap({ disabled: disabled as true | false }),
        // 6j elevation channel: box-shadow is its own tw-merge group, placed LAST so a
        // SET value dedupe-wins; the wrap bakes NO shadow, so unset → helper returns
        // undefined and cn drops it (byte-identical default: a flat composer surface).
        shadowClass(p.shadow),
      )}
      role="form"
      aria-label="Message composer"
      style={style}
    >
      {p.attach === true && (
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent [color:var(--fr-prompt-muted,var(--color-muted-foreground))] transition hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] hover:text-[color:var(--fr-surface-fg,var(--color-foreground))] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Attach file"
          disabled={blocked}
          // the attach affordance emits the CANONICAL `commit` verb with an
          // intrinsic `{control:'attach'}` discriminator (no new verb — the 8-verb
          // vocabulary is locked) so a host can wire a file picker. It no-ops while
          // disabled/loading, like send.
          onClick={() => {
            if (blocked) return;
            emitWith('commit', { control: 'attach' });
          }}
        >
          {/* `paperclip` is a closed-registry glyph (icons.ts); unknown names render
              nothing, so this always resolves to our author-controlled SVG. */}
          <Icon name="paperclip" size={18} />
        </button>
      )}
      <textarea
        className={cn(promptTextarea({ size }))}
        name={p.name ?? undefined}
        rows={1}
        placeholder={p.placeholder ?? undefined}
        value={value ?? ''}
        disabled={blocked}
        aria-label={p.placeholder ?? 'Message'}
        onChange={(e) => {
          // setValue stays UNCONDITIONAL so bound spec.state (bindings.value) is live and
          // an external Button can read the draft; only the per-keystroke change STREAM is
          // gated. The Enter/send commit below is the always-on submit path.
          setValue(e.target.value);
          if (p.emitOnChange !== false) emitWith('change', { value: e.target.value });
        }}
        onKeyDown={(e) => {
          // Guarded like forms.tsx Input: never commit on key auto-repeat, and never
          // steal the Enter that CONFIRMS an IME composition (CJK input).
          if (e.key === 'Enter' && !e.shiftKey && !e.repeat && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button
        type="button"
        className={cn(
          // quiet defaults: neutral high-contrast send button by default; a
          // supplied `accent` still recolors the fill via the var path below.
          'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent bg-foreground text-card shadow-sm transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50',
          send.btn,
          // value > token default: a model-named accent recolors the send fill.
          // In-var primary fallback: an INVALID accent (var omitted by styleVars)
          // keeps the primary fill instead of nuking the button background.
          p.accent != null && '[background:var(--fr-prompt-accent,var(--color-primary))]',
          // on-fill text: text-color group form (added LAST) dedupes-and-wins over
          // the base `text-primary-foreground` so a saturated accent stays legible.
          p.accentText != null && 'text-[color:var(--fr-prompt-accent-text)]',
        )}
        aria-label="Send message"
        disabled={blocked}
        aria-busy={loading || undefined}
        onClick={submit}
      >
        {loading ? (
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        ) : (
          <Icon name="send" size={send.icon} />
        )}
      </button>
    </div>
  );
}
