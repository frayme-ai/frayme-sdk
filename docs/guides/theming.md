# Theming

Every visual token in Frayme's rendered UI is a `--frayme-*` CSS variable — override them per instance with `ThemeTokens`, globally in your stylesheet, or per workspace at runtime.

## The token set

`@frayme/runtime/styles.css` styles all 189 components against a small set of CSS custom properties on the `.frayme-root` wrapper. The `ThemeTokens` type maps one-to-one onto them:

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
| `radius` | `--frayme-radius` | `'0.5rem'` |
| `fontFamily` | `--frayme-font` | `'Inter, sans-serif'` |

Tone tokens are semantic: components that take a `tone` prop resolve `critical` to `danger` and `neutral` to `muted`, so you rarely need more than the pairs above.

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

Tokens you set become inline CSS variables on that renderer's `.frayme-root`; anything you omit falls through to the stylesheet defaults. No global side effects — two renderers on the same page can carry two different themes.

## App-wide: the provider

Set a default once and every `<FraymeRenderer>` beneath it inherits:

```tsx
import { FraymeProvider } from '@frayme/runtime/react';

<FraymeProvider theme={{ primary: '#0f766e', radius: '0.375rem' }}>
  <App />
</FraymeProvider>;
```

A `theme` prop on an individual renderer replaces the provider's theme for that instance.

## Global: plain CSS

Because the contract is CSS variables, you can skip the props entirely and theme in your stylesheet — including dark mode:

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

## Per-workspace theming

For multi-tenant products, store tokens as a JSON column and pass them straight through — `ThemeTokens` is plain serializable data:

```tsx
// theme is a per-workspace record: { primary: '#…', radius: '…', … }
async function WorkspaceCanvas({ workspaceId }: { workspaceId: string }) {
  const workspace = await getWorkspace(workspaceId);

  return (
    <FraymeProvider theme={workspace.theme as ThemeTokens}>
      <Canvas />
    </FraymeProvider>
  );
}
```

Every screen Frayme composes for that workspace now renders in its brand, with no spec-level changes — the same stored spec renders differently under each workspace's provider.

{% hint style="info" %}
Keep theming in tokens, not in prompts. Asking the model for "a purple UI" bakes color into the spec; setting `--frayme-primary` themes every current and future spec consistently and can change without recomposing anything.
{% endhint %}

## Next steps

- [Rendering](rendering.md) — the rest of the renderer's props
- [Custom components](custom-components.md) — your own components pick up the same variables
