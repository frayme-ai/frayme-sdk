'use client';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { cva } from 'class-variance-authority';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars, borderStyleClass, shadowClass, motionClass } from './_style.js';
import { Icon, hasIcon } from './icons.js';
import { useAriaId } from './_aria.js';

/* Catalog group: FileUpload, CommandPalette.
 *
 * The render-only input/overlay family — a dropzone and a cmd-k command surface.
 * Same truly-dynamic contract as Phases 1–4:
 *   - ENUM props → static CVA classes (a closed set of allowed values).
 *   - VALUE props (color/dimension the model names directly) NEVER become
 *     classes — they land in `--fr-<comp>-<role>` CSS vars via `styleVars(...)`,
 *     read by STATIC arbitrary `var(--fr-…, var(--color-…))` utilities. The class
 *     set stays closed (no JIT, no injection); only the var's VALUE is
 *     model-supplied, and `styleVars` re-validates + omits any failing/absent
 *     value so the token fallback wins (props-less → polished).
 *
 * RENDER-ONLY: these render in a sandboxed MCP iframe from an UNTRUSTED spec.
 * FileUpload's <input type=file> onChange reads e.target.files and emits ONCE via
 * `commit` with each file's name/size/type/lastModified + a capped data-URI (null
 * over the cap) — it never auto-UPLOADS; the host routes the delivered value.
 * CommandPalette renders an inline surface (no portal, SSR-safe) and only emits on
 * selection; the host routes the value.
 *
 * Defaults live in CVA `defaultVariants`, never the schema (schema props are
 * `.nullable()`), so a props-less spec still renders polished. */

/* ── FileUpload ─────────────────────────────────────────────────────────────── */

/* The dropzone. `accent` drives the hover/focus border + ring via a var with a
   primary-token fallback; the dashed border + bg route through their own vars. */
const dropzone = cva(
  'group relative flex w-full cursor-pointer flex-col items-center justify-center border border-dashed text-center transition-[border-color,box-shadow] focus-within:ring-2 [border-color:var(--fr-upload-border,var(--color-border))] [background:var(--fr-upload-bg,var(--fr-surface-sunken,var(--color-muted)))] hover:[border-color:var(--fr-upload-accent,var(--fr-accent))] focus-within:[border-color:var(--fr-upload-accent,var(--fr-accent))] focus-within:[--tw-ring-color:color-mix(in_srgb,var(--fr-upload-accent,var(--fr-accent))_20%,transparent)]',
  {
    variants: {
      size: {
        sm: 'gap-1.5 rounded-frayme p-4 text-sm',
        md: 'gap-2 rounded-frayme p-6',
        lg: 'gap-2.5 rounded-2xl p-10 text-lg',
      },
      disabled: { true: 'pointer-events-none cursor-not-allowed opacity-60', false: '' },
    },
    defaultVariants: { size: 'md', disabled: false },
  },
);

type UploadFile = { name: string; size?: string | null; status?: 'uploading' | 'done' | 'error' | null; progress?: number | null };
/** The component OWNS its file list: seeded from the `files` prop, appended on pick, removed on ×. */
interface FileRow { id: string; name: string; sizeLabel: string | null; status: 'uploading' | 'done' | 'error' | null; progress: number | null; locked?: boolean }

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* Inline data-URI cap for the `commit` payload: files at/under ~1MB are read to a
   base64 data-URI the agent can act on directly; larger files carry dataUrl:null
   (name/size/type still delivered) to bound the emitted payload size / avoid DoS. */
const FILE_DATAURL_MAX_BYTES = 1024 * 1024;

export function FileUpload({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const emitWith = useIntrinsicEmit(emit, element);
  const p = (element.props ?? {}) as {
    accept?: string | null;
    multiple?: boolean | null;
    maxSize?: string | null;
    label?: string | null;
    hint?: string | null;
    icon?: string | null;
    files?: UploadFile[] | null;
    selectedFiles?: UploadFile[] | null;
    lockExisting?: boolean | null;
    size?: 'sm' | 'md' | 'lg' | null;
    disabled?: boolean | null;
    accent?: string | null;
    borderColor?: string | null;
    borderStyle?: 'solid' | 'dashed' | 'dotted' | null;
    bg?: string | null;
    mutedColor?: string | null;
  };
  const size = (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined;
  const disabled = (p.disabled ?? false) as true | false;
  const iconName = p.icon ?? 'upload';
  const label = p.label ?? 'Drag & drop or click to upload';
  const iconSize = size === 'sm' ? 22 : size === 'lg' ? 36 : 28;

  // ── OWN the file list (seeded from props, appended on pick, removed on ×) ────
  const seedKey = JSON.stringify(p.files ?? null);
  // Permission fidelity: a locked seeded file has no remove × — prior
  // uploads in an evidence/document packet stay; NEW picks are never locked.
  const lockExisting = p.lockExisting === true;
  const seed = (): FileRow[] =>
    (Array.isArray(p.files) ? p.files : []).map((f, i) => ({
      id: `seed-${i}`,
      name: f?.name ?? 'Untitled',
      sizeLabel: typeof f?.size === 'string' ? f.size : null,
      status: (f?.status as 'uploading' | 'done' | 'error' | null) ?? null,
      progress: typeof f?.progress === 'number' && Number.isFinite(f.progress) ? f.progress : null,
      locked: (f as { locked?: unknown } | null)?.locked === true || lockExisting || undefined,
    }));
  // Local-or-bound so the live file set lands in (bindable) spec.state on every
  // pick and every remove-× — an external Submit can then read `selectedFiles`.
  // FALLS BACK to local state when unbound, so unbound rendering is byte-identical.
  // BOUND mode must render the LIVE state-resolved prop (p.selectedFiles), not the
  // static seed: upstream's bound value IS the re-resolved propValue, so passing
  // seed() froze every bound FileUpload at its seeded list — picks wrote state
  // correctly but never showed.
  const liveBound = Array.isArray(p.selectedFiles) ? (p.selectedFiles as FileRow[]) : undefined;
  const [filesMaybe, setFiles] = useBoundProp<FileRow[]>(liveBound ?? seed(), (bindings as { selectedFiles?: unknown } | undefined)?.selectedFiles);
  const files = filesMaybe ?? [];
  const filesRef = useRef<FileRow[]>(files);
  const idc = useRef(0);
  useEffect(() => { const s = seed(); filesRef.current = s; setFiles(s); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [seedKey]);
  const write = (next: FileRow[]): void => { filesRef.current = next; setFiles(next); };
  const removeRow = (row: FileRow, index: number): void => {
    if (row.locked === true) return;
    const next = filesRef.current.filter((r) => r.id !== row.id);
    write(next);
    emitWith('dismiss', { index, label: row.name, name: row.name, count: next.length });
  };
  return (
    <div className="flex w-full flex-col gap-3" style={styleVars({ var: '--fr-upload-muted', value: p.mutedColor, kind: 'color' })}>
      <label
        className={cn(
          dropzone({ size, disabled }),
          p.accent != null && '[border-color:var(--fr-upload-accent)]',
          p.borderColor != null && '[border-color:var(--fr-upload-border)]',
          borderStyleClass(p.borderStyle),
          p.bg != null && '[background:var(--fr-upload-bg)]',
        )}
        role="button"
        aria-label={label}
        aria-disabled={disabled || undefined}
        style={styleVars(
          { var: '--fr-upload-accent', value: p.accent, kind: 'color' },
          { var: '--fr-upload-border', value: p.borderColor, kind: 'color' },
          { var: '--fr-upload-bg', value: p.bg, kind: 'color' },
        )}
      >
        {hasIcon(iconName) && (
          <span className="[color:var(--fr-upload-muted,var(--color-muted-foreground))] group-hover:[color:var(--fr-upload-accent,var(--fr-accent))]" aria-hidden>
            <Icon name={iconName} size={iconSize} />
          </span>
        )}
        <span className="font-medium text-foreground">{label}</span>
        {p.hint != null && <span className="text-sm [color:var(--fr-upload-muted,var(--color-muted-foreground))]">{p.hint}</span>}
        {(p.accept != null || p.maxSize != null) && (
          <span className="text-[0.75rem] [color:var(--fr-upload-muted,var(--color-muted-foreground))]">
            {[p.accept, p.maxSize != null ? `up to ${p.maxSize}` : null].filter(Boolean).join(' · ')}
          </span>
        )}
        {/* Reads the picked files and emits ONCE via `commit` with the resolved
            file metadata + a capped data-URI per small file, so the agent actually
            RECEIVES what the user chose. Large files (over the cap) carry dataUrl:null
            (metadata still delivered). SSR-safe: FileReader is guarded. */}
        <input
          className="sr-only"
          type="file"
          accept={p.accept ?? undefined}
          multiple={p.multiple ?? undefined}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length === 0) return;
            const canRead = typeof FileReader !== 'undefined';
            void Promise.all(
              picked.map(
                (file) =>
                  new Promise<{ name: string; size: number; type: string; lastModified: number; dataUrl: string | null }>((resolve) => {
                    const meta = { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified };
                    if (!canRead || file.size > FILE_DATAURL_MAX_BYTES) {
                      resolve({ ...meta, dataUrl: null });
                      return;
                    }
                    const r = new FileReader();
                    r.onload = () => resolve({ ...meta, dataUrl: typeof r.result === 'string' ? r.result : null });
                    r.onerror = () => resolve({ ...meta, dataUrl: null });
                    r.readAsDataURL(file);
                  }),
              ),
            ).then((resolved) => {
              // append the picked files to the owned list so they SHOW in the UI (done status).
              const rows: FileRow[] = resolved.map((r) => ({ id: `f${++idc.current}`, name: r.name, sizeLabel: formatBytes(r.size), status: 'done', progress: null }));
              write(p.multiple === false ? rows : [...filesRef.current, ...rows]);
              emitWith('commit', { files: resolved, count: resolved.length });
            });
            e.target.value = ''; // allow re-picking the same file
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((f, i) => {
            const status = (f?.status as 'uploading' | 'done' | 'error' | null) ?? null;
            // Per-file upload progress (0–100, clamped) → a 2px accent bar under
            // the row. Only rendered when a numeric progress is supplied; absent → no bar,
            // row layout unchanged. The bar tint reuses the zone `accent`
            // channel (--fr-upload-accent, primary token fallback).
            const rawProg = f.progress;
            const progress = rawProg != null ? Math.min(Math.max(rawProg, 0), 100) : null;
            return (
              <li
                key={f.id}
                className="flex flex-col gap-1.5 rounded-frayme border border-border bg-[color:var(--fr-surface-raised,var(--color-card))] px-3 py-2 text-sm"
              >
                {/* SHATTERED TEXT (320px): `flex-wrap` is the second half of the
                    min-width floor below, and neither works alone.
                    The name is the ONLY flexible item in this row — every sibling
                    is shrink-0 — so it absorbs 100% of any narrowing. Measured at
                    a 320px viewport, spec = padded root › Card › FileUpload: the
                    row is 148px and the name got 20px × 300px tall, 17.9 lines of
                    one or two characters ("burst-pipe-kitchen-2026-08-01.pdf").
                    Plain Latin — this needs no hostile input to fire.
                    A floor alone would just move the failure: with nothing able
                    to give, the line would overflow the card instead, which is
                    the trade this codebase has already been round once. Wrapping
                    lets the metadata drop to a second line, which the row can
                    afford (no fixed height) and the name cannot.
                    Nothing changes above ~207px of content: the flex line only
                    breaks when the hypothetical sizes exceed the row, and the
                    floor IS that hypothetical size (CSS Flexbox §9.3 clamps the
                    flex base size by min-width before collecting lines) — which
                    is also why the floor is what triggers the wrap at all. */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 [color:var(--fr-upload-muted,var(--color-muted-foreground))]" aria-hidden>
                    <Icon name="upload" size={15} />
                  </span>
                  {/* A filename is the only way the user tells two uploads apart,
                      and it is exactly the string that loses its tail to an
                      ellipsis ("…-final-v2-approved.pdf" is the informative
                      half). The row has no fixed height and every sibling is
                      shrink-0, so wrapping here costs a line and deletes nothing;
                      an explicit min-width lets overflow-wrap break one long
                      unbroken name (it is what defeats flex's `min-width:auto`,
                      which is min-content and would overflow instead).
                      That job is unchanged — what changes is the VALUE. `0` let
                      the name yield all the way to nothing; `10ch` is the same
                      override with a floor. Not `truncate` (hides the tail) and
                      not dropping the override (back to overflow) — this codebase
                      has been round both of those. 10ch is ~78px at this 14px
                      step, clearing a 3×font-size = 42px readability threshold with
                      room, and in ch it tracks the font-size instead of pinning a
                      px guess. It caps how much the name can yield, not how much
                      it can use: min-width never shrinks a box that has room. */}
                  <span className="min-w-[10ch] flex-1 break-words text-foreground" title={f.name || undefined}>{f.name}</span>
                  {f.sizeLabel != null && <span className="shrink-0 [color:var(--fr-upload-muted,var(--color-muted-foreground))]">{f.sizeLabel}</span>}
                  {status === 'done' && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-success" title="Done">
                      <Icon name="check-circle" size={16} />
                      <span className="sr-only">Done</span>
                    </span>
                  )}
                  {status === 'uploading' && (
                    <span className="inline-flex shrink-0 items-center gap-1 [color:var(--fr-upload-muted,var(--color-muted-foreground))]" title="Uploading">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                      <span className="sr-only">Uploading</span>
                    </span>
                  )}
                  {status === 'error' && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-danger" title="Error">
                      <Icon name="alert-circle" size={16} />
                      <span className="sr-only">Error</span>
                    </span>
                  )}
                  {/* Remove × — the component OWNS the list, so this actually removes the
                      row from the UI (state) AND emits `dismiss` with the remaining count.
                      LOCKED rows show a lock glyph instead: rendering an enabled × whose
                      handler early-returns read as "delete is broken". */}
                  {f.locked === true ? (
                    <span
                      className="inline-flex shrink-0 items-center justify-center p-0.5 leading-none opacity-60 [color:var(--fr-upload-muted,var(--color-muted-foreground))]"
                      title="Locked to the record"
                      aria-label={`${f.name} is locked and cannot be removed`}
                    >
                      <Icon name="lock" size={14} />
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center justify-center rounded-frayme p-0.5 leading-none opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_40%,transparent)] [color:var(--fr-upload-muted,var(--color-muted-foreground))]"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => removeRow(f, i)}
                    >
                      <Icon name="x" size={15} />
                    </button>
                  )}
                </div>
                {progress != null && (
                  <div className="h-0.5 w-full overflow-hidden rounded-full bg-[color:var(--fr-surface-sunken,var(--color-muted))]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                    <div
                      className="h-full rounded-full [background:var(--fr-upload-accent,var(--color-primary))]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── CommandPalette ─────────────────────────────────────────────────────────── */

type CmdItem = { label: string; icon?: string | null; shortcut?: string | null; value: string };
type CmdGroup = { heading?: string | null; items: CmdItem[] };

/* The surface. `bg`/`borderColor` route through their own vars; `accent` drives
   the active item highlight via a var with a primary-token fallback. */
const paletteSurface =
  'flex flex-col overflow-hidden rounded-frayme border [border-color:var(--fr-cmd-border,var(--color-border))] [background:var(--fr-cmd-bg,var(--color-card))] [width:var(--fr-cmd-menuWidth,100%)] max-w-full shadow-sm';

export function CommandPalette({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    placeholder?: string | null;
    groups?: CmdGroup[] | null;
    value?: string | null;
    selected?: string | null;
    emptyText?: string | null;
    accent?: string | null;
    bg?: string | null;
    borderColor?: string | null;
    mutedColor?: string | null;
    menuWidth?: string | number | null;
    maxHeight?: string | number | null;
    shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | null;
    motion?: 'none' | 'fast' | 'normal' | 'slow' | null;
    emitOnChange?: boolean | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const [query, setQuery] = useBoundProp<string>(p.value ?? undefined, bindings?.value);
  // The chosen command — local-or-bound so the highlight follows the user's
  // click/hover out of the box, and a spec that binds `selected` can read which
  // command fired.
  const [selected, setSelected] = useBoundProp<string>(p.selected ?? undefined, bindings?.selected);
  const q = (query ?? '').toLowerCase().trim();
  const groups = Array.isArray(p.groups) ? p.groups : [];
  // Per-INSTANCE ids for the combobox↔listbox pairing (`aria-controls`) and for
  // the rows `aria-activedescendant` names.
  //
  // The list id was the fixed literal `fr-cmd-list` and the row ids were the item
  // VALUE alone, on the theory that a literal is SSR-stable. It is — and it is
  // also the same string in every instance: two palettes on one page (or one
  // palette inside a `repeat`, which re-renders one element per row) emitted two
  // `id="fr-cmd-list"` elements, so both inputs' aria-controls resolved to the
  // FIRST palette's list and both aria-activedescendants pointed at the first
  // palette's row whenever the two shared an item value. `useAriaId` is unique
  // per component instance, and the input and the list it names are rendered by
  // this same component from this same value, so the pairing cannot come apart —
  // the reasoning in _aria.ts, applied to the last hand-rolled id in the family.
  const aid = useAriaId('cmd', element);
  const listId = aid('list');

  // Filter items by case-insensitive substring.
  const filtered = groups.map((g) => {
    const items = Array.isArray(g?.items) ? g.items : [];
    const kept = items.filter((it) => typeof it?.label === 'string' && it.label.toLowerCase().includes(q));
    return { heading: g?.heading ?? null, items: kept };
  });
  const totalMatches = filtered.reduce((n, g) => n + g.items.length, 0);
  // The active (highlighted) item = the selected one when it's still a match,
  // else the first match. Drives aria-selected + the accent highlight.
  const flatItems = filtered.flatMap((g) => g.items);
  const firstVal = flatItems.find((it) => typeof it?.value === 'string')?.value ?? null;
  const activeVal = selected != null && flatItems.some((it) => it?.value === selected) ? selected : firstVal;
  const choose = (it: CmdItem | undefined) => {
    if (typeof it?.value === 'string') setSelected(it.value);
    emitWith('select', { value: it?.value ?? null, label: it?.label ?? null });
  };

  // keyboard navigation — the defining cmd-k interaction. ArrowDown/ArrowUp move
  // the active item through the FILTERED flat list (wrapping at the ends), Enter
  // activates it exactly like a click. Runs on the search input's keydown; handled keys
  // preventDefault so the caret doesn't jump. When no item is active yet, ArrowDown lands
  // on the first, ArrowUp on the last.
  const optId = (val: string): string => aid('opt', val);
  const listRef = useRef<HTMLUListElement | null>(null);
  const activeIndex = flatItems.findIndex((it) => it?.value === activeVal);
  const moveActive = (delta: 1 | -1): void => {
    const n = flatItems.length;
    if (n === 0) return;
    const from = activeIndex < 0 ? (delta === 1 ? -1 : 0) : activeIndex;
    const nextIdx = ((from + delta) % n + n) % n;
    const nextVal = flatItems[nextIdx]?.value;
    if (typeof nextVal === 'string') setSelected(nextVal);
  };
  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Enter') {
      const active = flatItems.find((it) => it?.value === activeVal);
      if (active) {
        e.preventDefault();
        choose(active);
      }
    }
  };
  // Keep the active row visible as it moves off-screen (scrollInto-nearest, no smooth
  // scroll so it's deterministic under the fake DOM / reduced-motion). Look the row up by
  // a data attribute (not a `#id` selector) so we never need CSS.escape — which is absent
  // in some non-browser DOMs (jsdom) and whose call would throw and unmount the palette.
  useEffect(() => {
    if (activeVal == null || listRef.current == null) return;
    const row = listRef.current.querySelector(`[data-cmd-option="${activeVal}"]`);
    if (row instanceof HTMLElement && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [activeVal]);

  return (
    <div
      className={cn(
        paletteSurface,
        // (no conditional bg/border/width re-adds — the paletteSurface base already
        // reads the same vars WITH token fallbacks; bare re-adds would dedupe-kill
        // those fallbacks when a value fails validation)
        // LAST so a set shadow dedupe-wins the baked shadow-sm; unset → undefined → cn drops it.
        shadowClass(p.shadow),
        // Opt-in enter animation. Unset/none → undefined → cn drops it → instant (byte-identical).
        motionClass(p.motion),
      )}
      role="dialog"
      aria-label="Command palette"
      style={
        styleVars(
          { var: '--fr-cmd-bg', value: p.bg, kind: 'color' },
          { var: '--fr-cmd-border', value: p.borderColor, kind: 'color' },
          { var: '--fr-cmd-accent', value: p.accent, kind: 'color' },
          { var: '--fr-cmd-muted', value: p.mutedColor, kind: 'color' },
          { var: '--fr-cmd-menuWidth', value: p.menuWidth, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 900 } },
        ) as CSSProperties
      }
    >
      {/* Search header — divider + icon + placeholder ride the SAME channels as
          the surface chrome (--fr-cmd-border / --fr-cmd-muted, token fallbacks →
          byte-identical unset). */}
      <div className="flex items-center gap-2 border-b border-b-[color:var(--fr-cmd-border,var(--color-border))] px-3.5">
        <span className="shrink-0 [color:var(--fr-cmd-muted,var(--color-muted-foreground))]" aria-hidden>
          <Icon name="search" size={17} />
        </span>
        <input
          className="h-11 w-full border-0 bg-transparent font-[inherit] text-inherit outline-none placeholder:[color:var(--fr-cmd-muted,var(--color-muted-foreground))]"
          type="text"
          role="combobox"
          aria-expanded="true"
          // Unconditional here, unlike the other disclosures in this file: the palette's
          // list is ALWAYS mounted (an empty query renders every group, an
          // unmatched one renders the empty-state row), so this reference always
          // resolves — it just has to resolve to THIS palette's list.
          aria-controls={listId}
          // point at the active option so a screen reader announces the
          // arrow-key-driven highlight (the option ids match the list rows below).
          aria-activedescendant={activeVal != null ? optId(activeVal) : undefined}
          aria-label={p.placeholder ?? 'Type a command or search'}
          placeholder={p.placeholder ?? 'Type a command or search…'}
          value={query ?? ''}
          onKeyDown={onInputKeyDown}
          onChange={(e) => {
            // Keep the state setter UNCONDITIONAL so bound spec.state (bindings.value)
            // stays live and an external Button can read the current query. Only the
            // per-keystroke search/change STREAM is gated behind emitOnChange.
            setQuery(e.target.value);
            if (p.emitOnChange !== false) {
              emitWith('search', { query: e.target.value });
              emitWith('change', { value: e.target.value });
            }
          }}
        />
      </div>

      {/* Results list */}
      <ul
        id={listId}
        ref={listRef}
        className="flex flex-col overflow-y-auto p-1.5 [max-height:var(--fr-cmd-maxHeight,24rem)]"
        role="listbox"
        aria-label="Commands"
        style={styleVars({ var: '--fr-cmd-maxHeight', value: p.maxHeight, kind: 'dim', opts: { units: ['px', 'rem'], max: 1200 } }) as CSSProperties}
      >
        {totalMatches === 0 ? (
          <li className="px-3 py-6 text-center text-sm [color:var(--fr-cmd-muted,var(--color-muted-foreground))]" role="option" aria-selected={false}>
            {p.emptyText ?? 'No results'}
          </li>
        ) : (
          filtered.map((g, gi) =>
            g.items.length === 0 ? null : (
              <li key={`group-${gi}`} role="presentation">
                {g.heading != null && (
                  // break-words: a group heading is a block in a COLUMN with no
                  // sibling to share width with, so the clip was pure loss —
                  // "Recently viewed documents" became "Recently viewed d…".
                  <div className="break-words px-2.5 pb-1 pt-2 text-[0.6875rem] font-medium uppercase tracking-wide [color:var(--fr-cmd-muted,var(--color-muted-foreground))]" title={g.heading || undefined}>
                    {g.heading}
                  </div>
                )}
                <ul role="presentation" className="flex flex-col">
                  {g.items.map((it, ii) => {
                    const isActive = it?.value != null && it.value === activeVal;
                    const icon = it?.icon ?? null;
                    return (
                      <li
                        key={`item-${gi}-${ii}`}
                        id={typeof it?.value === 'string' ? optId(it.value) : undefined}
                        data-cmd-option={typeof it?.value === 'string' ? it.value : undefined}
                        role="option"
                        aria-selected={isActive}
                        tabIndex={0}
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 rounded-frayme px-2.5 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          // Mutually-exclusive hover/focus bg: accent-derived tint (12%, below the
                          // 14% active fill) when accent is set, else the EXACT prior neutral token
                          // hover/focus — byte-identical when accent is unset.
                          p.accent != null
                            ? 'hover:[background:color-mix(in_srgb,var(--fr-cmd-accent)_12%,transparent)] focus-visible:[background:color-mix(in_srgb,var(--fr-cmd-accent)_12%,transparent)]'
                            : 'hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
                          // Mutually-exclusive active bg (same convention as the hover
                          // branch above): accent-derived 14% tint when accent is set,
                          // else the EXACT prior neutral token — byte-identical unset.
                          isActive &&
                            (p.accent != null
                              ? '[background:color-mix(in_srgb,var(--fr-cmd-accent)_14%,transparent)]'
                              : 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]'),
                          isActive && 'text-[color:var(--fr-cmd-accent,var(--color-foreground))]',
                        )}
                        onMouseEnter={() => { if (typeof it?.value === 'string') setSelected(it.value); }}
                        onClick={() => choose(it)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            choose(it);
                          }
                        }}
                      >
                        {icon != null && hasIcon(icon) && (
                          <span className="shrink-0 [color:var(--fr-cmd-muted,var(--color-muted-foreground))]" aria-hidden>
                            <Icon name={icon} size={16} />
                          </span>
                        )}
                        {/* The command name IS the row's payload — the icon and the
                            kbd shortcut beside it are shrink-0, and the row is
                            free to grow (px-2.5 py-2), so it wraps rather than
                            ellipsising the command the user is picking. */}
                        <span className="min-w-0 flex-1 break-words" title={it?.label || undefined}>{it?.label ?? ''}</span>
                        {it?.shortcut != null && (
                          <kbd className="shrink-0 rounded-sm border border-[color:var(--fr-cmd-border,var(--color-border))] bg-[color:var(--fr-surface-sunken,var(--color-muted))] px-1.5 py-0.5 font-[inherit] text-[0.6875rem] [color:var(--fr-cmd-muted,var(--color-muted-foreground))]">
                            {it.shortcut}
                          </kbd>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ),
          )
        )}
      </ul>
    </div>
  );
}
