'use client';
import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { useGridEditState, type GridCoord, type GridSeed } from './_gridedit.js';
import { useLocalOrBound as useBoundProp } from './_state.js';

/* Catalog component (permission-matrix): PermissionMatrix — role×capability tri-state
 * grid over useGridEditState. OWNS the matrix; cells cycle on click; headers bulk-apply.
 * Cell value is a closed enum → static class; bulk suppresses per-cell change (one
 * commit). Emits in handlers, never inside an updater. */

type Perm = 'allow' | 'deny' | 'inherit';
interface RC {
  key: string;
  label?: string | null;
  description?: string | null;
}

const DEMO_ROLES: RC[] = [{ key: 'admin', label: 'Admin' }, { key: 'editor', label: 'Editor' }, { key: 'viewer', label: 'Viewer' }];
const DEMO_CAPS: RC[] = [{ key: 'read', label: 'Read' }, { key: 'write', label: 'Write' }, { key: 'delete', label: 'Delete' }, { key: 'admin', label: 'Manage' }];
const DEMO_VALUES: Perm[][] = [
  ['allow', 'allow', 'allow', 'allow'],
  ['allow', 'allow', 'deny', 'inherit'],
  ['allow', 'deny', 'deny', 'deny'],
];

const CYCLE_TRI: Record<Perm, Perm> = { inherit: 'allow', allow: 'deny', deny: 'inherit' };
const CYCLE_BIN: Record<Perm, Perm> = { inherit: 'allow', allow: 'deny', deny: 'allow' };
const isPerm = (v: unknown): v is Perm => v === 'allow' || v === 'deny' || v === 'inherit';

export function PermissionMatrix({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    roles?: RC[] | null;
    capabilities?: RC[] | null;
    values?: (Perm[] | Record<string, Perm>)[] | null;
    states?: 'tristate' | 'binary' | null;
    disabledCells?: { role: string; capability: string }[] | null;
    editable?: boolean | null;
    allowBulk?: boolean | null;
    showLegend?: boolean | null;
    showSave?: boolean | null;
    saveLabel?: string | null;
    showRoleDescriptions?: boolean | null;
    stickyHeader?: boolean | null;
    allowColor?: unknown;
    denyColor?: unknown;
    accent?: unknown;
    headerTextColor?: unknown;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const suppressRef = useRef(false);

  const roles = Array.isArray(p.roles) && p.roles.length ? p.roles.slice(0, 200) : DEMO_ROLES;
  const caps = Array.isArray(p.capabilities) && p.capabilities.length ? p.capabilities.slice(0, 40) : DEMO_CAPS;
  const editable = p.editable !== false;
  const allowBulk = p.allowBulk !== false && editable;
  const showLegend = p.showLegend !== false;
  const showRoleDesc = p.showRoleDescriptions === true;
  const sticky = p.stickyHeader !== false;
  const cycle = p.states === 'binary' ? CYCLE_BIN : CYCLE_TRI;
  const disabled = new Set((Array.isArray(p.disabledCells) ? p.disabledCells : []).map((d) => `${d.role}|${d.capability}`));
  const isDisabled = (r: number, c: number): boolean => disabled.has(`${roles[r]?.key}|${caps[c]?.key}`);

  const seed = (): GridSeed<Perm> => {
    const provided = Array.isArray(p.values);
    const rows: Perm[][] = roles.map((_role, r) => {
      const row = provided ? (p.values as (Perm[] | Record<string, Perm>)[])[r] : undefined;
      return caps.map((cap, c) => {
        let v: unknown = 'inherit';
        if (Array.isArray(row)) v = row[c];
        else if (row && typeof row === 'object') v = (row as Record<string, Perm>)[cap.key];
        else if (!provided) v = DEMO_VALUES[r]?.[c];
        return isPerm(v) ? v : 'inherit';
      });
    });
    return { rows, rowCount: rows.length, colCount: caps.length };
  };
  const seedKey = JSON.stringify({ r: p.roles ?? null, c: p.capabilities ?? null, v: p.values ?? null });

  const onChange = (r: number, c: number, value: Perm, prev: Perm): void => {
    if (suppressRef.current) return;
    emitWith('change', { role: roles[r]?.key, capability: caps[c]?.key, value, previous: prev, rowIndex: r, columnIndex: c });
  };
  const g = useGridEditState<Perm>(seed, seedKey, { onChange });
  // Bindable composite: the full role×capability matrix lands in spec.state so an external
  // Button (or the internal Save) can read the edited permissions. Local-fallback when unbound.
  const [, setBoundValues] = useBoundProp<Perm[][]>(
    (p.values ?? undefined) as Perm[][] | undefined,
    (bindings as { values?: unknown } | undefined)?.values,
  );
  const mirror = (grid: Perm[][]): void => { setBoundValues(grid.map((row) => row.slice())); };

  const vars = styleVars(
    { var: '--fr-pm-allow', value: p.allowColor, kind: 'color' },
    { var: '--fr-pm-deny', value: p.denyColor, kind: 'color' },
    { var: '--fr-pm-accent', value: p.accent, kind: 'color' },
    { var: '--fr-pm-head', value: p.headerTextColor, kind: 'color' },
  );
  const headText = 'text-[color:var(--fr-pm-head,var(--color-muted-foreground))]';

  const cycleCell = (r: number, c: number): void => {
    if (isDisabled(r, c)) return;
    g.setSelected({ r, c });
    const cur = g.grid[r]?.[c] ?? 'inherit';
    emitWith('select', { role: roles[r]?.key, capability: caps[c]?.key, value: cur, label: `${roles[r]?.label ?? roles[r]?.key} — ${caps[c]?.label ?? caps[c]?.key}` });
    if (!editable) return;
    g.setCell(r, c, cycle[cur]);
    mirror(g.gridRef.current);
  };
  const bulk = (reason: 'bulk-column' | 'bulk-row', key: string, cells: [number, number][]): void => {
    if (!allowBulk) return;
    const active = cells.filter(([r, c]) => !isDisabled(r, c));
    if (!active.length) return;
    const ref = g.grid[active[0][0]]?.[active[0][1]] ?? 'inherit';
    const target = cycle[ref];
    suppressRef.current = true;
    for (const [r, c] of active) g.setCell(r, c, target);
    suppressRef.current = false;
    mirror(g.gridRef.current);
    const changedCells = active.map(([r, c]) => ({ role: roles[r]?.key, capability: caps[c]?.key, value: target }));
    emitWith('commit', { reason, state: target, key, keyKind: reason === 'bulk-row' ? 'role' : 'capability', cells: changedCells, count: changedCells.length });
  };

  const save = (): void => {
    const grid = g.grid;
    const changed: { role: string | undefined; capability: string | undefined; value: Perm; rowIndex: number; columnIndex: number }[] = [];
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        if (g.isDirty(r, c)) changed.push({ role: roles[r]?.key, capability: caps[c]?.key, value: row[c] ?? 'inherit', rowIndex: r, columnIndex: c });
      }
    }
    mirror(grid);
    emitWith('commit', { reason: 'save', values: grid.map((row) => row.slice()), changed, count: changed.length });
    g.clearDirty();
  };

  /* Roving tabindex. `role="grid"` owes ONE tab stop that the arrow keys MOVE, and
   * moving means moving FOCUS — a selection ring that walks while document
   * .activeElement stays put leaves the focused cell at tabIndex -1. `g.selected`
   * is null until a cell is touched, so the stop falls back to the first ENABLED
   * cell; without that fallback every cell sat at tabIndex -1 and the matrix was
   * mouse-only (measured on the demo matrix: 12 cells, 0 in the tab order).
   * Bounds are the RENDERED roles×caps, not g.grid — capSeed's cell cap can trim
   * the grid shorter than the rows we draw. An all-disabled matrix is correctly
   * no tab stop: a disabled <button> cannot take focus, and nothing is operable. */
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const firstEnabled = ((): GridCoord => {
    for (let r = 0; r < roles.length; r++) {
      for (let c = 0; c < caps.length; c++) if (!isDisabled(r, c)) return { r, c };
    }
    return { r: 0, c: 0 };
  })();
  const sel0 = g.selected;
  const roving = sel0 && sel0.r < roles.length && sel0.c < caps.length && !isDisabled(sel0.r, sel0.c) ? sel0 : firstEnabled;
  const goTo = (k: GridCoord): void => {
    g.setSelected(k);
    cellRefs.current.get(`${k.r},${k.c}`)?.focus();
  };
  /** One arrow step from (r,c). The engine's moveSelection is pure clamped
   *  geometry, so skipping disabled cells is the consumer's post-step (as
   *  _gridedit documents) — walk on in the direction of travel, and hand the key
   *  back to the host at the edge rather than re-selecting the cell we are on. */
  const stepFrom = (r: number, c: number, dr: number, dc: number): GridCoord | null => {
    let nr = r + dr;
    let nc = c + dc;
    while (nr >= 0 && nr < roles.length && nc >= 0 && nc < caps.length) {
      if (!isDisabled(nr, nc)) return { r: nr, c: nc };
      nr += dr;
      nc += dc;
    }
    return null;
  };
  // Home/End = first/last enabled cell of the row: the same walk started just off
  // the row's edge, so a disabled first/last column is skipped for free.
  const rowEdge = (r: number, end: boolean): GridCoord | null => (end ? stepFrom(r, caps.length, 0, -1) : stepFrom(r, -1, 0, 1));

  const onCellKey = (e: KeyboardEvent, r: number, c: number): void => {
    // A key the grid consumes stops BOTH its default action and the walk up to the
    // embedding host's own shortcuts (Home/End otherwise scroll the host document).
    const consume = (): void => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (e.key === 'Enter' || e.key === ' ') {
      consume();
      cycleCell(r, c);
      return;
    }
    const to =
      e.key === 'ArrowUp' ? stepFrom(r, c, -1, 0)
      : e.key === 'ArrowDown' ? stepFrom(r, c, 1, 0)
      : e.key === 'ArrowLeft' ? stepFrom(r, c, 0, -1)
      : e.key === 'ArrowRight' ? stepFrom(r, c, 0, 1)
      : e.key === 'Home' ? rowEdge(r, false)
      : e.key === 'End' ? rowEdge(r, true)
      : null;
    if (to == null) return;
    consume();
    goTo(to);
  };

  const cellIcon = (v: Perm): ReactNode => {
    if (v === 'allow') return <span className="font-bold" style={{ color: 'var(--fr-pm-allow, var(--color-success))' }}>✓</span>;
    if (v === 'deny') return <span className="font-bold" style={{ color: 'var(--fr-pm-deny, var(--color-danger))' }}>✕</span>;
    return <span className={headText}>–</span>;
  };

  return (
    <div style={vars} className="w-full overflow-hidden rounded-lg border border-border bg-card">
      <div className="max-h-[28rem] overflow-auto">
        <table role="grid" aria-label="Permissions" aria-rowcount={roles.length + 1} aria-colcount={caps.length + 1} className="w-full border-collapse text-sm">
          <thead>
            <tr role="row">
              {/* scope="col" on BOTH header cells: the row headers already
                  declared scope="row", so the column axis was the half that was
                  missing, and a <th> with no scope is ambiguous to the HTML
                  table model even when ARIA names the role. The corner cell
                  heads the role column, so it is a column header too. */}
              <th scope="col" className={cn('border-b border-border px-3 py-2 text-left text-xs font-semibold', sticky && 'sticky left-0 top-0 z-20 bg-card', headText)}>Role</th>
              {caps.map((cap, c) => (
                <th
                  key={cap.key}
                  scope="col"
                  role="columnheader"
                  className={cn('border-b border-border px-2 py-2 text-center text-xs font-semibold', sticky && 'sticky top-0 z-10 bg-card', headText)}
                >
                  {allowBulk ? (
                    // min-h-6 min-w-6 = the WCAG 2.5.8 24px floor. Measured
                    // before: a bare <button> around text-xs is 12px of text in
                    // a 16px line box — a 16px-tall target, and the <th>'s own
                    // py-2 does NOT count because the padding is not clickable.
                    // (The audit's own rule misses this one: it exempts INLINE
                    // targets "constrained by the line-height of non-target
                    // text", and a bare button is inline-block at exactly its
                    // line box. A column header is the sole content of its cell,
                    // not text in a sentence, so the exemption does not apply.)
                    <button type="button" onClick={() => bulk('bulk-column', cap.key, roles.map((_r, r) => [r, c] as [number, number]))} title={`Bulk-cycle ${cap.label ?? cap.key}`} className="inline-flex min-h-6 w-full min-w-6 items-center justify-center hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-pm-accent,var(--fr-accent))_20%,transparent)]">
                      {cap.label ?? cap.key}
                    </button>
                  ) : (
                    (cap.label ?? cap.key)
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role, r) => (
              <tr key={role.key} role="row">
                <th scope="row" role="rowheader" className={cn('border-b border-border px-3 py-1.5 text-left align-top', sticky && 'sticky left-0 z-10 bg-card')}>
                  {allowBulk ? (
                    // Same 24px floor as the column header: text-sm in a 20px
                    // line box was a 20px-tall target, and the <th>'s py-1.5 is
                    // not part of it. `text-left` because inline-flex would
                    // otherwise centre a role name that the header aligns left.
                    <button type="button" onClick={() => bulk('bulk-row', role.key, caps.map((_c, c) => [r, c] as [number, number]))} title={`Bulk-cycle ${role.label ?? role.key}`} className="inline-flex min-h-6 min-w-6 items-center text-left text-sm font-medium text-foreground hover:text-[color:var(--fr-pm-accent,var(--fr-accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-pm-accent,var(--fr-accent))_20%,transparent)]">
                      {role.label ?? role.key}
                    </button>
                  ) : (
                    <span className="text-sm font-medium text-foreground">{role.label ?? role.key}</span>
                  )}
                  {showRoleDesc && role.description && <p className={cn('text-[11px]', headText)}>{role.description}</p>}
                </th>
                {caps.map((cap, c) => {
                  const v = g.grid[r]?.[c] ?? 'inherit';
                  const dis = isDisabled(r, c);
                  const sel = g.selected?.r === r && g.selected?.c === c;
                  return (
                    <td key={cap.key} role="gridcell" className="border-b border-border p-0 text-center">
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) cellRefs.current.set(`${r},${c}`, el);
                          else cellRefs.current.delete(`${r},${c}`);
                        }}
                        tabIndex={roving.r === r && roving.c === c ? 0 : -1}
                        disabled={dis}
                        aria-label={`${role.label ?? role.key} — ${cap.label ?? cap.key}: ${v}`}
                        onClick={() => cycleCell(r, c)}
                        onKeyDown={(e) => onCellKey(e, r, c)}
                        className={cn(
                          'grid h-9 w-full place-items-center outline-none transition-colors',
                          dis ? 'cursor-not-allowed opacity-30' : 'cursor-pointer hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/50',
                          sel && 'ring-2 ring-inset ring-[color:var(--fr-pm-accent,var(--fr-accent))]',
                          v === 'allow' && 'bg-[color:var(--fr-pm-allow,var(--color-success))]/10',
                          v === 'deny' && 'bg-[color:var(--fr-pm-deny,var(--color-danger))]/10',
                        )}
                      >
                        {cellIcon(v)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showLegend && (
        <div className={cn('flex items-center gap-4 border-t border-border px-3 py-2 text-xs', headText)}>
          <span className="flex items-center gap-1"><span className="font-bold" style={{ color: 'var(--fr-pm-allow, var(--color-success))' }}>✓</span> Allow</span>
          <span className="flex items-center gap-1"><span className="font-bold" style={{ color: 'var(--fr-pm-deny, var(--color-danger))' }}>✕</span> Deny</span>
          {p.states !== 'binary' && <span className="flex items-center gap-1"><span>–</span> Inherit</span>}
          {allowBulk && <span className="ml-auto text-[11px]">Click a header to bulk-apply</span>}
        </div>
      )}

      {p.showSave === true && editable && (
        <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={save}
            disabled={g.dirtyCount === 0}
            className="rounded-md bg-[color:var(--fr-pm-accent,var(--color-foreground))] px-3 py-1.5 text-sm font-semibold text-card hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-pm-accent,var(--fr-accent))_20%,transparent)]"
          >
            {p.saveLabel ?? 'Save permissions'} {g.dirtyCount > 0 && `(${g.dirtyCount})`}
          </button>
        </div>
      )}
    </div>
  );
}
