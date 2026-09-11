/**
 * inputs-date · inputs-choice · inputs-overlay · data-longtail —
 * `aria-controls` must name a LIVE element, and it must name THIS instance's.
 *
 * Two defects, both measured before the fix.
 *
 * 1. DANGLING REFERENCES. An accessibility audit over generated specs found elements pointing
 *    `aria-controls` at an id that is not in the document; every one was a
 *    CLOSED disclosure whose panel mounts only while open. Five emitters live in
 *    these four files — DatePicker and DateRangePicker's field triggers,
 *    MultiSelect's chevron, Menubar's menu triggers, Fab's action rail (an id
 *    LIST, so one resting FAB published one dead id per action) and JsonView's
 *    branch rows. This is the Toggletip defect (toggletip-disclosure.test.tsx)
 *    and the ai-flow/filter one (ai-flow-filter-disclosure.test.tsx) again:
 *    aria-controls is only RECOMMENDED for a disclosure, so omitting it while
 *    there is nothing to name costs nothing, but a reader who follows a dangling
 *    IDREF lands nowhere. `aria-expanded` is kept in BOTH states — the control is
 *    a disclosure whether or not the panel happens to be mounted.
 *
 * 2. IDS THAT ARE NOT UNIQUE. CommandPalette's list id was the fixed literal
 *    `fr-cmd-list` and its row ids were the item value alone; MultiSelect's menu
 *    id was a slug of the PLACEHOLDER (`fr-ms-options-menu` when unset). Both
 *    collide across two instances on one page and across every row of a `repeat`,
 *    which re-renders one element per row from a single spec id — so the second
 *    palette's combobox resolved to the FIRST palette's list. Both now mint ids
 *    through `useAriaId` (registry/_aria.ts), which is per component INSTANCE.
 *
 * The assertions below are deliberately about RESOLUTION (exactly one element
 * carries the id), not about the attribute merely being present — presence is
 * what both defects already had.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';

import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const draw = (type: string, props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type, props } }, state: {} } as unknown as Spec}
      mode="progressive"
    />,
  );

/** Two SIBLING instances of one component — the "two command palettes on one
 *  page" case, which a single-element spec cannot pose. */
const drawTwo = (type: string, props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={
        {
          root: 'row',
          state: {},
          elements: {
            row: { type: 'Stack', props: {}, children: ['one', 'two'] },
            one: { type, props },
            two: { type, props },
          },
        } as unknown as Spec
      }
      mode="progressive"
    />,
  );

/** The same component twice via `repeat`, which reuses ONE spec id for both rows
 *  — the case a spec-id-derived (or literal) id cannot separate. */
const drawRepeat = (type: string, props: Record<string, unknown>) =>
  render(
    <FraymeRenderer
      spec={
        {
          root: 'list',
          state: { rows: [{ id: 'a' }, { id: 'b' }] },
          elements: {
            list: { type: 'Stack', props: {}, repeat: { statePath: '/rows', key: 'id' }, children: ['sut'] },
            sut: { type, props },
          },
        } as unknown as Spec
      }
      mode="progressive"
    />,
  );

/** Every id token of every `aria-controls` in the tree must name exactly one
 *  live element. Returns the offenders so a failure names them. */
function danglingRefs(container: HTMLElement): string[] {
  const bad: string[] = [];
  for (const el of container.querySelectorAll('[aria-controls]')) {
    for (const id of (el.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean)) {
      const hits = container.querySelectorAll(`[id="${id}"]`).length;
      if (hits !== 1) bad.push(`${id} -> ${hits} elements`);
    }
  }
  return bad;
}

const idsIn = (container: HTMLElement): string[] => [...container.querySelectorAll('[id]')].map((e) => e.id);

describe('disclosure triggers name their panel only while it is mounted', () => {
  it('DatePicker: closed trigger points at nothing; open one resolves to the dialog', () => {
    const { container } = draw('DatePicker', { label: 'When' });
    const trigger = container.querySelector('button[aria-haspopup="dialog"]')!;

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls'), 'closed picker mounts no panel').toBeNull();
    expect(danglingRefs(container)).toEqual([]);

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const id = trigger.getAttribute('aria-controls')!;
    expect(id).toBeTruthy();
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(container.querySelector(`[id="${id}"]`)!.getAttribute('role')).toBe('dialog');

    // and back — the reference must not survive the collapse
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-controls')).toBeNull();
    expect(trigger.getAttribute('aria-expanded'), 'still a disclosure when closed').toBe('false');
  });

  it('DateRangePicker: same contract on the popover trigger', () => {
    const { container } = draw('DateRangePicker', { label: 'Range' });
    const trigger = container.querySelector('button[aria-haspopup="dialog"]')!;

    expect(trigger.getAttribute('aria-controls')).toBeNull();
    fireEvent.click(trigger);
    const id = trigger.getAttribute('aria-controls')!;
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(container.querySelector(`[id="${id}"]`)!.getAttribute('role')).toBe('dialog');
    expect(danglingRefs(container)).toEqual([]);
  });

  it('MultiSelect: the chevron names the listbox only once the menu exists', () => {
    const { container } = draw('MultiSelect', {
      options: [{ label: 'One', value: 'one' }, { label: 'Two', value: 'two' }],
    });
    const chevron = container.querySelector('button[aria-haspopup="listbox"]')!;

    expect(chevron.getAttribute('aria-expanded')).toBe('false');
    expect(chevron.getAttribute('aria-controls')).toBeNull();

    fireEvent.click(chevron);
    const id = chevron.getAttribute('aria-controls')!;
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(container.querySelector(`[id="${id}"]`)!.getAttribute('role')).toBe('listbox');
    expect(danglingRefs(container)).toEqual([]);
  });

  it('Menubar: only the OPEN menu is named — the other triggers stay silent', () => {
    const { container } = draw('Menubar', {
      menus: [
        { label: 'File', items: [{ label: 'Open' }] },
        { label: 'Edit', items: [{ label: 'Undo' }] },
      ],
    });
    const [file, edit] = [...container.querySelectorAll('button[role="menuitem"]')];
    expect(file.getAttribute('aria-controls')).toBeNull();
    expect(edit.getAttribute('aria-controls')).toBeNull();

    fireEvent.click(file);
    const id = file.getAttribute('aria-controls')!;
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(container.querySelector(`[id="${id}"]`)!.getAttribute('role')).toBe('menu');
    expect(edit.getAttribute('aria-controls'), 'a closed sibling menu is not mounted').toBeNull();
    expect(danglingRefs(container)).toEqual([]);
  });

  it('Fab: the action id LIST appears with the rail, not before it', () => {
    const { container } = draw('Fab', {
      label: 'Actions',
      actions: [{ label: 'Note' }, { label: 'Task' }],
    });
    const main = [...container.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Actions',
    )!;

    expect(main.getAttribute('aria-expanded')).toBe('false');
    // Pre-fix this listed two ids while zero action rows were rendered.
    expect(main.getAttribute('aria-controls')).toBeNull();
    expect(danglingRefs(container)).toEqual([]);

    fireEvent.click(main);
    const ids = (main.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean);
    expect(ids.length, 'one id per revealed action').toBe(2);
    for (const id of ids) expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(danglingRefs(container)).toEqual([]);
  });

  it('JsonView: a collapsed branch row names no subtree', () => {
    const { container } = draw('JsonView', { data: { a: { b: 1 } }, defaultExpandedDepth: 0 });
    const root = container.querySelector('[role="treeitem"]')!;

    expect(root.getAttribute('aria-expanded')).toBe('false');
    expect(root.getAttribute('aria-controls'), 'the subtree is not rendered while collapsed').toBeNull();
    expect(danglingRefs(container)).toEqual([]);

    // the row's own span is the click target (a descendant click must not toggle)
    fireEvent.click(root.querySelector('span[id]')!);
    expect(root.getAttribute('aria-expanded')).toBe('true');
    const id = root.getAttribute('aria-controls')!;
    expect(container.querySelectorAll(`[id="${id}"]`).length).toBe(1);
    expect(danglingRefs(container)).toEqual([]);
  });
});

describe('ids are per INSTANCE — not a literal, not a slug of a prop', () => {
  it('CommandPalette: two on one page get distinct, resolving list ids', () => {
    const groups = [{ heading: 'Nav', items: [{ label: 'Home', value: 'home' }] }];
    const { container } = drawTwo('CommandPalette', { groups });

    const inputs = [...container.querySelectorAll('input[role="combobox"]')];
    expect(inputs.length, 'two palettes').toBe(2);
    const controls = inputs.map((i) => i.getAttribute('aria-controls') ?? '');
    // Pre-fix both read the literal "fr-cmd-list", so both resolved to the FIRST
    // palette's list and the second palette's combobox described the wrong one.
    expect(new Set(controls).size, `both palettes share aria-controls: ${controls[0]}`).toBe(2);
    expect(danglingRefs(container)).toEqual([]);

    // aria-activedescendant had the same shape: the row ids were the item VALUE,
    // identical in both palettes.
    const active = inputs.map((i) => i.getAttribute('aria-activedescendant') ?? '');
    expect(new Set(active).size).toBe(2);
    for (const a of active) expect(container.querySelectorAll(`[id="${a}"]`).length).toBe(1);

    const ids = idsIn(container);
    expect(new Set(ids).size, `duplicate ids across the two palettes: ${ids.join(', ')}`).toBe(ids.length);
  });

  it('MultiSelect: two with the SAME (default) placeholder do not share a menu id', () => {
    const { container } = drawTwo('MultiSelect', { options: [{ label: 'One', value: 'one' }] });
    const chevrons = [...container.querySelectorAll('button[aria-haspopup="listbox"]')];
    expect(chevrons.length).toBe(2);
    for (const c of chevrons) fireEvent.click(c);

    const controls = chevrons.map((c) => c.getAttribute('aria-controls') ?? '');
    // Pre-fix both were "fr-ms-options-menu" — the placeholder slug, which is the
    // same string whenever the placeholder is (and it is unset here).
    expect(new Set(controls).size, `both menus share the id ${controls[0]}`).toBe(2);
    expect(danglingRefs(container)).toEqual([]);
  });

  for (const [type, props] of [
    ['MultiSelect', { options: [{ label: 'One', value: 'one' }] }],
    ['CommandPalette', { groups: [{ heading: 'Nav', items: [{ label: 'Home', value: 'home' }] }] }],
  ] as Array<[string, Record<string, unknown>]>) {
    it(`${type}: two repeat rows (one spec id) still get distinct ids`, () => {
      const { container } = drawRepeat(type, props);
      // MultiSelect's menu only exists while open — expand both rows first, or
      // this passes vacuously on zero aria-controls.
      for (const t of [...container.querySelectorAll('button[aria-expanded="false"]')]) fireEvent.click(t);

      const controls = [...container.querySelectorAll('[aria-controls]')].map(
        (e) => e.getAttribute('aria-controls') ?? '',
      );
      expect(controls.length, 'expected one trigger per repeat row').toBe(2);
      expect(new Set(controls).size, `both rows share aria-controls: ${controls[0]}`).toBe(2);
      expect(danglingRefs(container)).toEqual([]);

      const ids = idsIn(container);
      expect(new Set(ids).size, `duplicate ids across repeat rows: ${ids.join(', ')}`).toBe(ids.length);
    });
  }
});
