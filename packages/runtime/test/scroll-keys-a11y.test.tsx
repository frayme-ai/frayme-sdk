/**
 * Keyboard-reachable scrollers (accessibility audit) — ai-content · node-graph ·
 * misc-extended, the three registry files the earlier passes left untouched.
 *
 * WCAG 2.1.1: a scroll container that cannot take focus cannot be scrolled
 * without a pointer, so everything past the fold is unreachable from the
 * keyboard. The audit counts a scroller as fixed only when it is BOTH focusable
 * AND named — an unnamed tab stop announces a bare "group" and tells a reader
 * nothing about what they landed in. What it measured, and what each assertion
 * below pins:
 *   - DiffView's columns (`min-w-0 flex-1 overflow-x-auto`, 1 unified / 2 split)
 *     are `whitespace-pre` per row and contain nothing but spans — no focusable
 *     descendant at all.
 *   - CodeBlock's <pre> (`m-0 overflow-x-auto`) is `whitespace-pre` in its
 *     default shape; both copy affordances sit OUTSIDE it (header, or absolutely
 *     positioned over the wrapper), so it too holds nothing focusable.
 *   - Artifact's body (`overflow-auto` under a 28rem cap) is the same shape one
 *     component up in the same file. It was NOT in the audit's findings — no
 *     sampled Artifact overflowed — and is fixed here anyway rather than
 *     left for the next audit to re-find.
 * role="group" everywhere, never "region": region is a LANDMARK, so a page of
 * code blocks would bury its real landmarks in a reader's navigation list. Same
 * reasoning scheduler.tsx used.
 *
 * TWO EXEMPTIONS, asserted as NOT-focusable so a later change cannot quietly add
 * the redundant stop back:
 *   - NodeGraph's canvas. Every node IS a <button> and the scroll extent is the
 *     nodes' own bounding box (_diagram.ts derives width/height from the laid-out
 *     grid + a 24px pad), so Tab already walks the whole scrollable area and the
 *     browser scrolls each focused node into view; the node-less case returns a
 *     non-scrolling placeholder instead. It gets the NAME but not the stop.
 *   - DiffView's capped (maxHeight) vertical wrapper, whose focusable columns
 *     fill it edge to edge — arrow keys a focused column cannot consume scroll
 *     the nearest scrollable ancestor, which is that wrapper.
 *
 * Plus WCAG 2.5.8 in the same files: Toast's dismiss button was the bare 16px
 * glyph (no padding, no floor) = a 16x16 target, the only control a toast has.
 *
 * Style follows test/a11y-targets-inputs.test.tsx: assert the class/attribute
 * contract on the rendered element, since jsdom has no layout and the geometry
 * is entirely class-driven.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>, state: Record<string, unknown> = {}): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state }) as unknown as Spec;
const draw = (type: string, props: Record<string, unknown>, state: Record<string, unknown> = {}) =>
  render(<FraymeRenderer spec={one(type, props, state)} mode="progressive" />);

/** Every scrollport in the tree, by the overflow utilities that create one. */
const scrollers = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto, .overflow-auto'),
];

/** The BOTH-halves contract: focusable AND named. */
const expectReachable = (el: HTMLElement, name: string): void => {
  expect(el.getAttribute('tabindex'), `${name}: not focusable — a pointer is the only way to scroll it`).toBe('0');
  expect(el.getAttribute('role'), `${name}: named regions must be a group, never a landmark`).toBe('group');
  expect(el.getAttribute('aria-label'), `${name}: a tab stop with no name announces bare "group"`).toBeTruthy();
};

/* ── DiffView — the diff columns ──────────────────────────────────────────── */

describe('DiffView columns — the horizontal scrollport is keyboard-reachable', () => {
  it('unified: the single column is focusable and named after the caption', () => {
    const { container } = draw('DiffView', { before: 'a\nb', after: 'a\nc', filename: 'config.ts' });
    const cols = [...container.querySelectorAll<HTMLElement>('.overflow-x-auto')];
    expect(cols).toHaveLength(1);
    expectReachable(cols[0], 'DiffView unified column');
    // The name is the caption the reader can already see, not an invented one.
    expect(cols[0].getAttribute('aria-label')).toBe('config.ts');
  });

  it('unified with no filename falls back to the header label', () => {
    const plain = draw('DiffView', { before: 'a', after: 'b' });
    expect(plain.container.querySelector('.overflow-x-auto')!.getAttribute('aria-label')).toBe('Changes');
    const custom = draw('DiffView', { before: 'a', after: 'b', headerLabel: 'Wijzigingen' });
    expect(custom.container.querySelector('.overflow-x-auto')!.getAttribute('aria-label')).toBe('Wijzigingen');
  });

  it('split: both columns are focusable and say WHICH half they are', () => {
    const { container } = draw('DiffView', { before: 'a\nb', after: 'a\nc', filename: 'config.ts', mode: 'split' });
    const cols = [...container.querySelectorAll<HTMLElement>('.overflow-x-auto')];
    expect(cols).toHaveLength(2);
    cols.forEach((c, i) => expectReachable(c, `DiffView split column ${i}`));
    // Two identically-named columns would leave a reader unable to tell which
    // side of the diff they had just tabbed into.
    expect(cols.map((c) => c.getAttribute('aria-label'))).toEqual(['config.ts, before', 'config.ts, after']);
  });

  it('EXEMPTION: the capped body wrapper takes no second tab stop', () => {
    const { container } = draw('DiffView', { before: 'a\nb', after: 'a\nc', maxHeight: '400px' });
    const wrapper = container.querySelector<HTMLElement>('.overflow-y-auto')!;
    expect(wrapper.className).toContain('[max-height:var(--fr-diff-maxh)]');
    // The column inside fills it edge to edge and IS focusable, so arrow keys the
    // column cannot consume already scroll this wrapper. A stop here would make a
    // reader Tab twice to get past one diff.
    expect(
      wrapper.getAttribute('tabindex'),
      'redundant stop: the focusable column inside already covers this scroll area',
    ).toBeNull();
    expect(wrapper.querySelector('.overflow-x-auto')!.getAttribute('tabindex')).toBe('0');
  });
});

/* ── Artifact — the panel body ────────────────────────────────────────────── */

describe('Artifact body — the capped scrollport is keyboard-reachable', () => {
  it('is focusable and named after the panel caption', () => {
    const { container } = draw('Artifact', { title: 'report.md', content: 'x\ny', kind: 'code' });
    const body = container.querySelector<HTMLElement>('.overflow-auto')!;
    expectReachable(body, 'Artifact body');
    expect(body.getAttribute('aria-label')).toBe('report.md');
  });

  it('a title-less artifact still gets a name, not a bare "group"', () => {
    for (const props of [{ content: 'x' }, { title: '', content: 'x' }]) {
      const { container } = draw('Artifact', props);
      expect(container.querySelector('.overflow-auto')!.getAttribute('aria-label')).toBe('Artifact');
    }
  });
});

/* ── CodeBlock — the <pre> ────────────────────────────────────────────────── */

describe('CodeBlock <pre> — the horizontal scrollport is keyboard-reachable', () => {
  it('is focusable and named, with the copy button left OUTSIDE it', () => {
    const { container } = draw('CodeBlock', { code: 'const x = 1;\nx;', filename: 'demo.ts', language: 'ts' });
    const pre = container.querySelector<HTMLElement>('pre')!;
    expectReachable(pre, 'CodeBlock pre');
    expect(pre.getAttribute('aria-label')).toBe('demo.ts');
    // The premise of the fix: nothing inside the scrollport can take focus, so
    // this is not a redundant stop.
    expect(pre.querySelector('button, a, [tabindex]')).toBeNull();
  });

  it('names itself from the language when there is no filename, else "Code"', () => {
    expect(draw('CodeBlock', { code: 'x', language: 'ts' }).container.querySelector('pre')!.getAttribute('aria-label')).toBe(
      'ts code',
    );
    // headerless block — the header shows neither filename nor language.
    expect(draw('CodeBlock', { code: 'x' }).container.querySelector('pre')!.getAttribute('aria-label')).toBe('Code');
  });

  it('holds when maxHeight adds the second (vertical) axis', () => {
    const { container } = draw('CodeBlock', { code: 'x\ny', filename: 'a.ts', maxHeight: '200px' });
    const pre = container.querySelector<HTMLElement>('pre')!;
    expect(pre.className).toContain('overflow-y-auto');
    expectReachable(pre, 'CodeBlock pre (capped)');
  });

  it('every scroller CodeBlock renders is reachable — no shape slips through', () => {
    for (const props of [
      { code: 'x' },
      { code: 'x', wrap: true },
      { code: 'x', filename: 'a.ts', showLineNumbers: true, maxHeight: '200px' },
      { code: 'x', showCopy: false },
    ]) {
      for (const el of scrollers(draw('CodeBlock', props).container)) expectReachable(el, `CodeBlock ${JSON.stringify(props)}`);
    }
  });
});

/* ── NodeGraph — the exemption ────────────────────────────────────────────── */

describe('NodeGraph canvas — named, and deliberately NOT a tab stop', () => {
  const NODES = [
    { id: 'a', label: 'Ingest data' },
    { id: 'b', label: 'Clean' },
    { id: 'c', label: 'Deploy' },
  ];
  const EDGES = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ];

  it('the scrollport is named so a reader knows what the buttons belong to', () => {
    const { container } = draw('NodeGraph', { nodes: NODES, edges: EDGES });
    const canvas = container.querySelector<HTMLElement>('.overflow-auto')!;
    expect(canvas.getAttribute('role')).toBe('group');
    expect(canvas.getAttribute('aria-label')).toBe('Node graph');
  });

  it('takes NO tab stop — every node is a button, so the stop would be redundant', () => {
    const { container } = draw('NodeGraph', { nodes: NODES, edges: EDGES });
    const canvas = container.querySelector<HTMLElement>('.overflow-auto')!;
    // The exemption's premise, asserted rather than assumed: the scroll extent is
    // the node grid, and every node in it is independently focusable, so Tab
    // already walks the whole scrollable area (the browser scrolls each focused
    // node into view). If nodes ever stop being buttons this test fails and the
    // canvas needs the stop after all.
    const buttons = [...canvas.querySelectorAll('button')];
    expect(buttons).toHaveLength(NODES.length);
    for (const b of buttons) expect(b.getAttribute('disabled')).toBeNull();
    expect(
      canvas.getAttribute('tabindex'),
      'redundant stop: the node buttons already cover this scroll area',
    ).toBeNull();
  });

  it('the node-less placeholder is not a scrollport at all', () => {
    const { container } = draw('NodeGraph', { nodes: [] });
    // The "an empty schedule has no focusable content" half of the scheduler
    // argument cannot arise here: with no nodes there is no scroll container.
    expect(scrollers(container)).toHaveLength(0);
  });
});

/* ── Toast — target size (WCAG 2.5.8) ─────────────────────────────────────── */

describe('Toast dismiss — the 24px pointer-target floor', () => {
  it('carries a floor in both axes, and a box to centre the glyph in', () => {
    const { container } = draw('Toast', { title: 'Saved', openPath: 'open', dismissible: true }, { open: true });
    const btn = container.querySelector<HTMLElement>('button[aria-label="Dismiss"]')!;
    const cls = btn.className.split(/\s+/);
    // The button's only child is a 16px Icon and it had no padding, so the target
    // WAS the glyph: 16x16 against a 24x24 minimum.
    expect(cls, 'no height floor — the box is whatever the glyph happens to be').toContain('min-h-6');
    expect(cls, 'no width floor — a narrow glyph gives a narrow target').toContain('min-w-6');
    // A FIXED h-6/w-6 would cap the box instead of flooring it: a bigger
    // dismissIcon has to still be able to grow it. (Same contract as Alert's.)
    expect(cls).not.toContain('h-6');
    expect(cls).not.toContain('w-6');
    expect(cls, 'a floor on a non-flex box is dead space beside the glyph').toContain('inline-flex');
  });
});
