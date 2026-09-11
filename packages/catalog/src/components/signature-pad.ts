/**
 * Frayme SignaturePad — the pointer-drawn signature capture surface.
 *
 * Rides the shared CanvasSurface engine (runtime `_canvas.ts`): draw with
 * mouse/touch/stylus; strokes are captured as NORMALIZED [0,1] points and
 * rendered as smooth SVG polylines. The first catalog component with a genuine
 * pointer-drawing interaction — no primitive could compose this.
 *
 * ARCHITECTURE: SSR-safe — an empty bordered pad renders on the server, capture
 * begins on the client. The drawn signature is EPHEMERAL client state (like the
 * clock family): it is never persisted into the stored spec, but the `change`
 * event DELIVERS it to the host — the normalized point arrays plus an SVG
 * snapshot — so an agent can capture/store the actual signature.
 *
 * SECURITY: no raw markup is ever accepted. Coordinates are clamped to
 * [0,1] + finite-checked at capture, point/stroke counts are hard-capped
 * (render-bomb guard), and colors/dimensions flow through the validated value
 * channels (`colorSchema` / `dimensionSchema`). This is the render-body twin of
 * the catalog `safePoint`/`safePointList` validators.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE) · D dimension (VALUE).
 *
 * Component: SignaturePad.
 */

import { z } from 'zod';
import { colorSchema, dimensionSchema } from './_shared.js';

export const signaturePadComponents = {
  SignaturePad: {
    props: z.object({
      placeholder: z.string().nullable().describe('Hint shown centered on the empty pad (default "Sign here"). Escaped text; hidden once drawing starts.'),
      penColor: colorSchema.describe('Ink color of the signature strokes (default the foreground token).'),
      penWidth: dimensionSchema({ units: ['px'], min: 1, max: 8 }).describe('Stroke thickness in px (default 2px). Stays uniform at any pad size (non-scaling stroke).'),
      height: dimensionSchema({ units: ['px', 'rem'], min: 80, max: 480 }).describe('Pad height (e.g. "12rem"; default 10rem). Width fills the container.'),
      background: colorSchema.describe('Fill colour of the drawing surface behind the signature strokes (default the `card` token); set a paper-like or brand tint to match the surrounding form.'),
      borderColor: colorSchema.describe('Pad border + baseline color (default the border token).'),
      guideLine: z.boolean().nullable().describe('Show a dotted signature baseline near the bottom (default true).'),
      showClear: z.boolean().nullable().describe('Show the Clear button below the pad (default true).'),
      clearLabel: z.string().nullable().describe('Clear button label (default "Clear"). Escaped text — set for i18n.'),
      showSubmit: z.boolean().nullable().describe('Show the Submit button that commits the drawn signature (default true); disabled until something is drawn.'),
      submitLabel: z.string().nullable().describe('Submit button label (default "Submit"). Escaped text — set for internationalization.'),
      submitColor: colorSchema.describe('Fill color of the Submit button (default the primary token). Set it independently of the pen/border colors.'),
      signature: z.object({ empty: z.boolean(), strokeCount: z.number(), pointCount: z.number(), strokes: z.array(z.array(z.object({ x: z.number(), y: z.number() }))), svg: z.string() }).nullable().describe('The captured signature: normalized [0,1] stroke point-arrays plus a self-contained SVG snapshot. Bindable: the resolved signature is mirrored back here into (bindable) spec.state on every completed stroke / clear / submit, so an external Button can read the drawn signature without replaying commit/change events. Use { $bindState }.'),
      emitOnChange: z.boolean().nullable().describe('Also emit `change` on every completed stroke / clear (default false — by default the signature is only delivered when Submit is pressed).'),
      disabled: z.boolean().nullable().describe('Render read-only: no drawing, dimmed, controls hidden.'),
    }),
    description:
      'A signature pad: draw a signature with mouse/touch/stylus and it renders as smooth SVG polylines, with an optional dotted baseline, a Clear button, and a configurable Submit button. By default the drawn signature is held in state and delivered only when Submit is pressed (`commit`) — set emitOnChange to also stream `change` per stroke. SSR-safe; coordinates are normalized [0,1], clamped + finite-checked, counts capped — never raw markup. Bind `signature` with `{ $bindState }` so the agent (or a sibling control) can read the drawn signature (normalized strokes + SVG snapshot) from spec.state.',
    example: { placeholder: 'Sign here', guideLine: true, submitLabel: 'Submit signature' },
    events: ['commit', 'change'],
    eventsDoc: {
      commit:
        'The Submit button was pressed. Params carry the full drawn signature: { empty, strokeCount, pointCount, strokes (arrays of normalized [0,1] {x,y} points), svg (a self-contained SVG snapshot string) }. This is the primary way the signature reaches the agent — read strokes/svg to capture or store it.',
      change:
        'Only when emitOnChange is true: a stroke finished or the pad was cleared; params carry the same { empty, strokeCount, pointCount, strokes, svg } shape as commit, streamed per stroke.',
    },
  },
};
