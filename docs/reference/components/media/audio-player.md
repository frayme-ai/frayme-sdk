# AudioPlayer

A native HTML5 audio player in a compact card (title + browser controls). An invalid/absent `src` shows a muted "No audio" state. `accent` tints the card edge.

## Example

```json
{
  "root": "audio-player",
  "elements": {
    "audio-player": {
      "type": "AudioPlayer",
      "props": {
        "src": "https://example.com/track.mp3",
        "title": "Episode 12 — Shipping MCP Apps"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `src` | `string` | Audio URL (http/https). Scheme-checked; unsafe schemes are rejected → "No audio" state. |
| `title` | `string` | Track title shown above the controls (e.g. "Episode 12 — Shipping MCP Apps"). Omit for no title line; tints with `accent`. |
| `controls` | `boolean` | Show the browser’s native play/scrub/volume controls (default true). Turn off only when a surrounding UI drives playback; there is never a custom JS control bar. |
| `loop` | `boolean` | Restart the track automatically from the start when it ends (default false). Reach for it on looping ambience or a short sample; leave off for a normal listen-once track. |
| `accent` | `string` | Accent color of the surrounding card — tints the left card edge (default the border token, i.e. a neutral edge until set) and the title text (default the foreground token). |
| `borderColor` | `string` | Card border colour (default the border token). Part of the media-family border group (VideoPlayer/Figure/Thumbnail/YouTube); set a brand value to match a surrounding surface. |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Border line style of the card: solid (default) · dashed · dotted. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding of the media frame: none · sm · md (default) · lg · full. |
| `radiusValue` | `string \| number` | Exact corner radius of the media frame (e.g. "12px" / "0.75rem"; 0–64px). Overrides the `radius` enum, which is the default. |
| `width` | `string \| number` | Width of the media block (e.g. "480px", "100%"; default fills the container). Applied as a fixed width, not a max-width — a value wider than the parent column will overflow rather than shrink. |
| `opacity` | `"25" \| "50" \| "75" \| "90" \| "full"` | Dim the audio card for a preview/inactive look: full (default) · 90 · 75 · 50 · 25. |
