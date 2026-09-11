'use client';
import { useState, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { useScrollEdges } from '../use-scroll-edges.js';
import { styleVars } from './_style.js';
import { safeDimension, type DimOpts } from '@frayme/catalog/validate';

/* Catalog component (notification-center): NotificationCenter — read/unread inbox.
 *
 * OWNS-THE-SET-OVERLAY: `items` is the content snapshot; the component owns a local
 * overlay (readIds, dismissedIds, activeTab, unreadOnly, openId). Re-seed on the
 * items key resets read/dismiss/open but preserves the user's tab + filter. Emits
 * are in handlers (never inside a setState updater). Escaped text; tone is a closed
 * enum → static class; items capped. */

const MAX_ITEMS = 200;
const H_OPTS: DimOpts = { units: ['px', 'rem'], min: 120, max: 800 };

const TONE_RAIL: Record<string, string> = { neutral: 'bg-border', info: 'bg-primary', success: 'bg-success', warning: 'bg-warning', critical: 'bg-danger' };
const TONE_DOT: Record<string, string> = { neutral: 'bg-muted-foreground', info: 'bg-primary', success: 'bg-success', warning: 'bg-warning', critical: 'bg-danger' };

interface Action {
  label: string;
  value?: string | null;
}
interface Item {
  id?: string | null;
  title: string;
  body?: string | null;
  category?: string | null;
  timestampLabel?: string | null;
  unread?: boolean | null;
  tone?: string | null;
  actions?: Action[] | null;
}

export function NotificationCenter({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  // Edge fades gated on real overflow (see use-scroll-edges).
  const railRef = useScrollEdges<HTMLDivElement>();
  const listRef = useScrollEdges<HTMLDivElement>();
  const p = (element.props ?? {}) as {
    items?: Item[] | null;
    categories?: { key: string; label: string }[] | null;
    showTabs?: boolean | null;
    showUnreadOnly?: boolean | null;
    markReadOnOpen?: boolean | null;
    showMarkAll?: boolean | null;
    emptyLabel?: string | null;
    maxHeight?: unknown;
    accent?: unknown;
    mutedColor?: unknown;
    showSubmit?: boolean | null;
    submitLabel?: string | null;
    readIds?: string[] | null;
    dismissedIds?: string[] | null;
    activeTab?: string | null;
    unreadOnly?: boolean | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const b = bindings as { readIds?: unknown; dismissedIds?: unknown; activeTab?: unknown; unreadOnly?: unknown } | undefined;

  const items = (Array.isArray(p.items) ? p.items : []).slice(0, MAX_ITEMS).map((it, i) => ({ ...it, id: typeof it.id === 'string' && it.id ? it.id : `n${i}`, _i: i }));
  const showTabs = p.showTabs !== false;
  const markReadOnOpen = p.markReadOnOpen !== false;
  const showMarkAll = p.showMarkAll !== false;
  const showSubmit = p.showSubmit === true;
  const submitLabel = typeof p.submitLabel === 'string' && p.submitLabel ? p.submitLabel : 'Save inbox';
  const itemsKey = JSON.stringify(p.items ?? null);

  const derivedCats = Array.isArray(p.categories) && p.categories.length
    ? p.categories
    : [...new Set(items.map((it) => it.category).filter((c): c is string => typeof c === 'string' && c !== ''))].map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) }));

  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [activeTab, setActiveTab] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(p.showUnreadOnly === true);
  const [openId, setOpenId] = useState<string | null>(null);

  // Bindable ($bindState) mirrors of the inbox overlay — the Set state above stays
  // the render source of truth; these publish the CURRENT overlay (as serializable
  // arrays / primitives) into spec.state so an external Button reads the final inbox
  // without replaying every read/dismiss/tab emit. Setters are no-ops when unbound.
  const [, setBoundRead] = useBoundProp<string[]>(p.readIds ?? undefined, b?.readIds);
  const [, setBoundDismissed] = useBoundProp<string[]>(p.dismissedIds ?? undefined, b?.dismissedIds);
  const [, setBoundTab] = useBoundProp<string>(p.activeTab ?? undefined, b?.activeTab);
  const [, setBoundUnreadOnly] = useBoundProp<boolean>(p.unreadOnly ?? undefined, b?.unreadOnly);

  useEffect(() => {
    setReadIds(new Set());
    setDismissedIds(new Set());
    setOpenId(null);
    setBoundRead([]);
    setBoundDismissed([]);
    // preserve activeTab only if it still exists
    setActiveTab((t) => (t === 'all' || derivedCats.some((c) => c.key === t) ? t : 'all'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const effUnread = (it: Item & { id: string }): boolean => !!it.unread && !readIds.has(it.id);

  const live = items.filter((it) => !dismissedIds.has(it.id));
  const inTab = (it: Item): boolean => activeTab === 'all' || it.category === activeTab;
  const visible = live.filter(inTab).filter((it) => !unreadOnly || effUnread(it as Item & { id: string }));
  const unreadInTab = (key: string): number => live.filter((it) => (key === 'all' ? true : it.category === key)).filter((it) => effUnread(it as Item & { id: string })).length;

  const vars = styleVars(
    { var: '--fr-ntf-accent', value: p.accent, kind: 'color' },
    { var: '--fr-ntf-muted', value: p.mutedColor, kind: 'color' },
  );
  // The list only becomes a scroller when the model NAMES maxHeight. Unset, it
  // renders every row: a fixed inner scroller inside an already-scrolling page
  // hides rows behind a cut edge with no affordance to find them.
  const capped = p.maxHeight != null;
  const maxH = safeDimension(p.maxHeight, H_OPTS) ?? '28rem';
  const mutedText = 'text-[color:var(--fr-ntf-muted,var(--color-muted-foreground))]';
  const ringAccent = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-ntf-accent,var(--fr-accent))_20%,transparent)]';

  const openItem = (it: Item & { id: string; _i: number }): void => {
    emitWith('select', { id: it.id, title: it.title, body: it.body ?? null, category: it.category ?? null, timestampLabel: it.timestampLabel ?? null, unread: effUnread(it) });
    setOpenId(it.id);
    if (markReadOnOpen && effUnread(it)) {
      const next = new Set(readIds).add(it.id);
      setReadIds(next);
      setBoundRead([...next]);
    }
  };
  const toggleRead = (it: Item & { id: string }): void => {
    const wasUnread = effUnread(it);
    const n = new Set(readIds);
    if (wasUnread) n.add(it.id);
    else n.delete(it.id);
    setReadIds(n);
    setBoundRead([...n]);
    emitWith('change', { name: 'read', id: it.id, value: wasUnread });
  };
  const dismissItem = (it: Item & { id: string; _i: number }): void => {
    const next = new Set(dismissedIds).add(it.id);
    setDismissedIds(next);
    setBoundDismissed([...next]);
    emitWith('dismiss', { id: it.id, title: it.title, category: it.category ?? null, index: it._i });
  };
  const markAll = (): void => {
    const ids = live.filter((it) => effUnread(it as Item & { id: string })).map((it) => it.id);
    const n = new Set(readIds);
    ids.forEach((id) => n.add(id));
    setReadIds(n);
    setBoundRead([...n]);
    emitWith('change', { name: 'markAll', value: true, ids });
  };
  const pickTab = (key: string, label: string): void => {
    setActiveTab(key);
    setBoundTab(key);
    emitWith('change', { name: 'tab', value: key, label });
  };
  const doAction = (it: Item & { id: string }, a: Action): void => {
    emitWith('commit', { id: it.id, title: it.title, category: it.category ?? null, actionValue: a.value ?? a.label, actionLabel: a.label });
  };
  // On-demand inbox snapshot: emit ONE commit carrying the full resolved overlay
  // (read / dismissed / tab / filter). Reads the in-scope Sets — never a setState
  // updater — and mirrors the same snapshot into bound spec.state.
  const submitInbox = (): void => {
    const read = [...readIds];
    const dismissed = [...dismissedIds];
    setBoundRead(read);
    setBoundDismissed(dismissed);
    setBoundTab(activeTab);
    setBoundUnreadOnly(unreadOnly);
    emitWith('commit', { readIds: read, dismissedIds: dismissed, activeTab, unreadOnly });
  };

  const tabs = [{ key: 'all', label: 'All' }, ...derivedCats];
  const anyUnread = live.some((it) => effUnread(it as Item & { id: string }));

  /* Every `text-foreground` in this component KEEPS its token — none of them
     inherit. The root below paints an OPAQUE `bg-card`, and an authored Card sets
     --fr-card-bg / --fr-card-fg (never --color-card), so the whole inbox is still
     #ffffff inside a dark card. Measured on the card the trace came from (Card
     bg:#12161f color:#e2e6f0), for the header title and each row title — the two
     nodes probed in the DOM as painting from the token: token 17.72:1, inherited
     1.25:1. The row hover (`bg-muted/40` over that card, rgb(251,251,251)) does
     not change the answer: 17.12:1 vs 1.21:1. Inheriting here would be the same
     bug pointing the other way. The two `--color-foreground` reads on the active
     tab and the submit button are BACKGROUND chains paired with `text-card`, not
     ink. */
  return (
    <div style={vars} className="w-full overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {/* the count only earns its place when rows sit below the cut */}
          {capped && visible.length > 0 && <span className={cn('text-xs tabular-nums', mutedText)}>{visible.length}</span>}
        </div>
        <div className="flex items-center gap-2">
          <label className={cn('flex min-h-7 cursor-pointer items-center gap-1.5 text-xs', mutedText)}>
            <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setBoundUnreadOnly(e.target.checked); emitWith('change', { name: 'unreadOnly', value: e.target.checked }); }} className={cn('cursor-pointer rounded border-border', ringAccent)} />
            Unread
          </label>
          {showMarkAll && (
            <button type="button" onClick={markAll} disabled={!anyUnread} className={cn('inline-flex min-h-7 cursor-pointer items-center rounded-md px-1.5 text-xs font-medium text-[color:var(--fr-ntf-accent,var(--color-primary))] hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline', ringAccent)}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* fr-tabscroll-card (frayme.css): thin scrollbar + right-edge fade so a rail
          that overflows at narrow widths reads as reachable, not cut. The -card
          variant fades to the CARD token — this rail sits on the card surface. */}
      {showTabs && tabs.length > 1 && (
        <div ref={railRef} role="tablist" aria-label="Notification categories" className="fr-tabscroll-card flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
          {tabs.map((t) => {
            const n = unreadInTab(t.key);
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => pickTab(t.key, t.label)}
                className={cn(
                  // whitespace-nowrap is EARNED here: the tab label lives in the
                  // horizontally-SCROLLING rail above, whose contract is one row of
                  // one-line tabs reachable by scroll. Nothing is clipped — the rail
                  // overflows and scrolls, it does not ellipsis the label away.
                  'flex min-h-7 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium',
                  ringAccent,
                  // quiet defaults: the active category tab is neutral
                  // high-contrast (foreground/card) by default, not a brand slab; a
                  // supplied `accent` still fills brand (focus ring stays on accent).
                  active ? 'bg-[color:var(--fr-ntf-accent,var(--color-foreground))] text-card' : cn('hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]', mutedText),
                )}
              >
                {t.label}
                {/* count badge rides the active tab's on-fill text colour → bg-card/20 */}
                {n > 0 && <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-card/20' : 'bg-[color:var(--fr-surface-sunken,var(--color-muted))]')}>{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* fr-scrollfade-y (frayme.css): the bottom fade is a scroll-attached background
          on the SCROLLER, so it is absent when the rows fit and slides away at the end
          of the scroll — it may only claim "more below" while there is more below. */}
      <div ref={listRef} className={cn('divide-y divide-border', capped && 'fr-scrollfade-y overflow-y-auto')} style={capped ? { maxHeight: maxH } : undefined}>
        {visible.length === 0 ? (
          <p className={cn('py-12 text-center text-sm', mutedText)}>{p.emptyLabel ?? "You're all caught up"}</p>
        ) : (
          visible.map((it) => {
            const unread = effUnread(it as Item & { id: string });
            const tone = (it.tone as string) ?? 'neutral';
            const railStyle: CSSProperties = {};
            return (
              <div
                key={it.id}
                className={cn('relative flex gap-3 px-3 py-3 transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]/40', unread && 'bg-[color:var(--fr-ntf-accent,var(--fr-accent))]/[0.04]')}
              >
                <span className={cn('absolute left-0 top-0 h-full w-0.5', TONE_RAIL[tone] ?? TONE_RAIL.neutral)} style={railStyle} aria-hidden="true" />
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', unread ? TONE_DOT[tone] ?? TONE_DOT.neutral : 'bg-transparent border border-border')} aria-hidden="true" />
                {/* The row body and the row actions must stay SIBLINGS: a control
                    nested inside the row <button> is invalid HTML. */}
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => openItem(it)} className={cn('block w-full cursor-pointer rounded-sm text-left', ringAccent)}>
                    <div className="flex items-start justify-between gap-2">
                      {/* titles wrap and clamp at two lines — never a hard cut */}
                      <p className={cn('min-w-0 line-clamp-2 break-words text-sm', unread ? 'font-semibold text-foreground' : 'text-foreground')} title={it.title || undefined}>{it.title}</p>
                      {it.timestampLabel && <span className={cn('shrink-0 text-[11px] tabular-nums', mutedText)}>{it.timestampLabel}</span>}
                    </div>
                    {/* body matches the title: a DECLARED two-line budget, plus break-words
                        so a long URL in the body cannot widen the row past the card */}
                    {it.body && <p className={cn('mt-0.5 line-clamp-2 break-words text-xs', mutedText)} title={it.body}>{it.body}</p>}
                  </button>
                  {it.actions && it.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {it.actions.slice(0, 4).map((a, ai) => (
                        <button
                          key={ai}
                          type="button"
                          onClick={() => doAction(it as Item & { id: string }, a)}
                          className={cn('inline-flex min-h-7 cursor-pointer items-center rounded border border-border px-2 text-[11px] font-medium text-foreground hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]', ringAccent)}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-center gap-0.5">
                  <button type="button" onClick={() => dismissItem(it)} aria-label="Dismiss" className={cn('inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]', mutedText, ringAccent)}>✕</button>
                  <button type="button" onClick={() => toggleRead(it as Item & { id: string })} aria-label={unread ? 'Mark read' : 'Mark unread'} className={cn('inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-[10px] hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]', mutedText, ringAccent)}>
                    {unread ? '●' : '○'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* On-demand inbox submit — opt-in single commit of the full read/dismiss/tab
          overlay, so an agent gets one snapshot without replaying every interaction. */}
      {showSubmit && (
        <div className="flex justify-end border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={submitInbox}
            className={cn('inline-flex min-h-7 cursor-pointer items-center justify-center rounded-md bg-[color:var(--fr-ntf-accent,var(--color-foreground))] px-3 py-1.5 text-sm font-medium text-card hover:opacity-90 focus-visible:ring-offset-2', ringAccent)}
          >
            {submitLabel}
          </button>
        </div>
      )}
    </div>
  );
}
