# The spec

Everything Frayme generates is a standard [json-render](https://json-render.dev) spec — a single JSON document describing state, elements, and wiring — built up incrementally from streamed operations.

## Anatomy

A spec has three core keys, plus optional `actions`:

| Key | Type | What it holds |
| --- | --- | --- |
| `state` | object | Initial client state. Inputs bind to paths in it; visibility and text can read from it. |
| `root` | string | The id of the top-level element. |
| `elements` | object | A flat map of element id → element. Hierarchy comes from `children` arrays of ids, not nesting. |
| `actions` | object | Optional. Named action handlers the server wires for declared actions (see [Interactivity](interactivity.md)). |

Each element uses the standard json-render keys — always spelled out, never abbreviated:

| Key | What it holds |
| --- | --- |
| `type` | A component type from the 189-component catalog, e.g. `"Card"`, `"Button"`, `"DataTable"`. |
| `props` | The component's props. May contain `$state` / `$bindState` references into `state`. |
| `children` | Ordered array of child element **ids** (strings). |
| `on` | Event wiring: `{ <event>: { action, params? } }`, using the 8 canonical event verbs. |

## A complete small spec

A feedback form: one text field bound to state, one submit button wired to a named action.

```json
{
  "state": { "message": "" },
  "root": "card",
  "elements": {
    "card": {
      "type": "Card",
      "props": { "title": "Send feedback" },
      "children": ["messageInput", "submitBtn"]
    },
    "messageInput": {
      "type": "Textarea",
      "props": {
        "label": "Your message",
        "value": { "$bindState": "/message" }
      }
    },
    "submitBtn": {
      "type": "Button",
      "props": { "label": "Send", "variant": "primary" },
      "on": {
        "commit": {
          "action": "sendFeedback",
          "params": { "message": { "$state": "/message" } }
        }
      }
    }
  }
}
```

Reading it back:

- Typing into `messageInput` writes `/message` in client state via `$bindState` — no network round-trip.
- Pressing `submitBtn` fires the canonical `commit` verb, which dispatches the `sendFeedback` action with the live value of `/message` resolved into `params`.
- The flat `elements` map means any element is addressable by id — which is exactly what makes streaming and edit mode work as patches.

## Ops: how a spec is built

On the wire, Frayme does not send the finished document. It streams **operations** — RFC 6902-shaped JSON patches, one per SSE `op` event — that incrementally build the spec:

```jsonl
{"op":"add","path":"/state","value":{"message":""}}
{"op":"add","path":"/root","value":"card"}
{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":"Send feedback"},"children":["messageInput","submitBtn"]}}
{"op":"add","path":"/elements/messageInput","value":{"type":"Textarea","props":{"label":"Your message","value":{"$bindState":"/message"}}}}
{"op":"add","path":"/elements/submitBtn","value":{"type":"Button","props":{"label":"Send","variant":"primary"},"on":{"commit":{"action":"sendFeedback","params":{"message":{"$state":"/message"}}}}}}
```

Each op has `op`, `path`, and usually `value` (a `move` op carries `from`). Applying them in order over an empty `{}` yields the full spec above. This is why UI appears progressively as it streams — each element becomes renderable the moment its op lands — and why `mode: "edit"` returns a minimal patch against your `prior_spec` instead of a full regeneration.

You rarely apply ops yourself: `ComposeStream` accumulates them into a live spec snapshot for you (see [Streaming](streaming.md)). If you need to, `@frayme/catalog/validate` exports `compileOps(opsJsonl)` to replay a JSONL string into a spec.

{% hint style="info" %}
Frayme uses the standard json-render keys — `type`, `props`, `children`, `state` — exactly as json-render defines them. There are no shortened keys and no Frayme-specific dialect, so any json-render tooling works on a Frayme spec unmodified.
{% endhint %}

## State references

Two expressions connect elements to `state`:

- `{ "$state": "/path" }` — **read** a state value into a prop or an action param. Resolved at render / fire time.
- `{ "$bindState": "/path" }` — **two-way bind** an input to a state path. The control reads from and writes to it.

Because action `params` can carry `$state` references, a button press delivers the user's live input to your agent without any client-side glue code.

## Storage

The streamed ops exist only on the wire. Store the compacted result — the full JSON spec — and pass it back as `prior_spec` when you want Frayme to edit it. `stream.finalSpec()` hands you exactly that document, post-validation.

## Next steps

- [Streaming](streaming.md) — the SSE events that deliver these ops
- [Validation](validation.md) — the gate every spec passes before you see it
- [Interactivity](interactivity.md) — what `on`, verbs, and actions do at runtime
