# VideoPlayer

A native HTML5 video player (browser controls only — no custom UI, no capture). Aspect-locked frame; an invalid/absent `src` shows a muted placeholder. `autoplay` forces muted+inline.

## Example

```json
{
  "root": "video-player",
  "elements": {
    "video-player": {
      "type": "VideoPlayer",
      "props": {
        "src": "https://example.com/demo.mp4",
        "aspect": "16/9",
        "controls": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `src` | `string` | Video URL (http/https). Scheme-checked; javascript:/data:text/html are rejected → placeholder. |
| `poster` | `string` | Still-image shown before playback (raster image src; svg+xml/blob rejected). |
| `controls` | `boolean` | Show the browser’s native playback controls (default true). Never custom JS controls. |
| `autoplay` | `boolean` | Begin playback on load (default false). Forces muted + inline playback per browser policy. |
| `loop` | `boolean` | Restart the clip automatically from the beginning when it ends (default false). Reach for it on short ambient/background loops; leave off for normal watch-once playback. |
| `muted` | `boolean` | Start playback muted with volume at zero (default false). Forced on when `autoplay` is set, per browser policy; set it explicitly for a silent hero video the viewer un-mutes. |
| `aspect` | `"auto" \| "1/1" \| "4/3" \| "3/2" \| "16/9" \| "21/9" \| "3/4"` | Aspect ratio of the frame: 16/9 (default, widescreen) · 4/3 · 3/2 · 1/1 (square) · 21/9 (cinematic) · 3/4 (portrait) · auto. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding of the media frame: none · sm · md (default) · lg · full. |
| `radiusValue` | `string \| number` | Exact corner radius of the media frame (e.g. "12px" / "0.75rem"; 0–64px). Overrides the `radius` enum, which is the default. |
| `width` | `string \| number` | Width of the media block (e.g. "480px", "100%"; default fills the container). Applied as a fixed width, not a max-width — a value wider than the parent column will overflow rather than shrink. |
| `caption` | `string` | Muted caption line below the player frame (e.g. "Product demo — 90s"). Omit for no caption; rendered only when non-empty. |
| `mutedColor` | `string` | Secondary/muted text colour — the caption below the player (default the muted-foreground token). |
| `borderColor` | `string` | Frame border colour of the video box (default the border token). Part of the media-family border group (AudioPlayer/Figure/Thumbnail/YouTube). |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Border line style of the video frame: solid (default) · dashed · dotted. |
| `opacity` | `"25" \| "50" \| "75" \| "90" \| "full"` | Dim the player frame for a preview/inactive look: full (default) · 90 · 75 · 50 · 25. |
