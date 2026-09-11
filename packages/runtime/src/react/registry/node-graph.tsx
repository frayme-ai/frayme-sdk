'use client';
import { useId, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars, fontClass } from './_style.js';
import { clampInt } from './_num.js';
import { Icon, hasIcon } from './icons.js';
import { safeColor } from '@frayme/catalog/validate';
import { layoutLayeredGraph, type GNodeIn, type GEdgeIn } from './_diagram.js';

/* Catalog component (node-graph): NodeGraph — directed graph / flowchart / LIVE PIPELINE.
 * STATELESS-seeded pure-view: the _diagram engine computes every pixel. Node hit-targets
 * are HTML <button>s over the SVG (focus rings need HTML). Per-node status/progress make
 * it a live execution view; multiSelect toggles a BINDABLE selection set (spec.state) so an
 * external Button can read the picked nodes. Rich node fields (status/sublabel/icon/meta)
 * are looked up by id from the authored nodes — the shared _diagram engine is untouched. */

type RichNode = GNodeIn & { status?: string | null; progress?: number | null; sublabel?: string | null; icon?: string | null; meta?: string | null };

const SHAPE: Record<string, string> = { rounded: 'rounded-lg', pill: 'rounded-full', rect: 'rounded-none' };
const TONE_BORDER: Record<string, string> = { neutral: 'border-border', info: 'border-primary', success: 'border-success', warning: 'border-warning', critical: 'border-danger' };
const STATUS_BORDER: Record<string, string> = { running: 'border-primary', done: 'border-success', error: 'border-danger', blocked: 'border-warning', idle: '' };

const DEMO_NODES: RichNode[] = [
  { id: 'ingest', label: 'Ingest data', sublabel: '1,204 rows', status: 'done', meta: '0.8s' },
  { id: 'clean', label: 'Clean & validate', status: 'done', meta: '1.2s' },
  { id: 'embed', label: 'Generate embeddings', sublabel: 'model: text-3', status: 'running', progress: 62 },
  { id: 'index', label: 'Build index', status: 'blocked' },
  { id: 'deploy', label: 'Deploy', status: 'idle' },
];
const DEMO_EDGES: GEdgeIn[] = [
  { from: 'ingest', to: 'clean' },
  { from: 'clean', to: 'embed' },
  { from: 'embed', to: 'index' },
  { from: 'index', to: 'deploy' },
];

function StatusIndicator({ status }: { status: string | undefined }): ReactNode {
  switch (status) {
    case 'running': return <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" title="Running" aria-hidden="true" />;
    case 'done': return <span className="shrink-0 text-success" title="Done" aria-hidden="true"><Icon name="check-circle" size={14} /></span>;
    case 'error': return <span className="shrink-0 text-danger" title="Error" aria-hidden="true"><Icon name="alert-circle" size={14} /></span>;
    case 'blocked': return <span className="shrink-0 text-warning" title="Blocked" aria-hidden="true"><Icon name="clock" size={14} /></span>;
    default: return null;
  }
}

export function NodeGraph({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    nodes?: RichNode[] | null; edges?: GEdgeIn[] | null;
    direction?: 'TB' | 'LR' | null; nodeShape?: string | null;
    multiSelect?: boolean | null; selectedIds?: string[] | null; showStatus?: boolean | null;
    showArrows?: boolean | null; showEdgeLabels?: boolean | null; nodeWidth?: number | null; nodeHeight?: number | null;
    accent?: unknown; lineColor?: unknown; mutedColor?: unknown; font?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const uid = useId().replace(/[:]/g, '');

  const provided = Array.isArray(p.nodes);
  const nodes: RichNode[] = provided ? (p.nodes as RichNode[]) : DEMO_NODES;
  const edges = provided ? (Array.isArray(p.edges) ? (p.edges as GEdgeIn[]) : []) : DEMO_EDGES;
  const showArrows = p.showArrows !== false;
  const showEdgeLabels = p.showEdgeLabels !== false;
  const showStatus = p.showStatus !== false;
  const multiSelect = p.multiSelect === true;
  const shapeCls = SHAPE[(p.nodeShape as string) ?? 'rounded'] ?? SHAPE.rounded;

  // rich fields keyed by id (the engine only lays out id/label/tone/color)
  const byId = new Map(nodes.filter((n) => n && typeof n.id === 'string').map((n) => [n.id, n]));
  const anyRich = nodes.some((n) => n && (n.sublabel || n.icon || (showStatus && (n.status || n.progress != null))));

  const layout = layoutLayeredGraph(nodes, edges, {
    direction: (p.direction as 'TB' | 'LR') ?? 'TB',
    nodeW: clampInt(p.nodeWidth, 64, 300, 168),
    nodeH: clampInt(p.nodeHeight, 32, 140, anyRich ? 62 : 46),
  });

  // ── bindable multi-select set (spec.state → external Button can read the picks) ──
  const [selectedIds, setSelectedIds] = useBoundProp<string[]>(
    Array.isArray(p.selectedIds) ? p.selectedIds : [],
    (bindings as { selectedIds?: unknown } | undefined)?.selectedIds,
  );
  const selRef = useRef<string[]>([]);
  selRef.current = Array.isArray(selectedIds) ? selectedIds : [];
  const selectedSet = new Set(selRef.current);

  const onNodeClick = (n: { id: string; label: string; order: number; group?: string | null }): void => {
    const rich = byId.get(n.id);
    if (multiSelect) {
      const cur = new Set(selRef.current);
      if (cur.has(n.id)) cur.delete(n.id); else cur.add(n.id);
      const arr = [...cur];
      selRef.current = arr; // update the ref NOW so a rapid next click accumulates (not just on re-render)
      setSelectedIds(arr);
      emitWith('select', {
        id: n.id, selected: cur.has(n.id), selection: arr, count: arr.length,
        nodes: arr.map((id) => { const r = byId.get(id); return { id, label: r?.label ?? id, status: r?.status ?? null }; }),
      });
    } else {
      emitWith('select', { id: n.id, label: n.label, value: n.id, index: n.order, group: n.group ?? null, status: rich?.status ?? null });
    }
  };

  const vars = styleVars(
    { var: '--fr-ng-accent', value: p.accent, kind: 'color' },
    { var: '--fr-ng-line', value: p.lineColor, kind: 'color' },
    { var: '--fr-ng-muted', value: p.mutedColor, kind: 'color' },
  );
  const mutedText = 'text-[color:var(--fr-ng-muted,var(--color-muted-foreground))]';
  const accentVar = 'var(--fr-ng-accent, var(--fr-accent))';

  if (nodes.length === 0) {
    return <div style={vars} className={cn('grid min-h-[8rem] w-full place-items-center rounded-lg border border-border bg-card text-sm', mutedText)}>No nodes to display</div>;
  }

  return (
    <div
      style={vars}
      className={cn('w-full overflow-auto rounded-lg border border-border bg-card', fontClass(p.font))}
      // NAMED, but deliberately NOT focusable — the one scrollport in the
      // keyboard-access set that must not take a tab stop.
      //
      // The rule (scheduler.tsx) is that a scroll container a keyboard user cannot
      // focus cannot be scrolled without a pointer. Scheduler took the stop because
      // its event blocks "do not cover the scroll area". Here the exemption it
      // names holds exactly: EVERY node is a <button>, and the scroll extent IS the
      // nodes' own bounding box — _diagram.ts derives width/height from the laid-out
      // node grid plus a 24px pad, so there is no region of this canvas that is not
      // a node or the gap between two of them. Tab already walks all of it and the
      // browser scrolls each focused node into view. The node-less case never
      // reaches this element (it returns the non-scrolling placeholder above), so
      // the "an empty schedule has none at all" half does not apply either.
      // A stop here would therefore be a redundant stop in front of content the
      // buttons already reach — measurably worse than none, because it makes every
      // reader Tab twice to enter a graph.
      //
      // The NAME is worth having on its own and is kept: without it, a reader
      // tabbing into the graph hears "Ingest data, done, button" with nothing
      // saying what the buttons are part of. role="group", not "region", for the
      // same landmark-list reason as the other scroll containers.
      role="group"
      aria-label="Node graph"
    >
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        <svg width={layout.width} height={layout.height} className="pointer-events-none absolute inset-0" aria-hidden="true">
          <defs>
            <marker id={`ng-arrow-${uid}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--fr-ng-line, var(--color-border))" />
            </marker>
          </defs>
          {layout.edges.map((e, i) => (
            <path key={i} d={e.path} fill="none" stroke="var(--fr-ng-line, var(--color-border))" strokeWidth={1.5} markerEnd={showArrows ? `url(#ng-arrow-${uid})` : undefined} />
          ))}
        </svg>

        {showEdgeLabels &&
          layout.edges.filter((e) => e.label).map((e, i) => (
            <div key={i} className={cn('pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded bg-card px-1 text-[10px]', mutedText)} style={{ left: e.midX, top: e.midY }}>
              {e.label}
            </div>
          ))}

        {layout.nodes.map((n) => {
          const rich = byId.get(n.id);
          const status = showStatus ? (rich?.status ?? undefined) : undefined;
          const col = safeColor(rich?.color ?? n.color);
          const selected = selectedSet.has(n.id);
          const progress = showStatus && typeof rich?.progress === 'number' && Number.isFinite(rich.progress) ? Math.min(100, Math.max(0, rich.progress)) : null;
          const style: CSSProperties = { left: n.x, top: n.y, width: n.w, height: n.h };
          if (col) style.borderColor = col;
          // quiet defaults: an untoned/unstatused node defaults to a NEUTRAL
          // border (not a brand outline on every plain node). Per-node color, status,
          // and tone borders still win; the selected ring stays on the accent channel.
          const borderCls = col ? '' : (status && STATUS_BORDER[status]) || TONE_BORDER[(n.tone as string) ?? ''] || 'border-border';
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onNodeClick(n)}
              aria-label={n.label + (status ? `, ${status}` : '')}
              aria-pressed={multiSelect ? selected : undefined}
              style={style}
              className={cn(
                'absolute flex flex-col justify-center overflow-hidden border-2 bg-card px-2 py-1 text-left text-foreground shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ng-accent,var(--fr-accent))_20%,transparent)]',
                shapeCls, borderCls,
                selected && 'ring-2 ring-offset-1 ring-[color:var(--fr-ng-accent,var(--fr-accent))]',
              )}
            >
              <span className="flex items-center gap-1.5">
                {rich?.icon && hasIcon(rich.icon) && <span className={cn('shrink-0', mutedText)} aria-hidden="true"><Icon name={rich.icon} size={13} /></span>}
                {/* The node box is a FIXED tile — the engine drew every edge to this
                    exact w/h — so the label needs a bound, but the bound is a DECLARED
                    two lines, not one clipped line: the default heights (46 plain /
                    62 rich) hold two lines of text-xs, so "Generate embeddings" reads
                    whole instead of arriving as "Generate embed…". */}
                <span className="min-w-0 flex-1 line-clamp-2 break-words text-xs font-medium leading-tight" title={n.label || undefined}>{n.label}</span>
                {status && <StatusIndicator status={status} />}
              </span>
              {(rich?.sublabel || rich?.meta) && (
                <span className="mt-0.5 flex items-center gap-1">
                  {/* KEPT truncate: the metadata strip is the ONE line of vertical budget
                      left under a two-line label in a fixed-height node, and it shares
                      that line with the meta chip — a genuine single-line contract, with
                      the full text on the title attribute. */}
                  {rich?.sublabel && <span className={cn('min-w-0 flex-1 truncate text-[10px] leading-tight', mutedText)} title={rich.sublabel}>{rich.sublabel}</span>}
                  {rich?.meta && <span className="shrink-0 rounded bg-[color:var(--fr-surface-sunken,var(--color-muted))] px-1 text-[9px] tabular-nums text-foreground">{rich.meta}</span>}
                </span>
              )}
              {progress != null && (
                <span className="absolute inset-x-0 bottom-0 block h-1 overflow-hidden bg-[color:var(--fr-surface-sunken,var(--color-muted))]" aria-hidden="true">
                  <span className="block h-full" style={{ width: `${progress}%`, backgroundColor: accentVar }} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
