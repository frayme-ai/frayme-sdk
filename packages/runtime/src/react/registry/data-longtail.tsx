'use client';
import { useState, useEffect, useRef } from 'react';
import type { ReactNode, KeyboardEvent as ReactKeyboardEvent, FocusEvent as ReactFocusEvent } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars, borderStyleClass, shadowClass } from './_style.js';
import { Icon, hasIcon } from './icons.js';
import { safeUrl, linkTargetRel } from './url-safety.js';

/* Catalog group (data-longtail): JsonView · Menubar · Fab · RelativeTime.
 * (The former DataGrid folded into DataTable — see registry/data-table.tsx.)
 *
 * Same truly-dynamic contract as the shipped catalog:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (a model-named color/dimension) NEVER become classes — they land
 *     in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`, read by STATIC
 *     arbitrary `var(--fr-…, var(--color-…))` utilities WITH a token fallback. A
 *     failing/absent value is omitted so the token wins (props-less → polished).
 *
 * SECURITY (non-negotiable §4.6): JsonView nodes, Menubar labels/shortcuts all
 * render as ESCAPED React text — never markup. Links flow through `safeUrl` +
 * `linkTargetRel`; icons resolve against the closed registry. Every array is
 * guarded and every numeric bound Number.isFinite-checked so a props-less /
 * partially-streamed element cannot crash.
 *
 * INTERACTIVITY: Menubar/Fab/JsonView use ephemeral `useState` for open/expand.
 * RelativeTime is SSR-safe: a static initial string, then a client-side tick. */

/* ── shared scale maps ────────────────────────────────────────────────────── */

/* Text tones. The only reader is RelativeTime, which renders a bare inline <span>
   with NO fill of its own — so `neutral` must INHERIT its ink rather than reset it
   to the global token. Probed in the DOM: "7mo ago" paints from this class, and
   inside the authored card the trace came from (Card bg:#12161f color:#e2e6f0)
   #18181b on #12161f measures 1.02:1 — a timestamp the colour of its own
   background — against 14.49:1 inherited. `text-inherit` is byte-identical at the
   top level: frayme.css points BOTH `.frayme-root { color }` and
   --color-foreground at --frayme-fg. The semantic tones are untouched. */
const TONE_TEXT: Record<string, string> = {
  neutral: 'text-inherit',
  success: 'text-success',
  warning: 'text-warning',
  critical: 'text-danger',
  info: 'text-primary',
};

const TONE_BTN: Record<string, string> = {
  neutral: 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/80',
  success: 'bg-success/15 text-success hover:bg-success/25',
  warning: 'bg-warning/15 text-warning hover:bg-warning/25',
  critical: 'bg-danger/15 text-danger hover:bg-danger/25',
  info: 'bg-primary/15 text-primary hover:bg-primary/25',
};

/* ── shared ARIA ids ──────────────────────────────────────────────────────── */

/** The element's own spec id, stamped into props as `__fid` by FraymeRenderer
 *  (json-render does not pass the id down). Absent outside a FraymeRenderer, so
 *  the id falls back to the scope + part alone. */
function specId(element: ComponentRenderProps['element']): string {
  const raw = (element as { props?: { __fid?: unknown } }).props?.__fid;
  return typeof raw === 'string' ? raw : '';
}

/** Deterministic id for a disclosure's trigger↔region pairing. Derived from the
 *  spec id + a per-part key rather than `useId`, whose positional ids diverge
 *  when a host SSRs the renderer inside a larger 'use client' tree — and differ
 *  between two renders of one spec. Unique within a spec (one spec id per
 *  element, one index/path per part), which is what stops sibling disclosures
 *  from pointing `aria-controls` at each other's panel. */
function ariaId(scope: string, ...parts: Array<string | number>): string {
  const tail = parts
    .map((s) => String(s).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter((s) => s.length > 0)
    .join('-');
  return tail.length > 0 ? `frayme-${scope}-${tail}` : `frayme-${scope}`;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  JsonView
 * ════════════════════════════════════════════════════════════════════════════ */

/* Each size sets the DEFAULT font-size VAR (read by the base through the exact
 * `fontSize` override) instead of a `text-*` / arbitrary font-size utility — so
 * the exact channel and the enum never collide in tailwind-merge (same CSS
 * property, different group → both would survive). The sm/lg/xl variants ALSO
 * carry an explicit leading-* to reproduce the line-height the original
 * `text-xs`/`text-sm`/`text-base` utilities set (the xs/md variants used an
 * arbitrary `text-[…]` that set NO line-height, so they add none). Defaults are
 * byte-identical to the prior px/rem + line-height. */
const jsonSizeCls: Record<string, string> = {
  xs: '[--fr-jsonview-fs-default:0.6875rem]',
  sm: '[--fr-jsonview-fs-default:0.75rem] leading-[calc(1/0.75)]',
  md: '[--fr-jsonview-fs-default:0.8125rem]',
  lg: '[--fr-jsonview-fs-default:0.875rem] leading-[calc(1.25/0.875)]',
  xl: '[--fr-jsonview-fs-default:1rem] leading-[calc(1.5/1)]',
};

const HARD_DEPTH_CAP = 12;

/* The root row's path. Every descendant is `${parent}.${entryIndex}`, so a path
 * is unique, stable under re-render, and its parent is one `lastIndexOf('.')`
 * away — which is what ArrowLeft needs at a collapsed row. */
const JSON_ROOT = 'r';

/** The entry VALUES of an object/array in render order (the same order the node
 *  renders its children in, so index-derived paths line up). */
function jsonEntryValues(value: unknown): unknown[] {
  return Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
}

/** Whether a node renders as a branch (a subtree) rather than a leaf row: past
 *  the depth cap an object collapses to a `{ … }` LEAF, so the cap belongs here
 *  and not only at the render site. */
function isJsonBranch(value: unknown, depth: number, maxDepth: number): boolean {
  return value != null && typeof value === 'object' && depth < Math.min(maxDepth, HARD_DEPTH_CAP);
}

/** The visible rows in document order — the sequence ArrowDown/ArrowUp walk and
 *  Home/End jump to. It must mirror what JsonNode actually renders: a closed
 *  branch contributes no descendants, a capped object contributes none either. */
function collectJsonRows(
  value: unknown,
  depth: number,
  path: string,
  maxDepth: number,
  isOpenAt: (path: string, depth: number) => boolean,
  out: string[],
): void {
  out.push(path);
  if (!isJsonBranch(value, depth, maxDepth) || !isOpenAt(path, depth)) return;
  jsonEntryValues(value).forEach((v, i) => collectJsonRows(v, depth + 1, `${path}.${i}`, maxDepth, isOpenAt, out));
}

/** Everything a row needs from the tree that owns it. Expand state and the row
 *  order live at the root because navigation is cross-node: a row cannot know
 *  which row follows it without knowing whether its siblings are open. */
type JsonTree = {
  /** The single tab stop. A tree is ONE stop; the arrow keys move inside it. */
  roving: string;
  /** DOM id for a row's own text. Derived from the spec id + path rather than
   *  `useId`, whose positional ids diverge when a host SSRs the renderer inside
   *  a larger 'use client' tree — and differ between two renders of one spec. */
  rowId: (path: string) => string;
  isOpen: (path: string, depth: number) => boolean;
  toggle: (path: string) => void;
  setActive: (path: string) => void;
  register: (path: string, el: HTMLDivElement | null) => void;
  onRowKeyDown: (path: string, isBranch: boolean, isOpenNow: boolean) => (e: ReactKeyboardEvent<HTMLDivElement>) => void;
};

/* Focus ring for a treeitem row: the row is the focus target, so the ring is
 * drawn on it rather than on anything nested inside. */
const jsonRow = 'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

function JsonPrimitive({ value }: { value: unknown }): ReactNode {
  if (value === null) return <span className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]">null</span>;
  if (value === undefined) return <span className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]">undefined</span>;
  if (typeof value === 'string') return <span className="text-success">&quot;{value}&quot;</span>;
  if (typeof value === 'number') return <span className="text-info tabular-nums">{Number.isFinite(value) ? String(value) : 'null'}</span>;
  if (typeof value === 'boolean') return <span className="text-warning">{String(value)}</span>;
  return <span className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]">{String(value)}</span>;
}

function JsonNode({
  nodeKey,
  value,
  depth,
  path,
  maxDepth,
  showCount,
  tree,
}: {
  nodeKey: string | null;
  value: unknown;
  depth: number;
  path: string;
  maxDepth: number;
  showCount: boolean;
  tree: JsonTree;
}): ReactNode {
  const isObject = value != null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const branch = isJsonBranch(value, depth, maxDepth);
  const open = branch && tree.isOpen(path, depth);
  // A treeitem that OWNS a group would otherwise be named from its whole open
  // subtree, so the name is pinned to this row's own text.
  const rowId = tree.rowId(path);

  // Shared by every row shape: the tree is one tab stop, the arrow keys move
  // within it, and focus follows whatever the pointer lands on.
  //
  // A treeitem NESTS its descendants, and both focus and key events bubble, so
  // every row would otherwise also answer for the rows beneath it. Each row
  // handles only the events raised on ITSELF.
  const rowProps = {
    role: 'treeitem' as const,
    'aria-level': depth + 1,
    'aria-labelledby': rowId,
    tabIndex: tree.roving === path ? 0 : -1,
    ref: (el: HTMLDivElement | null) => tree.register(path, el),
    onFocus: (e: ReactFocusEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) tree.setActive(path);
    },
    onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) tree.onRowKeyDown(path, branch, open)(e);
    },
  };

  const keyLabel =
    nodeKey != null ? (
      <span className="[color:var(--fr-jsonview-accent,var(--color-primary))]">{nodeKey}</span>
    ) : null;

  // Cap protection — never recurse past the (hard-capped) maxDepth.
  if (isObject && !branch) {
    return (
      <div className={cn('leading-relaxed', jsonRow)} {...rowProps}>
        <span id={rowId}>
          {keyLabel}
          {keyLabel != null && <span className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]">: </span>}
          <span className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]">{isArray ? '[ … ]' : '{ … }'}</span>
        </span>
      </div>
    );
  }

  if (!isObject) {
    return (
      <div className={cn('leading-relaxed', jsonRow)} {...rowProps}>
        <span id={rowId}>
          {keyLabel}
          {keyLabel != null && <span className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]">: </span>}
          <JsonPrimitive value={value} />
        </span>
      </div>
    );
  }

  const entries: Array<[string, unknown]> = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const openBrace = isArray ? '[' : '{';
  const closeBrace = isArray ? ']' : '}';
  // What this row's aria-expanded actually opens. Suffixed off the (path-derived)
  // row id, so sibling rows never point at each other's subtree.
  //
  // The subtree is unmounted while closed, and aria-controls is NOT allowed to
  // outlive it (this comment used to claim it was). ARIA requires an IDREF to
  // name an element that is in the DOM; a collapsed branch — the state a tree
  // spends most of its life in — named an id nothing carried, so a reader that
  // follows "controls X" lands nowhere. aria-controls is only RECOMMENDED for a
  // disclosure, so dropping it while closed forfeits nothing, whereas the dead
  // reference actively misleads. `aria-expanded` stays in both states: the row
  // IS an expandable treeitem either way, and role=treeitem needs it.
  const subId = `${rowId}-sub`;

  return (
    <div className={cn('leading-relaxed', jsonRow)} aria-expanded={open} aria-controls={open ? subId : undefined} {...rowProps}>
      {/* The row is the only clickable target: the treeitem element also wraps
          the open subtree, so a click on a descendant must not reach it. */}
      <span
        id={rowId}
        // `hover:text-inherit`, not `hover:text-foreground`: the row's RESTING ink
        // is the panel's (now inherited) ink, and the two must agree or hovering a
        // row inside a dark card would repaint it #18181b — 1.02:1 on that surface.
        // Inert either way at present (every child sets its own colour), which is
        // exactly why it must not be left pointing at the token.
        className="inline-flex cursor-pointer items-center gap-1 hover:text-inherit"
        onClick={(e) => {
          e.stopPropagation();
          tree.toggle(path);
        }}
      >
        {/* The expand/collapse chevron reads the same muted var as every brace/
            colon/count token, so mutedColor re-tints ALL tree punctuation. */}
        <span className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]" aria-hidden>
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
        </span>
        {keyLabel}
        {keyLabel != null && <span className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]">: </span>}
        <span className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]">{openBrace}</span>
        {!open && (
          <>
            {showCount && <span className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]">{` ${entries.length} `}</span>}
            {!showCount && entries.length > 0 && <span className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]"> … </span>}
            <span className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]">{closeBrace}</span>
          </>
        )}
      </span>
      {open && (
        <div id={subId} className="ml-4 border-l border-border/60 pl-3">
          {entries.length === 0 ? (
            <div className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]">{`${openBrace}empty${closeBrace}`}</div>
          ) : (
            // `group` may own treeitems and nothing else, so the closing brace
            // stays outside it while keeping its place in the indented column.
            <div role="group">
              {entries.map(([k, v], i) => (
                <JsonNode
                  key={k}
                  nodeKey={k}
                  value={v}
                  depth={depth + 1}
                  path={`${path}.${i}`}
                  maxDepth={maxDepth}
                  showCount={showCount}
                  tree={tree}
                />
              ))}
            </div>
          )}
          <div className="[color:var(--fr-jsonview-muted,var(--color-muted-foreground))]">{closeBrace}</div>
        </div>
      )}
    </div>
  );
}

export function JsonView({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    data?: unknown;
    defaultExpandedDepth?: number | null;
    maxDepth?: number | null;
    accent?: string | null;
    mutedColor?: unknown;
    showCount?: boolean | null;
    copyable?: boolean | null;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | null;
    fontSize?: unknown;
  };
  const expandedDepth = Number.isFinite(p.defaultExpandedDepth) ? Math.max(0, Math.floor(p.defaultExpandedDepth as number)) : 1;
  const maxDepth = Number.isFinite(p.maxDepth)
    ? Math.min(HARD_DEPTH_CAP, Math.max(1, Math.floor(p.maxDepth as number)))
    : 8;
  const sizeCls = jsonSizeCls[(p.size as string) ?? 'md'] ?? jsonSizeCls.md;
  const copyable = p.copyable === true;
  const [copied, setCopied] = useState(false);

  // Expand state is stored as the paths TOGGLED AWAY from the depth default, not
  // as the open set: a subtree that streams in later is then born at the same
  // depth default as one that was present on the first render.
  const [toggledPaths, setToggledPaths] = useState<string[]>([]);
  const toggled = new Set(toggledPaths);
  const isOpen = (path: string, depth: number): boolean => (depth < expandedDepth) !== toggled.has(path);
  const toggle = (path: string): void => {
    setToggledPaths((prev) => (prev.includes(path) ? prev.filter((x) => x !== path) : [...prev, path]));
  };

  const [activePath, setActivePath] = useState<string>(JSON_ROOT);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const rows: string[] = [];
  collectJsonRows(p.data, 0, JSON_ROOT, maxDepth, isOpen, rows);
  // A row that collapsed out from under the active path leaves the tree with no
  // tab stop, so the roving stop falls back to the root row.
  const roving = rows.includes(activePath) ? activePath : (rows[0] ?? JSON_ROOT);
  const goTo = (path: string | undefined): void => {
    if (path == null) return;
    setActivePath(path);
    rowRefs.current.get(path)?.focus();
  };
  const onRowKeyDown =
    (path: string, isBranch: boolean, isOpenNow: boolean) =>
    (e: ReactKeyboardEvent<HTMLDivElement>): void => {
      const i = rows.indexOf(path);
      if (i < 0) return;
      // A key the tree consumes must stop BOTH its default action and the walk
      // up to the embedding host's own shortcuts — one ArrowDown is one intent.
      const consume = (): void => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === 'ArrowRight') {
        if (!isBranch) return;
        consume();
        if (!isOpenNow) toggle(path);
        else goTo(rows[i + 1]);
        return;
      }
      if (e.key === 'ArrowLeft') {
        if (isBranch && isOpenNow) {
          consume();
          toggle(path);
          return;
        }
        const cut = path.lastIndexOf('.');
        if (cut <= 0) return;
        consume();
        goTo(path.slice(0, cut));
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (!isBranch) return;
        consume();
        toggle(path);
        return;
      }
      const to =
        e.key === 'ArrowDown' ? rows[i + 1]
        : e.key === 'ArrowUp' ? rows[i - 1]
        : e.key === 'Home' ? rows[0]
        : e.key === 'End' ? rows[rows.length - 1]
        : undefined;
      if (to == null) return;
      consume();
      goTo(to);
    };
  // The element's own spec id; absent outside a FraymeRenderer, where the path
  // alone still separates the rows.
  const fid = specId(element);
  const tree: JsonTree = {
    roving,
    rowId: (path) => ariaId('jsonview', fid, path),
    isOpen,
    toggle,
    setActive: setActivePath,
    register: (path, el) => {
      if (el) rowRefs.current.set(path, el);
      else rowRefs.current.delete(path);
    },
    onRowKeyDown,
  };

  // copy the pretty-printed root value (self-contained, mirrors CodeBlock/
  // Artifact copy). JSON.stringify can throw on a cyclic value — fall back to a
  // best-effort String(). Copy is opt-in so no chrome renders by default.
  const copy = (): void => {
    let text: string;
    try {
      text = JSON.stringify(p.data, null, 2);
    } catch {
      text = String(p.data);
    }
    try {
      void navigator.clipboard?.writeText(text ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (no-op) */
    }
  };

  return (
    <div
      className={cn(
        // `text-inherit`, not `text-foreground`: the panel fill is `bg-muted/30`,
        // so 70% of whatever contains it shows through — it does NOT own its
        // background, and the global token is the wrong last resort there.
        // Composited on the authored card the trace came from (Card bg:#12161f
        // color:#e2e6f0) the surface is rgb(86,89,95): the token reads 2.52:1 and
        // the inherited ink 5.62:1. (Reasoning's `bg-muted/50` in ai-flow.tsx keeps
        // its token — at 50% the same arithmetic gives 4.80 vs 2.96 — so this is a
        // per-surface measurement, not a rule about washes.)
        // LATENT at present, and deliberately so: probed in the DOM, every JsonView leaf
        // paints its own colour (keys accent, punctuation/braces muted, primitives
        // success/info/warning), so nothing currently inherits this. It is the
        // chain's last resort, and it was pointing at the one value that cannot be
        // right on a surface the panel does not own.
        'relative w-full overflow-auto rounded-frayme border border-border bg-muted/30 p-3 font-mono text-inherit [font-size:var(--fr-jsonview-fs,var(--fr-jsonview-fs-default,0.8125rem))]',
        sizeCls,
      )}
      style={styleVars(
        { var: '--fr-jsonview-accent', value: p.accent, kind: 'color' },
        { var: '--fr-jsonview-muted', value: p.mutedColor, kind: 'color' },
        { var: '--fr-jsonview-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 9, max: 24 } },
      )}
    >
      {copyable && (
        <button
          type="button"
          className="absolute right-2 top-2 z-10 inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[calc(var(--radius-frayme)/2)] border border-border bg-[color:var(--fr-surface-raised,var(--color-card))] px-2 py-1 text-[0.6875rem] [color:var(--fr-jsonview-muted,var(--color-muted-foreground))] transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={copied ? 'Copied' : 'Copy JSON'}
          onClick={copy}
        >
          <Icon name={copied ? 'check' : 'copy'} size={12} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
      {/* `tree` may own treeitems and groups only, so the copy control sits on
          the scroll container OUTSIDE it. */}
      <div role="tree" aria-label="JSON viewer">
        <JsonNode
          nodeKey={null}
          value={p.data}
          depth={0}
          path={JSON_ROOT}
          maxDepth={maxDepth}
          showCount={p.showCount === true}
          tree={tree}
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  Menubar
 * ════════════════════════════════════════════════════════════════════════════ */

const menubarWrap = cva('relative flex w-full flex-wrap items-center gap-0.5 rounded-frayme border [border-color:var(--fr-menubar-border,var(--color-border))] bg-card', {
  variants: {
    size: { xs: 'text-xs', sm: 'text-[0.8125rem]', md: 'text-sm', lg: 'text-base', xl: 'text-lg' },
    dense: { true: 'p-0.5', false: 'p-1' },
  },
  defaultVariants: { size: 'md', dense: false },
});

type MenuItem = {
  label?: string | null;
  href?: string | null;
  icon?: string | null;
  disabled?: boolean | null;
  separator?: boolean | null;
  shortcut?: string | null;
};
type MenuTop = { label?: string | null; items?: MenuItem[] | null };

export function Menubar({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    menus?: MenuTop[] | null;
    activeItem?: string | null;
    accent?: string | null;
    borderColor?: unknown;
    mutedColor?: unknown;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | null;
    dense?: boolean | null;
    emptyText?: string | null;
  };
  const [, setActiveItem] = useBoundProp(p.activeItem ?? undefined, bindings?.activeItem);
  const emitWith = useIntrinsicEmit(emit, element);
  // CONTENT / i18n — defaults to the EXACT current literal.
  const emptyText = p.emptyText ?? 'No items';
  const menus = Array.isArray(p.menus) ? p.menus.filter((m): m is MenuTop => m != null && typeof m === 'object') : [];
  const size = (p.size as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | null) ?? undefined;
  const dense = (p.dense === true) as true | false;

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  // Trigger↔dropdown pairing. Keyed by the top-level index (not the label, which
  // two menus may share or omit), so each trigger names its OWN menu even when a
  // page renders several Menubars — the spec id separates those.
  const fid = specId(element);

  useEffect(() => {
    if (openIndex == null) return;
    const onDown = (e: MouseEvent): void => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenIndex(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openIndex]);

  return (
    <div
      ref={barRef}
      role="menubar"
      className={cn(menubarWrap({ size, dense }))}
      style={styleVars(
        { var: '--fr-menubar-accent', value: p.accent, kind: 'color' },
        { var: '--fr-menubar-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-menubar-muted', value: p.mutedColor, kind: 'color' },
      )}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && openIndex != null) setOpenIndex(null);
      }}
    >
      {menus.map((menu, mi) => {
        const items = Array.isArray(menu.items)
          ? menu.items.filter((it): it is MenuItem => it != null && typeof it === 'object')
          : [];
        const isOpen = openIndex === mi;
        const menuId = ariaId('menubar', fid, 'menu', mi);
        return (
          <div key={mi} className="relative">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              // Named only while the dropdown is mounted (`isOpen &&` below,
              // repeated verbatim). A closed menubar trigger — the resting state
              // of every trigger but at most one — pointed at an id no element
              // carried; aria-haspopup + aria-expanded already announce the menu,
              // and aria-controls is only RECOMMENDED here, so the reference is
              // pure loss until the menu exists.
              aria-controls={isOpen ? menuId : undefined}
              // A menu trigger names the menu — "Insert" clipped to "Ins…" is the
              // one word the bar exists to show. The bar is already flex-wrap, so
              // a long trigger has somewhere to go: it wraps instead of nowrapping
              // and shrinking under max-w-full.
              className={cn(
                'max-w-full cursor-pointer break-words rounded-sm border-0 bg-transparent px-2.5 py-1.5 font-medium outline-none transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:ring-2 focus-visible:ring-primary/50',
                isOpen ? 'bg-[color:var(--fr-surface-sunken,var(--color-muted))] [color:var(--fr-menubar-accent,var(--color-foreground))]' : 'text-foreground',
              )}
              onClick={() => setOpenIndex((cur) => (cur === mi ? null : mi))}
              onPointerEnter={() => {
                if (openIndex != null) setOpenIndex(mi);
              }}
              title={menu.label || undefined}
            >
              {menu.label ?? ''}
            </button>
            {/* "Menu chrome" coherence group: the dropdown border, item
                separators, and kbd chip edges all read --fr-menubar-border
                (token fallback) so ONE borderColor brands the whole menu
                system, not just the bar frame. */}
            {isOpen && (
              <div
                id={menuId}
                role="menu"
                aria-label={menu.label ?? undefined}
                className="absolute left-0 top-full z-30 mt-1 flex min-w-52 flex-col gap-0.5 rounded-frayme border [border-color:var(--fr-menubar-border,var(--color-border))] bg-card p-1 shadow-lg"
              >
                {items.length === 0 ? (
                  <span className="px-3 py-1.5 text-sm [color:var(--fr-menubar-muted,var(--color-muted-foreground))]">{emptyText}</span>
                ) : (
                  items.map((item, ii) => {
                    if (item.separator === true) {
                      return <span key={ii} role="separator" className="my-1 h-px [background:var(--fr-menubar-border,var(--color-border))]" />;
                    }
                    const disabled = item.disabled === true;
                    const iconNode =
                      typeof item.icon === 'string' && hasIcon(item.icon) ? (
                        // Leading glyphs sit inline with themed secondary text
                        // (shortcuts / empty line) — same muted var, one set.
                        <span className="shrink-0 [color:var(--fr-menubar-muted,var(--color-muted-foreground))]" aria-hidden>
                          <Icon name={item.icon} size={15} />
                        </span>
                      ) : null;
                    const content = (
                      <>
                        {iconNode}
                        {/* The dropdown is shrink-to-fit inside a narrow trigger,
                            so a nowrap item label was clipped by the panel's own
                            width, not by the viewport. It wraps; the shortcut chip
                            beside it stays shrink-0 on the right. */}
                        <span className="min-w-0 flex-1 break-words" title={item.label || undefined}>{item.label ?? ''}</span>
                        {item.shortcut != null && (
                          <kbd className="ml-3 shrink-0 rounded border [border-color:var(--fr-menubar-border,var(--color-border))] bg-[color:var(--fr-surface-sunken,var(--color-muted))] px-1.5 py-0.5 text-[0.6875rem] font-medium [color:var(--fr-menubar-muted,var(--color-muted-foreground))]">
                            {item.shortcut}
                          </kbd>
                        )}
                      </>
                    );
                    const rowCls = cn(
                      'flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm no-underline outline-none transition-colors',
                      disabled
                        ? 'cursor-not-allowed text-muted-foreground/50'
                        : 'cursor-pointer text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:ring-2 focus-visible:ring-primary/50',
                    );
                    if (item.href != null && !disabled) {
                      return (
                        <a
                          key={ii}
                          role="menuitem"
                          className={rowCls}
                          href={safeUrl(item.href)}
                          {...linkTargetRel(false)}
                          onClick={() => {
                            setOpenIndex(null);
                            setActiveItem(item.label ?? String(ii));
                            emitWith('select', { value: item.label ?? String(ii), label: item.label ?? null, index: ii });
                          }}
                        >
                          {content}
                        </a>
                      );
                    }
                    return (
                      <button
                        key={ii}
                        type="button"
                        role="menuitem"
                        className={cn(rowCls, 'border-0 bg-transparent text-left')}
                        aria-disabled={disabled}
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          setOpenIndex(null);
                          setActiveItem(item.label ?? String(ii));
                          emitWith('select', { value: item.label ?? String(ii), label: item.label ?? null, index: ii });
                        }}
                      >
                        {content}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  Fab
 * ════════════════════════════════════════════════════════════════════════════ */

const FAB_POS: Record<string, string> = {
  'bottom-right': 'bottom-4 right-4 flex-col-reverse items-end',
  'bottom-left': 'bottom-4 left-4 flex-col-reverse items-start',
  'top-right': 'top-4 right-4 flex-col items-end',
  'top-left': 'top-4 left-4 flex-col items-start',
};

// Each size sets the DEFAULT diameter VAR (read by the main button through the
// exact `sizeValue` override) instead of height/width utilities — so the exact
// channel and the enum never collide in tailwind-merge (an arbitrary height/width
// declaration and the sizing utilities are different groups, so both would
// survive). Defaults are byte-identical: md = 3rem (was the 12-step), lg = 3.5rem.
const FAB_MAIN_SIZE: Record<string, string> = {
  md: '[--fr-fab-size-default:3rem]',
  lg: '[--fr-fab-size-default:3.5rem]',
};

type FabAction = { label?: string | null; icon?: string | null; tone?: string | null };

export function Fab({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    icon?: string | null;
    label?: string | null;
    actions?: FabAction[] | null;
    activeAction?: string | null;
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | null;
    accent?: string | null;
    accentText?: string | null;
    borderStyle?: string | null;
    size?: 'md' | 'lg' | null;
    sizeValue?: unknown;
    extended?: boolean | null;
    shadow?: string | null;
  };
  const [, setActiveAction] = useBoundProp(p.activeAction ?? undefined, bindings?.activeAction);
  const emitWith = useIntrinsicEmit(emit, element);
  const actions = Array.isArray(p.actions)
    ? p.actions.filter((a): a is FabAction => a != null && typeof a === 'object')
    : [];
  const position = (p.position as keyof typeof FAB_POS) ?? 'bottom-right';
  const posCls = FAB_POS[position] ?? FAB_POS['bottom-right'];
  const mainSize = FAB_MAIN_SIZE[(p.size as string) ?? 'md'] ?? FAB_MAIN_SIZE.md;
  const mainIcon = typeof p.icon === 'string' && hasIcon(p.icon) ? p.icon : 'plus';
  const label = p.label ?? 'Actions';
  const labelLeft = position === 'bottom-left' || position === 'top-left';
  // the extended FAB (Material) shows the label as a pill next to the
  // icon. Opt-in; only when a visible `label` exists (else it stays circular).
  const extended = p.extended === true && p.label != null;

  const [open, setOpen] = useState(false);
  // What the main button's aria-expanded opens. The action rows are direct flex
  // items of the rail (a wrapper would swallow the gap between them), so the
  // trigger names them as an ID LIST instead — aria-controls takes one. Keyed by
  // action index, with the spec id separating two Fabs on one page.
  //
  // The rows mount on `open`, so the list is emitted on `open` too (below): a
  // resting FAB with four actions used to publish four ids that no element
  // carried — one dangling reference per action, on the state the control is in
  // until it is pressed. Same rule as the Menubar/JsonView triggers above.
  const fid = specId(element);
  const actionId = (ai: number): string => ariaId('fab', fid, 'action', ai);

  return (
    <div className={cn('relative min-h-44 w-full overflow-hidden rounded-frayme border border-dashed border-border bg-muted/20', borderStyleClass(p.borderStyle))}>
      <div
        className={cn('absolute z-10 flex gap-3', posCls)}
        style={styleVars(
          { var: '--fr-fab-accent', value: p.accent, kind: 'color' },
          { var: '--fr-fab-accent-text', value: p.accentText, kind: 'color' },
          { var: '--fr-fab-size', value: p.sizeValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 32, max: 80 } },
        )}
      >
        {open &&
          actions.map((action, ai) => {
            const aIcon = typeof action.icon === 'string' && hasIcon(action.icon) ? action.icon : 'plus';
            const toneCls = TONE_BTN[(action.tone as string) ?? 'neutral'] ?? TONE_BTN.neutral;
            // The action chip is the only thing naming an icon-only FAB button, so
            // a clipped label leaves the user guessing what the button does. The
            // 12rem cap never relaxed — it clipped the same on a wide screen — and
            // the chip's absolutely-positioned rail is already shrink-to-fit inside
            // the frame, so dropping it just lets the label wrap within that bound.
            const chip = (
              <span className="break-words rounded-frayme bg-[color:var(--fr-surface-raised,var(--color-card))] px-2 py-1 text-xs font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))] shadow-sm" title={action.label || undefined}>
                {action.label ?? ''}
              </span>
            );
            return (
              <div key={ai} id={actionId(ai)} className={cn('flex items-center gap-2', labelLeft && 'flex-row-reverse')}>
                {action.label != null && chip}
                <button
                  type="button"
                  aria-label={action.label ?? `Action ${ai + 1}`}
                  className={cn(
                    'inline-flex h-10 w-10 items-center justify-center rounded-full shadow-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50',
                    toneCls,
                  )}
                  onClick={() => {
                    setActiveAction(action.label ?? String(ai));
                    emitWith('commit', { label: action.label ?? null, index: ai });
                  }}
                >
                  <Icon name={aIcon} size={18} />
                </button>
              </div>
            );
          })}
        <button
          type="button"
          aria-label={label}
          aria-expanded={actions.length > 0 ? open : undefined}
          aria-controls={actions.length > 0 && open ? actions.map((_, ai) => actionId(ai)).join(' ') : undefined}
          className={cn(
            'inline-flex items-center justify-center rounded-full shadow-lg outline-none transition-transform focus-visible:ring-2 focus-visible:ring-primary/60',
            // Extended FAB: a fixed-height pill (auto width, horizontal padding,
            // icon + visible label). Otherwise the circular icon button whose
            // width+height read the sizeValue channel with the size-enum default.
            extended
              ? 'gap-2 px-4 [height:var(--fr-fab-size,var(--fr-fab-size-default,3rem))]'
              : '[height:var(--fr-fab-size,var(--fr-fab-size-default,3rem))] [width:var(--fr-fab-size,var(--fr-fab-size-default,3rem))] max-w-full',
            mainSize,
            // quiet defaults: neutral high-contrast circle (foreground/card) by
            // default, not a saturated brand slab; a supplied `accent` still fills brand.
            '[background:var(--fr-fab-accent,var(--color-foreground))] [color:var(--fr-fab-accent-text,var(--color-card))]',
            open && actions.length > 0 && !extended && 'rotate-45',
            // Elevation channel LAST — a set value dedupe-wins the baked shadow-lg
            // (same tw-merge box-shadow group); unset → undefined → baked shadow-lg.
            shadowClass(p.shadow),
          )}
          onClick={() => {
            if (actions.length > 0) setOpen((o) => !o);
            else emitWith('commit', { label: p.label ?? null });
          }}
        >
          <Icon name={mainIcon} size={p.size === 'lg' ? 24 : 22} />
          {/* KEPT nowrap: the extended FAB is a FIXED-HEIGHT pill (the height var
              above) with auto width — one line is its literal contract, and it
              grows sideways to hold the label instead of hiding it (no
              overflow:hidden here, so nothing is ellipsised away). */}
          {extended && <span className="whitespace-nowrap text-sm font-medium">{p.label}</span>}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  RelativeTime
 * ════════════════════════════════════════════════════════════════════════════ */

/** Parse the target into epoch ms, or null if unparseable. */
function parseTarget(target: unknown): number | null {
  if (typeof target === 'number' && Number.isFinite(target)) return target;
  if (typeof target === 'string' && target.trim().length > 0) {
    const t = new Date(target).getTime();
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/** The relative-time unit table. `long` is the resolved (possibly localized)
 *  word; `short` is the compact suffix (s/m/h/…). `key` indexes the labels map. */
type RelUnitKey = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
const REL_UNITS: Array<{ limit: number; div: number; short: string; key: RelUnitKey }> = [
  { limit: 60_000, div: 1000, short: 's', key: 'second' },
  { limit: 3_600_000, div: 60_000, short: 'm', key: 'minute' },
  { limit: 86_400_000, div: 3_600_000, short: 'h', key: 'hour' },
  { limit: 604_800_000, div: 86_400_000, short: 'd', key: 'day' },
  { limit: 2_629_800_000, div: 604_800_000, short: 'w', key: 'week' },
  { limit: 31_557_600_000, div: 2_629_800_000, short: 'mo', key: 'month' },
  { limit: Infinity, div: 31_557_600_000, short: 'y', key: 'year' },
];

/** The resolved relative-time vocabulary — every word defaults to the current
 *  English; a spec `labels` object overrides only the keys it supplies. */
interface RelLabels {
  justNowLong: string; // "just now"
  justNowShort: string; // "now"
  ago: string; // "ago"
  in: string; // "in"
  expired: string; // "expired"
  second: string;
  minute: string;
  hour: string;
  day: string;
  week: string;
  month: string;
  year: string;
}
const DEFAULT_REL_LABELS: RelLabels = {
  justNowLong: 'just now',
  justNowShort: 'now',
  ago: 'ago',
  in: 'in',
  expired: 'expired',
  second: 'second',
  minute: 'minute',
  hour: 'hour',
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
};

/** Merge a (possibly partial / untrusted) spec `labels` object over the English
 *  defaults — non-string values are ignored so the default wins (props-less →
 *  byte-identical). `justNow` overrides the long phrase; the short "now" stays
 *  unless explicitly given. */
function resolveRelLabels(raw: unknown): RelLabels {
  if (raw == null || typeof raw !== 'object') return DEFAULT_REL_LABELS;
  const src = raw as Record<string, unknown>;
  const pick = (k: string, fallback: string): string =>
    typeof src[k] === 'string' && (src[k] as string).length > 0 ? (src[k] as string) : fallback;
  return {
    justNowLong: pick('justNow', DEFAULT_REL_LABELS.justNowLong),
    justNowShort: DEFAULT_REL_LABELS.justNowShort,
    ago: pick('ago', DEFAULT_REL_LABELS.ago),
    in: pick('in', DEFAULT_REL_LABELS.in),
    expired: pick('expired', DEFAULT_REL_LABELS.expired),
    second: pick('second', DEFAULT_REL_LABELS.second),
    minute: pick('minute', DEFAULT_REL_LABELS.minute),
    hour: pick('hour', DEFAULT_REL_LABELS.hour),
    day: pick('day', DEFAULT_REL_LABELS.day),
    week: pick('week', DEFAULT_REL_LABELS.week),
    month: pick('month', DEFAULT_REL_LABELS.month),
    year: pick('year', DEFAULT_REL_LABELS.year),
  };
}

/** "2h ago" / "in 3 days" from a delta (target - now) in ms. */
function formatRelative(target: number, now: number, long: boolean, labels: RelLabels): string {
  const diff = target - now;
  const abs = Math.abs(diff);
  if (abs < 5000) return long ? labels.justNowLong : labels.justNowShort;
  const unit = REL_UNITS.find((u) => abs < u.limit) ?? REL_UNITS[REL_UNITS.length - 1];
  const n = Math.max(1, Math.round(abs / unit.div));
  const ahead = diff > 0;
  if (long) {
    const word = `${n} ${labels[unit.key]}${n === 1 ? '' : 's'}`;
    return ahead ? `${labels.in} ${word}` : `${word} ${labels.ago}`;
  }
  return ahead ? `${labels.in} ${n}${unit.short}` : `${n}${unit.short} ${labels.ago}`;
}

/** "3:42" / "1:02:09" countdown from a delta in ms (clamped at 0). */
function formatCountdown(target: number, now: number, long: boolean, labels: RelLabels): string {
  const remaining = Math.max(0, target - now);
  if (remaining === 0) return labels.expired;
  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (x: number): string => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function RelativeTime({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    target?: string | number | null;
    mode?: 'relative' | 'countdown' | null;
    format?: 'short' | 'long' | null;
    prefix?: string | null;
    suffix?: string | null;
    tone?: string | null;
    mutedColor?: unknown;
    labels?: unknown;
  };
  const targetMs = parseTarget(p.target);
  const mode = (p.mode as 'relative' | 'countdown' | null) ?? 'relative';
  const long = p.format === 'long';
  const toneCls = TONE_TEXT[(p.tone as string) ?? 'neutral'] ?? TONE_TEXT.neutral;
  const mutedStyle = styleVars({ var: '--fr-rt-muted', value: p.mutedColor, kind: 'color' });
  // Resolve the (possibly localized) vocabulary — every word defaults to English.
  const labels = resolveRelLabels(p.labels);

  // SSR-safe: compute an initial string against the target itself (no clock at
  // module/render scope), then tick against the live clock only on the client.
  const compute = (now: number): string =>
    mode === 'countdown'
      ? formatCountdown(targetMs as number, now, long, labels)
      : formatRelative(targetMs as number, now, long, labels);

  // Initial reference = the target itself → relative renders a stable seed
  // ("now"/"just now") identically on server + first client paint (no mismatch).
  const [text, setText] = useState<string | null>(targetMs == null ? null : compute(targetMs));

  useEffect(() => {
    if (targetMs == null) return;
    const tick = (): void => setText(compute(Date.now()));
    tick();
    const interval = mode === 'countdown' ? 1000 : 30_000;
    const id = window.setInterval(tick, interval);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMs, mode, long]);

  if (targetMs == null) {
    return (
      <span className="[color:var(--fr-rt-muted,var(--color-muted-foreground))]" style={mutedStyle} aria-label="unknown time">
        —
      </span>
    );
  }

  // a valid <time> carries the machine-readable ISO timestamp in
  // `dateTime` and the absolute time in `title` (GitHub relative-time convention:
  // hover reveals the exact time). Both derive from `targetMs` (deterministic, no
  // wall clock) so they stay SSR-stable. toLocaleString can throw on exotic
  // envs — guard it and fall back to the ISO string.
  const iso = new Date(targetMs).toISOString();
  let absolute: string;
  try {
    absolute = new Date(targetMs).toLocaleString();
  } catch {
    absolute = iso;
  }
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', toneCls)} style={mutedStyle}>
      {p.prefix != null && <span className="[color:var(--fr-rt-muted,var(--color-muted-foreground))]">{p.prefix}</span>}
      <time dateTime={iso} title={absolute}>{text}</time>
      {p.suffix != null && <span className="[color:var(--fr-rt-muted,var(--color-muted-foreground))]">{p.suffix}</span>}
    </span>
  );
}
