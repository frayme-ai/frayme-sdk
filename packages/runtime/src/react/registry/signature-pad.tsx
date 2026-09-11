'use client';
import type { ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { usePointerStrokes, pointsAttr } from './_canvas.js';
import type { NormPoint } from './_canvas.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import type { DimOpts } from '@frayme/catalog/validate';

/* Build an SVG document string from normalized [0,1] strokes over a fixed
 * 0..1000 viewBox — the same geometry the pad renders — so the emitted `svg`
 * is a self-contained, host-embeddable snapshot of what the user drew. Single
 * taps become dots (matching the on-screen render). No raw markup enters here:
 * every coordinate is a number produced by the clamped/finite capture path. */
function strokesToSvg(strokes: NormPoint[][]): string {
  const shapes = strokes
    .map((stroke) =>
      stroke.length === 1
        ? `<circle cx="${(stroke[0].x * 1000).toFixed(1)}" cy="${(stroke[0].y * 1000).toFixed(1)}" r="4" fill="currentColor"/>`
        : `<polyline points="${pointsAttr(stroke)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">${shapes}</svg>`;
}

/* Catalog component (signature-pad): SignaturePad — pointer-drawn signature.
 *
 * Rides the shared CanvasSurface engine (`_canvas.ts`): pointer strokes are
 * captured as normalized [0,1] points (clamped + finite + count-capped) and drawn
 * as SVG polylines over a fixed 0..1000 viewBox with a non-scaling stroke so the
 * ink stays uniform at any size. SSR-safe: the empty pad renders on the server;
 * capture + strokes are client-only. Emits `change` on stroke-end / clear with
 * the FULL drawn artifact — { empty, strokeCount, pointCount, strokes, svg } —
 * so an agent receives the actual signature (normalized point arrays + a
 * self-contained SVG snapshot), not just an "is it empty" signal. The drawn
 * geometry is ephemeral React state — never written to the spec. */

const HEIGHT_OPTS: DimOpts = { units: ['px', 'rem'], min: 80, max: 480 };
const PEN_OPTS: DimOpts = { units: ['px'], min: 1, max: 8 };

export function SignaturePad({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    placeholder?: string | null;
    penColor?: unknown;
    penWidth?: unknown;
    height?: unknown;
    background?: unknown;
    borderColor?: unknown;
    guideLine?: boolean | null;
    showClear?: boolean | null;
    clearLabel?: string | null;
    showSubmit?: boolean | null;
    submitLabel?: string | null;
    submitColor?: unknown;
    signature?: unknown;
    emitOnChange?: boolean | null;
    disabled?: boolean | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const disabled = p.disabled === true;

  // Mirror the resolved signature into (bindable) spec.state on every capture so an
  // external Button bound with { $bindState } can read the drawn signature. Falls back
  // to local state when unbound, so unbound rendering stays byte-identical.
  const [, setBoundSignature] = useBoundProp<Record<string, unknown> | null>(
    (p.signature as Record<string, unknown> | null) ?? null,
    (bindings as { signature?: unknown } | undefined)?.signature,
  );

  // The full drawn artifact: normalized point arrays + a self-contained SVG snapshot.
  const buildPayload = (strokes: NormPoint[][], empty: boolean): Record<string, unknown> => ({
    empty,
    strokeCount: strokes.length,
    pointCount: strokes.reduce((n, s) => n + s.length, 0),
    strokes,
    svg: strokesToSvg(strokes),
  });

  // Per-stroke `change` is OPT-IN (emitOnChange, default off) — by default the
  // signature is captured in state and delivered only when Submit is pressed
  // (`commit`), so the agent isn't streamed every stroke.
  const emitOnChange = p.emitOnChange === true;
  const surface = usePointerStrokes((strokes, empty) => {
    // Always mirror the resolved signature to spec.state (every completed stroke AND
    // clear — clear calls onChange([], true)), independent of the emitOnChange flag.
    setBoundSignature(buildPayload(strokes, empty));
    if (emitOnChange) emitWith('change', buildPayload(strokes, empty));
  }, disabled);
  const submit = (): void => {
    if (!surface.empty) {
      const payload = buildPayload(surface.strokes, surface.empty);
      setBoundSignature(payload);
      emitWith('commit', payload);
    }
  };

  const showClear = p.showClear !== false && !disabled;
  const showSubmit = p.showSubmit !== false && !disabled;
  const guideLine = p.guideLine !== false;

  const vars = styleVars(
    { var: '--fr-sig-pen', value: p.penColor, kind: 'color' },
    { var: '--fr-sig-bg', value: p.background, kind: 'color' },
    { var: '--fr-sig-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-sig-h', value: p.height, kind: 'dim', opts: HEIGHT_OPTS },
    { var: '--fr-sig-pw', value: p.penWidth, kind: 'dim', opts: PEN_OPTS },
    { var: '--fr-sig-submit', value: p.submitColor, kind: 'color' },
  );

  return (
    <div className="inline-flex w-full max-w-md flex-col gap-2" style={vars}>
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border',
          'border-[color:var(--fr-sig-border,var(--color-border))]',
          'bg-[color:var(--fr-sig-bg,var(--color-card))]',
          'h-[var(--fr-sig-h,10rem)]',
          disabled && 'opacity-60',
        )}
      >
        {/* Baseline guide */}
        {guideLine && (
          <div
            className="pointer-events-none absolute inset-x-6 bottom-6 border-b border-dashed border-[color:var(--fr-sig-border,var(--color-border))] opacity-60"
            aria-hidden="true"
          />
        )}

        {/* Empty-state hint */}
        {surface.empty && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="select-none text-sm text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]">{p.placeholder ?? 'Sign here'}</span>
          </div>
        )}

        {/* Drawing surface — normalized strokes over a fixed 0..1000 viewBox. */}
        <svg
          ref={surface.surfaceRef}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className={cn('absolute inset-0 h-full w-full touch-none', disabled ? 'cursor-not-allowed' : 'cursor-crosshair')}
          role="img"
          aria-label="signature pad"
          {...(disabled ? {} : surface.handlers)}
        >
          {surface.strokes.map((stroke, i) =>
            stroke.length === 1 ? (
              // a single tap → a dot
              <circle key={i} cx={stroke[0].x * 1000} cy={stroke[0].y * 1000} r={4} className="fill-[color:var(--fr-sig-pen,var(--color-foreground))]" />
            ) : (
              <polyline
                key={i}
                points={pointsAttr(stroke)}
                fill="none"
                className="stroke-[color:var(--fr-sig-pen,var(--color-foreground))]"
                style={{ strokeWidth: 'var(--fr-sig-pw, 2px)' }}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ),
          )}
        </svg>
      </div>

      {(showClear || showSubmit) && (
        <div className="flex justify-end gap-2">
          {showClear && (
            <button
              type="button"
              onClick={surface.clear}
              disabled={surface.empty}
              className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-[color:var(--fr-surface-muted,var(--color-muted-foreground))] hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-accent)_70%,transparent)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              {p.clearLabel ?? 'Clear'}
            </button>
          )}
          {showSubmit && (
            <button
              type="button"
              onClick={submit}
              disabled={surface.empty}
              className="inline-flex items-center rounded-md bg-[color:var(--fr-sig-submit,var(--color-foreground))] px-4 py-1.5 text-sm font-medium text-card shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-sig-submit,var(--fr-accent))_20%,transparent)] disabled:opacity-40 disabled:pointer-events-none transition-opacity"
            >
              {p.submitLabel ?? 'Submit'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
