# BlockDocumentEditor

A block document editor over a rich fixed set of block types (heading, paragraph, bulleted/numbered lists, quote, code, divider, spacer, table, key-value fields, image). Author drafts a document; the user edits inline, including editable tables, key-value fields, and uploaded images, then presses Save, which hands the WHOLE document (title, structured blocks, and a markdown rendering) back to the agent and switches to a clean view mode with Edit and Print buttons. Edits also stream a debounced `change`. No contentEditable, all text escaped, images validated; SSR-safe. Bind `value`, `title` with `{ $bindState }` so the agent (or a sibling control) can read the whole live document ({ title, blocks, markdown, blockCount }) and the document title from spec.state without waiting for Save.

## Example

```json
{
  "root": "block-document-editor",
  "elements": {
    "block-document-editor": {
      "type": "BlockDocumentEditor",
      "props": {
        "title": "Q3 Project Brief",
        "mode": "edit",
        "blocks": [
          {
            "id": "h1",
            "type": "heading",
            "text": "Executive summary",
            "level": 2
          },
          {
            "id": "p1",
            "type": "paragraph",
            "text": "Revenue grew 24% quarter-over-quarter, driven by the Platform tier."
          },
          {
            "id": "f1",
            "type": "fields",
            "fields": [
              {
                "label": "Owner",
                "value": "Priya"
              },
              {
                "label": "Status",
                "value": "On track"
              }
            ]
          },
          {
            "id": "l1",
            "type": "bulleted",
            "text": "Ship the scheduler\nHarden the component library\nWrite the docs"
          },
          {
            "id": "t1",
            "type": "table",
            "columns": [
              "Product",
              "Revenue",
              "Growth"
            ],
            "rows": [
              [
                "Platform",
                "£742k",
                "+31%"
              ],
              [
                "API",
                "£389k",
                "+18%"
              ]
            ]
          },
          {
            "id": "c1",
            "type": "code",
            "text": "npm run build && npm run test",
            "lang": "bash"
          }
        ]
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | Document title shown at the top and included in the Save/change payloads (bindable with { $bindState }). Escaped text. |
| `blocks` | `({ id: string, type: "heading" \| "paragraph" \| "bulleted" \| "numbered" \| "quote" \| "code" \| "divider" \| "spacer" \| "table" \| "fields" \| "image", text: string, level: number, lang: string, columns: string[], rows: string[][], fields: object[], src: string, alt: string, caption: string })[]` | The document blocks. Omit for a representative demo document. The component holds these in state and mutates them as the user edits. Capped at maxBlocks. |
| `mode` | `"edit" \| "view"` | Initial mode: edit (full editing UI) or view (rendered document + Edit/Print buttons). Defaults to edit when editable, else view. |
| `editable` | `boolean` | Allow editing (default true): add, change type, edit inline, duplicate, delete, and reorder (▲▼ or Alt+Arrow). Set false for a permanently read-only rendered document. |
| `showToolbar` | `boolean` | Show the add-block toolbar in edit mode (default true; ignored when not editable). |
| `showSave` | `boolean` | Show the Save button that emits the whole document and switches to view mode (default true; ignored when not editable). |
| `showPrint` | `boolean` | Show the Print button (in view mode, or the toolbar) that prints ONLY the document, not the surrounding page (default true). |
| `allowImageUpload` | `boolean` | Let the user upload an image file into an image block; it is read to a size-capped data-URI client-side (default true). |
| `allowedBlocks` | `("heading" \| "paragraph" \| "bulleted" \| "numbered" \| "quote" \| "code" \| "divider" \| "spacer" \| "table" \| "fields" \| "image")[]` | Restrict which block types can be added from the toolbar (default all eleven). |
| `saveLabel` | `string` | Label for the Save button (default "Save"). Escaped text, set for localization. |
| `printLabel` | `string` | Label for the Print button (default "Print"). Escaped text, set for localization. |
| `placeholder` | `string` | Message shown when the document is empty (default "Empty document, add a block to start"). Escaped text. |
| `maxBlocks` | `number` | Maximum number of blocks (default 128, hard-capped at 256). The add buttons disable at the cap. |
| `accent` | `string` | Accent color of the active-block ring, primary buttons and heading rules (default the primary token). |
| `mutedColor` | `string` | Secondary color, the toolbar chrome, block handles, counts and hints (default the muted-foreground token). |
| `gridColor` | `string` | Border color of the editor frame, table grid and block dividers (default the border token). |
| `font` | `"sans" \| "serif" \| "mono" \| "rounded" \| "display"` | Document typeface from the closed menu (default inherits the theme; serif suits formal documents). |
| `density` | `"compact" \| "normal" \| "comfortable"` | Vertical spacing between blocks: compact · normal (default) · comfortable. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit, no per-keystroke stream. |
| `value` | `Record&lt;string, any>` | Bindable mirror of the WHOLE edited document { title, blocks, markdown, blockCount }; kept live in spec.state (bind with { $bindState }) so an external Button can read the full body without waiting for Save. |

## Events

### commit

Save was pressed; params carry the WHOLE document { title, blocks, markdown, blockCount } so the agent receives the full edited content and can act on it.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### change

The document was edited (debounced ~0.5s); params carry the live { title, blocks, markdown } so an agent can watch the draft as it changes. Only fires when emitOnChange !== false; the document is mirrored into the bindable `value` state regardless.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### select

A block was focused or clicked; params carry { id, index, type } for opening or referencing that block.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

See [Events](../../events.md) for the full payload contract.
