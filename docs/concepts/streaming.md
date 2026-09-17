# Streaming

`POST /v1/compose` streams by default: UI arrives as Server-Sent Events, renders progressively, and only becomes final (and billable) when the terminal `compose.completed` event lands.

## The event sequence

Every streaming compose follows one shape:

```
compose.started → op ×N → [compose.restarted → op ×N] ×0-2 → compose.completed
                                                            | error
```

| Event | Payload | Meaning |
| --- | --- | --- |
| `compose.started` | `generation_id`, `model` | An attempt began. `model` is an opaque identifier. |
| `op` | `op`, `path`, `value?`, `from?` | One json-render operation (RFC 6902 shaped). **Provisional.** |
| `compose.restarted` | `generation_id`, `model`, `reason.code` | The previous attempt failed validation. **Discard everything rendered so far.** The next ops come from a stronger model. |
| `compose.completed` | `generation_id`, `model`, `operation_count`, `usage`, `validated: true`, `replayed?` | Terminal success: the **only** event that makes ops final. Carries usage, plus `interactions` and `components_used` on fresh generations. |
| `error` | `error.code`, `error.message` | Terminal failure, delivered in-band on the 200 stream. Unbilled. |

Two rules fall out of this:

1. **Ops are provisional until `compose.completed`.** Render them live for perceived speed, but treat the spec as unconfirmed: never persist or act on it before the completion event.
2. **`compose.restarted` means discard.** Clear all rendered state and start accumulating again from empty (or from `prior_spec` in edit mode). Up to 2 restarts can occur per request.

## On the wire

```bash
curl -N https://api.frayme.ai/v1/compose \
  -H "Authorization: Bearer $FRAYME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A feedback form with a message field and a send button"}'
```

```
event: compose.started
data: {"type":"compose.started","generation_id":"gen_01j...","model":"frayme-compose-1"}

event: op
data: {"type":"op","op":"add","path":"/root","value":"card"}

event: op
data: {"type":"op","op":"add","path":"/elements/card","value":{"type":"Card","children":[]}}

: ping

event: compose.completed
data: {"type":"compose.completed","generation_id":"gen_01j...","model":"frayme-compose-1","operation_count":6,"usage":{...},"validated":true}
```

Details worth knowing:

- **Keepalives.** The server sends a `: ping` comment line every 15 seconds so proxies and load balancers do not kill quiet connections. SSE parsers ignore comment lines; if you hand-roll a parser, skip lines starting with `:`.
- **Errors are in-band.** Once the stream is open the HTTP status is already 200, so failures arrive as an `error` event on the stream, carrying the same `code` values as non-streaming error responses (`COMPOSITION_FAILED`, `MODEL_UNAVAILABLE`, ...). Failed streams are never billed.
- **Billing.** You are billed only when `compose.completed` fires. Restarts, validation failures, and idempotent replays (`replayed: true`) cost nothing.

## The SDK handles all of this: ComposeStream

`frayme.compose.stream()` returns a `ComposeStream`: an async iterable, an event emitter, and a spec accumulator in one object. You never parse SSE, apply ops, or track restart state yourself.

```ts
import Frayme from '@frayme/api';

const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });

const stream = frayme.compose.stream({
  prompt: 'A feedback form with a message field and a send button',
});

// Each op arrives with a progressively accumulated spec snapshot.
stream.on('op', (op, snapshot) => render(snapshot));

// Restart handling: the internal accumulator has already been reset.
// Mirror that by clearing whatever you rendered.
stream.on('restarted', () => clearRendered());

// Resolves once the spec is validated; rejects with a typed FraymeError.
const { spec, generationId, usage } = await stream.finalSpec();
```

What `ComposeStream` does for you:

- **Accumulates ops** into a live snapshot (`currentSpec()`), seeded from `prior_spec` in edit mode so patches apply over the existing document.
- **Resets on `compose.restarted`**: the snapshot reverts to the seed before the `restarted` handler fires, so a stale attempt can never leak into the final spec.
- **Maps in-band `error` events to typed errors**: they are thrown (and reject `finalSpec()`), never yielded as events.
- **Enforces a first-event deadline** so a dead connection fails fast instead of hanging.
- **Supports cancellation**: call `stream.abort()`, pass an `AbortSignal`, or simply `break` out of a `for await` loop.

You can also consume it as a plain async iterable:

```ts
for await (const event of frayme.compose.stream({ prompt })) {
  if (event.type === 'op') console.log(event.path);
}
```

## In React: useFraymeCompose

`useFraymeCompose` wires the whole contract into component state, including the restart discard:

```tsx
import { FraymeRenderer, useFraymeCompose } from '@frayme/runtime/react';

function Composer() {
  const { compose, spec, status, restartKey } = useFraymeCompose();

  return (
    <>
      <button onClick={() => compose({ prompt: 'A project dashboard' })}>
        Compose
      </button>
      {spec && (
        <FraymeRenderer spec={spec} mode="progressive" restartKey={restartKey} />
      )}
    </>
  );
}
```

- `spec` is the live snapshot. Pass it to `<FraymeRenderer mode="progressive">` to render mid-stream.
- On `compose.restarted` the hook nulls `spec` and bumps `restartKey`; passing `restartKey` to the renderer remounts its state tree, so discarded UI (and any half-entered input against it) cannot survive a restart.
- `status` moves through `idle → streaming → restarting → complete | error`.

## Non-streaming

`compose.create()` is the non-streaming path: it resolves with the final validated spec in a single JSON response (the SDK sets `stream: false` on the wire for you). Same validation, same billing rules, no progressive rendering. Prefer streaming for anything user-facing; a typical spec starts rendering long before the full document exists.

```ts
const result = await frayme.compose.create({
  prompt: 'A feedback form with a message field and a send button',
});
// result.spec: the full validated json-render spec
```

## Next steps

- [The spec](the-spec.md): what the streamed ops build
- [Validation](validation.md): why `compose.completed` is the only finalizer
- [Interactivity](interactivity.md): what happens after the UI renders
