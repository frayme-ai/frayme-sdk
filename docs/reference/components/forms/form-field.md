# FormField

Field group: a label + the wrapped control (children) + a help/error line. Use to give any bare control a consistent label, helper text, and error slot. Error text wins over help text.

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "form-field",
  "elements": {
    "form-field": {
      "type": "FormField",
      "props": {
        "label": "Email",
        "helpText": "We never share your email."
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | The field label text shown above/beside the control. |
| `helpText` | `string` | Muted hint under the control (e.g. "We never share your email"). |
| `errorText` | `string` | Validation error under the control; overrides helpText styling (danger-toned) when set. |
| `required` | `boolean` | Mark this field REQUIRED: shows the `*` on the label AND makes the wrapped control genuinely mandatory, a named-action submit inside the Form is blocked with native browser validation until it is filled. The control's own `required` prop overrides. Never a decorative asterisk. |
| `labelPlacement` | `"top" \| "left" \| "hidden"` | Label position: top (default) · left (label beside the control) · hidden (kept for screen readers via sr-only). |
| `size` | `"sm" \| "md" \| "lg"` | Label + help/error font size, matching the wrapped control density (default md). |
| `mutedColor` | `string` | Secondary/muted text colour, the help hint line under the control (default the muted-foreground token). Error text stays danger-toned. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the field-group label (default medium); set to dial the caption emphasis up or down. |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the field-group label (default normal); reach for `wide`/`wider` on an uppercase caption. |
