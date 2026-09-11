# YouTube

A lightweight YouTube card: the video thumbnail with a play-button overlay that LINKS OUT to youtube.com in a new tab, plus an optional `duration` corner badge. NO iframe is embedded — sandbox-safe, no third-party cookies, zero CSP frame-src. Provide `videoId` or a `url` to parse; an invalid id renders a muted placeholder.

## Example

```json
{
  "root": "you-tube",
  "elements": {
    "you-tube": {
      "type": "YouTube",
      "props": {
        "videoId": "dQw4w9WgXcQ",
        "title": "Never Gonna Give You Up",
        "thumbnailQuality": "hq",
        "duration": "3:33"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `videoId` | `string` | The 11-character YouTube video id (e.g. "dQw4w9WgXcQ"). Takes precedence over `url`; validated to [A-Za-z0-9_-]{11} before any URL is built. |
| `url` | `string` | A full YouTube URL (watch?v=… · youtu.be/… · /embed/… · /shorts/…) to parse the id from when `videoId` is absent. |
| `title` | `string` | Title shown under the thumbnail (escaped text; default empty). Set the real video title so the card reads clearly and the link is labelled; hide the line entirely with `showTitle: false`. |
| `duration` | `string` | Optional runtime badge shown bottom-right over the thumbnail (e.g. "12:34", "1:02:00"). Pre-formatted escaped text — Frayme never fetches it. Omit for no badge. |
| `thumbnailQuality` | `"default" \| "mq" \| "hq" \| "sd" \| "maxres"` | Thumbnail resolution: default (120p) · mq (320p) · hq (480p, default) · sd (640p) · maxres (1280p — may 404 for older videos). |
| `aspect` | `"auto" \| "1/1" \| "4/3" \| "3/2" \| "16/9" \| "21/9" \| "3/4"` | Aspect ratio of the thumbnail frame: 16/9 (default) · 4/3 · 3/2 · 1/1 · 21/9 · 3/4 · auto. |
| `showTitle` | `boolean` | Show the title line under the thumbnail (default true). |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding of the media frame: none · sm · md (default) · lg · full. |
| `radiusValue` | `string \| number` | Exact corner radius of the media frame (e.g. "12px" / "0.75rem"; 0–64px). Overrides the `radius` enum, which is the default. |
| `width` | `string \| number` | Width of the media block (e.g. "480px", "100%"; default fills the container). Applied as a fixed width, not a max-width — a value wider than the parent column will overflow rather than shrink. |
| `borderColor` | `string` | Thumbnail-frame border colour (default the border token). |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Border line style of the thumbnail frame: solid (default) · dashed · dotted. |
| `color` | `string` | Primary text colour of the title line under the thumbnail (default the foreground token). Also labels the invalid-id placeholder card. |
| `opacity` | `"25" \| "50" \| "75" \| "90" \| "full"` | Dim the card for a preview/inactive look: full (default) · 90 · 75 · 50 · 25. |
