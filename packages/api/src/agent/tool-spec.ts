import type { z } from 'zod';

/**
 * Per-call context a framework adapter hands to `execute`. Only the abort
 * signal is carried: it is the one thing every agent framework passes and
 * every Frayme tool can honour.
 */
export interface FraymeToolContext {
  signal?: AbortSignal;
}

/**
 * A framework-neutral tool: a name, a description the model reads, a Zod v4
 * input schema (Standard Schema, so every framework can validate with it) and
 * an `execute`. Adapters for the Vercel AI SDK, Mastra and the rest wrap this
 * shape; nothing here imports an agent framework.
 */
export interface FraymeToolSpec<I, O> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  execute(input: I, context?: FraymeToolContext): Promise<O>;
}
