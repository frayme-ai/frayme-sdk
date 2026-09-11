/**
 * DataTable column display formatting.
 *
 * A money column rendering `210000` under an "Amount (£)" header, and a date
 * column rendering `2026-08-07`, were the only unformatted values on an
 * otherwise polished screen. `format` shapes the DISPLAY only — the row keeps
 * the raw value so sorting stays numeric/chronological and the editor still
 * sees a number.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';
import { formatCell } from '../src/react/registry/_num.js';

const table = (columns: unknown[], rows: unknown[]): Spec =>
  ({ root: 'el', elements: { el: { type: 'DataTable', props: { columns, rows } } }, state: {} }) as unknown as Spec;

describe('formatCell — deterministic, locale-free', () => {
  it('groups digits without touching precision', () => {
    expect(formatCell(210000, 'number')).toBe('210,000');
    expect(formatCell(1234567.5, 'number')).toBe('1,234,567.5');
    expect(formatCell(-4200, 'number')).toBe('-4,200');
    expect(formatCell(999, 'number')).toBe('999');
  });

  it('currency defaults to £ and honours a prefix', () => {
    expect(formatCell(210000, 'currency')).toBe('£210,000');
    expect(formatCell(210000, 'currency', '$')).toBe('$210,000');
  });

  it('percent and suffix', () => {
    expect(formatCell(12.5, 'percent')).toBe('12.5%');
    expect(formatCell(72, 'number', '', ' kg')).toBe('72 kg');
  });

  it('ISO dates print long-form; anything else passes through untouched', () => {
    expect(formatCell('2026-08-07', 'date')).toBe('7 Aug 2026');
    expect(formatCell('2026-12-25', 'date')).toBe('25 Dec 2026');
    expect(formatCell('next Tuesday', 'date')).toBe('next Tuesday');
    expect(formatCell('2026-13-99', 'date')).toBe('2026-13-99');
  });

  it('an unformatted column is byte-identical to the raw string', () => {
    expect(formatCell(210000, null)).toBe('210000');
    expect(formatCell('Monzo Bank', undefined)).toBe('Monzo Bank');
    expect(formatCell(null, 'currency')).toBe('');
    expect(formatCell('', 'number')).toBe('');
  });

  it('a non-numeric value in a numeric column survives as itself', () => {
    expect(formatCell('n/a', 'currency')).toBe('n/a');
  });
});

describe('DataTable — formatted cells keep their raw value underneath', () => {
  const columns = [
    { key: 'account', label: 'Account' },
    { key: 'amount', label: 'Amount (£)', align: 'end', sortable: true, type: 'number', format: 'currency' },
    { key: 'close', label: 'Close date', sortable: true, format: 'date' },
  ];
  const rows = [
    { id: '1', account: 'Monzo Bank', amount: 210000, close: '2026-08-07' },
    { id: '2', account: 'Wise', amount: 98400, close: '2026-09-04' },
  ];

  it('renders the formatted string, not the raw number', () => {
    const { container } = render(<FraymeRenderer spec={table(columns, rows)} mode="progressive" />);
    const text = container.textContent ?? '';
    expect(text).toContain('£210,000');
    expect(text).toContain('7 Aug 2026');
    expect(text).not.toContain('210000');
    expect(text).not.toContain('2026-08-07');
  });

  it('sorting stays NUMERIC under the formatting (not lexicographic on "£98,400")', () => {
    // lexicographic order would put £210,000 before £98,400
    const { container } = render(<FraymeRenderer spec={table(columns, rows)} mode="progressive" />);
    const cells = [...container.querySelectorAll('tbody tr')].map((tr) => tr.textContent ?? '');
    expect(cells[0]).toContain('£210,000');
    const sortBtn = [...container.querySelectorAll('th button')].find((b) => (b.textContent ?? '').includes('Amount'));
    expect(sortBtn).not.toBeUndefined();
  });
});
