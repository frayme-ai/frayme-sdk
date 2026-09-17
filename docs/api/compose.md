# POST /v1/compose

Compose a validated json-render UI spec from a natural-language prompt, streamed live as SSE by default, or returned as a single JSON envelope with `stream: false`.

```
POST https://api.frayme.ai/v1/compose
Authorization: Bearer fr_live_…
Content-Type: application/json
```

The request body is `snake_case` and **strict**: any unknown field is rejected with `400 BAD_REQUEST`.

## Request fields

| Field | Type | Required | Limits / values |
| --- | --- | --- | --- |
| `prompt` | string | yes | 1-4,000 chars. What the UI should be. |
| `stream` | boolean | no | Default `true` (SSE). `false` returns a buffered envelope. |
| `signals` | object | no | The primary steering dial: `data_shape`, `density`, `patterns`, `tone`. A partial object, or none, is fine. See [steering with signals](#steering-with-signals). |
| `mode` | enum | no | `create` (default) · `edit` (pair with `prior_spec`) · `continue_journey` (pair with `action_context`) |
| `data` | object | no | ≤ 48,000 chars serialized. Display facts the UI must render **verbatim**: names, prices, rows. |
| `actions` | array | no | ≤ 20 declared actions. See [action fields](#action-fields). Frayme guarantees each `required` action is wired to a control. |
| `action_policy` | enum | no | `open` (default): model-authored actions beyond your contract stay live · `declared_only`: the server strips every non-builtin action you didn't declare. |
| `prior_spec` | object | no | ≤ 48,000 chars serialized. Your current spec; the server returns a minimal patch (edit mode). Validated before use. |
| `action_context` | object | no | ≤ 16,000 chars serialized. What the user just did. See [action_context fields](#action_context-fields). Pair with `mode: "continue_journey"`. |
| `custom_components` | array | no | ≤ 20 BYOC manifests (your plan's limit may be lower). Compiled manifests share a 12,000-char per-request budget. |
| `max_operations` | integer | no | 1-200. Caps the number of streamed operations. |
| `context` | object | no | `theme` (≤ 40 chars): **the** theme dial, `"light"` or `"dark"`; `framework_hint` (≤ 60 chars): a layout hint such as `"dashboard"`. |
| `metadata` | object | no | ≤ 24,000 chars serialized. Free-form; recorded with the generation for your own correlation. Not shown to the model. |

### Action fields

Each entry in `actions` declares one action your agent can handle:

| Field | Type | Limits / values |
| --- | --- | --- |
| `name` | string | 1-60 chars. The bound action name, e.g. `"approveRefund"`. |
| `params` | object | JSON Schema (object) for the action's params; keys bind to live UI state. |
| `role` | string | ≤ 40 chars. Short human label of the control that fires the action, e.g. `"approve"` or `"Save board"`. Frayme uses it wherever it places or injects the control itself, including the carrier button injected when the action is wired only to a non-press component. Without it an injected carrier reads "Done" (or a name-derived label when the host is itself a press, or when two carriers on one screen would both read "Done"). |
| `live` | boolean | Default `false`: only a press fires the action (see [the carrier rule](#the-carrier-rule)). `true` = ambient wiring: the action fires on every move/change with no button press (drags, sliders, board moves). |
| `confirm` | boolean \| object | Gate the control behind a confirmation dialog. `true` for a plain confirm; an object (≤ 800 chars serialized) for detail: `{"tone":"danger","body":"This cannot be undone.","confirmLabel":"Delete","denyLabel":"Keep"}`. Unknown keys are ignored, not rejected. |
| `requiredItems` | string[] | ≤ 20 names, each ≤ 60 chars. The params that are mandatory, lifted to action level: the same claim as `params.required` for hosts sending the flat param map. |
| `required` | boolean | If `true`, a control bound to this action is guaranteed present even when the generation omits the action entirely. |
| `description` | string | ≤ 160 chars. What firing this action means. |
| `kind` | enum | How the server wires it: `agent` (default: event routes back to you) · `recompose` (re-generates with a fixed `prompt`) · `host` (posts to a `channel`) · `false` (inert). |
| `prompt` | string | ≤ 4,000 chars. `recompose` only: the fixed prompt used when fired. |
| `channel` | string | ≤ 120 chars. `host` only: the postMessage channel name. |

### The carrier rule

Only a **press** round-trips to you: a Button (IconButton, Fab), a Confirmation verdict, a Form submit, a DataTable, or a row/bulk action button on a table or board. A declared action on any other component stays local: the gesture is written to `state._ui.<elementId>.<verb>` (latest per verb, never cleared by a press; an entry is what the user last did, not what changed since your last call; bound props, such as a board's `board` snapshot when the spec binds it, mirror live too) and rides in the next press's `state`. `live: true` is the per-action opt-out. If your action is wired only to a non-press component and the page root can mount a child, Frayme injects a carrier button for it, labelled from `role` (else "Done"). An `onSuccess` / `onError` chain inherits its trigger's decision. Nothing here can make a spec invalid: a denied dispatch is inert, never an error.

### action_context fields

What the runtime's `DynamicActionEvent` carries when a press fires. Forward it verbatim through `frayme_action`; the tool drops the two fields the wire does not carry.

| Field | Type | Limits |
| --- | --- | --- |
| `action` | string | required, 1-60 chars: the action the user fired |
| `event` | string | ≤ 40 chars: the canonical event verb |
| `params` | object | resolved param values at fire time |
| `state` | object | full live state snapshot |
| `element_id` | string | ≤ 120 chars. The control that fired: the button, or the table/board whose row/bulk action was pressed |
| `generation_id` | string | ≤ 120 chars: the generation the user acted on |

The event also carries `label` (the pressed control's label, verbatim; absent for a Form submit, whose `element_id` is the Form) and `description` (your own words for the action) for the host's own thread card. The `frayme_action` tool accepts both and omits them from `action_context`, which does not carry them.

## Steering with signals

`signals` is the primary steering dial: its values genuinely move the output. A partial object, or none at all, is a first-class call: send the ones you are confident about and omit the rest. A wrong signal steers worse than a missing one, so only assert what you know. Signals earn the most where the prompt alone is ambiguous: "a table of orders" describes both a compact 200-row scanning grid and a rich three-per-screen card list, and `density` is what separates them.

| Key | Values | What it steers |
| --- | --- | --- |
| `data_shape` | string[]: one or more of `avatar` · `board` · `bracket` · `calendar` · `cards` · `chart` · `citations` · `code` · `diff` · `document` · `feed` · `filters` · `form` · `image` · `link-preview` · `list` · `map` · `plans` · `reasoning` · `table` · `thread` · `timeline` · `tree` · `video` | What the content **is**. The shape of `data` follows it: table/list → a `rows` array; chart → `series` / `points`; plans → a `plans` array; form → field seed values; a single entity in depth → the entity object. |
| `density` | `compact` · `standard` · `rich` | How much per screen. `compact` is terse scanning; `rich` is generous detail and supporting copy. |
| `patterns` | string[]: any of `accordion` · `bulk-actions` · `collapsible` · `confirm-dialog` · `dialog` · `drawer` · `dropdown-menu` · `hover-card` · `multi-step` · `popover` · `row-actions` · `segmented-control` · `tabs` · `tooltip` | Interaction furniture you want available. |
| `tone` | `neutral` · `branded` | `neutral` is product-default styling; `branded` leans into the colour and voice the prompt describes. |

Light or dark is not a signal. `context.theme` is **the** theme dial (`"light"` or `"dark"`, omitted to let the host decide), and it reaches the model on the same line as the signals. There is deliberately no `signals.theme`.

```json
{
  "prompt": "Compare our three plans; mark Pro as recommended; a Choose button on each.",
  "signals": { "data_shape": ["plans", "cards"], "density": "standard", "tone": "branded" },
  "context": { "theme": "dark" },
  "data": {
    "plans": [
      { "name": "Starter", "price": "$29/mo" },
      { "name": "Pro", "price": "$99/mo", "recommended": true },
      { "name": "Scale", "price": "$299/mo" }
    ]
  }
}
```

## Streaming response (SSE)

With `stream: true` (the default) the response is `text/event-stream`. Every frame carries both an SSE `event:` name and a matching `type` field.

| Order | Event | Payload | Meaning |
| --- | --- | --- | --- |
| 1 | `compose.started` | `generation_id`, `model` | Composition began. |
| 2 | `op` × N | `op`, `path`, `value?`, `from?` | One json-render operation. **Provisional**: safe to render live, but not final. |
| 2b | `compose.restarted` × 0-2 | `generation_id`, `model` (next attempt), `reason.code` | The previous attempt failed validation and is being retried on a stronger model. **Discard all rendered state**: subsequent `op` frames build a fresh spec. |
| 3 | `compose.completed` | `generation_id`, `model`, `operation_count`, `usage`, `validated: true`, `interactions`, `components_used`, `replayed?` | The **only** finalizer. The spec passed validation; this is the billing moment. |
| - | `error` | `error.code`, `error.message` | In-band terminal failure. Never billed. Codes match the [error taxonomy](errors.md). |

A `: ping` comment is sent every 15 seconds to keep proxies from idling the connection.

Treat every rendered op as provisional until `compose.completed` arrives. The `@frayme/runtime` renderer and the `@frayme/api` stream handle restart-discard for you; hand-rolled SSE clients must implement it (see [troubleshooting](../resources/troubleshooting.md)).

## Non-streaming response

With `stream: false`, one envelope after composition finishes:

```json
{
  "success": true,
  "data": {
    "generation_id": "gen_5f0c…",
    "spec": { "state": {}, "root": "card", "elements": { "…": {} } },
    "model": "…",
    "operation_count": 42,
    "validated": true,
    "usage": { "input_tokens": 1874, "output_tokens": 912 },
    "interactions": [
      { "element": "submitBtn", "event": "commit", "action": "approveRefund", "kind": "agent", "params": null }
    ],
    "components_used": ["Button", "Card", "TextField"]
  }
}
```

`interactions` is the "what can this UI do" summary a host agent reads; `components_used` lists the unique component types in the spec. Both are omitted on an [idempotent replay](idempotency.md), which instead carries `"replayed": true`. `model` is an opaque identifier: log it, never branch on it.

## Examples

{% tabs %}
{% tab title="curl (SSE)" %}
```bash
curl -N https://api.frayme.ai/v1/compose \
  -H "Authorization: Bearer $FRAYME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A refund approval card for order #4821: amount, reason, approve/deny",
    "signals": { "data_shape": ["cards"], "density": "compact", "patterns": ["confirm-dialog"] },
    "data": { "order": { "id": "#4821", "amount": "$62.00" } },
    "actions": [
      { "name": "approveRefund", "role": "approve", "required": true },
      { "name": "denyRefund", "role": "deny" }
    ]
  }'
```
{% endtab %}

{% tab title="curl (buffered)" %}
```bash
curl https://api.frayme.ai/v1/compose \
  -H "Authorization: Bearer $FRAYME_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: refund-4821-v1" \
  -d '{ "prompt": "A refund approval card for order #4821", "stream": false }'
```
{% endtab %}

{% tab title="TypeScript (stream)" %}
```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: 'A refund approval card for order #4821: amount, reason, approve/deny',
  signals: { data_shape: ['cards'], density: 'compact', patterns: ['confirm-dialog'] },
  actions: [{ name: 'approveRefund', role: 'approve', required: true }],
});

stream.on('op', (op, snapshot) => render(snapshot)); // progressive snapshot
stream.on('restarted', () => clearRendered());       // discard on restart

const { spec, generationId } = await stream.finalSpec(); // resolves at compose.completed
```
{% endtab %}

{% tab title="TypeScript (buffered)" %}
```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const result = await frayme.compose.create({
  prompt: 'A refund approval card for order #4821',
});

console.log(result.generation_id, result.components_used);
// result.spec is a validated json-render spec: render it with @frayme/runtime
```
{% endtab %}
{% endtabs %}

## Timing

Most composes stream their first operations within a few seconds and complete shortly after; the worst case (a retry on the stronger model) can take a few minutes. Prefer streaming for interactive surfaces, and give non-streaming calls a generous timeout. The SDK and the `: ping` keepalives handle long tails for you.

## Related

- [Errors](errors.md): every code this endpoint can return
- [Idempotency](idempotency.md): `Idempotency-Key` semantics
- [The spec](../concepts/the-spec.md): anatomy of what comes back
