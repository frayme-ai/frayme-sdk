import { describe, expect, it } from 'vitest';

import { fraymeCatalog } from '../src/index.js';
import {
  COMPONENT_EVENT_ALIASES,
  COMPONENT_EXTRA_EVENTS,
  acceptedEventKeys,
  resolveEventKey,
  validateActionWiring,
} from '../src/validate/index.js';
import { CANONICAL_EVENTS } from '../src/components/events.js';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const components = fraymeCatalog.data.components as Record<string, any>;

/* Spellings the model emits that the catalog rejected, each costing a rejected
   attempt:
     · DataTable  on.add / on.update  (binder injected a stub)
     · DatePicker / DateRangePicker  on.commit
     · Radio.options as [{label,value}]  (crashed the card)
     · Confirmation cancelLabel  (model writes it; catalog took denyLabel)

   Measured over existing specs before choosing which spelling is canonical:
   the existing spelling dominated in every case, so every existing spelling
   stays canonical and each change below is purely additive. */

/* eslint-disable @typescript-eslint/no-explicit-any */
const spec = (elements: any, actions?: any): any => ({
  root: 'r',
  elements,
  ...(actions ? { actions } : {}),
});
const act = { doIt: { kind: 'agent' } };

describe('component-scoped event vocabulary', () => {
  it('keeps the global canonical set at exactly 8 verbs', () => {
    // The prompt, the tool JSON and manifest.events are all generated from this
    // set — widening it would change the served prompt and break train↔serve
    // parity. The component-scoped spellings live OUTSIDE it by design.
    expect(CANONICAL_EVENTS.length).toBe(8);
    for (const extras of Object.values(COMPONENT_EXTRA_EVENTS)) {
      for (const v of extras) expect(CANONICAL_EVENTS as readonly string[]).not.toContain(v);
    }
  });

  it('never advertises an extra verb through events[] (that array stays canonical)', () => {
    const dt = components.DataTable;
    expect(dt.events).not.toContain('add');
    expect(dt.events).not.toContain('update');
  });

  it('resolveEventKey maps a picker commit to the select the renderer emits', () => {
    expect(resolveEventKey('DatePicker', 'commit')).toBe('select');
    expect(resolveEventKey('DateRangePicker', 'commit')).toBe('select');
    // …and leaves every other component's commit alone.
    expect(resolveEventKey('Button', 'commit')).toBe('commit');
    expect(resolveEventKey('Confirmation', 'commit')).toBe('commit');
  });

  it('resolveEventKey passes DataTable add/update through under their own names', () => {
    // They must survive normalization verbatim — the renderer fires that exact name.
    expect(resolveEventKey('DataTable', 'add')).toBe('add');
    expect(resolveEventKey('DataTable', 'update')).toBe('update');
  });

  it('still collapses the global legacy aliases', () => {
    expect(resolveEventKey('Button', 'press')).toBe('commit');
    expect(resolveEventKey('DataTable', 'selectRow')).toBe('select');
  });

  it('every alias target is an event the component actually declares', () => {
    // A DETECTOR GUARD: an alias pointing at a verb the renderer never emits
    // would validate clean and then silently never fire.
    for (const [type, aliases] of Object.entries(COMPONENT_EVENT_ALIASES)) {
      const declared = (components as any)[type]?.events ?? [];
      for (const target of Object.values(aliases)) {
        expect(declared, `${type} must declare ${target}`).toContain(target);
      }
    }
  });
});

describe('validateActionWiring accepts the new spellings', () => {
  it('accepts DataTable on.add', () => {
    const r = validateActionWiring(
      spec({ t: { type: 'DataTable', props: {}, on: { add: { action: 'doIt' } } } }, act),
    );
    expect(r.errors.join(' ')).toBe('');
    expect(r.valid).toBe(true);
  });

  it('accepts DataTable on.update', () => {
    const r = validateActionWiring(
      spec({ t: { type: 'DataTable', props: {}, on: { update: { action: 'doIt' } } } }, act),
    );
    expect(r.valid).toBe(true);
  });

  it('accepts commit on both date pickers', () => {
    for (const type of ['DatePicker', 'DateRangePicker']) {
      const r = validateActionWiring(
        spec({ d: { type, props: {}, on: { commit: { action: 'doIt' } } } }, act),
      );
      expect(r.errors.join(' '), type).toBe('');
      expect(r.valid, type).toBe(true);
    }
  });

  /* THE DETECTOR MUST STILL FIRE. If these pass, the change above widened the
     gate rather than removing it. */
  it('still rejects a genuinely unknown verb', () => {
    const r = validateActionWiring(
      spec({ t: { type: 'DataTable', props: {}, on: { teleport: { action: 'doIt' } } } }, act),
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/teleport/);
  });

  it('does NOT leak add/update onto other components', () => {
    const r = validateActionWiring(
      spec({ b: { type: 'Button', props: {}, on: { add: { action: 'doIt' } } } }, act),
    );
    expect(r.valid, 'add is DataTable-scoped').toBe(false);
  });

  it('does NOT leak the picker commit alias onto a component that lacks select', () => {
    // Sanity: the alias map is keyed by type, so an unrelated type is unaffected.
    expect(resolveEventKey('Input', 'commit')).toBe('commit');
  });

  it('names the accepted spellings in the error message', () => {
    const r = validateActionWiring(
      spec({ t: { type: 'DataTable', props: {}, on: { nope: { action: 'doIt' } } } }, act),
    );
    expect(r.errors.join(' ')).toMatch(/add/);
    expect(r.errors.join(' ')).toMatch(/update/);
  });

  it('acceptedEventKeys lists declared + extra + alias spellings', () => {
    const keys = acceptedEventKeys('DataTable', ['commit']);
    expect(keys).toContain('commit');
    expect(keys).toContain('add');
    expect(keys).toContain('update');
    expect(acceptedEventKeys('DatePicker', ['select'])).toContain('commit');
  });
});

describe('prop-spelling gaps', () => {
  it('Radio.options accepts plain strings AND {value,label} pairs', () => {
    const opts = components.Radio.props.shape.options;
    expect(opts.safeParse(['Standard', 'Express']).success, 'string form').toBe(true);
    expect(
      opts.safeParse([{ value: 'std', label: 'Standard' }]).success,
      'object form — what models emit',
    ).toBe(true);
  });

  it('Radio.options still rejects a shape that is neither', () => {
    const opts = components.Radio.props.shape.options;
    expect(opts.safeParse([{ nope: 1 }]).success).toBe(false);
    expect(opts.safeParse('Standard').success).toBe(false);
  });

  it('Radio keeps the string form as the canonical example', () => {
    expect(components.Radio.example.options.every((o: unknown) => typeof o === 'string')).toBe(true);
  });

  it('Confirmation accepts cancelLabel alongside the canonical denyLabel', () => {
    const shape = components.Confirmation.props.shape;
    expect(shape.denyLabel, 'denyLabel stays canonical').toBeDefined();
    expect(shape.cancelLabel, 'cancelLabel accepted (what the model writes)').toBeDefined();
    expect(shape.cancelLabel.safeParse('Keep editing').success).toBe(true);
  });
});
