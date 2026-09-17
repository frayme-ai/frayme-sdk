/**
 * Schema parity — the three descriptions of the compose contract must agree:
 *
 *   1. the Zod tool schemas (`tools/index.ts`) — what an agent host SENDS,
 *   2. the wire types (`api-types.ts`) — what the client TYPES,
 *   3. the OpenAPI document (`docs/api/openapi.json`) — what the docs PROMISE.
 *
 * The server's request schema is strict: an undeclared key is a 400 before any
 * model call. So every key the tool can send must exist in the wire type (a
 * compile-time gate below) and be declared in the OpenAPI document (runtime
 * gates below), and the document must not advertise keys the wire type lacks.
 */
import { describe, expect, it } from 'vitest';
import { Frayme } from '../src/client.js';
import type { ComposeAction, ComposeActionContext, ComposeRequest } from '../src/api-types.js';
import {
  actionInputSchema,
  composeInputSchema,
  createActionTool,
  createComposeTool,
  type ActionToolInput,
  type ComposeToolInput,
} from '../src/tools/index.js';
import {
  ACTION_DESCRIPTION_MAX_CHARS,
  ACTION_NAME_MAX_CHARS,
  ACTION_NAME_MIN_CHARS,
  ACTION_PARAM_NAME_MAX_CHARS,
  ACTION_REQUIRED_ITEMS_MAX,
  ACTION_ROLE_MAX_CHARS,
  COMPOSE_MAX_OPERATIONS,
  COMPOSE_MIN_OPERATIONS,
  COMPOSE_MODES,
  COMPOSE_PROMPT_MAX_CHARS,
  COMPOSE_PROMPT_MIN_CHARS,
  CONTEXT_FRAMEWORK_HINT_MAX_CHARS,
  CONTEXT_THEME_MAX_CHARS,
  MAX_ACTIONS_PER_REQUEST,
} from '../src/limits.js';
import { buildMockFetch } from './helpers/mock-fetch.js';
// A JSON module import (no Node typings needed — this package is edge-first and
// carries none). `openapiText` is the re-serialized document, used for
// whole-document text gates; every string in the file survives the round trip.
import openapiJson from '../../../docs/api/openapi.json';

// ---------------------------------------------------------------------------
// The OpenAPI document (a subset of the JSON Schema vocabulary it uses).
// ---------------------------------------------------------------------------

interface SchemaObject {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, SchemaObject>;
  required?: string[];
  additionalProperties?: boolean | SchemaObject;
  items?: SchemaObject;
  enum?: unknown[];
  oneOf?: SchemaObject[];
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  description?: string;
}

interface OpenApiDoc {
  info: { description: string };
  paths: Record<
    string,
    Record<
      string,
      { requestBody?: { content: Record<string, { examples?: Record<string, { value: unknown }> }> } }
    >
  >;
  components: {
    schemas: Record<string, SchemaObject>;
    securitySchemes: Record<string, { description?: string }>;
  };
}

const openapi = openapiJson as unknown as OpenApiDoc;
const openapiText = JSON.stringify(openapiJson);

const schema = (name: string): SchemaObject => {
  const s = openapi.components.schemas[name];
  if (!s) throw new Error(`openapi.json has no components.schemas.${name}`);
  return s;
};

/** Follow a `$ref` (one level is all this document uses). */
const resolve = (s: SchemaObject): SchemaObject => {
  if (!s.$ref) return s;
  const name = s.$ref.replace('#/components/schemas/', '');
  return schema(name);
};

const propertyKeys = (s: SchemaObject): string[] => Object.keys(resolve(s).properties ?? {});

// ---------------------------------------------------------------------------
// The tool's key sets, read off the Zod schemas so they can never go stale.
// ---------------------------------------------------------------------------

const composeToolKeys = Object.keys(composeInputSchema.shape);
const signalsShape = composeInputSchema.shape.signals.unwrap().shape;
const signalsKeys = Object.keys(signalsShape);
const contextKeys = Object.keys(composeInputSchema.shape.context.unwrap().shape);
const actionItemKeys = Object.keys(composeInputSchema.shape.actions.unwrap().element.shape);
const actionToolKeys = Object.keys(actionInputSchema.shape);

// ---------------------------------------------------------------------------
// Compile-time gates. A fresh object literal is excess-property checked, so a
// tool key the wire type lacks fails `tsc` here; the runtime checks further
// down fail when the tool gains a key these literals do not carry.
// ---------------------------------------------------------------------------

/** Every key the compose tool can send, written as a wire request. */
const everyToolKeyAsWire: ComposeRequest = {
  prompt: 'Compare our three plans; mark Pro as recommended; a Choose button on each.',
  signals: { data_shape: ['plans', 'cards'], density: 'standard', patterns: ['tabs'], tone: 'branded' },
  mode: 'edit',
  context: { theme: 'dark', framework_hint: 'card-heavy' },
  max_operations: 50,
  data: { plans: [{ name: 'Pro', price: '$99/mo' }] },
  actions: [
    {
      name: 'choosePlan',
      role: 'Choose',
      params: { type: 'object', properties: { plan: { type: 'string' } }, required: ['plan'] },
      requiredItems: ['plan'],
      live: false,
      confirm: { tone: 'danger', body: 'This cannot be undone.' },
      required: true,
      description: 'User chose a plan.',
    },
  ],
  prior_spec: { root: 'card', elements: { card: { type: 'Card', props: {} } } },
  custom_components: [{ name: 'PriceBadge' }],
};

/** Every key the wire type declares — the reverse direction: the document may not
 *  advertise a key the client cannot type. */
const everyWireKey: Required<ComposeRequest> = {
  ...everyToolKeyAsWire,
  prompt: everyToolKeyAsWire.prompt,
  signals: everyToolKeyAsWire.signals ?? {},
  mode: 'continue_journey',
  context: everyToolKeyAsWire.context ?? {},
  max_operations: 50,
  data: everyToolKeyAsWire.data ?? {},
  actions: everyToolKeyAsWire.actions ?? [],
  prior_spec: everyToolKeyAsWire.prior_spec ?? {},
  custom_components: everyToolKeyAsWire.custom_components ?? [],
  stream: false,
  action_policy: 'declared_only',
  action_context: { action: 'choosePlan' },
  metadata: { trace: 'schema-parity' },
};

/** Every key the wire's ComposeAction declares. */
const everyWireActionKey: Required<ComposeAction> = {
  name: 'approveRefund',
  params: { order_id: { description: 'The order to refund.' } },
  requiredItems: ['order_id'],
  role: 'Approve refund',
  required: true,
  live: false,
  confirm: true,
  description: 'User approved the refund.',
  kind: 'agent',
  prompt: 'Show the refund receipt.',
  channel: 'refunds',
};

/** Every key the frayme_action tool accepts — the runtime's event plus `prompt`. */
const everyActionToolKey: ActionToolInput = {
  action: 'choosePlan',
  event: 'commit',
  params: { plan: 'Pro' },
  state: { _ui: { choosePro: { commit: { label: 'Choose Pro' } } } },
  element_id: 'choosePro',
  label: 'Choose Pro',
  description: 'User chose a plan.',
  generation_id: 'gen_parity',
  prompt: 'User chose Pro — show the checkout summary.',
  data: { plan: 'Pro', price: '$99/mo' },
  actions: [{ name: 'confirmCheckout', role: 'Confirm', required: true }],
  signals: { data_shape: ['form'], density: 'compact' },
};

/* Type-level assertions (no runtime cost): the tool input types are assignable
   to the wire types as wholes, so a divergence in a nested enum or shape fails
   `tsc` even where the key sets still agree. */
const _toolInputIsAWireRequest: ComposeRequest = {} as ComposeToolInput;
const _toolSignalsAreWireSignals: NonNullable<ComposeRequest['signals']> = {} as NonNullable<
  ComposeToolInput['signals']
>;
const _toolActionIsAWireAction: ComposeAction = {} as NonNullable<ComposeToolInput['actions']>[number];
const _forwardedEventIsAWireContext: ComposeActionContext = {} as Omit<
  ActionToolInput,
  'prompt' | 'label' | 'description' | 'data' | 'actions' | 'signals'
>;
/* The next-screen inputs frayme_action forwards are top-level request fields. */
const _actionToolNextScreenIsWire: Pick<ComposeRequest, 'data' | 'actions' | 'signals'> = {} as Pick<
  ActionToolInput,
  'data' | 'actions' | 'signals'
>;
void _toolInputIsAWireRequest;
void _toolSignalsAreWireSignals;
void _toolActionIsAWireAction;
void _forwardedEventIsAWireContext;
void _actionToolNextScreenIsWire;

// ---------------------------------------------------------------------------
// 1. tool schema ⊆ wire type — the literals above carry every tool key.
// ---------------------------------------------------------------------------

describe('compose tool schema ⊆ ComposeRequest wire type', () => {
  it('the ComposeRequest literal carries every top-level key the tool can send', () => {
    for (const key of composeToolKeys) {
      expect(Object.keys(everyToolKeyAsWire), `tool key "${key}" is missing from the wire literal`).toContain(key);
    }
  });

  it('the literal is itself a valid tool input', () => {
    const parsed = composeInputSchema.safeParse(everyToolKeyAsWire);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it('the literal carries every signals / context / action-item key the tool can send', () => {
    for (const key of signalsKeys) expect(Object.keys(everyToolKeyAsWire.signals ?? {})).toContain(key);
    for (const key of contextKeys) expect(Object.keys(everyToolKeyAsWire.context ?? {})).toContain(key);
    for (const key of actionItemKeys) expect(Object.keys(everyToolKeyAsWire.actions![0]!)).toContain(key);
  });

  it('the ActionToolInput literal carries every key the frayme_action tool accepts', () => {
    for (const key of actionToolKeys) expect(Object.keys(everyActionToolKey)).toContain(key);
    expect(actionInputSchema.safeParse(everyActionToolKey).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. tool schema ⊆ openapi ComposeRequest / ComposeAction / ComposeSignals.
// ---------------------------------------------------------------------------

describe('compose tool schema ⊆ openapi.json ComposeRequest', () => {
  const requestProps = propertyKeys(schema('ComposeRequest'));

  it('declares every top-level key the tool can send', () => {
    for (const key of composeToolKeys) {
      expect(requestProps, `openapi ComposeRequest lacks tool key "${key}"`).toContain(key);
    }
  });

  it('declares no key the wire type cannot express', () => {
    for (const key of requestProps) {
      expect(Object.keys(everyWireKey), `openapi ComposeRequest advertises "${key}", unknown to ComposeRequest`).toContain(key);
    }
  });

  it('is strict, like the server: additionalProperties false on every request object', () => {
    for (const name of ['ComposeRequest', 'ComposeSignals', 'ComposeContext', 'ComposeAction', 'ComposeActionContext']) {
      expect(schema(name).additionalProperties, `${name}.additionalProperties`).toBe(false);
    }
  });

  it('signals: same keys and the same enums as the tool', () => {
    const signals = schema('ComposeRequest').properties!.signals!;
    expect(propertyKeys(signals).sort()).toEqual([...signalsKeys].sort());
    const props = resolve(signals).properties!;
    expect(props.density!.enum).toEqual([...signalsShape.density.unwrap().options]);
    expect(props.tone!.enum).toEqual([...signalsShape.tone.unwrap().options]);
    expect(props.data_shape!.type).toBe('array');
    expect(props.data_shape!.items!.type).toBe('string');
    expect(props.patterns!.type).toBe('array');
    expect(props.patterns!.items!.type).toBe('string');
  });

  it('context: same keys and the same caps as the tool', () => {
    const context = resolve(schema('ComposeRequest').properties!.context!);
    expect(propertyKeys(context).sort()).toEqual([...contextKeys].sort());
    expect(context.properties!.theme!.maxLength).toBe(CONTEXT_THEME_MAX_CHARS);
    expect(context.properties!.framework_hint!.maxLength).toBe(CONTEXT_FRAMEWORK_HINT_MAX_CHARS);
  });

  it('caps match limits.ts: prompt, max_operations, actions, mode', () => {
    const props = schema('ComposeRequest').properties!;
    expect(props.prompt!.minLength).toBe(COMPOSE_PROMPT_MIN_CHARS);
    expect(props.prompt!.maxLength).toBe(COMPOSE_PROMPT_MAX_CHARS);
    expect(props.max_operations!.minimum).toBe(COMPOSE_MIN_OPERATIONS);
    expect(props.max_operations!.maximum).toBe(COMPOSE_MAX_OPERATIONS);
    expect(props.actions!.maxItems).toBe(MAX_ACTIONS_PER_REQUEST);
    expect(props.mode!.enum).toEqual([...COMPOSE_MODES]);
    expect(props.mode!.enum).toEqual([...composeInputSchema.shape.mode.unwrap().options]);
  });
});

describe('compose tool actions[] item ⊆ openapi.json ComposeAction', () => {
  const actionProps = propertyKeys(schema('ComposeAction'));

  it('declares every action key the tool can send', () => {
    for (const key of actionItemKeys) {
      expect(actionProps, `openapi ComposeAction lacks tool key "${key}"`).toContain(key);
    }
  });

  it('declares no key the wire ComposeAction cannot express', () => {
    for (const key of actionProps) {
      expect(Object.keys(everyWireActionKey), `openapi ComposeAction advertises "${key}", unknown to ComposeAction`).toContain(key);
    }
  });

  it('caps match limits.ts: name, role, description', () => {
    const props = schema('ComposeAction').properties!;
    expect(props.name!.minLength).toBe(ACTION_NAME_MIN_CHARS);
    expect(props.name!.maxLength).toBe(ACTION_NAME_MAX_CHARS);
    expect(props.role!.maxLength).toBe(ACTION_ROLE_MAX_CHARS);
    expect(props.description!.maxLength).toBe(ACTION_DESCRIPTION_MAX_CHARS);
    expect(schema('ComposeAction').required).toEqual(['name']);
  });

  it('requiredItems caps match the server: at most 20 names, each at most 60 chars', () => {
    const requiredItems = schema('ComposeAction').properties!.requiredItems!;
    expect(requiredItems.type).toBe('array');
    expect(requiredItems.maxItems).toBe(ACTION_REQUIRED_ITEMS_MAX);
    expect(requiredItems.items!.maxLength).toBe(ACTION_PARAM_NAME_MAX_CHARS);
    const item = composeInputSchema.shape.actions.unwrap().element.shape.requiredItems;
    const within = { name: 'a', requiredItems: Array.from({ length: ACTION_REQUIRED_ITEMS_MAX }, () => 'p'.repeat(ACTION_PARAM_NAME_MAX_CHARS)) };
    expect(item).toBeDefined();
    expect(composeInputSchema.safeParse({ prompt: 'x', actions: [within] }).success).toBe(true);
    const tooMany = { name: 'a', requiredItems: Array.from({ length: ACTION_REQUIRED_ITEMS_MAX + 1 }, () => 'p') };
    expect(composeInputSchema.safeParse({ prompt: 'x', actions: [tooMany] }).success).toBe(false);
    const tooLong = { name: 'a', requiredItems: ['p'.repeat(ACTION_PARAM_NAME_MAX_CHARS + 1)] };
    expect(composeInputSchema.safeParse({ prompt: 'x', actions: [tooLong] }).success).toBe(false);
  });

  it('confirm is boolean | object, as the tool sends it', () => {
    const confirm = schema('ComposeAction').properties!.confirm!;
    const types = (confirm.oneOf ?? []).map((s) => s.type).sort();
    expect(types).toEqual(['boolean', 'object']);
  });
});

// ---------------------------------------------------------------------------
// 3. frayme_action ⊆ openapi FraymeActionInput; what it FORWARDS ⊆ ComposeActionContext.
// ---------------------------------------------------------------------------

describe('frayme_action input ⊆ openapi.json FraymeActionInput / ComposeActionContext', () => {
  it('FraymeActionInput declares exactly the keys the tool accepts', () => {
    const documented = propertyKeys(schema('FraymeActionInput'));
    expect([...documented].sort()).toEqual([...actionToolKeys].sort());
    expect(schema('FraymeActionInput').required).toEqual(['action']);
  });

  it('ComposeActionContext declares only keys the tool accepts (no phantom wire fields)', () => {
    for (const key of propertyKeys(schema('ComposeActionContext'))) {
      expect(actionToolKeys, `openapi ComposeActionContext advertises "${key}", unknown to the tool`).toContain(key);
    }
    expect(schema('ComposeActionContext').required).toEqual(['action']);
  });

  it('every action_context key the SDK actually forwards is declared on ComposeActionContext', async () => {
    const mock = buildMockFetch([{ status: 200, body: JSON.stringify(composeSuccess) }]);
    const tool = createActionTool(offlineClient(mock.fetch));
    await tool.execute(everyActionToolKey);
    const body = JSON.parse(mock.calls[0]!.body!) as Record<string, unknown>;

    // The round-trip request itself is a documented ComposeRequest.
    for (const key of Object.keys(body)) {
      expect(propertyKeys(schema('ComposeRequest')), `round-trip body key "${key}" undeclared`).toContain(key);
    }
    expect(body.mode).toBe('continue_journey');
    expect(body.prompt).toBe(everyActionToolKey.prompt);

    const ctxKeys = Object.keys(body.action_context as Record<string, unknown>);
    const declared = propertyKeys(schema('ComposeActionContext'));
    for (const key of ctxKeys) {
      expect(declared, `forwarded action_context key "${key}" undeclared on ComposeActionContext`).toContain(key);
    }
    // And nothing the tool accepts but does not forward leaks onto the wire.
    for (const key of ['prompt', 'label', 'description']) expect(ctxKeys).not.toContain(key);
    // The next screen's inputs ride at the top level, never inside action_context.
    for (const key of ['data', 'actions', 'signals']) {
      expect(ctxKeys).not.toContain(key);
      expect(body[key]).toEqual(everyActionToolKey[key as 'data' | 'actions' | 'signals']);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. The real compose body the tool sends is fully declared, and ui_type is gone.
// ---------------------------------------------------------------------------

describe('what the compose tool puts on the wire is fully declared', () => {
  it('every key of a maximal frayme_compose request body is an openapi ComposeRequest property', async () => {
    const mock = buildMockFetch([{ status: 200, body: JSON.stringify(composeSuccess) }]);
    const tool = createComposeTool(offlineClient(mock.fetch));
    await tool.execute(everyToolKeyAsWire as ComposeToolInput);
    const body = JSON.parse(mock.calls[0]!.body!) as Record<string, unknown>;
    const declared = propertyKeys(schema('ComposeRequest'));
    for (const key of Object.keys(body)) {
      expect(declared, `compose body key "${key}" is undeclared in openapi.json`).toContain(key);
    }
    expect(body.stream).toBe(false);
  });

  it('the documented request examples are valid tool inputs', () => {
    const examples = openapi.paths['/v1/compose']!.post!.requestBody!.content['application/json']!.examples!;
    expect(Object.keys(examples).length).toBeGreaterThan(0);
    for (const [name, { value }] of Object.entries(examples)) {
      const parsed = composeInputSchema.safeParse(value);
      expect(parsed.success, `example "${name}": ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
      const v = value as Record<string, unknown>;
      expect(v.signals, `example "${name}" should steer with signals`).toBeDefined();
    }
  });

  it('ui_type appears nowhere in openapi.json (the route rejects it with 400)', () => {
    expect(openapiText).not.toMatch(/ui_type/);
  });

  it('no launch-window text in the info or auth descriptions', () => {
    expect(openapi.info.description).not.toMatch(/access opens|opens on/i);
    expect(openapi.components.securitySchemes.bearerAuth!.description ?? '').not.toMatch(/access opens|opens on/i);
  });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const composeSuccess = {
  success: true,
  data: {
    generation_id: 'gen_parity',
    spec: { root: 'card', elements: { card: { type: 'Card', props: {} } } },
    model: 'frayme',
    operation_count: 1,
    validated: true,
    usage: { input_tokens: 1, output_tokens: 1 },
  },
};

function offlineClient(fetchImpl: typeof globalThis.fetch): Frayme {
  return new Frayme({ apiKey: 'fr_live_parity', baseURL: 'https://api.test', fetch: fetchImpl });
}
