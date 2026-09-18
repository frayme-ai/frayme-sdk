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
  /**
   * The ink on an accent FILL: the label on a selected day, a current page, a
   * selected option. Every other colour token has its ink partner; without this
   * one an accent fill could not carry a label, because a pale brand accent under
   * the default light ink is unreadable. Leave it out and it is picked for you by
   * comparing contrast, the same way `primaryForeground` is.
   */
  accentForeground?: string;
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
  accentForeground: '--frayme-accent-fg',
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
/** The two inks the stylesheet ships for a primary fill, light and dark. */
const ON_FILL_INKS = ['#ffffff', '#0b1220'] as const;

/** sRGB relative luminance of #rgb or #rrggbb. Null for anything else, including
 *  a function notation or a var(), which a host is free to pass. */
function relLuminance(hex: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/**
 * The ink for a label sitting ON a host-supplied fill: whichever of the two
 * shipped inks has more contrast against it.
 *
 * COMPARED, not thresholded. A lightness cut-off picks wrong through the middle
 * of the range: at #615fff it chooses the dark ink at 4.1:1 where white gives
 * 4.6:1. Comparing the two ratios is right at every point, which matters because
 * this runs on a value the host chose and no build-time check can see.
 *
 * Null when the fill will not parse, and the caller then leaves the ink alone so
 * the stylesheet's own default stands.
 */
export function onFillInk(fill: string): string | null {
  const L = relLuminance(fill);
  if (L == null) return null;
  const ratio = (ink: string): number => {
    const l = relLuminance(ink) as number;
    return (Math.max(L, l) + 0.05) / (Math.min(L, l) + 0.05);
  };
  return ratio(ON_FILL_INKS[0]) >= ratio(ON_FILL_INKS[1]) ? ON_FILL_INKS[0] : ON_FILL_INKS[1];
}

export function themeToStyle(tokens: ThemeInput | undefined): Record<string, string> {
  const style: Record<string, string> = {};
  if (!tokens || typeof tokens !== 'object') return style;
  for (const [key, value] of Object.entries(tokens as ThemeTokens)) {
    // Known token names only. A light/dark pair handed over unresolved, or a
    // stray key, would otherwise land as a custom property literally named
    // "undefined" carrying an object.
    if (value != null && Object.hasOwn(TOKEN_VAR, key)) style[TOKEN_VAR[key as keyof ThemeTokens]] = value;
  }
  // THE MAIN ACTION WEARS A BRAND COLOUR ONLY WHEN ONE WAS PASSED. The button
  // family fills from var(--fr-btn-fill, var(--color-foreground)), so with
  // nothing passed the neutral high-contrast default stands exactly as before.
  // Passing `primary` is the host saying "this is my colour", so the main action
  // takes it. The test is PRESENCE, not "differs from our default": comparing
  // against the default would leave a brand whose colour happens to be the
  // default silently unstyled.
  //
  // It cannot be done in CSS, which has no way to tell a passed value from a
  // declared default. Here the token set is in hand.
  const primary = (tokens as ThemeTokens).primary;
  if (typeof primary === 'string' && primary !== '') {
    style['--fr-btn-fill'] = primary;
    const ink = (tokens as ThemeTokens).primaryForeground ?? onFillInk(primary);
    if (ink) style['--fr-btn-ink'] = ink;
  }
  // AN ACCENT FILL CAN CARRY A LABEL ONLY WITH AN INK MADE FOR IT. Every state
  // that fills with the accent (a selected day, a current page, a selected option)
  // prints its label in var(--fr-<c>-accent-text, var(--fr-accent-ink, card)).
  // Unset, the accent is the foreground and `card` is its inverse, so nothing
  // changes. Passed, the label takes an ink chosen against THIS accent, so a pale
  // brand colour gets dark text instead of white text it cannot carry.
  const accent = (tokens as ThemeTokens).accent;
  if (typeof accent === 'string' && accent !== '') {
    const ink = (tokens as ThemeTokens).accentForeground ?? onFillInk(accent);
    if (ink) style['--fr-accent-ink'] = ink;
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
