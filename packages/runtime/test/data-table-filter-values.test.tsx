/**
 * DataTable `filterValues` — per-column exact-match local filters (the
 * screener/registry idiom: picklists + search over the same table, all local).
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const ROWS = [
  { ticker: 'NVDA', sector: 'Technology', year: 2024 },
  { ticker: 'JPM', sector: 'Financials', year: 2024 },
  { ticker: 'MSFT', sector: 'Technology', year: 2025 },
  { ticker: 'XOM', sector: 'Energy', year: 2025 },
];
const COLS = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'sector', label: 'Sector' },
  { key: 'year', label: 'Year' },
];

const draw = (props: Record<string, unknown>, state: Record<string, unknown> = {}) =>
  render(
    <FraymeRenderer
      spec={{ root: 'el', elements: { el: { type: 'DataTable', props } }, state } as unknown as Spec}
      mode="progressive"
    />,
  );

const bodyTickers = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('tbody tr')]
    .map((tr) => tr.querySelector('td')?.textContent?.trim() ?? '')
    .filter((t) => t && t !== 'No rows'); // tolerate an empty-state row

describe('DataTable filterValues', () => {
  it('filters rows by exact column value', () => {
    const { container } = draw({ columns: COLS, rows: ROWS, filterValues: { sector: 'Technology' } });
    expect(bodyTickers(container)).toEqual(['NVDA', 'MSFT']);
  });

  it('ANDs across keys and stringifies numbers', () => {
    const { container } = draw({ columns: COLS, rows: ROWS, filterValues: { sector: 'Technology', year: '2025' } });
    expect(bodyTickers(container)).toEqual(['MSFT']);
  });

  it('ignores empty/cleared entries (cleared Select = no filter)', () => {
    const { container } = draw({ columns: COLS, rows: ROWS, filterValues: { sector: '', year: null } });
    expect(bodyTickers(container)).toEqual(['NVDA', 'JPM', 'MSFT', 'XOM']);
  });

  it('resolves $state-bound entries against spec state (the picklist idiom)', () => {
    const { container } = draw(
      { columns: COLS, rows: ROWS, filterValues: { sector: { $state: '/sector' } } },
      { sector: 'Energy' },
    );
    expect(bodyTickers(container)).toEqual(['XOM']);
  });

  it('composes with filterText (value filter first, then substring)', () => {
    const { container } = draw({
      columns: COLS,
      rows: ROWS,
      filterValues: { year: 2024 },
      filterText: 'nv',
    });
    expect(bodyTickers(container)).toEqual(['NVDA']);
  });

  it('absent prop renders byte-identical to explicit null', () => {
    const a = draw({ columns: COLS, rows: ROWS }).container.innerHTML;
    const b = draw({ columns: COLS, rows: ROWS, filterValues: null }).container.innerHTML;
    expect(b).toBe(a);
  });
});

const DATED = [
  { ticker: 'A', date: '2026-06-19', kwh: 13.2 },
  { ticker: 'B', date: '2026-06-24', kwh: 30.8 },
  { ticker: 'C', date: '2026-07-08', kwh: 22.8 },
  { ticker: 'D', date: '2026-07-19', kwh: 11.8 },
];
const DATED_COLS = [
  { key: 'ticker', label: 'T' },
  { key: 'kwh', label: 'kWh' },
]; // note: `date` is a non-displayed row field

describe('DataTable filterRange', () => {
  it('bounds ISO dates chronologically on a non-displayed key', () => {
    const { container } = draw({
      columns: DATED_COLS,
      rows: DATED,
      filterRange: { key: 'date', min: '2026-06-20', max: '2026-07-10' },
    });
    expect(bodyTickers(container)).toEqual(['B', 'C']);
  });

  it('open-ended bounds and $state binding (the DateRangePicker idiom)', () => {
    const { container } = draw(
      { columns: DATED_COLS, rows: DATED, filterRange: { key: 'date', min: { $state: '/from' }, max: '' } },
      { from: '2026-07-01' },
    );
    expect(bodyTickers(container)).toEqual(['C', 'D']);
  });

  it('compares numerically when values are numbers', () => {
    const { container } = draw({
      columns: DATED_COLS,
      rows: DATED,
      filterRange: { key: 'kwh', min: 12, max: 25 },
    });
    expect(bodyTickers(container)).toEqual(['A', 'C']);
  });

  it('absent/empty range is identity', () => {
    const a = draw({ columns: DATED_COLS, rows: DATED }).container.innerHTML;
    const b = draw({ columns: DATED_COLS, rows: DATED, filterRange: { key: 'date', min: '', max: null } }).container.innerHTML;
    expect(b).toBe(a);
  });
});
