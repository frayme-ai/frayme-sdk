export interface FraymeErrorOptions {
  status?: number;
  code?: string;
  requestId?: string;
}

export class FraymeError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly requestId: string | undefined;

  constructor(message: string, opts: FraymeErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.status = opts.status;
    this.code = opts.code;
    this.requestId = opts.requestId;
  }
}

/** Network-level failure: could not reach the API, or the connection died mid-stream. */
export class APIConnectionError extends FraymeError {}
/** The consumer aborted the request (signal or `stream.abort()`). */
export class APIUserAbortError extends FraymeError {}

export class BadRequestError extends FraymeError {}
export class AuthenticationError extends FraymeError {}
export class PaymentRequiredError extends FraymeError {}
export class AuthorizationError extends FraymeError {}
export class NotFoundError extends FraymeError {}
export class IdempotencyKeyInUseError extends FraymeError {}
export class ValidationError extends FraymeError {}
export class RateLimitError extends FraymeError {
  /** Seconds to wait, from the Retry-After header (when the server sent one). */
  readonly retryAfter: number | undefined;
  constructor(message: string, opts: FraymeErrorOptions & { retryAfter?: number } = {}) {
    super(message, opts);
    this.retryAfter = opts.retryAfter;
  }
}
export class QuotaExceededError extends FraymeError {}
export class CompositionFailedError extends FraymeError {}
export class ModelUnavailableError extends FraymeError {}
export class InternalServerError extends FraymeError {}

interface ErrorEnvelope {
  success?: boolean;
  error?: { message?: string; code?: string };
}

/**
 * Wire error codes → HTTP status. Single source of truth for the error taxonomy,
 * exported so consumers (and the Frayme platform's error tests) can assert parity
 * against the server's AppError classes. Also used for in-band stream `error`
 * events that carry no HTTP status.
 */
export const ERROR_CODE_TO_STATUS: Record<string, number> = {
  BAD_REQUEST: 400,
  AUTHENTICATION_REQUIRED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  IDEMPOTENCY_KEY_IN_USE: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  INTERNAL_SERVER_ERROR: 500,
  COMPOSITION_FAILED: 502,
  MODEL_UNAVAILABLE: 503,
  // The codes that share a status with one above come after it, so the first
  // code listed for a status stays that status's general code.
  SERVICE_UNAVAILABLE: 503,
  INVALID_MANIFEST: 400,
  CUSTOM_SLICE_TOO_LARGE: 400,
  FEATURE_LIMIT: 403,
};

export function castError(
  status: number,
  body: unknown,
  headers?: Headers,
): FraymeError {
  const envelope = (body ?? {}) as ErrorEnvelope;
  const code = envelope.error?.code;
  const message =
    envelope.error?.message ??
    (typeof body === 'string' && body.length > 0
      ? body.slice(0, 200)
      : `Request failed with status ${status}`);
  const requestId = headers?.get('x-request-id') ?? undefined;
  const opts: FraymeErrorOptions = { status, code, requestId };

  switch (status) {
    case 400:
      return new BadRequestError(message, opts);
    case 401:
      return new AuthenticationError(message, opts);
    case 402:
      return new PaymentRequiredError(message, opts);
    case 403:
      return new AuthorizationError(message, opts);
    case 404:
      return new NotFoundError(message, opts);
    case 409:
      return new IdempotencyKeyInUseError(message, opts);
    case 422:
      return new ValidationError(message, opts);
    case 429: {
      if (code === 'QUOTA_EXCEEDED') return new QuotaExceededError(message, opts);
      const retryAfterRaw = headers?.get('retry-after');
      const retryAfter = retryAfterRaw != null ? Number(retryAfterRaw) : undefined;
      return new RateLimitError(message, {
        ...opts,
        retryAfter: Number.isFinite(retryAfter) ? retryAfter : undefined,
      });
    }
    case 502:
      return new CompositionFailedError(message, opts);
    case 503:
      return new ModelUnavailableError(message, opts);
    default:
      if (status >= 500) return new InternalServerError(message, opts);
      return new FraymeError(message, opts);
  }
}

/** Map an in-band stream `error` event (`{code, message}`, no HTTP status) to a typed error. */
export function errorFromEventCode(code: string, message: string): FraymeError {
  const status = ERROR_CODE_TO_STATUS[code];
  return castError(status ?? 500, { error: { code, message } });
}
