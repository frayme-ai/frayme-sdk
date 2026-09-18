/**
 * @frayme/api/tools — ONE tool definition for every agent framework.
 *
 * The schema is Zod v4, which implements Standard (JSON) Schema — so the same
 * object works in:
 *   - Vercel AI SDK 6:   tool({ ...composeToolDefinition, execute })
 *   - Mastra:            createTool({ ...composeToolDefinition, execute })
 *   - OpenAI Agents JS:  tool({ name, description, parameters: anthropicToolDefinitions()[0].input_schema, strict: false, execute })
 *                        (JSON Schema, parsed with composeInputSchema inside execute)
 *   - LangChain.js:      tool(execute, { name, description, schema: composeToolDefinition.inputSchema })
 *
 * Fields are authored as standard (optional) JSON Schema. OpenAI Structured
 * Outputs `strict:true` is NOT assumed (the open `data`/`params` maps are
 * incompatible with strict anyway) — a `toOpenAiStrict()` adapter can be added
 * if/when a strict consumer appears.
 *
 * WORKED EXAMPLES RIDE TWO CHANNELS. The prose examples inside
 * each `description` are the universal carrier — the only field every path
 * forwards (LangChain, OpenAI Agents, MCP hosts, non-Anthropic AI SDK
 * providers). The structured `composeInputExamples` / `actionInputExamples` are
 * ALSO attached by `createComposeTool` / `createActionTool` as the AI SDK core
 * `inputExamples` field: `@ai-sdk/anthropic` maps it to the Messages API's
 * `input_examples` (GA on the Messages API — no beta header needed; the SDK
 * still tags the request with `advanced-tool-use-2025-11-20`, which is
 * harmless — see vercel/ai anthropic-prepare-tools.ts), Mastra's
 * `createTool` carries it through, and every other provider ignores it (or folds
 * it into the description via `addToolInputExamplesMiddleware`).
 * `anthropicToolDefinitions()` hands raw `@anthropic-ai/sdk` users the same in
 * wire shape.
 */
import { z } from 'zod';
import type { Frayme } from '../client.js';
import type { ComposeRequest, ComposeResult } from '../api-types.js';
import { fitContinuation } from '../fit.js';
import { CANONICAL_EVENTS, EVENT_CONTRACT, CATALOG_COMPONENT_COUNT } from '@frayme/catalog';
import {
  COMPOSE_PROMPT_MIN_CHARS,
  COMPOSE_PROMPT_MAX_CHARS,
  COMPOSE_MIN_OPERATIONS,
  COMPOSE_MAX_OPERATIONS,
  CONTEXT_THEME_MAX_CHARS,
  CONTEXT_FRAMEWORK_HINT_MAX_CHARS,
  ACTION_NAME_MIN_CHARS,
  ACTION_NAME_MAX_CHARS,
  ACTION_ROLE_MAX_CHARS,
  ACTION_DESCRIPTION_MAX_CHARS,
  MAX_ACTIONS_PER_REQUEST,
  ACTION_REQUIRED_ITEMS_MAX,
  ACTION_PARAM_NAME_MAX_CHARS,
  COMPOSE_MODES,
} from '../limits.js';

/**
 * The verb vocabulary, rendered into the tool JSON itself so a host agent can
 * read the complete interaction contract with zero source reading. Derived
 * from `EVENT_CONTRACT` (the single machine-readable source in
 * `@frayme/catalog`) — drift-proof: add/change a verb there and this block,
 * and every consumer of it, updates automatically.
 *
 * One line per verb: `verb — description (params: key, key…)`.
 */
export const VERBS_BLOCK = CANONICAL_EVENTS.map((verb) => {
  const entry = EVENT_CONTRACT[verb];
  const keys = entry.payload.map((p) => p.key).join(', ');
  return `${verb} — ${entry.description}${keys ? ` (params: ${keys})` : ''}`;
}).join('\n');

export const composeInputSchema = z.object({
  prompt: z
    .string()
    .min(COMPOSE_PROMPT_MIN_CHARS)
    .max(COMPOSE_PROMPT_MAX_CHARS)
    .describe(
      'Natural-language description of the UI to generate, e.g. "A pricing page with three tiers and a monthly/annual toggle". Describe the layout and intent — pass factual values via `data` and interactions via `actions`, not buried in prose.',
    ),
  signals: z
    .object({
      data_shape: z
        .array(z.string())
        .optional()
        .describe(
          'What the content IS, one or more of: avatar, board, bracket, calendar, cards, chart, citations, code, diff, document, feed, filters, form, image, link-preview, list, map, plans, reasoning, table, thread, timeline, tree, video.',
        ),
      density: z
        .enum(['compact', 'standard', 'rich'])
        .optional()
        .describe('How much per screen. compact = terse scanning · standard · rich = generous detail and supporting copy.'),
      patterns: z
        .array(z.string())
        .optional()
        .describe(
          'Interaction furniture you want available: accordion, bulk-actions, collapsible, confirm-dialog, dialog, drawer, dropdown-menu, hover-card, multi-step, popover, row-actions, segmented-control, tabs, tooltip.',
        ),
      tone: z
        .enum(['neutral', 'branded'])
        .optional()
        .describe('neutral = product-default styling · branded = lean into the colour/voice the prompt describes.'),
      /* NO `theme` HERE. It was advertised on this object and accepted by the
         route, then dropped on the floor: the prompt serializer's `Signals:`
         line reads `data_shape`, `density`, `patterns`, `tone` off `signals` —
         and `theme` off `context`. `PromptSignals` has no `theme` field at all,
         so a host that set `signals.theme` was steering nothing and had no way
         to tell. Removed rather than wired, because `context.theme`
         below is the real dial, it already reaches the model on the same
         `Signals:` line, and a second path to one setting is two things to keep
         honest. Use `context.theme`. */
    })
    .optional()
    .describe(
      'THE PRIMARY STEERING DIAL. These values genuinely move the output; send the ones you are confident about and omit the rest (a partial set or none at all is a first-class call). Most valuable where the prompt alone is ambiguous: "a table of orders" describes both a compact 200-row scanning grid and a rich three-per-screen card list, and `density` is what separates them. A wrong signal steers worse than a missing one, so only assert what you know.',
    ),
  /* SIGNALS — the vocabulary above is exactly what the model reads off its
     `Signals:` line, not a wish-list. A partial `signals` object or none at all
     is a first-class call — send only what you actually know. */
  mode: z
    .enum(COMPOSE_MODES)
    .optional()
    .describe(
      'create (default) — a fresh UI · edit — modify the prior UI in place (pair with prior_spec) · continue_journey — the next step of a multi-step flow.',
    ),
  context: z
    .object({
      theme: z
        .string()
        .max(CONTEXT_THEME_MAX_CHARS)
        .optional()
        .describe(
          'THE theme dial — "light" or "dark". This is the only one: it rides the same `Signals:` line the model reads. (There is deliberately no `signals.theme`.) Omit to let the host decide.',
        ),
      framework_hint: z
        .string()
        .max(CONTEXT_FRAMEWORK_HINT_MAX_CHARS)
        .optional()
        .describe('Layout hint for the generator, e.g. "card-heavy" or "dashboard".'),
    })
    .optional(),
  max_operations: z
    .number()
    .int()
    .min(COMPOSE_MIN_OPERATIONS)
    .max(COMPOSE_MAX_OPERATIONS)
    .optional()
    .describe('Safety cap on the number of UI operations generated.'),
  data: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Factual content AND exact copy the UI must show VERBATIM — names, prices, items, counts, and any wording that must appear exactly as written (headings, sub-headings, section titles, disclaimers, button labels): pass them as keys like heading/subheading/disclaimer. These exact values render and are never invented or altered. ALWAYS INCLUDE THIS FIELD: pass every fact the UI must show, and pass {} (empty object) when the UI truly has no fixed content (e.g. a blank form) — and in that case also add one sentence to `prompt` like "do not invent sample records or placeholder facts; leave fields empty". Anything not present in `prompt` or `data` is the model\'s own invention. Display facts only: do NOT include synthetic ids or control flags (correlate via action names instead). Shape follows `signals.data_shape`: table/list → a `rows` array; chart → `series`/`points`; plans → a `plans` array; form → field seed values; a single entity in depth → the entity object.',
    ),
  actions: z
    .array(
      z.object({
        name: z
          .string()
          .min(ACTION_NAME_MIN_CHARS)
          .max(ACTION_NAME_MAX_CHARS)
          .describe(
            'Bound action name you will handle, e.g. "approveRefund". This exact name is returned to you when the user triggers the control.',
          ),
        /* `role` is on the action schema and mirrors `ActionDecl.role`
           (@frayme/catalog) and `ComposeAction.role` (the wire type); the
           server's OpenAPI advertises the same field (≤ 40 chars), and the
           platform binder prefers `decl.role` over the name-derived label when
           it injects a control. Keep all four in lockstep — the tool JSON is the
           one surface a host agent actually reads, and without a role reaching
           the binder, injected controls carry raw camelCase identifiers. */
        role: z
          .string()
          .max(ACTION_ROLE_MAX_CHARS)
          .optional()
          .describe(
            'Short human label for the control that fires this action, e.g. "approve" or "Save board". Frayme uses it wherever it places or injects the control, including the carrier button injected when your action is wired only to a non-press component. Without it an injected carrier button reads "Done" (or a name-derived label when the host is itself a press — a card press or link — or when two carriers on one screen would both read "Done"). Set `role` whenever the button should say what it does.',
          ),
        params: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'JSON Schema (object) for the data you want back; keys bind to live UI state and are returned (resolved) on the action. ALWAYS list the mandatory keys in a top-level "required" array — e.g. {"type":"object","properties":{...},"required":["customerName","mobileNumber"]}. Those fields are marked on the form AND genuinely block the submit control until filled. Omit it and the generator has to guess mandatory-ness from your prose, which is far less reliable.',
          ),
        /* `requiredItems` mirrors `ComposeAction.requiredItems` (the wire type)
           and the server's action schema, with the server's limits. Without it
           here, `z.object` would strip the field silently, and a host sending
           the flat params map could not mark a param mandatory through the tool. */
        requiredItems: z
          .array(z.string().max(ACTION_PARAM_NAME_MAX_CHARS))
          .max(ACTION_REQUIRED_ITEMS_MAX)
          .optional()
          .describe(
            'Names of the mandatory params, at action level. The same claim as a "required" array inside `params`, for when `params` is a flat map such as {"amount":{"description":"..."}}. Listed params are marked on the form and block the submit until filled.',
          ),
        /* THE ONE FIELD WHOSE DEFAULT THE RUNTIME ENFORCES (carrier gate,
           @frayme/runtime core/dynamic-gate.ts). Earlier copy described the
           default without naming the carrier set, and bindings drifted onto
           non-press hosts as a result. The set named here IS
           DEFAULT_DYNAMIC_ACTION_TYPES + the row/bulk-action affordance — keep
           them in lockstep. */
        live: z
          .boolean()
          .optional()
          .describe(
            'True = ambient wiring: the action fires on EVERY move/change, no button press (drags, sliders, board moves). Default false = only a press fires it — a Button, IconButton or Fab, a Confirmation verdict, a Form submit, a DataTable, or a row/bulk action button on a table or board; elsewhere the gesture is written to `state._ui.<elementId>.<verb>` and the next press carries it. Say so in the prompt too when you set this.',
          ),
        confirm: z
          .union([z.boolean(), z.record(z.string(), z.unknown())])
          .optional()
          .describe(
            'Gate the control behind a confirmation dialog. true for a plain confirm; an object for detail: {"tone":"danger","body":"This cannot be undone.","confirmLabel":"Delete","denyLabel":"Keep"}. Use for anything irreversible.',
          ),
        required: z
          .boolean()
          .optional()
          .describe(
            'If true, a button bound to this action is guaranteed present even when the model omits the action entirely (a wiring to a non-press component alone already gets a carrier button injected).',
          ),
        description: z
          .string()
          .max(ACTION_DESCRIPTION_MAX_CHARS)
          .optional()
          .describe('What this action means / what the user did — for your own handling.'),
      }),
    )
    .max(MAX_ACTIONS_PER_REQUEST)
    .optional()
    .describe(
      'DYNAMIC ACTIONS — callbacks that advance the task (submit, book, buy, send, confirm, delete, fetch more). Declare ONLY these. Only a press round-trips to you (a Button, a Confirmation verdict, a Form submit, a DataTable, or a row/bulk action on a table or board); a declared action on any other component stays LOCAL — the gesture lands in the UI state mirror and the next press carries it, unless `live:true`. NEVER declare local UI behaviors — sorting, filtering, searching data you supplied, pagination, tabs, toggles, selecting/highlighting, expanding details already in `data` — the UI wires those itself and you read them from the same mirror. Every declared action reaches you (Frayme injects a carrier button — labelled from `role`, else "Done" — when the UI wires it only to a non-press component and the page root can mount one); declare the ones you DO need on every call (undeclared ones come back unwired) and re-declare the still-relevant ones on re-renders.',
    ),
  // The prior UI to build on. Pair with `mode:'edit'` (modify in place) or
  // `mode:'continue_journey'` (next step) — this is the `spec` returned by an
  // earlier compose (server-validated again here). Omit for a fresh `create`.
  prior_spec: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'The previously generated json-render spec to modify or continue from. Pass the `spec` returned by an earlier compose, together with `mode:"edit"` or `mode:"continue_journey"`. Omit for a fresh create.',
    ),
  // BYOC — your own custom components for this request. Author each with
  // `defineFraymeComponent` (@frayme/catalog) and render them in your app via
  // `createCustomComponents`. The deep manifest schema is validated server-side;
  // the tool accepts the objects opaquely.
  custom_components: z
    .array(z.record(z.string(), z.unknown()))
    .max(20)
    .optional()
    .describe(
      `Inline custom-component manifests available ONLY for this request, in addition to the ${CATALOG_COMPONENT_COUNT}-component catalog. Each entry is the manifest object you pass to \`defineFraymeComponent\` — pass its \`.manifest\`, or the same plain object (name, description, constrained props, events ⊂ the 8 verbs, example). The model may emit these component types.`,
    ),
});

export type ComposeToolInput = z.infer<typeof composeInputSchema>;

/**
 * The compose result manifest (`outputSchema`) — what the agent gets back. The
 * `spec` is delivered out-of-band to the renderer; the agent uses `generation_id`
 * to correlate and reads `spec.actions` for the wired handlers to route via
 * `frayme_action`. Permissive (`.catchall`) so the full `ComposeResult` passes.
 */
export const composeOutputSchema = z
  .object({
    generation_id: z
      .string()
      .describe('Correlates this UI to the request — echo it back via frayme_action.'),
    model: z.string().describe('The model that produced the spec.'),
    spec: z
      .record(z.string(), z.unknown())
      .describe(
        'The validated json-render spec — render with @frayme/runtime, never show as text. `spec.actions` lists the wired action handlers.',
      ),
  })
  .catchall(z.unknown());

/**
 * Worked call examples embedded IN the tool description — the universal
 * carrier: every consumer path (Vercel AI SDK, Mastra, LangChain, OpenAI
 * Agents, MCP hosts) forwards `.description`, whereas the structured
 * `composeInputExamples` reach a model only on the paths that honour
 * `inputExamples` (see the module header). The five teach distinct calling
 * patterns (seeded rows + wired server actions; charts with no actions —
 * filters and toggles are local state; a composite multi-region page; the
 * carrier pattern — a board whose moves batch locally behind ONE role'd
 * button, and its `live:true` opt-out; the edit loop with `prior_spec`) and
 * are intentionally detailed: thin prompts produce thin UIs. All five are
 * composeInputSchema-valid and Example 5's `prior_spec` is catalog-valid
 * (asserted in the test suite). Each example's JSON is ONE line starting
 * `{"prompt"` — that is what the extractor in call-examples.test.ts keys on.
 */
export const COMPOSE_CALL_EXAMPLES = `EXAMPLES — real calls in the shape the model expects. Thin prompts produce thin UIs: state the business context, the regions you want in order, what each control actually does, and the tone. Four rules cause most failures: (1) every array you want repeated as rows, cards, options or chart series MUST be present in "data" — an unseeded repeat renders zero rows, and a footnote pointing at a category you never seeded renders nowhere; (2) put every fact in "data" — never expect the model to know or invent names, figures, dates or URLs, and seed cross-region figures from the same numbers so they reconcile; (3) declare "actions" ONLY for things that leave the page, with the exact param names your handler receives — filters, tabs, toggles, sorting and row selection are wired to local state automatically, and declaring a fake action produces a dead button; (4) only a press calls you back (a Button, a Confirmation, a Form submit, a DataTable, or a row/bulk action on a table or board) — a board, select, switch or slider gesture waits in "state" for the next press unless "live":true, and Frayme injects that button if the UI has none. Steer with "signals" first — {"data_shape":["table","filters"],"density":"compact","patterns":["row-actions"],"tone":"neutral"} — since that is what steers the model most directly; "density" alone is often the difference between a scanning grid and a card list. On each action: "params" is a JSON Schema object and its "required" array is what actually blocks the submit — always list the mandatory keys there rather than only describing them in the prompt; "required":true guarantees a button exists; "live":true fires the action on every move with no button press; "confirm" gates it behind a dialog ({"tone":"danger","body":"…"} for irreversible ones); "role" is the short human label of the control that fires the action ("approve", "Save board") and wins over the fallback label — name-derived, or "Done" on an injected carrier — wherever Frayme places or injects the control itself.

Example 1 — a working queue: real archetype, seeded rows, three wired server actions, and the ticked rows becoming the array param. Every move named in the prompt is declared, or its button would be dead.

{"prompt":"Shift console for the branch fraud desk clearing flagged card transactions - urgent, deal-with-it-now feel. One line of steer for whoever is on the desk, then three counters: flagged today, high-risk, on hold. A slicer (everything / high-risk only / still pending) that genuinely drops the table to the matching rows, with a caption naming the view, plus a density toggle. A short key above the grid explaining the risk tags and the on-hold marker. Then the grid: tick-to-select, showing reference, customer, amount, merchant, time, risk and status - whatever is ticked is the set every decision acts on. Below it three moves: approve behind a soft-cornered confirmation, hold for a customer callback, or block behind a hard-edged confirmation making clear the case passes to the fraud team. The instant a commit button is tapped it dims and flips to a past-tense label so it cannot fire twice.","signals":{"data_shape":["table","filters"],"density":"compact","patterns":["segmented-control","bulk-actions","confirm-dialog"],"tone":"neutral"},"data":{"queueName":"Cheltenham branch - flagged card queue","summary":{"flaggedToday":3,"highRisk":2,"onHold":1},"transactions":[{"ref":"TXN-88213","customer":"J. Okafor","amount":"£1,240.00","merchant":"Elektro Direkt GmbH","time":"08:42","risk":"High","status":"Pending"},{"ref":"TXN-88240","customer":"M. Whitfield","amount":"£389.50","merchant":"Zephyr Travel","time":"09:15","risk":"High","status":"On hold"},{"ref":"TXN-88257","customer":"A. Rahimi","amount":"£72.15","merchant":"Halcyon Fuel","time":"09:51","risk":"Medium","status":"Pending"}]},"actions":[{"name":"approveTransactions","required":true,"params":{"type":"object","properties":{"transactions":{"type":"array","description":"References of the ticked transactions."}}},"description":"Approve the ticked transactions on the server, releasing each payment so it clears for the customer."},{"name":"holdTransactions","required":true,"params":{"type":"object","properties":{"transactions":{"type":"array","description":"References of the ticked transactions."}}},"description":"Place the ticked transactions on hold pending a customer callback."},{"name":"blockTransactions","confirm":true,"required":true,"params":{"type":"object","properties":{"transactions":{"type":"array","description":"References of the ticked transactions."}}},"description":"Block the ticked transactions and freeze the card, moving each case to the fraud team."}]}

Example 2 — analytics. Every chart series is supplied per slice, all five categories are seeded so the monthly and quarter totals sum from the rows, brand colours are supplied as hex, and because nothing leaves the page there is NO actions key at all.

{"prompt":"Since January we have been trying to keep the joint account honest and I still could not tell you where the money goes. Lay our spending out by category: a ring chart carrying one month's split with that month's spend printed in the centre, and a horizontal bar chart beside it repeating the same figures, each category the same colour in both, using our app's category colours. A segmented picker for Jan, Feb, Mar and All redraws both charts and the tiles together; a second picker shows both charts, just the ring, or just the bars. Three tiles across the top: what we spent, how it compares with the month before, and the biggest category. A toggle to hide the legend, and a switch laying the same figures out as a plain table, every category against every month. Footnote the March Misc spike when March or the quarter is on screen. Read-only - no downloads, no saved views.","data":{"currency":"GBP","categories":["Supermarket","Restaurants","Transport","Streaming","Misc"],"categoryColors":{"Supermarket":"#2E7D32","Restaurants":"#E65100","Transport":"#1565C0","Streaming":"#6A1B9A","Misc":"#546E7A"},"months":{"jan":{"label":"January","total":1154,"values":[534,296,182,54,88],"vsPrev":null,"top":"Supermarket"},"feb":{"label":"February","total":1191,"values":[548,318,186,54,85],"vsPrev":"+£37","top":"Supermarket"},"mar":{"label":"March","total":1762,"values":[566,312,190,54,640],"vsPrev":"+£571","top":"Supermarket"}},"quarter":{"label":"All","total":4107,"values":[1648,926,558,162,813],"top":"Supermarket"},"outlierNote":"Misc jumps in March: the annual home-insurance premium went out as one lump."}}

Example 3 — a composite multi-region page. Staged commit: the sliders stay local, one confirmation-gated apply pushes every ceiling at once, and the single array param survives a bay being added. The bay draws sum to the live load, so the dial, the per-bay rows and the headroom all reconcile.

{"prompt":"I run a small EV forecourt on one 400-amp service and on busy evenings the combined draw creeps toward that ceiling. Build an operator panel for the wall tablet: total current now against the 400-amp limit on a dial with warning and critical thresholds, plus headroom left, cars charging, and energy delivered today. Under it a line per bay showing draw against the ceiling I have set on it - a bar for how hard it is running, remaining amps, and a flag on any bay crowding its cap - with a toggle to hide idle bays. Then the part I need: a throttle slider per bay, and one apply control that pushes every new ceiling to the site controller at once. Nothing changes on the forecourt until I press apply, and make me tick a confirmation that I have checked the totals against the service limit before apply goes live. Warn me if my ceilings would still let the total run past the limit.","signals":{"data_shape":["chart","list"],"density":"rich","patterns":["confirm-dialog"],"tone":"neutral"},"data":{"site":"Millbrook Forecourt","mainLimitA":400,"liveLoadA":356,"headroomA":44,"sessionsNow":5,"energyTodayKwh":512,"bays":[{"id":"A1","drawA":98,"capA":100,"nearCap":true,"status":"Charging"},{"id":"A2","drawA":74,"capA":100,"nearCap":false,"status":"Charging"},{"id":"A3","drawA":62,"capA":80,"nearCap":false,"status":"Charging"},{"id":"B1","drawA":66,"capA":80,"nearCap":false,"status":"Charging"},{"id":"B2","drawA":0,"capA":80,"nearCap":false,"status":"Idle"},{"id":"B3","drawA":56,"capA":60,"nearCap":true,"status":"Charging"}]},"actions":[{"name":"applyThrottles","confirm":true,"required":true,"params":{"type":"object","properties":{"bays":{"type":"array","description":"One entry per bay: its id and the new amp ceiling set on the slider."}}},"description":"Push all new per-bay amp ceilings to the site controller in one commit, after the operator ticked the totals confirmation."}]}

Example 4 — the carrier pattern: a board plus ONE button. Card moves are local — each gesture is recorded into UI state (the runtime mirrors it at state._ui.<elementId>.<verb>, and the board's bound "board" prop mirrors the live lane-by-lane arrangement) and nothing leaves the page until the button is pressed, which carries all of it at once. Only a press ever calls you back; the single declared action names that button in "role" and asks for the batched arrangement as its param — no action is declared for the moves themselves.

{"prompt":"Job board for a six-person joinery workshop - the foreman re-plans the day on it each morning, so calm and legible from across the room. One line at the top naming the day and how many jobs are live, then the board: four lanes in order - Queued, Cutting, Assembly, Ready - one card per job showing the job number and piece, the customer, and the due date, with a chip on anything due today. Cards move lane to lane with the card's own move arrows, and every move stays on the board: nothing reaches the shop-floor screens until the foreman presses the one button under the board, Save today's plan, which sends the whole lane-by-lane arrangement at once. Jobs in Ready are locked in their lane. A small caption under the board saying moves are held until the plan is saved.","signals":{"data_shape":["board","cards"],"density":"compact","tone":"neutral"},"data":{"workshop":"Hollins Lane Joinery","day":"Thursday","liveJobs":5,"columns":[{"title":"Queued","cards":[{"id":"J-2231","title":"J-2231 · Oak dining table","customer":"Mrs Achebe","due":"Mon"},{"id":"J-2234","title":"J-2234 · Alcove shelving","customer":"Ferris & Co","due":"Next Fri"}]},{"title":"Cutting","cards":[{"id":"J-2229","title":"J-2229 · Sash window pair","customer":"Mr Lindqvist","due":"Today"}]},{"title":"Assembly","cards":[{"id":"J-2226","title":"J-2226 · Wardrobe carcass","customer":"Bramley Lettings","due":"Tomorrow"}]},{"title":"Ready","cards":[{"id":"J-2219","title":"J-2219 · Garden gate","customer":"Mr Patel","due":"Collected Fri","locked":true}]}],"heldNote":"Moves are held on this board until you save today's plan."},"actions":[{"name":"saveDayPlan","role":"Save today's plan","required":true,"params":{"type":"object","properties":{"board":{"type":"array","description":"The whole board at press time, one entry per lane in order: its title and its cards in order - every move since the last save, batched."}},"required":["board"]},"description":"Push the lane-by-lane arrangement to the shop-floor screens in one commit; nothing changes on the floor until this is pressed."}]}

What arrives on press — one DynamicActionEvent: the arrangement resolved into the param you named, and in "state" the same arrangement plus the latest gesture per verb under _ui:
{"action":"saveDayPlan","event":"commit","element_id":"savePlanBtn","label":"Save today's plan","params":{"board":[{"title":"Queued","cards":[…]},{"title":"Cutting","cards":[…]},{"title":"Assembly","cards":[…]},{"title":"Ready","cards":[…]}]},"state":{"board":[…the same four lanes…],"_ui":{"jobBoard":{"move":{"card":"J-2229 · Sash window pair","fromColumn":"Cutting","toColumn":"Assembly","fromIndex":0,"toIndex":1}}}},"generation_id":"gen_…"}
_ui holds the LATEST gesture per verb, not a replay, and a press never clears it — an entry is what the user last did, not what changed since you were last called — so read the result from the param or state.board, never by summing moves.
Same board, no button — the explicit opt-out is "live":true on the action, and the prompt says so ("every move reaches the floor screens the instant it happens, no save button"): "actions":[{"name":"moveJob","live":true,"required":true,"params":{"type":"object","properties":{"card":{"type":"string"},"fromColumn":{"type":"string"},"toColumn":{"type":"string"}},"required":["card","toColumn"]}}]
Now every arrow press is its own round-trip carrying that one move, and nothing is batched.

Example 5 — the edit loop: "mode":"edit" plus "prior_spec" (the spec an earlier compose returned, passed back verbatim) and a prompt that changes ONE region and says what stays. Facts for the changed region go in "data"; everything untouched is already in prior_spec. Re-declare every action that is still relevant — an action left out of an edit comes back unwired — and the new picker is local: its choice rides on the Approve press as the "terms" param, and "required":["terms"] is what actually holds that button until terms are chosen.

{"prompt":"Same quote review page, one change. Keep the header, the line-item table and both buttons exactly as they are. Replace the two-tile totals strip with three tiles - subtotal, VAT at 20%, total due - and add a payment-terms picker under it: Net 14, Net 30 or Net 60, nothing preselected. The picker is local, no round trip: its choice rides along when Approve quote is pressed, which stays held until terms are chosen.","mode":"edit","signals":{"data_shape":["table","form"],"density":"standard"},"data":{"totals":{"subtotal":"£18,400.00","vat":"£3,680.00","totalDue":"£22,080.00"},"paymentTerms":["Net 14","Net 30","Net 60"]},"prior_spec":{"root":"page","state":{"quoteId":"Q-0418"},"elements":{"page":{"type":"Stack","props":{},"children":["hdr","totals","lines","btns"]},"hdr":{"type":"PageHeader","props":{"eyebrow":"Marsden Masonry Ltd","title":"Q-0418 · Brickwork, plots 4-9"}},"totals":{"type":"Stack","props":{"direction":"horizontal","gap":"md"},"children":["sub","vat"]},"sub":{"type":"Stat","props":{"label":"Subtotal","value":"£18,400.00"}},"vat":{"type":"Stat","props":{"label":"VAT (20%)","value":"£3,680.00"}},"lines":{"type":"DataTable","props":{"columns":[{"key":"item","label":"Item"},{"key":"total","label":"Total","align":"end","format":"currency"}],"rows":[{"item":"Facing brick","total":12600},{"item":"Blockwork","total":4300},{"item":"Lintels","total":1500}]}},"btns":{"type":"Stack","props":{"direction":"horizontal","gap":"sm"},"children":["approve","revise"]},"approve":{"type":"Button","props":{"label":"Approve quote","variant":"primary"},"on":{"commit":{"action":"approveQuote","params":{"quoteId":{"$state":"/quoteId"}}}}},"revise":{"type":"Button","props":{"label":"Request revision","variant":"outline"},"on":{"commit":{"action":"requestRevision","params":{"quoteId":{"$state":"/quoteId"}}}}}}},"actions":[{"name":"approveQuote","role":"Approve quote","required":true,"params":{"type":"object","properties":{"quoteId":{"type":"string"},"terms":{"type":"string","description":"The payment terms chosen in the picker."}},"required":["quoteId","terms"]},"description":"Approve the quote on the chosen terms and raise the purchase order."},{"name":"requestRevision","role":"Request revision","required":true,"params":{"type":"object","properties":{"quoteId":{"type":"string"}},"required":["quoteId"]},"description":"Send the quote back for revision."}]}`;

export const composeToolDefinition = {
  name: 'frayme_compose',
  description:
    'Generate a live, interactive UI from a natural-language description, returned as a validated json-render spec the host renders with @frayme/runtime. Call this whenever an interface serves the user better than prose — a form, dashboard, pricing/comparison table, list, detail view, settings panel, wizard, confirmation, or empty state. Frayme\'s catalog runs deep — beyond those basics it also renders data & CRUD tables, calendars & schedulers, kanban boards, maps, file & media viewers, signature capture, and rich-text/block editors — so reach for it whenever a live interface beats a wall of text. THE INTERACTION MODEL: the UI is app-like BY DEFAULT — local behaviors (sorting, filtering, searching supplied data, tabs, toggles, pagination, expanding details) wire themselves client-side with zero round-trips, and every meaningful interaction is mirrored into UI state you can read on later events, so you stay aware without being called. Declare in `actions` ONLY the dynamic actions — callbacks that must reach you to advance the task (submit, book, buy, send, confirm, delete, fetch more). Only a PRESS round-trips: a Button, IconButton or Fab, a Confirmation verdict, a Form submit, a DataTable, or a row/bulk action button on a table or board. Every other gesture — a drag, pick, toggle, slider move or keystroke — stays local, lands at `state._ui.<elementId>.<verb>` (bound props — a board\'s `board` snapshot when the spec binds it — mirror live too) and rides in the next press\'s `state`, unless the action sets `live:true`; if your action is wired only to a non-press component, Frayme injects a carrier button for it (labelled from `role`, else "Done"). ALWAYS pass `data`: every fact the UI must show goes there and renders verbatim — anything not in `prompt` or `data` is model-invented, so for a content-free UI pass {} and say in the prompt that no sample content should be invented; when live real-world facts are needed, fetch them first and pass them in `data` (with sources when attribution helps). Steer layout with `signals` ONLY where confident; omit the ones you are unsure of. Output is server-validated: you get a guaranteed-renderable, action-wired spec or a typed error — never malformed UI.\n\n' +
    'What comes back: a validated json-render `spec` (hand to your renderer, never show as text) plus `spec.actions` — the handler map for every action you declared — and a `generation_id` correlating this UI to the request. When the user presses a declared control, it flows back to you as a DynamicActionEvent naming the control (`element_id`, its `label` — absent for a Form submit, whose `element_id` is the Form — and your `description`) and carrying under `state._ui` the latest gesture per verb, never cleared by a press (an entry is what the user last did, not what changed since you were last called — read the result from the declared param or bound state); call `frayme_action` with it to continue the journey. The event verbs it can carry are listed on `frayme_action`\'s description.\n\n' +
    'Capabilities worth asking for in the prompt: PERMISSION SCOPING — say what the end user may change ("existing bookings stay fixed", "staff can add but not edit") and pre-existing/locked content renders immutable (add-only tables, locked uploads/tags/rows/cards/events; the UI enforces UX-level, you still re-validate every intent). CONFIRM GATING — name an action as irreversible and Frayme gates its control with a scenario-true confirm dialog before it fires. LIVE ACTIONS — set an action\'s `live` to true when a move/adjustment should reach you instantly with no button press (drags, sliders, board moves); otherwise the gesture stays local under `state._ui` and the next press carries it. LOCAL VIEW CONCERNS — searching/filtering/sorting data you supplied happens client-side with zero round-trips; only ask for a server-backed search/sort/page action when the data outgrows the payload (say so: "the archive is tens of thousands of records"). REQUIRED FIELDS — list them in the action\'s `params.required` array and they are marked on the form AND genuinely block the submit until filled; naming them only in prose is far less reliable. CRUD TABLES — ask for add/edit/delete rows and the table ships a working inline editor with optimistic updates riding your declared actions.' +
    '\n\n' + COMPOSE_CALL_EXAMPLES,
  inputSchema: composeInputSchema,
  outputSchema: composeOutputSchema,
} as const;

/**
 * Structured input examples — schema-valid calls that teach the contract across
 * common archetypes, the edit mode, and the carrier pattern. Attached by
 * `createComposeTool` as the AI SDK core `inputExamples` field (`[{ input }]`),
 * which `@ai-sdk/anthropic` sends as the Messages API's `input_examples` and
 * Mastra's `createTool` carries through; LangChain, OpenAI Agents and MCP have
 * no equivalent field, so for them the prose examples in the description are
 * the carrier. Raw `@anthropic-ai/sdk` users take `anthropicToolDefinitions()`.
 * The Anthropic API returns 400 on an example that fails `input_schema`, so
 * every entry is asserted schema-valid in the test suite — and every
 * `prior_spec` catalog-valid, because the route validates it at the trust
 * boundary and answers 400 (a `PricingTier`, never a catalog type, once sat in
 * the edit example). Anthropic states no count limit; the cost is the
 * ~100–200 tokens a complex example adds on the paths that carry the field,
 * paid inside the cached `tools` prefix — trim HERE first if that budget bites,
 * since the description prose is the carrier every path forwards.
 */
export const composeInputExamples: ReadonlyArray<ComposeToolInput> = [
  {
    prompt:
      'A signup form: full name, work email, and a "Create account" button. Blank intake form — do not invent sample values.',
    // `data: {}` says "this UI has no fixed content" — required on a blank form, or the
    // model has to decide for itself whether to seed examples.
    data: {},
    signals: { data_shape: ['form'], density: 'compact', tone: 'neutral' },
    actions: [
      {
        name: 'createAccount',
        // The prompt names the button verbatim; `role` carries that exact label to
        // wherever Frayme places or injects the control, instead of the
        // name-derived "Create account" guess (identical here, not in general).
        role: 'Create account',
        required: true,
        params: {
          type: 'object',
          properties: { name: { type: 'string' }, email: { type: 'string' } },
          // THE IMPORTANT LINE. These fields are marked on the form and genuinely block
          // the submit until filled. Without it the generator must infer mandatory-ness
          // from the prose, which is where "the button is disabled but nothing says why"
          // comes from.
          required: ['name', 'email'],
        },
        description: 'User submitted the signup form.',
      },
    ],
  },
  {
    prompt: 'Compare our three plans; mark Pro as recommended; a Choose button on each.',
    data: {
      plans: [
        { name: 'Starter', price: '£29/mo' },
        { name: 'Pro', price: '£99/mo', recommended: true },
        { name: 'Scale', price: '£299/mo' },
      ],
    },
    signals: { data_shape: ['plans', 'cards'], density: 'standard', tone: 'branded' },
    actions: [
      {
        name: 'choosePlan',
        required: true,
        params: { type: 'object', properties: { plan: { type: 'string' } }, required: ['plan'] },
        description: 'User chose a plan; `plan` is the chosen plan name.',
      },
    ],
  },
  {
    prompt: 'Mark Pro as selected and add a checkout summary; keep the rest.',
    mode: 'edit',
    // edit mode goes with prior_spec — the `spec` returned by the previous compose.
    // Every type in it must be catalog-valid: the route runs validateSpec over
    // prior_spec at the trust boundary and answers 400 otherwise (PlanCard is the
    // single-plan card; there is no `PricingTier` type). tool-contract.test.ts
    // runs the catalog gate over every prior_spec here.
    prior_spec: {
      root: 'plans',
      elements: {
        plans: { type: 'Card', props: { title: 'Choose a plan' }, children: ['pro'] },
        pro: { type: 'PlanCard', props: { name: 'Pro', price: '£99', period: '/mo', ctaLabel: 'Choose Pro' } },
      },
    },
    actions: [{ name: 'confirmCheckout', required: true, description: 'User confirmed checkout.' }],
  },
  {
    prompt: 'A dashboard summarizing this quarter\'s revenue by product line.',
    data: {
      series: [
        { label: 'Platform', value: 182000 },
        { label: 'API', value: 94000 },
        { label: 'Services', value: 31000 },
      ],
    },
  },
  {
    // The boundary in action: the supplied rows sort/filter
    // LOCALLY — no action declared for it. The only DYNAMIC action is the one
    // that must reach the agent (escalation). A server-backed sort is declared
    // only when the data outgrows the payload — and the prompt says so.
    prompt:
      'A table of the open support tickets, sortable and filterable. Escalating a ticket notifies the on-call engineer.',
    data: {
      rows: [
        { id: 'TCK-101', subject: 'Login fails on SSO', priority: 'High', status: 'Open' },
        { id: 'TCK-102', subject: 'Export CSV is truncated', priority: 'Medium', status: 'Open' },
        { id: 'TCK-103', subject: 'Typo in invoice email', priority: 'Low', status: 'Open' },
      ],
    },
    actions: [
      {
        name: 'escalateTicket',
        params: { type: 'object', properties: { id: { type: 'string' } } },
        description: 'User escalated a ticket to the on-call engineer — page them and update the record.',
      },
    ],
  },
  {
    // Permission scoping: prompt language ("existing bookings stay fixed") maps to
    // lock channels — prior content renders immutable, new entries stay possible.
    prompt:
      'A studio booking calendar for next week. Existing confirmed bookings stay fixed — visitors can only add new slots, never move or edit what\'s already there.',
    data: {
      bookings: [
        { title: 'Ceramics — Mia R.', start: '2026-07-20T10:00', end: '2026-07-20T12:00', confirmed: true },
        { title: 'Life drawing', start: '2026-07-21T18:00', end: '2026-07-21T20:00', confirmed: true },
      ],
    },
    actions: [
      {
        name: 'requestBooking',
        required: true,
        params: {
          type: 'object',
          properties: { title: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' } },
          required: ['title', 'start', 'end'],
        },
        description: 'Visitor requested a new booking slot; existing bookings are locked and cannot be changed client-side.',
      },
    ],
  },
  {
    // Confirm gating: an irreversible action named as such gets a scenario-true
    // confirm dialog on its control before it ever fires.
    prompt:
      'The pending invoice INV-204 for Harlow & Finch, with a Void button — voiding is permanent and kills their signing link, so ask before it fires.',
    data: { invoice: { id: 'INV-204', customer: 'Harlow & Finch', amount: '£1,840.00', status: 'Pending signature' } },
    actions: [
      {
        name: 'voidInvoice',
        required: true,
        // The gate is DECLARED, not inferred from the prose. An object rather than `true`
        // so the dialog says something scenario-true instead of "Are you sure?".
        confirm: {
          tone: 'danger',
          body: 'Voiding INV-204 is permanent and kills the customer signing link.',
          confirmLabel: 'Void invoice',
          denyLabel: 'Keep it',
        },
        params: { type: 'object', properties: { invoiceId: { type: 'string' } }, required: ['invoiceId'] },
        description: 'User confirmed voiding the invoice — irreversible.',
      },
    ],
  },
  {
    // Live actions: `live: true` grants direct ambient wiring — each move reaches
    // you instantly, no save step (otherwise drags stay local until a submit).
    prompt:
      'A dispatch board for today\'s deliveries — queued, en route, delivered. Every card move must reach the dispatcher immediately, no save button.',
    signals: { data_shape: ['board', 'cards'], density: 'compact', patterns: ['row-actions'] },
    data: {
      columns: [
        { title: 'Queued', cards: [{ title: '#D-114 — 32 Alder Row' }, { title: '#D-115 — Unit 4, Peck Lane' }] },
        { title: 'En route', cards: [{ title: '#D-112 — 9 Fern Court' }] },
        { title: 'Delivered', cards: [{ title: '#D-110 — 18 Mill Walk' }] },
      ],
    },
    actions: [
      {
        name: 'routeDelivery',
        required: true,
        // `live: true` is what makes a board move reach you the instant it happens. Without
        // it the drag stays local and waits for the carrier button Frayme injects.
        live: true,
        params: {
          type: 'object',
          properties: { card: { type: 'string' }, to: { type: 'string' } },
          required: ['card', 'to'],
        },
        description: 'Fires on every card move, instantly — no button press.',
      },
    ],
  },
  {
    // The CARRIER pattern — the default the dispatch board above opts out of.
    // Moves stay local (the runtime mirrors each at state._ui.<boardId>.move —
    // latest per verb, never cleared by a press — and the board's bound `board`
    // snapshot mirrors live when the spec binds it); no action is declared for them. ONE
    // role'd button carries the whole arrangement on press. Only a press
    // round-trips; everything else batches behind it.
    prompt:
      'A sprint board — To do, In progress, Done — where the team drags cards between columns, and one button under it, Save sprint, that sends the whole arrangement at once. Moves stay on the board until it is pressed.',
    signals: { data_shape: ['board', 'cards'], density: 'compact' },
    data: {
      columns: [
        { title: 'To do', cards: [{ title: 'SB-12 — Onboarding email copy' }, { title: 'SB-15 — Pricing page refresh' }] },
        { title: 'In progress', cards: [{ title: 'SB-9 — Invoice PDF layout' }] },
        { title: 'Done', cards: [{ title: 'SB-4 — Password reset flow' }] },
      ],
    },
    actions: [
      {
        name: 'saveSprint',
        // `role` names the carrier button — the label it wears wherever Frayme
        // places or injects it. `live` stays unset: the moves batch locally.
        role: 'Save sprint',
        required: true,
        params: {
          type: 'object',
          properties: {
            columns: { type: 'array', description: 'The board at press time — one entry per column with its cards in order.' },
          },
          required: ['columns'],
        },
        description: 'Commit the lane-by-lane arrangement in one press; nothing is saved until then.',
      },
    ],
  },
];

/**
 * Structured input examples for `frayme_action`: the event forwarded verbatim,
 * AND the next screen named. Both examples carry `prompt`, `data` and `actions`
 * on purpose, because the next screen is composed fresh: an example that
 * forwarded only the event would teach that a press alone is enough, and the
 * screen would come back without the values the user just entered.
 *
 * Attached by `createActionTool` as `inputExamples`; same channels and the same
 * schema-valid guarantee as `composeInputExamples`.
 */
export const actionInputExamples: ReadonlyArray<ActionToolInput> = [
  {
    action: 'choosePlan',
    event: 'commit',
    params: { plan: 'Pro', label: 'Choose Pro' },
    element_id: 'choosePro',
    label: 'Choose Pro',
    generation_id: 'gen_abc123',
    // The press, described. This is the only channel that carries it.
    prompt: 'The user chose the Pro plan. Show the checkout summary for it.',
    // The value the user picked, named again because the next screen is fresh.
    // The control's own label is not a fact, so it stays out.
    data: { plan: 'Pro', price: '29 per month', billing: 'Monthly' },
    // FORWARD actions only. `choosePlan` is not re-declared: the user is past it.
    actions: [
      { name: 'confirmCheckout', role: 'Pay and start the plan' },
      { name: 'changePlan', role: 'Go back to the plan list' },
    ],
  },
  {
    // A row action on a table: `element_id` is the table, `label` the row-action
    // entry's label. The sort the user clicked earlier never called the agent, it
    // sits in the `_ui` mirror, nested element then verb then the verb's payload
    // keys (`sortBy`/`sortDir` per EVENT_CONTRACT), latest per verb. Forward it
    // verbatim as here; the tool reads it and sends none of it, so whatever the
    // next screen must show is named in `data`.
    action: 'escalateTicket',
    event: 'commit',
    params: { id: 'TCK-101' },
    element_id: 'tickets',
    label: 'Escalate',
    state: { _ui: { tickets: { sort: { sortBy: 'priority', sortDir: 'desc' } } } },
    generation_id: 'gen_def456',
    prompt: 'The user escalated ticket TCK-101. Confirm the escalation and say what happens next.',
    data: { id: 'TCK-101', escalatedTo: 'Tier 2', responseTarget: '4 hours' },
    actions: [{ name: 'backToQueue', role: 'Return to the ticket queue' }],
  },
];

/**
 * Bind the tool to a configured client. The execute function performs a
 * non-streaming compose and returns the full validated result — deliver the
 * `spec` to your front-end out-of-band (e.g. AI SDK data parts), not as
 * model-visible text.
 *
 * `inputExamples` is the Vercel AI SDK / Mastra CORE tool field (`ai` ≥ 6,
 * `@ai-sdk/provider-utils` `Tool.inputExamples: Array<{ input }>`) — NOT a
 * `providerOptions.anthropic.*` key (none exists). `@ai-sdk/anthropic` maps it
 * to `input_examples` on the wire; other providers ignore it or fold it into
 * the description with `addToolInputExamplesMiddleware`.
 */
export function createComposeTool(client: Frayme): typeof composeToolDefinition & {
  inputExamples: Array<{ input: ComposeToolInput }>;
  execute: (input: ComposeToolInput) => Promise<ComposeResult>;
} {
  return {
    ...composeToolDefinition,
    inputExamples: composeInputExamples.map((input) => ({ input })),
    // The tool schema types prior_spec as an opaque object (agents pass back a
    // returned spec); at the client boundary it is a full json-render Spec.
    execute: (input: ComposeToolInput) =>
      client.compose.create({ ...input, stream: false } as ComposeRequest & { stream?: false }),
  };
}

/**
 * Round-trip input — the user fired an action on a prior compose's UI. Mirrors the
 * runtime's enriched `DynamicActionEvent`, so forward it straight from
 * `createDynamicActionForwarder({ onAction })`. `prompt` defaults to a
 * continue-the-journey instruction for the action.
 */
export const actionInputSchema = z.object({
  action: z
    .string()
    .min(ACTION_NAME_MIN_CHARS)
    .max(ACTION_NAME_MAX_CHARS)
    .describe('The bound action name the user fired (from a prior frayme_compose actions contract).'),
  event: z
    .string()
    .max(40)
    .optional()
    .describe('The canonical event verb that fired: commit/select/change/dismiss/search/sort/page/move.'),
  params: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Resolved params — the live UI-state values at fire time.'),
  state: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Full live state snapshot — what the user entered; preserved across the recompose.'),
  element_id: z
    .string()
    .max(120)
    .optional()
    .describe(
      'The spec id of the control that fired — the button, or the table/board whose row/bulk action was pressed (absent only for programmatic dispatches).',
    ),
  /* ACCEPTED, NOT FORWARDED. The runtime's DynamicActionEvent
     gained `label` (the pressed control's label, verbatim) and `description`
     (the host's own words for the action) so the host can head a thread card
     with them. The tool says "forward the event VERBATIM", and `z.object` strips
     unknown keys SILENTLY — the exact shape of the old `role` gap — so the two
     fields are declared here rather than dropped without a trace. Nothing of the
     event is sent to the server at all now (see the tool's execute), so these two
     are in good company: they are read, used for the thread card, and left in the
     browser.

     UNBOUNDED. An earlier cut capped `label` at 200 and
     `description` at ACTION_DESCRIPTION_MAX_CHARS, but the runtime bounds
     neither — `resolveControlLabel` returns the pressed control's label
     VERBATIM and `resolveActionDescription` reads the host's `actionContract`
     prose with no length cap — and the AI SDK / Mastra validate `inputSchema`
     BEFORE `execute`. A cap here was therefore a rejection path for event
     content the tool itself asks the host to forward verbatim, on two fields it
     does not even send. NEVER THROW on event content: no `.max()`. */
  label: z
    .string()
    .optional()
    .describe('The label of the control the user pressed, verbatim (absent for a Form submit, whose element_id is the Form) — for your own thread card; not sent to the server.'),
  description: z
    .string()
    .optional()
    .describe('What the action does, in your own words (from your declared action) — for your own thread card; not sent to the server.'),
  generation_id: z
    .string()
    .max(120)
    .optional()
    .describe('The generation_id of the UI the user acted on (correlation).'),
  prompt: z
    .string()
    .max(COMPOSE_PROMPT_MAX_CHARS)
    .optional()
    .describe(
      'What the NEXT screen should show. This is the ONLY place the press is described to the composer, so say what just happened and what comes next. Default: a plain line naming the pressed control.',
    ),
  /* THE NEXT SCREEN'S INPUTS, AND THEY ARE THE WHOLE REQUEST. A press composes a
     FRESH screen, so the agent needs the same three dials it has on
     frayme_compose: the facts to show, the controls to wire, and the steering.
     The schemas are the compose tool's own (one set of limits), re-described for
     this call. Nothing of the event itself is sent, so a value the user typed
     reaches the composer only if it is named in `data`. */
  data: composeInputSchema.shape.data.describe(
    'Facts the NEXT screen must show verbatim, exactly as `data` on frayme_compose: the values the user just entered, the saved record, the new total, the confirmation number, plus anything else the next screen displays. THE NEXT SCREEN IS COMPOSED FRESH, so a value the user typed that is not here will not appear on it. Facts only: a key the composer does not use is drawn on the screen as a stray detail, so what was pressed belongs in `prompt`, never here.',
  ),
  actions: composeInputSchema.shape.actions.describe(
    'Controls the NEXT screen needs, exactly as `actions` on frayme_compose. Declare the actions that lead FORWARD from here, since an action left out comes back unwired. Do NOT re-declare the control just pressed with required params: a declared action that nothing binds makes the server add a button plus a blank input per param, putting back the form the next screen was meant to replace.',
  ),
  signals: composeInputSchema.shape.signals.describe(
    'Steering for the NEXT screen, exactly as `signals` on frayme_compose. Send only the values you are confident about.',
  ),
});

export type ActionToolInput = z.infer<typeof actionInputSchema>;

/**
 * Worked round-trip examples embedded IN the `frayme_action` description — two
 * events exactly as the host receives them (a Button press carrying batched
 * board moves — the return half of COMPOSE_CALL_EXAMPLES' Example 4 — and a
 * DataTable row action), forwarded verbatim with a steering `prompt`. Same
 * universal-carrier reasoning as COMPOSE_CALL_EXAMPLES; each JSON is ONE line
 * starting `{"action"` for the extractor in the test suite.
 */
export const ACTION_CALL_EXAMPLES = `EXAMPLES — two events exactly as the host receives them, forwarded verbatim; the only field you add is "prompt".

Example 1 — a Button press carrying batched board moves. The user moved cards for a while; nothing reached you until the Save button. "params" holds the arrangement resolved into the param the compose declared, "state" holds the same arrangement plus the latest gesture per verb under _ui (two cards moved, the mirror shows only the last), "element_id" names the button that fired and "label" is what it said. Forward it as-is; the prompt steers the next screen.

{"action":"saveDayPlan","event":"commit","element_id":"savePlanBtn","label":"Save today's plan","description":"Push the lane-by-lane arrangement to the shop-floor screens in one commit; nothing changes on the floor until this is pressed.","params":{"board":[{"title":"Queued","cards":[{"id":"J-2234","title":"J-2234 · Alcove shelving"}]},{"title":"Cutting","cards":[{"id":"J-2231","title":"J-2231 · Oak dining table"}]},{"title":"Assembly","cards":[{"id":"J-2226","title":"J-2226 · Wardrobe carcass"},{"id":"J-2229","title":"J-2229 · Sash window pair"}]},{"title":"Ready","cards":[{"id":"J-2219","title":"J-2219 · Garden gate","locked":true}]}]},"state":{"board":[{"title":"Queued","cards":[{"id":"J-2234","title":"J-2234 · Alcove shelving"}]},{"title":"Cutting","cards":[{"id":"J-2231","title":"J-2231 · Oak dining table"}]},{"title":"Assembly","cards":[{"id":"J-2226","title":"J-2226 · Wardrobe carcass"},{"id":"J-2229","title":"J-2229 · Sash window pair"}]},{"title":"Ready","cards":[{"id":"J-2219","title":"J-2219 · Garden gate","locked":true}]}],"_ui":{"jobBoard":{"move":{"card":"J-2229 · Sash window pair","fromColumn":"Cutting","toColumn":"Assembly","fromIndex":0,"toIndex":1}},"savePlanBtn":{"commit":{"label":"Save today's plan"}}}},"generation_id":"gen_7f3k2q","prompt":"Plan saved and on the floor screens. Show the same board with every lane exactly as sent, a one-line confirmation naming the jobs that changed lane, and the save button dimmed with a past-tense label."}

Example 2 — a DataTable row action. "event" is commit; "params" carries the row-action id under "action", the row itself (the resolved record, so nothing needs re-fetching), its index, and "rows" (the full current row set); "element_id" is the table and "label" the row action the user pressed. The sort the user clicked earlier never called you — it is simply there in _ui. The steering "prompt" says what the next screen must offer and must NOT invent.

{"action":"reassignVisit","event":"commit","element_id":"visitsTable","label":"Reassign","params":{"action":"reassign","index":1,"row":{"visit":"V-5107","time":"08:30","client":"Mrs Doyle","postcode":"LS8","carer":"Amara N."},"rows":[{"visit":"V-5102","time":"07:45","client":"Mr Hale","postcode":"LS7","carer":"Amara N."},{"visit":"V-5107","time":"08:30","client":"Mrs Doyle","postcode":"LS8","carer":"Amara N."},{"visit":"V-5111","time":"09:15","client":"Mr Quinn","postcode":"LS8","carer":"Priya K."}]},"state":{"_ui":{"visitsTable":{"sort":{"sortBy":"time","sortDir":"asc"}}}},"generation_id":"gen_2q9dmx","prompt":"Reassign V-5107. Keep the table as it is and open a picker under that row offering only the carers free at 08:30 in LS8 - Priya K. and Tomasz W. - with one Confirm button that carries the chosen carer; do not invent other names or slots."}`;

export const actionToolDefinition = {
  name: 'frayme_action',
  description:
    'Respond to a user interaction on a Frayme-rendered UI. Call this when the user presses a control bound to an action you declared in a prior frayme_compose `actions` contract.\n\n' +
    'The loop: when the user presses a control bound to a declared action (a Button, a Confirmation, a Form submit, a DataTable or a row/bulk action; any gesture on a `live:true` action), your host receives a DynamicActionEvent — `{action, event, params, state, element_id, label, description, generation_id}` — on its onAction/AG-UI channel. Call frayme_action with those fields VERBATIM (do not re-shape, rename, or drop any of them). The NEXT SCREEN IS THEN COMPOSED FRESH from what you send: `prompt` says what just happened and what to show now, `data` carries the values it must display, `actions` declares the controls that lead FORWARD from here, and `signals` steers, all exactly as on frayme_compose. The screen the user pressed is not carried over and their typed state is not resent, so every value the next screen must show has to be named in `data`. You get back a NEW validated spec with its own `spec.actions` for the next round. The event carries the RESOLVED value the user produced — the selected rows themselves, the signed strokes, the edited cells, the picked date, the uploaded file — in `params`/`state`, not just an id or a bare signal, so you rarely need to re-ask; `state._ui.<elementId>.<verb>` holds the latest gesture per verb (board moves, picks, toggles) — never cleared by a press, so treat an entry as what the user last did, not what changed since you were last called, and read the result from the declared param or bound state; `element_id` names the control that fired and `label` is what it said (absent for a Form submit, whose `element_id` is the Form).\n\n' +
    'The `event` field is always one of these 8 canonical verbs; `params` carries the verb\'s documented payload keys (spec-authored keys win over these intrinsic ones):\n' +
    VERBS_BLOCK +
    '\n\n' + ACTION_CALL_EXAMPLES,
  inputSchema: actionInputSchema,
  outputSchema: composeOutputSchema,
} as const;

/**
 * Bind the round-trip tool to a configured client. Wire its `execute` to the
 * structured action sink — `createDynamicActionForwarder({ onAction: tool.execute })`
 * — so a user interaction recomposes the canvas in context. `inputExamples`:
 * see `createComposeTool`.
 */
export function createActionTool(client: Frayme): typeof actionToolDefinition & {
  inputExamples: Array<{ input: ActionToolInput }>;
  execute: (input: ActionToolInput) => Promise<ComposeResult>;
} {
  return {
    ...actionToolDefinition,
    inputExamples: actionInputExamples.map((input) => ({ input })),
    // A PRESS IS A CREATE. The whole event the host forwards is read here and then
    // deliberately left off the wire: `action_context` reaches no prompt, so the
    // params and state posted there conveyed nothing to the model while still
    // crossing the network, typed values and all. `mode: continue_journey` is gone
    // for the same reason it never belonged: with nothing to continue FROM, it only
    // framed the request as a redraw.
    //
    // What reaches the model is the prompt and `data`. The caller names the press in
    // the prompt and puts the values the next screen must show in `data`, and
    // `actions` names only what leads FORWARD, never the control just pressed.
    execute: ({
      prompt,
      data,
      actions,
      signals,
      label: _label,
      description: _description,
      ...ctx
    }: ActionToolInput) =>
      client.compose.create({
        prompt: prompt ?? `The user pressed the "${ctx.action}" control. Show the next step.`,
        data,
        actions,
        signals,
        stream: false,
      }),
  };
}

/**
 * The two tools in the raw Anthropic Messages API shape, for hosts on
 * `@anthropic-ai/sdk` directly rather than a framework — pass the array as
 * `tools` on `messages.create`. `input_schema` is the Zod schema rendered by
 * zod's own `z.toJSONSchema` (draft 2020-12, `$schema` dropped — the API
 * validates a plain schema object); `input_examples` are the same schema-valid
 * examples the framework paths attach as `inputExamples`. GA on the Claude API
 * — no beta header. Pure and dependency-free: zod is already this package's
 * peer.
 */
export function anthropicToolDefinitions(): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  input_examples: Array<Record<string, unknown>>;
}> {
  const toInputSchema = (schema: z.ZodType): Record<string, unknown> => {
    const { $schema: _omit, ...rest } = z.toJSONSchema(schema);
    return rest;
  };
  return [
    {
      name: composeToolDefinition.name,
      description: composeToolDefinition.description,
      input_schema: toInputSchema(composeInputSchema),
      input_examples: composeInputExamples.map((e) => ({ ...e })),
    },
    {
      name: actionToolDefinition.name,
      description: actionToolDefinition.description,
      input_schema: toInputSchema(actionInputSchema),
      input_examples: actionInputExamples.map((e) => ({ ...e })),
    },
  ];
}
