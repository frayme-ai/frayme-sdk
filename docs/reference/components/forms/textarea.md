# Textarea

Multi-line text input. Use { $bindState } on value for binding. Use checks for validation. validateOn controls timing (default: blur).

## Example

```json
{
  "root": "textarea",
  "elements": {
    "textarea": {
      "type": "Textarea",
      "props": {
        "label": "Description",
        "name": "description",
        "placeholder": "Add any additional context…",
        "rows": 4,
        "value": null,
        "checks": null,
        "validateOn": null,
        "maxLength": null,
        "showCount": null,
        "resize": null,
        "autosize": null,
        "radius": null,
        "radiusValue": null,
        "borderColor": null,
        "bg": null,
        "mutedColor": null,
        "minHeight": null,
        "maxHeight": null,
        "emitOnChange": null,
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
| `label` | `string` | The field label shown above (or visually hidden via `labelPlacement:hidden`, still read by screen readers). Keep to 1-3 words ("Description", "Notes"). |
| `name` | `string` | The form field name — the key this value is collected under in a Form's `commit` `fields` payload, and used to derive the field's DOM id. |
| `placeholder` | `string` | Faint hint text shown inside the empty box (e.g. "Add any additional context…"). Not a substitute for `label`. |
| `rows` | `number` | Visible line count that sets the box's starting height (default 4). Ignored for growth once `autosize` is on — use `maxHeight` to cap it instead. |
| `value` | `string` | Current text value. Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial value. |
| `checks` | `({ type: string, message: string, args: Record&lt;string, any> })[]` | Client-side validation rules as [{type, message, args?}], e.g. [{"type":"required","message":"Required"},{"type":"minLength","message":"Too short","args":{"min":3}}]. `type` names the rule (required · minLength · maxLength · pattern · email · …), `message` is the shown error, `args` carries the rule's parameters. Evaluated per `validateOn` timing. |
| `validateOn` | `"change" \| "blur" \| "submit"` | When `checks` run: change (live) · blur (default — on leaving the field) · submit (only when an enclosing Form commits). |
| `maxLength` | `number` | Maximum character length, enforced natively via the `maxlength` attribute (no default — unlimited). Pair with `showCount` to surface the limit as `n/max`. |
| `showCount` | `boolean` | Render a character counter next to the label (default false): `n/maxLength` when `maxLength` is set, otherwise a plain `n` count. |
| `resize` | `"none" \| "vertical" \| "horizontal" \| "both"` | Which drag handle the user gets to resize the box: none · vertical (default) · horizontal · both. Set `none` to lock the height in a fixed layout, or when `autosize` already grows the box. |
| `autosize` | `boolean` | Grow the box with its content (CSS field-sizing) instead of the fixed `rows` height; pair with `maxHeight` to cap the growth (default off = fixed rows). |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding of the textarea box — none · sm · md · lg · full (default md); `radiusValue` overrides with an exact length. |
| `radiusValue` | `string \| number` | Exact corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default. |
| `borderColor` | `string` | Resting border colour of the textarea box (default the border token). Set it to tint the field edge — pairs with `bg` to brand the control on a coloured surface. |
| `bg` | `string` | Background colour of the textarea box (default the card token). Pair with a legible text colour on a dark/tinted surface so authored text and the placeholder stay readable. |
| `mutedColor` | `string` | Secondary/muted text colour — help text, character counter, and the ::placeholder text (default the muted-foreground token). |
| `minHeight` | `string \| number` | Minimum box height, floor for growth (e.g. "6rem"). Set it to reserve room for a few lines even when empty; most useful alongside `autosize` so the box never collapses below it. |
| `maxHeight` | `string \| number` | Maximum box height that caps growth (e.g. "20rem"); past it the textarea scrolls internally. Pair with `autosize` to let the box grow to a point and then stop. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |
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

### commit

The user finished authoring — focus left the box, or Ctrl/Cmd+Enter was pressed (not IME-composition/key-repeat); params carry {value, name} — the full authored text and the field name.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### change

The text changed on every keystroke/edit; params carry {value, name} — the live current value and the field name. Only fires when `emitOnChange` !== false; the bound `value` state stays live regardless.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
