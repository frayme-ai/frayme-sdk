# LoadingOverlay

A loading scrim that dims a region (its children) and centers a spinner + optional label while `active`. The region always renders; when `active` the scrim sits on top (role=status, aria-busy). Wrap a card/panel/table whose content is loading. `active` is reactive out of the box (toggles locally when unbound, syncs when bound).

Accepts child elements via `children` (the `default` slot).

## Example

```json
{
  "root": "loading-overlay",
  "elements": {
    "loading-overlay": {
      "type": "LoadingOverlay",
      "props": {
        "active": true,
        "label": "Loading…"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `active` | `boolean` | Whether the loading scrim + spinner are shown over the region (default true). Bind this to a loading flag, or toggle it locally. (Named `active`, not `visible` — `visible` is a reserved json-render element field.) |
| `label` | `string` | Optional status text shown under the spinner (e.g. "Saving…"). |
| `blur` | `boolean` | Blur the covered region behind the scrim while loading. |
| `spinnerSize` | `"sm" \| "md" \| "lg"` | Spinner diameter + border thickness: sm (20px, 2px border) · md (32px, 2px border, default) · lg (48px, 3px border). |
| `overlayColor` | `string` | Background colour of the dimming scrim painted over the covered region while `active` — it is the ground the spinner and `label` sit on (default a 60% translucent background-token wash). |
| `color` | `string` | Text colour of the status label under the spinner, and the colour of the spinner's leading arc — one role, recoloured together (spinner arc defaults to the primary token, label to the foreground token). |
