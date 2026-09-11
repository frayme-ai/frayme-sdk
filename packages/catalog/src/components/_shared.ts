/**
 * Shared prop atoms — the single source of the bounded vocabulary every catalog
 * schema reuses. Keeping the enums and value-channel validators in ONE module is
 * what keeps the authoring surface convergent: every component selects from the same
 * small menus and the same two validated value patterns (color + dimension),
 * never per-component spellings.
 *
 * Two kinds of atom:
 *  - ENUM atoms — the bounded menu the model picks from (CVA-backed, compiled to
 *    static classes at author time). Use these for `size`/`radius`/`tone`/etc.
 *  - VALUE atoms — `colorSchema` / `dimensionSchema(opts)` — validated
 *    string|number the model can author freely; the renderer turns the validated
 *    value into an inline `--*` CSS variable (data, never a class).
 *
 * Every value/enum prop is `.nullable()` and token-defaulted in the renderer, so
 * a minimal (props-less) spec still renders polished. Never widen an existing
 * enum into a value channel — `variant` stays a menu.
 */

import { z } from 'zod';
import { safeColor } from '../validate/color.js';
import { safeDimension, type DimOpts } from '../validate/dimension.js';

/* ── ENUM atoms (the bounded menu) ───────────────────────────────────────── */
/**
 * ENUM ALIASES. The catalog's 721 enum slots speak 181 vocabularies
 * (`variant` alone has 29; `default` is valid on 5 slots and invalid on 33), so a
 * model that learned a word on one component guesses it on another. This table
 * maps the words models actually write — shadcn's, and the catalog's own
 * neighbours — to candidates in PREFERENCE order; the first candidate the target
 * enum declares wins, and a word with no declared candidate is dropped so the
 * component renders its documented default. Read by `validateSpec`'s lenient
 * mode. Nothing here is a fact — only presentation vocabulary.
 */
export const ENUM_ALIASES: Record<string, readonly string[]> = {
  default: ['neutral', 'solid', 'primary', 'md', 'normal', 'standard'],
  primary: ['info', 'primary', 'solid'],
  secondary: ['secondary', 'neutral', 'outline', 'subtle'],
  destructive: ['danger', 'critical', 'error'],
  danger: ['critical', 'danger', 'error'],
  error: ['critical', 'danger', 'error'],
  critical: ['critical', 'danger', 'error'],
  negative: ['critical', 'danger', 'decrease', 'down'],
  positive: ['success', 'increase', 'up'],
  increase: ['increase', 'up', 'positive'],
  decrease: ['decrease', 'down', 'negative'],
  ok: ['success'],
  good: ['success'],
  warn: ['warning'],
  caution: ['warning'],
  muted: ['neutral', 'subtle'],
  subtle: ['neutral', 'subtle', 'ghost'],
  left: ['start', 'left'],
  right: ['end', 'right'],
  middle: ['center'],
  centre: ['center'],
  top: ['start'],
  bottom: ['end'],
  xs: ['sm'],
  xl: ['lg'],
  '2xl': ['lg'],
  small: ['sm'],
  medium: ['md'],
  large: ['lg'],
  horizontal: ['row', 'horizontal', 'inline'],
  vertical: ['column', 'vertical', 'stacked'],
  row: ['horizontal', 'row'],
  column: ['vertical', 'column'],
  none: ['none', 'plain'],
};

/** The declared word wins; else the first declared alias; else null (drop). */
export function resolveAlias(word: string, allowed: readonly string[]): string | null {
  if (allowed.includes(word)) return word;
  const lower = word.toLowerCase();
  if (allowed.includes(lower)) return lower;
  for (const c of ENUM_ALIASES[lower] ?? []) if (allowed.includes(c)) return c;
  return null;
}

export const Size = z.enum(['xs', 'sm', 'md', 'lg', 'xl']).nullable();
export const Radius = z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable();
export const Align = z.enum(['start', 'center', 'end', 'stretch']).nullable();
export const Tone = z.enum(['neutral', 'success', 'warning', 'critical', 'info']).nullable();
export const Orient = z.enum(['horizontal', 'vertical']).nullable();

/* Catalog-expansion atoms — the one canonical vocabulary every expansion component reuses, so there is never a per-component spelling.
 * `Variant` is VISUAL hierarchy ONLY — semantic intent lives in `Tone`
 * (`critical` IS the danger sense; there is no `danger`/`destructive` in the
 * unified vocab — components may accept those as a back-compat validation alias,
 * but the canonical/taught form is `tone:'critical'`). */
export const Variant = z
  .enum(['default', 'primary', 'secondary', 'tertiary', 'ghost', 'outline', 'link'])
  .nullable();
export const Density = z.enum(['compact', 'normal', 'comfortable']).nullable();
export const Justify = z.enum(['start', 'center', 'end', 'between', 'around', 'evenly']).nullable();
export const Elevation = z.enum(['none', 'sm', 'md', 'lg', 'xl']).nullable();
export const Gap = z.enum(['none', 'sm', 'md', 'lg', 'xl']).nullable();
/* Closed typeface menu — sans/serif/mono are Tailwind built-ins;
   rounded/display map to system-font stacks defined in frayme.css. A CLOSED enum,
   never a free `fontFamily` (no @font-face / font-src oracle). */
export const Font = z.enum(['sans', 'serif', 'mono', 'rounded', 'display']).nullable();

/* Closed border-style menu — solid/dashed/dotted, mapped
   to a static Tailwind utility by `borderStyleClass`. A CLOSED enum, never a free
   `border-style` string. */
export const BorderStyle = z.enum(['solid', 'dashed', 'dotted']).nullable();

/* Closed typography-polish menus (6i) — each maps to a static Tailwind utility
   via a helper (weightClass/trackingClass/leadingClass). CLOSED enums, never a
   free font-weight / letter-spacing / line-height value. Matches the catalog's
   short-name convention (weight/tracking/leading) already used by Heading/Text. */
export const Weight = z.enum(['light', 'normal', 'medium', 'semibold', 'bold']).nullable();
export const Tracking = z.enum(['tighter', 'tight', 'normal', 'wide', 'wider']).nullable();
export const Leading = z.enum(['tight', 'snug', 'normal', 'relaxed', 'loose']).nullable();

/* Closed elevation/opacity menus (6j) — shadow → shadow-none/sm/md/lg/xl;
   opacity → opacity-100/90/75/50/25, mapped by shadowClass/opacityClass. CLOSED
   enums, never a free box-shadow / opacity value. */
export const Shadow = z.enum(['none', 'sm', 'md', 'lg', 'xl']).nullable();
export const Opacity = z.enum(['full', '90', '75', '50', '25']).nullable();

/* Closed aspect-ratio menu (6k) — ratio-string vocab matching the catalog's
   existing `aspect` convention (Image/YouTube/VideoPlayer), mapped to a static
   Tailwind aspect-* utility by `aspectClass`. CLOSED enum, never a free
   aspect-ratio value. */
export const Aspect = z.enum(['auto', '1/1', '4/3', '3/2', '16/9', '21/9', '3/4']).nullable();

/* Closed overlay-motion menu — an OPT-IN enter-transition speed for
   floating surfaces (Dialog/Drawer/Popover/menus/Toast/etc.). Default (unset/none)
   = NO animation (instant, byte-identical). Mapped to a motion-safe animate-* class
   by `motionClass`. Closed enum, never a free duration/easing string; security-static
   timings (the catalog's animation-timing-is-a-closed-enum principle). */
export const Motion = z.enum(['none', 'fast', 'normal', 'slow']).nullable();

/* ── Shared icon-name enum (the closed glyph menu) ───────────────────────────
 * The one bounded icon vocabulary the model picks from where the glyph is a
 * BOUNDED menu (the standalone Icon primitive, Menubar items, the Fab). Every
 * name resolves against the runtime's closed `icons.ts` registry — an unknown
 * name simply renders no glyph. Bare `z.string()` icon props elsewhere (EmptyState
 * illustration, ListItem, etc.) stay free-form and are NOT bounded by this enum;
 * this atom is only for the components that expose icons as a closed choice.
 *
 * INVARIANT (load-bearing): this list === the runtime registry's glyph set EXACTLY
 * (the 274 stroke glyphs in `icons.ts` `ICONS` + the 6 filled brand glyphs in
 * `FILLED_ICONS`, 280 total). Members are listed in REGISTRY ORDER so the two
 * files diff obviously and stay byte-aligned. A name in the enum with no registry
 * entry would VALIDATE-BUT-RENDER-BLANK; a registry glyph missing from the enum is
 * drawn-but-unusable. Both directions are asserted zero-diff by the runtime test
 * `test/icons.test.tsx` (which imports this enum from `@frayme/catalog` and the
 * registry's `ICON_NAMES`). Add a glyph = add the entry to `icons.ts` AND here.
 *
 * Kept in ONE place so a new glyph family (e.g. the weather set) is added once and
 * every enum consumer picks it up — never a per-component spelling. Part of the
 * frayme-0.18.0 catalog vocabulary. */
export const IconName = z.enum([
  // core actions · navigation · UI chrome
  'check', 'x', 'chevron-down', 'chevron-up', 'chevron-left', 'chevron-right',
  'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'arrow-up-right', 'external-link',
  'plus', 'minus', 'search', 'settings', 'user', 'users',
  'trash', 'edit', 'download', 'upload', 'menu', 'more-horizontal',
  'more-vertical', 'info', 'alert-triangle', 'alert-circle', 'check-circle', 'star',
  'heart', 'bell', 'calendar', 'clock', 'home', 'mail',
  'lock', 'filter', 'copy', 'clipboard', 'paperclip', 'link',
  'image', 'refresh-cw', 'send', 'log-out', 'sparkles', 'bold',
  'italic', 'underline', 'eye', 'credit-card', 'save', 'arrow-down-right',
  'chevrons-left', 'chevrons-right', 'chevrons-up-down', 'move', 'maximize', 'minimize',
  'expand', 'shrink', 'pencil', 'trash-2', 'save-all', 'scissors',
  'share', 'share-2', 'rotate-cw', 'rotate-ccw', 'undo', 'redo',
  'printer', 'sliders', 'sliders-horizontal', 'plus-circle', 'minus-circle', 'x-circle',
  'circle-check', 'circle-x', 'circle-alert',
  // files · folders · documents
  'file', 'file-text', 'file-plus',
  'files', 'folder', 'folder-open', 'folder-plus', 'archive', 'book',
  'book-open', 'bookmark', 'clipboard-list', 'clipboard-check', 'clipboard-copy',
  // media · playback · communication
  'play',
  'pause', 'square-play', 'circle-play', 'skip-forward', 'skip-back', 'fast-forward',
  'rewind', 'volume', 'volume-1', 'volume-2', 'volume-x', 'mic',
  'mic-off', 'video', 'video-off', 'camera', 'music', 'headphones',
  'film', 'images', 'message-square', 'message-circle', 'mail-open', 'phone',
  'phone-call', 'phone-off', 'bell-off', 'at-sign', 'hash', 'link-2',
  'globe', 'wifi', 'wifi-off', 'rss', 'signal', 'help-circle',
  'circle-help', 'loader', 'loader-circle', 'zap', 'flag', 'shield',
  'shield-check', 'thumbs-up', 'thumbs-down', 'smile', 'frown', 'meh',
  'octagon-alert', 'triangle-alert',
  // people · commerce · time
  'user-plus', 'user-check', 'user-x', 'user-round',
  'contact', 'circle-user', 'shopping-cart', 'shopping-bag', 'dollar-sign', 'tag',
  'tags', 'gift', 'package', 'truck', 'wallet', 'receipt',
  'percent', 'banknote', 'coins', 'timer', 'alarm-clock', 'watch',
  'history', 'hourglass', 'calendar-days', 'calendar-clock',
  // layout · lists · alignment
  'layout', 'layout-grid',
  'layout-list', 'list', 'list-checks', 'list-ordered', 'columns', 'columns-2',
  'sidebar', 'panel-left', 'align-left', 'align-center', 'align-right', 'align-justify',
  'table-2', 'rows-2', 'eye-off', 'unlock',
  // weather · climate · maps
  'sun', 'moon',
  'cloud', 'cloud-off', 'cloud-rain', 'cloud-drizzle', 'cloud-snow', 'cloud-lightning',
  'cloud-fog', 'cloud-sun', 'cloud-moon', 'cloud-sun-rain', 'map', 'map-pin',
  'navigation', 'compass',
  // places · devices · dev · data
  'building', 'building-2', 'briefcase', 'key',
  'coffee', 'battery', 'cpu', 'database', 'server', 'hard-drive',
  'terminal', 'code', 'code-2', 'git-branch', 'git-commit-horizontal', 'bar-chart-3',
  'chart-bar', 'chart-line', 'chart-pie', 'trending-up', 'trending-down', 'activity',
  'gauge',
  // shapes · misc · tools · awards
  'circle', 'square', 'triangle', 'hexagon', 'diamond',
  'dot', 'palette', 'brush', 'droplet', 'feather', 'anchor',
  'award', 'target', 'crosshair', 'layers', 'box', 'grid-2x2',
  'grip-vertical', 'grip-horizontal', 'wrench', 'hammer', 'bug', 'rocket',
  'flame', 'bolt', 'lightbulb', 'thermometer', 'wind', 'snowflake',
  'umbrella', 'droplets', 'thermometer-sun', 'thermometer-snowflake', 'sunrise', 'sunset',
  'tornado', 'rainbow', 'haze', 'trophy', 'medal', 'crown',
  'ticket', 'qr-code', 'scan', 'fingerprint',
  // brand marks (filled — simple-icons geometry, CC0)
  'github', 'twitter',
  'facebook', 'instagram', 'linkedin', 'youtube',
]);

/* ── VALUE atoms (validated string/number → inline CSS var) ──────────────── */

/** A safe CSS color value (hex/rgb/hsl/oklch/named). Applied as a `--*` var. */
export const colorSchema = z
  .string()
  .refine((s) => safeColor(s) !== null, 'must be a safe CSS color (hex/rgb/hsl/oklch/named)')
  .nullable();

/**
 * A safe CSS length / unitless count. Pass `opts` to bound it at the call site
 * (e.g. `dimensionSchema({ kind: 'count', min: 1, max: 12 })` for `columns`).
 */
export const dimensionSchema = (opts?: DimOpts) =>
  z
    .union([z.string(), z.number()])
    .refine((v) => safeDimension(v, opts) !== null, 'must be a safe CSS length / count')
    .nullable();

/* ── formFieldBase (forms only) ─────────────────────────
 *
 * The ONE consistent behavioral + visual surface shared across all seven form
 * components (Input/Textarea/Select/Checkbox/Radio/Switch/Slider). Spread into
 * each schema via `z.object({ ...componentSpecific, ...formFieldBase })` so all form fields share a single vocabulary, while each component keeps its OWN
 * existing `label`/`name`/`checks`/`validateOn` shape (which carry per-component
 * required/nullable semantics relied on by existing tests) — those are NOT in
 * here, only the NEW shared fields are.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE) · D dimension (VALUE).
 * Every field is `.nullable()` + `.describe()`; defaults live in the renderer's
 * CVA `defaultVariants` so a props-less field still renders polished.
 */
export const formFieldBase = {
  disabled: z.boolean().nullable().describe('Grey out + block input (adds `disabled`/`aria-disabled`).'),
  readonly: z
    .boolean()
    .nullable()
    .describe('Value is visible but not editable (`readOnly`; Select/Switch/Slider become non-interactive).'),
  required: z.boolean().nullable().describe('Mark the field required (`required` attr + a required marker on the label).'),
  helpText: z.string().nullable().describe('Muted hint line under the control — formatting guidance or context (hidden while `errorText` is set).'),
  errorText: z.string().nullable().describe('Error message under the field — the danger help line + `aria-invalid` on the control; the text-box controls (Input/Textarea/Select) also get a danger control border (overrides helpText when set).'),
  size: z.enum(['sm', 'md', 'lg']).nullable().describe('Control height, font-size, and padding together (default `md`); use `sm` in dense forms and filter rows, `lg` for touch targets or roomy layouts.'),
  labelPlacement: z
    .enum(['top', 'hidden'])
    .nullable()
    .describe('Label position: top (default) · hidden (visually removed but kept for a11y via sr-only).'),
  labelColor: colorSchema.describe('Text colour of the field label/legend line above or beside the control (default the foreground token — inherits). Help text stays `mutedColor`; the error line stays the danger token.'),
  accent: colorSchema.describe('Brand color lever: focus ring + checked/active fill (default primary token).'),
  width: dimensionSchema({ units: ['px', 'rem', '%'], max: 900 }).describe('Field width (e.g. "12rem" or "100%"; default 100%). For Checkbox/Radio/Switch (default auto) it constrains the whole field incl. label wrap.'),
} as const;

/* ── actionShared (action family) ─────────────
 *
 * The ONE consistent surface shared across all seven action components
 * (Button/Link/DropdownMenu/Toggle/ToggleGroup/ButtonGroup/Pagination). Spread
 * into each schema via `z.object({ ...componentSpecific, ...actionShared })` so
 * all action components share a single vocabulary; each component keeps its OWN
 * existing shape (label/href/items/value/totalPages/etc.) plus its specifics.
 *
 * Channel legend: E enum · C content · SC safeColor (VALUE) · D dimension (VALUE).
 * Every field is `.nullable()` + `.describe()`; defaults live in the renderer's
 * CVA `defaultVariants` so a props-less action still renders polished.
 *
 * NOTE the action `size`/`align` are DELIBERATELY the small action menus
 * (sm·md·lg / start·center·end), NOT the broader shared `Size`/`Align` atoms
 * (which carry xs/xl / stretch) — an action button has no xs/xl height or
 * stretch alignment. Keeping these tight keeps the bounded action surface
 * convergent. `Radius` (none·sm·md·lg·full) IS the shared atom.
 */
export const actionShared = {
  accent: colorSchema.describe('Dominant/active color (button fill, selected pill, active page). Drives `--fr-<comp>-accent` (default primary token).'),
  accentText: colorSchema.describe('Text colour of the label printed on the `accent` fill — the on-fill ink (default the primary-foreground token).'),
  radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullable().describe('Corner-radius token for the control (default `md`); drop to `sm`/`none` on dense toolbars, `lg` or `full` for a pill-shaped button.'),
  size: z.enum(['sm', 'md', 'lg']).nullable().describe('Control height + padding + font-size together (default md).'),
  fullWidth: z.boolean().nullable().describe('Stretch the control to fill its container width (default false); set true for stacked mobile CTAs or a button that spans a form row.'),
  align: z.enum(['start', 'center', 'end']).nullable().describe('Inline content / justification within the control (default center).'),
} as const;

/* ── Per-item action confirmation ──────────────────────────────────────────────
 * Per-action confirmation config — the SAME shape as a spec action binding's
 * `confirm`, so confirmation is configured AT THE ACTION (a row action, a bulk
 * action, a card action), not as a component-wide prop. Rendered by the one
 * shared Frayme confirm modal.
 *
 * Lives here rather than in data-table.ts because per-item actions are no longer
 * a table-only idiom: KanbanBoard/KanbanCard draw the same `rowActions` contract,
 * and two copies of this shape is two places for it to drift.
 */
const actionConfirmCfg = z.object({
  title: z.string().nullable(),
  message: z.string().nullable(),
  confirmLabel: z.string().nullable(),
  cancelLabel: z.string().nullable(),
  variant: z.enum(['default', 'danger']).nullable(),
});
/* CONFIRM IS ON BY DEFAULT for per-item actions (see wantsConfirm in the runtime's
   registry/_rowaction.ts for the measurement behind that). Three authored forms,
   plus the default:
     omitted      -> confirm, with a title derived from the action's own label
     true         -> the same gesture, said explicitly
     "some text"  -> confirm, using that as the message
     {…}          -> confirm, fully specified
     FALSE        -> the ONLY opt-out, for a genuinely benign View/Export action.
   `false` had to be in the schema: without it the one escape hatch the runtime
   honours would be rejected by validation before it ever reached the renderer,
   and an author would have no way to turn a needless dialog off. */
export const actionConfirm = z.union([actionConfirmCfg, z.boolean(), z.string()]);

/** The per-item action list shared by DataTable rows and Kanban cards.
 *  `describe` differs per surface (what the id does, what the payload carries),
 *  so the caller supplies it — this is the SHAPE only. */
export const rowActionsSchema = z
  .array(
    z.object({
      id: z.string(),
      label: z.string().nullable(),
      icon: z.string().nullable(),
      variant: z.enum(['ghost', 'outline', 'primary', 'secondary', 'danger']).nullable(),
      confirm: actionConfirm.nullable(),
      disabled: z.boolean().nullable(),
    }),
  )
  .nullable();
