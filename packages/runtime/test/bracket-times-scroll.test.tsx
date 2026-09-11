/**
 * TournamentBracket / fixture dates + the scroll affordance.
 *
 * Measured on a generated bracket (rounds 8/4/2/1, `showTimes: true`, every match carrying a
 * `time`):
 *   • the canvas geometry is CORRECT — width = pad + 4·190 + 3·48 + pad = 944px
 *     and the Final sits inside it. What the reader saw as "the Final is clipped
 *     and the connector runs to nothing" is a 944px canvas in a ~700px card with
 *     overlay scrollbars: no affordance, so nothing said it could scroll. The
 *     fix is the rail treatment every other Frayme rail already uses
 *     (fr-tabscroll-card: thin scrollbar + card-toned right-edge fade).
 *   • `time` / `showTimes` were dropped on the floor — the layout type had no
 *     `time` field at all, so not one fixture date rendered.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type: 'TournamentBracket', props } }, state: {} } as unknown as Spec}
      mode="progressive"
    />,
  ).container;

const ROUNDS = [
  [
    { id: 'sf1', a: 'Spain', b: 'Germany', time: '2026-07-15', scoreA: 2, scoreB: 1, winner: 'a' },
    { id: 'sf2', a: 'France', b: 'Brazil', time: '2026-07-16', scoreA: 0, scoreB: 3, winner: 'b' },
  ],
  [{ id: 'final', a: 'Spain', b: 'Brazil', time: '2026-07-19' }],
];

describe('TournamentBracket fixtures', () => {
  it('renders every round including the Final', () => {
    const c = draw({ view: 'bracket', rounds: ROUNDS, roundLabels: ['Semi-finals', 'Final'] });
    expect(c.textContent).toContain('Final');
    // the Final match tile itself, not just its round label
    expect(c.querySelectorAll('button[aria-label]').length).toBe(3);
  });

  it('draws the fixture dates when the matches carry a time', () => {
    const c = draw({ view: 'bracket', rounds: ROUNDS, showTimes: true });
    expect(c.textContent).toContain('15 Jul 2026');
    expect(c.textContent).toContain('19 Jul 2026');
  });

  it('draws dates by default when times are present, and none when showTimes is off', () => {
    expect(draw({ view: 'bracket', rounds: ROUNDS }).textContent).toContain('19 Jul 2026');
    expect(draw({ view: 'bracket', rounds: ROUNDS, showTimes: false }).textContent).not.toContain('19 Jul 2026');
  });

  it('passes a non-ISO time straight through', () => {
    const c = draw({ view: 'bracket', rounds: [[{ id: 'm', a: 'A', b: 'B', time: 'Sat 20:00' }]] });
    expect(c.textContent).toContain('Sat 20:00');
  });

  it('the bracket rail carries the shared scroll affordance', () => {
    const c = draw({ view: 'bracket', rounds: ROUNDS });
    expect(c.querySelector('.fr-tabscroll-card')).not.toBeNull();
  });
});
