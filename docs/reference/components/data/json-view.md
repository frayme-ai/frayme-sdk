# JsonView

A read-only, collapsible JSON tree. `data` is any JSON value; objects/arrays are expandable nodes, primitives are colored escaped tokens. Recursion is hard-capped so a deep/cyclic-looking object cannot crash the render.

## Example

```json
{
  "root": "json-view",
  "elements": {
    "json-view": {
      "type": "JsonView",
      "props": {
        "data": {
          "user": {
            "name": "Ada",
            "roles": [
              "admin",
              "editor"
            ],
            "active": true
          },
          "count": 3
        },
        "defaultExpandedDepth": 2,
        "showCount": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `data` | `any` | Any JSON value (object / array / primitive). Rendered as an escaped, collapsible tree, never as markup. |
| `defaultExpandedDepth` | `number` | Tree depth expanded on first render (default 1). Deeper branches start collapsed. |
| `maxDepth` | `number` | Hard cap on rendered depth (default 8, hard-capped internally); nodes past it show "…". |
| `accent` | `string` | Color for object/array KEYS (default the primary token). |
| `mutedColor` | `string` | Secondary/muted text colour, the expand/collapse chevrons, tree punctuation, braces, child-count badges, and null/undefined tokens (default the muted-foreground token). |
| `showCount` | `boolean` | Show child-count badges on collapsed objects/arrays (e.g. "{ 4 }"). |
| `copyable` | `boolean` | Show a small copy button in the top-right that copies the pretty-printed root value to the clipboard (default false; opt-in to avoid chrome by default). |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | Overall font scale of the whole JSON tree (sm · md default · lg). Use `sm` for a dense inspector panel; overridden by the exact `fontSize` channel when set. |
| `fontSize` | `string \| number` | Exact tree font-size (e.g. 13px / 0.9rem). Overrides the `size` enum, which is the default. |
