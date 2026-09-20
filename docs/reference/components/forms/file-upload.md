# FileUpload

Click-to-upload zone: a dashed zone wrapping a native file picker (drag-drop is NOT handled, dropping a file onto the zone does nothing). On pick it READS the chosen files and emits `commit` once with { files:[{ name, size, type, lastModified, dataUrl }], count }, dataUrl holds a base64 data-URI for files at/under ~1MB and null above the cap; it never auto-uploads. It also renders a props/state-driven list of selected files (name, size, status, optional progress bar, and a remove ×) and emits `dismiss` when a row × is pressed. Drive the list via the `files` prop; bind on.commit to receive the picked files and on.dismiss to wire removal. Bind `selectedFiles` with `{ $bindState }` so the agent (or a sibling control) can read the live list of currently-picked files (name + size + status + progress) from spec.state.

## Example

```json
{
  "root": "file-upload",
  "elements": {
    "file-upload": {
      "type": "FileUpload",
      "props": {
        "label": "Drag & drop or click to upload",
        "accept": "image/*,.pdf",
        "maxSize": "10MB"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `accept` | `string` | Accepted file types (e.g. "image/*,.pdf"), shown as a hint AND set as the input `accept` attribute. Reach for it to constrain the picker. |
| `multiple` | `boolean` | Allow selecting more than one file (sets `multiple` on the input). |
| `maxSize` | `string` | Display-only size hint (e.g. "10MB"); rendered under the call-to-action. Not enforced, render-only. |
| `label` | `string` | The call-to-action line (default "Drag & drop or click to upload"). |
| `hint` | `string` | Secondary muted line under the label (e.g. "Up to 5 files"). |
| `icon` | `string` | Glyph name shown in the zone (default "upload"); unknown names render nothing. |
| `lockExisting` | `boolean` | Lock every file supplied via `files` (as if each carried locked:true): no remove × on prior uploads while new picks stay open, the evidence/document-packet shape ("submitted documents stay on file"). UI-level enforcement only, the host still validates. |
| `files` | `({ name: string, size: string, status: "uploading" \| "done" \| "error", progress: number })[]` | Initial file list to seed the component (e.g. already-uploaded files). The component OWNS the list from here: picked files are appended and the remove × deletes rows. Each row shows name, optional size, a status indicator, and an optional progress bar. |
| `selectedFiles` | `({ name: string, size: string, status: "uploading" \| "done" \| "error", progress: number })[]` | Bindable live list of the files the user has currently picked (name + size + status + progress). Mirrored back into (bindable) spec.state on every pick and every remove-× so an external Submit button can read the current file set, bind with { $bindState } for two-way. Distinct from `files` (one-way initial seed). |
| `size` | `"sm" \| "md" \| "lg"` | Dropzone height, padding, and font size together (default md). Reach for `sm` for a compact inline attach control and `lg` for a prominent full-width upload panel. |
| `disabled` | `boolean` | Grey out the zone (60% opacity, not-allowed cursor) and block opening the native file picker (default false). |
| `accent` | `string` | Hover / keyboard-focus border + ring color of the zone (default primary token). There is no drag-over highlight state. |
| `borderColor` | `string` | The resting dashed border color (default border token). |
| `borderStyle` | `"solid" \| "dashed" \| "dotted"` | Dropzone border line style, solid · dashed · dotted (default dashed). |
| `bg` | `string` | Fill color of the dropzone interior (default the muted token). Name a brand color to tint the zone; the dashed edge reads `borderColor`, not this. |
| `mutedColor` | `string` | Secondary/muted text colour, the hint line, the accept/size hint, the per-file size annotations, the zone upload icon (resting; hover keeps `accent`), the per-file-row leading icon, and the uploading spinner (default the muted-foreground token). |

## Events

### commit

The user picked one or more files in the native picker; fires ONCE after all reads resolve with params { files, count }. `files` is an array of { name, size (bytes), type (MIME), lastModified (epoch ms), dataUrl }, dataUrl is a base64 data-URI for files at/under ~1MB (directly actionable) or null for larger files (metadata still delivered). `count` is files.length. This carries the actual picked artifact; the host does NOT need a separate upload flow to read small files.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### dismiss

A per-file remove × was pressed; the component OWNS the list so the row IS removed from the UI, and params carry { index, name, label, count } (the removed row position + name + the remaining file count).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The dismissed item’s value/key when it identifies one. |
| `label` | `string` | Optional. The dismissed item’s visible label. |
| `index` | `number` | Optional. The dismissed item’s position when it came from a list. |
| `all` | `boolean` | Optional. True when the interaction cleared the whole set (clear-all). |
| `auto` | `boolean` | Optional. True when the RUNTIME initiated the dismiss (e.g. a Toast auto-dismissed on timeout) rather than a user gesture. |

See [Events](../../events.md) for the full payload contract.
