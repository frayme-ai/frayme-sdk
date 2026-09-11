'use client';
import type { Frayme } from '@frayme/api';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import type { OnDynamicAction } from '../core/events.js';
import type { ThemeTokens } from '../core/theme.js';
import type { ComponentRegistry } from './upstream.js';

export interface FraymeContextValue {
  /** A keyless proxy-mode client (or dangerouslyAllowBrowser test client) for frontend-direct compose. */
  client?: Frayme;
  theme?: ThemeTokens;
  onDynamicAction?: OnDynamicAction;
  components?: ComponentRegistry;
}

const FraymeContext = createContext<FraymeContextValue>({});

/** Optional app-level defaults for every <FraymeRenderer/> beneath it. */
export function FraymeProvider({
  children,
  ...value
}: FraymeContextValue & { children: ReactNode }): ReactNode {
  const memo = useMemo(
    () => value,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value.client, value.theme, value.onDynamicAction, value.components],
  );
  return <FraymeContext.Provider value={memo}>{children}</FraymeContext.Provider>;
}

export function useFrayme(): FraymeContextValue {
  return useContext(FraymeContext);
}
