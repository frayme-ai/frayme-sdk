/**
 * @frayme/api/agent: the framework-neutral agent core.
 *
 * Frayme is the tool another agent calls; the chat, the model and the loop
 * belong to that agent's framework. This entry holds the pieces every
 * framework adapter shares, with no framework imports: the tool shape, intent
 * lookup, source queries, compose-as-outputs streaming, and press handling.
 */
export type { FraymeToolContext, FraymeToolSpec } from './tool-spec.js';

export {
  fraymeIntentSchema,
  intentExample,
  lookupIntentTool,
} from './intents.js';
export type { FraymeIntent, FraymeIntentExample } from './intents.js';

export { querySource, querySourceTool } from './sources.js';
export type {
  FraymeSourceRow,
  FraymeSources,
  QuerySourceInput,
  QuerySourceResult,
} from './sources.js';

export {
  composeErrorRetryable,
  composeOutputs,
  createComposeGuard,
  fraymeModelView,
  ONE_COMPOSE_PER_TURN,
  oneComposePerTurnOutput,
} from './compose-outputs.js';
export type {
  ComposeOutputsOptions,
  FraymeComposeError,
  FraymeComposeOutput,
  FraymeComposeStatus,
} from './compose-outputs.js';

export { actionContextOf, findPriorSpec, readPress } from './press.js';
export type { FraymePress } from './press.js';

export { fitContinuation } from '../fit.js';
export type { FraymeTrimmed } from '../fit.js';
