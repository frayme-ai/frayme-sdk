import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import type { Spec } from '@json-render/core';

describe('aria ids inside a repeat (regression: duplicate ids across rows)', () => {
  it('does not emit duplicate ids across repeat rows', () => {
    const spec = {
      root: 'list',
      state: { rows: [{ id: 'a' }, { id: 'b' }] },
      elements: {
        list: { type: 'Stack', props: {}, repeat: { statePath: '/rows', key: 'id' }, children: ['tree'] },
        tree: {
          type: 'Tree',
          props: { nodes: [{ label: 'src', children: [{ label: 'index.ts' }] }], defaultExpandedDepth: 2 },
        },
      },
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
    const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
    // The test must actually exercise the case: a first version passed while
    // rendering ZERO groups (the expand prop was misnamed), which is worse than
    // no test at all.
    expect(container.querySelectorAll('[role="group"]').length).toBeGreaterThan(1);
    expect(ids.length).toBeGreaterThan(1);
    expect(dupes, `duplicate ids across repeat rows: ${[...new Set(dupes)].join(', ')}`).toEqual([]);
  });

  // Tree above was the reproduction case, but every trigger↔panel pairing in the
  // registry has the same shape. These all shipped with a spec-id-only id, which
  // gave two rows the SAME aria-controls (measured before the fix, e.g. both rows
  // emitting `frayme-menu-<fid>`), pointing row two's trigger at row one's panel.
  //
  // Each case must therefore be posed so its panel IS open — aria-controls is no
  // longer emitted while the panel is unmounted. It once was, in every state, and
  // that was its own defect: a collapsed trigger pointed at an id that is not in
  // the document (see toggletip-disclosure.test.tsx and
  // ai-flow-filter-disclosure.test.tsx). The cases below that read as closed are
  // ones whose trigger keeps a live panel/listbox; the two ai-flow entries say
  // `defaultOpen` for exactly this reason.
  //
  // NavigationMenu was mis-filed in that "keeps a live panel" bucket. It does
  // not: the flyout is mounted on `isOpen` alone, so it passed here only while
  // board-nav.tsx still emitted the reference in every state — the very defect
  // this comment describes, one gate later than the components above (fixed in
  // board-tree-disclosure.test.tsx, alongside BoardColumn's collapse toggle and
  // Tree's branch rows). It has no `defaultOpen` prop to pose it with, so the
  // loop below opens it the way a user would. The open step is conditional so
  // the entries that DO name a panel at rest are measured exactly as before.
  const PAIRINGS: Array<[string, Record<string, unknown>]> = [
    ['DropdownMenu', { label: 'Pick', items: [{ label: 'A', value: 'a' }] }],
    ['BoardColumn', { title: 'Todo', collapsible: true }],
    ['NavigationMenu', { items: [{ label: 'P', children: [{ label: 'c', href: '#' }] }] }],
    ['Reasoning', { content: 'why', defaultOpen: true }],
    // `input` is what gives this ToolCall a body. Without it `defaultOpen` opens
    // nothing — input/output are both nullable — and the header is now correctly
    // NOT a disclosure at all, so the row would have no aria-controls to compare.
    ['ToolCall', { name: 'run', input: '{ "path": "src" }', defaultOpen: true }],
    ['DatePicker', { label: 'When' }],
    ['DateRangePicker', { label: 'Range' }],
  ];

  for (const [type, props] of PAIRINGS) {
    it(`${type}: two repeat rows get distinct aria-controls`, () => {
      const spec = {
        root: 'list',
        state: { rows: [{ id: 'a' }, { id: 'b' }] },
        elements: {
          list: { type: 'Stack', props: {}, repeat: { statePath: '/rows', key: 'id' }, children: ['sut'] },
          sut: { type, props },
        },
      } as unknown as Spec;
      const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
      // A pairing that names its panel only while open needs both rows opened
      // first, or this measures zero triggers and fails as vacuous. Conditional
      // on nothing being named yet, so it is a no-op for every other entry.
      if (container.querySelectorAll('[aria-controls]').length === 0) {
        for (const t of container.querySelectorAll('button[aria-expanded="false"]')) fireEvent.click(t);
      }
      const controls = [...container.querySelectorAll('[aria-controls]')].map(
        (e) => e.getAttribute('aria-controls') ?? '',
      );
      // Guard the guard: if the component stopped rendering a trigger this would
      // pass vacuously, which is how a previous version of the Tree test above
      // passed while rendering nothing.
      expect(controls.length, 'expected one trigger per repeat row').toBe(2);
      expect(new Set(controls).size, `both rows share aria-controls: ${controls[0]}`).toBe(2);

      // Where the panel IS mounted, the id must also be unique and must actually
      // resolve — an aria-controls naming nothing is as useless as a shared one.
      const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
      if (ids.length > 0) {
        expect(new Set(ids).size, `duplicate panel ids: ${ids.join(', ')}`).toBe(ids.length);
        for (const c of controls) expect(ids, `aria-controls ${c} resolves to no element`).toContain(c);
      }
    });
  }
});
