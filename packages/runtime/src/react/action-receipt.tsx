'use client';
/**
 * THE ACTION RECEIPT — the card a host shows in the chat thread when a control
 * fires a declared action.
 *
 *   <FraymeActionReceipt event={event} />
 *
 * Content is the pure model in core/receipt.ts (title = the control's label
 * verbatim, else the humanized action name; the host's description, or no line;
 * a key/value table of the params; state only on request). This file is the DOM
 * and the theme wiring, nothing else.
 *
 * THEMED EXACTLY LIKE THE RENDERER'S DEFAULT. The card is its own `.frayme-root`
 * — the same class FraymeRenderer puts on its wrapper, so the token block in
 * styles/frayme.css (light, `prefers-color-scheme: dark`, `[data-theme]`, the
 * presets) applies to it verbatim, and `themeToStyle(theme ?? provider theme)`
 * lands on it exactly as it lands on a rendered spec beside it. `.frayme-root`
 * PAINTS the page ground (`--frayme-bg`) — deliberately, see the token block —
 * which a card in a thread must not drag along, so `.frayme-receipt` re-paints
 * the CARD surface (`--frayme-card` / `--frayme-card-fg`) at higher specificity.
 * The same override is what makes it read as a card and not a page.
 *
 * A GROUP, NOT A LANDMARK. The root carries `role="group"`
 * (for `section` / `div`) named by its own heading through `aria-labelledby`,
 * never `aria-label` on a bare `<section>`: a named section maps to a `region`
 * LANDMARK, and a thread of N presses would add N landmarks and bury the host's
 * real ones in a reader's navigation list — the exact reasoning the scroller
 * audit recorded (test/scroll-keys-a11y.test.tsx: "group everywhere, never
 * region"). A named `<div>` is `generic`, where ARIA 1.2 prohibits naming, so
 * the group role is what makes `as="div"` valid at all. `article` / `aside` /
 * `li` keep their native roles. `aria-labelledby` also keeps the accessible
 * name byte-identical to the VISIBLE, verbatim title. The state `<pre>` is a
 * scrollport (frayme.css caps it at 20rem) and so is a focusable, named group
 * — the house contract for every scroller (WCAG 2.1.1; CodeBlock's <pre> has
 * the same shape) — and the title's heading level is the host's to set, since
 * the runtime cannot know the thread's outline.
 *
 * NEVER RE-CASES the title or the values, never throws: an event with no label,
 * no description and no params renders the humanized action name and nothing
 * under it; a `state` that `JSON.stringify` rejects (a BigInt, a cycle) still
 * renders, through the same cycle-safe formatter the params use.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useId, useMemo } from 'react';
import type { DynamicActionEvent } from '../core/events.js';
import { receiptModel, type ReceiptEvent } from '../core/receipt.js';
import { themeToStyle, type ThemeTokens } from '../core/theme.js';
import { formatValue } from '../core/thread-text.js';
import { useFrayme } from './FraymeProvider.js';

export interface FraymeActionReceiptProps {
  /** The dispatched event (`onDynamicAction`'s argument) — or just its receipt slice. */
  event: DynamicActionEvent | ReceiptEvent;
  /**
   * Show `event.state` in a collapsed `<details>` under the table. Default false:
   * state stays OFF the card (it is in the payload the agent reads).
   */
  showState?: boolean;
  /** Per-instance theme tokens — same contract as `<FraymeRenderer theme>`; falls back to the provider's. */
  theme?: ThemeTokens;
  /** Lands as `data-theme` on the root (`'dark'` / `'light'` / a preset name) — the stylesheet's forced-mode hook. */
  dataTheme?: string;
  /** Extra class on the root (e.g. `frayme-dark`, which the stylesheet also honours). */
  className?: string;
  /** Param keys to leave off the table (e.g. a `rows` snapshot the host already shows). */
  omitKeys?: readonly string[];
  /**
   * The root element. Default `section`. `section` and `div` carry
   * `role="group"` named by the title (never a `region` landmark — see the
   * module note); `article` / `aside` / `li` keep their native roles.
   */
  as?: 'section' | 'div' | 'article' | 'aside' | 'li';
  /**
   * The title's heading level. Default 3. Set it to fit the thread's outline —
   * a card under `<h2>` messages wants 3, one inside an `<h3>` turn wants 4.
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}

/**
 * The state block's text. `JSON.stringify` throws on a BigInt and on a cycle,
 * and `event.state` is whatever the host put on the event (core/receipt.ts hands
 * it through by identity), so the pretty JSON is attempted and the cycle-safe
 * `formatValue` is the fallback — never a throw from event content.
 */
function stateText(state: unknown): string {
  try {
    return JSON.stringify(state, null, 2) ?? formatValue(state);
  } catch {
    return formatValue(state);
  }
}

export function FraymeActionReceipt({
  event,
  showState = false,
  theme,
  dataTheme,
  className,
  omitKeys,
  as = 'section',
  headingLevel = 3,
}: FraymeActionReceiptProps): ReactNode {
  const ctx = useFrayme();
  const titleId = useId();
  const model = useMemo(
    () => receiptModel(event, { omitKeys, includeState: showState }),
    [event, omitKeys, showState],
  );
  // Same resolution as FraymeRenderer: the instance's tokens over the provider's.
  const style = useMemo(() => themeToStyle(theme ?? ctx.theme) as CSSProperties, [theme, ctx.theme]);
  const Tag = as as 'section';
  const Heading = `h${headingLevel}` as 'h3';
  // A malformed event with no action has an empty title (core/receipt.ts): no
  // accessible name then, rather than a name that reads as nothing.
  const named = model.title !== '';
  return (
    <Tag
      className={`frayme-root frayme-receipt${className ? ` ${className}` : ''}`}
      style={style}
      data-theme={dataTheme}
      role={as === 'section' || as === 'div' ? 'group' : undefined}
      aria-labelledby={named ? titleId : undefined}
    >
      <Heading id={titleId} className="frayme-receipt__title">{model.title}</Heading>
      {model.description !== undefined && <p className="frayme-receipt__description">{model.description}</p>}
      {model.rows.length > 0 && (
        <table className="frayme-receipt__params">
          <tbody>
            {model.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showState && model.state !== undefined && (
        <details className="frayme-receipt__state">
          <summary>State</summary>
          {/* A scrollport: focusable AND named, or a keyboard user cannot reach
              what is past the 20rem cap (the focus floor in frayme.css paints
              the ring for `[tabindex]`). */}
          <pre tabIndex={0} role="group" aria-label="State">{stateText(model.state)}</pre>
        </details>
      )}
    </Tag>
  );
}
