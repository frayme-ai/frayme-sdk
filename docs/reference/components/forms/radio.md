# Radio

Mutually-exclusive single-choice group bound to a string `value` from a fixed `options` list. Use over Select when the option count is small enough (2-5) to show all choices at once without a dropdown; use over ToggleGroup when the choice is a form field value rather than a UI-state selector. Use checks for validation; validateOn controls timing (default: change). Bind `value` with { $bindState } so the agent (or a sibling control) can read the currently-selected option from spec.state.

## Example

```json
{
  "root": "radio",
  "elements": {
    "radio": {
      "type": "Radio",
      "props": {
        "label": "Shipping speed",
        "name": "shipping",
        "options": [
          "Standard",
          "Express",
          "Overnight"
        ],
        "value": "Standard",
        "checks": null,
        "validateOn": null,
        "orientation": null,
        "gap": null,
        "gapValue": null,
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
| `label` | `string` | The group legend shown above the options (or visually hidden via `labelPlacement:hidden`). Keep to 1-3 words ("Shipping speed"). |
| `name` | `string` | The shared form field name for the whole group — the key this value is collected under in a Form's `commit` `fields` payload, and the native `name` grouping the radio inputs. |
| `options` | `string[] \| object[]` | The selectable options, in display order. Either a plain string array (e.g. ["Standard","Express","Overnight"] — each string is both the shown label and the value emitted on `change`) OR an array of {value,label} pairs (e.g. [{value:"std",label:"Standard"}]) when the stored value must differ from the shown text — the same union Select accepts. Do not mix the two forms in one array. |
| `value` | `string` | Current selected option (must match one of `options`). Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial selection (default none selected). |
| `checks` | `({ type: string, message: string, args: Record&lt;string, any> })[]` | Client-side validation rules as [{type, message, args?}], e.g. [{"type":"required","message":"Required"},{"type":"minLength","message":"Too short","args":{"min":3}}]. `type` names the rule (required · minLength · maxLength · pattern · email · …), `message` is the shown error, `args` carries the rule's parameters. Evaluated per `validateOn` timing. |
| `validateOn` | `"change" \| "blur" \| "submit"` | When `checks` run: change (live) · blur (default — on leaving the field) · submit (only when an enclosing Form commits). |
| `orientation` | `"horizontal" \| "vertical"` | Stack the options vertically (default) or in a row. |
| `gap` | `"sm" \| "md" \| "lg"` | Coarse spacing between options (sm·md·lg; default sm). For an exact value use `gapValue`. |
| `gapValue` | `string \| number` | Exact spacing between options (e.g. "1rem") when the `gap` enum is too coarse. |
| `mutedColor` | `string` | Secondary/muted text colour — help text under the group (default the muted-foreground token). |
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

A different option was picked; params carry {value, name}.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
