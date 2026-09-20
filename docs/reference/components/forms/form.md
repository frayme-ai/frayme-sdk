# Form

Form wrapper that lays out fields + a submit button. Bind on.commit for the handler; the renderer prevents the native page reload and emits the event. Set `disabled` to lock every field at once (e.g. while a submit is in flight).

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "form",
  "elements": {
    "form": {
      "type": "Form",
      "props": {
        "layout": "vertical",
        "gap": "md"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `layout` | `"vertical" \| "horizontal" \| "inline"` | Field arrangement: vertical (stacked, default) · horizontal (label beside control rows) · inline (one compact row, e.g. an email + button signup). |
| `gap` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Spacing between fields. Reach for `sm` on a dense settings form, `lg` on a roomy onboarding step. |
| `width` | `string \| number` | Explicit form width (e.g. "28rem" for a centered auth card, "100%" to fill). Omit for natural width. |
| `disabled` | `boolean` | Disable EVERY field in the form at once via a native &lt;fieldset disabled> (default false). Use to lock the whole form while a submit is in flight, pairs with the `commit` event for the pending state; no per-field wiring needed. |

## Events

### commit

The form was submitted (native submit intercepted, no page reload); params carry { fields } (every named field's value, collected via FormData).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
