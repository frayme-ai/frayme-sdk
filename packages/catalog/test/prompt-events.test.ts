import { describe, expect, it } from 'vitest';

import { CANONICAL_EVENTS, fraymeCatalog } from '../src/index.js';

/**
 * The system prompt (auto-generated from the catalog) must advertise the 8
 * canonical event verbs and NONE of the 24 legacy names — `prompt()` renders
 * `[events: …]` from each component's `events[]`, so normalizing the schemas
 * is what makes the model-facing vocabulary correct.
 */
describe('prompt() advertises the canonical event vocabulary', () => {
  const prompt = fraymeCatalog.prompt();
  const eventSegments = [...prompt.matchAll(/\[events: ([^\]]+)\]/g)].map((m) => m[1]);

  it('renders [events: …] segments at all', () => {
    expect(eventSegments.length).toBeGreaterThan(0);
  });

  it('every advertised event is one of the 8 canonical verbs', () => {
    const canon = new Set<string>(CANONICAL_EVENTS);
    const offenders = new Set<string>();
    for (const seg of eventSegments) {
      for (const v of seg.split(',').map((s) => s.trim())) {
        if (!canon.has(v)) offenders.add(v);
      }
    }
    expect([...offenders], `non-canonical advertised events in prompt: ${[...offenders].join(', ')}`).toEqual(
      [],
    );
  });

  it('teaches no legacy on-key in the prompt body (examples + prose)', () => {
    // the worked examples + prose must use the canonical `commit` on-key, not
    // the legacy `press` (which the upstream template injects by default).
    expect(prompt).not.toMatch(/"press":\s*\{/); // legacy on-key in a JSON example
    expect(prompt).not.toMatch(/\bon\.press\b/); // legacy on-key in prose
    expect(prompt).toMatch(/"commit":\s*\{/); // the canonicalized example survives
  });

  it('advertises canonical verbs for representative components', () => {
    expect(prompt).toMatch(/Button:[^\n]*\[events: commit\]/);
    const dt = prompt.match(/DataTable:[^\n]*\[events: ([^\]]+)\]/);
    expect(dt, 'DataTable should advertise events').toBeTruthy();
    expect(new Set(dt![1].split(',').map((s) => s.trim()))).toEqual(new Set(['sort', 'select', 'page', 'commit', 'dismiss']));
  });
});
