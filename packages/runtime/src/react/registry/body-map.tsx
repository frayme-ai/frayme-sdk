'use client';
import type { CSSProperties, ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars, fontClass } from './_style.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { safeColor } from '@frayme/catalog/validate';

/* Catalog component (body-map): BodyMap — anatomical region selector, BAKED art.
 * STATELESS pure-view. Regions are non-overlapping SVG shapes; hit-targets are HTML
 * <button>s over each region's bbox (focus rings need HTML). ONE px coordinate model
 * (fixed 220×432 canvas, no viewBox scaling). Per-region highlight color INLINE
 * (safeColor); tone fill is a trusted closed-enum token. select-only. */

const W = 220;
const H = 432;
const CX = W / 2;

type Shape = 'rect' | 'ellipse';
interface Region { id: string; shape: Shape; x: number; y: number; w: number; h: number; rx?: number }

// base = subject-RIGHT side (drawn on the viewer's LEFT for the front view); mirror() flips across CX.
const mirror = (r: Omit<Region, 'id'> & { id: string }): Region => ({ ...r, x: W - r.x - r.w });

const REGIONS: Region[] = [
  { id: 'head', shape: 'ellipse', x: 86, y: 8, w: 48, h: 52 },
  { id: 'neck', shape: 'rect', x: 100, y: 58, w: 20, h: 14, rx: 4 },
  { id: 'chest', shape: 'rect', x: 74, y: 72, w: 72, h: 60, rx: 12 },
  { id: 'abdomen', shape: 'rect', x: 80, y: 132, w: 60, h: 52, rx: 10 },
  { id: 'pelvis', shape: 'rect', x: 82, y: 184, w: 56, h: 34, rx: 10 },
  { id: 'rightUpperArm', shape: 'rect', x: 48, y: 78, w: 22, h: 70, rx: 10 },
  { id: 'rightForearm', shape: 'rect', x: 42, y: 150, w: 20, h: 64, rx: 9 },
  { id: 'rightHand', shape: 'ellipse', x: 38, y: 216, w: 22, h: 26 },
  { id: 'rightThigh', shape: 'rect', x: 82, y: 220, w: 26, h: 92, rx: 11 },
  { id: 'rightShin', shape: 'rect', x: 84, y: 314, w: 22, h: 86, rx: 9 },
  { id: 'rightFoot', shape: 'ellipse', x: 78, y: 400, w: 30, h: 22 },
];
// append the mirrored left side
for (const id of ['UpperArm', 'Forearm', 'Hand', 'Thigh', 'Shin', 'Foot']) {
  const src = REGIONS.find((r) => r.id === `right${id}`)!;
  REGIONS.push(mirror({ ...src, id: `left${id}` }));
}

const LABELS_FRONT: Record<string, string> = {
  head: 'Head', neck: 'Neck', chest: 'Chest', abdomen: 'Abdomen', pelvis: 'Pelvis',
  rightUpperArm: 'Right upper arm', rightForearm: 'Right forearm', rightHand: 'Right hand',
  leftUpperArm: 'Left upper arm', leftForearm: 'Left forearm', leftHand: 'Left hand',
  rightThigh: 'Right thigh', rightShin: 'Right shin', rightFoot: 'Right foot',
  leftThigh: 'Left thigh', leftShin: 'Left shin', leftFoot: 'Left foot',
};
const LABELS_BACK: Record<string, string> = {
  ...LABELS_FRONT,
  chest: 'Upper back', abdomen: 'Lower back', pelvis: 'Buttocks',
  rightShin: 'Right calf', leftShin: 'Left calf',
};

const TONE_FILL: Record<string, string> = {
  neutral: 'var(--color-muted-foreground)', info: 'var(--color-primary)', success: 'var(--color-success)', warning: 'var(--color-warning)', critical: 'var(--color-danger)',
};
const TONE_DOT: Record<string, string> = {
  neutral: 'bg-muted-foreground', info: 'bg-primary', success: 'bg-success', warning: 'bg-warning', critical: 'bg-danger',
};

interface MarkIn { region: string; tone?: string | null; color?: string | null; label?: string | null }

export function BodyMap({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    view?: 'front' | 'back' | null;
    marks?: MarkIn[] | null;
    selectedRegion?: string | null;
    showLegend?: boolean | null;
    accent?: unknown;
    bodyColor?: unknown;
    lineColor?: unknown;
    mutedColor?: unknown;
    font?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const [selectedRegion, setSelectedRegion] = useBoundProp<string | undefined>(
    p.selectedRegion ?? undefined,
    (bindings as { selectedRegion?: unknown } | undefined)?.selectedRegion,
  );

  const labels = p.view === 'back' ? LABELS_BACK : LABELS_FRONT;
  const showLegend = p.showLegend !== false;
  const marks = Array.isArray(p.marks) ? p.marks : [];
  const markByRegion = new Map<string, MarkIn>();
  for (const m of marks) if (m && typeof m.region === 'string' && labels[m.region]) markByRegion.set(m.region, m);

  const vars = styleVars(
    { var: '--fr-bm-accent', value: p.accent, kind: 'color' },
    { var: '--fr-bm-body', value: p.bodyColor, kind: 'color' },
    { var: '--fr-bm-line', value: p.lineColor, kind: 'color' },
    { var: '--fr-bm-muted', value: p.mutedColor, kind: 'color' },
  );
  const mutedText = 'text-[color:var(--fr-bm-muted,var(--color-muted-foreground))]';
  const bodyFill = 'var(--fr-bm-body, var(--color-muted))';
  const lineStroke = 'var(--fr-bm-line, var(--color-border))';

  const fillFor = (m: MarkIn | undefined): { fill: string; opacity: number } => {
    if (!m) return { fill: bodyFill, opacity: 1 };
    const col = safeColor(m.color);
    if (col) return { fill: col, opacity: 0.9 };
    return { fill: TONE_FILL[(m.tone as string) ?? 'info'] ?? TONE_FILL.info, opacity: 0.85 };
  };

  return (
    <div style={vars} className={cn('flex w-full flex-col items-center gap-3 rounded-lg border border-border bg-card p-4', fontClass(p.font))}>
      <div className="relative shrink-0" style={{ width: W, height: H }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0" aria-hidden="true">
          {REGIONS.map((r) => {
            const { fill, opacity } = fillFor(markByRegion.get(r.id));
            const isSelected = selectedRegion === r.id;
            const stroke = isSelected ? 'var(--fr-bm-accent, var(--fr-accent))' : lineStroke;
            const sw = isSelected ? 2.5 : 1.25;
            if (r.shape === 'ellipse') {
              return <ellipse key={r.id} cx={r.x + r.w / 2} cy={r.y + r.h / 2} rx={r.w / 2} ry={r.h / 2} style={{ fill }} fillOpacity={opacity} stroke={stroke} strokeWidth={sw} />;
            }
            return <rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx ?? 6} style={{ fill }} fillOpacity={opacity} stroke={stroke} strokeWidth={sw} />;
          })}
        </svg>

        {REGIONS.map((r) => {
          const style: CSSProperties = { left: r.x, top: r.y, width: r.w, height: r.h };
          const m = markByRegion.get(r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => { setSelectedRegion(r.id); emitWith('select', { id: r.id, label: labels[r.id], value: r.id, tone: m?.tone ?? null }); }}
              aria-label={labels[r.id] + (m?.label ? `: ${m.label}` : '')}
              aria-pressed={selectedRegion === r.id}
              style={style}
              className={cn(
                'absolute rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-bm-accent,var(--fr-accent))_20%,transparent)]',
                r.shape === 'ellipse' && 'rounded-full',
              )}
            />
          );
        })}
      </div>

      {showLegend && marks.length > 0 && (
        <div className="flex w-full flex-wrap justify-center gap-x-4 gap-y-1.5">
          {[...markByRegion.entries()].map(([id, m]) => {
            const col = safeColor(m.color);
            return (
              <span key={id} className="inline-flex items-center gap-1.5 text-xs">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', !col && (TONE_DOT[(m.tone as string) ?? 'info'] ?? TONE_DOT.info))} style={col ? { backgroundColor: col } : undefined} aria-hidden="true" />
                <span className="font-medium text-foreground">{labels[id]}</span>
                {m.label && <span className={mutedText}>· {m.label}</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
