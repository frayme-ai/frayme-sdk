#!/usr/bin/env node
/**
 * render-docs.mjs — renders the component reference from the BUILT @frayme/catalog package.
 *
 * Emits, under the output directory (default: docs/reference):
 *   components/<group>/<component>.md   one page per catalog component (always rewritten)
 *   components/<group>/README.md        per-group index — rewritten only when the group's
 *                                       member list changed or the file is missing;
 *                                       `--refresh-groups` also refreshes the description column
 *   components/README.md                the grouped index of every component
 *   validation.md                       validateOps / compileOps / validateSpec
 *   events.md, icons.md, vocabulary.md  only with `--extras`
 *
 * Never deletes anything: pages for components that left the catalog are reported
 * as orphans, not removed. Hard-fails unless the number of component pages equals
 * CATALOG_COMPONENT_COUNT.
 *
 * Usage:
 *   node tools/render-docs.mjs [--out <dir>] [--dry-run] [--refresh-groups] [--extras] [--help]
 *   RENDER_DOCS_OUT=<dir> node tools/render-docs.mjs
 *
 * Requires a fresh build of the catalog first (`npm run build -w @frayme/catalog`).
 */

import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  fraymeCatalog,
  CATALOG_COMPONENT_COUNT,
  CATALOG_VERSION,
  EVENT_CONTRACT,
  CANONICAL_EVENTS,
  COMPONENT_EXTRA_EVENTS,
  COMPONENT_EVENT_ALIASES,
  IconName,
} from '../packages/catalog/dist/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIST = join(ROOT, 'packages', 'catalog', 'dist');
const VALIDATE_DTS = join(CATALOG_DIST, 'validate', 'index.d.ts');
// Only read for `--extras` (the comment-labelled icon groups and the shared enum
// atoms have no runtime representation in the built package).
const SHARED_SRC = join(ROOT, 'packages', 'catalog', 'src', 'components', '_shared.ts');

/* ── CLI ──────────────────────────────────────────────────────────────────── */

const USAGE = `Usage: node tools/render-docs.mjs [options]

Renders docs/reference/components/** and docs/reference/validation.md from the
built @frayme/catalog package (run \`npm run build -w @frayme/catalog\` first).

Options:
  --out <dir>        Output directory (default: docs/reference). Also RENDER_DOCS_OUT.
  --dry-run          Render and report what would change; write nothing.
  --refresh-groups   Also rewrite a group README whose description column drifted
                     (by default a group README is rewritten only when its member
                     list changed or the file is missing).
  --extras           Also render events.md, icons.md and vocabulary.md.
  -h, --help         Show this help.
`;

function parseArgs(argv) {
  const opts = {
    out: process.env.RENDER_DOCS_OUT || join(ROOT, 'docs', 'reference'),
    dryRun: false,
    refreshGroups: false,
    extras: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') {
      if (!argv[i + 1]) throw new Error('--out requires a directory');
      opts.out = argv[++i];
    } else if (a.startsWith('--out=')) opts.out = a.slice('--out='.length);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--refresh-groups') opts.refreshGroups = true;
    else if (a === '--extras') opts.extras = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else throw new Error(`unknown argument: ${a}\n\n${USAGE}`);
  }
  opts.out = resolve(opts.out);
  return opts;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Group taxonomy — curated mapping of catalog components into 12 doc groups.
 * Components added to the catalog after this list was authored fall through to
 * the name heuristics, then to "Other", so coverage is always 100%. Group slugs
 * and page paths are stable: the published navigation links to them.
 * ──────────────────────────────────────────────────────────────────────────── */

const GROUPS = [
  { slug: 'layout', label: 'Layout & containers' },
  { slug: 'forms', label: 'Forms & inputs' },
  { slug: 'actions', label: 'Buttons & actions' },
  { slug: 'data', label: 'Data display' },
  { slug: 'charts', label: 'Charts' },
  { slug: 'navigation', label: 'Navigation' },
  { slug: 'feedback', label: 'Feedback' },
  { slug: 'overlay', label: 'Overlay' },
  { slug: 'marketing', label: 'Marketing' },
  { slug: 'media', label: 'Media' },
  { slug: 'ai', label: 'AI' },
  { slug: 'other', label: 'Other' },
];

const MEMBERS = {
  layout: ['Accordion', 'Box', 'Card', 'Collapsible', 'Container', 'Grid', 'PageHeader', 'Resizable', 'Section', 'Separator', 'SplitPane', 'Stack'],
  forms: ['Calendar', 'Checkbox', 'ColorPicker', 'Combobox', 'DatePicker', 'DateRangePicker', 'FieldError', 'FileUpload', 'Form', 'FormField', 'Input', 'Label', 'MultiSelect', 'NumberInput', 'OTPInput', 'PhoneInput', 'QuantityStepper', 'Radio', 'RangeSlider', 'Rating', 'RichComposer', 'SearchInput', 'SegmentedControl', 'Select', 'Slider', 'Switch', 'TagInput', 'Textarea', 'TimePicker', 'Toggle', 'ToggleGroup'],
  actions: ['Button', 'ButtonGroup', 'CopyButton', 'Fab', 'IconButton', 'Link'],
  data: ['Avatar', 'AvatarGroup', 'Badge', 'BoardColumn', 'CodeBlock', 'ColumnHeader', 'DataGrid', 'DataTable', 'DescriptionList', 'DiffView', 'FacetList', 'FilterBar', 'FilterPanel', 'Gantt', 'Heading', 'Highlight', 'JsonView', 'KanbanBoard', 'KanbanCard', 'Kbd', 'ListItem', 'RelativeTime', 'Stat', 'StatGroup', 'Table', 'Tag', 'Text', 'Timeline', 'TimelineItem', 'Tree', 'VirtualList'],
  charts: ['AreaChart', 'BarChart', 'BarList', 'Candlestick', 'DonutChart', 'FunnelChart', 'Gauge', 'Heatmap', 'LineChart', 'PieChart', 'RadarChart', 'RadialBar', 'Sankey', 'ScatterChart', 'Sparkline', 'Tracker', 'Treemap'],
  navigation: ['Breadcrumb', 'DropdownMenu', 'Menubar', 'Navbar', 'NavigationMenu', 'Pagination', 'Sidebar', 'SidebarItem', 'Stepper', 'Tabs'],
  feedback: ['Alert', 'Banner', 'Callout', 'EmptyState', 'ErrorState', 'InlineMessage', 'LoadingOverlay', 'NotFound', 'Progress', 'ProgressCircle', 'Result', 'Shimmer', 'Skeleton', 'Spinner', 'Toast'],
  overlay: ['Backdrop', 'CommandPalette', 'Confirmation', 'Dialog', 'Drawer', 'HoverCard', 'Popover', 'Toggletip', 'Tooltip'],
  marketing: ['Comment', 'CommentThread', 'CTA', 'FAQ', 'FeatureCard', 'FeatureGrid', 'FeedItem', 'Footer', 'Hero', 'LogoCloud', 'PlanCard', 'PricingTable', 'SocialBar', 'Testimonial'],
  media: ['AudioPlayer', 'Carousel', 'Figure', 'Gallery', 'Image', 'Lightbox', 'Marquee', 'MediaGrid', 'Thumbnail', 'VideoPlayer', 'YouTube'],
  ai: ['Artifact', 'Conversation', 'InlineCitation', 'Message', 'MessageContent', 'PromptInput', 'Reasoning', 'Sources', 'Suggestion', 'Task', 'ToolCall', 'TypingIndicator', 'WebPreview'],
};

const CURATED = {};
for (const [group, names] of Object.entries(MEMBERS)) for (const n of names) CURATED[n] = group;

const HEURISTICS = [
  [/Chart$|Sparkline|Gauge|Heatmap|Treemap|Sankey|RadialBar|Candlestick|BarList|Tracker|Funnel/, 'charts'],
  [/Input$|Picker$|Select|Field|Form|Radio|Checkbox|Switch|Toggle|Slider|Rating|Calendar|OTP|Combobox/, 'forms'],
  [/Button|Fab|Link/, 'actions'],
  [/Nav|Menu|Breadcrumb|Sidebar|Pagination|Tabs|Stepper/, 'navigation'],
  [/Alert|Toast|Banner|Callout|Spinner|Skeleton|Progress|Empty|Error|NotFound|Loading|Shimmer/, 'feedback'],
  [/Tooltip|Popover|Dialog|Drawer|Backdrop|HoverCard|Toggletip|Command/, 'overlay'],
  [/Hero|Pricing|Plan|Testimonial|Feature|Logo|FAQ|Feed|Comment|Social|Footer|CTA/, 'marketing'],
  [/Image|Video|Audio|YouTube|Figure|Thumbnail|Marquee|Media|Gallery|Carousel|Lightbox/, 'media'],
  [/Message|Conversation|Reasoning|Tool|Task|Artifact|Web|Source|Citation|Prompt|Typing/, 'ai'],
  [/Table|Grid|List|Badge|Tag|Avatar|Timeline|Tree|Kbd|Json|Diff|Code|Stat|Kanban|Board/, 'data'],
];

function groupFor(name) {
  if (CURATED[name]) return CURATED[name];
  for (const [re, g] of HEURISTICS) if (re.test(name)) return g;
  return 'other';
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

/** PascalCase → kebab-case ("DataTable" → "data-table", "OTPInput" → "otp-input"). */
function kebab(name) {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Escape HTML-looking tags (`<img>`, `<a>`, `</dd>`, …) OUTSIDE backtick code
 * spans so markdown renderers don't swallow them as inline HTML. Text inside
 * backticks is left untouched (a code span already renders literally).
 */
function mdText(s) {
  return String(s ?? '')
    .split(/(`[^`]*`)/)
    .map((seg, i) => (i % 2 === 1 ? seg : seg.replace(/<(?=[a-zA-Z/])/g, '&lt;')))
    .join('');
}

/** Escape a string for use inside a markdown table cell. */
function cell(s) {
  return mdText(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

const ICON_ENTRIES = IconName.def.entries;
const MAX_ENUM_VALUES = 16;
const GROUP_DESC_CHARS = 110;

/**
 * A few example strings are rewritten for the public docs so placeholder task
 * copy stays generic. Remove an entry once the catalog example itself changes.
 */
const EXAMPLE_STRING_REWRITES = new Map([
  ['Wire the MCP server', 'Wire the webhook receiver'],
  ['Wire MCP server', 'Wire webhook receiver'],
  ['Multi-tenant SSE endpoint per workspace slug.', 'Verify signatures and enqueue events for processing.'],
]);

/** Deep-copy an example value, applying the docs string rewrites. */
function sanitizeExample(value) {
  if (typeof value === 'string') return EXAMPLE_STRING_REWRITES.get(value) ?? value;
  if (Array.isArray(value)) return value.map(sanitizeExample);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizeExample(v)]));
  }
  return value;
}

/** Render a Zod 4 schema as a compact type string. */
function typeString(schema, depth = 0) {
  const def = schema?.def ?? schema?._def;
  if (!def) return 'unknown';
  switch (def.type) {
    case 'nullable':
    case 'optional':
    case 'default':
    case 'readonly':
      return typeString(def.innerType, depth);
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'enum': {
      if (def.entries === ICON_ENTRIES) return 'IconName';
      const values = Object.values(def.entries).map((v) => JSON.stringify(v));
      if (values.length > MAX_ENUM_VALUES) {
        return `${values.slice(0, 12).join(' | ')} | … (+${values.length - 12} more)`;
      }
      return values.join(' | ');
    }
    case 'literal':
      return (def.values ?? []).map((v) => JSON.stringify(v)).join(' | ');
    case 'array': {
      const el = typeString(def.element, depth + 1);
      return el.includes('|') || el.includes('{') ? `(${el})[]` : `${el}[]`;
    }
    case 'union':
      return (def.options ?? []).map((o) => typeString(o, depth + 1)).join(' | ');
    case 'record':
      return `Record<${typeString(def.keyType, depth + 1)}, ${typeString(def.valueType, depth + 1)}>`;
    case 'object': {
      if (depth >= 2) return 'object';
      const entries = Object.entries(def.shape ?? {}).map(
        ([k, v]) => `${k}: ${typeString(v, depth + 1)}`,
      );
      return `{ ${entries.join(', ')} }`;
    }
    case 'any':
    case 'unknown':
      return 'any';
    case 'null':
      return 'null';
    default:
      return def.type ?? 'unknown';
  }
}

/** Description attached to a prop schema (checks the wrapper, then the inner type). */
function propDescription(schema) {
  return schema?.description ?? (schema?.def?.innerType?.description ?? '');
}

function payloadTable(verb) {
  const contract = EVENT_CONTRACT[verb];
  if (!contract?.payload?.length) return '';
  const rows = contract.payload.map((p) => {
    const doc = p.optional ? `Optional. ${p.doc}` : p.doc;
    return `| \`${p.key}\` | \`${cell(p.type)}\` | ${cell(doc)} |`;
  });
  return ['| Key | Type | Description |', '| --- | --- | --- |', ...rows].join('\n');
}

/* ── component-scoped event vocabulary ───────────────────────────────────── */

/**
 * Notes for the component-specific verbs in COMPONENT_EXTRA_EVENTS, keyed by
 * component type then verb. A verb without a note gets the generic sentence.
 */
const EXTRA_EVENT_NOTES = {
  DataTable: {
    add: 'A new row was saved from the footer Add-row editor (`addable`). Params carry { action:"add", row, rows } — the same payload `commit` reports for this interaction.',
    update: 'An inline row edit was saved (`editable`). Params carry { action:"edit", index, row, rows } — the same payload `commit` reports for this interaction.',
  },
};

function extraVerbsFor(name) {
  return COMPONENT_EXTRA_EVENTS[name] ?? [];
}

function aliasesFor(name) {
  return Object.entries(COMPONENT_EVENT_ALIASES[name] ?? {});
}

/* ── component pages ──────────────────────────────────────────────────────── */

function componentPage(name, def) {
  const slug = kebab(name);
  const lines = [];
  lines.push(`# ${name}`);
  lines.push('');
  lines.push(mdText(def.description ?? ''));
  lines.push('');

  if (Array.isArray(def.slots) && def.slots.length > 0) {
    lines.push('Accepts child elements via `children` (the `' + def.slots.join('`, `') + '` slot).');
    lines.push('');
  }

  // Example — the component's example props inside a minimal spec.
  const spec = {
    root: slug,
    elements: {
      [slug]: { type: name, props: sanitizeExample(def.example ?? {}) },
    },
  };
  lines.push('## Example');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(spec, null, 2));
  lines.push('```');
  lines.push('');

  // Props table from the Zod schema.
  lines.push('## Props');
  lines.push('');
  const shape = def.props?.def?.type === 'object' ? def.props.def.shape : null;
  if (shape && Object.keys(shape).length > 0) {
    lines.push('| Prop | Type | Description |');
    lines.push('| --- | --- | --- |');
    for (const [propName, propSchema] of Object.entries(shape)) {
      const t = typeString(propSchema);
      const typeCell =
        t === 'IconName' ? '[`IconName`](../../icons.md)' : `\`${cell(t)}\``;
      lines.push(`| \`${propName}\` | ${typeCell} | ${cell(propDescription(propSchema))} |`);
    }
  } else {
    // Introspection fallback: no prop shape available — description only.
    lines.push(mdText(def.description ?? '') || '_This component takes no documented props._');
  }
  lines.push('');

  // Events — the canonical verbs, then any component-specific verbs and
  // aliases from the catalog's event vocabulary. Omitted entirely for
  // display-only components.
  const events = def.events ?? [];
  const extras = extraVerbsFor(name);
  const aliases = aliasesFor(name);
  if (events.length > 0 || extras.length > 0 || aliases.length > 0) {
    lines.push('## Events');
    lines.push('');
    for (const verb of events) {
      lines.push(`### ${verb}`);
      lines.push('');
      const doc = def.eventsDoc?.[verb] ?? EVENT_CONTRACT[verb]?.description ?? '';
      lines.push(mdText(doc));
      lines.push('');
      const table = payloadTable(verb);
      if (table) {
        lines.push(table);
        lines.push('');
      }
    }
    for (const verb of extras) {
      lines.push(`### ${verb}`);
      lines.push('');
      lines.push(
        `Component-specific verb — accepted on \`${name}\` in addition to the canonical set, so it never appears in \`events[]\`. Bind \`on.${verb}\` to receive this interaction on its own; when it is not bound, the same interaction is reported through \`commit\`.`,
      );
      lines.push('');
      const note = EXTRA_EVENT_NOTES[name]?.[verb];
      if (note) {
        lines.push(mdText(note));
        lines.push('');
      }
    }
    if (aliases.length > 0) {
      lines.push('### Aliases');
      lines.push('');
      for (const [alias, target] of aliases) {
        lines.push(
          `- \`${alias}\` is accepted on \`${name}\` as an alias of \`${target}\`: \`on.${alias}\` binds to the same interaction and payload as \`on.${target}\`.`,
        );
      }
      lines.push('');
    }
    lines.push('See [Events](../../events.md) for the full payload contract.');
    lines.push('');
  }

  return { slug, content: lines.join('\n') };
}

/* ── group README (per-group index) ───────────────────────────────────────── */

function groupReadme(group, members, components) {
  const rows = members
    .map((name) => ({
      name,
      file: `${kebab(name)}.md`,
      desc: mdText(components[name]?.description ?? '').slice(0, GROUP_DESC_CHARS),
    }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const lines = [];
  lines.push(`# ${group.label}`);
  lines.push('');
  lines.push(`${rows.length} components in this group.`);
  lines.push('');
  lines.push('| Component | Description |');
  lines.push('|---|---|');
  for (const r of rows) lines.push(`| [${r.name}](${r.file}) | ${r.desc} |`);
  lines.push('');
  return lines.join('\n');
}

/** The set of page files an existing group README links to (empty when unreadable). */
async function linkedPages(readmePath) {
  try {
    const src = await readFile(readmePath, 'utf8');
    return new Set([...src.matchAll(/\]\(([a-z0-9-]+\.md)\)/g)].map((m) => m[1]));
  } catch {
    return null;
  }
}

/* ── index page ───────────────────────────────────────────────────────────── */

function indexPage(grouped) {
  const lines = [];
  lines.push('# Component reference');
  lines.push('');
  lines.push(
    `The ${CATALOG_COMPONENT_COUNT} components in the Frayme catalog (\`${CATALOG_VERSION}\`), grouped by function.`,
  );
  lines.push('');
  lines.push(
    'Every component is a `type` you can use in a spec\'s `elements` map. Props are validated against the schemas in [`@frayme/catalog`](https://www.npmjs.com/package/@frayme/catalog) before anything renders. See also: [Events](../events.md) · [Icons](../icons.md) · [Vocabulary](../vocabulary.md) · [Validation](../validation.md).',
  );
  lines.push('');
  for (const group of GROUPS) {
    const members = grouped.get(group.slug);
    if (!members || members.length === 0) continue;
    lines.push(`## ${group.label}`);
    lines.push('');
    for (const name of members) {
      lines.push(`- [${name}](${group.slug}/${kebab(name)}.md)`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/* ── events.md (extras) ───────────────────────────────────────────────────── */

function eventsPage() {
  const lines = [];
  lines.push('# Events');
  lines.push('');
  lines.push(
    'Every interactive Frayme component emits one or more of eight canonical event verbs — a closed vocabulary, so handlers written once work across the whole catalog.',
  );
  lines.push('');
  lines.push('```ts');
  lines.push("import { CANONICAL_EVENTS, EVENT_CONTRACT, componentEvents } from '@frayme/catalog';");
  lines.push('');
  lines.push(`CANONICAL_EVENTS; // ${JSON.stringify(CANONICAL_EVENTS)}`);
  lines.push("componentEvents('Button'); // ['commit']");
  lines.push("componentEvents('Card');   // [] — display-only, no events");
  lines.push('```');
  lines.push('');
  lines.push(
    'Most interactions (typing, toggling tabs, local filters) resolve inside the renderer without a round-trip; only spec-declared actions reach your host. When an event fires, its payload carries the intrinsic keys below.',
  );
  lines.push('');
  for (const verb of CANONICAL_EVENTS) {
    const contract = EVENT_CONTRACT[verb];
    lines.push(`## ${verb}`);
    lines.push('');
    lines.push(mdText(contract?.description ?? ''));
    lines.push('');
    const table = payloadTable(verb);
    if (table) {
      lines.push(table);
      lines.push('');
    }
  }
  const extraTypes = Object.keys(COMPONENT_EXTRA_EVENTS);
  const aliasTypes = Object.keys(COMPONENT_EVENT_ALIASES);
  if (extraTypes.length > 0 || aliasTypes.length > 0) {
    lines.push('## Component-specific spellings');
    lines.push('');
    lines.push(
      'A few components accept extra event keys on top of the canonical eight. They are exported as `COMPONENT_EXTRA_EVENTS` (distinct verbs the renderer fires when bound) and `COMPONENT_EVENT_ALIASES` (alternative spellings of a verb the component already emits); `acceptedEventKeys(type, declared)` lists every key a type accepts.',
    );
    lines.push('');
    for (const type of extraTypes) {
      lines.push(`- \`${type}\`: ${COMPONENT_EXTRA_EVENTS[type].map((v) => `\`${v}\``).join(', ')} (component-specific verbs)`);
    }
    for (const type of aliasTypes) {
      const aliasList = Object.entries(COMPONENT_EVENT_ALIASES[type]).map(([a, t]) => `\`${a}\` → \`${t}\``);
      lines.push(`- \`${type}\`: ${aliasList.join(', ')} (aliases)`);
    }
    lines.push('');
  }
  lines.push(
    'Each component page lists which verbs that component emits, with component-specific notes.',
  );
  lines.push('');
  return lines.join('\n');
}

/* ── icons.md (extras) ────────────────────────────────────────────────────── */

/**
 * Parse the IconName enum literal in the catalog source to recover the
 * comment-labelled glyph groups. Falls back to a single flat list if the source
 * is unavailable or the parse drifts from the exported enum.
 */
async function parseIconGroups() {
  const exported = Object.keys(ICON_ENTRIES);
  try {
    const src = await readFile(SHARED_SRC, 'utf8');
    const m = src.match(/export const IconName = z\.enum\(\[([\s\S]*?)\]\);/);
    if (!m) throw new Error('IconName enum block not found');
    const groups = [];
    let current = null;
    for (const rawLine of m[1].split('\n')) {
      const line = rawLine.trim();
      const comment = line.match(/^\/\/\s*(.+)$/);
      if (comment) {
        current = { label: comment[1].trim(), names: [] };
        groups.push(current);
        continue;
      }
      for (const nm of line.matchAll(/'([^']+)'/g)) {
        if (!current) {
          current = { label: 'Icons', names: [] };
          groups.push(current);
        }
        current.names.push(nm[1]);
      }
    }
    const parsed = groups.flatMap((g) => g.names);
    if (parsed.length !== exported.length || parsed.some((n, i) => n !== exported[i])) {
      throw new Error('parsed glyph list does not match the exported enum');
    }
    return groups;
  } catch (e) {
    console.warn(`icons.md: falling back to a flat list (${e.message})`);
    return [{ label: 'Icons', names: exported }];
  }
}

function iconsPage(groups, total) {
  const lines = [];
  lines.push('# Icons');
  lines.push('');
  lines.push(
    `\`IconName\` is the closed menu of ${total} glyph names accepted wherever a component exposes an icon as a bounded choice (the \`Icon\` component, \`Menubar\` items, the \`Fab\`, and others).`,
  );
  lines.push('');
  lines.push('```json');
  lines.push(
    JSON.stringify(
      {
        root: 'icon',
        elements: { icon: { type: 'Icon', props: { name: 'sparkles', size: 'md' } } },
      },
      null,
      2,
    ),
  );
  lines.push('```');
  lines.push('');
  lines.push('The full enum is exported for programmatic use:');
  lines.push('');
  lines.push('```ts');
  lines.push("import { IconName } from '@frayme/catalog';");
  lines.push('');
  lines.push("IconName.safeParse('sparkles').success; // true");
  lines.push('```');
  lines.push('');
  for (const g of groups) {
    if (groups.length > 1) {
      lines.push(`## ${g.label[0].toUpperCase()}${g.label.slice(1)}`);
      lines.push('');
    }
    lines.push(g.names.map((n) => `\`${n}\``).join(' · '));
    lines.push('');
  }
  return lines.join('\n');
}

/* ── vocabulary.md (extras) ───────────────────────────────────────────────── */

const ATOM_NOTES = {
  Size: 'General size scale used by non-form components.',
  Radius: 'Corner-radius token.',
  Align: 'Cross-axis alignment.',
  Tone: 'Semantic intent — `critical` is the danger sense; there is no separate `danger` value in the canonical vocabulary.',
  Orient: 'Layout direction.',
  Variant: 'Visual hierarchy only — semantic intent lives in `Tone`.',
  Density: 'Row/item spacing preset.',
  Justify: 'Main-axis distribution.',
  Elevation: 'Surface elevation preset.',
  Gap: 'Spacing between children.',
  Font: 'Closed typeface menu — never a free font-family string.',
  BorderStyle: 'Closed border-style menu.',
  Weight: 'Font weight preset.',
  Tracking: 'Letter-spacing preset.',
  Leading: 'Line-height preset.',
  Shadow: 'Box-shadow preset.',
  Opacity: 'Opacity preset.',
  Aspect: 'Closed aspect-ratio menu (`Image`, `VideoPlayer`, `YouTube`, …).',
  Motion: 'Opt-in enter-transition speed for floating surfaces; unset means no animation.',
};

/** Parse the shared enum atoms (everything except IconName) from the catalog source. */
async function parseSharedAtoms() {
  const src = await readFile(SHARED_SRC, 'utf8');
  const atoms = [];
  for (const m of src.matchAll(/export const (\w+) = z\s*\n?\s*\.enum\(\[([\s\S]*?)\]\)/g)) {
    const name = m[1];
    if (name === 'IconName') continue;
    const values = [...m[2].matchAll(/'([^']+)'/g)].map((v) => v[1]);
    if (values.length > 0) atoms.push({ name, values });
  }
  return atoms;
}

function vocabularyPage(atoms) {
  const lines = [];
  lines.push('# Vocabulary');
  lines.push('');
  lines.push(
    'Shared enum atoms — the bounded value menus reused across the whole catalog, so every component spells `size`, `tone`, `radius`, and friends the same way.',
  );
  lines.push('');
  lines.push(
    'Every atom is nullable: omit the prop and the renderer applies its default token, so a minimal spec still renders polished.',
  );
  lines.push('');
  lines.push('## Enum atoms');
  lines.push('');
  lines.push('| Atom | Values | Notes |');
  lines.push('| --- | --- | --- |');
  for (const atom of atoms) {
    const values = atom.values.map((v) => `\`${v}\``).join(' · ');
    lines.push(`| \`${atom.name}\` | ${cell(values)} | ${cell(ATOM_NOTES[atom.name] ?? '')} |`);
  }
  lines.push('');
  lines.push('## Value atoms');
  lines.push('');
  lines.push(
    'Two prop channels accept validated free values instead of an enum. Both are nullable and applied as inline CSS variables — data, never arbitrary CSS:',
  );
  lines.push('');
  lines.push(
    '- **Color** — a safe CSS color (hex, `rgb()`, `hsl()`, `oklch()`, or a named color). Used by props like `accent`, `labelColor`, `gradientFrom`. Unsafe strings fail validation.',
  );
  lines.push(
    '- **Dimension** — a safe CSS length or unitless count (for example `"12rem"`, `"100%"`, or `3`), bounded per call site (a `columns` prop caps its count range). Used by props like `width` and `minWidth`.',
  );
  lines.push('');
  lines.push('```json');
  lines.push(
    JSON.stringify(
      {
        root: 'cta',
        elements: {
          cta: {
            type: 'Button',
            props: { label: 'Upgrade', accent: '#6d28d9', minWidth: '12rem', radius: 'full' },
          },
        },
      },
      null,
      2,
    ),
  );
  lines.push('```');
  lines.push('');
  lines.push(
    'Icon names are their own closed vocabulary — see [Icons](icons.md). The canonical event verbs are documented in [Events](events.md).',
  );
  lines.push('');
  return lines.join('\n');
}

/* ── validation.md ────────────────────────────────────────────────────────── */

const FAILURE_CATEGORY_NOTES = {
  empty_input: 'The operations string contained no non-blank lines.',
  malformed_jsonl: 'One or more lines did not parse as JSON.',
  compiler_error: 'The stream compiler threw while replaying the operations.',
  empty_spec: 'Compilation produced no spec (or a spec with no root/elements).',
  catalog_validation_failed: 'A component type, prop shape, or spec structure check failed.',
  invalid_prop_value: 'A literal prop value is not one of the options its schema allows (for example an out-of-enum `direction`).',
  unknown_element_key: 'An element carries a field the renderer does not recognise.',
  invalid_binding: 'A state binding or template expression is malformed.',
  invalid_directive: 'A `visible`/`watch`/conditional directive has the wrong shape.',
  invalid_action_kind: 'A spec-declared action has an unknown `kind`.',
  resource_limit: 'The spec exceeds a size or depth limit.',
  unsafe_value: 'A color/dimension prop carries a value the safety validators reject.',
};

/** Parse the FailureCategory union members from the built type declarations. */
async function parseFailureCategories() {
  const src = await readFile(VALIDATE_DTS, 'utf8');
  const m = src.match(/type FailureCategory =([\s\S]*?);/);
  if (!m) throw new Error(`FailureCategory union not found in ${VALIDATE_DTS}`);
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
}

function validationPage(categories) {
  const lines = [];
  lines.push('# Validation');
  lines.push('');
  lines.push(
    'Validate a stream of spec operations — or an already-compiled spec — against the Frayme catalog, exactly the way the API gates every generation before it renders.',
  );
  lines.push('');
  lines.push('```ts');
  lines.push("import { validateOps, compileOps, validateSpec } from '@frayme/catalog/validate';");
  lines.push('');
  lines.push('// End-to-end: parse JSONL operations, compile, validate.');
  lines.push('const result = validateOps(opsJsonl);');
  lines.push('if (!result.valid) {');
  lines.push('  console.error(result.failureCategory, result.errors);');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('## The three functions');
  lines.push('');
  lines.push(
    '- **`compileOps(opsJsonl)`** — stage 1+2: parses each JSONL line and replays it through the stream compiler. Returns `{ spec }` or `{ failure: { errors, failureCategory } }`.',
  );
  lines.push(
    '- **`validateSpec(spec, opts?)`** — stage 3: validates an already-compiled spec (component types, prop shapes, referential integrity — no dangling `root`, no missing `children`). Use this on the streaming path, where the spec is compiled incrementally.',
  );
  lines.push(
    '- **`validateOps(opsJsonl, opts?)`** — convenience: `validateSpec(compileOps(opsJsonl))`.',
  );
  lines.push('');
  lines.push('## Options');
  lines.push('');
  lines.push('Both validators accept the same options object:');
  lines.push('');
  lines.push(
    '- **`mode`** — `"strict"` (default) validates the spec as written. `"lenient"` first runs the schema-driven normaliser (unknown props dropped, enum aliases resolved, scalar coercions, `FormField` labels inherited) and then validates the normalised spec; every change is listed in `normalizations` and echoed into `warnings`.',
  );
  lines.push(
    '- **`resolution`** — run the render-resolution gate (binding syntax, directive shapes, action kinds, value safety) after the catalog and referential checks. Off by default; recommended for authoring and CI pipelines.',
  );
  lines.push(
    '- **`props`** — check every literal prop value against its schema options (`invalid_prop_value`). On by default: an out-of-enum value renders silently as the bare base style, so it is treated as a failure rather than a nuance.',
  );
  lines.push(
    '- **`computed`** — check every `$computed` expression (registered function name, argument shape). On by default; skipped when `resolution: true` already ran the full gate.',
  );
  lines.push(
    '- **`computedFunctions`** — extra `$computed` function names your host registers, so they are not reported as unknown.',
  );
  lines.push(
    '- **`catalog`** — validate against an extended catalog from `extendCatalog()` when you bring custom components. Defaults to the built-in catalog.',
  );
  lines.push('');
  lines.push('## OpsValidationResult');
  lines.push('');
  lines.push('```ts');
  lines.push('interface OpsValidationResult {');
  lines.push('  valid: boolean;');
  lines.push('  errors: string[];');
  lines.push('  warnings: string[];');
  lines.push('  spec?: FraymeSpec; // present when valid — the compiled spec, interactivity intact');
  lines.push('  failureCategory?: FailureCategory; // present when invalid');
  lines.push('  normalizations?: string[]; // lenient mode only — what the normaliser changed, one line each');
  lines.push('  normalized?: unknown; // lenient mode only — the normalised spec, valid or not');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('## FailureCategory');
  lines.push('');
  lines.push('Branch on the category, not the error strings:');
  lines.push('');
  lines.push('| Category | Meaning |');
  lines.push('| --- | --- |');
  for (const c of categories) {
    lines.push(`| \`${c}\` | ${cell(FAILURE_CATEGORY_NOTES[c] ?? '')} |`);
  }
  lines.push('');
  lines.push('## Validating a compiled spec directly');
  lines.push('');
  lines.push('```ts');
  lines.push("import { validateSpec } from '@frayme/catalog/validate';");
  lines.push('');
  lines.push('const result = validateSpec({');
  lines.push("  root: 'card',");
  lines.push('  elements: {');
  lines.push("    card: { type: 'Card', props: { title: 'Overview' } },");
  lines.push('  },');
  lines.push('}, { resolution: true });');
  lines.push('');
  lines.push('result.valid; // true');
  lines.push('```');
  lines.push('');
  lines.push(
    'Bring-your-own-component specs get their custom props checked by `validateManifestProps(spec, compiledManifests)` — built-in element types are ignored there; the catalog gate above covers them.',
  );
  lines.push('');
  return lines.join('\n');
}

/* ── file writing ─────────────────────────────────────────────────────────── */

async function readIfExists(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/** Write `content` to `path` unless it already holds exactly that content. */
async function emit(path, content, tally, dryRun) {
  const existing = await readIfExists(path);
  if (existing === content) {
    tally.unchanged++;
    return 'unchanged';
  }
  const kind = existing === null ? 'created' : 'updated';
  tally[kind]++;
  tally.changedPaths.push(path);
  if (!dryRun) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
  }
  return kind;
}

/** Component pages already on disk that no catalog component produces any more. */
async function findOrphans(componentsOut, expected) {
  const orphans = [];
  let entries;
  try {
    entries = await readdir(componentsOut);
  } catch {
    return orphans;
  }
  for (const entry of entries) {
    const dir = join(componentsOut, entry);
    if (!(await stat(dir)).isDirectory()) continue;
    for (const file of await readdir(dir)) {
      if (!file.endsWith('.md') || file === 'README.md') continue;
      const rel = `${entry}/${file}`;
      if (!expected.has(rel)) orphans.push(rel);
    }
  }
  return orphans.sort();
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(USAGE);
    return;
  }

  const OUT = opts.out;
  const COMPONENTS_OUT = join(OUT, 'components');
  const components = fraymeCatalog.data.components;
  const names = Object.keys(components);

  // Group the live component list.
  const grouped = new Map(GROUPS.map((g) => [g.slug, []]));
  for (const name of names) grouped.get(groupFor(name)).push(name);
  for (const list of grouped.values()) list.sort();

  // Render every component page in memory first, so the count assertion runs
  // before a single byte is written.
  const pages = [];
  const introspectionGaps = [];
  for (const group of GROUPS) {
    for (const name of grouped.get(group.slug)) {
      const def = components[name];
      if (!(def.props?.def?.type === 'object' && def.props.def.shape)) {
        introspectionGaps.push(name);
      }
      const { slug, content } = componentPage(name, def);
      pages.push({ group: group.slug, rel: `${group.slug}/${slug}.md`, content });
    }
  }
  if (pages.length !== CATALOG_COMPONENT_COUNT) {
    console.error(
      `FATAL: rendered ${pages.length} component pages but CATALOG_COMPONENT_COUNT is ${CATALOG_COMPONENT_COUNT}`,
    );
    process.exit(1);
  }

  const tally = { created: 0, updated: 0, unchanged: 0, changedPaths: [] };
  const dry = opts.dryRun;

  // Component pages — always emitted.
  for (const page of pages) {
    await emit(join(COMPONENTS_OUT, page.rel), page.content, tally, dry);
  }

  // Group READMEs — never deleted; rewritten only when the member list changed
  // (or the file is missing), unless --refresh-groups asks for description
  // refreshes too. Drift is reported either way.
  const groupDrift = [];
  const groupRewrites = [];
  for (const group of GROUPS) {
    const members = grouped.get(group.slug);
    if (members.length === 0) continue;
    const path = join(COMPONENTS_OUT, group.slug, 'README.md');
    const content = groupReadme(group, members, components);
    const existing = await readIfExists(path);
    if (existing === content) {
      tally.unchanged++;
      continue;
    }
    const linked = existing === null ? null : await linkedPages(path);
    const wanted = new Set(members.map((n) => `${kebab(n)}.md`));
    const sameMembers =
      linked !== null && linked.size === wanted.size && [...wanted].every((f) => linked.has(f));
    if (sameMembers && !opts.refreshGroups) {
      groupDrift.push(group.slug);
      tally.unchanged++;
      continue;
    }
    groupRewrites.push(group.slug);
    await emit(path, content, tally, dry);
  }

  // Index + validation.
  await emit(join(COMPONENTS_OUT, 'README.md'), indexPage(grouped), tally, dry);
  const categories = await parseFailureCategories();
  await emit(join(OUT, 'validation.md'), validationPage(categories), tally, dry);

  // Extras (opt-in).
  let extrasNote = '';
  if (opts.extras) {
    await emit(join(OUT, 'events.md'), eventsPage(), tally, dry);
    const iconGroups = await parseIconGroups();
    const iconTotal = Object.keys(ICON_ENTRIES).length;
    await emit(join(OUT, 'icons.md'), iconsPage(iconGroups, iconTotal), tally, dry);
    const atoms = await parseSharedAtoms();
    if (atoms.length === 0) throw new Error(`no shared enum atoms parsed from ${SHARED_SRC}`);
    await emit(join(OUT, 'vocabulary.md'), vocabularyPage(atoms), tally, dry);
    extrasNote = `, events.md, icons.md (${iconTotal} glyphs, ${iconGroups.length} groups), vocabulary.md (${atoms.length} atoms)`;
  }

  const orphans = await findOrphans(COMPONENTS_OUT, new Set(pages.map((p) => p.rel)));

  // Report.
  const mode = dry ? 'dry run — nothing written' : 'written';
  const groupCounts = GROUPS.map((g) => `${g.slug}:${grouped.get(g.slug).length}`).join(' ');
  console.log(`Rendered ${pages.length} component pages (${CATALOG_VERSION}) → ${COMPONENTS_OUT} [${mode}]`);
  console.log(`Groups: ${groupCounts}`);
  console.log(`Files: ${tally.created} created, ${tally.updated} updated, ${tally.unchanged} unchanged`);
  console.log(`Also: components/README.md, validation.md (${categories.length} failure categories)${extrasNote}`);
  if (groupRewrites.length > 0) console.log(`Group READMEs rewritten: ${groupRewrites.join(', ')}`);
  if (groupDrift.length > 0) {
    console.log(
      `Group READMEs with description drift (kept as-is; pass --refresh-groups to rewrite): ${groupDrift.join(', ')}`,
    );
  }
  if (orphans.length > 0) {
    console.log(`Orphan pages (no matching catalog component; not deleted): ${orphans.join(', ')}`);
  }
  if (introspectionGaps.length > 0) {
    console.log(`Introspection gaps (description-only fallback): ${introspectionGaps.join(', ')}`);
  } else {
    console.log('Introspection gaps: none — all prop schemas introspected.');
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
