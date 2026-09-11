# Switch

Boolean on/off toggle bound to `checked`, applying immediately (no separate save step implied). Use over Checkbox for a setting that takes effect right away (notifications, dark mode) rather than a form-submit choice; the visual reads as a physical switch, not a form checkbox. Use checks for validation; validateOn controls timing (default: change). Bind `checked` with { $bindState } so the agent (or a sibling control) can read the current on/off boolean from spec.state.

## Example

```json
{
  "root": "switch",
  "elements": {
    "switch": {
      "type": "Switch",
      "props": {
        "label": "Dark mode",
        "name": "darkMode",
        "checked": true,
        "checks": null,
        "validateOn": null,
        "offColor": null,
        "description": null,
        "onLabel": null,
        "offLabel": null,
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
| `label` | `string` | The text beside the switch track. Keep to a short phrase ("Email notifications") — for extra context add `description` underneath. |
| `name` | `string` | The form field name — the key this value is collected under in a Form's `commit` `fields` payload, and used to derive the field's DOM id. |
| `checked` | `boolean` | Whether the switch is ON. Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial state (default false = off). |
| `checks` | `({ type: string, message: string, args: Record&lt;string, any> })[]` | Client-side validation rules as [{type, message, args?}], e.g. [{"type":"required","message":"Required"},{"type":"minLength","message":"Too short","args":{"min":3}}]. `type` names the rule (required · minLength · maxLength · pattern · email · …), `message` is the shown error, `args` carries the rule's parameters. Evaluated per `validateOn` timing. |
| `validateOn` | `"change" \| "blur" \| "submit"` | When `checks` run: change (live) · blur (default — on leaving the field) · submit (only when an enclosing Form commits). |
| `offColor` | `string` | Track colour when the switch is OFF (default the border token); the ON track uses `accent`. Set it for a stronger off/on contrast or to match a branded surface. |
| `description` | `string` | Secondary muted line under the label for extra context (e.g. what the setting affects). Omit when the `label` alone is self-explanatory. |
| `onLabel` | `string` | Optional text beside the track when ON (e.g. "On"). |
| `offLabel` | `string` | Optional text beside the track when OFF (e.g. "Off"). |
| `mutedColor` | `string` | Secondary/muted text colour — the description line, on/off side label + help text (default the muted-foreground token). |
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

The switch was toggled on or off; params carry {checked, name}.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
