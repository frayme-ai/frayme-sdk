'use client';
import type { ReactNode } from 'react';
import type { ComponentRenderProps } from '../upstream.js';
import { cn } from '../cn.js';
import { styleVars } from './_style.js';
import { Icon as Glyph } from './icons.js';

/* Catalog group (icon): Icon — a standalone glyph primitive.
 *
 * A LEAF: renders a single registry glyph by NAME, sized by the `size` enum and
 * tinted by the model-named `color` (a VALUE channel → a `--fr-icon-fg` CSS var,
 * never a class; unset → inherits the foreground/currentColor). The glyph markup
 * is OURS (looked up in the closed `icons.ts` registry); an unknown/absent name
 * renders nothing. Ignores children.
 *
 * a11y: a `label` becomes aria-label on a role="img" wrapper; without one the glyph
 * is decorative and aria-hidden.
 */

/* size enum → glyph box in px (matches the catalog `xs..xl` menu). */
const ICON_PX: Record<string, number> = { xs: 14, sm: 18, md: 24, lg: 32, xl: 48 };

export function Icon({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    name?: string | null;
    size?: string | null;
    color?: string | null;
    label?: string | null;
  };
  const size = ICON_PX[(p.size as string) ?? 'md'] ?? ICON_PX.md;
  const label = typeof p.label === 'string' && p.label.length > 0 ? p.label : null;
  return (
    <span
      // color is a VALUE channel: a SET colour lands in --fr-icon-fg and the glyph
      // paints from it via currentColor; unset → the var is absent and the token
      // fallback (foreground / inherited currentColor) wins (byte-identical default).
      className={cn(
        'inline-flex items-center justify-center align-middle',
        p.color != null && 'text-[color:var(--fr-icon-fg,currentColor)]',
      )}
      style={styleVars({ var: '--fr-icon-fg', value: p.color, kind: 'color' })}
      role={label ? 'img' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    >
      <Glyph name={p.name} size={size} />
    </span>
  );
}
