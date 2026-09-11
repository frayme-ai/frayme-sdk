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
  radius: '--frayme-radius',
  fontFamily: '--frayme-font',
};

export function themeToStyle(tokens: ThemeTokens | undefined): Record<string, string> {
  const style: Record<string, string> = {};
  if (!tokens) return style;
  for (const [key, value] of Object.entries(tokens)) {
    if (value != null) style[TOKEN_VAR[key as keyof ThemeTokens]] = value;
  }
  return style;
}
