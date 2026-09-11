/**
 * MODAL DISMISSAL + CONFIRM COERCION.
 *
 * Both fixes are for defects that RENDER FINE. Neither would ever show up in a
 * screenshot, which is why they get a test rather than a look.
 *
 *  1.  Dialog and Drawer had no key handling at all. Popover did, so a reader could
 *      dismiss a popover from the keyboard but was TRAPPED in a dialog — reachable
 *      only by finding the close button or clicking the backdrop. For a surface
 *      that takes the viewport and claims `aria-modal="true"`, that is a broken
 *      promise. The two hazards are stacking: a binding-level `confirm` renders
 *      ABOVE an open dialog and owns its own Escape, and two dialogs can be open at
 *      once.
 *
 *  2.  `confirm` written as a bare string. `deriveConfirm` read `.title`/`.message`
 *      off it — both undefined on a string — so the modal opened with the button
 *      label as its title and an EMPTY body, silently discarding the one sentence
 *      telling the reader what they were agreeing to. It LOOKED like it worked, and
 *      real generated specs shipped that way.
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const esc = () => fireEvent.keyDown(document, { key: 'Escape' });

const dialogSpec = (extra: Record<string, unknown> = {}, id = 'dlg'): Spec =>
  ({
    root: id,
    elements: { [id]: { type: 'Dialog', props: { title: 'Details', openPath: `/${id}Open`, ...extra } } },
    state: { [`${id}Open`]: true },
  }) as unknown as Spec;

describe('Escape dismisses a modal surface', () => {
  it('closes an open Dialog', () => {
    const { container } = render(<FraymeRenderer spec={dialogSpec()} mode="progressive" />);
    expect(container.querySelector('[data-fr-modal]'), 'dialog is open').not.toBeNull();
    esc();
    expect(container.querySelector('[data-fr-modal]'), 'Escape closed it').toBeNull();
  });

  it('closes an open Drawer too — same surface family, same promise', () => {
    const spec = {
      root: 'dw',
      elements: { dw: { type: 'Drawer', props: { title: 'Filters', openPath: '/dwOpen' } } },
      state: { dwOpen: true },
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    expect(container.querySelector('[data-fr-modal]')).not.toBeNull();
    esc();
    expect(container.querySelector('[data-fr-modal]')).toBeNull();
  });

  it('leaves a NON-dismissable Dialog alone', () => {
    // `dismissable:false` already blocks backdrop-click. Escape is the same gesture
    // by another route and must respect the same opt-out, or the flag means nothing.
    const { container } = render(<FraymeRenderer spec={dialogSpec({ dismissable: false })} mode="progressive" />);
    esc();
    expect(container.querySelector('[data-fr-modal]'), 'still open').not.toBeNull();
  });

  it('defers while a confirm is mounted above it', () => {
    // The confirm renders at z-60 over the dialog's z-50 and handles its own
    // Escape, but the event still bubbles to the document. Without the guard one
    // keypress cancels the confirm AND closes the dialog underneath — the reader
    // declines a destructive action and loses the screen they were reading.
    const { container } = render(<FraymeRenderer spec={dialogSpec()} mode="progressive" />);
    const decoy = document.createElement('div');
    decoy.setAttribute('data-fr-confirm', '');
    document.body.appendChild(decoy);
    esc();
    expect(container.querySelector('[data-fr-modal]'), 'dialog survives').not.toBeNull();
    decoy.remove();
    esc();
    expect(container.querySelector('[data-fr-modal]'), 'and closes once the confirm is gone').toBeNull();
  });

  it('closes only the TOP surface when two are stacked', () => {
    const spec = {
      root: 'row',
      elements: {
        row: { type: 'Stack', props: {}, children: ['a', 'b'] },
        a: { type: 'Dialog', props: { title: 'First', openPath: '/aOpen' } },
        b: { type: 'Dialog', props: { title: 'Second', openPath: '/bOpen' } },
      },
      state: { aOpen: true, bOpen: true },
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    expect(container.querySelectorAll('[data-fr-modal]').length).toBe(2);
    esc();
    const left = container.querySelectorAll('[data-fr-modal]');
    expect(left.length, 'one Escape dismisses one surface, not the stack').toBe(1);
    expect(left[0].textContent).toContain('First');
  });
});

describe('a confirm written as a bare string keeps its words', () => {
  const COLS = [{ key: 'name', label: 'Name' }];
  const ROWS = [{ id: '1', name: 'Ada' }];
  const table = (confirm: unknown): Spec =>
    ({
      root: 't',
      elements: {
        t: {
          type: 'DataTable',
          props: { columns: COLS, rows: ROWS, rowActions: [{ id: 'del', label: 'Delete', variant: 'danger', confirm }] },
        },
      },
      state: {},
    }) as unknown as Spec;

  const openConfirm = (confirm: unknown) => {
    const r = render(<FraymeRenderer spec={table(confirm)} mode="progressive" />);
    const btn = [...r.container.querySelectorAll('button')].find((b) => b.textContent === 'Delete')!;
    fireEvent.click(btn);
    return r;
  };

  it('renders the string as the MESSAGE, not as nothing', () => {
    const text = 'This cannot be undone from here. Continue?';
    const { container } = openConfirm(text);
    const modal = container.querySelector('[data-fr-confirm]');
    expect(modal, 'the confirm opened').not.toBeNull();
    expect(modal!.textContent, 'the authored sentence survives').toContain(text);
  });

  it('still derives a title from the label, as the object form does', () => {
    const { container } = openConfirm('Really?');
    expect(container.querySelector('[data-fr-confirm]')!.textContent).toContain('Delete?');
  });

  it('accepts confirm: true — the gesture with no words', () => {
    // Seen in a generated spec. It means "guard this", so it must guard rather
    // than fall through unguarded, even with nothing to say.
    const { container } = openConfirm(true);
    expect(container.querySelector('[data-fr-confirm]'), 'guarded anyway').not.toBeNull();
  });

  it('leaves the object form exactly as it was', () => {
    const { container } = openConfirm({ title: 'Delete Ada?', message: 'She has 3 open tickets.' });
    const t = container.querySelector('[data-fr-confirm]')!.textContent!;
    expect(t).toContain('Delete Ada?');
    expect(t).toContain('She has 3 open tickets.');
  });
});

describe('the latch is expressible where actions actually live', () => {
  // Many named actions sit on hosts that reject a component-level
  // `disabled`, and DataTable is the largest single one. Widening `disabled`
  // onto Card/ListItem/FeatureCard would be wrong — disabling a CARD greys out
  // content, not a control — but a row action IS a button, and it had no way to say
  // "already fired". Now it does, at the item level where it belongs.
  const rows = [{ id: '1', name: 'Ada' }];
  const cols = [{ key: 'name', label: 'Name' }];
  const withActions = (rowActions: unknown): any =>
    ({ root: 't', elements: { t: { type: 'DataTable', props: { columns: cols, rows, rowActions } } }, state: {} });

  it('a disabled row action is inert', () => {
    const { container } = render(<FraymeRenderer spec={withActions([{ id: 'del', label: 'Delete', disabled: true }])} mode="progressive" />);
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Delete')!;
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('and is live by default — the latch is opt-in, never a surprise', () => {
    const { container } = render(<FraymeRenderer spec={withActions([{ id: 'del', label: 'Delete' }])} mode="progressive" />);
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Delete')!;
    expect(btn.hasAttribute('disabled')).toBe(false);
  });
});
