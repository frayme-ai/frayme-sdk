# TournamentBracket

A sport-agnostic tournament card with a group-stage standings view AND a knockout bracket. The standings columns adapt to the sport via a preset (football, basketball, US win-loss, cricket, generic) or a fully custom `columns` list, with qualification zones color-coded; the bracket view renders knockout match cards positioned by the layout engine with routed connectors and inferred round labels. When both are provided, a Groups/Knockout toggle appears. Team crests are deterministic initial-badges. Stateless, SSR-safe; click a match or a team row to emit `select`. Bind `view`, `selected` with `{ $bindState }` so the agent (or a sibling control) can read (and drive) the active Groups/Knockout view and the last-clicked match or team payload from spec.state.

## Example

```json
{
  "root": "tournament-bracket",
  "elements": {
    "tournament-bracket": {
      "type": "TournamentBracket",
      "props": {
        "title": "World Cup 2026",
        "view": "groups",
        "groups": [
          {
            "name": "Group A",
            "teams": [
              {
                "name": "Mexico",
                "played": 3,
                "won": 2,
                "drawn": 1,
                "lost": 0,
                "gf": 6,
                "ga": 2,
                "points": 7,
                "qualified": "top"
              },
              {
                "name": "Canada",
                "played": 3,
                "won": 2,
                "drawn": 0,
                "lost": 1,
                "gf": 5,
                "ga": 3,
                "points": 6,
                "qualified": "top"
              },
              {
                "name": "Croatia",
                "played": 3,
                "won": 1,
                "drawn": 1,
                "lost": 1,
                "gf": 4,
                "ga": 4,
                "points": 4,
                "qualified": "playoff"
              },
              {
                "name": "Ghana",
                "played": 3,
                "won": 0,
                "drawn": 0,
                "lost": 3,
                "gf": 1,
                "ga": 7,
                "points": 0
              }
            ]
          },
          {
            "name": "Group B",
            "teams": [
              {
                "name": "Argentina",
                "played": 3,
                "won": 3,
                "drawn": 0,
                "lost": 0,
                "gf": 8,
                "ga": 1,
                "points": 9,
                "qualified": "top"
              },
              {
                "name": "Spain",
                "played": 3,
                "won": 2,
                "drawn": 0,
                "lost": 1,
                "gf": 5,
                "ga": 3,
                "points": 6,
                "qualified": "top"
              },
              {
                "name": "Japan",
                "played": 3,
                "won": 1,
                "drawn": 0,
                "lost": 2,
                "gf": 3,
                "ga": 5,
                "points": 3
              },
              {
                "name": "Egypt",
                "played": 3,
                "won": 0,
                "drawn": 0,
                "lost": 3,
                "gf": 2,
                "ga": 9,
                "points": 0
              }
            ]
          }
        ],
        "rounds": [
          [
            {
              "a": "Argentina",
              "b": "Canada",
              "winner": "a",
              "scoreA": 2,
              "scoreB": 1
            },
            {
              "a": "Mexico",
              "b": "Spain",
              "winner": "b",
              "scoreA": 0,
              "scoreB": 3
            }
          ],
          [
            {
              "a": "Argentina",
              "b": "Spain",
              "winner": "a",
              "scoreA": 2,
              "scoreB": 1
            }
          ]
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | Tournament title shown in the card header (e.g. "World Cup 2026"). Escaped text; omit for no header. |
| `view` | `"groups" \| "bracket"` | Which view to show initially: groups (standings tables) or bracket (knockout). Defaults to groups when only groups exist, else bracket. Bindable: the active view is mirrored back here into spec.state when the Groups/Knockout toggle is clicked, so an external control can read (and drive) which view is showing. |
| `selected` | `any` | Bindable: the last-clicked match or team is mirrored here into spec.state on every click, so an external control can read the current selection. Match clicks carry { kind:"match", id, round, index, a, b, winner }; team-row clicks carry { kind:"team", team, group, position, points }, the full resolved payload, not just an id. |
| `groups` | `({ name: string, teams: object[] })[]` | Group-stage standings: each group { name, teams:[{ name, played?, won?, drawn?, lost?, gf?, ga?, points?, stats?, qualified?("top"\|"playoff") }] }. Teams sort by the primary column; qualification zones are color-coded. |
| `sport` | `"football" \| "basketball" \| "us" \| "cricket" \| "generic"` | Standings-column preset when `columns` is not given: football (P W D L GD Pts), basketball / us (W L PCT GB), cricket (P W L NRR Pts), or generic (W L Pts). Default football. |
| `columns` | `({ key: string, label: string, align: "left" \| "center" \| "right", primary: boolean })[]` | Explicit standings columns { key, label, align?, primary? }, overrides the sport preset to make the table work for ANY sport (each key resolves a derived value or a team `stats` entry). |
| `rounds` | `object[][]` | Knockout rounds, outer→inner (rounds[0] first, last is the final). Each match is { id?, a?, b?, winner?("a"\|"b"), scoreA?, scoreB? }. Rounds capped at 6, matches/round at 63. |
| `roundLabels` | `string[]` | Optional knockout column labels, one per round. Omit to auto-label (Final / Semifinals / Quarterfinals / Round N). |
| `showScores` | `boolean` | Show per-competitor scores in the bracket match cards (default true). |
| `showCrests` | `boolean` | Show a small circular team crest (initials on a name-derived color) next to each team (default true). |
| `matchWidth` | `number` | Knockout match-card width in px (default 190, clamped 130..340). |
| `matchHeight` | `number` | Knockout match-card height in px (default 62, clamped 44..110). |
| `accent` | `string` | Header accent + winner/qualification highlight color (default the primary token). |
| `lineColor` | `string` | Bracket connector + table grid line color (default the border token). |
| `mutedColor` | `string` | Round labels, table headers + secondary text (default the muted-foreground token). |

## Events

### select

A knockout match or a group team row was clicked; match params carry { kind:"match", id, round, index, a, b, winner }, team params carry { kind:"team", team, group, position, points }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

### change

The Groups/Knockout view tab was switched (shown only when both views exist); params carry {view}, the resolved active view, "groups" or "bracket".

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
