'use client';
/**
 * The one-line card FraymeResult and FraymeScreen show in place of a screen:
 * a compose that failed, or a stream that stopped before it finished.
 *
 * Its own `.frayme-root` (styles/frayme.css "Result notice"), themed through
 * the same hook as the renderer, so it sits beside a rendered screen in the
 * same mode with the same tokens. An error is an `alert` (a reader hears it at
 * once); an interruption is a `status` (announced politely, not urgently).
 * Internal: not exported from the package.
 */
import type { ReactNode } from 'react';
import type { ThemeInput, ThemeScheme } from '../core/theme.js';
import { useThemeStyle } from './color-scheme.js';

export interface FraymeNoticeProps {
  tone: 'error' | 'info';
  children: ReactNode;
  className?: string;
  theme?: ThemeInput;
  scheme?: ThemeScheme;
  /**
   * Draws a "Try again" button after the message. FraymeScreen passes it when
   * sending the failed request again could succeed; FraymeResult never does,
   * because the chat that owns the tool call owns any retry.
   */
  onRetry?: () => void;
}

export const RETRY_LABEL = 'Try again';

export function FraymeNotice({ tone, children, className, theme, scheme, onRetry }: FraymeNoticeProps): ReactNode {
  const { style, schemeClass } = useThemeStyle(theme, scheme);
  return (
    <p
      className={`frayme-root frayme-notice${schemeClass ? ` ${schemeClass}` : ''}${className ? ` ${className}` : ''}`}
      style={style}
      data-tone={tone}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="frayme-notice__message">{children}</span>
      {onRetry && (
        <button type="button" className="frayme-notice__retry" onClick={onRetry}>
          {RETRY_LABEL}
        </button>
      )}
    </p>
  );
}

/** The error's own message when it has one; a plain sentence when it does not. */
export function errorMessageOf(error: unknown): string {
  const message = (error as { message?: unknown } | null | undefined)?.message;
  return typeof message === 'string' && message.trim() !== '' ? message : 'The screen could not be composed.';
}

/**
 * Whether sending the same request again could succeed. A client error (a bad
 * body, no access, an exhausted quota) fails the same way every time, so a
 * button offering it again would only fail again; a dropped connection, a
 * timeout, a rate limit or a server-side failure may well not. An error with
 * no HTTP status never reached the server's verdict, so it counts as the
 * second kind.
 */
export function isRetryable(error: unknown): boolean {
  const { status, code } = (error ?? {}) as { status?: unknown; code?: unknown };
  if (code === 'QUOTA_EXCEEDED') return false;
  if (typeof status !== 'number') return true;
  return status === 408 || status === 429 || status >= 500;
}
