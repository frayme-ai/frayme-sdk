/**
 * Renders EVERY real catalog component through <FraymeRenderer mode="strict">
 * with catalog-valid example props — so this test simultaneously checks:
 *  (a) our example props conform to @frayme/catalog schemas (strict gate),
 *  (b) every component implementation mounts without crashing,
 *  (c) none of the 36 falls through to the Fallback.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fraymeCatalog } from '@frayme/catalog';
import type { Spec } from '@json-render/core';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const EXAMPLES: Record<string, Record<string, unknown>> = {
  Card: { title: 'T', description: 'D', maxWidth: 'md', centered: false },
  Stack: { direction: 'vertical', gap: 'md', align: null, justify: null },
  Grid: { columns: 2, gap: 'md' },
  Separator: { orientation: 'horizontal' },
  Tabs: { tabs: [{ label: 'A', value: 'a' }], defaultValue: 'a', value: null },
  Accordion: { items: [{ title: 'T', content: 'C' }], type: 'single' },
  Collapsible: { title: 'T', defaultOpen: true },
  Dialog: { title: 'T', description: null, openPath: '/ui/open' },
  Drawer: { title: 'T', description: null, openPath: '/ui/open' },
  Carousel: { items: [{ title: 'T', description: null }] },
  Table: {
    columns: ['A', 'B'], rows: [['1', '2']], caption: null,
    size: 'sm', density: 'compact', striped: true, bordered: 'grid', hover: true,
    align: 'left', stickyHeader: true, accent: '#e2e8f0',
  },
  Heading: {
    text: 'H', level: 'h2', size: '2xl', weight: 'bold', align: 'center',
    tone: 'default', tracking: 'tight', truncate: false, color: '#7c3aed',
  },
  Text: {
    text: 'T', variant: 'body', size: 'sm', weight: 'medium', align: 'justify',
    tone: 'warning', italic: true, truncate: false, mono: false, color: '#b45309', clamp: 2,
  },
  Image: {
    src: null, alt: 'alt', width: null, height: null, aspect: '16/9', fit: 'cover',
    position: 'top', radius: 'lg', border: true, shadow: 'md', loading: 'lazy', borderColor: '#e2e8f0',
  },
  Avatar: {
    src: null, name: 'Jane Doe', size: 'lg', shape: 'rounded', ring: 'success',
    border: true, bg: '#1e293b', color: '#f8fafc', ringColor: '#22c55e',
  },
  Badge: {
    text: 'B', variant: 'outline', tone: null, size: 'sm', shape: 'rounded', dot: true,
    uppercase: true, bg: '#7c3aed', color: '#ffffff', borderColor: '#5b21b6', dotColor: '#c4b5fd',
  },
  Alert: {
    title: 'A', message: 'M', type: 'info', variant: 'subtle', size: 'lg', align: 'left',
    icon: 'info', dismissible: true, accentBar: true, bg: '#eef2ff', borderColor: '#c7d2fe', accent: '#6366f1',
  },
  Progress: {
    value: 50, max: 100, label: 'Storage', tone: 'warning', size: 'md', shape: 'pill',
    showValue: 'fraction', striped: true, animated: true, indeterminate: false, color: '#d97706', trackColor: '#f1f5f9',
  },
  Skeleton: {
    width: '100%', height: '1rem', shape: 'line', radius: 'sm',
    animation: 'shimmer', tone: 'subtle', lines: 3,
  },
  Spinner: {
    size: 'lg', label: 'Loading', tone: 'info', variant: 'ring', speed: 'fast',
    thickness: 'thick', labelPosition: 'bottom', color: '#2563eb', trackColor: '#dbeafe',
  },
  Tooltip: { content: 'C', text: 'T' },
  Popover: { trigger: 'Open', content: 'C' },
  Input: {
    label: 'Budget', name: 'amount', type: 'number', placeholder: '0', value: null, checks: null, validateOn: 'blur',
    inputMode: 'decimal', autocomplete: 'off', autofocus: false, radius: 'lg', align: 'right', prefix: '£', suffix: null,
    minLength: 1, maxLength: 8, min: 0, max: 100000, step: 50,
    borderColor: '#e4e4e7', bg: '#fafafa',
    size: 'lg', labelPlacement: 'top', accent: '#6d28d9', width: '12rem',
    disabled: false, readonly: false, required: true, helpText: 'Monthly, before tax', errorText: null,
  },
  Textarea: {
    label: 'Notes', name: 'notes', placeholder: null, rows: 8, value: null, checks: null, validateOn: 'submit',
    maxLength: 500, showCount: true, resize: 'vertical', autosize: true, radius: 'md',
    borderColor: '#cbd5e1', bg: '#ffffff', minHeight: '6rem', maxHeight: '20rem',
    size: 'sm', labelPlacement: 'top', accent: '#0ea5e9', width: null,
    disabled: false, readonly: false, required: true, helpText: 'Markdown supported', errorText: null,
  },
  Select: {
    label: 'Plan', name: 'plan', options: ['Starter', 'Pro'], placeholder: 'Choose…', value: null, checks: null, validateOn: 'change',
    clearable: true, radius: 'md', borderColor: '#cbd5e1', bg: '#ffffff',
    size: 'lg', labelPlacement: 'top', accent: '#16a34a', width: '20rem',
    disabled: false, readonly: false, required: true, helpText: null, errorText: null,
  },
  Checkbox: {
    label: 'Email me updates', name: 'marketing', checked: false, checks: null, validateOn: 'change',
    indeterminate: false, description: 'Once a month, unsubscribe anytime.',
    size: 'lg', accent: '#db2777', width: null,
    disabled: false, readonly: false, required: true, helpText: null, errorText: null,
  },
  Radio: {
    label: 'Billing cycle', name: 'billing', options: ['Monthly', 'Yearly'], value: null, checks: null, validateOn: 'change',
    orientation: 'horizontal', gap: 'md', gapValue: '1rem',
    size: 'lg', labelPlacement: 'top', accent: '#7c3aed', width: null,
    disabled: false, readonly: false, required: true, helpText: 'Yearly saves 20%', errorText: null,
  },
  Switch: {
    label: 'Dark mode', name: 'darkmode', checked: false, checks: null, validateOn: 'change',
    offColor: '#52525b', description: 'Applies workspace-wide.', onLabel: 'On', offLabel: 'Off',
    size: 'lg', accent: '#22c55e', width: null,
    disabled: false, readonly: false, required: false, helpText: null, errorText: null,
  },
  Slider: {
    label: 'Temperature', name: 'temp', min: 16, max: 28, step: 0.5, value: 22,
    showValue: true, trackColor: '#fed7aa', valueSuffix: '°C',
    marks: [{ value: 16, label: 'Cool' }, { value: 28, label: 'Warm' }],
    size: 'lg', labelPlacement: 'top', accent: '#ea580c', width: '24rem',
    disabled: false, readonly: false,
  },
  Button: {
    label: 'Upgrade', variant: 'primary', tone: null, disabled: false, loading: false,
    icon: 'sparkles', iconPosition: 'start', surface: 'gradient',
    gradientFrom: '#7c3aed', gradientTo: '#0ea5e9', borderColor: null, minWidth: '180px',
    accent: null, accentText: '#ffffff', radius: 'full', size: 'lg', fullWidth: false, align: 'center',
  },
  Link: {
    label: 'Terms', href: 'https://example.com', external: true, variant: 'subtle', tone: 'neutral',
    size: 'sm', weight: 'medium', underline: 'hover', color: '#64748b', icon: 'arrow-up-right',
  },
  DropdownMenu: {
    label: 'Region', items: [{ label: 'US East', value: 'us-east' }, { label: 'EU West', value: 'eu-west' }], value: null,
    placeholder: 'Choose a region', triggerVariant: 'outline', menuSurface: 'elevated',
    triggerColor: '#0f172a', menuWidth: '220px', maxHeight: '240px', accent: '#0ea5e9', accentText: '#ffffff',
    radius: 'md', size: 'sm', fullWidth: false, align: 'end',
  },
  Toggle: {
    label: 'Notifications', pressed: false, variant: 'outline', size: 'sm', radius: 'full',
    iconOnly: false, tone: null, icon: 'bell', activeColor: '#16a34a', activeText: '#ffffff',
    accent: null, accentText: null, fullWidth: false, align: 'center',
  },
  ToggleGroup: {
    items: [{ label: 'List', value: 'list' }, { label: 'Grid', value: 'grid' }], type: 'single', value: null,
    size: 'sm', radius: 'full', orientation: 'horizontal', attached: false, variant: 'outline', tone: null,
    fullWidth: true, activeColor: '#6366f1', activeText: '#ffffff', accent: null, accentText: null, gapValue: '8px',
    align: 'center',
  },
  ButtonGroup: {
    buttons: [{ label: 'Monthly', value: 'mo' }, { label: 'Yearly', value: 'yr' }], selected: null,
    size: 'lg', radius: 'full', orientation: 'horizontal', variant: 'outline', tone: null, fullWidth: true,
    borderColor: '#cbd5e1', icons: ['calendar', 'star'], accent: '#0f172a', accentText: '#ffffff', align: 'center',
  },
  Pagination: {
    totalPages: 42, page: 1, size: 'sm', shape: 'circle', variant: 'ghost',
    showEdges: true, showPrevNext: true, siblingCount: 2, accent: '#9333ea', accentText: '#ffffff', align: 'center',
  },
  // ── Spine ──
  Box: { padding: 'lg', radius: 'lg', bordered: true, shadow: 'md', align: 'start', bg: '#ffffff', borderColor: '#e2e8f0', width: '480px', minHeight: '8rem' },
  Container: { maxWidth: 'lg', padding: 'md', centered: true, align: 'start', width: null },
  Section: { spacing: 'lg', maxWidth: 'default', align: 'center', eyebrow: 'WHY FRAYME', title: 'Features', bg: '#f8fafc' },
  Breadcrumb: { items: [{ label: 'Home', href: '/' }, { label: 'Settings', href: null }], separator: 'chevron', size: 'md', accent: '#7c3aed' },
  Sidebar: { title: 'Workspace', variant: 'default', collapsed: false, size: 'md', sticky: false, bg: '#0b1220', borderColor: '#1e293b', accent: '#0ea5e9' },
  SidebarItem: { label: 'Dashboard', href: '/dashboard', badge: '3', icon: 'home', active: true, size: 'md', external: false, accent: '#0ea5e9' },
  Navbar: { brand: 'Frayme', variant: 'bordered', sticky: false, justify: 'between', size: 'md', bg: '#ffffff', borderColor: '#e2e8f0' },
  Form: { layout: 'vertical', gap: 'md', width: '28rem' },
  FormField: { label: 'Email', helpText: 'We never share your email.', errorText: null, required: true, labelPlacement: 'top', size: 'md' },
  FieldError: { message: 'Please enter a valid email address.', size: 'sm' },
  Label: { text: 'Full name', htmlFor: 'name', required: true, size: 'md', color: '#0f172a' },
  SearchInput: { placeholder: 'Search products…', value: null, name: 'q', size: 'md', radius: 'lg', loading: false, clearable: true, disabled: false, borderColor: '#cbd5e1', bg: '#ffffff', accent: '#6366f1' },
  Tag: { label: 'In progress', icon: 'check', variant: 'soft', tone: 'info', size: 'md', shape: 'pill', removable: true, bg: null, color: null, borderColor: null },
  ListItem: { title: 'Account settings', description: 'Profile, security, billing', leadingIcon: 'settings', trailingText: 'Updated 2h ago', badge: 'New', href: '/settings', external: false, active: true, size: 'md', density: 'comfortable', accent: '#7c3aed' },
  PageHeader: { eyebrow: 'Workspace', title: 'Team members', description: 'Manage who has access', align: 'start', size: 'lg', accent: '#0f172a' },
  Stat: { label: 'Monthly revenue', value: '£24,500', delta: '+12.5%', sparkline: [4, 6, 5, 8, 7, 10, 12], deltaType: 'increase', size: 'md', align: 'start', accent: '#16a34a' },
  EmptyState: { title: 'No results', description: 'Try adjusting your filters.', icon: 'search', size: 'md', align: 'center' },
  ErrorState: { title: 'Something went wrong', detail: 'We could not load your data. Please try again.', icon: 'alert-triangle', size: 'md', align: 'center' },
  IconButton: { icon: 'settings', label: 'Open settings', variant: 'ghost', tone: null, size: 'md', radius: 'md', disabled: false, loading: false, accent: null, accentText: null },
  Toast: { title: 'Saved', message: 'Your changes are live.', openPath: '/ui/open', tone: 'success', position: 'bottom-right', variant: 'solid', dismissible: true, icon: 'auto', bg: null, accent: null },
  CodeBlock: { code: 'const x = 1;\nconsole.log(x);', filename: 'demo.ts', language: 'ts', showLineNumbers: true, wrap: false, size: 'md', theme: 'dark' },
  // ── charts ──
  AreaChart: { series: [{ name: 'Revenue', points: [12, 19, 14, 22, 30, 28, 35], color: '#7c3aed' }], curve: 'smooth', stacked: false, palette: 'brand', showGrid: true, showLegend: true, height: '180px' },
  BarChart: { data: [{ label: 'Mon', value: 12 }, { label: 'Tue', value: 19, color: '#0ea5e9' }, { label: 'Wed', value: 8 }], layout: 'vertical', palette: 'cool', rounded: true, showValues: true, height: '180px' },
  LineChart: { series: [{ name: 'This week', points: [4, 8, 6, 10, 9, 12, 14] }, { name: 'Last week', points: [3, 5, 7, 6, 8, 7, 9] }], curve: 'smooth', showDots: true, palette: 'categorical', height: '180px' },
  DonutChart: { data: [{ label: 'Direct', value: 45 }, { label: 'Referral', value: 30 }, { label: 'Social', value: 25 }], thickness: 'md', showTotal: true, palette: 'brand' },
  Sparkline: { points: [4, 6, 5, 8, 7, 9, 12], type: 'area', tone: 'success', color: '#16a34a' },
  BarList: { data: [{ label: '/home', value: 1240 }, { label: '/pricing', value: 870, color: '#7c3aed' }, { label: '/docs', value: 540 }], sortByValue: true, palette: 'brand', accent: '#7c3aed' },
  ProgressCircle: { value: 72, max: 100, size: 'lg', tone: 'success', showValue: true, label: 'Complete', color: '#16a34a', trackColor: '#dcfce7', mutedColor: '#64748b' },
  StatGroup: { columns: 3, divided: true },
  Heatmap: { cells: [[1, 4, 9], [3, 0, 6], [8, 2, 5]], colorScale: 'brand', cellSize: 'md', xLabels: ['Mon', 'Tue', 'Wed'] },
  Gantt: { tasks: [{ label: 'Design', start: 0, end: 3 }, { label: 'Build', start: 2, end: 7, color: '#0ea5e9' }, { label: 'Launch', start: 7, end: 9 }], rangeMax: 9, palette: 'cool' },
  // ── AI chat ──
  Conversation: { density: 'normal', bordered: true },
  Message: { role: 'assistant', author: 'Frayme', content: 'Sure — here is a draft of the pricing page.', timestamp: '2:14 PM', streaming: false },
  MessageContent: { content: 'Here are the three options I found.', variant: 'text', prose: true },
  PromptInput: { placeholder: 'Ask anything…', name: 'prompt', size: 'md', attach: true, accent: '#6366f1' },
  Reasoning: { content: 'The user wants Q3 revenue. Query the sales table, group by month, sum.', duration: '4s', defaultOpen: false },
  ToolCall: { name: 'search_web', input: '{ "query": "frayme pricing" }', state: 'running', defaultOpen: true },
  Task: { title: 'Querying the sales table', state: 'active' },
  Confirmation: { message: 'Delete 3 files from the project?', confirmLabel: 'Delete', denyLabel: 'Cancel', tone: 'critical' },
  Suggestion: { label: 'Summarize this thread', icon: 'sparkles', size: 'md' },
  TypingIndicator: { label: 'Assistant is typing' },
  // ── AI content ──
  Sources: { title: 'Sources', sources: [{ title: 'json-render docs', url: 'https://json-render.dev', excerpt: 'The open UI spec.' }], variant: 'list' },
  InlineCitation: { index: 1, url: 'https://json-render.dev', excerpt: 'The open UI specification standard.' },
  Artifact: { title: 'fibonacci.ts', kind: 'code', content: 'export const fib = (n) => n < 2 ? n : fib(n - 1) + fib(n - 2);' },
  WebPreview: { url: 'https://json-render.dev', title: 'json-render — the open UI spec', description: 'Render JSON specs to React.' },
  Shimmer: { lines: 3 },
  DiffView: { filename: 'config.ts', before: 'const timeout = 30;\nconst retries = 1;', after: 'const timeout = 60;\nconst retries = 3;', mode: 'unified', showLineNumbers: true },
  // ── advanced inputs (choice) ──
  MultiSelect: { options: [{ label: 'AI', value: 'ai' }, { label: 'Design', value: 'design' }, { label: 'Growth', value: 'growth' }], value: ['ai'], placeholder: 'Pick tags…', max: 5, size: 'md', searchable: true, chips: true, disabled: false, accent: '#7c3aed', borderColor: '#cbd5e1', bg: '#ffffff', menuWidth: '20rem' },
  Combobox: { options: [{ label: 'United Kingdom', value: 'uk' }, { label: 'United States', value: 'us' }], value: 'uk', placeholder: 'Search a country…', creatable: true, loading: false, size: 'md', disabled: false, accent: '#6366f1', borderColor: '#cbd5e1', bg: '#ffffff', menuWidth: '18rem', maxHeight: '16rem' },
  TagInput: { value: ['design', 'ai'], suggestions: ['react', 'ml'], max: 8, placeholder: 'Add a tag…', size: 'md', disabled: false, removable: true, accent: '#7c3aed', borderColor: '#cbd5e1', bg: '#ffffff' },
  SegmentedControl: { options: [{ label: 'Day', value: 'day', icon: 'calendar' }, { label: 'Week', value: 'week' }, { label: 'Month', value: 'month' }], value: 'week', size: 'md', fullWidth: true, iconOnly: false, disabled: false, accent: '#0f172a', accentText: '#ffffff' },
  // ── advanced inputs (numeric) ──
  NumberInput: { value: 3, min: 0, max: 10, step: 1, placeholder: '0', prefix: '£', suffix: 'kg', size: 'md', disabled: false, accent: '#6366f1', borderColor: '#cbd5e1', bg: '#ffffff' },
  RangeSlider: { min: 0, max: 1000, step: 10, valueMin: 200, valueMax: 800, showHistogram: true, histogram: [3, 8, 5, 9, 4, 6, 7], marks: true, size: 'md', disabled: false, accent: '#7c3aed', trackColor: '#e2e8f0' },
  Rating: { value: 4, max: 5, icon: 'star', allowHalf: true, readOnly: false, size: 'md', color: '#f59e0b', accent: '#f97316' },
  OTPInput: { length: 6, value: '123', mask: false, pattern: 'numeric', size: 'md', disabled: false, accent: '#6366f1', borderColor: '#cbd5e1', bg: '#ffffff' },
  // ── advanced inputs (date) ──
  DatePicker: { value: '2026-06-25', placeholder: 'Pick a date', min: '2026-01-01', max: '2026-12-31', size: 'md', disabled: false, format: 'long', accent: '#7c3aed', borderColor: '#cbd5e1', bg: '#ffffff' },
  DateRangePicker: { startValue: '2026-06-19', endValue: '2026-06-25', presets: [{ label: 'Last 7 days', start: '2026-06-19', end: '2026-06-25' }], min: '2026-01-01', max: '2026-12-31', size: 'md', disabled: false, accent: '#7c3aed', borderColor: '#cbd5e1', bg: '#ffffff' },
  Calendar: { month: '2026-06', value: '2026-06-25', events: [{ date: '2026-06-25', label: 'Launch', tone: 'success' }, { date: '2026-06-10', label: 'Review', tone: 'warning' }], view: 'month', selectable: true, weekStartsOn: 'monday', accent: '#7c3aed', size: 'md' },
  // ── data table ──
  DataTable: { columns: [{ key: 'name', label: 'Name', align: 'start', sortable: true, width: '12rem' }, { key: 'rev', label: 'Revenue', align: 'end', sortable: true }], rows: [{ name: 'Acme', rev: '£24k' }, { name: 'Globex', rev: '£12k' }, { name: 'Initech', rev: '£8k' }], selectable: true, sortBy: 'rev', sortDir: 'desc', page: 1, pageSize: 10, striped: true, bordered: true, hoverable: true, density: 'normal', size: 'md', accent: '#7c3aed', headerColor: '#f1f5f9', maxHeight: '24rem' },
  ColumnHeader: { label: 'Revenue', align: 'end', sortable: true, sortDir: 'desc', resizable: true, width: '12rem', accent: '#7c3aed', headerColor: '#f1f5f9' },
  // ── advanced inputs (overlay) ──
  FileUpload: { accept: 'image/*,.pdf', multiple: true, maxSize: '10MB', label: 'Drag & drop or click to upload', hint: 'Up to 5 files', icon: 'upload', files: [{ name: 'logo.png', size: '2.4MB', status: 'done' }, { name: 'spec.pdf', size: '512KB', status: 'uploading' }], size: 'md', disabled: false, accent: '#7c3aed', borderColor: '#cbd5e1', bg: '#f8fafc' },
  CommandPalette: { placeholder: 'Type a command…', groups: [{ heading: 'Actions', items: [{ label: 'New file', icon: 'plus', shortcut: '⌘N', value: 'new' }, { label: 'Search docs', icon: 'search', value: 'search' }] }], value: '', emptyText: 'No results', accent: '#6366f1', bg: '#ffffff', borderColor: '#cbd5e1', menuWidth: '32rem', maxHeight: '20rem' },
  // ── marketing (hero) ──
  Hero: { eyebrow: 'New', title: 'Ship MCP apps', subtitle: 'From a prompt.', align: 'center', size: 'lg', mediaPosition: 'none', actions: [{ label: 'Get started', variant: 'primary', icon: 'arrow-right' }, { label: 'Docs', href: '/docs', variant: 'outline' }], maxWidth: 'lg', gradientFrom: '#7c3aed', gradientTo: '#0ea5e9', accent: '#7c3aed' },
  CTA: { title: 'Ready to build?', description: 'Spin up your first app.', variant: 'banner', align: 'center', tone: 'info', actions: [{ label: 'Start free', variant: 'primary' }], accent: '#6366f1' },
  FeatureGrid: { columns: 3, gap: 'lg', align: 'start', features: [{ icon: 'sparkles', title: 'Generative UI', description: 'Apps from a prompt.' }, { icon: 'lock', title: 'Secure', description: 'No creds proxied.' }, { icon: 'send', title: 'Ship anywhere', description: 'Claude, ChatGPT, web.' }] },
  FeatureCard: { icon: 'sparkles', title: 'Generative UI', description: 'Interactive apps from a prompt.', variant: 'elevated', align: 'start', accent: '#7c3aed' },
  LogoCloud: { title: 'Trusted by', items: [{ src: 'https://cdn.example.com/acme.png', alt: 'Acme' }, { src: 'https://cdn.example.com/globex.png', alt: 'Globex' }], columns: 5, grayscale: true, size: 'md' },
  // ── marketing (page) ──
  Testimonial: { quote: 'Frayme cut our build time in half.', authorName: 'Jordan Lee', authorTitle: 'Head of Product', rating: 5, variant: 'card', accent: '#f59e0b' },
  FAQ: { items: [{ question: 'Can I cancel anytime?', answer: 'Yes.' }, { question: 'Free tier?', answer: 'Yes, 100 generations.' }], allowMultiple: false, variant: 'bordered', defaultOpenIndex: 0, accent: '#7c3aed' },
  Footer: { brand: 'Frayme', tagline: 'Ship MCP apps.', columns: [{ heading: 'Product', links: [{ label: 'Pricing', href: '/pricing' }, { label: 'Docs', href: '/docs' }] }], socials: [{ icon: 'mail', href: 'https://example.com' }], bottomText: '© 2026 Frayme.', variant: 'columns', accent: '#7c3aed' },
  PricingTable: { plans: [{ name: 'Free', price: '£0', period: '/mo', features: ['100 generations'], ctaLabel: 'Get started' }, { name: 'Pro', price: '£99', period: '/mo', features: ['10,000 generations'], highlighted: true, ctaLabel: 'Choose Pro' }], period: 'monthly', columns: 2, accent: '#7c3aed' },
  PlanCard: { name: 'Pro', price: '£99', period: '/mo', description: 'For teams.', features: ['10,000 generations', 'Priority support'], badge: 'Most popular', highlighted: true, ctaLabel: 'Choose Pro', accent: '#7c3aed', bg: '#0b1220' },
  // ── feedback ──
  Banner: { message: 'Scheduled maintenance Sunday.', title: 'Heads up', tone: 'warning', icon: 'auto', actionLabel: 'Details', actionHref: '/status', dismissible: true, align: 'center', accent: '#f59e0b' },
  Callout: { title: 'Heads up', message: 'API keys shown once.', tone: 'warning', icon: 'auto', variant: 'left-accent', dismissible: true, accent: '#f59e0b' },
  InlineMessage: { message: 'Username is available', tone: 'success', icon: 'auto', size: 'md' },
  LoadingOverlay: { active: true, label: 'Loading…', blur: true, spinnerSize: 'md', overlayColor: '#0b1220' },
  NotFound: { code: '404', title: 'Page not found', description: 'It does not exist.', icon: 'search', actionLabel: 'Go home', actionHref: '/', align: 'center' },
  Result: { status: 'success', title: 'Payment successful', description: 'Order confirmed.', actions: [{ label: 'View order', variant: 'primary' }], align: 'center' },
  // ── social & media ──
  FeedItem: { authorName: 'Ada Lovelace', authorTitle: '@ada', timestamp: '2h', body: 'Just shipped the dashboard.', mediaSrc: 'https://example.com/m.jpg', mediaAlt: 'screenshot', actions: [{ icon: 'heart', label: 'Like', count: 24 }, { icon: 'send', label: 'Share', count: 3 }], variant: 'card' },
  AvatarGroup: { items: [{ name: 'Ada Lovelace' }, { name: 'Alan Turing' }, { name: 'Grace Hopper' }, { name: 'Edsger Dijkstra' }], max: 3, size: 'md', ring: true },
  Gallery: { items: [{ src: 'https://example.com/a.jpg', alt: 'Mountain' }, { src: 'https://example.com/b.jpg', alt: 'Lake' }, { src: 'https://example.com/c.jpg', alt: 'Forest' }], columns: 3, gap: 'md', ratio: 'square', lightbox: true },
  MediaGrid: { items: [{ src: 'https://example.com/1.jpg', alt: 'Cover', label: 'Featured' }, { src: 'https://example.com/2.jpg', alt: 'Album', href: 'https://example.com/album' }], columns: 2, gap: 'md', ratio: 'video' },
  Lightbox: { items: [{ src: 'https://example.com/a.jpg', alt: 'Slide 1', caption: 'first' }, { src: 'https://example.com/b.jpg', alt: 'Slide 2' }], index: 0, open: true, overlayColor: '#0b1220' },
  Comment: { authorName: 'Grace Hopper', timestamp: '5m ago', body: 'Great work.', actions: [{ icon: 'send', label: 'Reply' }, { icon: 'heart', label: 'Like' }], depth: 0 },
  CommentThread: { comments: [{ authorName: 'Ada', timestamp: '1h', body: 'Loving it', replies: [{ authorName: 'Alan', timestamp: '50m', body: 'Agreed' }] }], maxDepth: 4, collapsible: true },
  SocialBar: { items: [{ network: 'github', href: 'https://github.com/frayme' }, { network: 'twitter', href: 'https://twitter.com/frayme' }, { network: 'linkedin', href: 'https://www.linkedin.com/company/frayme' }, { network: 'youtube', href: 'https://youtube.com/@frayme' }, { icon: 'mail', href: 'mailto:hi@frayme.ai', label: 'Email' }], variant: 'plain', size: 'md', align: 'start', accent: '#7c3aed' },
  // ── structure (flow) ──
  Timeline: { items: [{ title: 'Order placed', time: '09:24', tone: 'success' }, { title: 'Packed', time: '11:02', description: 'Left the warehouse.' }, { title: 'Out for delivery', time: '14:18', active: true, tone: 'info' }], orientation: 'vertical', align: 'left', size: 'md', accent: '#7c3aed' },
  TimelineItem: { title: 'Deployed to production', time: '2m ago', tone: 'success', active: true, last: false, dotColor: '#16a34a' },
  Stepper: { steps: [{ label: 'Account' }, { label: 'Profile' }, { label: 'Billing' }, { label: 'Done' }], current: 1, orientation: 'horizontal', clickable: true, size: 'md', accent: '#7c3aed' },
  Tree: { nodes: [{ label: 'src', children: [{ label: 'components', children: [{ label: 'Button.tsx' }, { label: 'Card.tsx' }] }, { label: 'index.ts' }] }, { label: 'package.json' }], maxDepth: 6, defaultExpandedDepth: 1, selectable: true, accent: '#7c3aed' },
  // ── structure (layout panes) ──
  SplitPane: { orientation: 'horizontal', splitPercent: 40, minSize: 15, height: '24rem', bordered: true },
  Resizable: { width: '320px', height: '240px', axis: 'horizontal', minWidth: '120px', minHeight: '80px', bordered: true },
  VirtualList: { items: [{ label: 'Alpha', description: 'First item' }, { label: 'Bravo', description: 'Second item' }, { label: 'Charlie', description: 'Third item' }], itemHeight: 44, maxHeight: '20rem', overscan: 4, selectable: true },
  DescriptionList: { items: [{ term: 'Status', description: 'Active' }, { term: 'Plan', description: 'Pro' }, { term: 'Region', description: 'eu-west-2' }], layout: 'inline', density: 'normal', columns: 2, bordered: true },
  // ── board + nav ──
  KanbanBoard: { columns: [{ title: 'To do', count: 2, cards: [{ title: 'Draft launch post' }, { title: 'Wire MCP server' }] }, { title: 'In progress', count: 1, cards: [{ title: 'Ship the docs site', assignee: 'PG', meta: '2d' }] }, { title: 'Done', cards: [{ title: 'Publish the SDK' }] }], gap: 'md', accent: '#94a3b8' },
  BoardColumn: { title: 'In progress', count: 3, accent: '#7c3aed', collapsible: true },
  KanbanCard: { title: 'Wire the MCP server', description: 'Multi-tenant SSE endpoint per workspace slug.', labels: [{ text: 'backend', tone: 'info' }, { text: 'blocked', tone: 'critical' }], assignee: 'Priya Gupta', meta: '#42', moveable: true, accent: '#7c3aed' },
  NavigationMenu: { items: [{ label: 'Home', href: '/' }, { label: 'Products', children: [{ label: 'API', href: '/api', description: 'Compose UI from natural language' }, { label: 'Platform', href: '/platform', description: 'Ship MCP Apps to Claude' }] }, { label: 'Docs', href: '/docs', icon: 'home' }], orientation: 'horizontal', accent: '#7c3aed' },
  // ── filter + composer ──
  FilterBar: { filters: [{ label: 'Status: Open', value: 'status:open', removable: true }, { label: 'Owner: Me', value: 'owner:me', removable: true }], searchPlaceholder: 'Search issues…', searchValue: '', showClear: true, size: 'md', accent: '#7c3aed' },
  FacetList: { title: 'Status', facets: [{ label: 'Open', value: 'open', count: 24 }, { label: 'In progress', value: 'in-progress', count: 8 }, { label: 'Closed', value: 'closed', count: 132 }], selected: ['open'], max: 5, accent: '#7c3aed' },
  FilterPanel: { title: 'Filters', sections: [{ heading: 'Status', facets: [{ label: 'Open', value: 'open', count: 24 }, { label: 'Closed', value: 'closed', count: 132 }] }, { heading: 'Priority', facets: [{ label: 'High', value: 'high', count: 6 }, { label: 'Low', value: 'low', count: 41 }], collapsed: true }], accent: '#7c3aed' },
  RichComposer: { value: '', placeholder: 'Write a comment…', toolbar: ['bold', 'italic', 'link', 'bullet', 'code'], maxLength: 500, submitLabel: 'Send', size: 'md', accent: '#7c3aed' },
  // ── charts (proportion) ──
  PieChart: { data: [{ label: 'Chrome', value: 64 }, { label: 'Safari', value: 19, color: '#0ea5e9' }, { label: 'Firefox', value: 9 }, { label: 'Other', value: 8 }], palette: 'brand', height: '220px', showLegend: true, showValues: true },
  FunnelChart: { stages: [{ label: 'Visited', value: 1000 }, { label: 'Signed up', value: 420 }, { label: 'Activated', value: 180, color: '#7c3aed' }, { label: 'Paid', value: 64 }], orientation: 'vertical', palette: 'cool', showValues: true, showPercent: true, height: '240px', size: 'md' },
  ScatterChart: { series: [{ name: 'Cohort A', points: [{ x: 1, y: 2 }, { x: 3, y: 5 }, { x: 5, y: 4 }, { x: 7, y: 9 }], color: '#7c3aed' }], palette: 'brand', height: '240px', size: 'md', showGrid: true, showLegend: true },
  RadarChart: { axes: ['Speed', 'Power', 'Range', 'Cost', 'Comfort'], series: [{ name: 'Model X', values: [80, 65, 90, 40, 75], color: '#7c3aed' }], palette: 'brand', height: '260px', showLegend: true },
  Sankey: { nodes: [{ label: 'Visitors' }, { label: 'Sign-ups' }, { label: 'Trials' }, { label: 'Paid', color: '#16a34a' }], links: [{ source: 0, target: 1, value: 500 }, { source: 1, target: 2, value: 220 }, { source: 2, target: 3, value: 90 }], nodeWidth: 'md', palette: 'brand', height: '240px', showValues: true },
  // ── charts (radial) ──
  Gauge: { value: 72, min: 0, max: 100, tone: 'warning', unit: '%', label: 'CPU load', size: 'md', showValue: true, trackColor: '#e2e8f0' },
  RadialBar: { data: [{ label: 'Mobile', value: 78 }, { label: 'Desktop', value: 54, color: '#0ea5e9' }, { label: 'Tablet', value: 31 }], max: 100, palette: 'brand', trackColor: '#f1f5f9', height: '220px', showLegend: true, showValues: true },
  Tracker: { data: [{ tone: 'success', tooltip: 'Operational' }, { tone: 'success', tooltip: 'Operational' }, { tone: 'warning', tooltip: 'Degraded' }, { color: '#16a34a', tooltip: 'Custom', label: 'OK' }], size: 'md', rounded: true, showLabels: false, gap: 'sm' },
  Candlestick: { data: [{ label: 'Mon', open: 30, high: 36, low: 28, close: 34 }, { label: 'Tue', open: 34, high: 38, low: 32, close: 31 }, { label: 'Wed', open: 31, high: 35, low: 29, close: 35 }], height: '240px', showGrid: true, showAxis: true, size: 'md' },
  Treemap: { data: [{ label: 'Engineering', value: 48 }, { label: 'Sales', value: 26, color: '#0ea5e9' }, { label: 'Marketing', value: 16 }, { label: 'Support', value: 10 }], palette: 'brand', height: '240px', showValues: true, size: 'md' },
  // ── media (extended) ──
  VideoPlayer: { src: 'https://example.com/demo.mp4', poster: 'https://example.com/poster.jpg', controls: true, autoplay: false, loop: false, muted: false, aspect: '16/9', radius: 'md', width: '100%', caption: 'Product demo' },
  AudioPlayer: { src: 'https://example.com/track.mp3', title: 'Episode 12 — Shipping MCP Apps', controls: true, loop: false, accent: '#7c3aed', radius: 'md' },
  Marquee: { items: ['Anthropic', 'OpenAI', 'Vercel', 'Microsoft'], direction: 'left', speed: 'normal', pauseOnHover: true, gap: 'md', fade: true },
  Figure: { src: 'https://example.com/chart.png', alt: 'Revenue chart', caption: 'Q4 revenue by product line', credit: 'Photo: NASA', align: 'center', ratio: '16/9', radius: 'md', bordered: true, width: '480px' },
  Thumbnail: { src: 'https://example.com/avatar.png', alt: 'Ada Lovelace', size: 'md', radius: 'md', bordered: true, fallbackInitials: 'AL' },
  YouTube: { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', thumbnailQuality: 'hq', aspect: '16/9', showTitle: true, radius: 'md', width: '100%' },
  // ── inputs (specialized) ──
  ColorPicker: { value: '#6366f1', swatches: [{ color: '#6366f1' }, { color: '#10b981' }, { color: '#f59e0b' }, { color: '#ef4444' }], showInput: true, columns: 6, accent: '#7c3aed', size: 'md', label: 'Brand color', disabled: false },
  TimePicker: { value: '09:30', minuteStep: 15, accent: '#7c3aed', size: 'md', label: 'Start time', disabled: false },
  QuantityStepper: { value: 1, min: 1, max: 10, step: 1, accent: '#7c3aed', size: 'md', label: 'Quantity', disabled: false },
  PhoneInput: { value: '7700900000', countries: [{ code: 'GB', dial: '+44', flag: '🇬🇧' }, { code: 'US', dial: '+1', flag: '🇺🇸' }], country: 'GB', placeholder: '7700 900000', accent: '#7c3aed', size: 'md', label: 'Phone', disabled: false },
  CopyButton: { value: 'npm i @frayme/runtime', label: 'Copy command', copiedLabel: 'Copied!', variant: 'outline', size: 'md', icon: 'copy' },
  // ── util + overlay ──
  Toggletip: { label: 'Pricing', icon: 'info', content: 'Charges renew monthly. Cancel anytime.', side: 'top', accent: '#7c3aed', size: 'md' },
  Backdrop: { active: true, blur: 'sm', overlayColor: '#000000', opacity: 'medium', label: 'Saving…', zone: 'rounded' },
  HoverCard: { trigger: '@frayme', title: 'Frayme', description: 'Ship MCP Apps without code.', imageSrc: 'https://example.com/logo.png', side: 'bottom', accent: '#7c3aed' },
  Kbd: { keys: ['Cmd', 'K'], size: 'md', variant: 'solid' },
  Highlight: { text: 'The quick brown fox jumps', query: 'quick fox', caseSensitive: false, wholeWord: false, tone: 'warning', accent: '#fde68a' },
  // ── data (long-tail) ──
  JsonView: { data: { user: { name: 'Ada', roles: ['admin', 'editor'], active: true }, count: 3 }, defaultExpandedDepth: 2, maxDepth: 8, accent: '#7c3aed', showCount: true, size: 'md' },
  Menubar: { menus: [{ label: 'File', items: [{ label: 'New', shortcut: '⌘N', icon: 'plus' }, { label: 'Save', shortcut: '⌘S', icon: 'save' }, { separator: true }, { label: 'Export', icon: 'download' }] }, { label: 'Edit', items: [{ label: 'Undo', shortcut: '⌘Z' }, { label: 'Redo', shortcut: '⇧⌘Z', disabled: true }] }], accent: '#7c3aed', size: 'md', dense: false },
  Fab: { icon: 'plus', label: 'Create', actions: [{ label: 'New doc', icon: 'edit' }, { label: 'Upload', icon: 'upload' }, { label: 'Invite', icon: 'users', tone: 'info' }], position: 'bottom-right', accent: '#7c3aed', accentText: '#ffffff', size: 'md' },
  RelativeTime: { target: '2026-06-25T09:00:00Z', mode: 'relative', format: 'short', prefix: 'Updated', suffix: null, tone: 'neutral' },
};

const REAL_TYPES = Object.keys(EXAMPLES);

describe('default registry covers the catalog', () => {
  it('the example table covers every non-stub catalog component', () => {
    const catalogNames = fraymeCatalog.componentNames;
    for (const name of REAL_TYPES) {
      expect(catalogNames, `${name} missing from catalog`).toContain(name);
    }
  });

  it.each(REAL_TYPES)('%s renders strict-valid without fallback', (type) => {
    const spec = {
      root: 'el',
      elements: { el: { type, props: EXAMPLES[type] } },
      state: { ui: { open: true } },
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="strict" />);
    expect(container.querySelector('.frayme-invalid'), `${type} failed catalog validation`).toBeNull();
    expect(
      container.querySelector('[data-frayme-fallback]'),
      `${type} fell through to Fallback`,
    ).toBeNull();
    expect(container.querySelector('.frayme-root')!.innerHTML.length).toBeGreaterThan(0);
  });

  it.each([...REAL_TYPES, 'StripeCheckout'])(
    '%s survives a props-less element (mid-stream patches deliver props later)',
    (type) => {
      // Regression: live demo caught "Cannot read properties of undefined (reading 'page')"
      // when a streamed element arrived before its props patch.
      const spec = {
        root: 'el',
        elements: { el: { type } },
      } as unknown as Spec;
      expect(() => render(<FraymeRenderer spec={spec} mode="progressive" />)).not.toThrow();
    },
  );

  it('stub types render the inert Fallback (never crash, never execute)', () => {
    const spec = {
      root: 'el',
      elements: { el: { type: 'StripeCheckout', props: {} } },
    } as unknown as Spec;
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" />);
    expect(container.querySelector('[data-frayme-fallback="StripeCheckout"]')).toBeTruthy();
  });
});

/**
 * Value-over-enum precedence — `safeColor value > tone (enum) > variant/type (enum) >
 * token default`, implemented with a CONDITIONAL override class. When the model
 * does NOT supply a color, NO override class is added (the tone/variant class
 * wins); when it DOES, the arbitrary `[background:var(--fr-…)]` override is added
 * last (and the inline CSS var is set), so the value wins.
 */
describe('value > enum precedence (Badge / Alert)', () => {
  const renderEl = (type: string, props: Record<string, unknown>) => {
    const spec = {
      root: 'el',
      elements: { el: { type, props } },
    } as unknown as Spec;
    return render(<FraymeRenderer spec={spec} mode="progressive" />).container;
  };

  it('Badge WITHOUT a color → tone enum class present, no override var/class', () => {
    const c = renderEl('Badge', { text: 'Active', tone: 'success' });
    const el = c.querySelector('.frayme-root')!.firstElementChild as HTMLElement;
    expect(el).toBeTruthy();
    // tone enum drives a real bg-* class; the override arbitrary utility + inline
    // var are both absent.
    expect(el.className).toContain('bg-[color-mix(in_srgb,var(--frayme-success)_12%,transparent)]');
    expect(el.className).not.toContain('[background:var(--fr-badge-bg)]');
    expect(el.getAttribute('style') ?? '').not.toContain('--fr-badge-bg');
  });

  it('Badge WITH a bg value → override class + inline var present (value wins)', () => {
    const c = renderEl('Badge', { text: 'PRO', tone: 'success', bg: '#7c3aed' });
    const el = c.querySelector('.frayme-root')!.firstElementChild as HTMLElement;
    expect(el).toBeTruthy();
    // the conditional override utility is appended AND the var is set on style.
    expect(el.className).toContain('[background:var(--fr-badge-bg)]');
    expect(el.getAttribute('style') ?? '').toContain('--fr-badge-bg');
  });

  it('Alert WITHOUT a color → type/tone token-mix class, no override var', () => {
    const c = renderEl('Alert', { title: 'Saved', tone: 'success' });
    const el = c.querySelector('.frayme-root')!.firstElementChild as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.className).not.toContain('[background:var(--fr-alert-bg');
    expect(el.getAttribute('style') ?? '').not.toContain('--fr-alert-bg');
  });

  it('Alert WITH a bg value → override class + inline var present (value wins)', () => {
    const c = renderEl('Alert', { title: 'Promo', tone: 'success', bg: '#eef2ff' });
    const el = c.querySelector('.frayme-root')!.firstElementChild as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.className).toContain('[background:var(--fr-alert-bg,var(--fr-surface-sunken,var(--color-muted)))]');
    expect(el.getAttribute('style') ?? '').toContain('--fr-alert-bg');
  });
});

/**
 * Action precedence — the same CONDITIONAL-override-class technique for the action
 * components. A model-named `accent` recolors the Button fill (over the variant/
 * tone enum) via `[background:var(--fr-btn-accent)]`; absent → the enum class
 * wins. Toggle's pressed color routes through the `aria-pressed:` variant.
 */
describe('value > enum precedence + active-state recipe (actions)', () => {
  const renderEl = (type: string, props: Record<string, unknown>) => {
    const spec = {
      root: 'el',
      elements: { el: { type, props } },
    } as unknown as Spec;
    return render(<FraymeRenderer spec={spec} mode="progressive" />).container;
  };

  it('Button WITHOUT accent → variant enum class present, no override var/class', () => {
    const c = renderEl('Button', { label: 'Go', variant: 'primary' });
    const el = c.querySelector('button') as HTMLElement;
    expect(el).toBeTruthy();
    // primary renders as the NEUTRAL high-contrast surface — the assertion
    // tracks the variant class, not the old brand-fill token.
    expect(el.className).toContain('bg-[color:var(--fr-btn-fill,var(--color-foreground))]');
    expect(el.className).not.toContain('[background:var(--fr-btn-accent)]');
    expect(el.getAttribute('style') ?? '').not.toContain('--fr-btn-accent:');
  });

  it('Button WITH accent (solid) → override class + inline var present (value wins)', () => {
    const c = renderEl('Button', { label: 'Go', variant: 'primary', accent: '#7c3aed' });
    const el = c.querySelector('button') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.className).toContain('[background:var(--fr-btn-accent)]');
    expect(el.getAttribute('style') ?? '').toContain('--fr-btn-accent');
  });

  it('Button loading → disabled + aria-busy + a spinner', () => {
    const c = renderEl('Button', { label: 'Save', loading: true });
    const el = c.querySelector('button') as HTMLButtonElement;
    expect(el.disabled).toBe(true);
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelector('.animate-spin')).toBeTruthy();
  });

  it('Toggle activeColor → the aria-pressed: recipe var is set inline', () => {
    const c = renderEl('Toggle', { label: 'Bold', pressed: true, activeColor: '#16a34a' });
    const el = c.querySelector('button') as HTMLElement;
    expect(el.getAttribute('aria-pressed')).toBe('true');
    expect(el.getAttribute('style') ?? '').toContain('--fr-toggle-active');
  });

  it('iconOnly Toggle keeps the label as the accessible name (aria-label)', () => {
    const c = renderEl('Toggle', { label: 'Bold', iconOnly: true, icon: 'bold' });
    const el = c.querySelector('button') as HTMLElement;
    expect(el.getAttribute('aria-label')).toBe('Bold');
    // the icon renders an svg; the visible label text is suppressed.
    expect(el.querySelector('svg')).toBeTruthy();
  });

  it('Pagination active page carries aria-current=page', () => {
    const c = renderEl('Pagination', { totalPages: 5, page: 2 });
    const current = c.querySelector('[aria-current="page"]') as HTMLElement;
    expect(current).toBeTruthy();
    expect(current.textContent).toBe('2');
  });
});
