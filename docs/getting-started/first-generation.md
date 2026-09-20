# Your first generation

Follow one compose call end to end: the request that goes up, every SSE event that comes back, the validated spec it builds, and the rendered result.

This is the generation the [quickstart](quickstart.md) triggers, slowed down so you can see the wire.

## The request

One endpoint does the composing: `POST /v1/compose`. The body is `snake_case` and **strict**: any unknown field is rejected with `400 BAD_REQUEST`. Streaming is the default.

{% tabs %}
{% tab title="curl" %}
```bash
curl -N https://api.frayme.ai/v1/compose \
  -H "Authorization: Bearer $FRAYME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A signup form: full name, work email, and team size, with a submit button bound to a create_account action",
    "signals": { "data_shape": ["form"], "density": "compact" },
    "actions": [
      {
        "name": "create_account",
        "role": "submit",
        "required": true,
        "description": "Create the account with the entered details"
      }
    ]
  }'
```
{% endtab %}

{% tab title="TypeScript" %}
```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt:
    'A signup form: full name, work email, and team size, ' +
    'with a submit button bound to a create_account action',
  signals: { data_shape: ['form'], density: 'compact' },
  actions: [
    {
      name: 'create_account',
      role: 'submit',
      required: true,
      description: 'Create the account with the entered details',
    },
  ],
});
```
{% endtab %}
{% endtabs %}

Three fields are doing the work here:

- **`prompt`** (required, 1-4,000 chars): what the UI should be.
- **`signals`**: the steering dial. `data_shape: ['form']` says what the content is, `density: 'compact'` how much per screen. Optional; send only what you are confident about. See [steering with signals](../api/compose.md#steering-with-signals).
- **`actions`**: the contract between the UI and your agent. Declaring `create_account` as `required: true` guarantees the returned spec has a control wired to it.

The full field list (`data`, `mode`, `prior_spec`, `custom_components`, …) is in the [compose reference](../api/compose.md).

## What comes back

With `stream: true` (the default) the response is `text/event-stream`. Every frame carries both an SSE `event:` name and a matching `type` field. Here is the actual sequence:

```
event: compose.started
data: {"type":"compose.started","generation_id":"gen_5f0c…","model":"…"}

event: op
data: {"type":"op","op":"add","path":"/state","value":{"name":"","email":"","team_size":""}}

event: op
data: {"type":"op","op":"add","path":"/root","value":"card"}

event: op
data: {"type":"op","op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":"Create your account"},"children":["nameInput","emailInput","teamSize","submitBtn"]}}

event: op
data: {"type":"op","op":"add","path":"/elements/nameInput","value":{"type":"Input","props":{"label":"Full name","name":"name","value":{"$bindState":"/name"}}}}

: ping

event: op
data: … (three more ops: emailInput, teamSize, submitBtn)

event: compose.completed
data: {"type":"compose.completed","generation_id":"gen_5f0c…","model":"…","operation_count":7,"usage":{"input_tokens":1412,"output_tokens":486},"validated":true,"interactions":[{"element":"submitBtn","event":"commit","action":"create_account","kind":"agent","params":null}],"components_used":["Button","Card","Input","Select"]}
```

Reading the stream:

- **`compose.started`**: composition began. `model` is an opaque identifier: log it, never branch on it.
- **`op` × N**: one json-render operation each (RFC 6902 shaped: `op`, `path`, usually `value`). Ops are **live but provisional**. Render them as they arrive, but nothing is final yet.
- **`: ping`** is a keepalive comment every 15 seconds so proxies don't idle the connection out. Ignore it.
- **`compose.restarted`** (not shown, ×0-1): the attempt failed validation and Frayme is retrying on a stronger model in the same response (at most one restart per request today; treat every one the same way). **Discard everything rendered so far**; the following `op` frames build a fresh spec.
- **`compose.completed`**: the **only** finalizer. The spec passed validation against the 189-component catalog, with the same `validateSpec` the renderer applies; this is also the billing moment. It carries `usage`, `interactions` (the "what can this UI do" summary, listing which elements fire which actions), and `components_used`.
- **`error`**: an in-band terminal failure instead of `compose.completed`. Never billed. Codes match the [error taxonomy](../api/errors.md).

## The spec the ops built

Apply the seven ops in order over `{}` and you get the finished document, a standard [json-render](https://json-render.dev) spec:

```json
{
  "state": { "name": "", "email": "", "team_size": "" },
  "root": "card",
  "elements": {
    "card": {
      "type": "Card",
      "props": { "title": "Create your account" },
      "children": ["nameInput", "emailInput", "teamSize", "submitBtn"]
    },
    "nameInput": {
      "type": "Input",
      "props": { "label": "Full name", "name": "name", "value": { "$bindState": "/name" } }
    },
    "emailInput": {
      "type": "Input",
      "props": { "label": "Work email", "name": "email", "type": "email", "value": { "$bindState": "/email" } }
    },
    "teamSize": {
      "type": "Select",
      "props": { "label": "Team size", "name": "team_size", "options": ["Just me", "2-10", "11-50", "50+"], "value": { "$bindState": "/team_size" } }
    },
    "submitBtn": {
      "type": "Button",
      "props": { "label": "Create account", "variant": "primary" },
      "on": { "commit": { "action": "create_account" } }
    }
  }
}
```

Two things to notice:

- The inputs bind to `state` via `$bindState`: typing resolves locally in the renderer, with no network traffic.
- The button's `commit` event is wired to `create_account`, exactly as the request's action contract demanded. That one interaction is what round-trips to your code.

[The spec](../concepts/the-spec.md) covers this document format in depth.

## Consuming it with the SDK

You never parse SSE frames by hand. `compose.stream()` accumulates ops into live spec snapshots, resets them on a restart, and maps in-band `error` events to typed exceptions:

```ts
stream.on('started', ({ generation_id }) => console.log('composing', generation_id));
stream.on('op', (op, snapshot) => render(snapshot)); // live, provisional
stream.on('restarted', () => clearRendered());       // discard handled state-side for you

const final = await stream.finalSpec(); // resolves on compose.completed, rejects on error
console.log(final.operationCount, final.usage, final.model);
// final.spec is the validated document: render or store it
```

`finalSpec()` resolves with `{ spec, generationId, model, operationCount, usage, replayed }`. The stream is also directly async-iterable (`for await (const event of stream)`) if you want the raw typed events.

## Render it

The spec becomes working UI with one component:

```tsx
import { FraymeRenderer } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

<FraymeRenderer
  spec={final.spec}
  onDynamicAction={(event) => {
    // event.action === 'create_account'
    // event.state  === { name: '…', email: '…', team_size: '…' }
  }}
/>;
```

Typing in the fields never reaches `onDynamicAction`: only the spec-declared `create_account` does, carrying the live state the user entered.

## The same call, buffered

Set `stream: false` to skip SSE and get one JSON envelope after composition finishes (same spec, same fields as `compose.completed`):

```bash
curl https://api.frayme.ai/v1/compose \
  -H "Authorization: Bearer $FRAYME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A signup form: full name, work email, and team size", "signals": {"data_shape": ["form"]}, "stream": false}'
```

```json
{
  "success": true,
  "data": {
    "generation_id": "gen_5f0c…",
    "spec": { "state": { }, "root": "card", "elements": { } },
    "model": "…",
    "operation_count": 7,
    "validated": true,
    "usage": { "input_tokens": 1412, "output_tokens": 486 },
    "interactions": [ ],
    "components_used": ["Button", "Card", "Input", "Select"]
  }
}
```

## What you were billed

Exactly one generation: billing happens only when a spec passes validation (`compose.completed` or a `validated: true` envelope). Failed attempts, in-band errors, and [idempotent replays](../api/idempotency.md) are free.

## Next steps

- [Streaming](../concepts/streaming.md): the event lifecycle in depth, including restarts
- [The spec](../concepts/the-spec.md): the document format and how ops build it
- [POST /v1/compose](../api/compose.md): every request field, event, and limit
- [Errors](../api/errors.md): the full code taxonomy and how the SDK surfaces it
