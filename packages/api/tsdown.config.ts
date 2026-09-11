import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', 'tools/index': 'src/tools/index.ts' },
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  publint: true,
  attw: { profile: 'esm-only' },
  deps: { neverBundle: ['@frayme/catalog', '@json-render/core', 'zod'] },
});
