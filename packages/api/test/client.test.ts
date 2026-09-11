import { afterEach, describe, expect, it } from 'vitest';
import { Frayme } from '../src/client.js';
import { buildMockFetch } from './helpers/mock-fetch.js';

const g = globalThis as { window?: unknown; document?: unknown };

afterEach(() => {
  delete g.window;
  delete g.document;
});

describe('browser guard + proxy mode', () => {
  it('throws when constructed with an API key in a browser-like environment', () => {
    g.window = {};
    g.document = {};
    expect(() => new Frayme({ apiKey: 'fr_live_secret' })).toThrow(/browser-like environment/);
  });

  it('dangerouslyAllowBrowser: true permits a key in the browser', () => {
    g.window = {};
    g.document = {};
    expect(() => new Frayme({ apiKey: 'fr_live_x', dangerouslyAllowBrowser: true })).not.toThrow();
  });

  it('keyless proxy mode works in the browser WITHOUT the flag and sends no Authorization header', async () => {
    g.window = {};
    g.document = {};
    const mock = buildMockFetch([
      { status: 200, body: JSON.stringify({ success: true, data: { status: 'ok', service: 's', catalog_version: '0.1.0' } }) },
    ]);
    const frayme = new Frayme({ apiKey: null, baseURL: 'https://my-app.test/api/frayme', fetch: mock.fetch });
    await frayme.health();
    expect(mock.calls[0]!.url).toBe('https://my-app.test/api/frayme/v1/health');
    expect(mock.calls[0]!.headers.get('authorization')).toBeNull();
  });

  it('throws a clear setup error when no key is provided and the env var is absent', () => {
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process!
      .env;
    const saved = env.FRAYME_API_KEY;
    delete env.FRAYME_API_KEY;
    try {
      expect(() => new Frayme()).toThrow(/FRAYME_API_KEY/);
    } finally {
      if (saved !== undefined) env.FRAYME_API_KEY = saved;
    }
  });
});

describe('me() and health()', () => {
  it('me() unwraps the camelCase payload', async () => {
    const me = {
      workspace: { id: 'w1', name: 'Acme', slug: 'acme' },
      plan: { tierKey: 'pro', monthlyGenerations: 10_000, rateLimitPerMin: 120, generationsRemaining: 9_876 },
    };
    const mock = buildMockFetch([{ status: 200, body: JSON.stringify({ success: true, data: me }) }]);
    const frayme = new Frayme({ apiKey: 'fr_live_k', baseURL: 'https://api.test', fetch: mock.fetch });
    const result = await frayme.me();
    expect(result.plan.generationsRemaining).toBe(9_876);
    expect(result.workspace.slug).toBe('acme');
    expect(mock.calls[0]!.url).toBe('https://api.test/v1/me');
    expect(mock.calls[0]!.method).toBe('GET');
  });
});
