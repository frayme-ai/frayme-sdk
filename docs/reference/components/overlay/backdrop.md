# Backdrop

A dimming scrim layered over its children, toggled by `active`, the generic underlay for a modal/drawer/loading state (no spinner of its own; pair `label` with a caption like "Saving…"). Prefer this over baking a translucent overlay into a specific component, since it composes with any children and centralizes the scrim/blur/zone behavior. Purely visual, it does not trap focus or block interaction itself.

## Example

```json
{
  "root": "backdrop",
  "elements": {
    "backdrop": {
      "type": "Backdrop",
      "props": {
        "active": true,
        "label": "Saving…"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `active` | `boolean` | When true, the scrim covers the children (the generic dimmer; use instead of the reserved `visible`). |
| `blur` | `"none" \| "sm" \| "md" \| "lg"` | Backdrop blur strength behind the scrim (default sm). |
| `overlayColor` | `string` | Scrim tint color (default neutral black). Composes with `opacity`, the tint is mixed to that translucency, so it never paints fully opaque on its own. |
| `opacity` | `"light" \| "medium" \| "heavy"` | How opaque the scrim is: light (25%) · medium (45%, default) · heavy (65%). Also applies to a custom `overlayColor` (the tint is mixed at this level). |
| `label` | `string` | Optional centered caption shown over the scrim while active. |
| `zone` | `"fill" \| "inset" \| "rounded"` | Scrim coverage: fill the wrapper (default) · inset (padded) · rounded (matches a rounded card). |
