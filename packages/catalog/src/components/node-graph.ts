/**
 * Frayme NodeGraph — a coordinate-free directed graph / flowchart / live pipeline
 * (Diagram-svg).
 *
 * The model authors STRUCTURE ONLY — { nodes:[{id,label,status?,progress?,sublabel?,
 * icon?,meta?,tone?,color?,group?}], edges:[{from,to,label?}] } — and the shared
 * DiagramLayout engine computes every pixel (deterministic Sugiyama-lite layered
 * layout). Per-node status + progress turn it into a LIVE execution / pipeline view;
 * multiSelect lets a user pick a set of nodes the agent can act on.
 *
 * POSTURE: STATELESS-seeded pure-view. Node hit-targets are HTML <button>s over the
 * SVG (focus rings need HTML, not SVG); per-node color is INLINE (safeColor). Single-
 * select by default; multiSelect toggles a bindable selection set.
 *
 * SECURITY: labels ESCAPED; the engine owns all geometry; nodes/edges capped
 * (120/240); per-node color inline-validated; progress clamped 0..100.
 *
 * Component: NodeGraph.
 */

import { z } from 'zod';
import { colorSchema } from './_shared.js';

const nodeSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  sublabel: z.string().nullable().describe('Optional secondary line under the node label (e.g. a step detail, owner, model, or count).'),
  icon: z.string().nullable().describe('Optional leading glyph name from the icon registry; unknown names render nothing.'),
  status: z.enum(['idle', 'running', 'done', 'error', 'blocked']).nullable().describe('Execution status → a status indicator + border tint: idle · running (spinner) · done (check) · error (alert) · blocked (clock).'),
  progress: z.number().nullable().describe('Progress 0..100 for a running node → a thin bar along the bottom of the node. Omit for none.'),
  meta: z.string().nullable().describe('Optional small right-aligned badge on the node (e.g. a duration "2.3s" or a count).'),
  tone: z.enum(['neutral', 'info', 'success', 'warning', 'critical']).nullable().describe('Border tone used when no status/color is set.'),
  color: colorSchema.describe('Explicit border color for this node (overrides the tone/status border).'),
  group: z.string().nullable().describe('Optional group key echoed in the select payload (for clustering by the host).'),
});

export const nodeGraphComponents = {
  NodeGraph: {
    props: z.object({
      nodes: z.array(nodeSchema).nullable().describe('The graph nodes { id, label?, status?, progress?, sublabel?, icon?, meta?, tone?, color?, group? }. Omit for a demo pipeline. Capped at 120.'),
      edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().nullable() })).nullable().describe('Directed edges { from, to, label? } referencing node ids. Self-edges + unknown ids are dropped; cycles are broken for layout. Capped at 240.'),
      direction: z.enum(['TB', 'LR']).nullable().describe('Layout flow direction: TB (top→bottom, the default) or LR (left→right).'),
      nodeShape: z.enum(['rounded', 'pill', 'rect']).nullable().describe('Shape of each node box: rounded, pill, or rect (default rounded).'),
      multiSelect: z.boolean().nullable().describe('Allow selecting a SET of nodes (default false — single-select). When true, clicking toggles a node in the selection and `select` carries the full set.'),
      selectedIds: z.array(z.string()).nullable().describe('Node ids selected initially (multi-select). Bind with { $bindState } so an external Button can read the current node selection from spec.state.'),
      showStatus: z.boolean().nullable().describe('Show the per-node status indicator + progress bar when a node has a status/progress (default true).'),
      showArrows: z.boolean().nullable().describe('Draw directional arrowheads at the target end of each edge (default `true`); set `false` for an undirected/plain-connector look.'),
      showEdgeLabels: z.boolean().nullable().describe('Render the label text on edges that have one (default true).'),
      nodeWidth: z.number().nullable().describe('Width of every node box in px (default `168`, clamped `64..300`); widen for longer labels or narrow for a compact graph.'),
      nodeHeight: z.number().nullable().describe('Node height in px (default auto — taller for status/sublabel nodes, clamped 32..140).'),
      accent: colorSchema.describe('Default node border + selection-ring + progress-bar color (default the primary token).'),
      lineColor: colorSchema.describe('Edge line + arrowhead color (default the border token).'),
      mutedColor: colorSchema.describe('Edge labels, sublabels + secondary text (default the muted-foreground token).'),
    }),
    description:
      'A directed graph / flowchart / live pipeline: author nodes + edges (structure only) and the engine computes a deterministic layered layout with routed connectors and arrowheads. Each node can carry a status (idle/running/done/error/blocked) with a progress bar, an icon, a sublabel and a meta badge — turning it into a live agent-execution view. Node hit-targets are focusable HTML buttons; single-select by default, or set multiSelect to pick a bindable set of nodes. Stateless-seeded, SSR-safe; click a node to emit `select`.',
    example: {
      direction: 'TB',
      multiSelect: false,
      nodes: [
        { id: 'ingest', label: 'Ingest data', sublabel: '1,204 rows', status: 'done', meta: '0.8s' },
        { id: 'clean', label: 'Clean & validate', status: 'done', meta: '1.2s' },
        { id: 'embed', label: 'Generate embeddings', sublabel: 'model: text-3', status: 'running', progress: 62 },
        { id: 'index', label: 'Build index', status: 'blocked' },
        { id: 'deploy', label: 'Deploy', status: 'idle' },
      ],
      edges: [
        { from: 'ingest', to: 'clean' },
        { from: 'clean', to: 'embed' },
        { from: 'embed', to: 'index' },
        { from: 'index', to: 'deploy' },
      ],
    },
    events: ['select'],
    eventsDoc: {
      select: 'A node was clicked. Single-select: params carry { id, label, value, index, group, status }. Multi-select (multiSelect=true): params carry { id, selected, selection (all selected ids), count, nodes (the selected {id,label,status}) }.',
    },
  },
};
