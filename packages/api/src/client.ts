import type { Health, Me } from './api-types.js';
import { FraymeError } from './core/errors.js';
import { isBrowserLike } from './core/platform.js';
import { requestData } from './core/transport.js';
import { resolveConfig, type ClientOptions, type ResolvedConfig } from './options.js';
import { ComposeResource } from './resources/compose.js';

export class Frayme {
  readonly compose: ComposeResource;
  readonly #cfg: ResolvedConfig;

  constructor(options: ClientOptions = {}) {
    this.#cfg = resolveConfig(options);

    if (this.#cfg.apiKey != null && isBrowserLike() && options.dangerouslyAllowBrowser !== true) {
      throw new FraymeError(
        'Refusing to run with an API key in a browser-like environment: this exposes your secret key to every visitor. ' +
          'Either call Frayme from your server, use keyless proxy mode (`new Frayme({ apiKey: null, baseURL: "/api/your-proxy" })`), ' +
          'or — for local experiments only — pass `dangerouslyAllowBrowser: true`.',
      );
    }

    this.compose = new ComposeResource(this.#cfg);
  }

  /** GET /v1/me — verify a key and inspect workspace, plan, and remaining quota. */
  me(options?: { signal?: AbortSignal }): Promise<Me> {
    return requestData<Me>(this.#cfg, { method: 'GET', path: '/v1/me', signal: options?.signal });
  }

  /** GET /v1/health — unauthenticated liveness probe. */
  health(options?: { signal?: AbortSignal }): Promise<Health> {
    return requestData<Health>(this.#cfg, {
      method: 'GET',
      path: '/v1/health',
      signal: options?.signal,
    });
  }
}
