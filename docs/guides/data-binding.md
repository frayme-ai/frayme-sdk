# Data binding

The `data` field puts your real facts into the generated UI verbatim, and `$state` / `$bindState` expressions wire elements to live client state.

## The `data` field: verbatim display facts

Anything the UI must show *exactly* (names, prices, line items, dates) goes in `data`, not the prompt:

```ts
const stream = frayme.compose.stream({
  prompt: 'Order summary with a cancel option',
  signals: { data_shape: ['list'], density: 'standard' },
  data: {
    order: {
      id_display: '#4821',
      placed: '12 Jul 2026',
      items: [
        { name: 'Desk mat, wool felt', qty: 1, price: '£38.00' },
        { name: 'Cable weight', qty: 2, price: '£9.50' },
      ],
      total: '£57.00',
    },
  },
});
```

Facts in `data` are rendered **verbatim**: the exact strings you send appear in the spec's props and state. Facts described loosely in the prompt are interpretation; facts in `data` are contract.

Rules of thumb:

- `data` is for **display facts**: what a human should read on screen. Keep internal ids, foreign keys, and feature flags out of it; correlate on your side via `generation_id` and action params instead.
- Pre-format values you care about (`'£57.00'`, not `56.999`). What you send is what renders.
- The serialized field is capped at **48,000 characters**. Send the rows the screen needs, not the whole table. For large collections, a representative page plus a count beats the full dump.

## `$state` and `$bindState`

Two expressions connect elements to the spec's `state` object (see [The spec](../concepts/the-spec.md)):

```json
{
  "state": { "email": "", "plan": "pro" },
  "elements": {
    "emailInput": {
      "type": "TextInput",
      "props": { "label": "Email", "value": { "$bindState": "/email" } }
    },
    "submit": {
      "type": "Button",
      "props": { "label": "Subscribe" },
      "on": {
        "commit": {
          "action": "subscribe",
          "params": { "email": { "$state": "/email" }, "plan": { "$state": "/plan" } }
        }
      }
    }
  }
}
```

- `{ "$bindState": "/path" }` is a **two-way bind**: the control reads its value from the path and writes back on input. Typing never leaves the browser.
- `{ "$state": "/path" }` is a **read**: it resolves the path's live value into a prop or an action param at render / fire time.

This is why action handlers receive plain values: by the time `subscribe` reaches your code, `params.email` is whatever the user typed. You never write client-side glue to collect form values.

## Repeated lists and why unseeded repeats render zero rows

List-shaped UI is usually a template element repeated over a state array:

```json
{
  "state": { "invoices": [
    { "number": "INV-014", "amount": "£1,200.00", "status": "paid" },
    { "number": "INV-015", "amount": "£840.00", "status": "due" }
  ]},
  "elements": {
    "invoiceRow": {
      "type": "ListItem",
      "repeat": { "statePath": "/invoices" },
      "props": { "title": { "$bindItem": "number" }, "meta": { "$bindItem": "amount" } }
    }
  }
}
```

The renderer resolves a repeat as *the array at `statePath`, or `[]` if the path is absent*. That fallback is the trap: a repeat whose path is **not seeded in `/state` silently renders zero rows**. The spec is structurally fine, validation of the shape passes, and the subtree simply vanishes at runtime.

This is why `data` matters beyond correctness of copy: facts you pass in `data` are seeded into `state`, so repeats driven by them actually render. Frayme's validators flag an unseeded `repeat.statePath` for exactly this reason. Note that seeding `[]` passes the check but *still renders nothing*; use an empty seed only when your host genuinely fills the list at runtime (for example via `initialState` on the renderer).

{% hint style="info" %}
If a generated list shows no rows, check `state` first. Nine times out of ten the repeat's `statePath` points at a key that was never seeded. Send the rows in `data`, or inject them with `initialState`.
{% endhint %}

## Injecting state at render time

For a stored spec rendered with per-user values, override the seed instead of re-composing:

```tsx
<FraymeRenderer
  spec={storedSpec}
  initialState={{ ...storedSpec.state, invoices: await fetchInvoices(user) }}
/>
```

Spread the spec's own state first; replacing it wholesale would unseat every other bound path.

## Where each kind of fact belongs

| Fact | Where |
| --- | --- |
| Copy the UI must show exactly (names, prices, items) | `data` |
| Intent, layout, tone ("a compact dark dashboard") | `prompt` |
| Per-user values into an already-generated spec | `initialState` |
| What the user just did | `action_context` (see [Edits and journeys](edits-and-journeys.md)) |

## Next steps

- [The spec](../concepts/the-spec.md): the full document anatomy
- [State and actions](state-and-actions.md): how bound state reaches your handlers
