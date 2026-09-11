/**
 * Hover/tooltip unification — charts-extra.tsx.
 *
 * The family hover system (ported from charts-proportion / charts-radial):
 * every data mark gets (a) a native tooltip — a `title` ATTRIBUTE on HTML
 * marks, a `<title>` CHILD on SVG marks — with 'label — value' (or the
 * domain-appropriate summary), and (b) cursor-pointer + hover:brightness-110
 * (brightness, not MARK_POP scale: this family's marks are wide/thin bars,
 * grid cells, and a stroke-only ring — scaling distorts; the Candlestick
 * lesson). Resting render stays byte-identical apart from those hover-only
 * additions.
 *
 * Per chart we assert: (a) the tooltip exists with the expected text,
 * (b) the mark carries cursor-pointer (+ the brightness hover class).
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;

const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

const has = (el: Element, token: string): boolean => el.classList.contains(token);

/* ── BarList ─────────────────────────────────────────────────────────────── */

describe('BarList — row tooltip + brightness hover on the fill', () => {
  it('every bar row carries a native title "label — value"', () => {
    const { container } = draw('BarList', {
      data: [
        { label: 'Alpha', value: 40 },
        { label: 'Beta', value: 20 },
      ],
    });
    const rows = Array.from(container.querySelectorAll('[role="listitem"]'));
    expect(rows.length).toBe(2);
    expect(rows[0].getAttribute('title')).toBe('Alpha — 40');
    expect(rows[1].getAttribute('title')).toBe('Beta — 20');
  });

  it('the fill mark carries cursor-pointer + hover:brightness-110; transition-[width] stays data-change-only (no transition-[filter])', () => {
    const { container } = draw('BarList', { data: [{ label: 'Alpha', value: 40 }] });
    const fill = Array.from(container.querySelectorAll('div')).find((el) =>
      el.classList.contains('[background:var(--fr-bar-w-fill)]'),
    );
    expect(fill).toBeTruthy();
    expect(has(fill!, 'cursor-pointer')).toBe(true);
    expect(has(fill!, 'hover:brightness-110')).toBe(true);
    // the width transition is for DATA changes — the brightness hover must not
    // introduce a competing transition-property utility.
    expect(has(fill!, 'transition-[width]')).toBe(true);
    expect(has(fill!, 'transition-[filter]')).toBe(false);
  });
});

/* ── Heatmap ─────────────────────────────────────────────────────────────── */

describe('Heatmap — every valued cell reports its raw value (GitHub-contributions style)', () => {
  it('every cell carries title=<raw value> plus cursor-pointer + brightness hover', () => {
    const { container } = draw('Heatmap', {
      cells: [
        [1, 2],
        [3, 4],
      ],
    });
    const cells = Array.from(container.querySelectorAll('span[title]'));
    expect(cells.map((el) => el.getAttribute('title'))).toEqual(['1', '2', '3', '4']);
    for (const cell of cells) {
      expect(has(cell, 'cursor-pointer')).toBe(true);
      expect(has(cell, 'hover:brightness-110')).toBe(true);
    }
  });

  it('a valueless (jagged-row) cell gets NO title — nothing to report', () => {
    const { container } = draw('Heatmap', { cells: [[5], [6, 7]] });
    const titles = Array.from(container.querySelectorAll('span[title]')).map((el) => el.getAttribute('title'));
    expect(titles).toEqual(['5', '6', '7']); // 4 cells rendered, only 3 valued
  });
});

/* ── Gantt ───────────────────────────────────────────────────────────────── */

describe('Gantt — task-bar tooltip "label: start→end" + brightness hover', () => {
  it('each task bar carries the full-datum title and the hover affordance', () => {
    const { container } = draw('Gantt', {
      tasks: [
        { label: 'Design', start: 0, end: 4 },
        { label: 'Build', start: 4, end: 9 },
      ],
      rangeMax: 10,
    });
    const design = container.querySelector('[title="Design: 0→4"]');
    const build = container.querySelector('[title="Build: 4→9"]');
    expect(design).not.toBeNull();
    expect(build).not.toBeNull();
    for (const bar of [design!, build!]) {
      expect(has(bar, 'cursor-pointer')).toBe(true);
      expect(has(bar, 'hover:brightness-110')).toBe(true);
    }
  });
});

/* ── ProgressCircle ──────────────────────────────────────────────────────── */

describe('ProgressCircle — SVG <title> on the arc mark + brightness hover', () => {
  it('the arc carries a <title> child "label — value" and cursor-pointer', () => {
    const { container } = draw('ProgressCircle', { value: 62, label: 'Uptime' });
    const title = container.querySelector('svg title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('Uptime — 62%');
    const arc = title!.parentElement!;
    expect(arc.tagName.toLowerCase()).toBe('circle');
    expect(has(arc, 'cursor-pointer')).toBe(true);
    expect(has(arc, 'hover:brightness-110')).toBe(true);
  });

  it('label-less: the domain-appropriate summary is "Progress — <pct>%"', () => {
    const { container } = draw('ProgressCircle', { value: 30 });
    const title = container.querySelector('svg title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('Progress — 30%');
  });
});

/* ── StatGroup ───────────────────────────────────────────────────────────── */

describe('StatGroup — N/A (pure layout wrapper, no data marks of its own)', () => {
  it('adds no hover affordance or tooltip', () => {
    const { container } = draw('StatGroup', {});
    expect(container.querySelector('.cursor-pointer')).toBeNull();
    expect(container.querySelector('[title]')).toBeNull();
  });
});
