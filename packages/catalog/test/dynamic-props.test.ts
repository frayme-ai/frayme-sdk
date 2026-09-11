import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/validate/index.js';

/**
 * Layout + Overlay dynamic-prop surface.
 *
 * Each of the layout/overlay components gets a RICHLY-configured element
 * exercising its enum + value-channel (safeColor / safeDimension) props.
 * Every rich spec must pass
 * `validateSpec(spec, { resolution: true })` — catalog shape + the value-channel
 * gate. A handful of adversarial fixtures (unsafe color, unsafe dimension,
 * var() color, calc() dimension) must be REJECTED with `'unsafe_value'`.
 */

/** Wrap a single rich element under a root Stack so referential checks pass. */
const wrap = (id: string, el: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  root: 'root',
  state: { open: false, tab: 'a', coll: false },
  elements: {
    root: { type: 'Stack', props: { gap: 'md' }, children: [id] },
    [id]: el,
    ...extra,
  },
});

/** The 12 richly-configured specs (one per Phase-1 component). */
const RICH: Array<{ name: string; spec: unknown }> = [
  {
    name: 'Card — surface/gradient + colors + radius + padding + width',
    spec: wrap('c', {
      type: 'Card',
      props: {
        title: 'Pro plan',
        description: 'Everything in Starter, plus more.',
        surface: 'gradient',
        accent: '#7c3aed',
        bg: 'oklch(0.98 0.01 280)',
        borderColor: '#e9d5ff',
        gradientFrom: '#7c3aed',
        gradientTo: '#0ea5e9',
        radius: 'lg',
        padding: 'lg',
        align: 'center',
        bordered: true,
        centered: true,
        maxWidth: 'md', // enum — must NOT be flagged by the value-channel gate
        width: '640px', // dimension escape hatch (the value channel)
      },
      children: ['price'],
    }, { price: { type: 'Text', props: { text: '£99/mo' } } }),
  },
  {
    name: 'Stack — wrap + padding + bg + gapValue',
    spec: wrap('s', {
      type: 'Stack',
      props: {
        direction: 'vertical',
        gapValue: '28px',
        padding: 'lg',
        bg: '#0b1220',
        align: 'center',
        wrap: false,
      },
      children: ['logo'],
    }, { logo: { type: 'Text', props: { text: 'Frayme' } } }),
  },
  {
    name: 'Grid — minColWidth + gapValue + align + bg + rows',
    spec: wrap('g', {
      type: 'Grid',
      props: {
        minColWidth: '220px',
        gapValue: '20px',
        align: 'start',
        bg: 'rgb(248,250,252)',
        rows: 2,
      },
      children: ['g1'],
    }, { g1: { type: 'Card', props: { title: 'A' } } }),
  },
  {
    name: 'Grid — fixed columns count',
    spec: wrap('g2', {
      type: 'Grid',
      props: { columns: 3, gap: 'md' },
      children: ['gg1'],
    }, { gg1: { type: 'Card', props: { title: 'B' } } }),
  },
  {
    name: 'Separator — style + color + spacing + thickness + length + label',
    spec: wrap('sep', {
      type: 'Separator',
      props: {
        style: 'dashed',
        color: '#cbd5e1',
        spacing: 'lg',
        thickness: 'thin',
        length: '60%',
        label: 'OR',
      },
    }),
  },
  {
    name: 'Tabs — variant/pill + size + align + accent + fitted',
    spec: wrap('t', {
      type: 'Tabs',
      props: {
        tabs: [
          { label: 'Day', value: 'd' },
          { label: 'Week', value: 'w' },
          { label: 'Month', value: 'm' },
        ],
        variant: 'pill',
        size: 'sm',
        align: 'center',
        accent: '#0ea5e9',
        fitted: true,
        defaultValue: 'w',
      },
      children: ['tab-body'],
    }, { 'tab-body': { type: 'Text', props: { text: 'Tab content' } } }),
  },
  {
    name: 'Accordion — type/multiple + variant + accent + borderColor + defaultOpenIndex',
    spec: wrap('a', {
      type: 'Accordion',
      props: {
        items: [
          { title: 'What is Frayme?', content: 'NL → MCP apps.' },
          { title: 'Pricing', content: 'From £29/mo.' },
        ],
        type: 'multiple',
        variant: 'separated',
        size: 'lg',
        radius: 'lg',
        accent: '#7c3aed',
        borderColor: '#ede9fe',
        defaultOpenIndex: [0],
      },
    }),
  },
  {
    name: 'Collapsible — variant/ghost + accent + iconPosition + binding open',
    spec: wrap('col', {
      type: 'Collapsible',
      props: {
        title: 'Show details',
        variant: 'ghost',
        size: 'sm',
        radius: 'sm',
        accent: '#0ea5e9',
        borderColor: '#dbeafe',
        iconPosition: 'start',
        open: { $bindState: '/coll' },
      },
      children: ['col-body'],
    }, { 'col-body': { type: 'Text', props: { text: 'Details here.' } } }),
  },
  {
    name: 'Carousel — itemWidth + gap + radius + cardBg + borderColor + showControls',
    spec: wrap('car', {
      type: 'Carousel',
      props: {
        items: [
          { title: 'Starter', description: '£29' },
          { title: 'Pro', description: '£99' },
        ],
        itemWidth: '18rem',
        gap: 'lg',
        align: 'center',
        radius: 'lg',
        cardBg: '#0b1220',
        borderColor: '#1e293b',
        showControls: true,
      },
    }),
  },
  {
    name: 'Dialog — size + radius + bg + overlayColor + width + dismissable + showClose',
    spec: wrap('d', {
      type: 'Dialog',
      props: {
        title: 'Upgrade to Pro',
        description: 'Unlock everything.',
        openPath: '/open',
        size: 'lg',
        radius: 'lg',
        padding: 'lg',
        align: 'center',
        bg: 'oklch(0.99 0.005 280)',
        overlayColor: 'rgba(15,23,42,0.6)',
        width: '640px',
        dismissable: false,
        showClose: true,
      },
      children: ['d-body'],
    }, { 'd-body': { type: 'Text', props: { text: 'Plans...' } } }),
  },
  {
    name: 'Drawer — side/right + size + bg + overlayColor + sizeValue',
    spec: wrap('dr', {
      type: 'Drawer',
      props: {
        title: 'Cart',
        description: 'Your items',
        openPath: '/open',
        side: 'right',
        size: 'lg',
        radius: 'md',
        padding: 'lg',
        bg: '#0b1220',
        overlayColor: 'rgba(0,0,0,0.55)',
        sizeValue: '420px',
        dismissable: true,
        showClose: true,
      },
      children: ['dr-body'],
    }, { 'dr-body': { type: 'Text', props: { text: 'Line items' } } }),
  },
  {
    name: 'Tooltip — placement + size + bg + color',
    spec: wrap('tt', {
      type: 'Tooltip',
      props: {
        text: 'Beta',
        content: 'This feature is in preview',
        placement: 'right',
        size: 'md',
        bg: '#7c3aed',
        color: '#ffffff',
      },
    }),
  },
  {
    name: 'Popover — triggerVariant + placement + align + size + width + colors',
    spec: wrap('po', {
      type: 'Popover',
      props: {
        trigger: 'Account',
        content: 'Signed in as jane@acme.co',
        triggerVariant: 'outline',
        placement: 'bottom',
        align: 'end',
        size: 'lg',
        radius: 'lg',
        width: '16rem',
        bg: '#0b1220',
        borderColor: '#1e293b',
        accent: '#0ea5e9',
      },
    }),
  },
];

describe('Layout + Overlay dynamic props — rich specs validate with resolution ON', () => {
  it.each(RICH)('$name', ({ spec }) => {
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });

  it('covers all 12 Phase-1 components', () => {
    const types = new Set<string>();
    for (const { spec } of RICH) {
      const elements = (spec as { elements: Record<string, { type: string }> }).elements;
      for (const el of Object.values(elements)) types.add(el.type);
    }
    for (const name of [
      'Card', 'Stack', 'Grid', 'Separator', 'Tabs', 'Accordion',
      'Collapsible', 'Carousel', 'Dialog', 'Drawer', 'Tooltip', 'Popover',
    ]) {
      expect(types.has(name), `${name} not exercised by a rich spec`).toBe(true);
    }
  });
});

describe('Layout + Overlay dynamic props — adversarial value channels are rejected', () => {
  const ADVERSARIAL: Array<{ name: string; spec: unknown }> = [
    {
      name: 'unsafe color on Card bg (injection)',
      spec: wrap('c', { type: 'Card', props: { title: 'X', bg: 'red;background:url(//evil)' } }),
    },
    {
      name: 'unsafe dimension on Dialog width (break-out)',
      spec: wrap('d', { type: 'Dialog', props: { title: 'X', openPath: '/open', width: '10px;}x{' } }),
    },
    {
      name: 'var() color on Card accent (tokens are an enum concern, not a value)',
      spec: wrap('c', { type: 'Card', props: { title: 'X', accent: 'var(--evil)' } }),
    },
    {
      name: 'calc() dimension on Carousel itemWidth',
      spec: wrap('car', {
        type: 'Carousel',
        props: { items: [{ title: 'A', description: 'a' }], itemWidth: 'calc(100% - 1px)' },
      }),
    },
  ];

  it.each(ADVERSARIAL)('rejects: $name', ({ spec }) => {
    // Old path is blind (unknown value props are stripped; shape is fine).
    expect(validateSpec(spec).valid).toBe(true);
    const gated = validateSpec(spec, { resolution: true });
    expect(gated.valid).toBe(false);
    expect(gated.failureCategory).toBe('unsafe_value');
    expect(gated.errors.length).toBeGreaterThan(0);
  });
});

/* ─────────────────────────── Data-Display ───────────────────────────────── */

/**
 * Data-Display dynamic-prop surface.
 *
 * Each of the data-display components gets a RICHLY-configured element
 * exercising its enum + value-channel (safeColor / safeDimension) props.
 * Every rich spec must pass
 * `validateSpec(spec, { resolution: true })`. Adversarial fixtures (unsafe color
 * on Badge bg, unsafe dimension on Image width, var() on Alert accent, calc() on
 * Skeleton width) must be REJECTED with `'unsafe_value'`.
 */
const RICH_DD: Array<{ name: string; spec: unknown }> = [
  {
    name: 'Table — size/density/striped/bordered/align/stickyHeader + accent',
    spec: wrap('t', {
      type: 'Table',
      props: {
        columns: ['Service', 'Status', 'Cost'],
        rows: [
          ['API', 'Healthy', '$21'],
          ['DB', 'Healthy', '$8'],
        ],
        caption: 'June spend',
        size: 'sm',
        density: 'compact',
        striped: true,
        bordered: 'grid',
        hover: true,
        align: 'left',
        stickyHeader: true,
        // `headerColor` is a DATATABLE channel — plain Table does not declare it
        // (the prop gate names undeclared props).
        accent: '#e2e8f0',
      },
    }),
  },
  {
    name: 'Heading — level/size/weight/align/tone/tracking/truncate + color',
    spec: wrap('h', {
      type: 'Heading',
      props: {
        text: 'Q3 Revenue',
        level: 'h2',
        size: '2xl',
        weight: 'bold',
        align: 'center',
        tone: 'default',
        tracking: 'tight',
        truncate: true,
        color: 'oklch(0.55 0.2 264)',
      },
    }),
  },
  {
    name: 'Text — variant/size/weight/align/tone/italic/truncate/mono + color + clamp',
    spec: wrap('p', {
      type: 'Text',
      props: {
        text: 'This change is irreversible — export your data first.',
        variant: 'body',
        size: 'sm',
        weight: 'medium',
        align: 'justify',
        tone: 'warning',
        italic: true,
        truncate: false,
        mono: false,
        color: '#b45309',
        clamp: 2,
      },
    }),
  },
  {
    name: 'Image — aspect/fit/position/radius/border/shadow/loading + width + height + borderColor',
    spec: wrap('img', {
      type: 'Image',
      props: {
        src: 'https://cdn.acme.com/avatar.jpg',
        alt: 'Team',
        width: '100%',
        height: '240px',
        aspect: '16/9',
        fit: 'cover',
        position: 'top',
        radius: 'lg',
        border: true,
        shadow: 'md',
        loading: 'lazy',
        borderColor: '#e2e8f0',
      },
    }),
  },
  {
    name: 'Avatar — size/shape/ring/border + bg + color + ringColor',
    spec: wrap('a', {
      type: 'Avatar',
      props: {
        name: 'Jane Doe',
        size: 'lg',
        shape: 'rounded',
        ring: 'success',
        border: true,
        bg: '#1e293b',
        color: '#f8fafc',
        ringColor: '#22c55e',
      },
    }),
  },
  {
    name: 'Badge — variant/tone/size/shape/dot/uppercase + bg + color + borderColor + dotColor',
    spec: wrap('b', {
      type: 'Badge',
      props: {
        text: 'PRO',
        variant: 'outline',
        size: 'sm',
        shape: 'rounded',
        dot: true,
        uppercase: true,
        bg: '#7c3aed',
        color: '#ffffff',
        borderColor: '#5b21b6',
        dotColor: '#c4b5fd',
      },
    }),
  },
  {
    name: 'Alert — type/tone/variant/size/align/icon/dismissible/accentBar + bg + borderColor + accent',
    spec: wrap('al', {
      type: 'Alert',
      props: {
        title: 'New: Canvas mode',
        message: 'Shared state across tools is now live.',
        type: 'info',
        variant: 'subtle',
        size: 'lg',
        align: 'left',
        icon: 'info',
        dismissible: true,
        accentBar: true,
        accent: '#6366f1',
        bg: '#eef2ff',
        borderColor: '#c7d2fe',
      },
    }),
  },
  {
    name: 'Progress — tone/size/shape/showValue/striped/animated/indeterminate + color + trackColor',
    spec: wrap('pr', {
      type: 'Progress',
      props: {
        value: 18,
        max: 20,
        label: 'Storage',
        tone: 'warning',
        size: 'md',
        shape: 'pill',
        showValue: 'fraction',
        striped: true,
        animated: true,
        indeterminate: false,
        color: '#d97706',
        trackColor: '#f1f5f9',
      },
    }),
  },
  {
    name: 'Skeleton — shape/radius/animation/tone + width + height + lines',
    spec: wrap('sk', {
      type: 'Skeleton',
      props: {
        shape: 'line',
        radius: 'sm',
        animation: 'shimmer',
        tone: 'subtle',
        width: '80%',
        height: '0.75rem',
        lines: 3,
      },
    }),
  },
  {
    name: 'Spinner — size/tone/variant/speed/thickness/labelPosition + color + trackColor',
    spec: wrap('sp', {
      type: 'Spinner',
      props: {
        size: 'lg',
        label: 'Composing your app',
        tone: 'info',
        variant: 'ring',
        speed: 'fast',
        thickness: 'thick',
        labelPosition: 'bottom',
        color: '#2563eb',
        trackColor: '#dbeafe',
      },
    }),
  },
];

describe('Data-Display dynamic props — rich data-display specs validate with resolution ON', () => {
  it.each(RICH_DD)('$name', ({ spec }) => {
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });

  it('covers all 10 Phase-2 data-display components', () => {
    const types = new Set<string>();
    for (const { spec } of RICH_DD) {
      const elements = (spec as { elements: Record<string, { type: string }> }).elements;
      for (const el of Object.values(elements)) types.add(el.type);
    }
    for (const name of [
      'Table', 'Heading', 'Text', 'Image', 'Avatar',
      'Badge', 'Alert', 'Progress', 'Skeleton', 'Spinner',
    ]) {
      expect(types.has(name), `${name} not exercised by a rich spec`).toBe(true);
    }
  });
});

describe('Data-Display dynamic props — adversarial value channels are rejected', () => {
  const ADVERSARIAL_DD: Array<{ name: string; spec: unknown }> = [
    {
      name: 'unsafe color on Badge bg (injection)',
      spec: wrap('b', { type: 'Badge', props: { text: 'X', bg: '#fff;background:url(//evil)' } }),
    },
    {
      name: 'unsafe dimension on Image width (break-out)',
      spec: wrap('img', { type: 'Image', props: { alt: 'x', src: 'https://acme.com/a.png', width: '10px;}x{' } }),
    },
    {
      name: 'var() color on Alert accent (tokens are an enum concern, not a value)',
      spec: wrap('al', { type: 'Alert', props: { title: 'X', accent: 'var(--evil)' } }),
    },
    {
      name: 'calc() dimension on Skeleton width',
      spec: wrap('sk', { type: 'Skeleton', props: { width: 'calc(100% - 1px)' } }),
    },
  ];

  it.each(ADVERSARIAL_DD)('rejects: $name', ({ spec }) => {
    // Old path is blind (unknown value props are stripped; shape is fine).
    expect(validateSpec(spec).valid).toBe(true);
    const gated = validateSpec(spec, { resolution: true });
    expect(gated.valid).toBe(false);
    expect(gated.failureCategory).toBe('unsafe_value');
    expect(gated.errors.length).toBeGreaterThan(0);
  });
});

/* ────────────────────────────── Forms ───────────────────────────────────── */

/**
 * Forms dynamic-prop surface.
 *
 * Each of the 7 form components gets a RICHLY-configured element exercising the
 * shared `formFieldBase` (disabled/readonly/required/helpText/errorText/size/
 * labelPlacement/accent/width) plus its component-specific props. Every rich
 * spec must pass `validateSpec(spec, { resolution: true })`.
 *
 * Numeric-vs-dimension split: `min`/`max`/`step`/`rows`/`minLength`/
 * `maxLength` are plain `z.number()` — NOT routed through safeDimension. Only the
 * STRING dimension props (`width`, `minHeight`, `maxHeight`, `gapValue`) use the
 * dimension channel + are gate-covered (DIM_KEYS).
 *
 * Radio reconciliation: the exact option-spacing dimension is `gapValue` (a gate
 * DIM_KEY), NOT `gap` (which is an ENUM here, like Stack's). The rich Radio spec
 * exercises BOTH.
 *
 * Adversarial fixtures (unsafe color on Input `bg`, unsafe dimension on Textarea
 * `minHeight`, var() on Switch `offColor`) must be REJECTED with 'unsafe_value'.
 */
const RICH_FORMS: Array<{ name: string; spec: unknown }> = [
  {
    name: 'Input — type/inputMode/autocomplete/radius/align + bg/borderColor + numeric bounds + base (size/accent/width/required/...)',
    spec: wrap('email', {
      type: 'Input',
      props: {
        label: 'Budget',
        name: 'amount',
        type: 'number',
        inputMode: 'decimal',
        autocomplete: 'off',
        autofocus: true,
        radius: 'lg',
        align: 'right',
        prefix: '£',
        suffix: '.00',
        // numeric props stay z.number() — must NOT be flagged by the dim gate
        min: 0,
        max: 100000,
        step: 50,
        minLength: 1,
        maxLength: 8,
        borderColor: '#e4e4e7',
        bg: '#fafafa',
        // formFieldBase
        size: 'lg',
        labelPlacement: 'top',
        accent: '#6d28d9',
        width: '12rem',
        required: true,
        disabled: false,
        readonly: false,
        helpText: 'Monthly, before tax',
        errorText: null,
        value: { $bindState: '/form/amount' },
        checks: [{ type: 'min', message: 'Must be positive', args: { value: 0 } }],
        validateOn: 'blur',
      },
    }),
  },
  {
    name: 'Textarea — showCount/resize/autosize/radius + bg/borderColor + minHeight/maxHeight(D) + rows(number) + base',
    spec: wrap('notes', {
      type: 'Textarea',
      props: {
        label: 'Release notes',
        name: 'notes',
        rows: 8, // number, not dimension
        maxLength: 500, // number
        showCount: true,
        resize: 'vertical',
        autosize: true,
        radius: 'md',
        accent: '#0ea5e9',
        borderColor: '#cbd5e1',
        bg: '#ffffff',
        minHeight: '6rem',
        maxHeight: '20rem',
        size: 'sm',
        required: true,
        validateOn: 'submit',
        helpText: 'Markdown supported',
        checks: [{ type: 'maxLength', message: 'Keep it under 500 chars', args: { value: 500 } }],
        value: { $bindState: '/form/notes' },
      },
    }),
  },
  {
    name: 'Select — clearable/radius + bg/borderColor + accent(base) + width',
    spec: wrap('plan', {
      type: 'Select',
      props: {
        label: 'Plan',
        name: 'plan',
        options: ['Starter', 'Pro', 'Scale'],
        placeholder: 'Choose a plan',
        clearable: true,
        radius: 'md',
        borderColor: '#cbd5e1',
        bg: '#ffffff',
        accent: '#16a34a',
        size: 'lg',
        width: '20rem',
        required: true,
        validateOn: 'change',
        checks: [{ type: 'required', message: 'Pick a plan' }],
        value: { $bindState: '/form/plan' },
      },
    }),
  },
  {
    name: 'Checkbox — indeterminate + description + accent(base) drives the box fill',
    spec: wrap('marketing', {
      type: 'Checkbox',
      props: {
        label: 'Email me product updates',
        name: 'marketing',
        indeterminate: false,
        description: 'No more than once a month. Unsubscribe anytime.',
        size: 'lg',
        accent: '#db2777',
        required: true,
        helpText: null,
        checks: [{ type: 'required', message: 'Please confirm' }],
        checked: { $bindState: '/form/marketing' },
      },
    }),
  },
  {
    name: 'Radio — orientation + gap(ENUM) + gapValue(DIM) + accent(base); both spacing channels',
    spec: wrap('billing', {
      type: 'Radio',
      props: {
        label: 'Billing cycle',
        name: 'billing',
        options: ['Monthly', 'Yearly'],
        orientation: 'horizontal',
        gap: 'md', // coarse ENUM (not flagged by the dim gate)
        gapValue: '1rem', // exact dimension (gate DIM_KEY) — the reconciliation
        size: 'lg',
        accent: '#7c3aed',
        required: true,
        validateOn: 'change',
        helpText: 'Yearly saves 20%',
        checks: [{ type: 'required', message: 'Choose a cycle' }],
        value: { $bindState: '/form/billing' },
      },
    }),
  },
  {
    name: 'Switch — offColor(SC) + accent(base = ON) + description + onLabel/offLabel',
    spec: wrap('darkmode', {
      type: 'Switch',
      props: {
        label: 'Dark mode',
        name: 'darkmode',
        size: 'lg',
        accent: '#22c55e',
        offColor: '#52525b',
        description: 'Applies across the whole workspace.',
        onLabel: 'On',
        offLabel: 'Off',
        readonly: false,
        checked: { $bindState: '/prefs/dark' },
      },
    }),
  },
  {
    name: 'Slider — name(ADD) + showValue + trackColor(SC) + accent(base) + valueSuffix + marks + width(D); numeric min/max/step',
    spec: wrap('temp', {
      type: 'Slider',
      props: {
        label: 'Target temperature',
        name: 'temp', // the ADD
        min: 16, // number
        max: 28, // number
        step: 0.5, // number
        showValue: true,
        size: 'lg',
        accent: '#ea580c',
        trackColor: '#fed7aa',
        valueSuffix: '°C',
        width: '24rem',
        marks: [
          { value: 16, label: 'Cool' },
          { value: 22, label: 'Comfort' },
          { value: 28, label: 'Warm' },
        ],
        value: { $bindState: '/settings/temp' },
      },
    }),
  },
];

describe('Forms dynamic props — rich form specs validate with resolution ON', () => {
  it.each(RICH_FORMS)('$name', ({ spec }) => {
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });

  it('covers all 7 Phase-3 form components', () => {
    const types = new Set<string>();
    for (const { spec } of RICH_FORMS) {
      const elements = (spec as { elements: Record<string, { type: string }> }).elements;
      for (const el of Object.values(elements)) types.add(el.type);
    }
    for (const name of ['Input', 'Textarea', 'Select', 'Checkbox', 'Radio', 'Switch', 'Slider']) {
      expect(types.has(name), `${name} not exercised by a rich spec`).toBe(true);
    }
  });

  it('numeric form bounds are NOT mis-flagged as unsafe dimensions', () => {
    // min/max/step/rows/minLength/maxLength are z.number() and out-of-band of the
    // dimension gate — a large/odd numeric bound must stay valid.
    const spec = wrap('n', {
      type: 'Input',
      props: { label: 'L', name: 'n', type: 'number', min: -5, max: 999999, step: 0.001, minLength: 0, maxLength: 4096 },
    });
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });
});

describe('Forms dynamic props — adversarial value channels are rejected', () => {
  const ADVERSARIAL_FORMS: Array<{ name: string; spec: unknown }> = [
    {
      name: 'unsafe color on Input bg (injection)',
      spec: wrap('email', {
        type: 'Input',
        props: { label: 'L', name: 'n', bg: '#fff;background:url(//evil)' },
      }),
    },
    {
      name: 'unsafe dimension on Textarea minHeight (break-out)',
      spec: wrap('notes', {
        type: 'Textarea',
        props: { label: 'L', name: 'n', minHeight: '10px;}x{' },
      }),
    },
    {
      name: 'var() color on Switch offColor (tokens are an enum concern, not a value)',
      spec: wrap('sw', {
        type: 'Switch',
        props: { label: 'L', name: 'n', offColor: 'var(--evil)' },
      }),
    },
  ];

  it.each(ADVERSARIAL_FORMS)('rejects: $name', ({ spec }) => {
    // Old path is blind (unknown value props are stripped; shape is fine).
    expect(validateSpec(spec).valid).toBe(true);
    const gated = validateSpec(spec, { resolution: true });
    expect(gated.valid).toBe(false);
    expect(gated.failureCategory).toBe('unsafe_value');
    expect(gated.errors.length).toBeGreaterThan(0);
  });
});

/* ───────────────────────────── Actions ──────────────────────────────────── */

/**
 * Actions dynamic-prop surface.
 *
 * Each of the 7 action components gets a RICHLY-configured element exercising the
 * shared `actionShared` (accent/accentText/radius/size/fullWidth/align) plus its
 * component-specific props.
 * Every rich spec must pass `validateSpec(spec, { resolution: true })`.
 *
 * ToggleGroup reconciliation: the EXACT item-spacing dimension is
 * `gapValue` (a gate DIM_KEY), NOT `gap` (which is an ENUM key elsewhere and is
 * NOT a value-channel key in the gate). Same convention as Radio.
 *
 * Toggle/ToggleGroup keep the documented `activeColor`/`activeText` exception
 * (pressed-state color via the renderer's `aria-pressed:` recipe) — both are
 * gate COLOR_KEYS, so an unsafe value still hard-fails.
 *
 * Icons are CONTENT (registry NAMES), validated against the closed registry at
 * render — plain `z.string()`/`z.array(z.string())`, no gate value channel.
 *
 * Adversarial fixtures (unsafe color on Button `accent`, var() on Toggle
 * `activeColor`, unsafe dim on DropdownMenu `menuWidth`) must be REJECTED with
 * 'unsafe_value'.
 */
const RICH_ACTIONS: Array<{ name: string; spec: unknown }> = [
  {
    name: 'Button — variant(widened)/tone/surface/gradient/icon/loading + accent/accentText/borderColor + minWidth + base',
    spec: wrap('cta', {
      type: 'Button',
      props: {
        label: 'Upgrade to Pro',
        variant: 'primary',
        surface: 'gradient',
        gradientFrom: '#7c3aed',
        gradientTo: 'oklch(0.7 0.18 25)',
        accent: '#7c3aed',
        accentText: '#ffffff',
        borderColor: '#5b21b6',
        radius: 'full',
        size: 'lg',
        icon: 'sparkles', // registry name (CONTENT)
        iconPosition: 'start',
        minWidth: '180px', // dimension (gate DIM_KEY)
        fullWidth: false,
        align: 'center',
        loading: false,
        disabled: false,
      },
      on: { press: { action: 'recompose' } },
    }),
  },
  {
    name: 'Button — variant:outline + ghost border + loading',
    spec: wrap('del', {
      type: 'Button',
      props: {
        label: 'Delete account',
        variant: 'outline',
        tone: 'critical',
        size: 'sm',
        borderColor: '#dc2626',
        loading: true,
      },
      on: { press: { action: 'host' } },
    }),
  },
  {
    name: 'Link — external/variant/tone/size/weight/underline + color + icon',
    spec: wrap('tos', {
      type: 'Link',
      props: {
        label: 'Terms of Service',
        href: 'https://frayme.ai/terms',
        external: true,
        variant: 'subtle',
        tone: 'neutral',
        size: 'sm',
        weight: 'medium',
        underline: 'hover',
        color: '#64748b',
        icon: 'arrow-up-right',
      },
    }),
  },
  {
    name: 'DropdownMenu — triggerVariant/menuSurface/align + accent/triggerColor + menuWidth/maxHeight + placeholder + base',
    spec: wrap('region', {
      type: 'DropdownMenu',
      props: {
        label: 'Region',
        placeholder: 'Choose a region',
        items: [
          { label: 'US East', value: 'us-east' },
          { label: 'EU West', value: 'eu-west' },
          { label: 'AP South', value: 'ap-south' },
        ],
        value: { $bindState: '/region' },
        triggerVariant: 'outline',
        menuSurface: 'elevated',
        accent: '#0ea5e9',
        accentText: '#ffffff',
        triggerColor: '#0f172a',
        menuWidth: '220px', // dimension (gate DIM_KEY)
        maxHeight: '240px', // dimension (gate DIM_KEY)
        size: 'sm',
        radius: 'md',
        align: 'end',
        fullWidth: false,
      },
      on: { select: { action: 'setState', params: { statePath: '/region' } } },
    }),
  },
  {
    name: 'Toggle — variant/size/radius/iconOnly/tone + activeColor/activeText(exception) + icon + base',
    spec: wrap('notify', {
      type: 'Toggle',
      props: {
        label: 'Notifications',
        pressed: { $bindState: '/notify' },
        variant: 'outline',
        size: 'sm',
        radius: 'full',
        iconOnly: false,
        icon: 'bell',
        activeColor: '#16a34a', // documented exception (gate COLOR_KEY)
        activeText: '#ffffff',
        accent: '#16a34a', // actionShared fallback
        accentText: '#ffffff',
        fullWidth: false,
        align: 'center',
      },
      on: { change: { action: 'host' } },
    }),
  },
  {
    name: 'ToggleGroup — type/size/radius/orientation/attached/variant/tone/fullWidth + activeColor/activeText + gapValue(reconciled)',
    spec: wrap('days', {
      type: 'ToggleGroup',
      props: {
        items: [
          { label: 'M', value: 'mon' },
          { label: 'T', value: 'tue' },
          { label: 'W', value: 'wed' },
          { label: 'T', value: 'thu' },
          { label: 'F', value: 'fri' },
        ],
        type: 'multiple',
        value: { $bindState: '/workdays' },
        size: 'sm',
        radius: 'full',
        orientation: 'horizontal',
        attached: false,
        variant: 'outline',
        gapValue: '8px', // the reconciliation — gapValue NOT gap (gate DIM_KEY)
        activeColor: '#6366f1', // documented exception (gate COLOR_KEY)
        activeText: '#ffffff',
        fullWidth: true,
      },
      on: { change: { action: 'setState', params: { statePath: '/workdays' } } },
    }),
  },
  {
    name: 'ButtonGroup — size/radius/orientation/variant/tone/fullWidth + accent/accentText/borderColor + icons[]',
    spec: wrap('plan', {
      type: 'ButtonGroup',
      props: {
        buttons: [
          { label: 'Monthly', value: 'mo' },
          { label: 'Yearly', value: 'yr' },
        ],
        selected: { $bindState: '/billing' },
        size: 'lg',
        radius: 'full',
        orientation: 'horizontal',
        variant: 'outline',
        fullWidth: true,
        accent: '#0f172a',
        accentText: '#ffffff',
        borderColor: '#cbd5e1',
        icons: ['calendar', 'star'], // registry names (CONTENT), parallel to buttons
        align: 'center',
      },
      on: { change: { action: 'setState', params: { statePath: '/billing' } } },
    }),
  },
  {
    name: 'Pagination — size/shape/variant/showEdges/showPrevNext/align + accent/accentText + siblingCount(count)',
    spec: wrap('pager', {
      type: 'Pagination',
      props: {
        totalPages: 42,
        page: { $bindState: '/page' },
        size: 'sm',
        shape: 'circle',
        variant: 'ghost',
        showEdges: true,
        showPrevNext: true,
        siblingCount: 2, // count (gate COUNT_KEY)
        accent: '#9333ea',
        accentText: '#ffffff',
        align: 'center',
      },
      on: { change: { action: 'setState', params: { statePath: '/page' } } },
    }),
  },
];

describe('Actions dynamic props — rich action specs validate with resolution ON', () => {
  it.each(RICH_ACTIONS)('$name', ({ spec }) => {
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });

  it('covers all 7 Phase-4 action components', () => {
    const types = new Set<string>();
    for (const { spec } of RICH_ACTIONS) {
      const elements = (spec as { elements: Record<string, { type: string }> }).elements;
      for (const el of Object.values(elements)) types.add(el.type);
    }
    for (const name of ['Button', 'Link', 'DropdownMenu', 'Toggle', 'ToggleGroup', 'ButtonGroup', 'Pagination']) {
      expect(types.has(name), `${name} not exercised by a rich spec`).toBe(true);
    }
  });

  it('icon registry NAMES are content (z.string), not flagged by the value-channel gate', () => {
    // A made-up icon name is still valid spec content — the registry resolves it
    // at render (unknown → nothing). It must NOT be a gate failure.
    const spec = wrap('b', { type: 'Button', props: { label: 'X', icon: 'totally-made-up-glyph' } });
    const r = validateSpec(spec, { resolution: true });
    expect(r.valid, r.errors.join(' | ')).toBe(true);
  });
});

describe('Actions dynamic props — adversarial value channels are rejected', () => {
  const ADVERSARIAL_ACTIONS: Array<{ name: string; spec: unknown }> = [
    {
      name: 'unsafe color on Button accent (injection)',
      spec: wrap('b', { type: 'Button', props: { label: 'X', accent: '#fff;background:url(//evil)' } }),
    },
    {
      name: 'var() color on Toggle activeColor (tokens are an enum concern, not a value)',
      spec: wrap('tg', { type: 'Toggle', props: { label: 'X', activeColor: 'var(--evil)' } }),
    },
    {
      name: 'unsafe dimension on DropdownMenu menuWidth (break-out)',
      spec: wrap('dd', {
        type: 'DropdownMenu',
        props: { label: 'X', items: [{ label: 'A', value: 'a' }], menuWidth: '10px;}x{' },
      }),
    },
  ];

  it.each(ADVERSARIAL_ACTIONS)('rejects: $name', ({ spec }) => {
    // Old path is blind (unknown value props are stripped; shape is fine).
    expect(validateSpec(spec).valid).toBe(true);
    const gated = validateSpec(spec, { resolution: true });
    expect(gated.valid).toBe(false);
    expect(gated.failureCategory).toBe('unsafe_value');
    expect(gated.errors.length).toBeGreaterThan(0);
  });
});
