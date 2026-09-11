import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // RTL's auto-cleanup hooks into global afterEach.
    globals: true,
  },
});
