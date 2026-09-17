/**
 * Frayme theming — CSS custom properties on the `.frayme-root` wrapper.
 * Ship `@frayme/runtime/styles.css` for the defaults; override any token
 * per-instance via the `theme` prop or globally in your own stylesheet.
 */
export interface ThemeTokens {
  /** e.g. '#2563eb' */
  primary?: string;
  primaryForeground?: string;
  background?: string;
  foreground?: string;
  card?: string;
  cardForeground?: string;
  border?: string;
  muted?: string;
  mutedForeground?: string;
  danger?: string;
  dangerForeground?: string;
  /** Tone tokens — semantic intent (`tone` prop). `critical` reuses `danger`;
   * `neutral` reuses `muted`. */
  success?: string;
  successForeground?: string;
  warning?: string;
  warningForeground?: string;
  info?: string;
  infoForeground?: string;
  /**
   * The interactive accent: a switch that is on, a selected row or option, the
   * focus ring, a checked box. Unset keeps the stylesheet's neutral default,
   * which is the foreground colour and so follows light and dark by itself.
   * Set it (often to the same value as `primary`) to colour every interactive
   * state at once.
   */
  accent?: string;
  /** e.g. '0.5rem' */
  radius?: string;
  fontFamily?: string;
}

const TOKEN_VAR: Record<keyof ThemeTokens, string> = {
  primary: '--frayme-primary',
  primaryForeground: '--frayme-primary-fg',
  background: '--frayme-bg',
  foreground: '--frayme-fg',
  card: '--frayme-card',
  cardForeground: '--frayme-card-fg',
  border: '--frayme-border',
  muted: '--frayme-muted',
  mutedForeground: '--frayme-muted-fg',
  danger: '--frayme-danger',
  dangerForeground: '--frayme-danger-fg',
  success: '--frayme-success',
  successForeground: '--frayme-success-fg',
  warning: '--frayme-warning',
  warningForeground: '--frayme-warning-fg',
  info: '--frayme-info',
  infoForeground: '--frayme-info-fg',
  accent: '--frayme-accent',
  radius: '--frayme-radius',
  fontFamily: '--frayme-font',
};

/**
 * The inline `--frayme-*` custom properties for one token set.
 *
 * Typed to take any `theme` value, so `themeToStyle(useFrayme().theme)` keeps
 * compiling now that a theme may be a pair. A pair has no mode here and gives
 * no properties: pick its half first with `resolveTheme(theme, mode)`.
 */
export function themeToStyle(tokens: ThemeInput | undefined): Record<string, string> {
  const style: Record<string, string> = {};
  if (!tokens || typeof tokens !== 'object') return style;
  for (const [key, value] of Object.entries(tokens as ThemeTokens)) {
    // Known token names only. A light/dark pair handed over unresolved, or a
    // stray key, would otherwise land as a custom property literally named
    // "undefined" carrying an object.
    if (value != null && Object.hasOwn(TOKEN_VAR, key)) style[TOKEN_VAR[key as keyof ThemeTokens]] = value;
  }
  return style;
}

/**
 * Which palette to render in. `light` and `dark` force a mode (the
 * `frayme-light` / `frayme-dark` classes the stylesheet already honours);
 * `system` follows the viewer's OS setting and keeps following it when it
 * changes.
 */
export type ThemeScheme = 'light' | 'dark' | 'system';

/**
 * Separate token sets per mode. The stylesheet re-derives every default for
 * dark, so a single custom set is only right in one mode: a brand colour picked
 * for a white page is usually unreadable on the dark one. A pair lets the host
 * say both, and the renderer applies the one that matches the resolved mode.
 */
export interface ThemePair {
  light?: ThemeTokens;
  dark?: ThemeTokens;
}

/** What every `theme` prop accepts: one token set for both modes, or a pair. */
export type ThemeInput = ThemeTokens | ThemePair;

/**
 * True for a `ThemePair`: an object keyed by `light` and/or `dark` that carries
 * no token names. Checking for token names too keeps the two shapes apart even
 * if a future token were ever called something close, and means a mixed object
 * is read as plain tokens, which is how it was read before pairs existed.
 */
export function isThemePair(value: unknown): value is ThemePair {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.some((key) => key === 'light' || key === 'dark') &&
    !keys.some((key) => Object.hasOwn(TOKEN_VAR, key))
  );
}

/**
 * The token set to apply in `mode`. A pair gives its matching half (possibly
 * none, which leaves the stylesheet's own values for that mode in force); a
 * plain token set applies in both modes, exactly as it always has.
 */
export function resolveTheme(theme: ThemeInput | undefined, mode: 'light' | 'dark'): ThemeTokens | undefined {
  if (!theme) return undefined;
  if (isThemePair(theme)) return theme[mode];
  return theme;
}
