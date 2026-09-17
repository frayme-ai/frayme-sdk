/**
 * THEME PAIRS AND SCHEMES: a `{ light, dark }` token pair, the `scheme` prop,
 * and the `accent` token.
 *
 * The stylesheet re-derives every default for dark, so one custom token set is
 * right in one mode only. A pair lets the host give both; the scheme decides
 * which half applies, and the matching `frayme-light` / `frayme-dark` class is
 * added in the same step so the host's tokens and the stylesheet's defaults
 * never paint two different modes at once.
 *
 * What must NOT change: a plain token set with no scheme renders exactly as it
 * did (inline vars, no mode class), and an unset `accent` leaves the neutral
 * accent the stylesheet has always had.
 */
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Spec } from '@json-render/core';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { isThemePair, resolveTheme, themeToStyle, type ThemeScheme } from '../src/core/theme.js';
import { FraymeActionReceipt } from '../src/react/action-receipt.js';
import { useColorScheme } from '../src/react/color-scheme.js';
import { FraymeProvider, type FraymeContextValue } from '../src/react/FraymeProvider.js';
import { FraymeRenderer, type FraymeRendererProps } from '../src/react/FraymeRenderer.js';
import * as root from '../src/index.js';
import * as reactEntry from '../src/react/index.js';

const spec = {
  root: 't1',
  elements: { t1: { type: 'Text', props: { text: 'hello', variant: 'body' } } },
} as unknown as Spec;

const LIGHT = { primary: '#111111', background: '#fafafa' };
const DARK = { primary: '#eeeeee', background: '#0a0a0a' };
const PAIR = { light: LIGHT, dark: DARK };

const rootOf = (container: HTMLElement) => container.querySelector('.frayme-root') as HTMLElement;
const varOf = (el: HTMLElement, name: string) => el.style.getPropertyValue(name);

/**
 * A controllable `prefers-color-scheme: dark` query. jsdom ships no
 * matchMedia at all, which is also the "engine without matchMedia" case below.
 */
function installMatchMedia(initiallyDark: boolean) {
  const state = { dark: initiallyDark };
  const listeners = new Set<() => void>();
  const query = {
    media: '(prefers-color-scheme: dark)',
    get matches() {
      return state.dark;
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  (window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => {
    expect(q).toBe('(prefers-color-scheme: dark)');
    return query;
  };
  return {
    listeners,
    setDark(dark: boolean) {
      state.dark = dark;
      for (const listener of [...listeners]) listener();
    },
  };
}

afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

describe('core theme helpers', () => {
  it('maps the accent token to --frayme-accent', () => {
    expect(themeToStyle({ accent: '#7c3aed' })).toEqual({ '--frayme-accent': '#7c3aed' });
  });

  it('ignores keys that are not tokens, so an unresolved pair writes nothing', () => {
    expect(themeToStyle(PAIR)).toEqual({});
    expect(themeToStyle({ primary: '#123456', bogus: 'x' } as never)).toEqual({ '--frayme-primary': '#123456' });
  });

  it("takes whatever a provider or prop theme holds, so themeToStyle(useFrayme().theme) still compiles", () => {
    // Type-level: this file is part of the package type-check.
    const fromProvider: FraymeContextValue['theme'] = PAIR;
    const fromProp: FraymeRendererProps['theme'] = { primary: '#123456' };
    expect(themeToStyle(fromProvider)).toEqual({});
    expect(themeToStyle(fromProp)).toEqual({ '--frayme-primary': '#123456' });
  });

  it('keeps writing every existing token exactly as before', () => {
    expect(themeToStyle({ primary: '#2563eb', radius: '0.5rem', fontFamily: 'serif' })).toEqual({
      '--frayme-primary': '#2563eb',
      '--frayme-radius': '0.5rem',
      '--frayme-font': 'serif',
    });
    expect(themeToStyle(undefined)).toEqual({});
  });

  it('isThemePair: light/dark keys and no token keys', () => {
    expect(isThemePair({ light: LIGHT })).toBe(true);
    expect(isThemePair({ dark: DARK })).toBe(true);
    expect(isThemePair(PAIR)).toBe(true);
    expect(isThemePair({ light: undefined })).toBe(true);
    // A mixed object is read as plain tokens, as it was before pairs existed.
    expect(isThemePair({ light: LIGHT, primary: '#000000' })).toBe(false);
    expect(isThemePair(LIGHT)).toBe(false);
    expect(isThemePair({})).toBe(false);
    for (const value of [null, undefined, 'light', 3, [LIGHT], ['light']]) expect(isThemePair(value)).toBe(false);
  });

  it('resolveTheme: a pair gives its matching half, plain tokens apply in both modes', () => {
    expect(resolveTheme(PAIR, 'light')).toBe(LIGHT);
    expect(resolveTheme(PAIR, 'dark')).toBe(DARK);
    expect(resolveTheme({ light: LIGHT }, 'dark')).toBeUndefined();
    expect(resolveTheme(LIGHT, 'light')).toBe(LIGHT);
    expect(resolveTheme(LIGHT, 'dark')).toBe(LIGHT);
    expect(resolveTheme(undefined, 'dark')).toBeUndefined();
  });

  it('is exported from the server-safe root and the react entry', () => {
    expect(root.isThemePair).toBe(isThemePair);
    expect(root.resolveTheme).toBe(resolveTheme);
    expect(reactEntry.useColorScheme).toBe(useColorScheme);
  });
});

function SchemeProbe({ scheme }: { scheme?: ThemeScheme }) {
  return <span data-testid="mode">{useColorScheme(scheme) ?? 'none'}</span>;
}
const modeText = (container: HTMLElement) => container.querySelector('[data-testid="mode"]')?.textContent;

describe('useColorScheme', () => {
  it('returns undefined when no scheme is asked for, and forced modes as given', () => {
    installMatchMedia(true);
    expect(modeText(render(<SchemeProbe />).container)).toBe('none');
    expect(modeText(render(<SchemeProbe scheme="light" />).container)).toBe('light');
    expect(modeText(render(<SchemeProbe scheme="dark" />).container)).toBe('dark');
  });

  it('system reads the OS setting and follows it when it changes', () => {
    const media = installMatchMedia(false);
    const { container, unmount } = render(<SchemeProbe scheme="system" />);
    expect(modeText(container)).toBe('light');
    act(() => media.setDark(true));
    expect(modeText(container)).toBe('dark');
    act(() => media.setDark(false));
    expect(modeText(container)).toBe('light');
    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it('only subscribes when following the system', () => {
    const media = installMatchMedia(true);
    render(<SchemeProbe scheme="dark" />);
    render(<SchemeProbe />);
    expect(media.listeners.size).toBe(0);
  });

  it('system is undefined with no matchMedia (never throws)', () => {
    expect(modeText(render(<SchemeProbe scheme="system" />).container)).toBe('none');
  });

  it('system is undefined in a server render, whatever the client would say', () => {
    installMatchMedia(true);
    expect(renderToString(<SchemeProbe scheme="system" />)).toContain('>none<');
    expect(renderToString(<SchemeProbe scheme="dark" />)).toContain('>dark<');
  });

  it('an unknown scheme string resolves to nothing rather than throwing', () => {
    expect(modeText(render(<SchemeProbe scheme={'sepia' as ThemeScheme} />).container)).toBe('none');
  });
});

describe('FraymeRenderer theme + scheme', () => {
  it('plain tokens and no scheme: inline vars, no mode class (unchanged)', () => {
    installMatchMedia(true);
    const el = rootOf(render(<FraymeRenderer spec={spec} mode="progressive" theme={LIGHT} />).container);
    expect(varOf(el, '--frayme-primary')).toBe('#111111');
    expect(el.classList.contains('frayme-dark')).toBe(false);
    expect(el.classList.contains('frayme-light')).toBe(false);
  });

  it('a forced scheme adds its class; plain tokens still apply', () => {
    const el = rootOf(render(<FraymeRenderer spec={spec} mode="progressive" theme={LIGHT} scheme="dark" />).container);
    expect(el.classList.contains('frayme-dark')).toBe(true);
    expect(varOf(el, '--frayme-primary')).toBe('#111111');
  });

  it('a pair applies the half that matches the forced scheme, and only that half', () => {
    const dark = rootOf(render(<FraymeRenderer spec={spec} mode="progressive" theme={PAIR} scheme="dark" />).container);
    expect(varOf(dark, '--frayme-primary')).toBe('#eeeeee');
    expect(varOf(dark, '--frayme-bg')).toBe('#0a0a0a');
    expect(dark.classList.contains('frayme-dark')).toBe(true);

    const light = rootOf(render(<FraymeRenderer spec={spec} mode="progressive" theme={PAIR} scheme="light" />).container);
    expect(varOf(light, '--frayme-primary')).toBe('#111111');
    expect(light.classList.contains('frayme-light')).toBe(true);
    expect(light.classList.contains('frayme-dark')).toBe(false);
  });

  it('a pair with a missing half leaves that mode to the stylesheet', () => {
    const el = rootOf(render(<FraymeRenderer spec={spec} mode="progressive" theme={{ light: LIGHT }} scheme="dark" />).container);
    expect(varOf(el, '--frayme-primary')).toBe('');
    expect(el.classList.contains('frayme-dark')).toBe(true);
  });

  it('a pair with no scheme follows the OS, and switches halves when the OS does', () => {
    const media = installMatchMedia(true);
    const { container } = render(<FraymeRenderer spec={spec} mode="progressive" theme={PAIR} />);
    const el = rootOf(container);
    expect(varOf(el, '--frayme-primary')).toBe('#eeeeee');
    expect(el.classList.contains('frayme-dark')).toBe(true);
    act(() => media.setDark(false));
    expect(varOf(rootOf(container), '--frayme-primary')).toBe('#111111');
    expect(rootOf(container).classList.contains('frayme-light')).toBe(true);
    expect(rootOf(container).classList.contains('frayme-dark')).toBe(false);
  });

  it('a pair with an unknown mode applies neither half (no half-flipped palette)', () => {
    // No matchMedia: the OS cannot be read, so the stylesheet's defaults stand.
    const el = rootOf(render(<FraymeRenderer spec={spec} mode="progressive" theme={PAIR} />).container);
    expect(varOf(el, '--frayme-primary')).toBe('');
    expect(el.className).not.toMatch(/frayme-(light|dark)/);
  });

  it('falls back to the provider for both theme and scheme', () => {
    const el = rootOf(
      render(
        <FraymeProvider theme={PAIR} scheme="dark">
          <FraymeRenderer spec={spec} mode="progressive" />
        </FraymeProvider>,
      ).container,
    );
    expect(varOf(el, '--frayme-primary')).toBe('#eeeeee');
    expect(el.classList.contains('frayme-dark')).toBe(true);
  });

  it('the prop wins over the provider, separately for theme and scheme', () => {
    const { container } = render(
      <FraymeProvider theme={PAIR} scheme="dark">
        <FraymeRenderer spec={spec} mode="progressive" scheme="light" />
        <FraymeRenderer spec={spec} mode="progressive" theme={{ primary: '#abcdef' }} />
      </FraymeProvider>,
    );
    const [schemeOverride, themeOverride] = [...container.querySelectorAll('.frayme-root')] as HTMLElement[];
    // provider pair, prop scheme
    expect(varOf(schemeOverride, '--frayme-primary')).toBe('#111111');
    expect(schemeOverride.classList.contains('frayme-light')).toBe(true);
    // prop tokens, provider scheme
    expect(varOf(themeOverride, '--frayme-primary')).toBe('#abcdef');
    expect(themeOverride.classList.contains('frayme-dark')).toBe(true);
  });

  it('the accent token lands as --frayme-accent on the root', () => {
    const el = rootOf(render(<FraymeRenderer spec={spec} mode="progressive" theme={{ accent: '#7c3aed' }} />).container);
    expect(varOf(el, '--frayme-accent')).toBe('#7c3aed');
  });

  it('the host className is kept alongside the mode class', () => {
    const el = rootOf(render(<FraymeRenderer spec={spec} mode="progressive" scheme="dark" className="mine" />).container);
    expect(el.classList.contains('mine')).toBe(true);
    expect(el.classList.contains('frayme-dark')).toBe(true);
  });
});

describe('FraymeActionReceipt theme + scheme', () => {
  const event = { action: 'approveRefund', params: { orderId: '4821' }, label: 'Approve' };
  const card = (container: HTMLElement) => container.querySelector('.frayme-receipt') as HTMLElement;

  it('resolves a pair by its scheme and adds the mode class', () => {
    const el = card(render(<FraymeActionReceipt event={event} theme={PAIR} scheme="dark" />).container);
    expect(varOf(el, '--frayme-primary')).toBe('#eeeeee');
    expect(el.classList.contains('frayme-dark')).toBe(true);
  });

  it('takes the provider scheme like the renderer does', () => {
    const el = card(
      render(
        <FraymeProvider scheme="light">
          <FraymeActionReceipt event={event} theme={PAIR} />
        </FraymeProvider>,
      ).container,
    );
    expect(varOf(el, '--frayme-primary')).toBe('#111111');
    expect(el.classList.contains('frayme-light')).toBe(true);
  });

  it('plain tokens and no scheme: no mode class (unchanged)', () => {
    installMatchMedia(true);
    const el = card(render(<FraymeActionReceipt event={event} theme={LIGHT} />).container);
    expect(el.className).toBe('frayme-root frayme-receipt');
  });
});

describe('stylesheet: the accent token', () => {
  // cwd-relative, as css-specificity.test.ts reads it (vitest runs from the package root).
  const css = readFileSync('src/styles/frayme.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('--fr-accent reads --frayme-accent first and keeps the foreground default', () => {
    expect(css).toMatch(/--fr-accent:\s*var\(--frayme-accent,\s*var\(--color-foreground\)\);/);
  });

  it('--frayme-accent is never declared, so an unset accent keeps the default', () => {
    expect(css).not.toMatch(/--frayme-accent\s*:/);
  });
});
