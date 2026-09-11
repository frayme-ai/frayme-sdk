/**
 * Frayme Icon — a standalone, general-purpose glyph primitive.
 *
 * A LEAF: places a single icon anywhere in a layout (in a Stack, beside Text, in
 * a Card header) rather than only riding on a Button/Toast/Stat. The glyph is a
 * NAME from the shared closed icon registry (`IconName`) — never raw SVG. An
 * unknown name renders nothing; the markup is Frayme-owned, so there is no
 * injection surface (the spec only ever supplies the lookup NAME).
 *
 * Not weather-specific: the weather glyphs (sun/cloud-rain/…) are just part of the
 * one shared `IconName` vocabulary this primitive draws from, alongside the core
 * action/UI glyphs.
 *
 * Component: Icon.
 */

import { z } from 'zod';
import { colorSchema, IconName } from './_shared.js';

export const iconComponents = {
  Icon: {
    props: z.object({
      name: IconName.describe(
        'The glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (e.g. "sun", "cloud-rain", "bell", "check"). Required. Never raw SVG; an unknown name renders nothing.',
      ),
      size: z
        .enum(['xs', 'sm', 'md', 'lg', 'xl'])
        .nullable()
        .describe('Glyph box size: xs (14px) · sm (18px) · md (24px, default) · lg (32px) · xl (48px). Bump to `lg`/`xl` for a focal/illustrative glyph, drop to `xs`/`sm` for an inline marker.'),
      color: colorSchema.describe(
        'Glyph colour (default the foreground token — inherits the surrounding text colour). Names a specific brand/semantic colour for the icon.',
      ),
      label: z
        .string()
        .nullable()
        .describe('Accessible label (aria-label) describing what the icon means (e.g. "Sunny"). Omit for a purely decorative glyph — it is then hidden from assistive tech (aria-hidden).'),
    }),
    description:
      'A standalone icon glyph, placeable anywhere (in a Stack, beside a Text label, in a Card header) — not tied to a Button or other host. `name` is a glyph NAME from the closed icon registry (or a single emoji glyph, rendered as-is) (never raw SVG; unknown names render nothing); `size` picks the box (xs..xl, default md) and `color` tints it (defaults to the inherited foreground colour). Set `label` when the icon carries meaning so it is announced to assistive tech; leave it off for a decorative glyph, which is then aria-hidden. A LEAF — it renders no children.',
    example: { name: 'sun', size: 'lg' },
  },
};
