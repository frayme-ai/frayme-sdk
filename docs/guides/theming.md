# Theming

Every visual token in Frayme's rendered UI is a `--frayme-*` CSS variable. Set them per instance or app-wide with `ThemeTokens` or a `{ light, dark }` pair, globally in your stylesheet, or per workspace at runtime.

## The token set

`@frayme/runtime/styles.css` declares a small set of CSS custom properties on the `.frayme-root` wrapper, and all 189 components are styled against them. The `ThemeTokens` type maps one-to-one onto those properties:

| Token | CSS variable | Example |
| --- | --- | --- |
| `primary` / `primaryForeground` | `--frayme-primary` / `--frayme-primary-fg` | `'#2563eb'` |
| `background` / `foreground` | `--frayme-bg` / `--frayme-fg` | |
| `card` / `cardForeground` | `--frayme-card` / `--frayme-card-fg` | |
| `border` | `--frayme-border` | |
| `muted` / `mutedForeground` | `--frayme-muted` / `--frayme-muted-fg` | |
| `danger` / `dangerForeground` | `--frayme-danger` / `--frayme-danger-fg` | |
| `success` / `successForeground` | `--frayme-success` / `--frayme-success-fg` | |
| `warning` / `warningForeground` | `--frayme-warning` / `--frayme-warning-fg` | |
| `info` / `infoForeground` | `--frayme-info` / `--frayme-info-fg` | |
| `accent` | `--frayme-accent` | `'#7c3aed'` |
| `accentForeground` | `--frayme-accent-fg` | |
| `radius` | `--frayme-radius` | `'0.5rem'` |
| `fontFamily` | `--frayme-font` | `'Inter, sans-serif'` |

Tone tokens are semantic: components that take a `tone` prop resolve `critical` to `danger` and `neutral` to `muted`, so you rarely need more than the pairs above.

The foreground tokens of every tone apply to the text drawn on that tone's fill, in both modes. Before 0.5.0, only `dangerForeground` reached that text. Success, warning and info text stayed white, even on the brighter fills of dark mode.

`accent` is the interactive color: a switch that is on, a selected row or option, a checked box, the focus ring. If you leave it unset, it follows the foreground color, a neutral that tracks light and dark by itself. Set it, often to the same value as `primary`, to color every interactive state at once. A state that fills with the accent and carries a label, such as a selected day or the current page, prints that label in `accentForeground`. Leave it out and it is chosen for you by comparing contrast against this accent, so a pale brand accent gets dark text instead of white text it cannot carry.

`primary` is your brand color, and the rule for it is presence. Leave it unset and it paints inline links and the first chart series, while the main action stays a neutral high-contrast fill. **Pass it and every main action wears it**: a `variant:"primary"` button, a `Link` rendered as a button, a pressed segment, an icon button, a dialog's confirm. Nothing else moves, so `secondary`, `danger`, `ghost` and `outline` keep their own treatments and the interactive states stay with `accent`.

The label on that fill comes from `primaryForeground` when you set one. Leave it out and it is chosen for you by comparing contrast against the two inks the stylesheet ships, so a pale brand color gets dark text and a deep one gets light text. Setting nothing at all changes nothing: a screen renders the neutral default until a color is passed, and the `slate` and `warm` presets follow the same rule with their own colors.

## Per-instance: the `theme` prop

```tsx
import { FraymeRenderer, type ThemeTokens } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

const theme: ThemeTokens = {
  primary: '#7c3aed',
  primaryForeground: '#ffffff',
  radius: '0.75rem',
  fontFamily: 'Inter, system-ui, sans-serif',
};

<FraymeRenderer spec={spec} theme={theme} />;
```

Tokens you set become inline CSS variables on that renderer's `.frayme-root`; anything you omit falls through to the stylesheet defaults. No global side effects, so two renderers on the same page can carry two different themes.

## Light and dark

The stylesheet ships both palettes. With no scheme set, it follows the viewer's OS through `prefers-color-scheme`. Two props let you control the mode yourself:

- **`scheme`** picks the mode. `'light'` or `'dark'` forces it and adds `frayme-light` or `frayme-dark` to the root. `'system'` follows the OS and keeps following it when the setting changes.
- **`theme`** takes a `{ light, dark }` pair (`ThemePair`) as well as a single token set. A single set applies in both modes, and a brand color picked for a white page is often unreadable on the dark one. With a pair, the renderer applies the half that matches the resolved mode. A half you leave out keeps the stylesheet's own values for that mode.

```tsx
'use client';
import type { Spec } from '@frayme/runtime';
import { FraymeRenderer, type ThemePair } from '@frayme/runtime/react';
import '@frayme/runtime/styles.css';

const theme: ThemePair = {
  light: { primary: '#7c3aed', primaryForeground: '#ffffff', accent: '#7c3aed' },
  dark: { primary: '#c4b5fd', primaryForeground: '#1e1b4b', accent: '#c4b5fd' },
};

export function Canvas({ spec }: { spec: Spec | null }) {
  return <FraymeRenderer spec={spec} theme={theme} scheme="system" />;
}
```

| `scheme` | Plain token set | `{ light, dark }` pair |
| --- | --- | --- |
| unset | Applied as is. The stylesheet follows the OS, with no class added. | Follows the OS, so the pair can pick a half. |
| `'system'` | Applied as is. The root gets the class for the OS mode. | The half for the OS mode. |
| `'light'` / `'dark'` | Applied as is, in the forced mode. | The half for the forced mode. |

`FraymeRenderer`, `FraymeActionReceipt`, `FraymeResult`, `FraymeScreen` and `FraymeProvider` all take both props. On each component, `theme` and `scheme` resolve separately: a renderer with its own `theme` still uses the provider's `scheme`. The result notices and receipt cards resolve the same way as the screen beside them, so they always paint the same mode.

On the server, `'system'` has no mode yet: neither half of a pair applies until the first client render, while the stylesheet's own defaults follow the OS. The server markup and the hydration pass therefore always match.

`scheme` decides how a spec renders. To tell Frayme which mode to compose for, send `context.theme` on the compose request. `fraymeTools({ scheme: 'dark' })` from `@frayme/api/ai-sdk` sets it on every call.

## App-wide: the provider

Set a default once and every `<FraymeRenderer>` beneath it inherits:

```tsx
import { FraymeProvider } from '@frayme/runtime/react';

<FraymeProvider theme={{ primary: '#0f766e', radius: '0.375rem' }}>
  <App />
</FraymeProvider>;
```

A `theme` prop on an individual renderer replaces the provider's theme for that instance.

The provider takes `scheme` too, and a pair set there applies to every renderer, receipt and result beneath it:

```tsx
'use client';
import type { ReactNode } from 'react';
import { FraymeProvider } from '@frayme/runtime/react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <FraymeProvider
      scheme="system"
      theme={{
        light: { primary: '#0f766e', accent: '#0f766e', radius: '0.375rem' },
        dark: { primary: '#5eead4', primaryForeground: '#042f2e', accent: '#5eead4', radius: '0.375rem' },
      }}
    >
      {children}
    </FraymeProvider>
  );
}
```

`radius` and `fontFamily` rarely change between modes, but each half of a pair is applied on its own, so a token you set in only one half is missing in the other. Repeat them in both.

## Global: plain CSS

Because the contract is CSS variables, you can skip the props entirely and theme in your stylesheet, including dark mode:

```css
.frayme-root {
  --frayme-primary: #0f766e;
  --frayme-radius: 0.375rem;
}

@media (prefers-color-scheme: dark) {
  .frayme-root {
    --frayme-bg: #0b0f14;
    --frayme-fg: #e6e9ee;
    --frayme-card: #111827;
    --frayme-border: #263241;
  }
}
```

Inline tokens from the `theme` prop win over stylesheet rules (they are element-level styles), so use one mechanism per token to keep things predictable.

A resolved scheme bypasses the media query. Whenever a mode is resolved, the root carries a `frayme-light` or `frayme-dark` class. That covers any `scheme`, including `'system'` in the browser, and a pair with no scheme. The stylesheet's rules for those classes outrank `@media (prefers-color-scheme)`, so media-query overrides like the one above stop applying. In that case, target the classes too, in a stylesheet loaded after `@frayme/runtime/styles.css`:

```css
.frayme-root.frayme-dark {
  --frayme-bg: #0b0f14;
  --frayme-fg: #e6e9ee;
}
```

For per-mode brand colors, a `theme` pair is usually simpler than CSS.

## Reading the mode yourself

To theme your own chrome to match the rendered UI, use the same helpers the renderer does:

- `useColorScheme(scheme)` from `@frayme/runtime/react` returns `'light'`, `'dark'` or `undefined`. On the server and during hydration, `'system'` gives `undefined`.
- `resolveTheme(theme, mode)` from `@frayme/runtime` returns the token set that applies in that mode.

```tsx
'use client';
import type { ReactNode } from 'react';
import { resolveTheme, type ThemePair } from '@frayme/runtime';
import { useColorScheme } from '@frayme/runtime/react';

const brand: ThemePair = {
  light: { primary: '#7c3aed', background: '#ffffff' },
  dark: { primary: '#c4b5fd', background: '#131316' },
};

export function Toolbar({ children }: { children: ReactNode }) {
  const mode = useColorScheme('system') ?? 'light';
  const tokens = resolveTheme(brand, mode);
  return <div style={{ background: tokens?.background, borderColor: tokens?.primary }}>{children}</div>;
}
```

`themeToStyle(tokens)` turns a token set into the inline `--frayme-*` variables for a root you build yourself. It produces nothing for a pair, so resolve the pair first:

```ts
import { resolveTheme, themeToStyle, type ThemeInput } from '@frayme/runtime';

export function inlineVars(theme: ThemeInput, mode: 'light' | 'dark'): Record<string, string> {
  return themeToStyle(resolveTheme(theme, mode));
}
```

`isThemePair(value)` tells the two shapes apart. It returns `true` for an object keyed by `light` and/or `dark` that has no token names.

## Per-workspace theming

For multi-tenant products, store the tokens (a single set or a `{ light, dark }` pair) as a JSON column and pass them straight through, because `ThemeInput` is plain serializable data:

```tsx
import { FraymeProvider, type ThemeInput } from '@frayme/runtime/react';

// theme is a per-workspace record: one token set, or { light, dark }
async function WorkspaceCanvas({ workspaceId }: { workspaceId: string }) {
  const workspace = await getWorkspace(workspaceId);

  return (
    <FraymeProvider theme={workspace.theme as ThemeInput} scheme="system">
      <Canvas />
    </FraymeProvider>
  );
}
```

Every screen Frayme composes for that workspace now renders in its brand with no spec-level changes. The same stored spec renders differently under each workspace's provider.

{% hint style="info" %}
Keep theming in tokens, not in prompts. Asking the model for "a purple UI" bakes color into the spec; setting `--frayme-primary` themes every current and future spec consistently and can change without recomposing anything.
{% endhint %}

## Next steps

- [Rendering](rendering.md): the rest of the renderer's props
- [Custom components](custom-components.md): your own components pick up the same variables
- [`@frayme/runtime`](../sdk/runtime.md): the theme types and helpers in the reference
