# FieldError

Inline validation error. Renders a small danger-toned line with a leading alert-circle icon and role="alert". Tone is fixed critical — there is no tone prop.

## Example

```json
{
  "root": "field-error",
  "elements": {
    "field-error": {
      "type": "FieldError",
      "props": {
        "message": "Please enter a valid email address."
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `message` | `string` | The validation error text shown beside the alert icon. Keep it one short sentence, specific to what failed (e.g. "Please enter a valid email address."). |
| `size` | `"sm" \| "md"` | Font size of the error line (default sm — it sits under a control); the leading alert icon scales with it (14px sm · 16px md). |
