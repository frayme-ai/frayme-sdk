'use client';
/**
 * Scheme resolution for every themed surface (the renderer, the receipt, the
 * result notices): which mode is in force, and which token set applies in it.
 *
 * The stylesheet already knows both modes. With no class it follows the OS
 * through `prefers-color-scheme`; `frayme-light` / `frayme-dark` force one.
 * What it cannot know is the host's own tokens for each mode, so a `theme`
 * pair needs the mode resolved here, in React, and the class is added at the
 * same time so the stylesheet's defaults and the host's tokens always agree on
 * which mode they are painting. A palette half in one mode and half in the
 * other is the failure test/theme-tokens.test.ts exists to prevent.
 */
import { useMemo, useSyncExternalStore } from 'react';
import {
  isThemePair,
  resolveTheme,
  themeToStyle,
  type ThemeInput,
  type ThemeScheme,
  type ThemeTokens,
} from '../core/theme.js';
import { useFrayme } from './FraymeProvider.js';

const DARK_QUERY = '(prefers-color-scheme: dark)';

type Mode = 'light' | 'dark';

/** The OS dark-mode query, or undefined where there is none (a server, an old engine, jsdom). */
function darkQuery(): MediaQueryList | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
  try {
    return window.matchMedia(DARK_QUERY);
  } catch {
    return undefined;
  }
}

function subscribeSystem(onChange: () => void): () => void {
  const query = darkQuery();
  if (!query) return () => {};
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }
  // Safari before 14 only has the older listener API.
  query.addListener?.(onChange);
  return () => query.removeListener?.(onChange);
}

function systemMode(): Mode | undefined {
  const query = darkQuery();
  if (!query) return undefined;
  return query.matches ? 'dark' : 'light';
}

const subscribeNothing = (): (() => void) => () => {};
const unknownMode = (): undefined => undefined;

/**
 * The mode a `scheme` resolves to. `light` / `dark` are returned as given;
 * `system` reads the OS setting and re-renders when it changes; undefined
 * (no scheme asked for) returns undefined.
 *
 * SSR-SAFE. The server snapshot is always undefined, because a server cannot
 * see the viewer's OS. React renders the hydration pass with that same value
 * and then re-renders with the real one, so the markup never mismatches.
 */
export function useColorScheme(scheme?: ThemeScheme): Mode | undefined {
  const followSystem = scheme === 'system';
  const system = useSyncExternalStore(
    followSystem ? subscribeSystem : subscribeNothing,
    followSystem ? systemMode : unknownMode,
    unknownMode,
  );
  if (scheme === 'light' || scheme === 'dark') return scheme;
  return followSystem ? system : undefined;
}

/** The token set to apply: a pair needs a known mode, plain tokens never do. */
function tokensFor(theme: ThemeInput | undefined, mode: Mode | undefined): ThemeTokens | undefined {
  if (mode) return resolveTheme(theme, mode);
  // Mode unknown (a server render of `system`, or an engine with no
  // matchMedia): apply neither half of a pair. The stylesheet's own defaults
  // follow the OS meanwhile, and in a browser the right half lands on the
  // first client render.
  return isThemePair(theme) ? undefined : theme;
}

export interface ThemeStyle {
  /** Inline `--frayme-*` custom properties for the root element. */
  style: Record<string, string>;
  /** `frayme-light` / `frayme-dark` when a mode is in force, else undefined. */
  schemeClass: string | undefined;
}

/**
 * The shared resolution: the prop wins over the provider, separately for the
 * theme and the scheme. A pair given with no scheme anywhere follows the OS,
 * because that is the only mode the stylesheet itself would pick, and picking
 * anything else would pair the host's light tokens with the stylesheet's dark
 * defaults on a dark machine.
 */
export function useThemeStyle(theme: ThemeInput | undefined, scheme: ThemeScheme | undefined): ThemeStyle {
  const ctx = useFrayme();
  const input = theme ?? ctx.theme;
  const requested = scheme ?? ctx.scheme ?? (isThemePair(input) ? 'system' : undefined);
  const mode = useColorScheme(requested);
  const style = useMemo(() => themeToStyle(tokensFor(input, mode)), [input, mode]);
  return { style, schemeClass: mode ? `frayme-${mode}` : undefined };
}
