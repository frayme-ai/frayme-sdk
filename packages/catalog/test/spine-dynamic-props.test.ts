import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/validate/index.js';

/**
 * Spine components (layout, navigation, forms, feedback) — dynamic-prop surface.
 *
 * Each new component gets a RICHLY-configured element exercising its enum +
 * value-channel (safeColor / safeDimension) props. Every rich spec must pass
 * `validateSpec(spec, { resolution: true })` (catalog shape + the value-channel
 * gate). Adversarial fixtures (unsafe color/dimension, var(), injection) must be
 * REJECTED with `'unsafe_value'`.
 */

/** Wrap an element under a root Stack so referential checks pass. */
const wrap = (id: string, el: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  root: 'root',
  state: { toastOpen: true, q: '' },
  elements: {
    root: { type: 'Stack', props: { gap: 'md' }, children: [id] },
    [id]: el,
    ...extra,
  },
});
const child = (id: string) => ({ [id]: { type: 'Text', props: { text: 'child' } } });

const RICH: Array<{ name: string; spec: unknown }> = [
  { name: 'Box — bg/borderColor + width/minHeight', spec: wrap('box', { type: 'Box', props: { padding: 'lg', radius: 'lg', bordered: true, shadow: 'md', bg: '#0b1220', borderColor: '#1e293b', width: '480px', minHeight: '12rem' }, children: ['bc'] }, child('bc')) },
  { name: 'Container — width override', spec: wrap('ct', { type: 'Container', props: { maxWidth: 'lg', padding: 'md', centered: true, width: '960px' }, children: ['cc'] }, child('cc')) },
  { name: 'Section — bg band + title', spec: wrap('se', { type: 'Section', props: { spacing: 'lg', maxWidth: 'wide', align: 'center', eyebrow: 'WHY', title: 'Features', bg: '#f8fafc' }, children: ['sc'] }, child('sc')) },
  { name: 'Breadcrumb — items + accent', spec: wrap('bc2', { type: 'Breadcrumb', props: { items: [{ label: 'Home', href: '/' }, { label: 'Settings', href: null }], separator: 'chevron', size: 'md', accent: '#7c3aed' } }) },
  { name: 'Sidebar — bg/borderColor/accent + items', spec: wrap('sb', { type: 'Sidebar', props: { title: 'Workspace', variant: 'default', size: 'md', bg: '#0b1220', borderColor: '#1e293b', accent: '#0ea5e9' }, children: ['si'] }, { si: { type: 'SidebarItem', props: { label: 'Dashboard', href: '/dashboard', icon: 'home', active: true, accent: '#0ea5e9' } } }) },
  { name: 'Navbar — bg/borderColor', spec: wrap('nb', { type: 'Navbar', props: { brand: 'Frayme', variant: 'bordered', sticky: true, justify: 'between', bg: '#ffffff', borderColor: '#e2e8f0' }, children: ['nc'] }, child('nc')) },
  { name: 'Form — width + fields', spec: wrap('fm', { type: 'Form', props: { layout: 'vertical', gap: 'md', width: '28rem' }, children: ['ff'] }, { ff: { type: 'FormField', props: { label: 'Email', helpText: 'No spam', required: true }, children: ['fi'] }, fi: { type: 'Input', props: { label: 'Email', name: 'email' } } }) },
  { name: 'FieldError', spec: wrap('fe', { type: 'FieldError', props: { message: 'Required field.', size: 'sm' } }) },
  { name: 'Label — color', spec: wrap('lb', { type: 'Label', props: { text: 'Full name', htmlFor: 'name', required: true, color: '#0f172a' } }) },
  { name: 'SearchInput — borderColor/bg/accent', spec: wrap('sr', { type: 'SearchInput', props: { placeholder: 'Search…', value: { $bindState: '/q' }, size: 'md', radius: 'lg', clearable: true, borderColor: '#cbd5e1', bg: '#ffffff', accent: '#6366f1' } }) },
  { name: 'Tag — bg/color/borderColor', spec: wrap('tg', { type: 'Tag', props: { label: 'Brand', variant: 'solid', tone: 'info', size: 'md', shape: 'pill', removable: true, bg: '#7c3aed', color: '#ffffff', borderColor: '#5b21b6' } }) },
  { name: 'ListItem — accent', spec: wrap('li', { type: 'ListItem', props: { title: 'Account', description: 'Profile', leadingIcon: 'settings', trailingText: '2h', badge: 'New', href: '/x', active: true, accent: '#7c3aed' } }) },
  { name: 'PageHeader — accent + actions', spec: wrap('ph', { type: 'PageHeader', props: { eyebrow: 'Workspace', title: 'Members', description: 'Manage access', size: 'lg', accent: '#0f172a' }, children: ['pa'] }, { pa: { type: 'Button', props: { label: 'Invite' } } }) },
  { name: 'Stat — accent + sparkline', spec: wrap('st', { type: 'Stat', props: { label: 'Revenue', value: '£24,500', delta: '+12.5%', sparkline: [4, 6, 5, 8, 7, 10, 12], deltaType: 'increase', accent: '#16a34a' } }) },
  { name: 'EmptyState', spec: wrap('es', { type: 'EmptyState', props: { title: 'No results', description: 'Adjust filters.', icon: 'search', align: 'center' }, children: ['ea'] }, { ea: { type: 'Button', props: { label: 'Reset' } } }) },
  { name: 'ErrorState', spec: wrap('er', { type: 'ErrorState', props: { title: 'Failed', detail: 'Try again.', icon: 'alert-triangle' }, children: ['ra'] }, { ra: { type: 'Button', props: { label: 'Retry' } } }) },
  { name: 'IconButton — accent/accentText', spec: wrap('ib', { type: 'IconButton', props: { icon: 'settings', label: 'Settings', variant: 'primary', size: 'md', accent: '#7c3aed', accentText: '#ffffff' } }) },
  { name: 'Toast — bg/accent', spec: wrap('to', { type: 'Toast', props: { title: 'Saved', message: 'Live.', openPath: '/toastOpen', tone: 'success', position: 'bottom-right', variant: 'solid', bg: '#0b1220', accent: '#0ea5e9' } }) },
  { name: 'CodeBlock', spec: wrap('cb', { type: 'CodeBlock', props: { code: 'const x = 1;\nconsole.log(x);', filename: 'demo.ts', language: 'ts', showLineNumbers: true } }) },
];

describe('Spine dynamic props — rich specs validate with resolution ON', () => {
  it.each(RICH)('$name', ({ spec }) => {
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });

  it('covers all 21 Group-1 components', () => {
    const types = new Set<string>();
    for (const { spec } of RICH) {
      for (const el of Object.values((spec as { elements: Record<string, { type: string }> }).elements)) types.add(el.type);
    }
    for (const name of [
      'Box', 'Container', 'Section', 'Breadcrumb', 'Sidebar', 'SidebarItem', 'Navbar',
      'Form', 'FormField', 'FieldError', 'Label', 'SearchInput', 'Tag', 'ListItem',
      'PageHeader', 'Stat', 'EmptyState', 'ErrorState', 'IconButton', 'Toast', 'CodeBlock',
    ]) {
      expect(types.has(name), `${name} not exercised by a rich spec`).toBe(true);
    }
  });
});

describe('Spine dynamic props — adversarial value channels are rejected', () => {
  const ADVERSARIAL: Array<{ name: string; spec: unknown }> = [
    { name: 'unsafe color on Box bg (injection)', spec: wrap('box', { type: 'Box', props: { bg: 'red;background:url(//evil)' }, children: ['bc'] }, child('bc')) },
    { name: 'unsafe dimension on Box width (break-out)', spec: wrap('box', { type: 'Box', props: { width: '10px;}x{' }, children: ['bc'] }, child('bc')) },
    { name: 'var() color on Sidebar accent', spec: wrap('sb', { type: 'Sidebar', props: { accent: 'var(--evil)' }, children: ['sc'] }, child('sc')) },
    { name: 'unsafe color on Tag bg', spec: wrap('tg', { type: 'Tag', props: { label: 'X', bg: 'red; }body{' } }) },
  ];

  it.each(ADVERSARIAL)('rejects: $name', ({ spec }) => {
    expect(validateSpec(spec).valid).toBe(true); // catalog-valid (value props stripped/shape ok)
    const gated = validateSpec(spec, { resolution: true });
    expect(gated.valid).toBe(false);
    expect(gated.failureCategory).toBe('unsafe_value');
  });
});
