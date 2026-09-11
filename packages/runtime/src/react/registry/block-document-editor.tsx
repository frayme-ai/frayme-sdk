'use client';
import { useRef, useState, useEffect } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars, fontClass } from './_style.js';
import { clampInt } from './_num.js';
import { safeImageSrc } from './url-safety.js';
import { useOrderedList, type ListMeta } from './_doclist.js';
import { printFraymeRoot } from './_print.js';

/* Catalog component (block-document-editor): rich closed-block-set document editor.
 * Owns the block set via useOrderedList (button/keyboard reorder, NO drag). Every text
 * block is a plain <textarea>/<input>; tables/fields are grids of inputs; images are a
 * URL or an uploaded (FileReader → capped data-URI) — NEVER contentEditable/innerHTML.
 * Two modes: EDIT + VIEW. SAVE emits the WHOLE document (title+blocks+markdown) via
 * `commit`; edits stream a debounced `change` (gated by emitOnChange, default on) and
 * always mirror the whole doc into the bindable `value` spec.state; block focus emits
 * `select`. Emits fire in handlers / a debounce timer reading a ref — never a setState
 * updater. Print is scoped
 * to the document via the fr-printing @media-print rules (shared with PrintLayout). */

const BTYPES = ['heading', 'paragraph', 'bulleted', 'numbered', 'quote', 'code', 'divider', 'spacer', 'table', 'fields', 'image'] as const;
type BType = (typeof BTYPES)[number];
const TEXT_CAP = 20000, MAX_COLS = 12, MAX_ROWS = 50, MAX_FIELDS = 50, MAX_IMG_BYTES = 256 * 1024;

interface Field { label: string; value: string }
interface Block {
  id: string; type: BType; text: string; level?: number; lang?: string;
  columns?: string[]; rows?: string[][]; fields?: Field[]; src?: string; alt?: string; caption?: string;
}
interface BlockInput { id?: string | null; type?: string; text?: string | null; level?: number | null; lang?: string | null; columns?: unknown; rows?: unknown; fields?: unknown; src?: string | null; alt?: string | null; caption?: string | null }

const TYPE_LABEL: Record<BType, string> = { heading: 'Heading', paragraph: 'Text', bulleted: 'Bullets', numbered: 'Numbered', quote: 'Quote', code: 'Code', divider: 'Divider', spacer: 'Spacer', table: 'Table', fields: 'Fields', image: 'Image' };
const DENSITY_GAP: Record<string, string> = { compact: 'space-y-2', normal: 'space-y-3.5', comfortable: 'space-y-6' };
const TEXTY = new Set<BType>(['heading', 'paragraph', 'bulleted', 'numbered', 'quote', 'code']);

const DEMO: Block[] = [
  { id: 'h1', type: 'heading', text: 'Executive summary', level: 2 },
  { id: 'p1', type: 'paragraph', text: 'Revenue grew 24% quarter-over-quarter, driven by the Platform tier and improved retention.' },
  { id: 'f1', type: 'fields', text: '', fields: [{ label: 'Owner', value: 'Priya Gupta' }, { label: 'Status', value: 'On track' }] },
  { id: 'l1', type: 'bulleted', text: 'Ship the scheduler\nHarden the component library\nWrite the docs' },
  { id: 't1', type: 'table', text: '', columns: ['Product', 'Revenue', 'Growth'], rows: [['Platform', '£742k', '+31%'], ['API', '£389k', '+18%']] },
  { id: 'c1', type: 'code', text: 'npm run build && npm run test', lang: 'bash' },
];

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).slice(0, MAX_COLS) : []);
const cell = (v: unknown): string => str(v).slice(0, 2000);

function seedBlock(b: BlockInput, i: number): Block {
  const type = (BTYPES as readonly string[]).includes(b.type as string) ? (b.type as BType) : 'paragraph';
  const out: Block = { id: typeof b.id === 'string' && b.id ? b.id : `b${i}`, type, text: str(b.text).slice(0, TEXT_CAP) };
  if (type === 'heading') out.level = clampInt(b.level, 1, 3, 2);
  if (type === 'code') out.lang = str(b.lang).slice(0, 20);
  if (type === 'table') { out.columns = strArr(b.columns); const rows = Array.isArray(b.rows) ? b.rows.slice(0, MAX_ROWS) : []; out.rows = rows.map((r) => (Array.isArray(r) ? r.map(cell).slice(0, MAX_COLS) : [])); }
  if (type === 'fields') out.fields = (Array.isArray(b.fields) ? b.fields.slice(0, MAX_FIELDS) : []).map((f) => ({ label: str((f as Field)?.label).slice(0, 300), value: str((f as Field)?.value).slice(0, 2000) }));
  if (type === 'image') { out.src = str(b.src); out.alt = str(b.alt).slice(0, 300); out.caption = str(b.caption).slice(0, 500); }
  return out;
}

/** Clean serialized block for the emit payload (only the fields the type uses). */
function serialize(b: Block): Record<string, unknown> {
  const o: Record<string, unknown> = { id: b.id, type: b.type };
  if (TEXTY.has(b.type)) o.text = b.text;
  if (b.type === 'heading') o.level = b.level ?? 2;
  if (b.type === 'code' && b.lang) o.lang = b.lang;
  if (b.type === 'table') { o.columns = b.columns ?? []; o.rows = b.rows ?? []; }
  if (b.type === 'fields') o.fields = b.fields ?? [];
  if (b.type === 'image') { o.src = b.src ?? ''; if (b.alt) o.alt = b.alt; if (b.caption) o.caption = b.caption; }
  return o;
}

function toMarkdown(title: string, blocks: Block[]): string {
  const parts: string[] = [];
  if (title.trim()) parts.push(`# ${title.trim()}`);
  for (const b of blocks) {
    switch (b.type) {
      case 'heading': parts.push(`${'#'.repeat(clampInt(b.level, 1, 3, 2))} ${b.text}`); break;
      case 'paragraph': parts.push(b.text); break;
      case 'bulleted': parts.push(b.text.split('\n').filter((l) => l.trim()).map((l) => `- ${l}`).join('\n')); break;
      case 'numbered': parts.push(b.text.split('\n').filter((l) => l.trim()).map((l, i) => `${i + 1}. ${l}`).join('\n')); break;
      case 'quote': parts.push(b.text.split('\n').map((l) => `> ${l}`).join('\n')); break;
      case 'code': parts.push('```' + (b.lang ?? '') + '\n' + b.text + '\n```'); break;
      case 'divider': parts.push('---'); break;
      case 'spacer': parts.push(''); break;
      case 'table': {
        const cols = b.columns ?? []; if (!cols.length) break;
        parts.push(`| ${cols.join(' | ')} |\n| ${cols.map(() => '---').join(' | ')} |\n${(b.rows ?? []).map((r) => `| ${cols.map((_, c) => r[c] ?? '').join(' | ')} |`).join('\n')}`);
        break;
      }
      case 'fields': parts.push((b.fields ?? []).map((f) => `**${f.label}:** ${f.value}`).join('\n')); break;
      case 'image': parts.push(`![${b.alt ?? ''}](${b.src ?? ''})${b.caption ? `\n*${b.caption}*` : ''}`); break;
    }
  }
  return parts.join('\n\n');
}

export function BlockDocumentEditor({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title?: string | null; blocks?: BlockInput[] | null; mode?: 'edit' | 'view' | null;
    editable?: boolean | null; showToolbar?: boolean | null; showSave?: boolean | null; showPrint?: boolean | null;
    allowImageUpload?: boolean | null; allowedBlocks?: BType[] | null; saveLabel?: string | null; printLabel?: string | null;
    placeholder?: string | null; maxBlocks?: number | null;
    accent?: unknown; mutedColor?: unknown; gridColor?: unknown; font?: string | null; density?: string | null;
    emitOnChange?: boolean | null; value?: unknown;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const idRef = useRef(0);
  const printRootRef = useRef<HTMLDivElement>(null);

  const editable = p.editable !== false;
  const showToolbar = p.showToolbar !== false && editable;
  const showSave = p.showSave !== false && editable;
  const showPrint = p.showPrint !== false;
  const allowUpload = p.allowImageUpload !== false;
  const maxBlocks = clampInt(p.maxBlocks, 1, 256, 128);
  const allowed: BType[] = Array.isArray(p.allowedBlocks) && p.allowedBlocks.length ? p.allowedBlocks.filter((t) => BTYPES.includes(t)) : [...BTYPES];

  const [title, setTitleRaw] = useBoundProp<string>(p.title ?? undefined, (bindings as { title?: unknown } | undefined)?.title);
  // The WHOLE serialized document mirrored into (bindable) spec.state so an external
  // Button can read the full body (title + blocks + markdown), not just the title.
  const [, setDocValue] = useBoundProp<Record<string, unknown>>(
    (p.value as Record<string, unknown> | undefined) ?? undefined,
    (bindings as { blocks?: unknown; value?: unknown } | undefined)?.blocks ?? (bindings as { value?: unknown } | undefined)?.value,
  );
  const [mode, setMode] = useState<'edit' | 'view'>(() => (p.mode === 'view' || !editable ? 'view' : 'edit'));
  const [dirty, setDirty] = useState(false);

  const provided = Array.isArray(p.blocks);
  const seed = (): Block[] => (provided ? (p.blocks as BlockInput[]) : DEMO).slice(0, maxBlocks).map(seedBlock);
  const blocksKey = JSON.stringify(p.blocks ?? null);

  // debounced live `change` + dirty, reading the latest doc from a ref (never an updater).
  const docRef = useRef<{ title: string; blocks: Block[] }>({ title: title ?? '', blocks: [] });
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleChange = (): void => {
    setDirty(true);
    if (changeTimer.current) clearTimeout(changeTimer.current);
    changeTimer.current = setTimeout(() => {
      const d = docRef.current;
      const blocks = d.blocks.map(serialize);
      const markdown = toMarkdown(d.title, d.blocks);
      // Mirror the WHOLE document into (bindable) spec.state UNCONDITIONALLY so an
      // external Button reads the full body even when per-keystroke emit is off.
      setDocValue({ title: d.title, blocks, markdown, blockCount: d.blocks.length });
      // Per-keystroke stream is gated: default on (backward-compatible), off to hold-and-submit.
      if (p.emitOnChange !== false) emitWith('change', { title: d.title, blocks, markdown });
    }, 500);
  };
  useEffect(() => () => { if (changeTimer.current) clearTimeout(changeTimer.current); }, []);

  const onListChange = (_items: Block[], _meta: ListMeta<Block>): void => { scheduleChange(); };
  const list = useOrderedList<Block>(seed, blocksKey, { max: maxBlocks, onChange: onListChange });
  docRef.current = { title: title ?? '', blocks: list.items };

  const setTitle = (v: string): void => { setTitleRaw(v.slice(0, 500)); scheduleChange(); };

  const addBlock = (type: BType): void => {
    if (list.atCap) return;
    const nb: Block = { id: `nb${++idRef.current}`, type, text: '' };
    if (type === 'heading') nb.level = 2;
    if (type === 'table') { nb.columns = ['Column 1', 'Column 2']; nb.rows = [['', '']]; }
    if (type === 'fields') nb.fields = [{ label: '', value: '' }];
    if (type === 'image') { nb.src = ''; nb.alt = ''; nb.caption = ''; }
    list.insertAfter(list.focusIndex ?? list.items.length - 1, nb);
  };
  const duplicate = (index: number, b: Block): void => list.insertAfter(index, { ...b, id: `nb${++idRef.current}` });
  const changeType = (index: number, b: Block, type: BType): void => {
    const patch: Partial<Block> = { type };
    if (type === 'heading' && b.level == null) patch.level = 2;
    if (type === 'table' && !b.columns) { patch.columns = ['Column 1', 'Column 2']; patch.rows = [['', '']]; }
    if (type === 'fields' && !b.fields) patch.fields = [{ label: '', value: '' }];
    list.update(index, patch);
  };
  const selectBlock = (b: Block, index: number): void => { list.setFocusIndex(index); emitWith('select', { id: b.id, index, type: b.type }); };

  const save = (): void => {
    const d = docRef.current;
    const blocks = d.blocks.map(serialize);
    const markdown = toMarkdown(d.title, d.blocks);
    setDocValue({ title: d.title, blocks, markdown, blockCount: d.blocks.length });
    emitWith('commit', { title: d.title, blocks, markdown, blockCount: d.blocks.length });
    setDirty(false);
    if (editable) setMode('view');
  };
  const onPrint = (): void => printFraymeRoot(printRootRef.current);

  const onImageFile = (index: number, file: File | undefined): void => {
    if (!file || !/^image\//.test(file.type) || file.size > MAX_IMG_BYTES || typeof FileReader === 'undefined') return;
    const r = new FileReader();
    r.onload = () => { const res = r.result; if (typeof res === 'string' && /^data:image\/(png|jpe?g|gif|webp|avif)[;,]/i.test(res)) { list.update(index, { src: res }); scheduleChange(); } };
    r.readAsDataURL(file);
  };

  const vars = styleVars(
    { var: '--fr-doc-accent', value: p.accent, kind: 'color' },
    { var: '--fr-doc-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-doc-grid', value: p.gridColor, kind: 'color' },
  ) as CSSProperties;
  const gapCls = DENSITY_GAP[(p.density as string) ?? 'normal'] ?? DENSITY_GAP.normal;
  const mutedText = 'text-[color:var(--fr-doc-muted,var(--color-muted-foreground))]';
  const gridBorder = 'border-[color:var(--fr-doc-grid,var(--color-border))]';
  // plain `outline-none` (not focus-visible:) so a mouse-clicked native <select>
  // never falls back to the browser's blue focus ring; the neutral ring rides keyboard focus.
  const ringAccent = 'outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-doc-accent,var(--fr-accent))_20%,transparent)]';
  const inputCls = cn('w-full resize-none rounded-md border bg-card px-2 py-1.5 text-sm text-foreground', gridBorder, ringAccent);
  // The glyph-only chrome button (▲▼⧉✕). Hoisted ABOVE renderEditor so the in-body
  // remove-column/row/field ✕ buttons share the same 24×24 floor as the block-header
  // controls instead of being bare `text-xs` spans — those measured 10×16.
  const ctrlBtn = cn('inline-flex min-h-6 min-w-6 items-center justify-center rounded p-1 text-xs hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] disabled:opacity-30 disabled:pointer-events-none', mutedText);
  const words = list.items.reduce((n, b) => n + (TEXTY.has(b.type) ? b.text.split(/\s+/).filter(Boolean).length : 0), 0);

  const onEditorKeyDown = (e: KeyboardEvent, index: number): void => {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); list.move(index, e.key === 'ArrowUp' ? -1 : 1); }
  };

  // ── readonly (VIEW mode) ────────────────────────────────────────────────────
  const renderReadonly = (b: Block): ReactNode => {
    switch (b.type) {
      case 'heading': { const lvl = clampInt(b.level, 1, 3, 2); const T = (`h${lvl}`) as 'h1' | 'h2' | 'h3'; return <T className={cn(lvl === 1 ? 'text-2xl font-bold' : lvl === 3 ? 'text-base font-semibold' : 'text-xl font-semibold', 'text-foreground')}>{b.text}</T>; }
      case 'paragraph': return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{b.text}</p>;
      case 'bulleted': return <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground">{b.text.split('\n').filter((l) => l.trim()).map((l, i) => <li key={i}>{l}</li>)}</ul>;
      case 'numbered': return <ol className="list-decimal space-y-0.5 pl-5 text-sm text-foreground">{b.text.split('\n').filter((l) => l.trim()).map((l, i) => <li key={i}>{l}</li>)}</ol>;
      case 'quote': return <blockquote className={cn('border-l-4 pl-3 text-sm italic', 'border-[color:var(--fr-doc-accent,var(--color-primary))]', mutedText)}>{b.text}</blockquote>;
      case 'code': return <pre className="overflow-x-auto rounded-md bg-[color:var(--fr-surface-sunken,var(--color-muted))] px-3 py-2 text-xs"><code className="font-mono text-foreground">{b.text}</code></pre>;
      case 'divider': return <hr className={cn('border-t', gridBorder)} aria-hidden="true" />;
      case 'spacer': return <div aria-hidden="true" className="h-6" />;
      case 'table': return (
        <div className="overflow-x-auto">
          <table className={cn('w-full border-collapse text-sm', '[&_td]:border [&_th]:border', `[&_td]:${''}`)}>
            <thead><tr>{(b.columns ?? []).map((c, i) => <th key={i} scope="col" className={cn('border px-2 py-1 text-left font-semibold text-foreground', gridBorder)}>{c}</th>)}</tr></thead>
            <tbody>{(b.rows ?? []).map((r, ri) => <tr key={ri}>{(b.columns ?? []).map((_, ci) => <td key={ci} className={cn('border px-2 py-1 text-foreground', gridBorder)}>{r[ci] ?? ''}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      case 'fields': return <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">{(b.fields ?? []).map((f, i) => <div key={i} className="contents"><dt className={cn('font-medium', mutedText)}>{f.label}</dt><dd className="text-foreground">{f.value}</dd></div>)}</dl>;
      case 'image': { const s = safeImageSrc(b.src); return s ? <figure className="space-y-1"><img src={s} alt={b.alt ?? ''} className="max-h-96 max-w-full rounded-md" /><figcaption className={cn('text-xs', mutedText)}>{b.caption}</figcaption></figure> : <div className={cn('rounded-md border border-dashed p-4 text-center text-xs', gridBorder, mutedText)}>No image</div>; }
      default: return null;
    }
  };

  // ── editors (EDIT mode) ─────────────────────────────────────────────────────
  const renderEditor = (b: Block, index: number): ReactNode => {
    const common = { onFocus: () => selectBlock(b, index), onKeyDown: (e: KeyboardEvent) => onEditorKeyDown(e, index) };
    if (b.type === 'divider') return <hr className={cn('border-t', gridBorder)} aria-hidden="true" />;
    if (b.type === 'spacer') return <div className={cn('rounded border border-dashed py-2 text-center text-xs', gridBorder, mutedText)}>Spacer</div>;
    if (b.type === 'heading') return (
      <div className="flex items-center gap-2">
        <select value={clampInt(b.level, 1, 3, 2)} onChange={(e) => { list.update(index, { level: clampInt(Number(e.target.value), 1, 3, 2) }); }} aria-label="Heading level" className={cn('rounded-md border bg-card px-1.5 py-1.5 text-xs text-foreground', gridBorder, ringAccent)}>
          <option value={1}>H1</option><option value={2}>H2</option><option value={3}>H3</option>
        </select>
        <input {...common} value={b.text} onChange={(e) => list.update(index, { text: e.target.value.slice(0, TEXT_CAP) })} placeholder="Heading…" className={cn(inputCls, 'font-semibold')} />
      </div>
    );
    if (b.type === 'table') {
      const cols = b.columns ?? []; const rows = b.rows ?? [];
      const setTable = (c: string[], r: string[][]): void => list.update(index, { columns: c.slice(0, MAX_COLS), rows: r.slice(0, MAX_ROWS).map((x) => x.slice(0, MAX_COLS)) });
      return (
        <div className="space-y-1.5" onFocus={() => selectBlock(b, index)}>
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm">
              <thead><tr>
                {cols.map((c, ci) => <th key={ci} scope="col" className="p-0.5"><input aria-label={`Column ${ci + 1} header`} value={c} onChange={(e) => setTable(cols.map((x, i) => (i === ci ? e.target.value : x)), rows)} className={cn('w-28 rounded border bg-[color:var(--fr-surface-sunken,var(--color-muted))] px-1.5 py-1 text-xs font-semibold text-foreground', gridBorder, ringAccent)} />{cols.length > 1 && <button type="button" onClick={() => setTable(cols.filter((_, i) => i !== ci), rows.map((r) => r.filter((_, i) => i !== ci)))} aria-label={`Delete column ${ci + 1}`} className={cn(ctrlBtn, 'ml-0.5')}>✕</button>}</th>)}
                {cols.length < MAX_COLS && <th scope="col" className="p-0.5"><button type="button" onClick={() => setTable([...cols, `Column ${cols.length + 1}`], rows.map((r) => [...r, '']))} aria-label="Add column" className={cn('rounded border px-1.5 py-1 text-xs', gridBorder, mutedText)}>＋</button></th>}
              </tr></thead>
              <tbody>{rows.map((r, ri) => <tr key={ri}>{cols.map((_, ci) => <td key={ci} className="p-0.5"><input aria-label={`Row ${ri + 1} column ${ci + 1}`} value={r[ci] ?? ''} onChange={(e) => setTable(cols, rows.map((row, i) => (i === ri ? cols.map((__, c) => (c === ci ? e.target.value : row[c] ?? '')) : row)))} className={cn('w-28 rounded border bg-card px-1.5 py-1 text-xs text-foreground', gridBorder, ringAccent)} /></td>)}<td className="p-0.5">{rows.length > 1 && <button type="button" onClick={() => setTable(cols, rows.filter((_, i) => i !== ri))} aria-label={`Delete row ${ri + 1}`} className={ctrlBtn}>✕</button>}</td></tr>)}</tbody>
            </table>
          </div>
          {rows.length < MAX_ROWS && <button type="button" onClick={() => setTable(cols, [...rows, cols.map(() => '')])} className={cn('rounded border px-2 py-1 text-xs', gridBorder, mutedText)}>＋ Add row</button>}
        </div>
      );
    }
    if (b.type === 'fields') {
      const fields = b.fields ?? [];
      const setF = (f: Field[]): void => list.update(index, { fields: f.slice(0, MAX_FIELDS) });
      return (
        <div className="space-y-1.5" onFocus={() => selectBlock(b, index)}>
          {fields.map((f, fi) => (
            <div key={fi} className="flex items-center gap-1.5">
              <input aria-label={`Field ${fi + 1} label`} value={f.label} onChange={(e) => setF(fields.map((x, i) => (i === fi ? { ...x, label: e.target.value.slice(0, 300) } : x)))} placeholder="Label" className={cn('w-40 rounded border bg-card px-1.5 py-1 text-xs font-medium text-foreground', gridBorder, ringAccent)} />
              <input aria-label={`Field ${fi + 1} value`} value={f.value} onChange={(e) => setF(fields.map((x, i) => (i === fi ? { ...x, value: e.target.value.slice(0, 2000) } : x)))} placeholder="Value" className={cn('flex-1 rounded border bg-card px-1.5 py-1 text-xs text-foreground', gridBorder, ringAccent)} />
              <button type="button" onClick={() => setF(fields.filter((_, i) => i !== fi))} aria-label={`Delete field ${fi + 1}`} className={ctrlBtn}>✕</button>
            </div>
          ))}
          {fields.length < MAX_FIELDS && <button type="button" onClick={() => setF([...fields, { label: '', value: '' }])} className={cn('rounded border px-2 py-1 text-xs', gridBorder, mutedText)}>＋ Add field</button>}
        </div>
      );
    }
    if (b.type === 'image') {
      const preview = safeImageSrc(b.src);
      return (
        <div className="space-y-1.5" onFocus={() => selectBlock(b, index)}>
          <div className="flex flex-wrap items-center gap-1.5">
            <input aria-label="Image URL" value={b.src ?? ''} onChange={(e) => list.update(index, { src: e.target.value })} placeholder="Image URL or upload →" className={cn('min-w-[12rem] flex-1 rounded border bg-card px-1.5 py-1 text-xs text-foreground', gridBorder, ringAccent)} />
            {allowUpload && <label className={cn('cursor-pointer rounded border px-2 py-1 text-xs', gridBorder, mutedText, ringAccent)}>Upload<input type="file" accept="image/*" className="sr-only" onChange={(e) => onImageFile(index, e.target.files?.[0])} /></label>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <input aria-label="Image alt text" value={b.alt ?? ''} onChange={(e) => list.update(index, { alt: e.target.value.slice(0, 300) })} placeholder="Alt text" className={cn('flex-1 rounded border bg-card px-1.5 py-1 text-xs text-foreground', gridBorder, ringAccent)} />
            <input aria-label="Image caption" value={b.caption ?? ''} onChange={(e) => list.update(index, { caption: e.target.value.slice(0, 500) })} placeholder="Caption" className={cn('flex-1 rounded border bg-card px-1.5 py-1 text-xs text-foreground', gridBorder, ringAccent)} />
          </div>
          {preview && <img src={preview} alt={b.alt ?? ''} className="max-h-40 max-w-full rounded-md border" />}
        </div>
      );
    }
    if (b.type === 'code') return (
      <div className="space-y-1">
        <input aria-label="Code language" value={b.lang ?? ''} onChange={(e) => list.update(index, { lang: e.target.value.slice(0, 20) })} placeholder="lang" className={cn('w-24 rounded border bg-card px-1.5 py-1 text-xs text-foreground', gridBorder, ringAccent)} />
        <textarea {...common} value={b.text} onChange={(e) => list.update(index, { text: e.target.value.slice(0, TEXT_CAP) })} rows={Math.max(2, Math.min(14, b.text.split('\n').length))} placeholder="Code…" className={cn(inputCls, 'font-mono')} />
      </div>
    );
    const rows = Math.max(1, Math.min(12, b.text.split('\n').length));
    return <textarea {...common} value={b.text} onChange={(e) => list.update(index, { text: e.target.value.slice(0, TEXT_CAP) })} rows={rows} placeholder={b.type === 'bulleted' || b.type === 'numbered' ? 'One item per line…' : 'Write…'} className={cn(inputCls, b.type === 'quote' && 'italic')} />;
  };

  const isEmpty = list.items.length === 0;

  // ── VIEW mode ───────────────────────────────────────────────────────────────
  if (mode === 'view') {
    return (
      <div style={vars} className={cn('w-full rounded-lg border bg-card', gridBorder, fontClass(p.font))}>
        <div className={cn('flex items-center justify-between gap-2 border-b px-3 py-2', gridBorder)}>
          <span className={cn('text-xs', mutedText)}>{list.items.length} block{list.items.length === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-1.5">
            {editable && <button type="button" onClick={() => setMode('edit')} className={cn('rounded-md border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]', gridBorder, ringAccent)}>Edit</button>}
            {showPrint && <button type="button" onClick={onPrint} className={cn('rounded-md bg-[color:var(--fr-doc-accent,var(--color-foreground))] px-3 py-1.5 text-sm font-medium text-card shadow-sm hover:opacity-90', ringAccent)}>{p.printLabel ?? 'Print'}</button>}
          </div>
        </div>
        <div ref={printRootRef} data-fr-print-root className={cn('p-5', gapCls)}>
          {(title ?? '').trim() && <h1 className="mb-1 text-2xl font-bold text-foreground">{title}</h1>}
          {isEmpty ? <p className={cn('py-10 text-center text-sm', mutedText)}>Empty document</p> : list.items.map((b) => <div key={b.id}>{renderReadonly(b)}</div>)}
        </div>
      </div>
    );
  }

  // ── EDIT mode ───────────────────────────────────────────────────────────────
  return (
    <div style={vars} className={cn('w-full rounded-lg border bg-card', gridBorder, fontClass(p.font))}>
      {showToolbar && (
        <div className={cn('flex flex-wrap items-center gap-1.5 border-b px-3 py-2', gridBorder)}>
          <span className={cn('mr-1 text-xs font-medium', mutedText)}>Add:</span>
          {allowed.map((t) => (
            <button key={t} type="button" onClick={() => addBlock(t)} disabled={list.atCap} aria-label={`Add ${TYPE_LABEL[t].toLowerCase()} block`} className={cn('rounded-md border px-2 py-1 text-xs font-medium text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] disabled:opacity-40 disabled:pointer-events-none', gridBorder, ringAccent)}>+ {TYPE_LABEL[t]}</button>
          ))}
        </div>
      )}

      <input aria-label="Document title" value={title ?? ''} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled document" className={cn('w-full border-0 bg-transparent px-4 pt-4 text-2xl font-bold text-foreground outline-none placeholder:[color:var(--fr-doc-muted,var(--color-muted-foreground))]')} />

      <div className={cn('px-3 py-3', gapCls)}>
        {isEmpty ? (
          <p className={cn('py-10 text-center text-sm', mutedText)}>{p.placeholder ?? 'Empty document — add a block to start'}</p>
        ) : (
          list.items.map((b, index) => (
            <div key={b.id} role="group" aria-roledescription="document block" aria-label={TYPE_LABEL[b.type]} className={cn('group rounded-md border border-transparent px-2 py-1.5 hover:border-[color:var(--fr-doc-grid,var(--color-border))]', list.focusIndex === index && 'border-[color:var(--fr-doc-grid,var(--color-border))] ring-1 ring-[color:var(--fr-doc-accent,var(--fr-accent))]')}>
              {/* CONTRAST (WCAG 1.4.3): this row used to rest at `opacity-60` and
                  fade in on group-hover/focus-within. Its ▲▼⧉✕ buttons are muted
                  text (#71717a light / #a1a1aa dark), and 60% of that over the card
                  composites to #aaaaaf = 2.31:1 (3.29:1 dark) — well under 4.5:1,
                  and these buttons are the ONLY pointer path to duplicate or delete
                  a block (alt+arrow covers move alone). Raising the floor does not
                  help: to clear 4.5:1 THROUGH a 60% layer the source colour has to
                  be ≤ #1b1b1b, i.e. not muted at all — the dim itself was the
                  defect, so it is gone. The controls still recede, via the muted
                  colour alone (4.83:1 light / 6.91:1 dark), which is exactly how the
                  in-body ✕ controls already read. */}
              <div className="mb-1 flex items-center justify-between gap-2">
                {/* min-h-6 (WCAG 2.5.8): text-xs + py-0.5 + 1px border measured 22px
                    tall. min-, not h-6, so a longer localised type label can still
                    grow the box. */}
                <select value={b.type} onChange={(e) => changeType(index, b, e.target.value as BType)} aria-label="Block type" className={cn('min-h-6 rounded border bg-card px-1 py-0.5 text-xs text-foreground', gridBorder, ringAccent)}>
                  {allowed.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  {!allowed.includes(b.type) && <option value={b.type}>{TYPE_LABEL[b.type]}</option>}
                </select>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => list.move(index, -1)} disabled={index === 0} aria-label="Move up" className={ctrlBtn}>▲</button>
                  <button type="button" onClick={() => list.move(index, 1)} disabled={index === list.items.length - 1} aria-label="Move down" className={ctrlBtn}>▼</button>
                  <button type="button" onClick={() => duplicate(index, b)} disabled={list.atCap} aria-label="Duplicate" className={ctrlBtn}>⧉</button>
                  <button type="button" onClick={() => list.removeAt(index)} aria-label="Delete block" className={cn(ctrlBtn, 'hover:text-danger')}>✕</button>
                </div>
              </div>
              {renderEditor(b, index)}
            </div>
          ))
        )}
      </div>

      {(showSave || showPrint) && (
        <div className={cn('flex items-center justify-between gap-2 border-t px-3 py-2', gridBorder)}>
          <span className={cn('text-xs tabular-nums', mutedText)}>
            {list.items.length} block{list.items.length === 1 ? '' : 's'} · {words} word{words === 1 ? '' : 's'}
            {dirty && <span className="ml-2 text-[color:var(--fr-doc-accent,var(--color-primary))]">● Unsaved</span>}
          </span>
          <div className="flex items-center gap-1.5">
            {showPrint && <button type="button" onClick={onPrint} className={cn('rounded-md border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]', gridBorder, ringAccent)}>{p.printLabel ?? 'Print'}</button>}
            {showSave && <button type="button" onClick={save} disabled={isEmpty} className={cn('rounded-md bg-[color:var(--fr-doc-accent,var(--color-foreground))] px-4 py-1.5 text-sm font-medium text-card shadow-sm hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none', ringAccent)}>{p.saveLabel ?? 'Save'}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
