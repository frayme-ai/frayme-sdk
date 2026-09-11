# DiffView

A line-based diff of two text blocks: added lines tinted green (+), removed lines tinted red (-), unchanged neutral. Renders ESCAPED text only (never markup). Use to show an edit/proposed change.

## Example

```json
{
  "root": "diff-view",
  "elements": {
    "diff-view": {
      "type": "DiffView",
      "props": {
        "filename": "config.ts",
        "before": "const timeout = 30;\nconst retries = 1;",
        "after": "const timeout = 60;\nconst retries = 3;"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `before` | `string` | The original text (lines removed/unchanged are computed against `after`). |
| `after` | `string` | The new text (lines added/unchanged are computed against `before`). |
| `filename` | `string` | File name / label shown in the diff header (e.g. "config.ts"; default none). When set it replaces the `headerLabel` fallback ("Changes"); set it to name the file the edit applies to. |
| `headerLabel` | `string` | Fallback header text when no `filename` is set (default "Changes"). Escaped text — set for localization. |
| `mode` | `"unified" \| "split"` | Layout: unified (one column with +/- gutters, default) · split (before \| after side-by-side). |
| `maxHeight` | `string \| number` | Exact max height of the diff body (e.g. 600px / 40vh); the body becomes a vertical scroll container. Omit for an unbounded diff (the default — matches Artifact's units/bounds). |
| `showLineNumbers` | `boolean` | Show a line-number gutter alongside each diff row (default off). Turn on for longer diffs where readers need to reference specific line positions. |
| `bg` | `string` | Background fill of the diff panel surface (default the card token). |
| `borderColor` | `string` | Border colour of the diff panel frame + its header divider (default the border token). |
| `borderWidthValue` | `string \| number` | Exact outer panel border thickness in px (e.g. "2px"; default 1px). |
| `mutedColor` | `string` | Secondary/muted text colour — the header edit glyph, the line-number gutter, and the unchanged-row gutter marks (default the muted-foreground token). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop-shadow elevation of the diff panel — none · sm · md · lg · xl; default flat. Set to lift the diff off the page as a raised surface. |
