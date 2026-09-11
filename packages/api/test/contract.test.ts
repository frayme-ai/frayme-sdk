import { describe, expect, it } from 'vitest';

import { composeInputSchema } from '../src/tools/index.js';
import { errorFromEventCode } from '../src/core/errors.js';
import {
  ERROR_CODE_TO_STATUS,
  COMPOSE_PROMPT_MAX_CHARS,
  COMPOSE_MAX_OPERATIONS,
  MAX_ACTIONS_PER_REQUEST,
  ACTION_NAME_MAX_CHARS,
  CONTEXT_THEME_MAX_CHARS,
} from '../src/index.js';

const ok = (v: unknown) => composeInputSchema.safeParse(v).success;

describe('compose limits are the single source the tool schema enforces', () => {
  it('prompt cap == COMPOSE_PROMPT_MAX_CHARS', () => {
    expect(ok({ prompt: 'x'.repeat(COMPOSE_PROMPT_MAX_CHARS) })).toBe(true);
    expect(ok({ prompt: 'x'.repeat(COMPOSE_PROMPT_MAX_CHARS + 1) })).toBe(false);
  });

  it('max_operations cap == COMPOSE_MAX_OPERATIONS', () => {
    expect(ok({ prompt: 'x', max_operations: COMPOSE_MAX_OPERATIONS })).toBe(true);
    expect(ok({ prompt: 'x', max_operations: COMPOSE_MAX_OPERATIONS + 1 })).toBe(false);
  });

  it('actions cap == MAX_ACTIONS_PER_REQUEST', () => {
    const action = { name: 'a' };
    expect(
      ok({ prompt: 'x', actions: Array(MAX_ACTIONS_PER_REQUEST).fill(action) }),
    ).toBe(true);
    expect(
      ok({ prompt: 'x', actions: Array(MAX_ACTIONS_PER_REQUEST + 1).fill(action) }),
    ).toBe(false);
  });

  it('action name cap == ACTION_NAME_MAX_CHARS', () => {
    expect(ok({ prompt: 'x', actions: [{ name: 'a'.repeat(ACTION_NAME_MAX_CHARS) }] })).toBe(true);
    expect(
      ok({ prompt: 'x', actions: [{ name: 'a'.repeat(ACTION_NAME_MAX_CHARS + 1) }] }),
    ).toBe(false);
  });

  it('context.theme cap == CONTEXT_THEME_MAX_CHARS', () => {
    expect(ok({ prompt: 'x', context: { theme: 't'.repeat(CONTEXT_THEME_MAX_CHARS) } })).toBe(true);
    expect(
      ok({ prompt: 'x', context: { theme: 't'.repeat(CONTEXT_THEME_MAX_CHARS + 1) } }),
    ).toBe(false);
  });
});

describe('ERROR_CODE_TO_STATUS is consistent with castError', () => {
  it('every mapped code resolves to an error carrying its status', () => {
    for (const [code, status] of Object.entries(ERROR_CODE_TO_STATUS)) {
      const err = errorFromEventCode(code, 'boom');
      expect(err.status, `${code} → ${status}`).toBe(status);
      expect(err.code).toBe(code);
    }
  });

  it('QUOTA_EXCEEDED and RATE_LIMITED both map to 429 but distinct classes', () => {
    expect(ERROR_CODE_TO_STATUS.QUOTA_EXCEEDED).toBe(429);
    expect(ERROR_CODE_TO_STATUS.RATE_LIMITED).toBe(429);
    expect(errorFromEventCode('QUOTA_EXCEEDED', 'x').name).toBe('QuotaExceededError');
    expect(errorFromEventCode('RATE_LIMITED', 'x').name).toBe('RateLimitError');
  });
});
