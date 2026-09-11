import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/validate/index.js';

/**
 * Structure + board + filter + composer components — dynamic-prop surface.
 *
 * Each component gets a RICH spec exercising its value channels (accent / dotColor
 * + the width/height/minWidth/minHeight/maxHeight dimension channels + the columns
 * count). All must pass `validateSpec(spec, { resolution: true })`. Adversarial
 * fixtures (unsafe color / dim, var(), injection — incl. a NESTED column accent)
 * must be REJECTED with `failureCategory === 'unsafe_value'`.
 */
const wrap = (id: string, el: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  root: 'root',
  state: {},
  elements: { root: { type: 'Stack', props: { gap: 'md' }, children: [id] }, [id]: el, ...extra },
});

const RICH: Array<{ name: string; spec: unknown }> = [
  { name: 'Timeline — accent', spec: wrap('tl', { type: 'Timeline', props: { items: [{ title: 'Order placed', time: '09:24', tone: 'success' }, { title: 'Packed', time: '11:02', description: 'Left.' }, { title: 'Out for delivery', time: '14:18', active: true, tone: 'info' }], orientation: 'vertical', align: 'left', size: 'md', accent: '#7c3aed' } }) },
  { name: 'TimelineItem — dotColor', spec: wrap('ti', { type: 'TimelineItem', props: { title: 'Deployed to production', time: '2m ago', tone: 'success', active: true, dotColor: '#16a34a' } }) },
  { name: 'Stepper — accent', spec: wrap('st', { type: 'Stepper', props: { steps: [{ label: 'Account' }, { label: 'Profile' }, { label: 'Billing' }, { label: 'Done' }], current: 1, orientation: 'horizontal', clickable: true, size: 'md', accent: '#7c3aed' } }) },
  { name: 'Tree — accent', spec: wrap('tr', { type: 'Tree', props: { nodes: [{ label: 'src', children: [{ label: 'components', children: [{ label: 'Button.tsx' }, { label: 'Card.tsx' }] }, { label: 'index.ts' }] }, { label: 'package.json' }], maxDepth: 6, defaultExpandedDepth: 1, selectable: true, accent: '#7c3aed' } }) },
  { name: 'SplitPane — height', spec: wrap('sp', { type: 'SplitPane', props: { orientation: 'horizontal', splitPercent: 40, minSize: 15, height: '24rem', bordered: true } }) },
  { name: 'Resizable — width/height/min', spec: wrap('rz', { type: 'Resizable', props: { width: '320px', height: '240px', axis: 'horizontal', minWidth: '120px', minHeight: '80px', bordered: true } }) },
  { name: 'VirtualList — maxHeight', spec: wrap('vl', { type: 'VirtualList', props: { items: [{ label: 'Alpha', description: 'First item' }, { label: 'Bravo', description: 'Second item' }], itemHeight: 44, maxHeight: '20rem', overscan: 4, selectable: true } }) },
  { name: 'DescriptionList — columns', spec: wrap('dl', { type: 'DescriptionList', props: { items: [{ term: 'Status', description: 'Active' }, { term: 'Plan', description: 'Pro' }], layout: 'grid', density: 'normal', columns: 2, bordered: true } }) },
  { name: 'KanbanBoard — accent + nested column accent', spec: wrap('kb', { type: 'KanbanBoard', props: { columns: [{ title: 'To do', count: 2, accent: '#7c3aed', cards: [{ title: 'A' }, { title: 'B' }] }, { title: 'Done', cards: [{ title: 'C' }] }], gap: 'md', accent: '#94a3b8' } }) },
  { name: 'BoardColumn — accent', spec: wrap('bc', { type: 'BoardColumn', props: { title: 'In progress', count: 3, accent: '#7c3aed', collapsible: true } }) },
  { name: 'KanbanCard — accent + labels', spec: wrap('kc', { type: 'KanbanCard', props: { title: 'Wire the MCP server', description: 'Multi-tenant SSE endpoint.', labels: [{ text: 'backend', tone: 'info' }, { text: 'blocked', tone: 'critical' }], assignee: 'Priya Gupta', meta: '#42', moveable: true, accent: '#7c3aed' } }) },
  { name: 'NavigationMenu — accent + flyout', spec: wrap('nm', { type: 'NavigationMenu', props: { items: [{ label: 'Home', href: '/' }, { label: 'Products', children: [{ label: 'API', href: '/api', description: 'Compose UI' }, { label: 'Platform', href: '/platform' }] }, { label: 'Docs', href: '/docs', icon: 'home' }], orientation: 'horizontal', accent: '#7c3aed' } }) },
  { name: 'FilterBar — accent', spec: wrap('fb', { type: 'FilterBar', props: { filters: [{ label: 'Status: Open', value: 'status:open', removable: true }, { label: 'Owner: Me', value: 'owner:me', removable: true }], searchPlaceholder: 'Search issues…', searchValue: '', showClear: true, size: 'md', accent: '#7c3aed' } }) },
  { name: 'FacetList — accent', spec: wrap('fl', { type: 'FacetList', props: { title: 'Status', facets: [{ label: 'Open', value: 'open', count: 24 }, { label: 'Closed', value: 'closed', count: 132 }], selected: ['open'], max: 5, accent: '#7c3aed' } }) },
  { name: 'FilterPanel — accent', spec: wrap('fp', { type: 'FilterPanel', props: { title: 'Filters', sections: [{ heading: 'Status', facets: [{ label: 'Open', value: 'open', count: 24 }] }, { heading: 'Priority', facets: [{ label: 'High', value: 'high', count: 6 }], collapsed: true }], accent: '#7c3aed' } }) },
  { name: 'RichComposer — accent', spec: wrap('rc', { type: 'RichComposer', props: { value: '', placeholder: 'Write a comment…', toolbar: ['bold', 'italic', 'link', 'bullet', 'code'], maxLength: 500, submitLabel: 'Send', size: 'md', accent: '#7c3aed' } }) },
];

describe('Structure + board + filter dynamic props — rich specs validate with resolution ON', () => {
  it.each(RICH)('$name', ({ spec }) => {
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });

  it('covers all 16 Group-3b components', () => {
    const types = new Set<string>();
    for (const { spec } of RICH) for (const el of Object.values((spec as { elements: Record<string, { type: string }> }).elements)) types.add(el.type);
    for (const name of [
      'Timeline', 'TimelineItem', 'Stepper', 'Tree',
      'SplitPane', 'Resizable', 'VirtualList', 'DescriptionList',
      'KanbanBoard', 'BoardColumn', 'KanbanCard', 'NavigationMenu',
      'FilterBar', 'FacetList', 'FilterPanel', 'RichComposer',
    ]) {
      expect(types.has(name), `${name} not exercised`).toBe(true);
    }
  });
});

describe('Structure + board + filter dynamic props — adversarial value channels rejected', () => {
  const ADV: Array<{ name: string; spec: unknown }> = [
    { name: 'unsafe accent on Timeline', spec: wrap('tl', { type: 'Timeline', props: { items: [{ title: 'x' }], accent: 'red;}body{' } }) },
    { name: 'var() dotColor on TimelineItem', spec: wrap('ti', { type: 'TimelineItem', props: { title: 'x', dotColor: 'var(--evil)' } }) },
    { name: 'expression() accent on Stepper', spec: wrap('st', { type: 'Stepper', props: { steps: [{ label: 'a' }], accent: 'expression(alert(1))' } }) },
    { name: 'calc() width on Resizable', spec: wrap('rz', { type: 'Resizable', props: { width: 'calc(100% - 1px)' } }) },
    { name: 'unsafe height on SplitPane', spec: wrap('sp', { type: 'SplitPane', props: { height: '24rem;}<x>' } }) },
    { name: 'var() maxHeight on VirtualList', spec: wrap('vl', { type: 'VirtualList', props: { items: [{ label: 'a' }], maxHeight: 'var(--evil)' } }) },
    { name: 'unsafe NESTED column accent on KanbanBoard (recursed gate)', spec: wrap('kb', { type: 'KanbanBoard', props: { columns: [{ title: 'x', accent: 'red;}<x>' }] } }) },
    { name: 'url() accent on KanbanCard', spec: wrap('kc', { type: 'KanbanCard', props: { title: 'x', accent: 'url(//x)' } }) },
    { name: 'unsafe accent on FacetList', spec: wrap('fl', { type: 'FacetList', props: { facets: [{ label: 'a', value: 'a' }], accent: '#000;}body{' } }) },
  ];
  it.each(ADV)('rejects: $name', ({ spec }) => {
    expect(validateSpec(spec).valid).toBe(true);
    const g = validateSpec(spec, { resolution: true });
    expect(g.valid).toBe(false);
    expect(g.failureCategory).toBe('unsafe_value');
  });
});
