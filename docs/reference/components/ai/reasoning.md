# Reasoning

A collapsible, muted "thinking" trace for an agent's private reasoning. Header shows a sparkles icon + "Thought for {duration}"; click to reveal the reasoning text. Place above the agent's final answer. Bind `open` with `{ $bindState }` so the agent (or a sibling control) can read whether the reasoning trace is expanded from spec.state.

## Example

```json
{
  "root": "reasoning",
  "elements": {
    "reasoning": {
      "type": "Reasoning",
      "props": {
        "content": "The user wants Q3 revenue. I should query the sales table, group by month, then sum.",
        "duration": "4s"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `content` | `string` | The model's thinking / chain-of-thought text, shown in the collapsed body (rendered as plain escaped text, never markup). |
| `duration` | `string` | Human-readable time spent thinking, shown in the header (e.g. "4s", "1m 12s"). Renders "Thought for {duration}" when set, otherwise just "Thought process". |
| `headerLabel` | `string` | Localised header text overriding the built-in English. Use the literal `{duration}` placeholder to position the duration (substituted with `duration`, or empty when none), e.g. "Réfléchi pendant {duration}". Unset → the default "Thought for {duration}" / "Thought process". Escaped text. |
| `defaultOpen` | `boolean` | Start expanded (default collapsed, reasoning is hidden behind a disclosure to keep the transcript tidy). |
| `open` | `boolean` | Whether the reasoning trace is expanded; mirrored back into spec.state when the user toggles it. Bind with { $bindState } so an external element can read whether the trace is open. Use defaultOpen for the one-time initial state. |
| `mutedColor` | `string` | Secondary/muted text colour, the header label, the sparkles header icon, the expand chevron, and the reasoning body trace (default the muted-foreground token). |
