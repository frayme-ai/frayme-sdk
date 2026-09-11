import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/validate/index.js';

/**
 * Charts + AI-chat components — dynamic-prop surface.
 *
 * Each component gets a RICH spec exercising its top-level value channels
 * (height/accent/color/trackColor/bg) + data arrays. All must pass
 * `validateSpec(spec, { resolution: true })`. Adversarial fixtures (unsafe
 * dimension/color, var(), injection) must be REJECTED with `'unsafe_value'`.
 */
const wrap = (id: string, el: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  root: 'root',
  state: {},
  elements: { root: { type: 'Stack', props: { gap: 'md' }, children: [id] }, [id]: el, ...extra },
});

const RICH: Array<{ name: string; spec: unknown }> = [
  { name: 'AreaChart — height + series color', spec: wrap('ac', { type: 'AreaChart', props: { series: [{ name: 'Rev', points: [12, 19, 14, 22, 30], color: '#7c3aed' }], curve: 'smooth', palette: 'brand', height: '220px' } }) },
  { name: 'BarChart — height', spec: wrap('bc', { type: 'BarChart', props: { data: [{ label: 'Mon', value: 12 }, { label: 'Tue', value: 19, color: '#0ea5e9' }], layout: 'vertical', palette: 'cool', height: '200px' } }) },
  { name: 'LineChart — height', spec: wrap('lc', { type: 'LineChart', props: { series: [{ name: 'A', points: [4, 8, 6, 10, 14] }], curve: 'smooth', palette: 'categorical', height: '200px' } }) },
  { name: 'DonutChart', spec: wrap('dc', { type: 'DonutChart', props: { data: [{ label: 'A', value: 45 }, { label: 'B', value: 30 }], thickness: 'md', palette: 'brand' } }) },
  { name: 'Sparkline — color', spec: wrap('sp', { type: 'Sparkline', props: { points: [4, 6, 5, 8, 12], type: 'area', tone: 'success', color: '#16a34a' } }) },
  { name: 'BarList — accent', spec: wrap('bl', { type: 'BarList', props: { data: [{ label: '/home', value: 1240, color: '#7c3aed' }, { label: '/docs', value: 540 }], palette: 'brand', accent: '#7c3aed' } }) },
  { name: 'ProgressCircle — color + trackColor', spec: wrap('pc', { type: 'ProgressCircle', props: { value: 72, max: 100, size: 'lg', tone: 'success', color: '#16a34a', trackColor: '#dcfce7' } }) },
  { name: 'StatGroup — columns + children', spec: wrap('sg', { type: 'StatGroup', props: { columns: 3, divided: true }, children: ['sg1'] }, { sg1: { type: 'Stat', props: { label: 'Revenue', value: '£24k' } } }) },
  { name: 'Heatmap', spec: wrap('hm', { type: 'Heatmap', props: { cells: [[1, 4, 9], [3, 0, 6]], colorScale: 'brand', cellSize: 'md', xLabels: ['M', 'T', 'W'] } }) },
  { name: 'Gantt', spec: wrap('gt', { type: 'Gantt', props: { tasks: [{ label: 'Design', start: 0, end: 3 }, { label: 'Build', start: 2, end: 7, color: '#0ea5e9' }], rangeMax: 9, palette: 'cool' } }) },
  { name: 'Conversation — bg + Message child', spec: wrap('cv', { type: 'Conversation', props: { density: 'normal', bordered: true, bg: '#0b1220' }, children: ['m1'] }, { m1: { type: 'Message', props: { role: 'assistant', content: 'Hi' } } }) },
  { name: 'Message — accent + bg', spec: wrap('ms', { type: 'Message', props: { role: 'user', author: 'Jane', content: 'Build me a dashboard', timestamp: '2:14 PM', accent: '#7c3aed', bg: '#1e293b' } }) },
  { name: 'MessageContent', spec: wrap('mc', { type: 'MessageContent', props: { content: 'Here are three options.', variant: 'text', prose: true } }) },
  { name: 'PromptInput — accent/border/bg', spec: wrap('pi', { type: 'PromptInput', props: { placeholder: 'Ask…', name: 'q', attach: true, accent: '#6366f1', borderColor: '#cbd5e1', bg: '#ffffff' } }) },
  { name: 'Reasoning', spec: wrap('rs', { type: 'Reasoning', props: { content: 'I should query the sales table.', duration: '4s' } }) },
  { name: 'ToolCall', spec: wrap('tc', { type: 'ToolCall', props: { name: 'search_web', input: '{"q":"x"}', state: 'running', defaultOpen: true } }) },
  { name: 'Task — accent', spec: wrap('tk', { type: 'Task', props: { title: 'Querying', state: 'active', accent: '#7c3aed' } }) },
  { name: 'Confirmation', spec: wrap('cf', { type: 'Confirmation', props: { message: 'Delete 3 files?', confirmLabel: 'Delete', tone: 'critical' } }) },
  { name: 'Suggestion — accent', spec: wrap('su', { type: 'Suggestion', props: { label: 'Summarize', icon: 'sparkles', accent: '#0ea5e9' } }) },
  { name: 'TypingIndicator', spec: wrap('ti', { type: 'TypingIndicator', props: { label: 'typing' } }) },
  { name: 'Sources', spec: wrap('so', { type: 'Sources', props: { title: 'Sources', sources: [{ title: 'docs', url: 'https://json-render.dev', excerpt: 'spec' }], variant: 'list' } }) },
  { name: 'InlineCitation', spec: wrap('ic', { type: 'InlineCitation', props: { index: 1, url: 'https://json-render.dev', excerpt: 'spec' } }) },
  { name: 'Artifact — accent', spec: wrap('ar', { type: 'Artifact', props: { title: 'fib.ts', kind: 'code', content: 'const x = 1;', accent: '#7c3aed' } }) },
  { name: 'WebPreview', spec: wrap('wp', { type: 'WebPreview', props: { url: 'https://json-render.dev', title: 'json-render', description: 'specs to React' } }) },
  { name: 'Shimmer', spec: wrap('sh', { type: 'Shimmer', props: { lines: 3 } }) },
  { name: 'DiffView', spec: wrap('dv', { type: 'DiffView', props: { before: 'a = 30;', after: 'a = 60;', filename: 'config.ts', mode: 'unified', showLineNumbers: true } }) },
];

describe('Charts + AI-chat dynamic props — rich specs validate with resolution ON', () => {
  it.each(RICH)('$name', ({ spec }) => {
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });

  it('covers all 26 Group-2 components', () => {
    const types = new Set<string>();
    for (const { spec } of RICH) for (const el of Object.values((spec as { elements: Record<string, { type: string }> }).elements)) types.add(el.type);
    for (const name of [
      'AreaChart', 'BarChart', 'LineChart', 'DonutChart', 'Sparkline', 'BarList', 'ProgressCircle', 'StatGroup', 'Heatmap', 'Gantt',
      'Conversation', 'Message', 'MessageContent', 'PromptInput', 'Reasoning', 'ToolCall', 'Task', 'Confirmation', 'Suggestion', 'TypingIndicator',
      'Sources', 'InlineCitation', 'Artifact', 'WebPreview', 'Shimmer', 'DiffView',
    ]) {
      expect(types.has(name), `${name} not exercised`).toBe(true);
    }
  });
});

describe('Charts + AI-chat dynamic props — adversarial value channels rejected', () => {
  const ADV: Array<{ name: string; spec: unknown }> = [
    { name: 'unsafe height on AreaChart', spec: wrap('ac', { type: 'AreaChart', props: { series: [{ name: 'a', points: [1, 2] }], height: '10px;}x{' } }) },
    { name: 'var() accent on Message', spec: wrap('ms', { type: 'Message', props: { role: 'user', content: 'x', accent: 'var(--evil)' } }) },
    { name: 'unsafe color on Sparkline', spec: wrap('sp', { type: 'Sparkline', props: { points: [1, 2], color: 'red;}body{' } }) },
    { name: 'unsafe trackColor on ProgressCircle', spec: wrap('pc', { type: 'ProgressCircle', props: { value: 50, max: 100, trackColor: 'red;background:url(//x)' } }) },
    { name: 'unsafe NESTED color on BarChart data[].color (recursed gate)', spec: wrap('bc', { type: 'BarChart', props: { data: [{ label: 'a', value: 1, color: 'red;}<x>' }] } }) },
    { name: 'unsafe NESTED color on AreaChart series[].color', spec: wrap('ac', { type: 'AreaChart', props: { series: [{ name: 's', points: [1, 2], color: 'var(--evil)' }] } }) },
  ];
  it.each(ADV)('rejects: $name', ({ spec }) => {
    expect(validateSpec(spec).valid).toBe(true);
    const g = validateSpec(spec, { resolution: true });
    expect(g.valid).toBe(false);
    expect(g.failureCategory).toBe('unsafe_value');
  });
});
