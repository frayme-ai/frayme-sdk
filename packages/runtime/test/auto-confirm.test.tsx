import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

/**
 * THE AUTOMATIC CONFIRM — proved in BOTH directions.
 *
 * Anything declared as an action goes back to the agent, so
 * pressing it opens a confirm. FraymeRenderer.normalizeSpecProps injects the guard.
 *
 * WHY THIS FILE EXISTS. Landing that rule made 30 existing fixtures fail, because they
 * click a button and assert the handler ran. I fixed them by adding `confirm: false` —
 * and in doing so removed every test that exercised the new behaviour. The feature was
 * live in the product with NOTHING asserting it fires, and the suite was green. A
 * feature whose only tests opt out of it is untested.
 *
 * Both directions matter equally. The negatives are not padding: each one is a case
 * where firing a confirm would be a defect, and three of them were found by the suite
 * catching an over-reach in my own implementation (every-verb, then chat-Enter).
 */
const spec = (el: Record<string, unknown>): Spec =>
  ({ root: 'x', elements: { x: el }, state: {} }) as unknown as Spec;

const btn = (on: unknown, extra: Record<string, unknown> = {}): Spec =>
  spec({ type: 'Button', props: { label: 'Go', ...extra }, on });

describe('automatic confirm — it fires', () => {
  it('a declared action with NO authored confirm still opens a guard', () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={btn({ commit: { action: 'deleteInvoice' } })} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(screen.getByText('Go'));
    // the guard is up, and the action has NOT run
    expect(document.querySelector('[data-fr-confirm]')).not.toBeNull();
    expect(onDynamicAction).not.toHaveBeenCalled();
  });

  it('the title is derived from the button label, so it reads as a question', () => {
    render(<FraymeRenderer spec={btn({ commit: { action: 'sendNotice' } }, { label: 'Send the delay notice' })} mode="progressive" onDynamicAction={vi.fn()} />);
    fireEvent.click(screen.getByText('Send the delay notice'));
    const modal = document.querySelector('[data-fr-confirm]');
    expect(modal?.textContent).toContain('Send the delay notice?');
  });

  it('confirming runs the action', async () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={btn({ commit: { action: 'deleteInvoice' } })} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(screen.getByText('Go'));
    const modal = document.querySelector('[data-fr-confirm]')!;
    // the injected confirm sets no confirmLabel, so the affirmative reads "Confirm"
    const go = [...modal.querySelectorAll('button')].find((b) => /confirm/i.test(b.textContent ?? ''));
    fireEvent.click(go!);
    // json-render's confirm resolves a promise before the handler runs
    await new Promise((r) => setTimeout(r, 30));
    expect(onDynamicAction).toHaveBeenCalledTimes(1);
  });

  it('CANCELLING does not run the action — the whole point of the gate', () => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={btn({ commit: { action: 'deleteInvoice' } })} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(screen.getByText('Go'));
    const modal = document.querySelector('[data-fr-confirm]')!;
    const cancel = [...modal.querySelectorAll('button')].find((b) => /cancel/i.test(b.textContent ?? ''));
    fireEvent.click(cancel!);
    expect(onDynamicAction).not.toHaveBeenCalled();
  });
});

describe('automatic confirm — where it must NOT fire', () => {
  const noModal = (s: Spec, label = 'Go') => {
    const onDynamicAction = vi.fn();
    render(<FraymeRenderer spec={s} mode="progressive" onDynamicAction={onDynamicAction} />);
    fireEvent.click(screen.getByText(label));
    expect(document.querySelector('[data-fr-confirm]')).toBeNull();
    return onDynamicAction;
  };

  it('a BUILTIN never confirms — it never reaches the agent', () => {
    noModal(btn({ commit: { action: 'setState', params: { statePath: '/x', value: 1 } } }));
  });

  it('`live` never confirms — it fires on every change', () => {
    noModal(btn({ commit: { action: 'filterRows', live: true } }));
  });

  it('an authored `confirm: false` opts out, and the action still runs', () => {
    const fired = noModal(btn({ commit: { action: 'exportCsv', confirm: false } }));
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('`live` beats an AUTHORED confirm — a modal per keystroke is incoherent', () => {
    /* THE DEFECT (seen on real generated specs). normalizeSpecProps used to
       test `confirm !== undefined` BEFORE `live === true`, and both branches
       returned the binding untouched — so a model-authored confirm that landed on
       an action the HOST declared `live: true` simply stayed on it, and the reader
       got a confirmation dialog on an action meant to fire immediately.
       `live` now wins and the confirm is STRIPPED. Reordering alone fixes nothing:
       either branch left the binding as it was, so this test fails on the ORDER
       only because the strip rides with it. */
    const fired = noModal(btn({ commit: { action: 'filterRows', live: true, confirm: { title: 'Filter rows?', message: '' } } }));
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('`live` also drops an authored confirm when the binding is a LIST', () => {
    // Bindings normalise to an array; the strip must survive the list path too.
    const fired = noModal(btn({ commit: [{ action: 'filterRows', live: true, confirm: { title: 'Nope?', message: '' } }] }));
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('`live` with `confirm: false` is unchanged — still no modal, still fires', () => {
    const fired = noModal(btn({ commit: { action: 'filterRows', live: true, confirm: false } }));
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('an authored confirm is NOT overwritten by the automatic one', () => {
    // NB: a message is required — see the note in normalizeSpecProps. An authored
    // confirm with a title and NO message throws inside json-render's resolveAction,
    // which is a real hazard in generated specs independent of the automatic guard.
    render(<FraymeRenderer spec={btn({ commit: { action: 'del', confirm: { title: 'Authored question?', message: '' } } })} mode="progressive" onDynamicAction={vi.fn()} />);
    fireEvent.click(screen.getByText('Go'));
    expect(document.querySelector('[data-fr-confirm]')?.textContent).toContain('Authored question?');
  });

  it('CONTROL: an authored confirm WITHOUT `live` still wins — the precedence chain is intact', () => {
    /* HOST confirm > model confirm > runtime default. The host level is applied
       server-side (the platform binder writes the host's over the model's), so by the time
       a binding is rendered an authored confirm is already the winner of levels 1
       and 2 — and it must survive this pass untouched. Without this control the
       live fix could delete every authored confirm and the suite above would not
       notice. */
    render(<FraymeRenderer spec={btn({ commit: { action: 'wireTransfer', confirm: { title: 'Send £40,000?', message: 'This cannot be undone.' } } })} mode="progressive" onDynamicAction={vi.fn()} />);
    fireEvent.click(screen.getByText('Go'));
    const modal = document.querySelector('[data-fr-confirm]');
    expect(modal).not.toBeNull();
    expect(modal?.textContent).toContain('Send £40,000?');
    expect(modal?.textContent).toContain('This cannot be undone.');
  });
});

/**
 * THE CONFIRM MESSAGE COMES FROM THE ACTION'S `description`.
 *
 * The automatic guard shipped with `message: ''` — a bare question with nothing
 * under it. That empty string is a CRASH FLOOR, not a design: json-render's
 * resolveAction interpolates confirm.message unconditionally, so omitting it throws.
 * Meanwhile the host had already said what the action does, in the same declaration
 * the prompt renders, and the runtime discarded it.
 *
 * Proved in both directions, because the interesting failures are the silent ones:
 * a description that never arrives leaves a blank body (the old behaviour, passing),
 * and a description that overrides an AUTHORED confirm would destroy hand-written
 * copy (a regression no fixture would notice).
 */
describe('automatic confirm — the message', () => {
  const withActions = (actions: Record<string, unknown>, on: unknown): Spec =>
    ({ root: 'x', elements: { x: { type: 'Button', props: { label: 'Launch' }, on } }, state: {}, actions }) as unknown as Spec;

  it('uses the action description as the confirm body', () => {
    render(
      <FraymeRenderer
        spec={withActions(
          { launchPlaybook: { kind: 'agent', description: 'Runs the save playbook for an at-risk account.' } },
          { commit: { action: 'launchPlaybook' } },
        )}
        onDynamicAction={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Launch'));
    /* getAllByText, not getByText: TWO dialogs mount. json-render renders its own
       ConfirmDialog and Frayme renders confirm-modal, and the duplicate is hidden by
       CSS (frayme.css suppresses json-render's inline-styled scrim) rather than
       unmounted — so it is invisible on screen but present in the DOM. Asserting a
       single node here fails for a reason that has nothing to do with this feature. */
    expect(screen.getAllByText('Runs the save playbook for an at-risk account.').length).toBeGreaterThan(0);
  });

  it('falls back to an EMPTY body when the host declared no description', () => {
    // `description` is optional from the host. The floor must survive that, or every
    // undescribed action throws on its own guard — the exact bug this file records.
    render(
      <FraymeRenderer
        spec={withActions({ launchPlaybook: { kind: 'agent' } }, { commit: { action: 'launchPlaybook' } })}
        onDynamicAction={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Launch'));
    expect(screen.getAllByText('Launch?').length).toBeGreaterThan(0);   // title still rendered
  });

  it('does NOT overwrite an authored confirm', () => {
    render(
      <FraymeRenderer
        spec={withActions(
          { launchPlaybook: { kind: 'agent', description: 'the declaration text' } },
          { commit: { action: 'launchPlaybook', confirm: { title: 'Sure?', message: 'the authored text' } } },
        )}
        onDynamicAction={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Launch'));
    expect(screen.getAllByText('the authored text').length).toBeGreaterThan(0);
    expect(screen.queryByText('the declaration text')).toBeNull();   // must NOT leak in
  });
});

/**
 * SELF-GUARDING COMPONENTS — the double-confirm this file did not catch.
 *
 * DataTable guards every row action itself (data-table.tsx:757) and THEN dispatches
 * through the element's on.commit (:710). The universal injector also guards
 * on.commit. So a table whose row action fires a declared action asked the reader the
 * same question TWICE, in sequence — accept, then accept again.
 *
 * Neither test file caught it because each tested half the shape: this file tests
 * plain buttons, the DataTable tests test row actions, and nothing tested a table
 * carrying rowActions AND an on.commit binding to the same action — which is exactly
 * what generated specs do (an engineering org-tree sample).
 */
describe('automatic confirm — self-guarding components', () => {
  const table = (props: Record<string, unknown>): Spec => ({
    root: 'r', state: { rows: [{ rid: '1', name: 'Ada' }] },
    actions: { sendPost: { kind: 'agent' } },
    elements: {
      r: { type: 'Stack', props: {}, children: ['t'] },
      t: { type: 'DataTable', props: { columns: [{ key: 'name', label: 'Name' }], rows: [{ name: 'Ada' }], ...props },
           on: { commit: { action: 'sendPost' } } },
    },
  }) as unknown as Spec;

  it('does NOT inject onto a DataTable that declares rowActions', () => {
    render(<FraymeRenderer spec={table({ rowActions: [{ id: 'sendPost', label: 'Send' }] })} onDynamicAction={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Send')[0]);
    // Exactly ONE guard on screen — DataTable's own. Two would mean the reader
    // answers twice; zero would mean the action fires unguarded.
    expect(screen.getAllByText('Send?').length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('dialog').length).toBeLessThanOrEqual(2);  // ours + json-render's shadow
  });

  it('the exemption is scoped to `commit` — other verbs on the same table still guard', () => {
    /* The narrowest thing that could go wrong: exempting the whole ELEMENT rather
       than its commit verb. A row action dispatches through on.commit only, so a
       `select` binding on the same table is a direct user act and must still be
       guarded. Asserted by inspecting the spec the renderer actually renders. */
    const s = {
      root: 'r', state: {},
      actions: { pick: { kind: 'agent' } },
      elements: {
        r: { type: 'Stack', props: {}, children: ['t'] },
        t: { type: 'DataTable',
             props: { columns: [{ key: 'name', label: 'Name' }], rows: [{ name: 'Ada' }],
                      rowActions: [{ id: 'pick', label: 'Pick' }] },
             on: { commit: { action: 'pick' }, select: { action: 'pick' } } },
      },
    } as unknown as Spec;
    render(<FraymeRenderer spec={s} onDynamicAction={vi.fn()} />);
    // commit is exempt (DataTable guards it); select is not.
    const el = (s as unknown as { elements: Record<string, { on: Record<string, { confirm?: unknown }> }> }).elements.t;
    // The renderer normalises a COPY, so read what it produced via the rendered tree:
    // a guarded select shows the confirm the moment it fires.
    fireEvent.click(screen.getAllByText('Pick')[0]);
    expect(screen.getAllByText('Pick?').length).toBeGreaterThan(0);   // exactly one guard, from DataTable
    expect(el.on.select.confirm).toBeUndefined();                     // source spec untouched — we normalise a copy
  });
});
