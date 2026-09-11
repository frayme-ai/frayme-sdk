/**
 * G1 — tiered catalog prompt serializer (src/prompt-tiers.ts).
 *
 * The serializer's contract: deterministic byte-identical output, monotone
 * tier sizes, CATALOG_VERSION traceability, verbatim prop describes in
 * full/standard (not compact), eventsDoc carriage, component slicing, and
 * null-stripped examples.
 */
import { describe, expect, it } from 'vitest';
import { buildCatalogPrompt, fraymeCatalog, CATALOG_VERSION } from '../src/index.js';

type CompDef = {
  props?: { shape?: Record<string, unknown> | (() => Record<string, unknown>) };
  events?: readonly string[];
  eventsDoc?: Record<string, string>;
  description?: string;
  example?: unknown;
};

const components = fraymeCatalog.data.components as Record<string, CompDef>;
const componentCount = Object.keys(components).length;

/** Same describe-resolution as the f6 docs gate (wrapper OR innerType). */
function propDoc(schema: unknown): string {
  const s = schema as {
    description?: string;
    _def?: { description?: string; innerType?: { description?: string } };
  };
  return s?.description ?? s?._def?.description ?? s?._def?.innerType?.description ?? '';
}

function shapeOf(c: CompDef): Record<string, unknown> {
  const raw = c.props?.shape ?? {};
  return typeof raw === 'function' ? raw() : raw;
}

const full = buildCatalogPrompt({ detail: 'full' });
const standard = buildCatalogPrompt(); // default tier
const compact = buildCatalogPrompt({ detail: 'compact' });

describe('buildCatalogPrompt — tiered serializer', () => {
  it('is deterministic — two calls are byte-equal per tier', () => {
    expect(buildCatalogPrompt({ detail: 'full' })).toBe(full);
    expect(buildCatalogPrompt({ detail: 'standard' })).toBe(standard);
    expect(buildCatalogPrompt({ detail: 'compact' })).toBe(compact);
  });

  it('tier sizes are strictly monotone: compact < standard < full', () => {
    expect(compact.length).toBeLessThan(standard.length);
    expect(standard.length).toBeLessThan(full.length);
  });

  it('compact tier stays within the 130k-char budget', () => {
    expect(compact.length).toBeLessThanOrEqual(130_000);
  });

  it('first line embeds CATALOG_VERSION + tier name + component count', () => {
    for (const [tier, out] of [
      ['full', full],
      ['standard', standard],
      ['compact', compact],
    ] as const) {
      const firstLine = out.split('\n', 1)[0];
      expect(firstLine).toContain(CATALOG_VERSION);
      expect(firstLine).toContain(tier);
      expect(firstLine).toContain(String(componentCount));
    }
  });

  it('a sampled prop describe appears verbatim in full + standard but NOT compact', () => {
    const titleDoc = propDoc(shapeOf(components.Card).title);
    expect(titleDoc.length).toBeGreaterThanOrEqual(40); // the f6 gate guarantees this
    expect(full).toContain(titleDoc);
    expect(standard).toContain(titleDoc);
    expect(compact).not.toContain(titleDoc);
  });

  it('a component eventsDoc line appears in the full tier', () => {
    const changeDoc = components.Tabs.eventsDoc?.change ?? '';
    expect(changeDoc.length).toBeGreaterThanOrEqual(20);
    expect(full).toContain(changeDoc);
  });

  it('components:[…] slices to exactly those components (plus the events section)', () => {
    const sliced = buildCatalogPrompt({ components: ['Button', 'Card'] });
    const headings = [...sliced.matchAll(/^### (\S+)/gm)].map((m) => m[1]);
    expect(headings).toEqual(['Button', 'Card']);
    expect(sliced.split('\n', 1)[0]).toContain('2');
    expect(sliced).toContain('## Event contract');

    // Unknown names are silently skipped.
    const partial = buildCatalogPrompt({ components: ['Button', 'NoSuchComponent'] });
    expect([...partial.matchAll(/^### (\S+)/gm)].map((m) => m[1])).toEqual(['Button']);
  });

  it('full-tier examples have null-valued keys stripped', () => {
    expect(full).not.toMatch(/":null[,}\]]/);
    // Separator's example carries explicit nulls around orientation+label —
    // stripped, only the non-null keys survive (order preserved).
    expect(full).toContain('example: {"orientation":"horizontal","label":"OR"}');
  });
});

/**
 * The compact tier must teach ARRAY ITEM SHAPE.
 *
 * Before this, `sigil()` collapsed every array to three characters, so the only
 * thing the compact line said about `ButtonGroup.buttons` was `buttons:arr` —
 * nothing about the elements being objects. In live output a recurring class
 * of fallback attempts died on `Invalid input: expected object, received
 * string` INSIDE an array prop (ButtonGroup.buttons, Combobox.options,
 * Stepper.steps, PermissionMatrix.roles, ColorPicker.swatches,
 * SegmentedControl.options); every one of those failures was at an
 * array-element path, none at a plain object prop. The
 * element shape was reachable only via the full tier, and 74 of the 189
 * components — ButtonGroup, PermissionMatrix and ColorPicker among them — sit in
 * no `DATA_SHAPE_COMPONENTS` list and so can never be sliced in at full detail.
 */
describe('compact tier — array-of-object item shapes', () => {
  const compactBlocks = new Map(
    compact.split('\n\n').flatMap((b) => {
      const m = /^### (\S+)/.exec(b);
      return m ? ([[m[1], b]] as [string, string][]) : [];
    }),
  );
  const block = (name: string): string => {
    const b = compactBlocks.get(name);
    expect(b, `no compact block for ${name}`).toBeTruthy();
    return b as string;
  };

  it('expands the element keys of every prop that failed in live output', () => {
    // The exact prop → rendered token, from the six components whose array
    // elements the fallback got wrong.
    expect(block('ButtonGroup')).toContain('buttons:arr{label:str,value:str}');
    expect(block('Combobox')).toContain('options:arr{label:str,value:str}');
    expect(block('SegmentedControl')).toContain('options:arr{label:str,value:str,icon?:str}');
    expect(block('Stepper')).toContain('steps:arr{label:str,');
    expect(block('PermissionMatrix')).toContain('roles:arr{key:str,');
    expect(block('ColorPicker')).toContain('swatches:arr{color?:color,');
  });

  it('NEGATIVE CONTROL: an array of scalars keeps the bare `arr` sigil', () => {
    // Same two lines as the expansions above — so this proves the rule is
    // selective, not a blanket rewrite of the token `arr`.
    expect(block('ButtonGroup')).toContain(' icons:arr ');
    expect(block('DataTable')).toContain(' rows:arr ');
    expect(block('DataTable')).toContain(' selectedRows:arr ');
  });

  it('NEGATIVE CONTROL: a plain object prop is NOT expanded (stays `obj`)', () => {
    // Scope guard: none of the observed failures were at a plain object
    // prop, so object props deliberately keep the one-token sigil.
    expect(block('DataTable')).toContain(' filterValues:obj ');
    expect(compact).not.toMatch(/obj\{/);
  });

  it('never expands a SECOND level — the recursion guard holds over the whole catalog', () => {
    // No `{` may appear inside an already-opened item shape.
    expect(compact).not.toMatch(/arr\{[^}]*\{/);
  });

  it('ITEM KEY CAP: a wide element lists 8 keys then elides', () => {
    const m = /columns:arr\{([^}]*)\}/.exec(block('DataTable'));
    expect(m, 'DataTable.columns did not expand').toBeTruthy();
    const parts = (m as RegExpExecArray)[1].split(',');
    expect(parts[parts.length - 1]).toBe('…');
    expect(parts.length - 1).toBe(8); // 8 keys + the elision marker
  });

  it('ITEM ENUM CAP: a nested oversized enum collapses to `enum`', () => {
    // Fab.actions[].icon is the icon registry. Uncapped it would inline a
    // THIRD copy of a 2,512-char string the compact base already carries twice.
    expect(block('Fab')).toMatch(/actions:arr\{[^}]*icon\?:enum[,}]/);

    const iconEnum = /\bicon:([a-z0-9|-]{200,})/.exec(block('Fab'));
    expect(iconEnum, 'Fab.icon enum not found').toBeTruthy();
    const registry = (iconEnum as RegExpExecArray)[1];
    expect(registry.split('|').length).toBeGreaterThan(12); // > ITEM_ENUM_CAP
    let occurrences = 0;
    for (let i = compact.indexOf(registry); i !== -1; i = compact.indexOf(registry, i + 1)) occurrences++;
    expect(occurrences).toBe(2); // ### Fab (icon) + ### Icon (name) — no third copy
  });

  it('a NESTED prop describe still never leaks into the compact tier', () => {
    const swatches = shapeOf(components.ColorPicker).swatches as {
      _def?: { innerType?: { _def?: { element?: { shape?: Record<string, unknown> } } } };
    };
    const el = swatches?._def?.innerType?._def?.element;
    const nestedDoc = propDoc((typeof el?.shape === 'function' ? (el.shape as () => Record<string, unknown>)() : el?.shape)?.color);
    expect(nestedDoc.length).toBeGreaterThan(20); // the detector can see a real describe
    expect(full).toContain(nestedDoc);
    expect(compact).not.toContain(nestedDoc);
  });

  it('ENUM-CAP SAFETY: every collapsed nested enum is spelled out in its own block', () => {
    // The cap is only safe because the values are still reachable. Both current
    // hits prove it: Fab.actions[].icon collapses while `### Fab`'s own `icon:`
    // lists all 280 names, and BodyMap.marks[].region collapses while
    // `### BodyMap`'s `selectedRegion:` lists the same 17 regions on the line
    // above. If a future catalog prop collapses with no in-block spelling, the
    // model has nowhere to learn the values and this must fail.
    const collapsed: string[] = [];
    for (const [name, b] of compactBlocks) {
      for (const m of b.matchAll(/(\w+):arr\{([^}]*)\}/g)) {
        for (const part of m[2].split(',')) {
          if (!part.endsWith(':enum')) continue;
          collapsed.push(`${name}.${m[1]}[].${part.split(':')[0]}`);
          // Some OTHER prop in the same block must spell a long enum out.
          const spelled = b.replace(m[0], '').match(/:[a-z][a-z0-9-]*(\|[a-z][a-z0-9-]*){12,}/i);
          expect(spelled, `${name}: nested enum collapsed with nothing to read it from`).toBeTruthy();
        }
      }
    }
    expect(collapsed.length).toBeGreaterThan(0); // the detector actually ran
  });

  it('the sigil legend rides the compact header only', () => {
    expect(compact.split('\n')[1]).toContain('arr{k:type,…}');
    expect(standard).not.toContain('Prop sigils:');
    expect(full).not.toContain('Prop sigils:');
  });

  it('the full and standard tiers are untouched by the compact expansion', () => {
    // They spell array item shapes out in words (`array of {…}`) and must never
    // acquire the compact `arr{…}` syntax.
    expect(full).not.toContain('arr{');
    expect(standard).not.toContain('arr{');
    expect(full).toContain('array of {');
  });
});
