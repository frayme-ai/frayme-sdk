# Select

Native dropdown select bound to a single string `value` from a fixed `options` list (plain strings, or {value,label} pairs when the stored value differs from the shown text). Choose Select over DropdownMenu when the options are a flat list feeding a form field (native mobile picker, no custom item content); choose DropdownMenu when items need icons or the trigger should read as an action rather than a form field. Use checks for validation; validateOn controls timing (default: change). Bind `value` with { $bindState } so the agent (or a sibling control) can read the currently-selected option from spec.state.

## Example

```json
{
  "root": "select",
  "elements": {
    "select": {
      "type": "Select",
      "props": {
        "label": "Plan",
        "name": "plan",
        "options": [
          "Starter",
          "Pro",
          "Scale"
        ],
        "placeholder": "Select…",
        "value": null,
        "checks": null,
        "validateOn": null,
        "clearable": null,
        "radius": null,
        "radiusValue": null,
        "borderColor": null,
        "bg": null,
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
| `label` | `string` | The field label shown above (or visually hidden via `labelPlacement:hidden`, still read by screen readers). Keep to 1-3 words ("Country", "Plan"). |
| `name` | `string` | The form field name, the key this value is collected under in a Form's `commit` `fields` payload, and used to derive the field's DOM id. |
| `options` | `string[] \| object[]` | The selectable options, in display order. Either a plain string array (e.g. ["Small","Medium","Large"], each string is both the label and the emitted value) OR an array of {value,label} pairs (e.g. [{value:"sm",label:"Small"}]) when the stored value must differ from the shown text. Do not mix the two forms in one array. |
| `placeholder` | `string` | Text shown as the first, unselected option (default "Select…"). Disabled unless `clearable` is on, so the user can't re-select the empty state. |
| `value` | `string` | Current selected option (must match one of `options`). Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial selection. |
| `checks` | `({ type: string, message: string, args: Record&lt;string, any> })[]` | Client-side validation rules as [{type, message, args?}], e.g. [{"type":"required","message":"Required"},{"type":"minLength","message":"Too short","args":{"min":3}}]. `type` names the rule (required · minLength · maxLength · pattern · email · …), `message` is the shown error, `args` carries the rule's parameters. Evaluated per `validateOn` timing. |
| `validateOn` | `"change" \| "blur" \| "submit"` | When `checks` run: change (live) · blur (default, on leaving the field) · submit (only when an enclosing Form commits). |
| `clearable` | `boolean` | Keep the placeholder option selectable so the user can return to an empty selection (default false = the placeholder option is disabled once a real value is chosen). |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner-radius token for the select box: none · sm · md (default) · lg · full. Drop to `sm` on dense forms, `lg`/`full` for a softer look; use `radiusValue` for an exact length. |
| `radiusValue` | `string \| number` | Exact corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default. |
| `borderColor` | `string` | Resting border colour of the select box (default the border token). Set it to tint the field edge, pairs with `bg` to brand the control on a coloured surface. |
| `bg` | `string` | Background colour of the select box (default the card token). Pair with a legible text colour on a dark/tinted surface so the value and placeholder stay readable. |
| `mutedColor` | `string` | Secondary/muted text colour, help text under the field, and the unselected placeholder option text (default the muted-foreground token). |
| `disabled` | `boolean` | Grey out + block input (adds `disabled`/`aria-disabled`). |
| `readonly` | `boolean` | Value is visible but not editable (`readOnly`; Select/Switch/Slider become non-interactive). |
| `required` | `boolean` | Mark the field required (`required` attr + a required marker on the label). |
| `helpText` | `string` | Muted hint line under the control, formatting guidance or context (hidden while `errorText` is set). |
| `errorText` | `string` | Error message under the field, the danger help line + `aria-invalid` on the control; the text-box controls (Input/Textarea/Select) also get a danger control border (overrides helpText when set). |
| `size` | `"sm" \| "md" \| "lg"` | Control height, font-size, and padding together (default `md`); use `sm` in dense forms and filter rows, `lg` for touch targets or roomy layouts. |
| `labelPlacement` | `"top" \| "hidden"` | Label position: top (default) · hidden (visually removed but kept for a11y via sr-only). |
| `labelColor` | `string` | Text colour of the field label/legend line above or beside the control (default the foreground token, inherits). Help text stays `mutedColor`; the error line stays the danger token. |
| `accent` | `string` | Brand color lever: focus ring + checked/active fill. Defaults to the accent token, a neutral until a theme sets one. |
| `width` | `string \| number` | Field width (e.g. "12rem" or "100%"; default 100%). For Checkbox/Radio/Switch (default auto) it constrains the whole field incl. label wrap. |

## Events

### change

A different option was chosen from the native dropdown; params carry {value, name}.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
