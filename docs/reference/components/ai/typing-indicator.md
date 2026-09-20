# TypingIndicator

An "agent is typing" placeholder: three animated bouncing dots with an optional leading label. Show while waiting for the agent's next message. Reach for this when the assistant has not started streaming yet and you want a low-key liveness cue, as opposed to the Shimmer placeholder that mocks up the shape of arriving text. Drop it in the Conversation where the next Message will land and swap it out once the real content begins; add a `label` (e.g. "Assistant is thinking") for context, or leave it as just the dots.

## Example

```json
{
  "root": "typing-indicator",
  "elements": {
    "typing-indicator": {
      "type": "TypingIndicator",
      "props": {
        "label": "Assistant is typing"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | Optional text shown before the dots (e.g. "Assistant is thinking"). Omit for just the three dots. |
| `mutedColor` | `string` | Secondary/muted colour, the label shown before the dots AND the three bouncing dots themselves (default the muted-foreground token). |
