/**
 * Scheduler — block meta-text contrast · scrollport reach · popover target size.
 *
 * The accessibility audit reported a cluster of low-contrast findings on ONE span: the
 * `text-[10px] tabular-nums` time line inside a Scheduler event block. A
 * source-level eye misses it because the colour is the ordinary muted token —
 * what differs is the SURFACE. An event block paints a 12% tint of the event
 * colour, so the meta lines sit on that tint and not on the card.
 *
 * That finding was measured against `--frayme-muted-fg: #71717a`, and the same
 * pass moved the token to #52525b in frayme.css for exactly this class of
 * failure. Measured on the tint the block actually paints:
 *
 *                                 #71717a (measured)   #52525b (shipping)
 *   light · 12% tint (resting)          4.09                6.54
 *   light · 20% tint (hover)            3.64                5.82
 *   dark  · 12% tint                    5.45                5.45   (dark token
 *                                                                   unchanged)
 *
 * so the 118 findings are answered by the token, and the Scheduler needs no
 * local ink of its own — which is the outcome the token change argued for in
 * its own comment ("two components needing the identical local patch in one
 * sweep is the signature of a token set too light"). What this file adds is the
 * MEASUREMENT that keeps that true: it resolves the colour the component asks
 * for through the real var chain in frayme.css, composites the tint over the
 * card, and asserts the ratio. A class-string assertion could not tell the
 * difference between the two token values above.
 *
 * Two things here ARE fixes in scheduler.tsx:
 *  - the scrollport (the grid's overflow-x box) now takes focus and carries a
 *    name — its event blocks cannot serve as the tab stop, since an empty
 *    schedule has none and a one-column day leaves the other columns, the hour
 *    axis and the header row unreachable;
 *  - the popover ✕ carries a real 28px box. This stylesheet ships WITHOUT
 *    Tailwind preflight, so a bare <button> keeps the UA's 13.3px font and the
 *    old `p-1` measured ~17x23px — under WCAG 2.5.8's 24x24.
 *
 * The last describe characterises the horizontal rails in actions.tsx /
 * layout.tsx, which the same audit flags and which were deliberately NOT given a
 * tabIndex — see there.
 */
import { render, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;
const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

/* ── the token table, read from the stylesheet that ships ──────────────────── */

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '../src/styles/frayme.css'), 'utf8');

function cssBlock(startPattern: RegExp): string {
  const i = css.search(startPattern);
  if (i < 0) throw new Error(`block not found: ${startPattern}`);
  const open = css.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < css.length; j += 1) {
    if (css[j] === '{') depth += 1;
    else if (css[j] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open, j);
    }
  }
  throw new Error('unbalanced braces');
}

/** Every `--x: value;` declaration in a block. */
const declsIn = (blk: string): Record<string, string> =>
  Object.fromEntries([...blk.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

// `.frayme-root` carries BOTH halves of the chain: the --color-* tokens re-pointed
// at --frayme-*, and the --frayme-* light values. Dark re-derives only --frayme-*,
// so overlaying the dark block on the light table is the whole mode switch.
const LIGHT_VARS = declsIn(cssBlock(/^\.frayme-root\s*\{/m));
const DARK_VARS = { ...LIGHT_VARS, ...declsIn(cssBlock(/@media \(prefers-color-scheme: dark\)/)) };

/* ── a resolver for the slice of CSS colour syntax these classes use ───────── */

type RGB = [number, number, number];

/** Split on top-level commas (var()/color-mix() nest, so depth matters). */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const hexToRgb = (h: string): RGB => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB;
};

/** `var(--a,fallback)` · `color-mix(in srgb, A P%, B)` · `#rrggbb`. */
function resolveColor(expr: string, vars: Record<string, string>): RGB {
  // Tailwind arbitrary values encode spaces as underscores.
  const e = expr.replace(/_/g, ' ').trim();
  if (e.startsWith('#')) return hexToRgb(e);
  if (e.startsWith('var(')) {
    const args = splitTop(e.slice(4, -1));
    const value = vars[args[0]];
    if (value != null) return resolveColor(value, vars);
    if (args.length > 1) return resolveColor(args.slice(1).join(','), vars);
    throw new Error(`unset var with no fallback: ${args[0]}`);
  }
  if (e.startsWith('color-mix(')) {
    const args = splitTop(e.slice(10, -1));
    // The arithmetic below is sRGB. An oklab mix is a DIFFERENT colour, so it must
    // not be measured with this math — fail loudly rather than quietly wrong.
    expect(args[0].trim(), 'this guard can only measure an sRGB color-mix').toBe('in srgb');
    const pct = Number(/(\d+(?:\.\d+)?)%/.exec(args[1])![1]) / 100;
    const a = resolveColor(args[1].replace(/\s*\d+(?:\.\d+)?%\s*$/, ''), vars);
    const b = resolveColor(args[2], vars);
    return a.map((c, i) => c * pct + b[i] * (1 - pct)) as RGB;
  }
  throw new Error(`unhandled colour expression: ${e}`);
}

/* ── WCAG 2.1 relative luminance + contrast (the accessibility audit's own math) ────── */

const luminance = ([r, g, b]: RGB): number => {
  const f = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (fg: RGB, bg: RGB): number => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
};
/** Simple alpha compositing — a `/12` utility is a 12%-alpha layer over the card. */
const over = (top: RGB, under: RGB, alpha: number): RGB =>
  top.map((c, i) => c * alpha + under[i] * (1 - alpha)) as RGB;

/* ── the render under test ─────────────────────────────────────────────────── */

// 09:00-11:00 in an 08:00-18:00 window at the default 48px pitch ⇒ a 96px block,
// which clears BOTH pixel gates (time ≥34px, subtitle ≥56px), so both meta spans
// render. Two events, no overlap — the stacked branch paints an opaque face and
// is a different surface than the one that was measured.
const EVENTS = [
  { id: 'a', title: 'Design review', start: '09:00', end: '11:00', subtitle: 'Studio 2' },
  { id: 'b', title: 'Retro', start: '14:00', end: '15:30', subtitle: 'Zoom' },
];
const drawScheduler = () => draw('Scheduler', { events: EVENTS });

const schedRoot = (c: HTMLElement): HTMLElement => c.querySelector<HTMLElement>('[role="group"][aria-label="Schedule"]')!;
const blocks = (c: HTMLElement): HTMLElement[] => [...c.querySelectorAll<HTMLElement>('[role="button"][aria-label]')];
/** The colour-bearing spans inside the first block: the time line and subtitle. */
const metaSpans = (c: HTMLElement): HTMLElement[] =>
  [...blocks(c)[0].querySelectorAll<HTMLElement>('span')].filter((s) => /text-\[color:/.test(s.className));
const colourOf = (el: HTMLElement): string => /text-\[color:([^\]]+)\]/.exec(el.className)![1];
/** Every tint the block paints under its own text: the resting `/12` and the hover one. */
const blockTints = (block: HTMLElement): Array<[string, number]> =>
  [...block.className.matchAll(/bg-\[color:([^\]]+)\]\/(\d+)/g)].map((m) => [m[1], Number(m[2]) / 100]);

describe('Scheduler — the meta lines clear 4.5:1 on the tint they sit on', () => {
  it('renders both meta lines inside the block (the spans the audit measured)', () => {
    const { container } = drawScheduler();
    expect(blocks(container).length).toBe(2);
    expect(metaSpans(container).map((s) => s.textContent)).toEqual(['9:00 AM – 11:00 AM', 'Studio 2']);
  });

  it.each([
    ['light', LIGHT_VARS],
    ['dark', DARK_VARS],
  ])('%s: on the shipped tokens, every meta line clears the small-text floor', (_mode, vars) => {
    const { container } = drawScheduler();
    const block = blocks(container)[0];
    const tints = blockTints(block);
    expect(tints.length, 'the block should paint a tinted face').toBeGreaterThan(0);
    const card = resolveColor('var(--color-card)', vars);

    for (const [colourExpr, alpha] of tints) {
      const bg = over(resolveColor(colourExpr, vars), card, alpha);
      for (const span of metaSpans(container)) {
        const fg = resolveColor(colourOf(span), vars);
        expect(
          contrast(fg, bg),
          `"${span.textContent}" on the ${alpha * 100}% tint (fg ${fg.map(Math.round).join(',')})`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('is sensitive to the token: the #71717a the audit measured fails the same check', () => {
    // The guard above passes because --frayme-muted-fg is #52525b. Pinning the
    // superseded value here is what proves the measurement — not the class string —
    // is doing the work: on the identical surface the old token reads 4.09 / 3.64.
    const { container } = drawScheduler();
    const card = resolveColor('var(--color-card)', LIGHT_VARS);
    const ratios = blockTints(blocks(container)[0]).map(([expr, alpha]) =>
      contrast(hexToRgb('#71717a'), over(resolveColor(expr, LIGHT_VARS), card, alpha)),
    );
    expect(ratios).toEqual([4.09, 3.64]);
    expect(Math.max(...ratios)).toBeLessThan(4.5);
  });
});

describe('Scheduler — the scrollport is reachable and announced', () => {
  it('the overflow-x box takes focus and carries a name', () => {
    const { container } = drawScheduler();
    const root = schedRoot(container);
    expect(root.className).toContain('overflow-x-auto');
    expect(root.tabIndex).toBe(0);
    // group, not region: region is a landmark and would crowd the page's own.
    expect(root.getAttribute('role')).toBe('group');
    expect(root.getAttribute('aria-label')).toBe('Schedule');
  });

  it('an empty schedule has no focusable child — which is why the blocks cannot be the tab stop', () => {
    const { container } = draw('Scheduler', { events: [] });
    expect(blocks(container).length).toBe(0);
    expect(container.querySelectorAll('[tabindex="0"]').length).toBe(1);
    expect(schedRoot(container).tabIndex).toBe(0);
  });
});

describe('Scheduler — the popover close is a real pointer target', () => {
  /** Tailwind h-/w- steps are 0.25rem each ⇒ 4 CSS px. */
  const boxPx = (cls: string): { w: number; h: number } => ({
    w: Number(/\bw-(\d+(?:\.\d+)?)\b/.exec(cls)?.[1] ?? 0) * 4,
    h: Number(/\bh-(\d+(?:\.\d+)?)\b/.exec(cls)?.[1] ?? 0) * 4,
  });

  it.each([
    ['view', false],
    ['edit', true],
  ])('the %s popover ✕ is at least 24x24 CSS px', (_mode, edit) => {
    const { container } = drawScheduler();
    fireEvent.keyDown(blocks(container)[0], { key: 'Enter' });
    if (edit) fireEvent.click([...container.querySelectorAll('button')].find((b) => b.textContent === 'Edit')!);
    const close = container.querySelector<HTMLElement>('button[aria-label="Close"]')!;
    const { w, h } = boxPx(close.className);
    // padding around a UA-sized glyph is what measured ~17x23px, so the box has to
    // be explicit: a p-* alone must never come back as the sizing here.
    expect({ w, h }).toEqual({ w: 28, h: 28 });
    expect(Math.min(w, h)).toBeGreaterThanOrEqual(24);
  });
});

/**
 * The same audit reports the horizontal rails in actions.tsx / layout.tsx as
 * "scroller with no keyboard reach". Those three were NOT given a tabIndex, and
 * this describe pins the reason so the exemption is not re-litigated blind: each
 * rail's own children are the tab stops that walk it, and the browser scrolls a
 * focused element into view. A tabIndex on the container would add a stop that
 * lands on nothing and, for the tablist, would break the APG pattern (one stop
 * for the strip, arrows within it).
 *
 * Nothing here asserts a fix — it asserts the PREMISE of the exemption, so that
 * making the items unfocusable fails loudly instead of quietly stranding the
 * rail's content.
 */
describe('horizontal rails — the tab stop is the items, not the container', () => {
  it('an attached ToggleGroup strip is a scroller whose every child is a button', () => {
    const { container } = draw('ToggleGroup', {
      attached: true,
      items: [
        { label: 'Day', value: 'd' },
        { label: 'Week', value: 'w' },
        { label: 'Month', value: 'm' },
      ],
    });
    const strip = container.querySelector<HTMLElement>('[role="group"]')!;
    expect(strip.className).toContain('overflow-x-auto');
    expect(strip.tabIndex).toBeLessThan(0);
    expect([...strip.children].every((c) => c.tagName === 'BUTTON' && !(c as HTMLButtonElement).disabled)).toBe(true);
  });

  it('an attached ButtonGroup strip is the same shape', () => {
    const { container } = draw('ButtonGroup', {
      buttons: [
        { label: 'One', value: '1' },
        { label: 'Two', value: '2' },
      ],
    });
    const strip = container.querySelector<HTMLElement>('[role="group"]')!;
    expect(strip.className).toContain('overflow-x-auto');
    expect(strip.tabIndex).toBeLessThan(0);
    expect([...strip.children].every((c) => c.tagName === 'BUTTON')).toBe(true);
  });

  it('the Tabs rail keeps ONE roving stop — a container stop would be a second one', () => {
    const { container } = draw('Tabs', {
      tabs: [
        { label: 'Overview', value: 'o' },
        { label: 'Usage', value: 'u' },
        { label: 'Billing', value: 'b' },
      ],
    });
    const rail = container.querySelector<HTMLElement>('[role="tablist"]')!;
    expect(rail.className).toContain('overflow-x-auto');
    expect(rail.tabIndex).toBeLessThan(0);
    const tabs = [...rail.querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(tabs.filter((t) => t.tabIndex === 0).length).toBe(1);
    // and the arrow keys really do walk the whole rail
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(container.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(container.querySelectorAll('[role="tab"]')[1], { key: 'End' });
    expect(container.querySelectorAll('[role="tab"]')[2].getAttribute('aria-selected')).toBe('true');
  });
});
