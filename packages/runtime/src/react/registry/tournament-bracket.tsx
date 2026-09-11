'use client';
import type { CSSProperties, ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { styleVars, fontClass } from './_style.js';
import { clampInt } from './_num.js';
import { layoutBracket, type BracketMatchIn } from './_diagram.js';
import { formatCell } from './_num.js';

/* Catalog component (tournament-bracket): a tournament card with a group-stage
 * standings view AND a knockout bracket view (toggle when both exist). Beautified,
 * FIFA/World-Cup-style. STATELESS pure-view: the _diagram engine computes bracket
 * geometry; groups are pure tables. Team crests are deterministic (hue hashed from
 * the name — no random, SSR-safe). Match/team hit-targets are HTML buttons; select-only. */

const fin = (v: unknown, fb: number | null = null): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : fb);

function crestColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 42%)`;
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase()) || '?';
}
function Crest({ name, size = 20 }: { name: string; size?: number }): ReactNode {
  return (
    <span aria-hidden="true" className="inline-grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.42, backgroundColor: crestColor(name) }}>
      {initials(name)}
    </span>
  );
}

interface Standing { name: string; played: number | null; won: number | null; drawn: number | null; lost: number | null; gf: number | null; ga: number | null; points: number | null; qualified?: 'top' | 'playoff' | null; stats?: Record<string, number | string> | null }
interface Group { name: string; teams: Standing[] }
type Col = { key: string; label: string; align?: 'left' | 'center' | 'right' | null; primary?: boolean | null };

// Sport-agnostic standings: a preset defines the columns; each column `key` resolves a
// derived value (gd/pct/played) or a team `stats` entry. `columns` overrides the preset.
const COLUMN_PRESETS: Record<string, Col[]> = {
  football: [{ key: 'played', label: 'P' }, { key: 'won', label: 'W' }, { key: 'drawn', label: 'D' }, { key: 'lost', label: 'L' }, { key: 'gd', label: 'GD' }, { key: 'points', label: 'Pts', primary: true }],
  basketball: [{ key: 'won', label: 'W' }, { key: 'lost', label: 'L' }, { key: 'pct', label: 'PCT', primary: true }, { key: 'gb', label: 'GB' }],
  us: [{ key: 'won', label: 'W' }, { key: 'lost', label: 'L' }, { key: 'pct', label: 'PCT', primary: true }, { key: 'gb', label: 'GB' }],
  cricket: [{ key: 'played', label: 'P' }, { key: 'won', label: 'W' }, { key: 'lost', label: 'L' }, { key: 'nrr', label: 'NRR' }, { key: 'points', label: 'Pts', primary: true }],
  generic: [{ key: 'won', label: 'W' }, { key: 'lost', label: 'L' }, { key: 'points', label: 'Pts', primary: true }],
};

const numOf = (v: number | string | null): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : -Infinity);

function resolveStat(t: Standing, key: string): number | string | null {
  const s = t.stats && typeof t.stats === 'object' ? t.stats : {};
  const g = (k: string): number | string | null => (s[k] != null ? s[k] : null);
  switch (key) {
    case 'played': { const v = fin(t.played); return v != null ? v : (fin(t.won, 0) as number) + (fin(t.drawn, 0) as number) + (fin(t.lost, 0) as number); }
    case 'won': return fin(t.won) ?? g('won');
    case 'lost': return fin(t.lost) ?? g('lost');
    case 'drawn': return fin(t.drawn) ?? g('drawn');
    case 'points': return fin(t.points) ?? g('points');
    case 'gf': return fin(t.gf) ?? g('gf');
    case 'ga': return fin(t.ga) ?? g('ga');
    case 'gd': { const gf = fin(t.gf), ga = fin(t.ga); return gf != null && ga != null ? gf - ga : g('gd'); }
    case 'pct': { const w = fin(t.won), l = fin(t.lost); return w != null && l != null && w + l > 0 ? w / (w + l) : g('pct'); }
    default: return g(key);
  }
}
function formatStat(key: string, v: number | string | null): string {
  if (v == null || v === '') return '–';
  if (key === 'pct' && typeof v === 'number') return v.toFixed(3).replace(/^0(?=\.)/, '');
  if ((key === 'gd' || key === 'nrr' || key.toLowerCase().includes('diff')) && typeof v === 'number') return v > 0 ? `+${v}` : String(v);
  return String(v);
}
const alignCls = (c: Col): string => (c.align === 'left' ? 'text-left' : c.align === 'right' ? 'text-right' : 'text-center');

const DEMO_GROUPS: Group[] = [
  { name: 'Group A', teams: [
    { name: 'Mexico', played: 3, won: 2, drawn: 1, lost: 0, gf: 6, ga: 2, points: 7, qualified: 'top' },
    { name: 'Canada', played: 3, won: 2, drawn: 0, lost: 1, gf: 5, ga: 3, points: 6, qualified: 'top' },
    { name: 'Croatia', played: 3, won: 1, drawn: 1, lost: 1, gf: 4, ga: 4, points: 4, qualified: 'playoff' },
    { name: 'Ghana', played: 3, won: 0, drawn: 0, lost: 3, gf: 1, ga: 7, points: 0 },
  ] },
  { name: 'Group B', teams: [
    { name: 'Argentina', played: 3, won: 3, drawn: 0, lost: 0, gf: 8, ga: 1, points: 9, qualified: 'top' },
    { name: 'Spain', played: 3, won: 2, drawn: 0, lost: 1, gf: 5, ga: 3, points: 6, qualified: 'top' },
    { name: 'Japan', played: 3, won: 1, drawn: 0, lost: 2, gf: 3, ga: 5, points: 3 },
    { name: 'Egypt', played: 3, won: 0, drawn: 0, lost: 3, gf: 2, ga: 9, points: 0 },
  ] },
];
const DEMO_ROUNDS: BracketMatchIn[][] = [
  [{ a: 'Argentina', b: 'Canada', winner: 'a', scoreA: 2, scoreB: 1 }, { a: 'Mexico', b: 'Spain', winner: 'b', scoreA: 0, scoreB: 3 }],
  [{ a: 'Argentina', b: 'Spain', winner: 'a', scoreA: 2, scoreB: 1 }],
];

const QUAL = {
  top: { bar: 'var(--color-success)', label: 'Qualified' },
  playoff: { bar: 'var(--color-warning)', label: 'Playoff' },
};

export function TournamentBracket({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title?: string | null; view?: 'groups' | 'bracket' | null; selected?: unknown;
    groups?: Group[] | null; rounds?: BracketMatchIn[][] | null; roundLabels?: string[] | null;
    sport?: string | null; columns?: Col[] | null;
    showScores?: boolean | null; showCrests?: boolean | null; showTimes?: boolean | null; matchWidth?: number | null; matchHeight?: number | null;
    accent?: unknown; lineColor?: unknown; mutedColor?: unknown; font?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);

  const cols: Col[] = Array.isArray(p.columns) && p.columns.length
    ? p.columns.filter((c) => c && typeof c.key === 'string' && typeof c.label === 'string').slice(0, 10)
    : COLUMN_PRESETS[(p.sport as string) ?? 'football'] ?? COLUMN_PRESETS.football;
  const primaryKey = cols.find((c) => c.primary)?.key ?? cols[cols.length - 1]?.key ?? 'points';

  const provided = Array.isArray(p.groups) || Array.isArray(p.rounds);
  const groups = Array.isArray(p.groups) ? p.groups : provided ? null : DEMO_GROUPS;
  const rounds = Array.isArray(p.rounds) ? p.rounds : provided ? null : DEMO_ROUNDS;
  const hasGroups = !!groups?.length;
  const hasBracket = !!rounds?.length;
  const showCrests = p.showCrests !== false;
  const showScores = p.showScores !== false;

  const initial: 'groups' | 'bracket' = p.view === 'bracket' && hasBracket ? 'bracket' : p.view === 'groups' && hasGroups ? 'groups' : hasGroups ? 'groups' : 'bracket';
  const [view, setView] = useBoundProp<'groups' | 'bracket'>(initial, (bindings as { view?: unknown } | undefined)?.view);
  const [, setSelected] = useBoundProp<unknown>(p.selected ?? null, (bindings as { selected?: unknown } | undefined)?.selected);
  const activeView = view === 'groups' && hasGroups ? 'groups' : view === 'bracket' && hasBracket ? 'bracket' : hasGroups ? 'groups' : 'bracket';

  const vars = styleVars(
    { var: '--fr-tb-accent', value: p.accent, kind: 'color' },
    { var: '--fr-tb-line', value: p.lineColor, kind: 'color' },
    { var: '--fr-tb-muted', value: p.mutedColor, kind: 'color' },
  ) as CSSProperties;
  const mutedText = 'text-[color:var(--fr-tb-muted,var(--color-muted-foreground))]';
  const accentVar = 'var(--fr-tb-accent, var(--color-primary))';

  // ── groups view ─────────────────────────────────────────────────────────────
  const renderGroups = (): ReactNode => {
    const gs = (groups ?? []).map((g) => {
      const teams = (Array.isArray(g.teams) ? g.teams : []).slice();
      teams.sort((a, b) => numOf(resolveStat(b, primaryKey)) - numOf(resolveStat(a, primaryKey)) || numOf(resolveStat(b, 'gd')) - numOf(resolveStat(a, 'gd')));
      return { name: g.name, teams };
    });
    const last = cols.length - 1;
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {gs.map((g, gi) => (
          <div key={gi} className="overflow-hidden rounded-xl border border-[color:var(--fr-tb-line,var(--color-border))] bg-card shadow-sm">
            <div className="flex items-center gap-2 bg-[color-mix(in_srgb,var(--fr-tb-accent,var(--color-primary))_10%,var(--color-card))] px-3 py-2">
              <span className="h-4 w-1 rounded-full" style={{ backgroundColor: accentVar }} aria-hidden="true" />
              <span className="text-sm font-bold text-foreground">{g.name}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn('text-[11px] uppercase tracking-wide', mutedText)}>
                    <th className="w-6 py-1.5 pl-3 text-left font-semibold">#</th>
                    <th className="py-1.5 text-left font-semibold">Team</th>
                    {cols.map((c, i) => <th key={i} className={cn('px-1.5 py-1.5 font-semibold tabular-nums', alignCls(c), i === last && 'pr-3')}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {g.teams.map((t, ti) => {
                    const q = t.qualified === 'top' || t.qualified === 'playoff' ? QUAL[t.qualified] : null;
                    const primaryVal = fin(t.points) ?? (numOf(resolveStat(t, primaryKey)) === -Infinity ? null : numOf(resolveStat(t, primaryKey)));
                    const emitTeam = (): void => {
                      const payload = { kind: 'team', team: t.name, group: g.name, position: ti + 1, points: primaryVal };
                      setSelected(payload);
                      emitWith('select', payload);
                    };
                    return (
                      <tr
                        key={ti}
                        role="button"
                        tabIndex={0}
                        onClick={emitTeam}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emitTeam(); } }}
                        className="cursor-pointer border-t border-[color:var(--fr-tb-line,var(--color-border))] outline-none hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/50 focus-visible:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/50"
                      >
                        <td className="py-1.5 pl-3">
                          {/* quiet defaults (rule 2): a qualified/playoff rank
                              square is a semantic TINT (12% wash + coloured border +
                              coloured number), not a solid success/warning slab. The
                              legend swatches below stay solid — they are colour keys. */}
                          <span className={cn('grid h-5 w-5 place-items-center rounded text-xs font-bold', q && 'border')} style={q ? { backgroundColor: `color-mix(in srgb, ${q.bar} 12%, transparent)`, color: q.bar, borderColor: q.bar } : undefined}>
                            <span className={cn(!q && mutedText)}>{ti + 1}</span>
                          </span>
                        </td>
                        <td className="py-1.5">
                          <span className="flex items-center gap-2">
                            {showCrests && <Crest name={t.name} size={18} />}
                            {/* The standings row has no fixed height, so the team name
                                wraps instead of clipping — "Borussia Mönchengladbach"
                                arriving as "Borussia Mönchen…" is a different club. */}
                            <span className="break-words font-medium text-foreground" title={t.name || undefined}>{t.name}</span>
                          </span>
                        </td>
                        {cols.map((c, i) => {
                          const isPrimary = c.key === primaryKey;
                          return <td key={i} className={cn('px-1.5 py-1.5 tabular-nums', alignCls(c), i === last && 'pr-3', isPrimary ? 'font-bold text-foreground' : mutedText)}>{formatStat(c.key, resolveStat(t, c.key))}</td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── bracket view ────────────────────────────────────────────────────────────
  const renderBracket = (): ReactNode => {
    /* Fixture dates. `showTimes` + a per-match `time` were dropped entirely —
       the laid match had no `time` field, so a bracket that asked for dates on
       all 15 fixtures got none. A dated bracket prints them by default;
       an undated one is byte-identical, and the strip's 14px is ADDED to the
       tile height so the two team rows keep their space and every connector
       still meets its tile at that tile's own centre. */
    const anyTime = (rounds ?? []).some((r) => (Array.isArray(r) ? r : []).some((m) => typeof m?.time === 'string' && m.time.length > 0));
    const showTimes = p.showTimes !== false && anyTime;
    const layout = layoutBracket(rounds ?? [], {
      matchW: clampInt(p.matchWidth, 130, 340, 190),
      matchH: clampInt(p.matchHeight, 44, 110, 62) + (showTimes ? 14 : 0),
      labels: Array.isArray(p.roundLabels) ? p.roundLabels : undefined,
    });
    if (layout.matches.length === 0) return <div className={cn('grid min-h-[8rem] place-items-center text-sm', mutedText)}>No matches to display</div>;
    // KEPT truncate below: a bracket match box is a FIXED tile (matchW × matchH, with
    // the connector paths drawn to those exact coordinates) holding exactly two team
    // rows, so each row IS a single-line contract — and the whole bracket sits in an
    // overflow-x-auto rail, so an author who needs longer names widens matchWidth
    // rather than losing them. Full text stays on the title attribute.
    const teamRow = (name: string, score: unknown, isWinner: boolean, isLoser: boolean): ReactNode => (
      <div className={cn('flex flex-1 items-center gap-1.5 px-2', isWinner && 'font-semibold')} style={isWinner ? { borderLeft: `3px solid ${accentVar}`, paddingLeft: 'calc(0.5rem - 3px)' } : { borderLeft: '3px solid transparent' }}>
        {showCrests && name && <Crest name={name} size={16} />}
        <span className={cn('flex-1 truncate text-xs', isLoser ? mutedText : 'text-foreground')} title={name || 'TBD'}>{name || 'TBD'}</span>
        {showScores && score != null && <span className={cn('shrink-0 rounded px-1 text-xs tabular-nums', isWinner ? 'bg-[color:var(--fr-tb-accent,var(--color-foreground))] text-card' : cn('bg-[color:var(--fr-surface-sunken,var(--color-muted))]', mutedText))}>{String(score)}</span>}
      </div>
    );
    return (
      /* fr-tabscroll-card (frayme.css): the shared rail treatment — thin
         scrollbar + a card-toned right-edge fade that only paints while the rail
         overflows. The canvas geometry was already correct (a 4-round bracket is
         944px wide and the Final sits inside it); what was missing was any
         signal that there was more to the right, so the Final read as clipped
         with its connector running off the edge. */
      <div className="fr-tabscroll-card w-full overflow-x-auto">
        <div className="relative" style={{ width: layout.width, height: layout.height + 26, minWidth: layout.width }}>
          {/* KEPT nowrap: the round pill is absolutely positioned over the column it
              names inside the scrolling bracket canvas — it has no width to wrap
              against, and nothing clips it (no truncate, no overflow-hidden), so the
              one line is the whole label. */}
          {layout.roundLabels.map((rl, i) => (
            <div key={i} className={cn('absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-[color:var(--fr-surface-sunken,var(--color-muted))] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', mutedText)} style={{ left: rl.x }}>{rl.label}</div>
          ))}
          <div className="absolute left-0" style={{ top: 26, width: layout.width, height: layout.height }}>
            <svg width={layout.width} height={layout.height} className="pointer-events-none absolute inset-0" aria-hidden="true">
              {layout.connectors.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--fr-tb-line, var(--color-border))" strokeWidth={1.5} />)}
            </svg>
            {layout.matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  const payload = { kind: 'match', id: m.id, round: m.round, index: m.index, a: m.a, b: m.b, winner: m.winner ?? null };
                  setSelected(payload);
                  emitWith('select', payload);
                }}
                aria-label={`${m.a || 'TBD'} versus ${m.b || 'TBD'}`}
                style={{ left: m.x, top: m.y, width: m.w, height: m.h }}
                className="absolute flex flex-col overflow-hidden rounded-lg border border-[color:var(--fr-tb-line,var(--color-border))] bg-card shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-tb-accent,var(--fr-accent))_20%,transparent)]"
              >
                {showTimes && (
                  // An ISO date reads as "19 Jul 2026" (formatCell's date rule,
                  // shared with DataTable); anything else passes straight
                  // through, so "Sat 20:00" stays as written.
                  <div className={cn('flex h-[14px] shrink-0 items-center justify-center border-b border-[color:var(--fr-tb-line,var(--color-border))] text-[10px] leading-none tabular-nums', mutedText)}>
                    {m.time != null ? formatCell(m.time, 'date') : ''}
                  </div>
                )}
                <div className="flex flex-1 items-center border-b border-[color:var(--fr-tb-line,var(--color-border))]">{teamRow(m.a, m.scoreA, m.winner === 'a', m.winner === 'b')}</div>
                <div className="flex flex-1 items-center">{teamRow(m.b, m.scoreB, m.winner === 'b', m.winner === 'a')}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const both = hasGroups && hasBracket;
  return (
    <div style={vars} className={cn('w-full rounded-2xl border border-[color:var(--fr-tb-line,var(--color-border))] bg-[color-mix(in_srgb,var(--fr-tb-accent,var(--color-primary))_4%,var(--color-card))] p-4', fontClass(p.font))}>
      {(p.title || both) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {/* h2, not h3. This is the bracket's OWN top-level title and the only
              heading the component emits, so under a page's h1 an h3 skipped a
              rank — the outline read as a missing section to anyone navigating by
              heading. Same reasoning that moved Card's default title from h3 to h2
              earlier; the component is rare, so the blast radius is
              small. Visual size is unchanged: text-lg is set here
              explicitly, independent of the tag. */}
          {p.title ? (
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <span className="inline-block h-5 w-1.5 rounded-full" style={{ backgroundColor: accentVar }} aria-hidden="true" />
              {p.title}
            </h2>
          ) : <span />}
          {both && (
            <div role="tablist" aria-label="Tournament view" className="inline-flex overflow-hidden rounded-lg border border-[color:var(--fr-tb-line,var(--color-border))]">
              {(['groups', 'bracket'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={activeView === v}
                  onClick={() => {
                    // ALSO mirror the resolved view into spec.state/_ui via the
                    // intrinsic emit so the Groups/Knockout switch is captured for
                    // the agent even when `view` is unbound.
                    emitWith('change', { view: v });
                    setView(v);
                  }}
                  className={cn('px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-tb-accent,var(--fr-accent))_20%,transparent)]', activeView === v ? 'bg-[color:var(--fr-tb-accent,var(--color-foreground))] text-card' : cn('bg-card hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]', 'text-foreground'))}
                >
                  {v === 'groups' ? 'Groups' : 'Knockout'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {activeView === 'groups' && hasGroups ? renderGroups() : renderBracket()}
      {activeView === 'groups' && hasGroups && (
        <div className={cn('mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]', mutedText)}>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: QUAL.top.bar }} /> Qualified</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: QUAL.playoff.bar }} /> Playoff / best third</span>
        </div>
      )}
    </div>
  );
}
