import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import { FraymeConfirmModal } from '../src/react/confirm-modal.js';

/**
 * THE CONFIRM WEARS THE PASSED PRIMARY.
 *
 * A host that passes `theme.primary` gets --fr-btn-fill / --fr-btn-ink on the
 * renderer root (core/theme.ts), and every main action reads that pair. The
 * confirm that gates a declared action did not: a coloured "Register Lead" button
 * opened a near-black Confirm. These tests resolve the confirm button's own
 * var() chain against the custom properties it inherits, so they prove the colour
 * that lands, not just a class name.
 *
 * Three directions, each a defect if it regresses:
 *  1. primary passed: the affirmative confirm resolves to the brand fill and ink;
 *  2. a danger confirm never reads --fr-btn-fill (a Delete stays red);
 *  3. no primary: the confirm resolves to exactly what the pre-brand chain did.
 */

const BRAND = '#2563eb';
const BRAND_INK = '#ffffff'; // onFillInk('#2563eb')

/** The pre-brand chains, verbatim, so "nothing changes" is checked against them. */
const OLD_BG = 'var(--fr-confirm-accent,var(--fr-surface-fg,var(--color-foreground)))';
const OLD_FG = 'var(--fr-confirm-accent-fg,var(--fr-surface,var(--color-card)))';

/** A custom property as the element would inherit it from inline styles. */
function inherited(el: Element, name: string): string | undefined {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const v = (n as HTMLElement).style?.getPropertyValue(name);
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

/** Resolve one `var(--x, fallback)` expression the way the cascade would.
 *  A token nothing sets inline (the stylesheet's --color-*) comes back as var(name). */
function resolve(expr: string, el: Element): string {
  const s = expr.trim();
  if (!s.startsWith('var(') || !s.endsWith(')')) return s;
  const inner = s.slice(4, -1);
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { cut = i; break; }
  }
  const name = (cut < 0 ? inner : inner.slice(0, cut)).trim();
  const fallback = cut < 0 ? null : inner.slice(cut + 1);
  const v = inherited(el, name);
  if (v != null) return resolve(v, el);
  return fallback == null ? `var(${name})` : resolve(fallback, el);
}

/** The value inside an arbitrary-property class such as `[background:...]`. */
function arbitrary(el: Element, prop: 'background' | 'color'): string {
  const cls = [...el.classList].find((c) => c.startsWith(`[${prop}:`));
  if (!cls) throw new Error(`no [${prop}:...] class on ${el.outerHTML.slice(0, 120)}`);
  return cls.slice(prop.length + 2, -1).replace(/_/g, ' ');
}

const affirmative = (): HTMLButtonElement => {
  const modal = document.querySelector('[data-fr-confirm]');
  if (!modal) throw new Error('no confirm modal mounted');
  const buttons = [...modal.querySelectorAll('button')];
  // Cancel first, affirmative second (confirm-modal.tsx).
  return buttons[buttons.length - 1] as HTMLButtonElement;
};

const btnSpec = (props: Record<string, unknown>, on: unknown, rootProps?: Record<string, unknown>): Spec =>
  (rootProps
    ? {
        root: 'page',
        elements: {
          page: { type: 'Card', props: rootProps, children: ['go'] },
          go: { type: 'Button', props, on },
        },
        state: {},
      }
    : { root: 'go', elements: { go: { type: 'Button', props, on } }, state: {} }) as unknown as Spec;

const press = (spec: Spec, theme?: Record<string, string>, label = 'Register Lead') => {
  const r = render(
    <FraymeRenderer spec={spec} mode="progressive" theme={theme} onDynamicAction={vi.fn()} />,
  );
  const trigger = [...r.container.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === label && !b.closest('[data-fr-confirm]'),
  );
  fireEvent.click(trigger!);
  return r;
};

describe('confirm modal: the affirmative button takes the passed primary', () => {
  it('a Button whose declared action confirms: the Confirm resolves to the brand fill and ink', () => {
    press(btnSpec({ label: 'Register Lead' }, { commit: { action: 'registerLead' } }), { primary: BRAND });
    const ok = affirmative();
    expect(resolve(arbitrary(ok, 'background'), ok)).toBe(BRAND);
    expect(resolve(arbitrary(ok, 'color'), ok)).toBe(BRAND_INK);
  });

  it('the Confirm and the Button that opened it resolve to the same fill', () => {
    const r = press(btnSpec({ label: 'Register Lead' }, { commit: { action: 'registerLead' } }), { primary: BRAND });
    const page = [...r.container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Register Lead' && !b.closest('[data-fr-confirm]'),
    )!;
    const pageFill = [...page.classList].find((c) => c.startsWith('bg-[color:'))!.slice('bg-[color:'.length, -1);
    const ok = affirmative();
    expect(resolve(arbitrary(ok, 'background'), ok)).toBe(resolve(pageFill, page));
  });

  it('an authored confirm without a variant also takes the brand', () => {
    press(
      btnSpec({ label: 'Register Lead' }, { commit: { action: 'registerLead', confirm: { title: 'Register?', message: '' } } }),
      { primary: BRAND },
    );
    const ok = affirmative();
    expect(resolve(arbitrary(ok, 'background'), ok)).toBe(BRAND);
  });

  it('a spec that paints its own root: the brand still wins over the spec colours', () => {
    press(
      btnSpec({ label: 'Register Lead' }, { commit: { action: 'registerLead' } }, { bg: '#0e1116', color: '#e2e6f0' }),
      { primary: BRAND },
    );
    const ok = affirmative();
    expect(resolve(arbitrary(ok, 'background'), ok)).toBe(BRAND);
    expect(resolve(arbitrary(ok, 'color'), ok)).toBe(BRAND_INK);
  });

  it('a pale primary gets the dark ink on the Confirm, as it does on the Button', () => {
    press(btnSpec({ label: 'Register Lead' }, { commit: { action: 'registerLead' } }), { primary: '#fde047' });
    const ok = affirmative();
    expect(resolve(arbitrary(ok, 'background'), ok)).toBe('#fde047');
    expect(resolve(arbitrary(ok, 'color'), ok)).toBe('#0b1220');
  });
});

describe('confirm modal: a danger confirm never takes the brand', () => {
  const expectDanger = (ok: Element) => {
    expect(ok.className).not.toContain('--fr-btn-fill');
    expect(ok.className).not.toContain('--fr-btn-ink');
    expect(ok.classList.contains('bg-transparent')).toBe(true);
    expect(resolve(arbitrary(ok, 'color'), ok)).toBe('var(--color-danger)');
  };

  it('an authored variant:"danger" confirm stays quiet red with a primary passed', () => {
    press(
      btnSpec(
        { label: 'Delete lead' },
        { commit: { action: 'deleteLead', confirm: { title: 'Delete lead?', message: '', variant: 'danger' } } },
      ),
      { primary: BRAND },
      'Delete lead',
    );
    expectDanger(affirmative());
  });

  it('a variant:"danger" Button with no authored confirm gets a danger guard, not a brand one', () => {
    press(btnSpec({ label: 'Delete lead', variant: 'danger' }, { commit: { action: 'deleteLead' } }), { primary: BRAND }, 'Delete lead');
    expectDanger(affirmative());
  });

  it('a tone:"critical" Button with no authored confirm gets a danger guard too', () => {
    press(btnSpec({ label: 'Delete lead', tone: 'critical' }, { commit: { action: 'deleteLead' } }), { primary: BRAND }, 'Delete lead');
    expectDanger(affirmative());
  });

  it('an authored non-danger confirm on a danger Button is left as the author wrote it', () => {
    press(
      btnSpec(
        { label: 'Delete lead', variant: 'danger' },
        { commit: { action: 'deleteLead', confirm: { title: 'Sure?', message: '', variant: 'default' } } },
      ),
      { primary: BRAND },
      'Delete lead',
    );
    expect(resolve(arbitrary(affirmative(), 'background'), affirmative())).toBe(BRAND);
  });

  it('a tone:"critical" Confirmation: Approve gets a danger guard, Deny keeps the brand one', () => {
    const spec = {
      root: 'c',
      elements: {
        c: {
          type: 'Confirmation',
          props: { message: 'Delete 3 files?', tone: 'critical' },
          on: { commit: { action: 'deleteFiles' }, dismiss: { action: 'keepFiles' } },
        },
      },
      state: {},
    } as unknown as Spec;
    const r = render(<FraymeRenderer spec={spec} mode="progressive" theme={{ primary: BRAND }} onDynamicAction={vi.fn()} />);
    const btn = (text: string) =>
      [...r.container.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === text && !b.closest('[data-fr-confirm]'),
      )!;
    fireEvent.click(btn('Deny'));
    const keep = affirmative();
    expect(resolve(arbitrary(keep, 'background'), keep)).toBe(BRAND);
    fireEvent.click([...document.querySelectorAll('[data-fr-confirm] button')][0]);
    fireEvent.click(btn('Approve'));
    expectDanger(affirmative());
  });

  it('the component-level modal: variant danger reads no brand channel at all', () => {
    const { container } = render(
      <div style={{ ['--fr-btn-fill' as string]: BRAND, ['--fr-btn-ink' as string]: BRAND_INK }}>
        <FraymeConfirmModal config={{ title: 'Delete row?', variant: 'danger' }} onConfirm={vi.fn()} onCancel={vi.fn()} />
      </div>,
    );
    const ok = [...container.querySelectorAll('[data-fr-confirm] button')].pop()!;
    expectDanger(ok);
  });
});

describe('confirm modal: nothing changes when no primary is passed', () => {
  it('no --fr-btn-fill lands on the root, and the Confirm resolves exactly as the old chain did', () => {
    const r = press(btnSpec({ label: 'Register Lead' }, { commit: { action: 'registerLead' } }));
    const root = r.container.querySelector('.frayme-root') as HTMLElement;
    expect(root.style.getPropertyValue('--fr-btn-fill')).toBe('');
    expect(root.style.getPropertyValue('--fr-btn-ink')).toBe('');
    const ok = affirmative();
    expect(resolve(arbitrary(ok, 'background'), ok)).toBe(resolve(OLD_BG, ok));
    expect(resolve(arbitrary(ok, 'color'), ok)).toBe(resolve(OLD_FG, ok));
    expect(resolve(arbitrary(ok, 'background'), ok)).toBe('var(--color-foreground)');
    expect(resolve(arbitrary(ok, 'color'), ok)).toBe('var(--color-card)');
  });

  it('a spec that paints its root and passes no primary: the Confirm still wears the spec ink', () => {
    press(btnSpec({ label: 'Register Lead' }, { commit: { action: 'registerLead' } }, { bg: '#0e1116', color: '#e2e6f0' }));
    const ok = affirmative();
    expect(resolve(arbitrary(ok, 'background'), ok)).toBe('#e2e6f0');
    expect(resolve(arbitrary(ok, 'color'), ok)).toBe('#0e1116');
  });

  it('a theme with other tokens but no primary leaves the Confirm neutral', () => {
    press(btnSpec({ label: 'Register Lead' }, { commit: { action: 'registerLead' } }), { accent: '#7c3aed', radius: '0.5rem' });
    const ok = affirmative();
    expect(resolve(arbitrary(ok, 'background'), ok)).toBe('var(--color-foreground)');
  });
});

describe('the component-internal confirms share the one modal', () => {
  const table = (theme?: Record<string, string>) => {
    const spec = {
      root: 't',
      elements: {
        t: {
          type: 'DataTable',
          props: {
            columns: [{ key: 'name', label: 'Name' }],
            rows: [{ name: 'Ada' }],
            rowActions: [
              { id: 'approve', label: 'Approve' },
              { id: 'remove', label: 'Remove', variant: 'danger' },
            ],
          },
          on: { commit: { action: 'rowAct' } },
        },
      },
      state: {},
    } as unknown as Spec;
    return render(<FraymeRenderer spec={spec} mode="progressive" theme={theme} onDynamicAction={vi.fn()} />);
  };
  const rowBtn = (container: HTMLElement, text: string) =>
    [...container.querySelectorAll('button')].find(
      (b) => (b.textContent?.trim() === text || b.getAttribute('aria-label') === text) && !b.closest('[data-fr-confirm]'),
    )!;

  it('a DataTable row action confirm takes the brand; its danger row action does not', () => {
    const r = table({ primary: BRAND });
    fireEvent.click(rowBtn(r.container, 'Approve'));
    const ok = affirmative();
    expect(resolve(arbitrary(ok, 'background'), ok)).toBe(BRAND);
    // cancel, then the destructive one
    fireEvent.click([...document.querySelectorAll('[data-fr-confirm] button')][0]);
    fireEvent.click(rowBtn(r.container, 'Remove'));
    const del = affirmative();
    expect(del.className).not.toContain('--fr-btn-fill');
    expect(resolve(arbitrary(del, 'color'), del)).toBe('var(--color-danger)');
  });
});
