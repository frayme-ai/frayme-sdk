# Message

A single chat row: avatar + author/timestamp + a role-styled bubble. `role` picks the layout, user bubbles align right in the accent color, assistant render as a left card, system/tool as a muted note. Place inside a Conversation.

## Example

```json
{
  "root": "message",
  "elements": {
    "message": {
      "type": "Message",
      "props": {
        "role": "assistant",
        "author": "Frayme",
        "content": "Sure, here is a draft of the pricing page."
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `content` | `string` | The message body text (rendered as escaped text, newlines preserved). |
| `role` | `"user" \| "assistant" \| "system" \| "tool"` | Who sent it: user (right-aligned accent bubble) · assistant (left card, default) · system / tool (muted, full-width note). |
| `author` | `string` | Display name shown above the bubble (also seeds the avatar initials when no avatar image). |
| `timestamp` | `string` | Pre-formatted time string shown next to the author (e.g. "2:14 PM"). Display only, not parsed. |
| `avatar` | `string` | Avatar image URL. When absent, initials are derived from `author`. http(s) or raster data: only. |
| `streaming` | `boolean` | Show a blinking caret after the content to signal the message is still being generated. |
| `accent` | `string` | Bubble fill + avatar fill for the user role / accent for the author label (default primary token). Wins over the role default; the assistant avatar deliberately stays the muted token. |
| `accentText` | `string` | Text colour ON the bubble fill, the user bubble always (default the on-primary token); assistant/system/tool bubbles when set (pair with a custom `bg` or `accent` so a dark repaint keeps legible text; their defaults are the card-/muted-foreground tokens). |
| `bg` | `string` | Exact background fill of the bubble/card (default per role). Wins over the role default. |
| `mutedColor` | `string` | Secondary/muted text colour, the author meta row + timestamp (default the muted-foreground token). |
| `showAvatar` | `boolean` | Show the leading avatar bubble on user/assistant rows (default true). The bubble is auto-hidden anyway when there is neither an avatar image nor derivable author initials (an empty circle reads as a broken image); set false to force it off even when initials exist. |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Typeface for the whole message row; cascades to descendants via font inheritance (sans · serif · mono · rounded · display). Omit to inherit the theme font. |
| `weight` | `"light" \| "normal" \| "medium" \| "semibold" \| "bold"` | Font weight of the message body text (light · normal · medium · semibold · bold; default normal). |
| `tracking` | `"tighter" \| "tight" \| "normal" \| "wide" \| "wider"` | Letter-spacing of the message body text (tighter · tight · normal · wide · wider; default normal). |
| `leading` | `"tight" \| "snug" \| "normal" \| "relaxed" \| "loose"` | Line-height of the message body text (tight · snug · normal · relaxed · loose; default relaxed). |
| `fontSize` | `string \| number` | Exact font size of the message body text (e.g. "16px" / "1rem"). Default 0.875rem (0.8125rem for the system/tool roles). |
