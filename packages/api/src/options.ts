/** Minimal ambient declaration so we can read env vars without dragging
 * `@types/node` into the published type surface (the package also runs on
 * edge/Workers/Deno where `process` does not exist). */
declare const process:
  | { env?: Record<string, string | undefined> }
  | undefined;

export interface ClientOptions {
  /**
   * Your Frayme API key (`fr_live_…`). Defaults to the
   * `FRAYME_API_KEY` environment variable. Pass `null` explicitly for keyless
   * proxy mode (point `baseURL` at your own server route that holds the key).
   */
  apiKey?: string | null;
  /** Defaults to `FRAYME_BASE_URL` or `https://api.frayme.ai`. */
  baseURL?: string;
  /** Max automatic retries for retryable failures. Default 2. */
  maxRetries?: number;
  /** Whole-request timeout in ms (covers streaming reads too). Default 600 000. */
  timeout?: number;
  /** Max ms to wait for the FIRST stream event before failing. Default 90 000. */
  firstEventTimeout?: number;
  /**
   * Using a secret key in a browser exposes it to anyone visiting the page.
   * Only enable this for local experiments — never in anything you ship.
   * Keyless proxy mode (`apiKey: null` + your own `baseURL`) does not need
   * this flag.
   */
  dangerouslyAllowBrowser?: boolean;
  /** Override fetch (used for testing and exotic runtimes). */
  fetch?: typeof globalThis.fetch;
  /** Extra headers sent with every request. */
  defaultHeaders?: Record<string, string>;
}

export interface ResolvedConfig {
  apiKey: string | null;
  baseURL: string;
  maxRetries: number;
  timeout: number;
  firstEventTimeout: number;
  fetch: typeof globalThis.fetch;
  defaultHeaders: Record<string, string>;
}

function readEnv(name: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  return process?.env?.[name]?.trim() || undefined;
}

export const DEFAULT_BASE_URL = 'https://api.frayme.ai';

export function resolveConfig(options: ClientOptions): ResolvedConfig {
  const apiKey =
    options.apiKey !== undefined ? options.apiKey : (readEnv('FRAYME_API_KEY') ?? undefined);
  if (apiKey === undefined) {
    throw new Error(
      "The FRAYME_API_KEY environment variable is missing and no `apiKey` option was provided. Pass `apiKey: null` explicitly if you are using keyless proxy mode against your own baseURL.",
    );
  }
  return {
    apiKey,
    baseURL: (options.baseURL ?? readEnv('FRAYME_BASE_URL') ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
    maxRetries: options.maxRetries ?? 2,
    timeout: options.timeout ?? 600_000,
    firstEventTimeout: options.firstEventTimeout ?? 90_000,
    // bind: browsers throw "Illegal invocation" when fetch is called detached
    // from Window (Node doesn't care — unit tests won't catch a regression here,
    // the starter app in CI does).
    fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
    defaultHeaders: options.defaultHeaders ?? {},
  };
}
