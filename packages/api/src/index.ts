/**
 * @frayme/api — the official Frayme API client.
 *
 *   import Frayme from '@frayme/api';
 *   const frayme = new Frayme({ apiKey: process.env.FRAYME_API_KEY });
 *   const stream = frayme.compose.stream({ prompt: 'A pricing page with three tiers' });
 *   stream.on('op', (op, snapshot) => render(snapshot));
 *   stream.on('restarted', () => clearRendered());
 *   const { spec } = await stream.finalSpec();
 */
export { Frayme } from './client.js';
export { Frayme as default } from './client.js';

export type { ClientOptions } from './options.js';
export type {
  ComposeRequest,
  ComposeAction,
  ComposeActionKind,
  ComposeActionContext,
  ComposeResult,
  Me,
  Health,
  Usage,
  SuccessEnvelope,
} from './api-types.js';
/* VALUE exports, not types: the tier readers must be callable by consumers, or every
   one of them re-implements "which params shape is this" and they drift — which is
   exactly how the serializer came to read only `params.properties` while the catalog
   validator read both shapes. */
export { normalizeActionParams, normalizeRequiredItems } from './api-types.js';
export type { RequestMethodOptions } from './resources/compose.js';

export { ComposeStream } from './streaming/compose-stream.js';
export type { ComposeStreamHandlers, FinalSpec } from './streaming/compose-stream.js';
export type {
  ComposeStreamEvent,
  ComposeStartedEvent,
  OpEvent,
  ComposeRestartedEvent,
  ComposeCompletedEvent,
} from './streaming/events.js';

export {
  FraymeError,
  APIConnectionError,
  APIUserAbortError,
  BadRequestError,
  AuthenticationError,
  PaymentRequiredError,
  AuthorizationError,
  NotFoundError,
  IdempotencyKeyInUseError,
  ValidationError,
  RateLimitError,
  QuotaExceededError,
  CompositionFailedError,
  ModelUnavailableError,
  InternalServerError,
  ERROR_CODE_TO_STATUS,
} from './core/errors.js';

export {
  COMPOSE_PROMPT_MIN_CHARS,
  COMPOSE_PROMPT_MAX_CHARS,
  COMPOSE_MIN_OPERATIONS,
  COMPOSE_MAX_OPERATIONS,
  CONTEXT_THEME_MAX_CHARS,
  CONTEXT_FRAMEWORK_HINT_MAX_CHARS,
  ACTION_NAME_MIN_CHARS,
  ACTION_NAME_MAX_CHARS,
  ACTION_ROLE_MAX_CHARS,
  MAX_ACTIONS_PER_REQUEST,
  COMPOSE_DATA_MAX_CHARS,
  PRIOR_SPEC_MAX_CHARS,
  ACTION_CONTEXT_MAX_CHARS,
} from './limits.js';

export { fitContinuation, jsonSize } from './fit.js';
export type { FitContinuationInput, FitContinuationResult, FraymeTrimmed } from './fit.js';

export { VERSION } from './version.js';

// Re-export the json-render spec type so consumers needn't depend on
// @json-render/core directly.
export type { Spec } from '@json-render/core';
