import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/validate/index.js';

/**
 * Marketing + feedback + social/media components — dynamic-prop surface.
 *
 * Each component gets a RICH spec exercising its value channels (bg / accent /
 * gradientFrom / gradientTo / overlayColor + the columns count channel) plus its
 * content arrays. All must pass `validateSpec(spec, { resolution: true })`.
 * Adversarial fixtures (unsafe color / count, var(), injection) must be REJECTED
 * with `failureCategory === 'unsafe_value'`.
 */
const wrap = (id: string, el: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  root: 'root',
  state: {},
  elements: { root: { type: 'Stack', props: { gap: 'md' }, children: [id] }, [id]: el, ...extra },
});

const RICH: Array<{ name: string; spec: unknown }> = [
  { name: 'Hero — bg + gradient + accent', spec: wrap('hero', { type: 'Hero', props: { eyebrow: 'New', title: 'Ship MCP apps', subtitle: 'From a prompt.', align: 'center', size: 'lg', mediaPosition: 'none', actions: [{ label: 'Get started', variant: 'primary', icon: 'arrow-right' }, { label: 'Docs', href: '/docs', variant: 'outline' }], maxWidth: 'lg', gradientFrom: '#7c3aed', gradientTo: '#0ea5e9', accent: '#7c3aed' } }) },
  { name: 'CTA — bg + accent', spec: wrap('cta', { type: 'CTA', props: { title: 'Ready to build?', description: 'Spin up your first app.', variant: 'banner', align: 'center', tone: 'info', actions: [{ label: 'Start free', variant: 'primary' }], accent: '#6366f1' } }) },
  { name: 'FeatureGrid — columns', spec: wrap('fg', { type: 'FeatureGrid', props: { columns: 3, gap: 'lg', align: 'start', features: [{ icon: 'sparkles', title: 'Generative UI', description: 'Apps from a prompt.' }, { icon: 'lock', title: 'Secure', description: 'No creds proxied.' }] } }) },
  { name: 'FeatureCard — accent', spec: wrap('fc', { type: 'FeatureCard', props: { icon: 'sparkles', title: 'Generative UI', description: 'Interactive apps from a prompt.', variant: 'elevated', align: 'start', accent: '#7c3aed' } }) },
  { name: 'LogoCloud — columns', spec: wrap('lc', { type: 'LogoCloud', props: { title: 'Trusted by', items: [{ src: 'https://cdn.example.com/acme.png', alt: 'Acme' }, { src: 'https://cdn.example.com/globex.png', alt: 'Globex' }], columns: 5, grayscale: true, size: 'md' } }) },
  { name: 'Testimonial — accent', spec: wrap('ts', { type: 'Testimonial', props: { quote: 'Frayme cut our build time in half.', authorName: 'Jordan Lee', authorTitle: 'Head of Product', rating: 5, variant: 'card', accent: '#f59e0b' } }) },
  { name: 'FAQ — accent', spec: wrap('faq', { type: 'FAQ', props: { items: [{ question: 'Can I cancel anytime?', answer: 'Yes.' }, { question: 'Free tier?', answer: 'Yes, 100 generations.' }], allowMultiple: false, variant: 'bordered', defaultOpenIndex: 0, accent: '#7c3aed' } }) },
  { name: 'Footer — accent', spec: wrap('ft', { type: 'Footer', props: { brand: 'Frayme', tagline: 'Ship MCP apps.', columns: [{ heading: 'Product', links: [{ label: 'Pricing', href: '/pricing' }, { label: 'Docs', href: '/docs' }] }], socials: [{ icon: 'mail', href: 'https://example.com' }], bottomText: '© 2026 Frayme.', variant: 'columns', accent: '#7c3aed' } }) },
  { name: 'PricingTable — accent + columns', spec: wrap('pt', { type: 'PricingTable', props: { plans: [{ name: 'Free', price: '£0', period: '/mo', features: ['100 generations'], ctaLabel: 'Get started' }, { name: 'Pro', price: '£99', period: '/mo', features: ['10,000 generations'], highlighted: true, ctaLabel: 'Choose Pro' }], period: 'monthly', columns: 2, accent: '#7c3aed' } }) },
  { name: 'PlanCard — accent + bg', spec: wrap('pc', { type: 'PlanCard', props: { name: 'Pro', price: '£99', period: '/mo', description: 'For teams.', features: ['10,000 generations', 'Priority support'], badge: 'Most popular', highlighted: true, ctaLabel: 'Choose Pro', accent: '#7c3aed', bg: '#0b1220' } }) },
  { name: 'Banner — accent + dismissible', spec: wrap('bn', { type: 'Banner', props: { message: 'Scheduled maintenance Sunday.', title: 'Heads up', tone: 'warning', icon: 'auto', actionLabel: 'Details', actionHref: '/status', dismissible: true, align: 'center', accent: '#f59e0b' } }) },
  { name: 'Callout — accent', spec: wrap('co', { type: 'Callout', props: { title: 'Heads up', message: 'API keys shown once.', tone: 'warning', icon: 'auto', variant: 'left-accent', dismissible: true, accent: '#f59e0b' } }) },
  { name: 'InlineMessage', spec: wrap('im', { type: 'InlineMessage', props: { message: 'Username is available', tone: 'success', icon: 'auto', size: 'md' } }) },
  { name: 'LoadingOverlay — overlayColor', spec: wrap('lo', { type: 'LoadingOverlay', props: { active: true, label: 'Loading…', blur: true, spinnerSize: 'md', overlayColor: '#0b1220' } }) },
  { name: 'NotFound', spec: wrap('nf', { type: 'NotFound', props: { code: '404', title: 'Page not found', description: 'It does not exist.', icon: 'search', actionLabel: 'Go home', actionHref: '/', align: 'center' } }) },
  { name: 'Result', spec: wrap('rs', { type: 'Result', props: { status: 'success', title: 'Payment successful', description: 'Order confirmed.', actions: [{ label: 'View order', variant: 'primary' }], align: 'center' } }) },
  { name: 'FeedItem', spec: wrap('fi', { type: 'FeedItem', props: { authorName: 'Ada Lovelace', authorTitle: '@ada', timestamp: '2h', body: 'Just shipped the dashboard.', mediaSrc: 'https://example.com/m.jpg', mediaAlt: 'screenshot', actions: [{ icon: 'heart', label: 'Like', count: 24 }, { icon: 'send', label: 'Share', count: 3 }], variant: 'card' } }) },
  { name: 'AvatarGroup', spec: wrap('ag', { type: 'AvatarGroup', props: { items: [{ name: 'Ada Lovelace' }, { name: 'Alan Turing' }, { name: 'Grace Hopper' }, { name: 'Edsger Dijkstra' }], max: 3, size: 'md', ring: true } }) },
  { name: 'Gallery — columns', spec: wrap('gl', { type: 'Gallery', props: { items: [{ src: 'https://example.com/a.jpg', alt: 'Mountain' }, { src: 'https://example.com/b.jpg', alt: 'Lake' }], columns: 3, gap: 'md', ratio: 'square', lightbox: true } }) },
  { name: 'MediaGrid — columns', spec: wrap('mg', { type: 'MediaGrid', props: { items: [{ src: 'https://example.com/1.jpg', alt: 'Cover', label: 'Featured' }, { src: 'https://example.com/2.jpg', alt: 'Album', href: 'https://example.com/album' }], columns: 2, gap: 'md', ratio: 'video' } }) },
  { name: 'Lightbox — overlayColor', spec: wrap('lb', { type: 'Lightbox', props: { items: [{ src: 'https://example.com/a.jpg', alt: 'Slide 1', caption: 'first' }, { src: 'https://example.com/b.jpg', alt: 'Slide 2' }], index: 0, open: true, overlayColor: '#0b1220' } }) },
  { name: 'Comment', spec: wrap('cm', { type: 'Comment', props: { authorName: 'Grace Hopper', timestamp: '5m ago', body: 'Great work.', actions: [{ icon: 'send', label: 'Reply' }, { icon: 'heart', label: 'Like' }], depth: 0 } }) },
  { name: 'CommentThread', spec: wrap('ct', { type: 'CommentThread', props: { comments: [{ authorName: 'Ada', timestamp: '1h', body: 'Loving it', replies: [{ authorName: 'Alan', timestamp: '50m', body: 'Agreed' }] }], maxDepth: 4, collapsible: true } }) },
];

describe('Marketing + feedback + media dynamic props — rich specs validate with resolution ON', () => {
  it.each(RICH)('$name', ({ spec }) => {
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });

  it('covers all 23 Group-3a components', () => {
    const types = new Set<string>();
    for (const { spec } of RICH) for (const el of Object.values((spec as { elements: Record<string, { type: string }> }).elements)) types.add(el.type);
    for (const name of [
      'Hero', 'CTA', 'FeatureGrid', 'FeatureCard', 'LogoCloud',
      'Testimonial', 'FAQ', 'Footer', 'PricingTable', 'PlanCard',
      'Banner', 'Callout', 'InlineMessage', 'LoadingOverlay', 'NotFound', 'Result',
      'FeedItem', 'AvatarGroup', 'Gallery', 'MediaGrid', 'Lightbox', 'Comment', 'CommentThread',
    ]) {
      expect(types.has(name), `${name} not exercised`).toBe(true);
    }
  });
});

describe('Marketing + feedback + media dynamic props — adversarial value channels rejected', () => {
  const ADV: Array<{ name: string; spec: unknown }> = [
    { name: 'unsafe bg on Hero', spec: wrap('hero', { type: 'Hero', props: { title: 'x', bg: 'red;}body{' } }) },
    { name: 'var() accent on CTA', spec: wrap('cta', { type: 'CTA', props: { title: 'x', accent: 'var(--evil)' } }) },
    { name: 'unsafe gradientFrom on Hero', spec: wrap('hero', { type: 'Hero', props: { title: 'x', gradientFrom: '#fff;background:url(//x)' } }) },
    { name: 'expression() bg on PlanCard', spec: wrap('pc', { type: 'PlanCard', props: { name: 'x', price: '£1', bg: 'expression(alert(1))' } }) },
    { name: 'unsafe accent on Banner', spec: wrap('bn', { type: 'Banner', props: { message: 'x', accent: '#000;}<script>' } }) },
    { name: 'unsafe overlayColor on LoadingOverlay', spec: wrap('lo', { type: 'LoadingOverlay', props: { overlayColor: 'rgb(0,0,0);x{' } }) },
    { name: 'var() overlayColor on Lightbox', spec: wrap('lb', { type: 'Lightbox', props: { items: [{ src: 'https://example.com/a.jpg', alt: 'a' }], overlayColor: 'var(--evil)' } }) },
    { name: 'unsafe columns count on FeatureGrid', spec: wrap('fg', { type: 'FeatureGrid', props: { columns: 'red;}' } }) },
    { name: 'unsafe accent on Testimonial', spec: wrap('ts', { type: 'Testimonial', props: { quote: 'x', accent: 'url(//x)' } }) },
  ];
  it.each(ADV)('rejects: $name', ({ spec }) => {
    expect(validateSpec(spec).valid).toBe(true);
    const g = validateSpec(spec, { resolution: true });
    expect(g.valid).toBe(false);
    expect(g.failureCategory).toBe('unsafe_value');
  });
});
