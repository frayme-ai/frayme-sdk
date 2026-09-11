# PromptInput

The chat composer: a bordered textarea with a trailing send button. Enter (without Shift) emits `commit` with {value}; typing emits `change`. The optional attach button emits `commit` with {control:"attach"}. Bind `value` with $bindState to control the draft. Place directly below a Conversation.

## Example

```json
{
  "root": "prompt-input",
  "elements": {
    "prompt-input": {
      "type": "PromptInput",
      "props": {
        "placeholder": "Ask anything…",
        "attach": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `placeholder` | `string` | Greyed hint text inside the empty composer (e.g. "Ask anything…"). |
| `value` | `string` | Current draft text. Bind via $bindState for a two-way controlled composer. |
| `name` | `string` | Form field name for the composed message (submitted on send). |
| `size` | `"sm" \| "md" \| "lg"` | Composer height + font size: sm · md (default) · lg. |
| `disabled` | `boolean` | Grey out + block input (e.g. while not connected). |
| `loading` | `boolean` | Show a spinner on the send button + block submit while a reply is generating. |
| `attach` | `boolean` | Show a leading paperclip attach button. When clicked it emits `commit` with intrinsic params {control:"attach"} (not {value}), so a host can wire a file picker — no dedicated event/verb. |
| `accent` | `string` | Send button fill + focus ring color (default primary token). |
| `accentText` | `string` | Icon/text colour ON the filled send button — pair with a saturated `accent` so the glyph stays legible (default the on-primary token). |
| `borderColor` | `string` | Border color of the composer frame (default the border token). Name a brand color to tint the textarea outline; pair with `borderWidthValue` for a heavier frame. |
| `borderWidthValue` | `string \| number` | Exact thickness of the composer border (e.g. "2px"; default 1px). |
| `bg` | `string` | Background fill of the composer textarea surface (default the card token). Set a custom fill to match the surrounding page. Keep it light enough for the foreground token, which is what the typed text uses — `accentText` colours only the SEND BUTTON glyph and cannot rescue an unreadable composer. |
| `mutedColor` | `string` | Secondary/muted text colour — the greyed placeholder hint and the attach (paperclip) button icon (default the muted-foreground token). |
| `shadow` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` | Drop shadow on the composer surface to lift it off the page: none (default, flat) · sm · md · lg · xl. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |

## Events

### change

Fires on every keystroke in the textarea (only when emitOnChange !== false); params carry {value} with the current draft text.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### commit

Fires for the SEND action (Enter without Shift + not IME-composing, or a send-button click) — params carry {value} with the full draft; AND for the `attach` paperclip button — params carry {control:"attach"} (no value) so a host can distinguish it and open a file picker. Both no-op while `disabled` or `loading`.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
