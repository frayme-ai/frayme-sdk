# Fab

A floating action button anchored to a corner of its own frame, with an optional speed-dial that fans actions out when opened. Each action emits `commit`. Positioned absolutely within the renderer’s frame (never fixed to the viewport). Bind `activeAction` with `{ $bindState }` so the agent (or a sibling control) can read which speed-dial action was triggered (its label or index) from spec.state.

## Example

```json
{
  "root": "fab",
  "elements": {
    "fab": {
      "type": "Fab",
      "props": {
        "icon": "plus",
        "label": "Create",
        "actions": [
          {
            "label": "New doc",
            "icon": "edit"
          },
          {
            "label": "Upload",
            "icon": "upload"
          },
          {
            "label": "Invite",
            "icon": "users",
            "tone": "info"
          }
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `icon` | [`IconName`](../../icons.md) | The main button glyph, from the closed icon registry (or a single emoji glyph, rendered as-is) (default "plus"). Unknown/absent names fall back to plus. |
| `label` | `string` | Accessible label for the main button (default "Actions"). |
| `actions` | `({ label: string, icon: IconName, tone: "neutral" \| "success" \| "warning" \| "critical" \| "info" })[]` | Speed-dial actions that fan out when the FAB is opened; each is { label?, icon?, tone? } and emits `commit`. |
| `activeAction` | `string` | Write target for WHICH speed-dial action the user triggered: bind with { $bindState } and the renderer writes the triggered action label (or its index) here before emitting `commit`, so the host can attribute the action. Emit-only when unbound. |
| `position` | `"bottom-right" \| "bottom-left" \| "top-right" \| "top-left"` | Corner within the component’s own frame: bottom-right (default) · bottom-left · top-right · top-left. |
| `accent` | `string` | Main-button fill color (default the primary token). |
| `accentText` | `string` | Main-button glyph color, paired with `accent` (default the primary-foreground token). |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Line style of the surrounding frame: solid · dashed (default) · dotted. |
| `size` | `"md" \| "lg"` | Main-button diameter + glyph size: md (3rem button, default) · lg (3.5rem button, larger glyph). |
| `sizeValue` | `string \| number` | Exact main-button diameter — width + height (e.g. 56px / 3.5rem). Overrides the `size` enum, which is the default. Ignored (width becomes auto) when `extended`. |
| `extended` | `boolean` | Render Material’s extended FAB — a pill showing the `label` text beside the icon instead of a bare circle (default false). Requires a `label`; reuses the accent/accentText/shadow channels unchanged. |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow depth of the main button: none · sm · md · lg · xl (default the baked floating shadow). |

## Events

### commit

A speed-dial action chip was clicked (fires per-action, not on opening the dial); params carry { label, index }. If `actions` is empty, clicking the main button itself emits this with { label } instead of toggling the dial.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
