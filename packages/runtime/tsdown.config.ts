import { defineConfig } from 'tsdown';

const NEVER_BUNDLE = [
  'react',
  'react-dom',
  '@frayme/api',
  '@frayme/catalog',
  '@json-render/core',
  '@json-render/react',
  '@ag-ui/core',
  'ai',
  '@ai-sdk/react',
  'zod',
];

const shared = {
  format: ['esm' as const],
  platform: 'neutral' as const,
  target: 'es2022',
  dts: true,
  sourcemap: true,
  deps: { neverBundle: NEVER_BUNDLE },
};

export default defineConfig([
  {
    // Server-safe core — must NOT contain "use client".
    ...shared,
    entry: { index: 'src/index.ts' },
    clean: true,
    // NOTE: src/styles/frayme.css is now a Tailwind v4 ENTRY (@import 'tailwindcss'
    // + @theme), so it is COMPILED to dist/frayme.css by the `build` script's
    // tailwindcss step (not copied raw — the raw entry isn't a usable stylesheet).
  },
  {
    // Client subpaths — a separate build graph so no chunk can ever mix
    // server and client code; the banner stamps every chunk.
    ...shared,
    entry: {
      'react/index': 'src/react/index.ts',
      'ai-sdk/index': 'src/ai-sdk/index.tsx',
      'ag-ui/index': 'src/ag-ui/index.tsx',
    },
    clean: false,
    // The directive belongs to the JavaScript only. As a plain string the
    // banner was stamped on the .d.ts chunks too, and a statement in an
    // ambient file is TS1036 for any consumer with skipLibCheck off (found
    // 21 Sep 2026 by type-checking the docs' snippets under strict settings;
    // shipped that way in 0.5.0 and 0.6.0, harmless under the default
    // skipLibCheck: true).
    outputOptions: {
      banner: (chunk) => (chunk.fileName.endsWith('.ts') ? '' : '"use client";'),
    },
  },
]);
