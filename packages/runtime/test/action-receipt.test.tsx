/**
 * THE ACTION RECEIPT COMPONENT (react/action-receipt.tsx) — the DOM of the
 * thread card, and its theme wiring.
 *
 * The card is themed EXACTLY like the renderer's
 * default. It is therefore its own `.frayme-root` (the token block, the dark
 * remaps and the presets reach it the way they reach a rendered spec), it takes
 * the same `theme` tokens as inline `--frayme-*` vars, and it honours
 * `data-theme`. Content comes from core/receipt.ts — receipt-model.test.ts owns
 * the rules; this file pins that each part of the model reaches the DOM, and
 * that what is absent from the model is absent from the DOM (no empty
 * description line, no empty table, no state unless asked).
 *
 * Plus the a11y shape: the root is a GROUP named by its own
 * heading (`aria-labelledby`), never a `region` landmark — a thread of N cards
 * must add N groups and zero landmarks (test/scroll-keys-a11y.test.tsx records
 * the same rule for scrollers); the state `<pre>` is a scrollport and so is
 * focusable AND named, the house contract; and nothing on the event can make
 * the card throw — a BigInt or a cycle in `state` renders.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FraymeActionReceipt } from '../src/react/action-receipt.js';
import { FraymeProvider } from '../src/react/FraymeProvider.js';
import type { DynamicActionEvent } from '../src/core/events.js';

const event: DynamicActionEvent = {
  action: 'trackPrice',
  params: { label: 'Track price', modelId: 'vantor-dualzone-55', currentPriceGbp: 149, durationDays: 14 },
  event: 'commit',
  state: { amount: 420 },
  element_id: 'track',
  label: 'Track price',
  description: 'Watches a listing and alerts you on a drop.',
};

const root = (container: HTMLElement) => container.querySelector('.frayme-receipt') as HTMLElement;

describe('content reaches the DOM', () => {
  it('renders the title verbatim, the description, and one table row per param', () => {
    const { container } = render(<FraymeActionReceipt event={event} />);
    const card = root(container);
    expect(card.tagName).toBe('SECTION');
    expect(card.classList.contains('frayme-root')).toBe(true);
    // Named by its own heading, so the accessible name IS the visible verbatim title.
    const h3 = card.querySelector('h3.frayme-receipt__title') as HTMLElement;
    expect(h3.textContent).toBe('Track price');
    expect(h3.id).toBeTruthy();
    expect(card.getAttribute('aria-labelledby')).toBe(h3.id);
    expect(card.hasAttribute('aria-label')).toBe(false);
    expect(card.querySelector('p.frayme-receipt__description')?.textContent).toBe('Watches a listing and alerts you on a drop.');
    const rows = [...card.querySelectorAll('table.frayme-receipt__params tr')].map((tr) => [
      tr.querySelector('th[scope="row"]')?.textContent,
      tr.querySelector('td')?.textContent,
    ]);
    // `label` became the title, so it is not a row.
    expect(rows).toEqual([
      ['Model ID', 'vantor-dualzone-55'],
      ['Current price GBP', '149'],
      ['Duration days', '14'],
    ]);
  });

  it('never re-cases the title — a Japanese label is rendered as supplied', () => {
    const { container } = render(<FraymeActionReceipt event={{ action: 'reserveSlot', params: {}, label: '選考枠を押さえる' }} />);
    expect(root(container).querySelector('.frayme-receipt__title')?.textContent).toBe('選考枠を押さえる');
  });

  it('falls back to the humanized action name as the title', () => {
    const { container } = render(<FraymeActionReceipt event={{ action: 'trackPrice', params: {} }} />);
    const title = root(container).querySelector('.frayme-receipt__title') as HTMLElement;
    expect(title.textContent).toBe('Track price');
    expect(root(container).getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('a malformed event with no action renders an empty heading and NO accessible name — and does not throw', () => {
    const { container } = render(<FraymeActionReceipt event={{} as never} />);
    const card = root(container);
    expect(card.querySelector('.frayme-receipt__title')?.textContent).toBe('');
    expect(card.hasAttribute('aria-labelledby')).toBe(false);
    expect(card.hasAttribute('aria-label')).toBe(false);
    expect(card.querySelector('table')).toBeNull();
  });

  it('renders NO description element when the event has none', () => {
    const { container } = render(<FraymeActionReceipt event={{ action: 'trackPrice', params: { a: 1 } }} />);
    expect(root(container).querySelector('.frayme-receipt__description')).toBeNull();
    // and never echoes the action name in its place
    expect(root(container).textContent).not.toContain('Track priceTrack price');
  });

  it('renders NO table when there are no rows', () => {
    const { container } = render(<FraymeActionReceipt event={{ action: 'regenerate', params: {} }} />);
    expect(root(container).querySelector('table')).toBeNull();
    const blanks = render(<FraymeActionReceipt event={{ action: 'a', params: { label: 'A', note: '' }, label: 'A' }} />);
    expect(root(blanks.container).querySelector('table')).toBeNull();
  });

  it('honours omitKeys', () => {
    const { container } = render(<FraymeActionReceipt event={event} omitKeys={['modelId', 'durationDays']} />);
    expect([...root(container).querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Current price GBP']);
  });
});

describe('state — hidden by default, a collapsed <details> on request', () => {
  it('renders no state by default', () => {
    const { container } = render(<FraymeActionReceipt event={event} />);
    expect(root(container).querySelector('.frayme-receipt__state')).toBeNull();
    expect(root(container).textContent).not.toContain('420');
  });

  it('showState → a <details> that is COLLAPSED, with a "State" summary and the JSON', () => {
    const { container } = render(<FraymeActionReceipt event={event} showState />);
    const details = root(container).querySelector('details.frayme-receipt__state') as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toBe('State');
    expect(details.querySelector('pre')?.textContent).toBe(JSON.stringify({ amount: 420 }, null, 2));
  });

  it('showState with no state on the event renders nothing extra', () => {
    const { container } = render(<FraymeActionReceipt event={{ action: 'a', params: {} }} showState />);
    expect(root(container).querySelector('.frayme-receipt__state')).toBeNull();
  });

  /**
   * The state block is a scrollport (frayme.css caps it at 20rem, overflow auto),
   * so it must be BOTH focusable and named — the contract every scroller in the
   * registry meets (scroll-keys-a11y.test.tsx `expectReachable`), which that gate
   * cannot see here because it finds scrollers by Tailwind utility class.
   */
  it('the state <pre> is a keyboard-reachable, named group', () => {
    const { container } = render(<FraymeActionReceipt event={event} showState />);
    const pre = root(container).querySelector('.frayme-receipt__state > pre') as HTMLElement;
    expect(pre.getAttribute('tabindex'), 'not focusable — a pointer is the only way to scroll it').toBe('0');
    expect(pre.getAttribute('role'), 'named regions must be a group, never a landmark').toBe('group');
    expect(pre.getAttribute('aria-label'), 'a tab stop with no name announces bare "group"').toBeTruthy();
  });

  /**
   * NEVER THROWS ON EVENT CONTENT. `JSON.stringify` rejects a BigInt and a cycle,
   * and `event.state` is whatever the host built — the old render crashed the
   * host's thread on either. The fallback is the params'
   * cycle-safe formatter, so the block still says something true.
   */
  it('showState renders a BigInt or a circular state instead of throwing', () => {
    const big = render(<FraymeActionReceipt event={{ action: 'a', params: {}, state: { n: BigInt(1) } }} showState />);
    expect(root(big.container).querySelector('.frayme-receipt__state > pre')?.textContent).toBe('N: 1');
    const circ: Record<string, unknown> = { id: 7 };
    circ.self = circ;
    const loop = render(<FraymeActionReceipt event={{ action: 'a', params: {}, state: circ }} showState />);
    expect(loop.container.querySelector('.frayme-receipt__state > pre')?.textContent).toBe('ID: 7, Self: [circular]');
    // and a plain state still gets the pretty JSON
    const plain = render(<FraymeActionReceipt event={{ action: 'a', params: {}, state: { n: 1 } }} showState />);
    expect(plain.container.querySelector('.frayme-receipt__state > pre')?.textContent).toBe('{\n  "n": 1\n}');
  });

  it('a circular PARAM renders too (the params table goes through the same formatter)', () => {
    const circ: Record<string, unknown> = { id: 7 };
    circ.self = circ;
    const { container } = render(<FraymeActionReceipt event={{ action: 'a', params: { x: circ } }} />);
    expect(root(container).querySelector('td')?.textContent).toBe('ID: 7, Self: [circular]');
  });
});

describe('a11y — a group named by its heading, never a landmark', () => {
  it('the default root is role="group" with aria-labelledby, so N cards add N groups and ZERO region landmarks', () => {
    const { container } = render(
      <>
        <FraymeActionReceipt event={event} />
        <FraymeActionReceipt event={{ ...event, action: 'cancelOrder', label: 'Cancel order' }} />
        <FraymeActionReceipt event={{ ...event, action: 'reserveSlot', label: '選考枠を押さえる' }} />
      </>,
    );
    const cards = [...container.querySelectorAll<HTMLElement>('.frayme-receipt')];
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.getAttribute('role')).toBe('group');
      expect(card.hasAttribute('aria-label')).toBe(false);
      const heading = card.querySelector('.frayme-receipt__title') as HTMLElement;
      expect(card.getAttribute('aria-labelledby')).toBe(heading.id);
    }
    // three DISTINCT heading ids — one card's name cannot point at another's title
    expect(new Set(cards.map((c) => c.getAttribute('aria-labelledby'))).size).toBe(3);
    expect(container.querySelectorAll('section[aria-label], [role="region"]')).toHaveLength(0);
  });

  it('as="div" is a named group (a named generic is prohibited); article / aside / li keep their native role', () => {
    const div = render(<FraymeActionReceipt event={event} as="div" />);
    expect(root(div.container).tagName).toBe('DIV');
    expect(root(div.container).getAttribute('role')).toBe('group');
    for (const as of ['article', 'aside', 'li'] as const) {
      const { container } = render(<FraymeActionReceipt event={event} as={as} />);
      const card = root(container);
      expect(card.tagName).toBe(as.toUpperCase());
      expect(card.hasAttribute('role')).toBe(false);
      expect(card.getAttribute('aria-labelledby')).toBe((card.querySelector('.frayme-receipt__title') as HTMLElement).id);
    }
  });

  it('headingLevel sets the title\'s heading element (default h3) — the thread\'s outline is the host\'s', () => {
    const dflt = render(<FraymeActionReceipt event={event} />);
    expect(root(dflt.container).querySelector('.frayme-receipt__title')?.tagName).toBe('H3');
    const h2 = render(<FraymeActionReceipt event={event} headingLevel={2} />);
    expect(root(h2.container).querySelector('.frayme-receipt__title')?.tagName).toBe('H2');
    const h5 = render(<FraymeActionReceipt event={event} headingLevel={5} />);
    const title = root(h5.container).querySelector('.frayme-receipt__title') as HTMLElement;
    expect(title.tagName).toBe('H5');
    expect(title.textContent).toBe('Track price');
    expect(root(h5.container).getAttribute('aria-labelledby')).toBe(title.id);
  });
});

describe('theme — the same wiring as FraymeRenderer', () => {
  it('applies theme tokens as --frayme-* inline vars on the root', () => {
    const { container } = render(<FraymeActionReceipt event={event} theme={{ primary: '#ff0000', radius: '1rem' }} />);
    const card = root(container);
    expect(card.style.getPropertyValue('--frayme-primary')).toBe('#ff0000');
    expect(card.style.getPropertyValue('--frayme-radius')).toBe('1rem');
  });

  it('falls back to the provider\'s theme, and the instance prop wins over it', () => {
    const { container } = render(
      <FraymeProvider theme={{ primary: '#00ff00', radius: '2rem' }}>
        <FraymeActionReceipt event={event} />
        <FraymeActionReceipt event={event} theme={{ primary: '#0000ff' }} />
      </FraymeProvider>,
    );
    const [fromProvider, own] = [...container.querySelectorAll('.frayme-receipt')] as HTMLElement[];
    expect(fromProvider!.style.getPropertyValue('--frayme-primary')).toBe('#00ff00');
    expect(fromProvider!.style.getPropertyValue('--frayme-radius')).toBe('2rem');
    expect(own!.style.getPropertyValue('--frayme-primary')).toBe('#0000ff');
    // an instance theme REPLACES the provider's, exactly as on FraymeRenderer
    expect(own!.style.getPropertyValue('--frayme-radius')).toBe('');
  });

  it('passes dataTheme through as data-theme, and sets none when absent', () => {
    const dark = render(<FraymeActionReceipt event={event} dataTheme="dark" />);
    expect(root(dark.container).getAttribute('data-theme')).toBe('dark');
    const none = render(<FraymeActionReceipt event={event} />);
    expect(root(none.container).hasAttribute('data-theme')).toBe(false);
  });

  it('appends className and honours `as`', () => {
    const { container } = render(<FraymeActionReceipt event={event} className="frayme-dark my-card" as="div" />);
    const card = root(container);
    expect(card.tagName).toBe('DIV');
    expect(card.className).toBe('frayme-root frayme-receipt frayme-dark my-card');
    expect(card.getAttribute('role')).toBe('group'); // a named <div> must not be a bare generic
  });
});
