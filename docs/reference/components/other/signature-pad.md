# SignaturePad

A signature pad: draw a signature with mouse/touch/stylus and it renders as smooth SVG polylines, with an optional dotted baseline, a Clear button, and a configurable Submit button. By default the drawn signature is held in state and delivered only when Submit is pressed (`commit`) — set emitOnChange to also stream `change` per stroke. SSR-safe; coordinates are normalized [0,1], clamped + finite-checked, counts capped — never raw markup. Bind `signature` with `{ $bindState }` so the agent (or a sibling control) can read the drawn signature (normalized strokes + SVG snapshot) from spec.state.

## Example

```json
{
  "root": "signature-pad",
  "elements": {
    "signature-pad": {
      "type": "SignaturePad",
      "props": {
        "placeholder": "Sign here",
        "guideLine": true,
        "submitLabel": "Submit signature"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `placeholder` | `string` | Hint shown centered on the empty pad (default "Sign here"). Escaped text; hidden once drawing starts. |
| `penColor` | `string` | Ink color of the signature strokes (default the foreground token). |
| `penWidth` | `string \| number` | Stroke thickness in px (default 2px). Stays uniform at any pad size (non-scaling stroke). |
| `height` | `string \| number` | Pad height (e.g. "12rem"; default 10rem). Width fills the container. |
| `background` | `string` | Fill colour of the drawing surface behind the signature strokes (default the `card` token); set a paper-like or brand tint to match the surrounding form. |
| `borderColor` | `string` | Pad border + baseline color (default the border token). |
| `guideLine` | `boolean` | Show a dotted signature baseline near the bottom (default true). |
| `showClear` | `boolean` | Show the Clear button below the pad (default true). |
| `clearLabel` | `string` | Clear button label (default "Clear"). Escaped text — set for i18n. |
| `showSubmit` | `boolean` | Show the Submit button that commits the drawn signature (default true); disabled until something is drawn. |
| `submitLabel` | `string` | Submit button label (default "Submit"). Escaped text — set for internationalization. |
| `submitColor` | `string` | Fill color of the Submit button (default the primary token). Set it independently of the pen/border colors. |
| `signature` | `{ empty: boolean, strokeCount: number, pointCount: number, strokes: object[][], svg: string }` | The captured signature: normalized [0,1] stroke point-arrays plus a self-contained SVG snapshot. Bindable: the resolved signature is mirrored back here into (bindable) spec.state on every completed stroke / clear / submit, so an external Button can read the drawn signature without replaying commit/change events. Use { $bindState }. |
| `emitOnChange` | `boolean` | Also emit `change` on every completed stroke / clear (default false — by default the signature is only delivered when Submit is pressed). |
| `disabled` | `boolean` | Render read-only: no drawing, dimmed, controls hidden. |

## Events

### commit

The Submit button was pressed. Params carry the full drawn signature: { empty, strokeCount, pointCount, strokes (arrays of normalized [0,1] {x,y} points), svg (a self-contained SVG snapshot string) }. This is the primary way the signature reaches the agent — read strokes/svg to capture or store it.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### change

Only when emitOnChange is true: a stroke finished or the pad was cleared; params carry the same { empty, strokeCount, pointCount, strokes, svg } shape as commit, streamed per stroke.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
