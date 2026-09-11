/**
 * Drift gates for the tool-JSON contract — asserts the tool definitions
 * actually teach the loop with zero source reading, and stay in lockstep with
 * `@frayme/catalog`'s EVENT_CONTRACT and this package's `limits.ts` as both
 * evolve.
 */
import { describe, expect, it } from 'vitest';
import { CANONICAL_EVENTS, fraymeCatalog } from '@frayme/catalog';
import { Frayme } from '../src/client.js';
import {
  actionInputExamples,
  actionInputSchema,
  actionToolDefinition,
  anthropicToolDefinitions,
  composeInputExamples,
  composeInputSchema,
  composeToolDefinition,
  createActionTool,
  createComposeTool,
} from '../src/tools/index.js';
import {
  ACTION_NAME_MAX_CHARS,
  ACTION_ROLE_MAX_CHARS,
  CONTEXT_THEME_MAX_CHARS,
  COMPOSE_MAX_OPERATIONS,
  COMPOSE_PROMPT_MAX_CHARS,
  MAX_ACTIONS_PER_REQUEST,
} from '../src/limits.js';

/** A bound client that never talks to the network — the tests below read the
 *  tool objects, not results. */
const offlineClient = () => new Frayme({ apiKey: 'fr_live_test', baseURL: 'https://api.test' });

describe('composeInputExamples — schema-valid (1)', () => {
  for (const [i, example] of composeInputExamples.entries()) {
    it(`example[${i}] (prompt: ${JSON.stringify(example.prompt.slice(0, 40))}…) safeParses`, () => {
      const result = composeInputSchema.safeParse(example);
      expect(result.success).toBe(true);
    });
  }

  /*
   * EVERY prior_spec MUST PASS THE CATALOG GATE. The tool
   * schema types `prior_spec` as an opaque record, so schema-validity above
   * proves nothing about the TYPES inside it — and the route runs validateSpec
   * over prior_spec at the trust boundary and answers 400. The edit example
   * once carried a `PricingTier` (never a catalog type; PlanCard is the
   * single-plan card), unnoticed while no path shipped the array to a model; the
   * moment `createComposeTool` attached it as `inputExamples` it was teaching an
   * edit call the server rejects. Mirrors the Example 5 assertion in
   * call-examples.test.ts for the structured channel.
   */
  it('every example that carries a prior_spec passes fraymeCatalog.validate()', () => {
    const withPrior = composeInputExamples.filter((e) => e.prior_spec !== undefined);
    expect(withPrior.length).toBeGreaterThan(0); // the edit-loop example exists
    for (const e of withPrior) {
      const r = fraymeCatalog.validate(e.prior_spec as never);
      expect(r.success, JSON.stringify((r as { error?: unknown }).error)).toBe(true);
    }
  });
});

describe('actionInputExamples — schema-valid (2)', () => {
  it('actionInputExamples is non-empty', () => {
    expect(actionInputExamples.length).toBeGreaterThan(0);
  });

  for (const [i, example] of actionInputExamples.entries()) {
    it(`example[${i}] (action: ${JSON.stringify(example.action)}) safeParses`, () => {
      const result = actionInputSchema.safeParse(example);
      expect(result.success).toBe(true);
    });
  }
});

describe('frayme_action description carries the full verb vocabulary (3)', () => {
  it('contains every canonical verb name', () => {
    for (const verb of CANONICAL_EVENTS) {
      expect(actionToolDefinition.description).toContain(verb);
    }
  });

  it('the round-trip loop is actually taught: DynamicActionEvent fields + verbatim forwarding', () => {
    expect(actionToolDefinition.description).toContain('DynamicActionEvent');
    expect(actionToolDefinition.description).toContain('generation_id');
    expect(actionToolDefinition.description).toContain('VERBATIM');
  });
});

describe('frayme_compose description explains what comes back', () => {
  it('mentions spec.actions, generation_id, and the return loop to frayme_action', () => {
    expect(composeToolDefinition.description).toContain('spec.actions');
    expect(composeToolDefinition.description).toContain('generation_id');
    expect(composeToolDefinition.description).toContain('frayme_action');
  });
});

describe('description lengths stay under the tool-description sanity caps (4)', () => {
  /*
   * DELIBERATE self-imposed sanity caps, not an Anthropic API limit — they catch
   * accidental bloat (a pasted sixth example, a verb block that balloons), not
   * the size the copy was designed to.
   *
   * The caps sit at 21,000 for compose and 7,000 for action, sized to admit
   * the carrier-pattern and edit-loop examples (compose Examples 4–5) and the
   * two frayme_action worked events with roughly 6% / 10% headroom over the
   * shipped copy. Worked examples are the cheapest tokens in the request:
   * `tools` render FIRST in the prompt-cache prefix and are byte-stable across
   * calls, so they are paid once per cache window while every prompt token is
   * paid every call. If a change trips these, tighten the PROSE — never trim
   * an example to dodge the cap.
   */
  it('frayme_compose description < 21000 chars', () => {
    expect(composeToolDefinition.description.length).toBeLessThan(21000);
  });

  it('frayme_action description < 7000 chars', () => {
    expect(actionToolDefinition.description.length).toBeLessThan(7000);
  });
});

describe('the tool JSON teaches the carrier rule', () => {
  /*
   * The runtime's core/dynamic-gate.ts now ENFORCES the `live` default: only a
   * press (Button / IconButton / Fab / Confirmation / Form submit / DataTable,
   * plus a row/bulk action button on any host) dispatches; every other gesture
   * batches under `state._ui` behind the next press. The tool JSON is the one
   * surface a host agent reads, so it must say exactly that — these substrings
   * are the drift gate between the gate's default list and the copy.
   */
  const actionsDescribe = composeInputSchema.shape.actions.description ?? '';
  const actionItem = composeInputSchema.shape.actions.unwrap().element.shape;
  const liveDescribe = actionItem.live.description ?? '';
  const roleDescribe = actionItem.role.description ?? '';

  it('frayme_compose: only a press round-trips, the rest batches under state._ui, live is the opt-out, a carrier is injected', () => {
    const d = composeToolDefinition.description;
    expect(d).toContain('Only a PRESS round-trips');
    expect(d).toContain('state._ui');
    expect(d).toContain('live:true');
    expect(d).toContain('carrier');
    expect(d).not.toContain('declaring local UX makes the UI slow and flaky'); // the pre-gate sentence
    /* The copy may not say a role-less carrier is "derived from the name" (the
       binder's default for a gesture host is "Done") nor that `_ui` is "batched
       since the last press" (the mirror is last-write-wins and never cleared —
       intrinsic.ts). */
    expect(d).not.toContain('else derived from the name');
    expect(d).not.toContain('batched since the last press');
    expect(d).toContain('never cleared by a press');
  });

  it('actions[] describe: carrier + live, and the NEVER list survives', () => {
    expect(actionsDescribe).toContain('carrier');
    expect(actionsDescribe).toContain('live');
    expect(actionsDescribe).toContain('NEVER declare local UI behaviors');
    expect(actionsDescribe).not.toContain('each press is a round-trip');
  });

  it('live describe names the press-shaped carrier set the runtime enforces', () => {
    for (const carrier of ['Button', 'IconButton', 'Fab', 'Confirmation', 'Form', 'DataTable', 'row/bulk action']) {
      expect(liveDescribe).toContain(carrier);
    }
    expect(liveDescribe).toContain('state._ui.<elementId>.<verb>');
  });

  it('role describe names the carrier button and the label fallback IN THE BINDER\'S ORDER: "Done" first, name-derived the exception', () => {
    expect(roleDescribe).toContain('carrier button');
    expect(roleDescribe).toContain('"Done"');
    /* Stating the chain backwards ("a label derived from the name, else Done")
       is the defect this guards. The binder: role → "Done" for a gesture host;
       humanised name ONLY when every host verb is `commit` or a second carrier
       would also say "Done". The order of the two phrases in the copy is the gate. */
    expect(roleDescribe).toContain('name-derived');
    expect(roleDescribe.indexOf('"Done"')).toBeLessThan(roleDescribe.indexOf('name-derived'));
    expect(roleDescribe).not.toContain('derived from the name, else');
  });

  it('frayme_action: the event field list carries element_id + label + description and the _ui mirror', () => {
    const d = actionToolDefinition.description;
    expect(d).toContain('{action, event, params, state, element_id, label, description, generation_id}');
    expect(d).toContain('state._ui.<elementId>.<verb>');
    expect(d).toContain('live:true');
    expect(d).not.toContain('when the user interacts with the rendered UI'); // implied every interaction round-trips
    /* No verb-named param from the injected carrier (the binder never rides the
       mirror along), no mirror that resets on press (intrinsic.ts), and the
       Form-submit exception to `label` stated (action-enrich.ts rule 3). */
    expect(d).not.toContain('named after the verb');
    expect(d).not.toContain('batched since the last press');
    expect(d).toContain('never cleared by a press');
    expect(d).toContain('absent for a Form submit');
  });
});

describe('input examples are attached where a framework can carry them', () => {
  /*
   * `inputExamples: [{ input }]` is the Vercel AI SDK / Mastra CORE tool field
   * (`ai` ≥ 6, `@ai-sdk/provider-utils` `Tool.inputExamples`); `@ai-sdk/anthropic`
   * maps it to the Messages API's `input_examples`, which is GA on the API — no
   * beta header (the SDK itself still tags the request with
   * `advanced-tool-use-2025-11-20`, harmlessly) and returns 400 on an example
   * that fails `input_schema`.
   * So every attached example must be schema-valid, and the attachment must be
   * the SAME array the raw-SDK helper hands out.
   */
  it('createComposeTool attaches every composeInputExamples entry as { input } and each validates', () => {
    const tool = createComposeTool(offlineClient());
    expect(tool.inputExamples).toHaveLength(composeInputExamples.length);
    expect(tool.inputExamples.length).toBeGreaterThanOrEqual(1);
    for (const { input } of tool.inputExamples) {
      expect(composeInputSchema.safeParse(input).success).toBe(true);
    }
    expect(tool.inputExamples.map((e) => e.input)).toEqual([...composeInputExamples]);
  });

  it('createActionTool attaches every actionInputExamples entry as { input } and each validates', () => {
    const tool = createActionTool(offlineClient());
    expect(tool.inputExamples).toHaveLength(actionInputExamples.length);
    for (const { input } of tool.inputExamples) {
      expect(actionInputSchema.safeParse(input).success).toBe(true);
    }
  });

  it('the attached compose examples teach the carrier pattern: a board with ONE role\'d, non-live action', () => {
    const boards = composeInputExamples.filter((e) => e.signals?.data_shape?.includes('board'));
    expect(boards.length).toBeGreaterThanOrEqual(2); // the live:true board AND the carrier board
    const carrier = boards.find((e) => e.actions?.every((a) => !a.live));
    expect(carrier).toBeDefined();
    expect(carrier!.actions).toHaveLength(1);
    expect(carrier!.actions![0]!.role).toBeTruthy();
    expect(carrier!.actions![0]!.required).toBe(true);
  });

  it('the attached action examples carry element_id + label, and the _ui mirror is nested element → verb', () => {
    for (const e of actionInputExamples) {
      expect(e.element_id).toBeTruthy();
      expect(e.label).toBeTruthy();
    }
    const mirrored = actionInputExamples.find((e) => e.state?._ui);
    expect(mirrored).toBeDefined();
    const ui = mirrored!.state!._ui as Record<string, Record<string, Record<string, unknown>>>;
    expect(ui[mirrored!.element_id!]?.sort).toEqual({ sortBy: 'priority', sortDir: 'desc' });
  });

  it('anthropicToolDefinitions() renders both tools in Messages API shape with the same examples', () => {
    const defs = anthropicToolDefinitions();
    expect(defs.map((d) => d.name)).toEqual(['frayme_compose', 'frayme_action']);
    const [compose, action] = defs;
    expect(compose!.description).toBe(composeToolDefinition.description);
    expect(action!.description).toBe(actionToolDefinition.description);
    for (const d of defs) {
      expect(d.input_schema.type).toBe('object');
      expect(d.input_schema).not.toHaveProperty('$schema');
      expect(d.input_schema.properties).toBeTypeOf('object');
    }
    expect((compose!.input_schema.properties as Record<string, unknown>)).toHaveProperty('actions');
    expect((action!.input_schema.properties as Record<string, unknown>)).toHaveProperty('element_id');
    expect(compose!.input_examples).toEqual([...composeInputExamples]);
    expect(action!.input_examples).toEqual([...actionInputExamples]);
    for (const ex of compose!.input_examples) expect(composeInputSchema.safeParse(ex).success).toBe(true);
    for (const ex of action!.input_examples) expect(actionInputSchema.safeParse(ex).success).toBe(true);
  });
});

describe('limits consistency spot-checks (5)', () => {
  it('prompt cap == COMPOSE_PROMPT_MAX_CHARS', () => {
    expect(composeInputSchema.safeParse({ prompt: 'x'.repeat(COMPOSE_PROMPT_MAX_CHARS) }).success).toBe(true);
    expect(composeInputSchema.safeParse({ prompt: 'x'.repeat(COMPOSE_PROMPT_MAX_CHARS + 1) }).success).toBe(
      false,
    );
  });

  it('max_operations cap == COMPOSE_MAX_OPERATIONS', () => {
    expect(
      composeInputSchema.safeParse({ prompt: 'x', max_operations: COMPOSE_MAX_OPERATIONS }).success,
    ).toBe(true);
    expect(
      composeInputSchema.safeParse({ prompt: 'x', max_operations: COMPOSE_MAX_OPERATIONS + 1 }).success,
    ).toBe(false);
  });

  it('actions array cap == MAX_ACTIONS_PER_REQUEST', () => {
    const actions = Array.from({ length: MAX_ACTIONS_PER_REQUEST }, (_, i) => ({ name: `a${i}` }));
    const tooMany = Array.from({ length: MAX_ACTIONS_PER_REQUEST + 1 }, (_, i) => ({ name: `a${i}` }));
    expect(composeInputSchema.safeParse({ prompt: 'x', actions }).success).toBe(true);
    expect(composeInputSchema.safeParse({ prompt: 'x', actions: tooMany }).success).toBe(false);
  });

  it('action name cap == ACTION_NAME_MAX_CHARS (compose actions[].name and frayme_action action)', () => {
    expect(
      composeInputSchema.safeParse({ prompt: 'x', actions: [{ name: 'a'.repeat(ACTION_NAME_MAX_CHARS) }] })
        .success,
    ).toBe(true);
    expect(
      composeInputSchema.safeParse({
        prompt: 'x',
        actions: [{ name: 'a'.repeat(ACTION_NAME_MAX_CHARS + 1) }],
      }).success,
    ).toBe(false);
    expect(actionInputSchema.safeParse({ action: 'a'.repeat(ACTION_NAME_MAX_CHARS) }).success).toBe(true);
    expect(actionInputSchema.safeParse({ action: 'a'.repeat(ACTION_NAME_MAX_CHARS + 1) }).success).toBe(
      false,
    );
  });

  /*
   * `role` IS ON THE ACTION ITEM.
   *
   * It mirrors `ActionDecl.role` in the catalog, `ComposeAction.role` on the
   * wire type and the server's OpenAPI, and the platform binder prefers
   * `decl.role` over the name-derived label when it injects a control. Because
   * `z.object` strips unknown keys SILENTLY, a schema without the field would
   * drop a host's `role` with no error — the same failure shape as the dead
   * `signals.theme` above, in the other direction. The carried-not-stripped
   * assertion is what stops the field quietly leaving; the cap assertion keeps
   * it in lockstep with `ACTION_ROLE_MAX_CHARS`.
   */
  it('action role cap == ACTION_ROLE_MAX_CHARS', () => {
    expect(
      composeInputSchema.safeParse({ prompt: 'x', actions: [{ name: 'a', role: 'r'.repeat(ACTION_ROLE_MAX_CHARS) }] })
        .success,
    ).toBe(true);
    expect(
      composeInputSchema.safeParse({
        prompt: 'x',
        actions: [{ name: 'a', role: 'r'.repeat(ACTION_ROLE_MAX_CHARS + 1) }],
      }).success,
    ).toBe(false);
  });

  it('a host that sends actions[].role has it CARRIED, not stripped', () => {
    const parsed = composeInputSchema.parse({
      prompt: 'a refund approval card',
      actions: [{ name: 'approveRefund', role: 'approve', required: true }],
    }) as { actions?: Array<Record<string, unknown>> };
    expect(parsed.actions?.[0]).toEqual({ name: 'approveRefund', role: 'approve', required: true });
  });

  it('context.theme cap == CONTEXT_THEME_MAX_CHARS', () => {
    expect(
      composeInputSchema.safeParse({ prompt: 'x', context: { theme: 't'.repeat(CONTEXT_THEME_MAX_CHARS) } })
        .success,
    ).toBe(true);
    expect(
      composeInputSchema.safeParse({
        prompt: 'x',
        context: { theme: 't'.repeat(CONTEXT_THEME_MAX_CHARS + 1) },
      }).success,
    ).toBe(false);
  });

  /*
   * ONE THEME DIAL, AND IT IS `context.theme`.
   *
   * `signals.theme` used to sit on this schema and be accepted by the route, and
   * it steered NOTHING: the prompt serializer builds its `Signals:` line from
   * `signals.data_shape / density / patterns / tone` and from `context.theme` —
   * `PromptSignals` carries no `theme` field at all. A host setting it got a
   * silent no-op with no way to notice. The field is gone; these two assertions
   * are what stop it growing back, in both directions.
   */
  it('signals carries EXACTLY the four fields the serializer reads — no theme', () => {
    const sig = (composeInputSchema as unknown as { shape: Record<string, { unwrap(): { shape: Record<string, unknown> } }> })
      .shape.signals.unwrap();
    expect(Object.keys(sig.shape).sort()).toEqual(['data_shape', 'density', 'patterns', 'tone']);
  });

  it('a host that still sends signals.theme has it STRIPPED, not carried as a dead setting', () => {
    const parsed = composeInputSchema.parse({
      prompt: 'a pricing page with three tiers',
      signals: { theme: 'dark', density: 'compact' },
    } as never) as { signals?: Record<string, unknown> };
    expect(parsed.signals).toEqual({ density: 'compact' });
    expect(parsed.signals).not.toHaveProperty('theme');
  });

  it('CONTROL: context.theme — the real dial — still parses and survives', () => {
    const parsed = composeInputSchema.parse({
      prompt: 'a pricing page with three tiers',
      context: { theme: 'dark' },
    }) as { context?: Record<string, unknown> };
    expect(parsed.context).toEqual({ theme: 'dark' });
  });

  /*
   * `label` / `description` ARE ACCEPTED on frayme_action. The
   * runtime's DynamicActionEvent carries them (the pressed control's label,
   * verbatim, and the host's own words for the action) and the tool tells the
   * host to forward the event VERBATIM; `z.object` would otherwise strip both
   * silently — the `role` gap in the other direction. `createActionTool` drops
   * them before the wire (tools.test.ts proves it) because `/v1/compose` is
   * strict on `action_context`.
   */
  it('a host that forwards the event\'s label + description has them CARRIED, not stripped', () => {
    const parsed = actionInputSchema.parse({
      action: 'saveDayPlan',
      event: 'commit',
      element_id: 'savePlanBtn',
      label: "Save today's plan",
      description: 'Push the arrangement to the floor screens.',
    });
    expect(parsed).toEqual({
      action: 'saveDayPlan',
      event: 'commit',
      element_id: 'savePlanBtn',
      label: "Save today's plan",
      description: 'Push the arrangement to the floor screens.',
    });
  });

  /*
   * NEVER REJECTED ON LENGTH. The runtime caps neither
   * field — `resolveControlLabel` is verbatim, `resolveActionDescription` reads
   * the host's `actionContract` prose untrimmed — and AI SDK / Mastra validate
   * `inputSchema` BEFORE `execute`, so a `.max()` here was a rejection path for
   * event content the tool asks the host to forward verbatim, on two fields the
   * bound tool does not even send. A 2,000-char label must parse.
   */
  it('a long verbatim label + description are CARRIED, never rejected (no length cap on fields the wire does not carry)', () => {
    const r = actionInputSchema.safeParse({
      action: 'saveDayPlan',
      label: 'L'.repeat(2000),
      description: 'D'.repeat(2000),
    });
    expect(r.success).toBe(true);
  });

  it('frayme_action prompt shares the same COMPOSE_PROMPT_MAX_CHARS cap', () => {
    expect(
      actionInputSchema.safeParse({ action: 'a', prompt: 'x'.repeat(COMPOSE_PROMPT_MAX_CHARS) }).success,
    ).toBe(true);
    expect(
      actionInputSchema.safeParse({ action: 'a', prompt: 'x'.repeat(COMPOSE_PROMPT_MAX_CHARS + 1) }).success,
    ).toBe(false);
  });
});
