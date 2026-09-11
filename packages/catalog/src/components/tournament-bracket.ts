/**
 * Frayme TournamentBracket — a tournament card with TWO views (Diagram-svg):
 *   • groups  — a World-Cup-style group stage: standings tables (P·W·D·L·GD·Pts)
 *               with qualification highlighting (top-2 + best-3rd/playoff).
 *   • bracket — a single-elimination knockout: match cards positioned by the
 *               shared layoutBracket engine, with routed connectors + round labels.
 * When both `groups` and `rounds` are supplied a Groups/Knockout toggle appears.
 *
 * The model authors STRUCTURE ONLY — group standings and/or rounds of matches. The
 * engine computes the bracket geometry; the groups view is a pure table. Team
 * "crests" are deterministic initial-badges (a hue hashed from the name — no
 * random, byte-identical SSR).
 *
 * POSTURE: STATELESS pure-view. Match/team hit-targets are HTML buttons; click a
 * match or a team row to emit `select`.
 *
 * SECURITY: team/competitor names + numeric stats ESCAPED; the engine owns
 * bracket geometry; rounds capped (6) / matches-per-round (63); stats coerced to
 * finite numbers; per-team crest color derived (no injection).
 *
 * Component: TournamentBracket.
 */

import { z } from 'zod';
import { colorSchema } from './_shared.js';

const matchSchema = z.object({
  id: z.string().nullable(),
  a: z.string().nullable(),
  b: z.string().nullable(),
  winner: z.enum(['a', 'b']).nullable(),
  scoreA: z.union([z.number(), z.string()]).nullable(),
  scoreB: z.union([z.number(), z.string()]).nullable(),
});

const standingSchema = z.object({
  name: z.string(),
  played: z.number().nullable(),
  won: z.number().nullable(),
  drawn: z.number().nullable(),
  lost: z.number().nullable(),
  gf: z.number().nullable(),
  ga: z.number().nullable(),
  points: z.number().nullable(),
  qualified: z.enum(['top', 'playoff']).nullable(),
  stats: z.record(z.string(), z.union([z.number(), z.string()])).nullable().describe('Arbitrary extra stats keyed by column key (e.g. { pct: 0.75, gb: 2, nrr: 1.2, pf: 620 }) so the standings work for any sport, not just football.'),
});

const columnSchema = z.object({
  key: z.string().describe('The stat key this column shows — a derived value (played/won/lost/drawn/gd/pct/points) or a key on each team\'s `stats` map.'),
  label: z.string().describe('The short column header shown to the user (e.g. "W", "PCT", "GD", "NRR"). Escaped text.'),
  align: z.enum(['left', 'center', 'right']).nullable().describe('Cell text alignment for this column (default center for stats).'),
  primary: z.boolean().nullable().describe('Mark this the bold ranking column that teams are sorted by (default the last column).'),
});

export const tournamentBracketComponents = {
  TournamentBracket: {
    props: z.object({
      title: z.string().nullable().describe('Tournament title shown in the card header (e.g. "World Cup 2026"). Escaped text; omit for no header.'),
      view: z.enum(['groups', 'bracket']).nullable().describe('Which view to show initially: groups (standings tables) or bracket (knockout). Defaults to groups when only groups exist, else bracket. Bindable: the active view is mirrored back here into spec.state when the Groups/Knockout toggle is clicked, so an external control can read (and drive) which view is showing.'),
      selected: z.any().nullable().describe('Bindable: the last-clicked match or team is mirrored here into spec.state on every click, so an external control can read the current selection. Match clicks carry { kind:"match", id, round, index, a, b, winner }; team-row clicks carry { kind:"team", team, group, position, points } — the full resolved payload, not just an id.'),
      groups: z
        .array(z.object({ name: z.string(), teams: z.array(standingSchema) }))
        .nullable()
        .describe('Group-stage standings: each group { name, teams:[{ name, played?, won?, drawn?, lost?, gf?, ga?, points?, stats?, qualified?("top"|"playoff") }] }. Teams sort by the primary column; qualification zones are color-coded.'),
      sport: z.enum(['football', 'basketball', 'us', 'cricket', 'generic']).nullable().describe('Standings-column preset when `columns` is not given: football (P W D L GD Pts), basketball / us (W L PCT GB), cricket (P W L NRR Pts), or generic (W L Pts). Default football.'),
      columns: z.array(columnSchema).nullable().describe('Explicit standings columns { key, label, align?, primary? } — overrides the sport preset to make the table work for ANY sport (each key resolves a derived value or a team `stats` entry).'),
      rounds: z
        .array(z.array(matchSchema))
        .nullable()
        .describe('Knockout rounds, outer→inner (rounds[0] first, last is the final). Each match is { id?, a?, b?, winner?("a"|"b"), scoreA?, scoreB? }. Rounds capped at 6, matches/round at 63.'),
      roundLabels: z.array(z.string()).nullable().describe('Optional knockout column labels, one per round. Omit to auto-label (Final / Semifinals / Quarterfinals / Round N).'),
      showScores: z.boolean().nullable().describe('Show per-competitor scores in the bracket match cards (default true).'),
      showCrests: z.boolean().nullable().describe('Show a small circular team crest (initials on a name-derived color) next to each team (default true).'),
      matchWidth: z.number().nullable().describe('Knockout match-card width in px (default 190, clamped 130..340).'),
      matchHeight: z.number().nullable().describe('Knockout match-card height in px (default 62, clamped 44..110).'),
      accent: colorSchema.describe('Header accent + winner/qualification highlight color (default the primary token).'),
      lineColor: colorSchema.describe('Bracket connector + table grid line color (default the border token).'),
      mutedColor: colorSchema.describe('Round labels, table headers + secondary text (default the muted-foreground token).'),
    }),
    description:
      'A sport-agnostic tournament card with a group-stage standings view AND a knockout bracket. The standings columns adapt to the sport via a preset (football, basketball, US win-loss, cricket, generic) or a fully custom `columns` list, with qualification zones color-coded; the bracket view renders knockout match cards positioned by the layout engine with routed connectors and inferred round labels. When both are provided, a Groups/Knockout toggle appears. Team crests are deterministic initial-badges. Stateless, SSR-safe; click a match or a team row to emit `select`. Bind `view`, `selected` with `{ $bindState }` so the agent (or a sibling control) can read (and drive) the active Groups/Knockout view and the last-clicked match or team payload from spec.state.',
    example: {
      title: 'World Cup 2026',
      view: 'groups',
      groups: [
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
      ],
      rounds: [
        [
          { a: 'Argentina', b: 'Canada', winner: 'a', scoreA: 2, scoreB: 1 },
          { a: 'Mexico', b: 'Spain', winner: 'b', scoreA: 0, scoreB: 3 },
        ],
        [{ a: 'Argentina', b: 'Spain', winner: 'a', scoreA: 2, scoreB: 1 }],
      ],
    },
    events: ['select', 'change'],
    eventsDoc: {
      select: 'A knockout match or a group team row was clicked; match params carry { kind:"match", id, round, index, a, b, winner }, team params carry { kind:"team", team, group, position, points }.',
      change: 'The Groups/Knockout view tab was switched (shown only when both views exist); params carry {view} — the resolved active view, "groups" or "bracket".',
    },
  },
};
