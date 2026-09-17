# Intents and sources

Intents and sources are two optional tools for the host agent: `lookup_intent` shows it how your app composes one kind of screen, and `query_source` hands it your real records to put in `data`.

## Where they fit

Frayme never owns the chat. Your agent writes its own `frayme_compose` calls, and the SDK's tool description already teaches the call shape with generic examples.

- **An intent** is the same kind of example, written by your app for one kind of your own screens: a layout prompt plus the signals and actions your app uses for it. The agent reads it with `lookup_intent`, then writes its own `frayme_compose` call with the real facts.
- **Intents never reach `/v1/compose`.** Nothing merges an intent into a request. It only informs what the agent writes.
- **A source** is a list of your records. The agent finds the rows a screen needs with `query_source` and passes them into `data` verbatim, so the screen shows real values instead of invented ones.
- **Both are optional.** `lookup_intent` exists only when you pass intents, and `query_source` only when you pass sources.

A typical turn, for "Where is order A-1041?":

1. The agent calls `lookup_intent` with `{ "name": "order_tracking" }` and reads the example call.
2. It calls `query_source` with `{ "source": "orders", "where": { "id": "A-1041" } }` and gets the order.
3. It calls `frayme_compose` with the intent's layout, signals and actions, and the order in `data`.

## Writing intents

Keep intents in a JSON file, or wherever your app stores settings:

```json
{
  "intents": [
    {
      "name": "order_tracking",
      "description": "Where one order is: its status, the delivery timeline and the address.",
      "layout": "A summary strip with the order number, carrier, status and delivery estimate. Under it a delivery timeline, newest event first, and a card with the delivery address.",
      "signals": { "data_shape": ["timeline", "cards"], "density": "standard" },
      "actions": [
        {
          "name": "reportDeliveryProblem",
          "role": "Report a problem",
          "required": true,
          "confirm": true,
          "params": { "type": "object", "properties": { "orderId": { "type": "string" } }, "required": ["orderId"] }
        }
      ]
    },
    {
      "name": "refund_queue",
      "description": "The open refund requests, to approve or decline in bulk.",
      "layout": "One line with how many requests are open and their total. Then a table of requests with tick-to-select: customer, order, amount, reason and age. Under it Approve and Decline, each acting on the ticked rows.",
      "signals": { "data_shape": ["table"], "density": "compact", "patterns": ["bulk-actions", "confirm-dialog"] }
    }
  ]
}
```

| Field | Required | Limits | Becomes |
| --- | --- | --- | --- |
| `name` | yes | 2 to 40 characters: a lowercase letter, then lowercase letters, digits or underscores. `none` is reserved. Unique across your intents. | The name the agent passes to `lookup_intent`. |
| `description` | yes | 1 to 200 characters. | Its line in the `lookup_intent` tool description, so the agent knows when the intent applies. |
| `layout` | yes | 1 to 800 characters. | `example_call.prompt`. |
| `signals` | no | As on `frayme_compose`: `data_shape`, `density`, `patterns`, `tone`. | `example_call.signals`. |
| `actions` | no | As on `frayme_compose`: at most 20, with names unique within the intent. | `example_call.actions`. |

- **Unknown top-level keys are errors**, so a misspelt field fails instead of silently doing nothing. Inside an action, keys the `frayme_compose` action schema does not know are dropped.
- **Write the layout like a good prompt:** the regions, their order, and what each control does. Leave facts out. The agent fills `data` with real values on every call and is told never to copy example values as facts.
- **Validate where intents are authored** (a settings screen, a CI step) with `fraymeIntentSchema` from `@frayme/api/agent`.

## Passing them to `fraymeTools`

```ts
// app/api/chat/route.ts
import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { fraymeTools } from '@frayme/api/ai-sdk';
import agent from '../../../frayme.agent.json';

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return new Response('Not signed in', { status: 401 });

  const { messages }: { messages: UIMessage[] } = await req.json();
  // Only rows this user may see: the model can read every row you pass.
  const sources = { orders: await getOrdersFor(user.id) };
  const tools = fraymeTools({ intents: agent.intents, sources, messages });

  return streamText({
    model: anthropic('claude-sonnet-5'),
    tools,
    messages: await convertToModelMessages(messages, { tools }),
    stopWhen: stepCountIs(6),
  }).toUIMessageStreamResponse();
}
```

`getUser` and `getOrdersFor` stand for your own session check and data access.

- **A JSON import works as it is.** `fraymeTools` checks every intent against `fraymeIntentSchema` when it builds the tools, so the plain `string` types a JSON import gives are accepted.
- **A bad intent fails at setup**, not inside a model turn. The error names it, for example `Invalid intent at intents[0].name: ...`, and a repeated name throws `Duplicate intent name "order_tracking". Intent names must be unique.`
- **Build the tools per request.** They read that request's `messages`, and the sources you pass are that user's.
- **Row types:** TypeScript rejects rows typed with an `interface`, because an interface has no index signature. Use a `type` alias, or copy the rows (`rows.map((row) => ({ ...row }))`).

## `lookup_intent`

The agent passes one of your intent names, `{ "name": "order_tracking" }`, and gets the intent back as an example call. The shape is `FraymeIntentExample` from `@frayme/api/agent`:

```ts
interface FraymeIntentExample {
  intent: string;
  description: string;
  example_call: {
    prompt: string;
    signals?: ComposeToolInput['signals'];
    actions?: ComposeToolInput['actions'];
  };
}
```

For the first intent above:

```json
{
  "intent": "order_tracking",
  "description": "Where one order is: its status, the delivery timeline and the address.",
  "example_call": {
    "prompt": "A summary strip with the order number, carrier, status and delivery estimate. Under it a delivery timeline, newest event first, and a card with the delivery address.",
    "signals": { "data_shape": ["timeline", "cards"], "density": "standard" },
    "actions": [
      {
        "name": "reportDeliveryProblem",
        "role": "Report a problem",
        "params": { "type": "object", "properties": { "orderId": { "type": "string" } }, "required": ["orderId"] },
        "confirm": true,
        "required": true
      }
    ]
  }
}
```

- **Empty `signals` or `actions` are left out**, so the example never teaches an empty field.
- **Each result is a copy.** A framework that keeps or changes a tool result never touches your intent list.
- **An unknown name** returns `{ "error": "Unknown intent \"...\". Known intents: order_tracking, refund_queue." }` instead of throwing.
- **The tool description** lists every intent's name and description, and tells the agent to keep the layout, signals and actions that fit, to put the real facts in `data`, and never to copy example values as facts.

## `query_source`

`sources` maps a name to an array of row objects, for example `{ orders: [...] }`. The tool description is built once, when the tools are built: each source's name, row count, and the column names of its first row (up to 12 plain names). The rows themselves are read when the agent queries.

| Input | Type | Meaning |
| --- | --- | --- |
| `source` | one of your source names | The source to query. Required. |
| `search` | `string` | Case-insensitive text found anywhere in a row, nested values included. |
| `where` | `{ [field]: string \| number \| boolean \| null }` | Exact values for top-level fields. Every pair must match. |
| `fields` | `string[]` | Return only these fields of each row. |
| `limit` | `number` | Rows to return: 1 to 50, default 20. Values outside the range are clamped. |

A call over an `orders` source of three rows, and its result:

```json
{ "source": "orders", "where": { "status": "Delayed" }, "fields": ["id", "customer", "total"], "limit": 10 }
```

```json
{
  "source": "orders",
  "total": 3,
  "matched": 2,
  "rows": [
    { "id": "A-1041", "customer": "Dana Whitlock", "total": "£120.00" },
    { "id": "A-1043", "customer": "Lin Chen", "total": "£45.50" }
  ],
  "truncated": false
}
```

- **`total`** is the rows in the source, **`matched`** the rows that passed `search` and `where`, and **`truncated`** is `true` when fewer rows came back than matched.
- **The result is capped at 16 KiB** of serialized rows as well as by `limit`, because it goes into the model's context and then into a compose request.
- **Rows come back as JSON-safe copies:** dates as ISO strings, non-finite numbers as `null`, big integers as strings. Functions, symbols, the keys `__proto__`, `constructor` and `prototype`, and anything nested deeper than 10 levels are left out. Entries that are not objects are skipped.
- **It never throws.** An unknown source, or a row that cannot be read, returns `{ "error": "..." }` for the agent to read.

{% hint style="info" %}
Rows are data, never instructions. The tool description tells the agent not to act on text inside a row, but a row is still content your users or third parties may have written. Pass only the rows this user is allowed to see, and nothing you would not show them on screen.
{% endhint %}

## Other frameworks: `@frayme/api/agent`

`lookupIntentTool(intents)` and `querySourceTool(sources)` build the same two tools for any agent framework. Each returns a `FraymeToolSpec`, with `name`, `description`, `inputSchema` (a Zod v4 schema) and `execute(input, { signal })`, or `undefined` when there is nothing to offer. A framework that takes a Zod schema can use `inputSchema` as it is; one that takes JSON Schema can convert it with `z.toJSONSchema`:

```ts
// lib/frayme-extra-tools.ts
import { z } from 'zod';
import {
  fraymeIntentSchema,
  lookupIntentTool,
  querySourceTool,
  type FraymeSources,
  type FraymeToolSpec,
} from '@frayme/api/agent';
import agent from '../frayme.agent.json';

/** One tool in the shape most agent frameworks take: a name, a description and JSON Schema. */
export interface HostTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run(input: unknown, signal?: AbortSignal): Promise<unknown>;
}

function toHostTool<I, O>(spec: FraymeToolSpec<I, O>): HostTool {
  return {
    name: spec.name,
    description: spec.description,
    parameters: z.toJSONSchema(spec.inputSchema),
    run: async (input, signal) => {
      // Model arguments are untrusted: parse them before the tool runs.
      const parsed = spec.inputSchema.safeParse(input);
      if (!parsed.success) return { error: z.prettifyError(parsed.error) };
      return spec.execute(parsed.data, { signal });
    },
  };
}

export function extraTools(sources: FraymeSources): HostTool[] {
  // JSON widens enum values to string, so parse the intents before use.
  const intents = agent.intents.map((intent) => fraymeIntentSchema.parse(intent));
  const tools: HostTool[] = [];
  const lookup = lookupIntentTool(intents); // undefined with no intents; throws on a duplicate name
  if (lookup) tools.push(toHostTool(lookup));
  const query = querySourceTool(sources); // undefined with no sources
  if (query) tools.push(toHostTool(query));
  return tools;
}
```

Unlike `fraymeTools`, `lookupIntentTool` takes intents that are already typed as `FraymeIntent`, which is why the JSON is parsed first.

## Next steps

- [`@frayme/api/agent`](../sdk/api-agent.md): every export of the framework-neutral core
- [`@frayme/api/ai-sdk`](../sdk/api-ai-sdk.md): all `fraymeTools` options
- [Data binding](data-binding.md): how the facts in `data` reach the screen
