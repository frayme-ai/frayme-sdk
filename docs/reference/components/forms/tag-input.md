# TagInput

Free-form chip/tag entry. Existing tags render as removable chips followed by a bare input; Enter or comma adds the trimmed tag (respecting max), Backspace on an empty input removes the last. Use { $bindState } on value for two-way binding; every add/remove emits change.

## Example

```json
{
  "root": "tag-input",
  "elements": {
    "tag-input": {
      "type": "TagInput",
      "props": {
        "placeholder": "Add a tag…",
        "value": [
          "design",
          "ai"
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `string[]` | The current tags. Use { $bindState } for two-way binding; adding/removing rewrites this array. |
| `suggestions` | `string[]` | Optional autocomplete hints surfaced via a native datalist as the user types. |
| `max` | `number` | Cap on the number of tags; input is blocked once reached. |
| `placeholder` | `string` | Hint shown in the bare input when no tags are present (default none); keep it a short prompt, e.g. "Add a tag…", cueing the user to type-then-Enter. |
| `size` | `"sm" \| "md" \| "lg"` | Field height/font-size/padding token (default `md`); use `sm` in dense forms, `lg` for touch or roomy layouts. |
| `disabled` | `boolean` | Grey out the field (60% opacity, not-allowed cursor) and block adding or removing tags (default false). |
| `removable` | `boolean` | Show an × on each chip to remove it (default true). |
| `lockedTags` | `string[]` | Tags the end user cannot remove: chips matching these strings render without the × and Backspace skips them — system-applied labels ("KYC-verified", "auto-tagged") stay while the user adds their own. UI-level enforcement only — the host still validates. |
| `accent` | `string` | Focus-within ring colour (default the primary token); it also supplies the background tint of the tag chips together with those chips' text colour, and — with no `borderColor` — tints the resting field border (an explicit `borderColor` wins). Unset chips render a neutral muted fill instead. |
| `borderColor` | `string` | Resting border color of the field (default border token). Wins over `accent` on the resting border when both are set. |
| `bg` | `string` | Field background colour behind the chips and input (default the card token; bindable safeColor). Set on tinted surfaces to blend the field into the surrounding card. |
| `mutedColor` | `string` | Secondary/muted text colour — the bare input placeholder (default the muted-foreground token). |
| `radiusValue` | `string \| number` | Exact corner radius of the field surface (e.g. "12px" or "0.75rem"; default the frayme radius). Overrides the default rounding. |

## Events

### change

A tag was added (Enter/comma) or removed (chip × or Backspace); params carry { value, toggled, checked }.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
