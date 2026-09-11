import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/validate/index.js';

/**
 * Long-tail components — dynamic-prop surface.
 *
 * Each component gets a RICH spec exercising its value channels (the chart
 * height + per-datum/series/node/slice/threshold `color`, the input/overlay
 * `accent`, `trackColor`, `overlayColor`, `headerColor`, per-column `width`, the
 * swatch-grid `columns` count). All must pass `validateSpec(spec, { resolution:
 * true })`. Adversarial fixtures (unsafe color / dim, var()/calc()/url()/
 * injection — incl. NESTED slice / threshold / swatch / column-width values) must
 * be REJECTED with `failureCategory === 'unsafe_value'`.
 */
const wrap = (id: string, el: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  root: 'root',
  state: {},
  elements: { root: { type: 'Stack', props: { gap: 'md' }, children: [id] }, [id]: el, ...extra },
});

const RICH: Array<{ name: string; spec: unknown }> = [
  // charts — proportion
  { name: 'PieChart — height + nested slice color', spec: wrap('pc', { type: 'PieChart', props: { data: [{ label: 'Chrome', value: 64, color: '#7c3aed' }, { label: 'Safari', value: 19 }, { label: 'Other', value: 17 }], palette: 'brand', height: '220px', showLegend: true, showValues: true } }) },
  { name: 'FunnelChart — nested stage color', spec: wrap('fc', { type: 'FunnelChart', props: { stages: [{ label: 'Visited', value: 1000 }, { label: 'Signed up', value: 420, color: '#0ea5e9' }, { label: 'Paid', value: 64 }], orientation: 'vertical', palette: 'cool', showValues: true, showPercent: true, height: '240px' } }) },
  { name: 'ScatterChart — nested series color + height', spec: wrap('sc', { type: 'ScatterChart', props: { series: [{ name: 'Cohort A', points: [{ x: 1, y: 2 }, { x: 5, y: 4 }, { x: 7, y: 9 }], color: '#16a34a' }], palette: 'brand', height: '240px', showGrid: true, showLegend: true } }) },
  { name: 'RadarChart — nested series color', spec: wrap('rc', { type: 'RadarChart', props: { axes: ['Speed', 'Power', 'Range', 'Cost', 'Comfort'], series: [{ name: 'Model X', values: [80, 65, 90, 40, 75], color: '#7c3aed' }], palette: 'brand', height: '260px', showLegend: true } }) },
  { name: 'Sankey — nested node color + height', spec: wrap('sk', { type: 'Sankey', props: { nodes: [{ label: 'Visitors', color: '#7c3aed' }, { label: 'Sign-ups' }, { label: 'Paid' }], links: [{ source: 0, target: 1, value: 500 }, { source: 1, target: 2, value: 90 }], nodeWidth: 'md', palette: 'brand', height: '240px', showValues: true } }) },
  // charts — radial
  { name: 'Gauge — color + trackColor + nested threshold color', spec: wrap('gg', { type: 'Gauge', props: { value: 72, min: 0, max: 100, thresholds: [{ value: 0, color: '#16a34a', label: 'OK' }, { value: 60, color: '#f59e0b', label: 'High' }, { value: 85, color: '#ef4444', label: 'Critical' }], color: '#7c3aed', trackColor: '#e2e8f0', size: 'lg', unit: '%', label: 'CPU load' } }) },
  { name: 'RadialBar — nested ring color + trackColor + height', spec: wrap('rb', { type: 'RadialBar', props: { data: [{ label: 'Mobile', value: 78, color: '#7c3aed' }, { label: 'Desktop', value: 54 }, { label: 'Tablet', value: 31 }], max: 100, palette: 'brand', trackColor: '#f1f5f9', height: '220px', showLegend: true, showValues: true } }) },
  { name: 'Tracker — nested block color', spec: wrap('tk', { type: 'Tracker', props: { data: [{ tone: 'success', tooltip: 'Operational' }, { tone: 'warning', tooltip: 'Degraded' }, { color: '#16a34a', tooltip: 'Custom', label: 'OK' }], size: 'md', rounded: true, gap: 'sm' } }) },
  { name: 'Candlestick — height', spec: wrap('cs', { type: 'Candlestick', props: { data: [{ label: 'Mon', open: 30, high: 36, low: 28, close: 34 }, { label: 'Tue', open: 34, high: 38, low: 32, close: 31 }], height: '240px', showGrid: true, showAxis: true, size: 'md' } }) },
  { name: 'Treemap — nested rect color + height', spec: wrap('tm', { type: 'Treemap', props: { data: [{ label: 'Engineering', value: 48, color: '#0ea5e9' }, { label: 'Sales', value: 26 }, { label: 'Support', value: 10 }], palette: 'brand', height: '240px', showValues: true } }) },
  // media — extended
  { name: 'VideoPlayer — width', spec: wrap('vp', { type: 'VideoPlayer', props: { src: 'https://example.com/demo.mp4', poster: 'https://example.com/poster.jpg', controls: true, aspect: '16/9', radius: 'md', width: '100%', caption: 'Product demo' } }) },
  { name: 'AudioPlayer — accent', spec: wrap('ap', { type: 'AudioPlayer', props: { src: 'https://example.com/track.mp3', title: 'Episode 12', controls: true, accent: '#7c3aed', radius: 'md' } }) },
  { name: 'Marquee — enums', spec: wrap('mq', { type: 'Marquee', props: { items: ['Acme', 'Globex', 'Initech', 'Umbrella'], direction: 'left', speed: 'normal', pauseOnHover: true, gap: 'md', fade: true } }) },
  { name: 'Figure — width', spec: wrap('fg', { type: 'Figure', props: { src: 'https://example.com/chart.png', alt: 'Revenue chart', caption: 'Q4 revenue', align: 'center', ratio: '16/9', radius: 'md', bordered: true, width: '480px' } }) },
  { name: 'Thumbnail — enums', spec: wrap('th', { type: 'Thumbnail', props: { src: 'https://example.com/avatar.png', alt: 'Ada', size: 'md', radius: 'full', bordered: true, fallbackInitials: 'AL' } }) },
  // inputs — specialized
  { name: 'ColorPicker — accent + columns + nested swatch color', spec: wrap('cp', { type: 'ColorPicker', props: { value: '#6366f1', swatches: [{ color: '#6366f1' }, { color: '#10b981' }, { color: '#f59e0b', label: 'Amber' }, { color: '#ef4444' }], showInput: true, columns: 6, accent: '#7c3aed', size: 'md', label: 'Brand color' } }) },
  { name: 'TimePicker — accent', spec: wrap('tp', { type: 'TimePicker', props: { value: '09:30', minuteStep: 15, accent: '#7c3aed', size: 'md', label: 'Start time' } }) },
  { name: 'QuantityStepper — accent', spec: wrap('qs', { type: 'QuantityStepper', props: { value: 2, min: 1, max: 10, step: 1, accent: '#7c3aed', size: 'md', label: 'Quantity' } }) },
  { name: 'PhoneInput — accent', spec: wrap('ph', { type: 'PhoneInput', props: { value: '7700900000', countries: [{ code: 'GB', dial: '+44', flag: '🇬🇧' }, { code: 'US', dial: '+1' }], country: 'GB', placeholder: '7700 900000', accent: '#7c3aed', size: 'md', label: 'Phone' } }) },
  { name: 'CopyButton — enums', spec: wrap('cb', { type: 'CopyButton', props: { value: 'npm i @frayme/runtime', label: 'Copy command', copiedLabel: 'Copied!', variant: 'outline', size: 'md', icon: 'copy' } }) },
  // util + overlay
  { name: 'Toggletip — accent', spec: wrap('tt', { type: 'Toggletip', props: { label: 'Pricing', icon: 'info', content: 'Charges renew monthly. Cancel anytime.', side: 'top', accent: '#7c3aed', size: 'md' } }) },
  { name: 'Backdrop — overlayColor', spec: wrap('bd', { type: 'Backdrop', props: { active: true, blur: 'sm', overlayColor: '#0f172a', opacity: 'medium', label: 'Saving…', zone: 'rounded' } }) },
  { name: 'HoverCard — accent', spec: wrap('hc', { type: 'HoverCard', props: { trigger: '@frayme', title: 'Frayme', description: 'Ship MCP Apps without code.', imageSrc: 'https://example.com/logo.png', side: 'bottom', accent: '#7c3aed' } }) },
  { name: 'Kbd — enums', spec: wrap('kb', { type: 'Kbd', props: { keys: ['Cmd', 'K'], size: 'md', variant: 'solid' } }) },
  { name: 'Highlight — accent', spec: wrap('hl', { type: 'Highlight', props: { text: 'The quick brown fox jumps', query: 'quick fox', caseSensitive: false, tone: 'warning', accent: '#fde68a' } }) },
  // data — long-tail
  // `align` is the CANON `start|center|end`, not the CSS idiom `left|right`.
  // This fixture read `align: 'right'` until the built-in prop gate
  // (validate/props.ts) landed and rejected it. Worth knowing before "fixing" it
  // back: the runtime DOES render `right` correctly — data-table.tsx's
  // `normAlign` maps the CSS aliases on purpose, with a comment saying it exists
  // *because validation is lenient*. So this is a value the platform serves fine
  // and the gate now refuses. Across generated specs, that alias plus numeric
  // `Heading.level` are the ONLY two such classes. Reconciling them — widen the
  // schema to match the runtime, or
  // drop the runtime alias now that the front door is strict — is a vocabulary
  // decision, deliberately not taken here.
  { name: 'DataTable — accent + headerColor + nested column width', spec: wrap('dg', { type: 'DataTable', props: { columns: [{ key: 'name', label: 'Name', sortable: true }, { key: 'role', label: 'Role' }, { key: 'commits', label: 'Commits', align: 'end', sortable: true, width: '120px' }], rows: [{ name: 'Ada Lovelace', role: 'Engineer', commits: 142 }, { name: 'Alan Turing', role: 'Architect', commits: 98 }], selectable: true, resizable: true, pinnedFirst: true, striped: true, density: 'normal', pageSize: 10, accent: '#7c3aed', headerColor: '#64748b' } }) }, // NB: no top-level `sortable` — DataTable declares it per COLUMN only (the prop gate names it)
  { name: 'JsonView — accent', spec: wrap('jv', { type: 'JsonView', props: { data: { user: { name: 'Ada', roles: ['admin', 'editor'], active: true }, count: 3 }, defaultExpandedDepth: 2, maxDepth: 8, accent: '#7c3aed', showCount: true, size: 'md' } }) },
  { name: 'Menubar — accent', spec: wrap('mb', { type: 'Menubar', props: { menus: [{ label: 'File', items: [{ label: 'New', shortcut: '⌘N', icon: 'plus' }, { separator: true }, { label: 'Export', icon: 'download' }] }, { label: 'Edit', items: [{ label: 'Undo', shortcut: '⌘Z' }, { label: 'Redo', disabled: true }] }], accent: '#7c3aed', size: 'md' } }) },
  { name: 'Fab — accent + accentText', spec: wrap('fab', { type: 'Fab', props: { icon: 'plus', label: 'Create', actions: [{ label: 'New doc', icon: 'edit' }, { label: 'Upload', icon: 'upload' }, { label: 'Invite', icon: 'users', tone: 'info' }], position: 'bottom-right', accent: '#7c3aed', accentText: '#ffffff', size: 'md' } }) },
  { name: 'RelativeTime — tone', spec: wrap('rt', { type: 'RelativeTime', props: { target: '2026-06-25T09:00:00Z', mode: 'relative', format: 'short', prefix: 'Updated', tone: 'neutral' } }) },
];

describe('Long-tail dynamic props — rich specs validate with resolution ON', () => {
  it.each(RICH)('$name', ({ spec }) => {
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });

  it('covers all 30 Group-4 components', () => {
    const types = new Set<string>();
    for (const { spec } of RICH) for (const el of Object.values((spec as { elements: Record<string, { type: string }> }).elements)) types.add(el.type);
    for (const name of [
      'PieChart', 'FunnelChart', 'ScatterChart', 'RadarChart', 'Sankey',
      'Gauge', 'RadialBar', 'Tracker', 'Candlestick', 'Treemap',
      'VideoPlayer', 'AudioPlayer', 'Marquee', 'Figure', 'Thumbnail',
      'ColorPicker', 'TimePicker', 'QuantityStepper', 'PhoneInput', 'CopyButton',
      'Toggletip', 'Backdrop', 'HoverCard', 'Kbd', 'Highlight',
      'DataTable', 'JsonView', 'Menubar', 'Fab', 'RelativeTime',
    ]) {
      expect(types.has(name), `${name} not exercised`).toBe(true);
    }
  });
});

describe('Long-tail dynamic props — adversarial value channels rejected', () => {
  const ADV: Array<{ name: string; spec: unknown }> = [
    { name: 'unsafe NESTED slice color on PieChart', spec: wrap('pc', { type: 'PieChart', props: { data: [{ label: 'x', value: 1, color: 'red;}<x>' }] } }) },
    { name: 'unsafe NESTED stage color on FunnelChart', spec: wrap('fc', { type: 'FunnelChart', props: { stages: [{ label: 'x', value: 1, color: 'url(//x)' }] } }) },
    { name: 'unsafe NESTED node color on Sankey', spec: wrap('sk', { type: 'Sankey', props: { nodes: [{ label: 'x', color: 'expression(alert(1))' }], links: [] } }) },
    { name: 'unsafe NESTED threshold color on Gauge', spec: wrap('gg', { type: 'Gauge', props: { value: 5, thresholds: [{ value: 0, color: '#000;}body{' }] } }) },
    { name: 'var() trackColor on RadialBar', spec: wrap('rb', { type: 'RadialBar', props: { data: [{ label: 'a', value: 1 }], trackColor: 'var(--evil)' } }) },
    { name: 'calc() height on Candlestick', spec: wrap('cs', { type: 'Candlestick', props: { data: [{ open: 1, high: 2, low: 0, close: 1 }], height: 'calc(100% - 1px)' } }) },
    { name: 'unsafe height on Treemap', spec: wrap('tm', { type: 'Treemap', props: { data: [{ label: 'a', value: 1 }], height: '240px;}<x>' } }) },
    { name: 'unsafe width on VideoPlayer', spec: wrap('vp', { type: 'VideoPlayer', props: { src: 'https://x.com/a.mp4', width: '100%;}<x>' } }) },
    { name: 'url() accent on AudioPlayer', spec: wrap('ap', { type: 'AudioPlayer', props: { src: 'https://x.com/a.mp3', accent: 'url(//x)' } }) },
    { name: 'unsafe NESTED swatch color on ColorPicker', spec: wrap('cp', { type: 'ColorPicker', props: { swatches: [{ color: 'red;}body{' }] } }) },
    { name: 'unsafe accent on Toggletip', spec: wrap('tt', { type: 'Toggletip', props: { content: 'x', accent: 'expression(1)' } }) },
    { name: 'unsafe overlayColor on Backdrop', spec: wrap('bd', { type: 'Backdrop', props: { active: true, overlayColor: '#000;}<x>' } }) },
    { name: 'unsafe NESTED column width on DataTable', spec: wrap('dg', { type: 'DataTable', props: { columns: [{ key: 'a', label: 'A', width: 'calc(100% - 1px)' }] } }) },
    { name: 'unsafe headerColor on DataTable', spec: wrap('dg2', { type: 'DataTable', props: { headerColor: 'red;}body{' } }) },
  ];
  it.each(ADV)('rejects: $name', ({ spec }) => {
    // `props: false` is the OLD path — these fixtures are minimal on purpose and
    // omit required props, which the widened prop gate now reports.
    expect(validateSpec(spec, { props: false }).valid).toBe(true);
    const g = validateSpec(spec, { resolution: true });
    expect(g.valid).toBe(false);
    expect(g.failureCategory).toBe('unsafe_value');
  });
});
