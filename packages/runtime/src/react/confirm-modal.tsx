'use client';
import type { ReactNode } from 'react';
import { Icon, hasIcon } from './registry/icons.js';

/**
 * The ONE Frayme confirmation modal — shared by BOTH confirm paths so there is a
 * single visual + config model:
 *  1. Declarative action-level confirm — any spec action binding's
 *     `confirm: { title, message, confirmLabel?, cancelLabel?, variant? }`
 *     (rendered by FraymeRenderer's ConfirmHost from json-render's pending state).
 *  2. Component-internal confirm — a component's own destructive local mutation
 *     (e.g. DataTable row/bulk delete) that must gate BEFORE it mutates.
 * Same ActionConfirm-shaped config, same look, one component.
 */
export interface FraymeConfirmConfig {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' → destructive styling on the confirm button. */
  variant?: string;
  /** Optional registry icon on the confirm button (e.g. 'trash'). */
  confirmIcon?: string;
}

export function FraymeConfirmModal({
  config,
  onConfirm,
  onCancel,
}: {
  config: FraymeConfirmConfig;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactNode {
  const danger = config.variant === 'danger';
  return (
    <div
      /* SCRIM: transparent by DEFAULT, themeable, still click-blocking.
       * No grey backdrop — only the card is painted.
       * The layer STAYS, because it does two jobs beyond looking dim: it swallows
       * clicks so the button behind cannot be pressed again while the question is
       * open, and it is what `data-fr-confirm` is attached to for the Escape
       * precedence over an open Dialog. Only the PAINT is removed.
       * LANDED ON A LIGHT DIM, not none. Fully transparent left the card floating with
       * no separation from the page — it read as unfinished rather than clean. json-render's
       * own 50% black was the other extreme: it dominates the screen and, on a dark surface,
       * turns the whole page to mud. 20% reads as "the page is waiting" without hiding it,
       * and the content behind stays readable — which matters, because the question is usually
       * ABOUT something on that page.
       * Fully overridable: set --fr-confirm-scrim to `transparent` for none, or
       * `rgb(0 0 0 / 0.5)` for the heavy classic. */
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 [background:var(--fr-confirm-scrim,rgb(0_0_0_/_0.35))]"
      // Marks this as the TOPMOST modal layer. A Dialog underneath listens for
      // Escape on the document, and this element sits above it — without a marker
      // one Escape would cancel the confirm AND close the dialog the reader was
      // still using. Dialog/Drawer skip their own Escape while this is mounted.
      data-fr-confirm=""
      role="dialog"
      aria-modal="true"
      aria-label={config.title ?? 'Confirm'}
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
    >
      {/* CARD: every visual is a themeable var with the current value as the fallback,
          so an unstyled confirm is byte-identical to before and a creator can restyle
          it without a fork. Matches how the rest of the registry themes itself
          (--fr-surface / --fr-band-authored and friends). */}
      <div
        className="w-full rounded-frayme p-5 text-left [background:var(--fr-confirm-bg,var(--fr-surface,var(--color-card)))] [border:1px_solid_var(--fr-confirm-border,var(--fr-surface-field,var(--color-border)))] [box-shadow:var(--fr-confirm-shadow,0_20px_25px_-5px_rgb(0_0_0/0.1),0_8px_10px_-6px_rgb(0_0_0/0.1))] [max-width:var(--fr-confirm-width,24rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {config.title && <h2 className="text-base font-semibold [color:var(--fr-confirm-title,var(--fr-surface-fg,var(--color-foreground)))]">{config.title}</h2>}
        {config.message && <p className="mt-2 text-sm [color:var(--fr-confirm-message,var(--fr-surface-muted,var(--color-muted-foreground)))]">{config.message}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            /* A8: the two BUTTONS are themeable now, like the card above them. Every
               var falls back to the exact token it used before — border-border,
               text-foreground, hover:bg-muted — so an unstyled confirm renders
               byte-identically and a creator can restyle the whole dialog without a
               fork. Before this, a workspace could theme the card and then watch its
               own buttons stay on the default palette inside it. */
            className="inline-flex items-center rounded-frayme px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [border:1px_solid_var(--fr-confirm-cancel-border,var(--fr-surface-field,var(--color-border)))] [background:var(--fr-confirm-cancel-bg,transparent)] [color:var(--fr-confirm-cancel-fg,var(--fr-surface-fg,var(--color-foreground)))] hover:[background:var(--fr-confirm-cancel-hover,var(--fr-surface-sunken,var(--color-muted)))]"
            onClick={onCancel}
          >
            {config.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            autoFocus
            className={
              // quiet-defaults rule. Destructive confirm (the loudest gate in the
              // SDK — DataTable row/bulk delete routes here) is now "still red but not in
              // the eyes": no resting fill, a hairline red border (30% mix), a red label +
              // glyph, the red wash only on hover. The affirmative (non-danger) confirm
              // takes Button's neutral high-contrast primary (bg-foreground/text-card),
              // not a brand slab — it is the one-primary-per-screen action.
              danger
                // Themed through --fr-confirm-danger / --fr-confirm-accent(-fg). The
                // 30%/10% mixes are kept as RATIOS of whichever colour is supplied, so
                // a themed danger keeps the quiet-defaults shape (hairline border,
                // no resting fill, wash on hover) instead of becoming a solid slab.
                ? 'inline-flex items-center gap-1.5 rounded-frayme bg-transparent px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [border:1px_solid_color-mix(in_srgb,var(--fr-confirm-danger,var(--color-danger))_30%,transparent)] [color:var(--fr-confirm-danger,var(--color-danger))] hover:[background:color-mix(in_srgb,var(--fr-confirm-danger,var(--color-danger))_10%,transparent)]'
                : 'inline-flex items-center gap-1.5 rounded-frayme border border-transparent px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [background:var(--fr-confirm-accent,var(--fr-surface-fg,var(--color-foreground)))] [color:var(--fr-confirm-accent-fg,var(--fr-surface,var(--color-card)))]'
            }
            onClick={onConfirm}
          >
            {config.confirmIcon && hasIcon(config.confirmIcon) && <Icon name={config.confirmIcon} size={14} />}
            {config.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
