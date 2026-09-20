# RichComposer

A full-blown WYSIWYG rich-text composer (Salesforce Rich Text Area-style): a contentEditable surface + a deep formatting toolbar, bold/italic/underline/strike, H1-H3 headings, bulleted + numbered lists, quote, code block + inline code, link (URL), image (URL), horizontal divider, and clear, plus a send button. Active inline formats highlight as pressed. Secure for untrusted specs: a spec value is inserted as plain text, paste is coerced to plain text, links + image sources are URL-guarded, and the output is sanitised to a small tag allowlist on every change. Live without any binding; the sanitised HTML stays in (bindable) state, `commit` fires on send, `change` on edit.

## Example

```json
{
  "root": "rich-composer",
  "elements": {
    "rich-composer": {
      "type": "RichComposer",
      "props": {
        "placeholder": "Write a comment…",
        "toolbar": [
          "bold",
          "italic",
          "underline",
          "h2",
          "link",
          "image",
          "bullet",
          "number",
          "code",
          "inlineCode",
          "quote",
          "divider",
          "clear"
        ],
        "submitLabel": "Comment"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `string` | Composer content, sanitised rich-text HTML the editor produces (interactive out of the box; bind it for two-way sync). A spec-supplied value is inserted as PLAIN TEXT (never injected as HTML). |
| `placeholder` | `string` | Placeholder shown when the editor is empty (default "Write a message…"). |
| `toolbar` | `("bold" \| "italic" \| "underline" \| "strike" \| "h1" \| "h2" \| "h3" \| "link" \| "image" \| "bullet" \| "number" \| "code" \| "inlineCode" \| "quote" \| "divider" \| "clear")[]` | Which formatting tools to show, in order, from [bold, italic, underline, strike, h1, h2, h3, link, image, bullet, number, code (block), inlineCode, quote, divider, clear]. Unknown entries are ignored; omit for a full-blown default set (all of the above). |
| `maxLength` | `number` | Maximum character count, shows a live counter that turns danger-red when the limit is exceeded (typing is not blocked). A plain count, not a visual dimension. |
| `submitLabel` | `string` | Text for the send button that fires `commit` (default "Send"). Set a context verb like "Comment" or "Post"; escaped text. |
| `size` | `"sm" \| "md" \| "lg"` | Editor + toolbar density together: sm · md (default) · lg. Sets the font size, toolbar button scale, and editor min-height (which the exact `minHeight` channel can override). |
| `minHeight` | `string \| number` | Exact min-height of the editor area (e.g. "160px" / "10rem"). Overrides the min-height set by the `size` enum, which is the default; font/toolbar density still follows `size`. |
| `disabled` | `boolean` | Grey out + block the toolbar, the editor, and submit (e.g. while a form section is locked). Parity with PromptInput. |
| `loading` | `boolean` | Show a spinner on the send button + block the toolbar/editor/submit while an in-flight submit is processing (sets aria-busy). Parity with PromptInput. |
| `accent` | `string` | Brand color for the send button fill + focus ring (default primary token). Names a specific brand color. |
| `accentText` | `string` | Text/icon colour ON the accent-filled send + link-apply buttons (default the primary-foreground token). Pair with a saturated `accent` to keep the label legible. |
| `mutedColor` | `string` | Secondary/muted text colour, the formatting-toolbar buttons, the empty-state placeholder, and the character counter (default the muted-foreground token). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit, no per-keystroke stream. |
| `readMode` | `boolean` | Enable a rendered read-only VIEW: after Send the composer flips to a formatted read view of the sanitised content with an Edit button to return; it also starts in read view when seeded with a `value`. Default false (stays editable after Send). |
| `editLabel` | `string` | Text for the Edit button shown in read mode (default "Edit"). Escaped text, only used when `readMode` is on. |

## Events

### change

The editor content changed, typing, a toolbar format, a link apply, or a paste; params carry {value}, the sanitised HTML. Only fires when `emitOnChange` !== false; the sanitised value stays live in (bindable) state regardless, so an external Button can read it via spec.state.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### commit

The send button was pressed; params carry {value}, the final sanitised HTML of the message.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
