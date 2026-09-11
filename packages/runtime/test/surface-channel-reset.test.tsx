/**
 * SURFACE-CHANNEL STALENESS — a repainting container must not inherit a channel
 * that describes somebody else's surface.
 *
 * --fr-surface (and the --fr-surface-field / -fg / -muted derived beside it) is
 * published by whichever container last painted a background, and custom
 * properties INHERIT. Four containers paint unconditionally — Card carries
 * `bg-card` in its cva base, SplitPane's bordered variant and both overlay panels
 * paint var(--fr-*-bg, var(--color-card)) — but published the channel only when the
 * author named a `bg`. So a container that repainted while inheriting a foreign
 * channel described the ANCESTOR's surface and showed its own.
 *
 * Measured on an unstyled Dialog declared inside Card { bg:"#12161f" }, before:
 *
 *   [role=dialog]  background #ffffff   <- the panel the user sees
 *                  --fr-surface #12161f <- the card's navy, inherited
 *                  --fr-surface-field   color-mix(… #fafafa 8%, #12161f)
 *   INPUT wrapper  background #252831   <- a near-black field ON WHITE
 *
 * Every consumer painted INVERTED, which is worse than the light-island the
 * channel exists to fix: .fr-dt-actions put a dark actions column on a white
 * panel, control() put a dark field on it.
 *
 * The fix resets --fr-surface and --fr-surface-field to the token actually
 * painted. Those two are reset and not the others because they are the ones with
 * ALWAYS-ON consumers (.fr-dt-actions / .fr-band / .fr-raised, and control());
 * --fr-surface-fg is read only through reader classes a container emits when it
 * authors `bg` or `color`, and such a container republishes the channel itself,
 * so a stale value there is unreachable.
 *
 * Byte-identity holds by construction: republishing var(--color-card) is exactly
 * what the unpublished chain already resolved to.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const CARD_BG = '#12161f';

/** `child` declared inside an authored DARK card — the shape that exposed this. */
function inDarkCard(child: Record<string, unknown>, state: Record<string, unknown> = {}) {
  const spec = {
    root: 'card',
    elements: {
      card: { type: 'Card', props: { bg: CARD_BG }, children: ['el'] },
      el: child,
    },
    state,
  } as unknown as Spec;
  return render(<FraymeRenderer spec={spec} mode="progressive" />);
}

/** The inline style declaration, which is where styleVars and the reset both land. */
const styleOf = (el: Element): string => el.getAttribute('style') ?? '';
const clsOf = (el: Element): string => (el.getAttribute('class') ?? '');

/* The reset is emitted as a class pair (a Tailwind arbitrary property), NOT via
   styleVars — styleVars is driven by an authored value, and the whole point here
   is the case where there is none. Asserting on the class is asserting on the
   mechanism that actually ships. */
const RESET_SURFACE = '[--fr-surface:var(--color-card)]';
const RESET_FIELD = '[--fr-surface-field:var(--color-card)]';

describe('surface channel — a repainting container resets it when no bg is authored', () => {
  const CASES: { name: string; child: Record<string, unknown>; state?: Record<string, unknown>; pick: (c: HTMLElement) => Element | null }[] = [
    {
      name: 'Dialog panel',
      child: { type: 'Dialog', props: { openPath: 'dlg', title: 'Unstyled' }, children: [] },
      state: { dlg: true },
      pick: (c) => c.querySelector('[role="dialog"]'),
    },
    {
      name: 'Drawer sheet',
      child: { type: 'Drawer', props: { openPath: 'dlg', title: 'Unstyled' }, children: [] },
      state: { dlg: true },
      pick: (c) => c.querySelector('[role="dialog"]'),
    },
    {
      name: 'SplitPane (bordered by default)',
      child: { type: 'SplitPane', props: {}, children: [] },
      pick: (c) => c.querySelector('.fr-splitpane'),
    },
    {
      // Resizable had BOTH halves: it published nothing at all, so an authored dark
      // Resizable still handed a DataTable the page surface (a WHITE actions column),
      // and its bordered branch repainted white while inheriting an ancestor channel.
      name: 'Resizable (bordered by default)',
      child: { type: 'Resizable', props: {}, children: [] },
      pick: (c) => c.querySelector('[style*="width"]'),
    },
  ];

  for (const k of CASES) {
    it(`${k.name}: repaints with no authored bg → resets --fr-surface and --fr-surface-field`, () => {
      const { container } = inDarkCard(k.child, k.state);
      const el = k.pick(container);
      expect(el, `${k.name}: the probe matched nothing`).not.toBeNull();
      const cls = clsOf(el!);
      expect(cls, `${k.name} must reset --fr-surface`).toContain(RESET_SURFACE);
      expect(cls, `${k.name} must reset --fr-surface-field`).toContain(RESET_FIELD);
    });
  }

  it('a Card with NO bg still repaints, so it resets too', () => {
    const spec = {
      root: 'outer',
      elements: {
        outer: { type: 'Card', props: { bg: CARD_BG }, children: ['inner'] },
        inner: { type: 'Card', props: { title: 'plain' }, children: [] },
      },
      state: {},
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    const cards = container.querySelectorAll('section, div[class*="fr-"]');
    const inner = [...cards].find((el) => clsOf(el).includes(RESET_SURFACE));
    expect(inner, 'the inner unstyled Card must reset the channel').toBeTruthy();
  });

  it('Resizable with an AUTHORED bg publishes the channel (it published nothing at all before)', () => {
    const spec = {
      root: 'rz',
      elements: { rz: { type: 'Resizable', props: { bg: CARD_BG }, children: [] } },
      state: {},
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    const pub = [...container.querySelectorAll('*')].find((el) => styleOf(el).includes('--fr-surface:'));
    expect(pub, 'an authored Resizable must publish --fr-surface').toBeTruthy();
    expect(styleOf(pub!), 'and the field ground derived from it').toContain('--fr-surface-field');
  });

  it('an AUTHORED bg publishes the channel instead of resetting it — the reset must not shadow it', () => {
    const spec = {
      root: 'outer',
      elements: {
        outer: { type: 'Card', props: { bg: CARD_BG }, children: ['inner'] },
        inner: { type: 'Card', props: { bg: '#203040' }, children: [] },
      },
      state: {},
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    const authored = [...container.querySelectorAll('*')].filter((el) => styleOf(el).includes('--fr-surface:'));
    expect(authored.length, 'both cards author a bg, so both publish via styleVars').toBe(2);
    // and neither carries the reset, which would out-rank nothing but is dead weight
    for (const el of authored) {
      expect(clsOf(el), 'an authored surface must not also emit the reset').not.toContain(RESET_SURFACE);
    }
  });

  /* The five NON-repainting publishers are the control: Box/Container/Section paint
     only when `bg != null`, and Stack/Grid's paint var has no token fallback, so all
     five are transparent when unstyled. A transparent element MUST pass the channel
     through — resetting there would break the very case the channel was built for
     (a Stack inside a dark Card handing --fr-surface to a DataTable). */
  for (const type of ['Box', 'Container', 'Section', 'Stack', 'Grid']) {
    it(`${type}: transparent when unstyled → passes the channel through, never resets`, () => {
      const { container } = inDarkCard({ type, props: {}, children: [] });
      for (const el of container.querySelectorAll('*')) {
        expect(clsOf(el), `${type} must not reset the channel`).not.toContain(RESET_SURFACE);
      }
    });
  }
});
