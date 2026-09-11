import { describe, expect, it } from 'vitest';
import { fraymeCatalog } from '@frayme/catalog';

import {
  ACTION_CALL_EXAMPLES,
  COMPOSE_CALL_EXAMPLES,
  actionInputSchema,
  actionToolDefinition,
  composeInputSchema,
  composeToolDefinition,
} from './index';

/**
 * Every example JSON is ONE line starting with the schema's first key — that is
 * the whole extraction contract. A framing sentence that happened to start a
 * line with `{"prompt"` would be picked up too, so keep prose off column 0.
 */
const COMPOSE_EXTRACT = /^\{"prompt"[\s\S]*?\}$/gm;
const ACTION_EXTRACT = /^\{"action"[\s\S]*?\}$/gm;

/** The raw one-line JSON strings embedded in a block (size caps read these). */
function extractRaw(block: string, re: RegExp): string[] {
  return [...block.matchAll(re)].map((m) => m[0]);
}

/** Every JSON object embedded in the compose examples block. */
function extractExamples(): unknown[] {
  return extractRaw(COMPOSE_CALL_EXAMPLES, COMPOSE_EXTRACT).map((s) => JSON.parse(s));
}

/** Every JSON object embedded in the frayme_action examples block. */
function extractActionExamples(): unknown[] {
  return extractRaw(ACTION_CALL_EXAMPLES, ACTION_EXTRACT).map((s) => JSON.parse(s));
}

/* ONE example's JSON may not exceed this. Worked examples are the cheapest
   tokens in the request (they sit in the stable `tools` prefix and cache), but
   each must still be readable as ONE call — a longer one stops teaching a shape
   and starts being a payload. Example 1 (the fraud-desk queue) predates the cap
   at 2,461 chars and is grandfathered at its measured size — a no-growth guard,
   not a licence — so the cap binds every other example (Examples 2–5 and both
   frayme_action events). */
const MAX_EXAMPLE_JSON_CHARS = 2400;
const GRANDFATHERED_EXAMPLE_1_CHARS = 2461;

describe('COMPOSE_CALL_EXAMPLES', () => {
  it('is reachable from the tool description (the only field consumers pass)', () => {
    expect(composeToolDefinition.description).toContain(COMPOSE_CALL_EXAMPLES);
  });

  it('contains exactly 5 parseable examples', () => {
    expect(extractExamples()).toHaveLength(5);
  });

  it('every example is composeInputSchema-valid', () => {
    for (const ex of extractExamples()) {
      const r = composeInputSchema.safeParse(ex);
      expect(r.success, JSON.stringify((r as { error?: unknown }).error)).toBe(true);
    }
  });

  it(`every example's JSON is one line and ≤ ${MAX_EXAMPLE_JSON_CHARS} chars (Example 1 grandfathered at ${GRANDFATHERED_EXAMPLE_1_CHARS})`, () => {
    const raw = extractRaw(COMPOSE_CALL_EXAMPLES, COMPOSE_EXTRACT);
    expect(raw).toHaveLength(5);
    for (const [i, s] of raw.entries()) {
      expect(s).not.toContain('\n');
      expect(s.length).toBeLessThanOrEqual(i === 0 ? GRANDFATHERED_EXAMPLE_1_CHARS : MAX_EXAMPLE_JSON_CHARS);
    }
  });

  it('prompts are realistically detailed, not toy one-liners', () => {
    // Thin prompts produce thin UIs — each example must model a real, detailed
    // request, while staying within a sensible length band.
    for (const ex of extractExamples() as Array<{ prompt: string }>) {
      expect(ex.prompt.length).toBeGreaterThan(200);
      expect(ex.prompt.length).toBeLessThan(1401);
    }
  });

  it('every example seeds its repeatable arrays in `data`', () => {
    // An unseeded repeat renders ZERO rows — the defect these examples exist to prevent.
    for (const ex of extractExamples() as Array<{ data?: Record<string, unknown> }>) {
      const hasArray = Object.values(ex.data ?? {}).some(
        (v) => Array.isArray(v) || (!!v && typeof v === 'object' && Object.values(v).some(Array.isArray)),
      );
      expect(hasArray).toBe(true);
    }
  });

  it('every example uses only keys the contract declares', () => {
    // z.object strips unknown keys silently, so a stale key would otherwise pass validation unnoticed.
    for (const ex of extractExamples() as Array<Record<string, unknown>>) {
      for (const key of Object.keys(ex)) expect(composeInputSchema.shape).toHaveProperty(key);
    }
  });

  it('teaches `role` positively — the "There is no \"role\" field" sentence is gone', () => {
    // The field is on the action item schema again; the prose must not
    // contradict the schema it sits beside — that contradiction was the defect.
    expect(COMPOSE_CALL_EXAMPLES).not.toContain('There is no "role" field');
    expect(COMPOSE_CALL_EXAMPLES).toContain('"role" is');
    expect(composeInputSchema.shape.actions.unwrap().element.shape).toHaveProperty('role');
  });

  it('covers distinct calling patterns incl. a composite multi-region page and an actions-free one', () => {
    const ex = extractExamples() as Array<{ signals?: { data_shape?: string[] }; actions?: unknown[] }>;
    const shapes = ex.map((e) => [...(e.signals?.data_shape ?? [])].sort().join('+'));
    expect(new Set(shapes).size).toBe(ex.length); // no duplicate content shapes
    expect(ex.some((e) => (e.signals?.data_shape?.length ?? 0) > 1)).toBe(true); // composite page mixes shapes
    expect(ex.some((e) => !e.signals)).toBe(true); // a signals-free call is first-class
    expect(ex.some((e) => !e.actions?.length)).toBe(true); // local-only: filters are NOT actions
    expect(ex.some((e) => (e.actions?.length ?? 0) > 1)).toBe(true); // wired server actions
  });

  /*
   * THE CARRIER RULE (enforced by the runtime's core/dynamic-gate.ts). Only a
   * press round-trips; every other gesture batches under `state._ui` behind
   * the next press, `live:true` is the opt-out, and a
   * carrier button is injected when an action is wired only to a non-press
   * component. The preamble must state it as a rule and Example 4 must SHOW it:
   * a board with no action for its moves, ONE role'd button carrying the batch,
   * and the `live:true` contrast. These substrings are what stop the rule
   * quietly leaving the copy the way the `live` default once left the runtime.
   */
  it('states the carrier rule in the preamble and names the live opt-out', () => {
    expect(COMPOSE_CALL_EXAMPLES).toContain('Four rules cause most failures');
    expect(COMPOSE_CALL_EXAMPLES).toContain('only a press calls you back');
    expect(COMPOSE_CALL_EXAMPLES).toContain('carrier');
    expect(COMPOSE_CALL_EXAMPLES).toContain('"live":true');
    expect(COMPOSE_CALL_EXAMPLES).toContain('state._ui');
  });

  /*
   * NO OVERCLAIM ABOUT THE BINDER. Two sentences must never appear, because
   * they describe behaviour the platform does not have: the injected carrier
   * does NOT add a `params` key named after the gesture's verb
   * (the binder never rides the mirror along — the press is `paramBindings(decl)`
   * and nothing more), and the `_ui` mirror is NOT "batched since the last
   * press" — intrinsic.ts writes `/_ui/<fid>/<verb>` last-write-wins and nothing
   * ever clears it, so a stale entry reappears identically on the next press.
   * An agent trusting either would read a param that never arrives or re-apply
   * a move already applied. These substrings are the gate against them coming back.
   */
  it('does not promise a verb-named param from the injected carrier, nor a mirror that resets on press', () => {
    expect(COMPOSE_CALL_EXAMPLES).not.toContain('named after its verb');
    expect(COMPOSE_CALL_EXAMPLES).not.toContain('batched since the last press');
    expect(COMPOSE_CALL_EXAMPLES).toContain('a press never clears it');
  });

  it('Example 4 teaches the carrier pattern: a board, no action for the moves, ONE role\'d button', () => {
    const ex = extractExamples() as Array<{
      signals?: { data_shape?: string[] };
      actions?: Array<{ name: string; role?: string; live?: boolean; required?: boolean; params?: { required?: string[] } }>;
    }>;
    const board = ex.find((e) => e.signals?.data_shape?.includes('board'));
    expect(board).toBeDefined();
    expect(board!.actions).toHaveLength(1);
    const [carrier] = board!.actions!;
    expect(carrier!.role).toBeTruthy(); // the carrier button is NAMED
    expect(carrier!.live).toBeUndefined(); // the moves batch — no opt-out
    expect(carrier!.required).toBe(true);
    expect(carrier!.params?.required).toContain('board'); // the batched arrangement is the param
  });

  it('Example 5 teaches the edit loop: mode:"edit", a catalog-valid prior_spec, every still-relevant action re-declared', () => {
    const ex = extractExamples() as Array<{
      mode?: string;
      prior_spec?: { elements?: Record<string, { type: string; on?: Record<string, { action: string }> }> };
      actions?: Array<{ name: string }>;
    }>;
    const edit = ex.find((e) => e.mode === 'edit');
    expect(edit).toBeDefined();
    expect(edit!.prior_spec).toBeDefined();
    // Catalog-valid types only — proved by the catalog's own gate, not asserted.
    expect(fraymeCatalog.validate(edit!.prior_spec as never).success).toBe(true);
    // Every action the prior spec binds is re-declared (an action left out of an
    // edit comes back unwired — the rule the example exists to teach).
    const bound = new Set(
      Object.values(edit!.prior_spec!.elements ?? {}).flatMap((el) =>
        Object.values(el.on ?? {}).map((b) => b.action),
      ),
    );
    expect(bound.size).toBeGreaterThan(0);
    const declared = new Set((edit!.actions ?? []).map((a) => a.name));
    for (const name of bound) expect(declared.has(name), `re-declares ${name}`).toBe(true);
  });
});

describe('ACTION_CALL_EXAMPLES', () => {
  it('is reachable from the frayme_action description', () => {
    expect(actionToolDefinition.description).toContain(ACTION_CALL_EXAMPLES);
  });

  it('contains exactly 2 parseable examples, each actionInputSchema-valid', () => {
    const ex = extractActionExamples();
    expect(ex).toHaveLength(2);
    for (const e of ex) {
      const r = actionInputSchema.safeParse(e);
      expect(r.success, JSON.stringify((r as { error?: unknown }).error)).toBe(true);
    }
  });

  it(`every example's JSON is one line and ≤ ${MAX_EXAMPLE_JSON_CHARS} chars`, () => {
    const raw = extractRaw(ACTION_CALL_EXAMPLES, ACTION_EXTRACT);
    expect(raw).toHaveLength(2);
    for (const s of raw) {
      expect(s).not.toContain('\n');
      expect(s.length).toBeLessThanOrEqual(MAX_EXAMPLE_JSON_CHARS);
    }
  });

  it('every example uses only keys the schema declares', () => {
    for (const ex of extractActionExamples() as Array<Record<string, unknown>>) {
      for (const key of Object.keys(ex)) expect(actionInputSchema.shape).toHaveProperty(key);
    }
  });

  it('teaches what the event carries: element_id + label on every example, the _ui mirror, a steering prompt', () => {
    const ex = extractActionExamples() as Array<{
      element_id?: string;
      label?: string;
      state?: { _ui?: Record<string, unknown> };
      prompt?: string;
      params?: Record<string, unknown>;
    }>;
    for (const e of ex) {
      expect(e.element_id).toBeTruthy();
      expect(e.label).toBeTruthy();
      expect(e.state?._ui).toBeDefined(); // the latest gesture per verb — never cleared by a press
      expect(e.prompt).toBeTruthy();
    }
    // One is a Button press carrying a batched board (the return half of
    // compose Example 4); one is a DataTable row action whose earlier sort sits
    // in _ui and never round-tripped.
    expect(ex.some((e) => Array.isArray(e.params?.board))).toBe(true);
    expect(ex.some((e) => e.params?.row !== undefined && Array.isArray(e.params?.rows))).toBe(true);
  });
});
