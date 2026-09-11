# Checkbox

Single checkbox bound to a boolean `checked`. Use for an independent on/off choice (agree to terms, opt-in) or one item in a manually-composed multi-select group; use Switch instead for an immediate-effect setting toggle, and Radio for mutually-exclusive single-choice options. Use checks for validation; validateOn controls timing (default: change). Bind `checked` with { $bindState } so the agent (or a sibling control) can read the current ticked/unticked boolean from spec.state.

## Example

```json
{
  "root": "checkbox",
  "elements": {
    "checkbox": {
      "type": "Checkbox",
      "props": {
        "label": "I agree to the terms",
        "name": "terms",
        "checked": false,
        "checks": null,
        "validateOn": null,
        "indeterminate": null,
        "description": null,
        "mutedColor": null,
        "disabled": null,
        "readonly": null,
        "required": null,
        "helpText": null,
        "errorText": null,
        "size": null,
        "labelPlacement": null,
        "labelColor": null,
        "accent": null,
        "width": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | The text beside the checkbox. Keep to a short phrase ("I agree to the terms") — for a longer explanation use `description` underneath. |
| `name` | `string` | The form field name — the key this value is collected under in a Form's `commit` `fields` payload, and used to derive the field's DOM id. |
| `checked` | `boolean` | Whether the box is ticked. Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial state (default false). |
| `checks` | `({ type: string, message: string, args: Record&lt;string, any> })[]` | Client-side validation rules as [{type, message, args?}], e.g. [{"type":"required","message":"Required"},{"type":"minLength","message":"Too short","args":{"min":3}}]. `type` names the rule (required · minLength · maxLength · pattern · email · …), `message` is the shown error, `args` carries the rule's parameters. Evaluated per `validateOn` timing. |
| `validateOn` | `"change" \| "blur" \| "submit"` | When `checks` run: change (live) · blur (default — on leaving the field) · submit (only when an enclosing Form commits). |
| `indeterminate` | `boolean` | Show the dash/tri-state visual (a "some but not all children selected" parent-of-group look) instead of a tick, regardless of `checked` (default false). Purely visual — set/read via the ordinary `checked` state. |
| `description` | `string` | Secondary muted line under the label for extra context (e.g. a terms summary). Omit when the `label` alone is self-explanatory. |
| `mutedColor` | `string` | Secondary/muted text colour — the description line + help text (default the muted-foreground token). |
| `disabled` | `boolean` | Grey out + block input (adds `disabled`/`aria-disabled`). |
| `readonly` | `boolean` | Value is visible but not editable (`readOnly`; Select/Switch/Slider become non-interactive). |
| `required` | `boolean` | Mark the field required (`required` attr + a required marker on the label). |
| `helpText` | `string` | Muted hint line under the control — formatting guidance or context (hidden while `errorText` is set). |
| `errorText` | `string` | Error message under the field — the danger help line + `aria-invalid` on the control; the text-box controls (Input/Textarea/Select) also get a danger control border (overrides helpText when set). |
| `size` | `"sm" \| "md" \| "lg"` | Control height, font-size, and padding together (default `md`); use `sm` in dense forms and filter rows, `lg` for touch targets or roomy layouts. |
| `labelPlacement` | `"top" \| "hidden"` | Label position: top (default) · hidden (visually removed but kept for a11y via sr-only). |
| `labelColor` | `string` | Text colour of the field label/legend line above or beside the control (default the foreground token — inherits). Help text stays `mutedColor`; the error line stays the danger token. |
| `accent` | `string` | Brand color lever: focus ring + checked/active fill (default primary token). |
| `width` | `string \| number` | Field width (e.g. "12rem" or "100%"; default 100%). For Checkbox/Radio/Switch (default auto) it constrains the whole field incl. label wrap. |

## Events

### change

The box was ticked or unticked; params carry {checked, name}.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
