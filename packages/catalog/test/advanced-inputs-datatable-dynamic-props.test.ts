import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/validate/index.js';

/**
 * Advanced inputs + DataTable — dynamic-prop surface.
 *
 * Each component gets a RICH spec exercising its value channels (accent / bg /
 * borderColor / trackColor / color / headerColor + the menuWidth / maxHeight /
 * width dimension channels) plus its content arrays. All must pass
 * `validateSpec(spec, { resolution: true })`. Adversarial fixtures (unsafe
 * dimension/color, var(), injection — incl. a NESTED per-column width) must be
 * REJECTED with `failureCategory === 'unsafe_value'`.
 */
const wrap = (id: string, el: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  root: 'root',
  state: {},
  elements: { root: { type: 'Stack', props: { gap: 'md' }, children: [id] }, [id]: el, ...extra },
});

const RICH: Array<{ name: string; spec: unknown }> = [
  { name: 'MultiSelect — accent/border/bg + menuWidth', spec: wrap('msl', { type: 'MultiSelect', props: { options: [{ label: 'AI', value: 'ai' }, { label: 'Design', value: 'design' }], value: ['ai'], placeholder: 'Pick tags', max: 5, size: 'md', searchable: true, chips: true, accent: '#7c3aed', borderColor: '#cbd5e1', bg: '#ffffff', menuWidth: '20rem' } }) },
  { name: 'Combobox — accent/border/bg + menuWidth/maxHeight', spec: wrap('cbx', { type: 'Combobox', props: { options: [{ label: 'United Kingdom', value: 'uk' }, { label: 'United States', value: 'us' }], value: 'uk', placeholder: 'Search a country…', creatable: true, loading: false, size: 'md', accent: '#6366f1', borderColor: '#cbd5e1', bg: '#ffffff', menuWidth: '18rem', maxHeight: '16rem' } }) },
  { name: 'TagInput — accent/border/bg', spec: wrap('tgi', { type: 'TagInput', props: { value: ['design', 'ai'], suggestions: ['react', 'ml'], max: 8, placeholder: 'Add a tag…', size: 'md', removable: true, accent: '#7c3aed', borderColor: '#cbd5e1', bg: '#ffffff' } }) },
  { name: 'SegmentedControl — accent/accentText', spec: wrap('sgc', { type: 'SegmentedControl', props: { options: [{ label: 'Day', value: 'day', icon: 'calendar' }, { label: 'Week', value: 'week' }, { label: 'Month', value: 'month' }], value: 'week', size: 'md', fullWidth: true, accent: '#0f172a', accentText: '#ffffff' } }) },
  { name: 'NumberInput — accent/border/bg', spec: wrap('nmi', { type: 'NumberInput', props: { value: 3, min: 0, max: 10, step: 1, prefix: '£', suffix: 'kg', size: 'md', accent: '#6366f1', borderColor: '#cbd5e1', bg: '#ffffff' } }) },
  { name: 'RangeSlider — accent + trackColor + histogram', spec: wrap('rsl', { type: 'RangeSlider', props: { min: 0, max: 1000, step: 10, valueMin: 200, valueMax: 800, showHistogram: true, histogram: [3, 8, 5, 9, 4, 6], marks: true, size: 'md', accent: '#7c3aed', trackColor: '#e2e8f0' } }) },
  { name: 'Rating — color + accent', spec: wrap('rtg', { type: 'Rating', props: { value: 4, max: 5, icon: 'star', allowHalf: true, readOnly: false, size: 'md', color: '#f59e0b', accent: '#f97316' } }) },
  { name: 'OTPInput — accent/border/bg', spec: wrap('otp', { type: 'OTPInput', props: { length: 6, value: '123', mask: false, pattern: 'numeric', size: 'md', accent: '#6366f1', borderColor: '#cbd5e1', bg: '#ffffff' } }) },
  { name: 'DatePicker — accent/border/bg', spec: wrap('dpk', { type: 'DatePicker', props: { value: '2026-06-25', placeholder: 'Pick a date', min: '2026-01-01', max: '2026-12-31', size: 'md', format: 'long', accent: '#7c3aed', borderColor: '#cbd5e1', bg: '#ffffff' } }) },
  { name: 'DateRangePicker — accent/border/bg + presets', spec: wrap('drp', { type: 'DateRangePicker', props: { startValue: '2026-06-19', endValue: '2026-06-25', presets: [{ label: 'Last 7 days', start: '2026-06-19', end: '2026-06-25' }], min: '2026-01-01', max: '2026-12-31', size: 'md', accent: '#7c3aed', borderColor: '#cbd5e1', bg: '#ffffff' } }) },
  { name: 'Calendar — accent + events', spec: wrap('cal', { type: 'Calendar', props: { month: '2026-06', value: '2026-06-25', events: [{ date: '2026-06-25', label: 'Launch', tone: 'success' }, { date: '2026-06-10', label: 'Review', tone: 'warning' }], view: 'month', selectable: true, weekStartsOn: 'monday', accent: '#7c3aed', size: 'md' } }) },
  { name: 'DataTable — accent/headerColor + maxHeight + column width', spec: wrap('dtb', { type: 'DataTable', props: { columns: [{ key: 'name', label: 'Name', align: 'start', sortable: true, width: '12rem' }, { key: 'rev', label: 'Revenue', align: 'end', sortable: true }], rows: [{ name: 'Acme', rev: '£24k' }, { name: 'Globex', rev: '£12k' }], selectable: true, sortBy: 'rev', sortDir: 'desc', page: 1, pageSize: 10, striped: true, bordered: true, hoverable: true, density: 'normal', size: 'md', accent: '#7c3aed', headerColor: '#f1f5f9', maxHeight: '24rem' } }) },
  { name: 'ColumnHeader — accent/headerColor + width', spec: wrap('cht', { type: 'ColumnHeader', props: { label: 'Revenue', align: 'end', sortable: true, sortDir: 'desc', resizable: true, width: '12rem', accent: '#7c3aed', headerColor: '#f1f5f9' } }) },
  { name: 'FileUpload — accent/border/bg + files', spec: wrap('fup', { type: 'FileUpload', props: { accept: 'image/*,.pdf', multiple: true, maxSize: '10MB', label: 'Drag & drop or click to upload', hint: 'Up to 5 files', icon: 'upload', files: [{ name: 'logo.png', size: '2.4MB', status: 'done' }, { name: 'spec.pdf', size: '512KB', status: 'uploading' }], size: 'md', accent: '#7c3aed', borderColor: '#cbd5e1', bg: '#f8fafc' } }) },
  { name: 'CommandPalette — accent/bg/border + menuWidth/maxHeight', spec: wrap('cmd', { type: 'CommandPalette', props: { placeholder: 'Type a command…', groups: [{ heading: 'Actions', items: [{ label: 'New file', icon: 'plus', shortcut: '⌘N', value: 'new' }, { label: 'Search', icon: 'search', value: 'search' }] }], value: '', emptyText: 'No results', accent: '#6366f1', bg: '#ffffff', borderColor: '#cbd5e1', menuWidth: '32rem', maxHeight: '20rem' } }) },
];

describe('Advanced-inputs + DataTable dynamic props — rich specs validate with resolution ON', () => {
  it.each(RICH)('$name', ({ spec }) => {
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });

  it('covers all 15 Group-2b components', () => {
    const types = new Set<string>();
    for (const { spec } of RICH) for (const el of Object.values((spec as { elements: Record<string, { type: string }> }).elements)) types.add(el.type);
    for (const name of [
      'MultiSelect', 'Combobox', 'TagInput', 'SegmentedControl',
      'NumberInput', 'RangeSlider', 'Rating', 'OTPInput',
      'DatePicker', 'DateRangePicker', 'Calendar',
      'DataTable', 'ColumnHeader',
      'FileUpload', 'CommandPalette',
    ]) {
      expect(types.has(name), `${name} not exercised`).toBe(true);
    }
  });
});

describe('Advanced-inputs + DataTable dynamic props — adversarial value channels rejected', () => {
  const ADV: Array<{ name: string; spec: unknown }> = [
    { name: 'unsafe accent on MultiSelect', spec: wrap('msl', { type: 'MultiSelect', props: { options: [{ label: 'A', value: 'a' }], accent: 'red;}body{' } }) },
    { name: 'var() bg on Combobox', spec: wrap('cbx', { type: 'Combobox', props: { options: [{ label: 'A', value: 'a' }], bg: 'var(--evil)' } }) },
    { name: 'calc() menuWidth on Combobox', spec: wrap('cbx', { type: 'Combobox', props: { options: [{ label: 'A', value: 'a' }], menuWidth: 'calc(100% - 10px)' } }) },
    { name: 'unsafe color on Rating', spec: wrap('rtg', { type: 'Rating', props: { value: 3, color: 'red;background:url(//x)' } }) },
    { name: 'unsafe trackColor on RangeSlider', spec: wrap('rsl', { type: 'RangeSlider', props: { valueMin: 1, valueMax: 5, trackColor: '#fff;}<x>' } }) },
    { name: 'unsafe headerColor on DataTable', spec: wrap('dtb', { type: 'DataTable', props: { columns: [{ key: 'a', label: 'A' }], rows: [{ a: '1' }], headerColor: 'expression(alert(1))' } }) },
    { name: 'unsafe maxHeight on DataTable', spec: wrap('dtb', { type: 'DataTable', props: { columns: [{ key: 'a', label: 'A' }], rows: [{ a: '1' }], maxHeight: '20px;}x{' } }) },
    { name: 'unsafe NESTED column width on DataTable (recursed gate)', spec: wrap('dtb', { type: 'DataTable', props: { columns: [{ key: 'a', label: 'A', width: 'calc(100% - 1px)' }], rows: [{ a: '1' }] } }) },
    { name: 'unsafe accent on CommandPalette', spec: wrap('cmd', { type: 'CommandPalette', props: { groups: [{ items: [{ label: 'x', value: 'x' }] }], accent: 'red;}body{' } }) },
    { name: 'unsafe bg on FileUpload', spec: wrap('fup', { type: 'FileUpload', props: { accent: 'var(--evil)' } }) },
  ];
  it.each(ADV)('rejects: $name', ({ spec }) => {
    expect(validateSpec(spec).valid).toBe(true);
    const g = validateSpec(spec, { resolution: true });
    expect(g.valid).toBe(false);
    expect(g.failureCategory).toBe('unsafe_value');
  });
});
