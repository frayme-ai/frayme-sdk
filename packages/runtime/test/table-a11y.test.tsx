/**
 * Table semantics + the a11y defects that originate in data-table.tsx /
 * data-display.tsx (accessibility audit, "table" group).
 *
 * THE SCOPE FINDING DID NOT LAND HERE. The audit flagged `<th>` cells with no
 * `scope`, but every `<th>` DataTable, Table and the editor
 * rows emit already carries one — the unscoped cells come from other renderers
 * (permission-matrix.tsx's header row and tournament-bracket.tsx's standings
 * table, neither of which is in this group). What these tests add for scope is
 * therefore a PIN, not a fix: header cells are the one part of a table that
 * carries no visible evidence when the attribute goes missing, so nothing would
 * surface a regression except an audit run weeks later.
 *
 * THE TWO CONTRAST FINDINGS WERE REAL AND ARE FIXED IN THE TOKEN, NOT HERE.
 * ColumnHeader and the Image placeholder are the only two places in these files
 * that put muted-foreground on a muted surface they paint themselves; both
 * measured 4.40:1 while --frayme-muted-fg was #71717a. A local color-mix toward
 * foreground was written and measured first, then reverted: frayme.css moved the
 * token to #52525b (7.03:1 on that band) off its own audit evidence, and
 * keeping the local mix would have left these two components rendering a
 * different muted grey (#494951) from every other muted string in the build.
 *
 * So the contrast tests below are not pinning an edit — they re-measure the
 * RENDERED pairing against the stylesheet, which is what catches this defect
 * whether the next regression comes from the component or from the token.
 *
 * The target-size finding is real and IS fixed in data-display.tsx.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>): Spec =>
  ({ root: 'el', elements: { el: { type, props } }, state: {} }) as unknown as Spec;
const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props)} mode="progressive" />);

/* ── the stylesheet, read as the source of truth for what a token resolves to ── */
// Same fileURLToPath(dirname(...)) shape theme-tokens.test.tsx uses; see the note
// there about the missing @types/node and why import.meta.url alone is not enough.
const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '../src/styles/frayme.css'), 'utf8');

function block(startPattern: RegExp): string {
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
const declMap = (blk: string): Map<string, string> => {
  const m = new Map<string, string>();
  for (const d of blk.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) m.set(d[1], d[2].trim());
  return m;
};
// `.frayme-root` holds BOTH the raw --frayme-* hexes and the --color-* re-points,
// so one map resolves either spelling; the dark media block (the only one a
// viewer on the system default ever reaches) shadows it for dark.
const LIGHT = declMap(block(/^\.frayme-root\s*\{/m));
const DARK = new Map([...LIGHT, ...declMap(block(/@media \(prefers-color-scheme: dark\)/))]);

/** Split on top-level commas — `var(--a, var(--b))` must not split inside its own parens. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/** Resolve a CSS colour expression (var chains + color-mix) to #rrggbb. */
function resolve(expr: string, vars: Map<string, string>, depth = 0): [number, number, number] {
  // Tailwind arbitrary values spell spaces as `_`; nothing here has a real underscore.
  const s = expr.replace(/_/g, ' ').trim();
  if (depth > 12) throw new Error(`var cycle in ${expr}`);
  const hx = s.match(/^#([0-9a-f]{6})$/i);
  if (hx) return [0, 2, 4].map((i) => parseInt(hx[1].slice(i, i + 2), 16)) as [number, number, number];
  if (s.startsWith('var(')) {
    const [name, ...rest] = splitTop(s.slice(4, -1));
    const looked = vars.get(name);
    // An unset var falls through to its own fallback — exactly what the browser does.
    if (looked != null) return resolve(looked, vars, depth + 1);
    if (rest.length) return resolve(rest.join(','), vars, depth + 1);
    throw new Error(`unresolved ${name}`);
  }
  if (s.startsWith('color-mix(')) {
    const parts = splitTop(s.slice(10, -1));
    if (parts[0].replace(/\s+/g, ' ').toLowerCase() !== 'in srgb') throw new Error(`unsupported space: ${parts[0]}`);
    const m = parts[1].match(/^(.*?)\s+([\d.]+)%$/);
    if (!m) throw new Error(`no percentage in ${parts[1]}`);
    const p = Number(m[2]) / 100;
    const a = resolve(m[1], vars, depth + 1);
    const b = resolve(parts[2], vars, depth + 1);
    return a.map((v, i) => Math.round(v * p + b[i] * (1 - p))) as [number, number, number];
  }
  throw new Error(`cannot resolve colour: ${s}`);
}

const luminance = (rgb: [number, number, number]): number => {
  const ch = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const contrast = (fg: string, bg: string, vars: Map<string, string>): number => {
  const [hi, lo] = [luminance(resolve(fg, vars)), luminance(resolve(bg, vars))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Pull an arbitrary `[prop:value]` utility back off a rendered class list, so the
 *  measurement below tracks whatever the component actually paints. */
function arbitrary(cls: string, prop: string): string {
  // The value contains brackets-free but paren-heavy CSS; scan for the balanced `]`.
  const at = cls.indexOf(`[${prop}:`);
  if (at < 0) throw new Error(`no [${prop}:…] in: ${cls}`);
  let depth = 0;
  for (let i = at + prop.length + 2; i < cls.length; i += 1) {
    if (cls[i] === '(') depth += 1;
    else if (cls[i] === ')') depth -= 1;
    else if (cls[i] === ']' && depth === 0) return cls.slice(at + prop.length + 2, i);
  }
  throw new Error(`unbalanced [${prop}:…] in: ${cls}`);
}

const THEMES: [string, Map<string, string>][] = [['light', LIGHT], ['dark', DARK]];

/* ── 1. th scope: the pin ──────────────────────────────────────────────────── */

describe('table semantics — every header cell declares what it heads', () => {
  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'qty', label: 'Qty', align: 'right', sortable: true },
    { key: 'owner', label: 'Owner' },
  ];
  const rows = [
    { name: 'Anchor bolt', qty: 12, owner: 'Rai' },
    { name: 'Gasket', qty: 4, owner: 'Okonkwo' },
  ];

  // Every layout that changes which <th> branch renders: the plain head, the
  // leading checkbox head, the pinned/sticky heads (which swap the background
  // class and so touch the same JSX), and the trailing "Actions" head.
  const shapes: [string, Record<string, unknown>][] = [
    ['plain', { columns, rows }],
    ['selectable', { columns, rows, selectable: true }],
    ['with row actions', { columns, rows, editable: true, deletable: true }],
    ['resizable', { columns, rows, resizable: true }],
    ['pinned first column', { columns, rows, pinnedFirst: true }],
    ['capped / sticky head', { columns, rows, maxHeight: '240px' }],
    ['addable (actions col appears on demand)', { columns, rows, addable: true }],
    ['everything at once', { columns, rows, selectable: true, editable: true, deletable: true, resizable: true, pinnedFirst: true, maxHeight: '240px', addable: true }],
  ];

  it.each(shapes)('DataTable — %s', (_name, props) => {
    const { container } = draw('DataTable', props);
    const th = [...container.querySelectorAll('th')];
    expect(th.length, 'no header cells rendered — the assertion below would be vacuous').toBeGreaterThan(0);
    for (const cell of th) {
      expect(
        cell.getAttribute('scope'),
        `<th>${cell.textContent}</th> has no scope — a screen reader cannot tell whether it heads a row or a column`,
      ).toBe('col');
    }
  });

  it('Table — string grid', () => {
    const { container } = draw('Table', {
      columns: ['Region', 'Q3', 'Q4'],
      rows: [['EMEA', '412', '488'], ['APAC', '291', '355']],
    });
    const th = [...container.querySelectorAll('th')];
    expect(th.length).toBe(3);
    for (const cell of th) expect(cell.getAttribute('scope')).toBe('col');
  });

  it('Table — the DataTable-shaped payload it also accepts', () => {
    const { container } = draw('Table', {
      columns: [{ key: 'region', header: 'Region' }, { key: 'q4', header: 'Q4' }],
      rows: [{ region: 'EMEA', q4: '488' }],
    });
    const th = [...container.querySelectorAll('th')];
    expect(th.length).toBe(2);
    for (const cell of th) expect(cell.getAttribute('scope')).toBe('col');
  });

  // Neither of these renders a row-header cell: the first column of a generative
  // table is an ordinary data field, and which field (if any) names the row is not
  // knowable from an untrusted spec. Guessing one and marking it scope="row" would
  // announce "Anchor bolt" as the heading for its own quantity. Pin the absence so
  // a later scope="row" has to be a deliberate, spec-driven decision.
  it('no <th> is emitted inside tbody — a data row has no assumed row header', () => {
    const { container } = draw('DataTable', { columns, rows, selectable: true, editable: true });
    expect(container.querySelectorAll('tbody th').length).toBe(0);
  });
});

/* ── 2. contrast, measured ─────────────────────────────────────────────────── */

describe('contrast — text these components paint on backgrounds they also paint', () => {
  it('ColumnHeader band is RELATIVE to its surface, not a pinned token', () => {
    // CHANGED, and the numeric check MOVED rather than vanished.
    //
    // The band used to fall back to the global --color-muted (#f4f4f5, a LIGHT
    // value) whatever it sat on, so a table on a navy page rendered a white strip
    // across its own header — visible by eye. It now shades
    // --fr-surface (.fr-band in frayme.css), which no class string can express as
    // a resolvable colour: the surface is only known at render.
    //
    // So this asserts the MECHANISM, and the 4.5:1 number is now measured by
    // the a11y gate against the surface ACTUALLY PAINTED. That is strictly
    // better than what it replaces: this only ever checked the DEFAULT surface,
    // and the default surface was never the case that broke.
    const { container } = draw('ColumnHeader', { label: 'Region', sortable: true });
    const head = container.querySelector('[role="columnheader"]')!;
    expect(head.className, 'band rides the surface-relative class').toContain('fr-band');
    expect(head.className, 'no pinned muted fallback').not.toContain('var(--color-muted))]');
  });

  it.each(THEMES)('Image placeholder alt text clears 4.5:1 on its bg-muted reserve (%s)', (_theme, vars) => {
    // An empty src takes SafeImage's fallback branch — the placeholder under test.
    const { container } = draw('Image', { src: '', alt: 'Sunset over the harbour' });
    const ph = container.querySelector('[role="img"]');
    expect(ph).toBeTruthy();
    const cls = ph!.className;
    expect(cls, 'the placeholder no longer paints its own surface').toContain('bg-muted');
    // 13px text: nowhere near the >=18.66px+bold large-text 3:1 exemption.
    const r = contrast(arbitrary(cls, 'color'), 'var(--color-muted)', vars);
    expect(r, `placeholder alt text ${r.toFixed(2)}:1 on bg-muted`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)('an authored mutedColor still lands byte-exact, un-mixed (%s)', (_theme, vars) => {
    // The value channel must reach the label untouched. This is the assertion the
    // reverted local color-mix had to satisfy too (it lived in the var FALLBACK
    // for exactly this reason), and it is what a future re-patch would have to
    // keep satisfying — a mix wrapped around the whole var would silently
    // re-tint every branded header.
    const { container } = draw('ColumnHeader', { label: 'Region', mutedColor: '#0000ff' });
    const head = container.querySelector('[role="columnheader"]') as HTMLElement;
    expect(head.getAttribute('style')).toContain('#0000ff');
    // The utility is now `[--fr-band-ink:…]`, not `[color:…]`. `.fr-band` sets
    // `color: inherit` at (0,2,0) and out-ranked a (0,1,0) colour utility, so this
    // chain was computed and then thrown away — the header inherited the table's ink
    // instead, measured at 2.64:1 on an authored #1d4ed8 fill. The var is read INSIDE
    // .fr-band, so the same value now actually reaches the label. The invariant this
    // test exists for is unchanged: the authored value arrives byte-exact, un-mixed.
    const withAuthored = new Map([...vars, ['--fr-ch-muted', '#0000ff']]);
    expect(resolve(arbitrary(head.className, '--fr-band-ink'), withAuthored)).toEqual([0, 0, 255]);
  });

  // DataTable's headRecipe carries the same two token classes as ColumnHeader but
  // never renders that pair — it was measured, not assumed, and left alone. Pin
  // the reason: whatever paints the head must resolve to the CARD surface (via
  // headOpaqueBg) or hand the surface through with `background: inherit`.
  it('DataTable head never paints muted-on-muted', () => {
    const { container } = draw('DataTable', {
      columns: [{ key: 'a', label: 'Name' }],
      rows: [{ a: 'x' }],
      maxHeight: '240px', // capped => the scrolled-under head, which must be opaque
    });
    const th = container.querySelector('th') as HTMLElement;
    // tailwind-merge keeps the LAST background utility; headOpaqueBg's card
    // fallback has to be the survivor, not headRecipe's muted one.
    expect(arbitrary(th.className, 'background')).toBe('var(--fr-dt-header,var(--color-card))');
  });
});

/* ── 3. target size ────────────────────────────────────────────────────────── */

describe('target size — WCAG 2.5.8 (24x24)', () => {
  it('the Alert dismiss button carries a 24px floor in both axes', () => {
    const { container } = draw('Alert', { title: 'Payment failed', message: 'Card declined.', dismissible: true });
    const btn = container.querySelector('button[aria-label="Dismiss"]') as HTMLElement;
    expect(btn).toBeTruthy();
    const cls = btn.className.split(/\s+/);
    // A padding-less `text-lg leading-none` button is exactly its glyph — ~11x18px
    // for the default ×. jsdom has no layout, so the floor is asserted on the
    // classes that create it.
    expect(cls, 'no height floor — the box is whatever the glyph happens to be').toContain('min-h-6');
    expect(cls, 'no width floor — a narrow glyph gives a narrow target').toContain('min-w-6');
    // A FIXED h-6/w-6 would cap the box instead of flooring it: a longer
    // dismissLabel or a bigger glyph has to still be able to grow it.
    expect(cls).not.toContain('h-6');
    expect(cls).not.toContain('w-6');
    // The floor only means anything if the box is a flex box that can centre in it.
    expect(cls).toContain('inline-flex');
  });

  it('both table checkboxes keep their 24px label target', () => {
    const { container } = draw('DataTable', {
      columns: [{ key: 'a', label: 'Name' }],
      rows: [{ a: 'x' }, { a: 'y' }],
      selectable: true,
    });
    const labels = [...container.querySelectorAll('label')];
    // one select-all in the head + one per row
    expect(labels.length).toBe(3);
    for (const l of labels) {
      const cls = l.className.split(/\s+/);
      // The 16px input is not the target; the label that wraps it is.
      expect(cls).toContain('min-h-6');
      expect(cls).toContain('min-w-6');
    }
  });

  it('both sort buttons keep their 32px height floor, not a fixed height', () => {
    const dt = draw('DataTable', { columns: [{ key: 'a', label: 'Name', sortable: true }], rows: [{ a: 'x' }] });
    const ch = draw('ColumnHeader', { label: 'Region', sortable: true });
    for (const { container } of [dt, ch]) {
      const btn = container.querySelector('button') as HTMLElement;
      const cls = btn.className.split(/\s+/);
      expect(cls).toContain('min-h-8');
      expect(cls).not.toContain('h-8');
    }
  });
});
