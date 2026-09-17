'use client';
import { Frayme } from '@frayme/api';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import type { OnDynamicAction } from '../core/events.js';
import type { ThemeInput, ThemeScheme } from '../core/theme.js';
import type { ComponentRegistry } from './upstream.js';

export interface FraymeContextValue {
  /** A keyless proxy-mode client (or dangerouslyAllowBrowser test client) for frontend-direct compose. */
  client?: Frayme;
  /**
   * Your own server route that holds the API key, e.g. `/api/frayme`. When no
   * `client` is given, the provider builds a keyless client pointed at it
   * (`new Frayme({ apiKey: null, baseURL: endpoint })`), so a page needs no
   * client wiring of its own. An explicit `client` always wins.
   */
  endpoint?: string;
  /** One token set, or a `{ light, dark }` pair picked by the resolved scheme. */
  theme?: ThemeInput;
  /** `light` / `dark` force a mode; `system` follows the OS. Unset keeps the stylesheet default. */
  scheme?: ThemeScheme;
  onDynamicAction?: OnDynamicAction;
  components?: ComponentRegistry;
}

const FraymeContext = createContext<FraymeContextValue>({});

/** Optional app-level defaults for every <FraymeRenderer/> beneath it. */
export function FraymeProvider({
  children,
  ...value
}: FraymeContextValue & { children: ReactNode }): ReactNode {
  // Memoised on the endpoint, so a re-render never swaps the client out from
  // under a stream that is still reading from it.
  const endpointClient = useMemo(
    () =>
      value.client == null && value.endpoint
        ? new Frayme({ apiKey: null, baseURL: value.endpoint })
        : undefined,
    [value.client, value.endpoint],
  );
  const client = value.client ?? endpointClient;
  const memo = useMemo(
    () => ({ ...value, client }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, value.endpoint, value.theme, value.scheme, value.onDynamicAction, value.components],
  );
  return <FraymeContext.Provider value={memo}>{children}</FraymeContext.Provider>;
}

export function useFrayme(): FraymeContextValue {
  return useContext(FraymeContext);
}
