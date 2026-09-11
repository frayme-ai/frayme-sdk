import { describe, expect, it } from 'vitest';

import {
  validateActionContract,
  validateActionWiring,
  componentEvents,
  type ActionDecl,
} from '../src/validate/index.js';
import { fraymeCatalog } from '../src/index.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- terse partial-spec fixtures */

/**
 * BOUNDNESS = dispatched by any control, not "pressed on a button".
 *
 * Regression cover for the boundness fix. The required-action rule used
 * `commitBinding` — a BUTTON-PRESS lookup — to answer "can this screen do the
 * thing", so an action wired to its host component's own native event was read
 * as unbound. A live case lost most of its attempts (fallback attempts
 * included) to `required action "moveCard" is not bound to any button` while
 * every rendered board wired `moveCard` to KanbanBoard `on.move`, correctly.
 * For the 51 event-bearing components that advertise no `commit` at all the
 * old rule was unsatisfiable in BOTH directions — see the last block.
 */

const REQUIRED: ActionDecl[] = [{ name: 'ship', required: true }];
const one = (type: string, event: string, action = 'ship'): any => ({
  root: 'a',
  elements: { a: { type, on: { [event]: { action } } } },
});

describe('required actions — a native-event binding counts as bound', () => {
  // One case per canonical verb a host component actually dispatches from.
  it.each([
    ['KanbanBoard', 'move', 'the drag that IS the action — never a button'],
    ['Select', 'change', 'a Select has no commit event at all'],
    ['DataTable', 'select', 'row pick'],
    ['DataTable', 'commit', 'row/bulk action — the pre-existing path, still bound'],
    ['Scheduler', 'dismiss', 'event dismissal'],
    ['TournamentBracket', 'select', 'pick a winner'],
  ])('%s.on.%s satisfies a required action (%s)', (type, event) => {
    expect(validateActionContract(one(type, event), REQUIRED)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('accepts the array binding form on a native event', () => {
    const spec: any = {
      root: 'a',
      elements: {
        a: {
          type: 'KanbanBoard',
          on: {
            move: [
              { action: 'setState', params: { statePath: '/busy', value: true } },
              { action: 'ship' },
            ],
          },
        },
      },
    };
    expect(validateActionContract(spec, REQUIRED).valid).toBe(true);
  });

  it('counts a binding on ANY element, not just the root', () => {
    const spec: any = {
      root: 'r',
      elements: {
        r: { type: 'Stack', children: ['pick'] },
        pick: { type: 'Select', on: { change: { action: 'ship' } } },
      },
    };
    expect(validateActionContract(spec, REQUIRED).valid).toBe(true);
  });
});

describe('required actions — the gate still fires', () => {
  it('fails an action bound NOWHERE', () => {
    const spec: any = { root: 'a', elements: { a: { type: 'Card' }, b: { type: 'Text' } } };
    const r = validateActionContract(spec, REQUIRED);
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/required action "ship" is not bound/);
  });

  it('fails when the only binding is a builtin state mutation', () => {
    const spec: any = {
      root: 'a',
      elements: {
        a: { type: 'Button', on: { commit: { action: 'setState', params: { statePath: '/x', value: 1 } } } },
      },
    };
    expect(validateActionContract(spec, REQUIRED).valid).toBe(false);
  });

  it('fails when a DIFFERENT action is natively bound (no blanket pass)', () => {
    const r = validateActionContract(one('Select', 'change', 'somethingElse'), [
      { name: 'ship', required: true },
      { name: 'somethingElse' },
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /"ship"/.test(e))).toBe(true);
  });

  it('fails an element with no `on` at all', () => {
    const spec: any = { root: 'a', elements: { a: { type: 'KanbanBoard' } } };
    expect(validateActionContract(spec, REQUIRED).valid).toBe(false);
  });

  it('survives a null element (models emit them) without throwing', () => {
    const spec: any = { root: 'a', elements: { a: null, b: { type: 'Select', on: { change: { action: 'ship' } } } } };
    expect(validateActionContract(spec, REQUIRED).valid).toBe(true);
  });

  it('does not FAIL a non-required unbound action (it warns — see the coverage block)', () => {
    const spec: any = { root: 'a', elements: { a: { type: 'Card' } } };
    const r = validateActionContract(spec, [{ name: 'ship' }]);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });
});

/**
 * DECLARED-ACTION COVERAGE.
 *
 * The gate checked `decl.required && !bound`, so anything the host declared
 * without `required` could be absent from the screen and nothing complained:
 * the large majority of declarations were invisible to it. Declaring an action
 * means the host wants a control for it.
 *
 * It lands as a WARNING because a wiring/contract error escalates the whole
 * compose to the fallback, and a missing button is a presentation defect with a
 * deterministic repair one layer up (the binder's `injectButton`). Making it
 * fatal would flip a meaningful share of currently-valid first-turn attempts on
 * the raw model output this gate sees, costing some composes an extra fallback
 * attempt and a few every attempt they had; on authored specs it is vanishingly
 * rare.
 */
describe('declared-action coverage', () => {
  const DECLARED_ONLY: ActionDecl[] = [{ name: 'ship' }];
  const bare: any = { root: 'a', elements: { a: { type: 'Card' } } };
  const wired: any = {
    root: 'a',
    elements: { a: { type: 'Select', on: { change: { action: 'ship' } } } },
  };

  it('warns by default when a declared action is bound nowhere', () => {
    const r = validateActionContract(bare, DECLARED_ONLY);
    expect(r.valid).toBe(true);
    expect(r.warnings).toEqual([
      'declared action "ship" is not bound to any control (no element dispatches it from any event)',
    ]);
  });

  // NEGATIVE CONTROL — the detector must be able to stay silent, or a clean
  // count proves nothing.
  it('says NOTHING when the declared action IS bound', () => {
    expect(validateActionContract(wired, DECLARED_ONLY)).toEqual({ valid: true, errors: [] });
  });

  it('`off` disables the coverage check entirely — no warning, no error', () => {
    expect(validateActionContract(bare, DECLARED_ONLY, { declaredCoverage: 'off' })).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('`error` makes it fatal — and only then', () => {
    const r = validateActionContract(bare, DECLARED_ONLY, { declaredCoverage: 'error' });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toBeUndefined();
    // …and still silent on a bound one at the same severity.
    expect(validateActionContract(wired, DECLARED_ONLY, { declaredCoverage: 'error' }).valid).toBe(
      true,
    );
  });

  it('a REQUIRED action stays a hard error, never demoted to a warning', () => {
    const r = validateActionContract(bare, [{ name: 'ship', required: true }]);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/required action "ship" is not bound/);
    expect(r.warnings).toBeUndefined();
  });

  it('honours the native-event rule — a declared action on a native event is bound', () => {
    // The rule is load-bearing: most specs that bind a DECLARED action do so on
    // a non-commit event, and for nearly all of them that native binding is the
    // ONLY one. Widening WHICH declarations get checked must not narrow WHAT
    // counts as bound.
    for (const [type, event] of [
      ['KanbanBoard', 'move'],
      ['Select', 'change'],
      ['DataTable', 'select'],
      ['TournamentBracket', 'select'],
    ] as const) {
      const spec: any = { root: 'a', elements: { a: { type, on: { [event]: { action: 'ship' } } } } };
      expect(validateActionContract(spec, DECLARED_ONLY)).toEqual({ valid: true, errors: [] });
    }
  });

  it('reports each unbound declaration once, and only the unbound ones', () => {
    const r = validateActionContract(wired, [{ name: 'ship' }, { name: 'a' }, { name: 'b' }]);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings?.join(' ')).not.toMatch(/"ship"/);
  });
});

describe('boundness widened, nothing else did', () => {
  // The undeclared check stays commit-scoped: widening it flips previously
  // valid specs to invalid for bindings that are legitimate.
  it('does not report an undeclared action bound on a native event', () => {
    const r = validateActionContract(one('Select', 'change', 'undeclaredOne'), REQUIRED);
    expect(r.errors.some((e) => /undeclared/.test(e))).toBe(false);
  });

  it('still reports an undeclared action bound on a commit', () => {
    const spec: any = {
      root: 'a',
      elements: {
        a: { type: 'Select', on: { change: { action: 'ship' } } },
        b: { type: 'Button', on: { press: { action: 'evil' } } },
      },
    };
    const r = validateActionContract(spec, REQUIRED);
    expect(r.errors.some((e) => /undeclared.*evil/.test(e))).toBe(true);
  });

  it('does not newly demand params of a natively-bound action', () => {
    // `rent` is declared but absent from the binding — the shape that made
    // real specs regress when the param check was widened too.
    const decl: ActionDecl[] = [
      {
        name: 'watchListing',
        required: true,
        params: { type: 'object', properties: { rent: { type: 'string' } } },
      },
    ];
    const spec: any = {
      root: 'a',
      elements: { a: { type: 'Switch', on: { change: { action: 'watchListing', params: {} } } } },
    };
    expect(validateActionContract(spec, decl)).toEqual({ valid: true, errors: [] });
  });

  it('still checks params on a commit binding', () => {
    const decl: ActionDecl[] = [
      { name: 'pay', required: true, params: { type: 'object', properties: { amount: { type: 'string' } } } },
    ];
    const spec: any = { root: 'a', elements: { a: { type: 'Button', on: { commit: { action: 'pay' } } } } };
    const r = validateActionContract(spec, decl);
    expect(r.errors.some((e) => /missing declared param "amount"/.test(e))).toBe(true);
  });
});

describe('the trap had no exit before this fix', () => {
  // Computed from the catalog, not hard-coded: the components that advertise
  // events but no `commit` are exactly the ones for which the OLD rule was
  // unsatisfiable — no legal spec could bind a required action to a button.
  const commitless = fraymeCatalog.componentNames.filter(
    (t: string) => componentEvents(t).length > 0 && !componentEvents(t).includes('commit'),
  );

  it('a large share of event-bearing components cannot take a commit at all', () => {
    const eventful = fraymeCatalog.componentNames.filter((t: string) => componentEvents(t).length > 0);
    // Measured: 50 of 100. Asserted as a floor so the premise cannot
    // quietly erode; if this ever reaches 0 the widening could be revisited.
    expect(eventful.length).toBeGreaterThanOrEqual(90);
    expect(commitless.length).toBeGreaterThanOrEqual(40);
    expect(commitless).toContain('Select');
    expect(commitless).toContain('TournamentBracket');
  });

  it('binding on.commit to such a component is rejected by the wiring gate', () => {
    // The other jaw: the model's retry escape ("make it a commit") is illegal,
    // which is why the CONTRACT had to widen rather than the model bend.
    const spec: any = {
      root: 'a',
      elements: { a: { type: 'Select', on: { commit: { action: 'ship' } } } },
      actions: { ship: { kind: 'agent' } },
    };
    const r = validateActionWiring(spec);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/"commit" is not an event of Select/);
  });

  it('and the change binding it should have used passes both gates', () => {
    const spec: any = {
      root: 'a',
      elements: { a: { type: 'Select', on: { change: { action: 'ship' } } } },
      actions: { ship: { kind: 'agent' } },
    };
    expect(validateActionWiring(spec).valid).toBe(true);
    expect(validateActionContract(spec, REQUIRED).valid).toBe(true);
  });

  it('every commit-less component can now satisfy a required action natively', () => {
    // The whole blocked class in one assertion.
    const stuck = commitless.filter((t: string) => {
      const ev = componentEvents(t)[0];
      const spec: any = { root: 'a', elements: { a: { type: t, on: { [ev]: { action: 'ship' } } } } };
      return !validateActionContract(spec, REQUIRED).valid;
    });
    expect(stuck).toEqual([]);
  });
});

/**
 * REACHABILITY — a binding the component can never fire.
 *
 * Two shapes, both dead in the renderer and both invisible before this:
 *  (a) the component advertises NO events, so `validateActionWiring`'s
 *      vocabulary check (`if (events.size > 0)`) skipped it entirely. Seen
 *      overwhelmingly on `Card`, with Badge, Text and Avatar behind it.
 *  (b) the TYPE emits the verb but this INSTANCE cannot — a read-only DataTable
 *      wired to `on.commit`. Seen in live output, never in authored specs.
 *
 * Warnings, not errors: the server turns `!wiring.valid` into
 * `action_contract_violated` and escalates to the fallback, which is the wrong
 * price for an inert control that the binder can repair.
 */
describe('reachability — a component that emits no events at all', () => {
  const dead = (type: string, event = 'press'): any => ({
    root: 'r',
    elements: {
      r: { type: 'Stack', children: ['x'] },
      x: { type, on: { [event]: { action: 'go' } } },
    },
    actions: { go: { kind: 'agent' } },
  });

  it('warns on Card.on.press — the commonest dead shape', () => {
    const r = validateActionWiring(dead('Card'));
    expect(r.valid).toBe(true); // never fatal
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings?.[0]).toMatch(/elements\.x\.on\.press: unreachable — Card emits no events/);
  });

  it.each(['Badge', 'Text', 'Avatar'])('warns on %s too', (type) => {
    expect(validateActionWiring(dead(type)).warnings).toHaveLength(1);
  });

  // NEGATIVE CONTROLS — four ways the check must stay silent.
  it('says nothing about a component that DOES emit the event', () => {
    expect(validateActionWiring(dead('Button', 'press'))).toEqual({ valid: true, errors: [] });
    expect(validateActionWiring(dead('Select', 'change'))).toEqual({ valid: true, errors: [] });
  });

  it('says nothing about a BYOC / unknown type — the false positive it must never make', () => {
    // A workspace manifest type is absent from fraymeCatalog; real specs
    // bind actions on such types and every one of them is legitimate.
    expect(validateActionWiring(dead('FuelCardAuthCard'))).toEqual({ valid: true, errors: [] });
  });

  it('says nothing about a builtin state mutation on a dead event', () => {
    const spec: any = {
      root: 'r',
      elements: {
        r: { type: 'Stack', children: ['x'] },
        x: { type: 'Card', on: { press: { action: 'setState', params: { statePath: '/x', value: 1 } } } },
      },
    };
    expect(validateActionWiring(spec)).toEqual({ valid: true, errors: [] });
  });

  it('`off` silences it and `error` makes it fatal', () => {
    expect(validateActionWiring(dead('Card'), undefined, { deadEvent: 'off' })).toEqual({
      valid: true,
      errors: [],
    });
    const hard = validateActionWiring(dead('Card'), undefined, { deadEvent: 'error' });
    expect(hard.valid).toBe(false);
    expect(hard.errors[0]).toMatch(/unreachable — Card emits no events/);
  });

  it('respects a BYOC eventsFor that DOES give the type an event', () => {
    const union = (t: string) => (t === 'FuelCardAuthCard' ? (['commit'] as const) : []);
    expect(validateActionWiring(dead('FuelCardAuthCard', 'commit'), union)).toEqual({
      valid: true,
      errors: [],
    });
  });
});

describe('reachability — a DataTable instance that cannot fire what it binds', () => {
  const table = (props: Record<string, unknown>, on: Record<string, unknown>): any => ({
    root: 'r',
    elements: { r: { type: 'Stack', children: ['t'] }, t: { type: 'DataTable', props, on } },
    actions: { go: { kind: 'agent' }, go2: { kind: 'agent' } },
  });
  const go = { action: 'go' };

  it('warns on on.commit for a read-only table (selectable only)', () => {
    const r = validateActionWiring(table({ selectable: true }, { commit: go }));
    expect(r.valid).toBe(true);
    expect(r.warnings?.[0]).toMatch(/no rowActions, no bulkActions and is neither editable nor addable/);
  });

  it('warns when the only rowActions are the built-in edit/delete', () => {
    // `delete` emits `dismiss`, `edit` opens the inline editor — neither reaches
    // emitWith('commit') by itself.
    const r = validateActionWiring(
      table({ rowActions: [{ id: 'delete', label: 'Delete' }] }, { commit: go }),
    );
    expect(r.warnings).toHaveLength(1);
  });

  // NEGATIVE CONTROLS — every affordance the runtime actually commits from.
  it.each([
    ['a custom rowAction', { rowActions: [{ id: 'reassign', label: 'Reassign' }] }],
    ['a bulk action', { bulkActions: [{ id: 'export', label: 'Export' }] }],
    ['editable (save emits commit)', { editable: true }],
    ['addable (save emits commit)', { addable: true }],
  ])('stays silent with %s', (_why, props) => {
    expect(validateActionWiring(table(props, { commit: go }))).toEqual({ valid: true, errors: [] });
  });

  it('an editable table whose `update` is bound no longer commits from the edit save', () => {
    // data-table.tsx saveEdit: `if (boundTo('update')) emit('update') else emit('commit')`.
    const r = validateActionWiring(table({ editable: true }, { commit: go, update: { action: 'go2' } }));
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings?.[0]).toMatch(/on\.commit/);
    // …and the same table WITHOUT the update binding is clean.
    expect(validateActionWiring(table({ editable: true }, { commit: go }))).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('flags on.update on a non-editable table and on.add on a non-addable one', () => {
    expect(validateActionWiring(table({}, { update: go })).warnings?.[0]).toMatch(/not editable/);
    expect(validateActionWiring(table({}, { add: go })).warnings?.[0]).toMatch(/not addable/);
    // negative controls
    expect(validateActionWiring(table({ editable: true }, { update: go }))).toEqual({ valid: true, errors: [] });
    expect(validateActionWiring(table({ addable: true }, { add: go }))).toEqual({ valid: true, errors: [] });
  });

  it('does not double-report a key the vocabulary check already rejected', () => {
    // `click` is not an event of DataTable — that is an ERROR from check (2);
    // reachability must not pile a warning on the same binding.
    const r = validateActionWiring(table({}, { click: go }));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/"click" is not an event of DataTable/);
    expect(r.warnings).toBeUndefined();
  });
});

describe('reachability — malformed input never invents a warning', () => {
  const wrap = (t: any): any => ({
    root: 'r',
    elements: { r: { type: 'Stack', children: ['t'] }, t },
    actions: { go: { kind: 'agent' } },
  });

  it('a DataTable with NO props at all is genuinely read-only → warns', () => {
    // Absent props is a real answer: no rowActions, not editable, not addable.
    const r = validateActionWiring(wrap({ type: 'DataTable', on: { commit: { action: 'go' } } }));
    expect(r.warnings).toHaveLength(1);
  });

  it.each([['a string', 'nope'], ['an array', []]])(
    'props that are %s are left to the prop gate, not guessed at',
    (_d, props) => {
      const r = validateActionWiring(
        wrap({ type: 'DataTable', props, on: { commit: { action: 'go' } } }),
      );
      expect(r.warnings).toBeUndefined();
    },
  );

  it('survives a null element and a null binding without throwing', () => {
    const spec: any = {
      root: 'r',
      elements: { r: { type: 'Stack', children: ['a'] }, a: null, b: { type: 'Card', on: { press: null } } },
    };
    expect(() => validateActionWiring(spec)).not.toThrow();
    expect(validateActionWiring(spec).warnings).toBeUndefined();
  });
});
