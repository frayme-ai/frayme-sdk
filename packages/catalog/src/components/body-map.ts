/**
 * Frayme BodyMap — an anatomical region selector (Diagram-svg, baked art).
 *
 * The figure geometry is BAKED (a stylized front/back human figure of ~17 named
 * regions). The model authors STATE ONLY — which regions to highlight
 * (`marks`) and which is selected (`selectedRegion`) — never a coordinate. Used
 * for pain/symptom tracking, injury reports, PT, wearables.
 *
 * POSTURE: STATELESS pure-view, select-only. Region hit-targets are HTML
 * <button>s overlaying each region's bounding box (the regions are drawn as
 * non-overlapping SVG shapes, so the overlay maps 1:1 and focus rings render on
 * real HTML). Per-region highlight color is INLINE (safeColor).
 *
 * SECURITY: only KNOWN region ids highlight (unknown ids ignored); the
 * component owns all geometry; per-region color inline-validated; labels escaped.
 *
 * left / right are the SUBJECT's own sides (mirrored on screen for the front view).
 *
 * Component: BodyMap.
 */

import { z } from 'zod';
import { colorSchema } from './_shared.js';

const REGION_IDS = [
  'head', 'neck', 'chest', 'abdomen', 'pelvis',
  'rightUpperArm', 'rightForearm', 'rightHand',
  'leftUpperArm', 'leftForearm', 'leftHand',
  'rightThigh', 'rightShin', 'rightFoot',
  'leftThigh', 'leftShin', 'leftFoot',
] as const;

export const bodyMapComponents = {
  BodyMap: {
    props: z.object({
      view: z.enum(['front', 'back']).nullable().describe('Which side of the figure to show (default front). Changes the region labels (chest→upper back, etc.).'),
      marks: z
        .array(
          z.object({
            region: z.enum(REGION_IDS),
            tone: z.enum(['neutral', 'info', 'success', 'warning', 'critical']).nullable(),
            color: colorSchema,
            label: z.string().nullable(),
          }),
        )
        .nullable()
        .describe('Regions to highlight, each { region, tone?, color?, label? }. `region` must be one of the known anatomical ids; unknown ids are ignored. Omit for a plain figure.'),
      selectedRegion: z.enum(REGION_IDS).nullable().describe('The selected region id — the component writes the user-clicked region here into spec.state (bind with a bindable { $bindState } reference) so an external Button can read which region is selected; also seeds the initial selection. One of the ~17 known region ids.'),
      showLegend: z.boolean().nullable().describe('Show a legend of the highlighted regions below the figure (default true).'),
      accent: colorSchema.describe('Selection outline color (default the primary token).'),
      bodyColor: colorSchema.describe('Default (unmarked) region fill (default the muted token).'),
      lineColor: colorSchema.describe('Stroke colour of the anatomical figure outline (default the `border` token); set a brand or higher-contrast colour to match the surrounding UI.'),
      mutedColor: colorSchema.describe('Legend + secondary text (default the muted-foreground token).'),
    }),
    description:
      'An anatomical body-region selector on a baked stylized figure (~17 named regions, front or back). Author which regions to highlight (marks) and which is selected — the component owns all geometry. Region hit-targets are focusable HTML buttons; per-region highlight color is inline. Stateless, SSR-safe; click a region to emit `select`. Ideal for pain/symptom tracking and injury reports. Bind `selectedRegion` with `{ $bindState }` so the agent (or a sibling control) can read the clicked region id from spec.state.',
    example: {
      view: 'front',
      selectedRegion: 'chest',
      marks: [
        { region: 'chest', tone: 'critical', label: 'Sharp pain' },
        { region: 'leftShin', tone: 'warning', label: 'Aching' },
        { region: 'rightHand', tone: 'info', label: 'Numb' },
      ],
    },
    events: ['select'],
    eventsDoc: {
      select: 'A region was clicked; params carry { id, label, value, tone }.',
    },
  },
};
