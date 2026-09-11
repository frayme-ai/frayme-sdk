'use client';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cva } from 'class-variance-authority';
import { useStateValue, type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { useLocalOrBound as useBoundProp } from './_state.js';
import { cn } from '../cn.js';
import { fontClass, leadingClass, motionClass, shadowClass, styleVars, surfaceField, surfaceInk, surfaceMuted, surfaceRaised, surfaceSunken, trackingClass, weightClass } from './_style.js';
import { hasIcon, Icon } from './icons.js';
import { safeDimension } from '@frayme/catalog/validate';

/* Catalog group: Dialog, Drawer, Tooltip, Popover
 *
 * VALUE channels land in `--fr-<component>-<role>` vars via styleVars(...); the
 * static recipe bases read them through `var(--x, <token>)` so a props-less
 * overlay still renders polished. The arbitrary classes are literal strings so
 * Tailwind compiles them. */

/* Dialog/Drawer share the modal-overlay backdrop + header/close/content chrome;
   only the surface panel differs (centered card vs. docked sheet). */
const overlay = cva(
  'fixed inset-0 z-50 flex [background:var(--fr-dialog-overlay,rgba(0,0,0,0.45))]',
  {
    variants: {
      align: {
        center: 'items-center justify-center',
        start: 'items-start justify-center pt-[10vh]',
      },
      side: {
        bottom: 'items-end justify-center',
        top: 'items-start justify-center',
        left: 'items-stretch justify-start',
        right: 'items-stretch justify-end',
      },
    },
  },
);

const dialogPanel = cva(
  // radiusValue var-chain on the panel; the radius variant sets the per-enum default
  // var, an exact radiusValue (--fr-dialog-radius) wins. Steps byte-identical to the
  // prior rounded-*: 0 / 0.25rem / radius-frayme / 1rem / 1.5rem.
  // On-surface text channel: the panel's base text reads --fr-dialog-fg with the
  // card-foreground token folded in as the var fallback (byte-identical when unset)
  // so a custom dark `bg` can carry a legible paired `color` for title + slot content.
  'relative overflow-y-auto border [background:var(--fr-dialog-bg,var(--color-card))] [border-radius:var(--fr-dialog-radius,var(--fr-dialog-radius-default,var(--radius-frayme)))] [border-color:var(--fr-dialog-border,var(--color-border))] text-[color:var(--fr-dialog-fg,var(--fr-surface-fg,var(--color-card-foreground)))] shadow-lg [width:var(--fr-dialog-w,min(28rem,calc(100vw-2rem)))] max-w-full max-h-[85vh]',
  {
    variants: {
      size: {
        sm: '[--fr-dialog-w:min(22rem,calc(100vw-2rem))]',
        md: '[--fr-dialog-w:min(28rem,calc(100vw-2rem))]',
        lg: '[--fr-dialog-w:min(40rem,calc(100vw-2rem))]',
        full: '[--fr-dialog-w:calc(100vw-2rem)]',
      },
      radius: {
        none: '[--fr-dialog-radius-default:0px]',
        sm: '[--fr-dialog-radius-default:0.25rem]',
        md: '[--fr-dialog-radius-default:var(--radius-frayme)]',
        lg: '[--fr-dialog-radius-default:1rem]',
        full: '[--fr-dialog-radius-default:1.5rem]',
      },
      padding: {
        sm: 'p-3',
        md: 'p-5',
        lg: 'p-8',
      },
    },
    defaultVariants: { size: 'md', radius: 'md', padding: 'md' },
  },
);

const drawerPanel = cva(
  // Same on-surface text channel as dialogPanel (Dialog/Drawer share the vars).
  'fixed overflow-y-auto border [background:var(--fr-dialog-bg,var(--color-card))] [border-color:var(--fr-dialog-border,var(--color-border))] text-[color:var(--fr-dialog-fg,var(--fr-surface-fg,var(--color-card-foreground)))] shadow-lg',
  {
    variants: {
      side: {
        bottom:
          'inset-x-0 bottom-0 [height:var(--fr-drawer-size,auto)] max-h-[80vh] [border-top-left-radius:var(--fr-drawer-radius,var(--radius-frayme))] [border-top-right-radius:var(--fr-drawer-radius,var(--radius-frayme))]',
        top: 'inset-x-0 top-0 [height:var(--fr-drawer-size,auto)] max-h-[80vh] [border-bottom-left-radius:var(--fr-drawer-radius,var(--radius-frayme))] [border-bottom-right-radius:var(--fr-drawer-radius,var(--radius-frayme))]',
        left: 'inset-y-0 left-0 [width:var(--fr-drawer-size,min(24rem,90vw))] max-w-full [border-top-right-radius:var(--fr-drawer-radius,var(--radius-frayme))] [border-bottom-right-radius:var(--fr-drawer-radius,var(--radius-frayme))]',
        right:
          'inset-y-0 right-0 [width:var(--fr-drawer-size,min(24rem,90vw))] max-w-full [border-top-left-radius:var(--fr-drawer-radius,var(--radius-frayme))] [border-bottom-left-radius:var(--fr-drawer-radius,var(--radius-frayme))]',
      },
      size: {
        sm: '',
        md: '',
        lg: '',
        full: '',
      },
      // radius drives the LEADING-edge corner size via --fr-drawer-radius (the docked
      // edge stays flush); md = the token default (empty → the side-class fallback).
      radius: {
        none: '[--fr-drawer-radius:0px]',
        sm: '[--fr-drawer-radius:0.375rem]',
        md: '',
        lg: '[--fr-drawer-radius:1rem]',
        full: '[--fr-drawer-radius:1.5rem]',
      },
      padding: {
        sm: 'p-3',
        md: 'p-5',
        lg: 'p-8',
      },
    },
    // size×side compound: the extent token depends on which edge the sheet docks to.
    compoundVariants: [
      { side: 'bottom', size: 'sm', class: '[--fr-drawer-size:30vh]' },
      { side: 'bottom', size: 'md', class: '[--fr-drawer-size:45vh]' },
      { side: 'bottom', size: 'lg', class: '[--fr-drawer-size:65vh]' },
      { side: 'bottom', size: 'full', class: '[--fr-drawer-size:90vh]' },
      { side: 'top', size: 'sm', class: '[--fr-drawer-size:30vh]' },
      { side: 'top', size: 'md', class: '[--fr-drawer-size:45vh]' },
      { side: 'top', size: 'lg', class: '[--fr-drawer-size:65vh]' },
      { side: 'top', size: 'full', class: '[--fr-drawer-size:90vh]' },
      { side: 'left', size: 'sm', class: '[--fr-drawer-size:min(18rem,80vw)]' },
      { side: 'left', size: 'md', class: '[--fr-drawer-size:min(24rem,90vw)]' },
      { side: 'left', size: 'lg', class: '[--fr-drawer-size:min(34rem,95vw)]' },
      { side: 'left', size: 'full', class: '[--fr-drawer-size:100vw]' },
      { side: 'right', size: 'sm', class: '[--fr-drawer-size:min(18rem,80vw)]' },
      { side: 'right', size: 'md', class: '[--fr-drawer-size:min(24rem,90vw)]' },
      { side: 'right', size: 'lg', class: '[--fr-drawer-size:min(34rem,95vw)]' },
      { side: 'right', size: 'full', class: '[--fr-drawer-size:100vw]' },
    ],
    defaultVariants: { side: 'bottom', size: 'md', radius: 'md', padding: 'md' },
  },
);

const dialogHeader = cva('mb-4 pr-8');
// Shared by Dialog + Drawer. fontSize is a single source: the baked 1.0625rem is
// the var fallback (byte-identical when unset), and an exact fontSize wins via
// --fr-dialog-fs (set per-instance on the <h3>). weight/tracking are applied LAST
// via cn() on the <h3> (font-semibold stays the default weight).
// break-words, not truncate: the panel has no fixed header height (it is
// `max-h-[85vh] overflow-y-auto`), so a long title takes a second line instead of
// having its tail deleted — a dialog whose title is clipped mid-word cannot say
// what it is asking.
const dialogTitle = cva('mb-1 break-words [font-size:var(--fr-dialog-fs,1.0625rem)] font-semibold');
const dialogDescription = cva('m-0 text-sm [color:var(--fr-dialog-muted,var(--color-muted-foreground))]');
// The × close glyph rides the SAME mutedColor channel as the description line
// (--fr-dialog-muted, muted-foreground token fallback) so a custom bg+mutedColor
// pairing keeps the close affordance visible.
// Mirrors the Banner/Callout dismiss recipe — an
// opacity-70→100 hover, a focus-visible ring, and a p-1 hit area — so the most
// keyboard-reached overlay control gains a visible hover + focus state (it had none).
const dialogClose = cva(
  'absolute right-3 top-3 inline-flex cursor-pointer appearance-none items-center justify-center rounded-frayme border-none bg-transparent p-1 text-xl leading-none opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 text-[color:var(--fr-dialog-muted,var(--color-muted-foreground))]',
);
const dialogContent = cva('flex flex-col gap-4');

function useOpenPath(openPath: string): [boolean, (next: boolean) => void] {
  // Reads come from the state store directly; useBoundProp supplies the
  // write-back channel for the same path (its value side only reflects
  // renderer-resolved props, which a raw path is not).
  const open = useStateValue(openPath) as boolean | undefined;
  const [, setOpen] = useBoundProp<boolean>(undefined, openPath);
  return [open ?? false, setOpen];
}

/**
 * Escape closes the modal surface. Dialog and Drawer had no key handling at all —
 * Popover did (its own document listener), so a reader could dismiss a popover with
 * the keyboard but was TRAPPED in a dialog, reachable only by finding the close
 * button or clicking the backdrop. For a surface that takes over the viewport that
 * is an accessibility failure, and it is what `aria-modal="true"` promises.
 *
 * TWO THINGS IT MUST NOT DO.
 *
 * Close underneath a confirm. A binding-level `confirm` renders above an open
 * dialog (z-60 over z-50) and handles its own Escape, but the event still bubbles
 * to the document — so one keypress would cancel the confirm AND close the dialog
 * the reader was still reading. It defers while `[data-fr-confirm]` is mounted.
 *
 * Close every dialog at once. Two stacked dialogs both listen, so Escape would
 * dismiss the whole stack. Only the LAST open surface in document order responds,
 * which is the one painted on top.
 */
function useEscapeToClose(active: boolean, close: () => void, hostRef: { current: HTMLElement | null }): void {
  // The handler is re-read from a ref so the listener can be registered once per
  // active spell rather than re-bound on every render that changes `close`.
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const host = hostRef;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[data-fr-confirm]')) return;   // a confirm owns this Escape
      const stack = document.querySelectorAll('[data-fr-modal]');
      if (stack.length && stack[stack.length - 1] !== host.current) return;  // not the top surface
      closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
}

export function Dialog({ element, children, emit }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title: string;
    description?: string | null;
    openPath: string;
    size?: string | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    padding?: string | null;
    align?: string | null;
    dismissable?: boolean | null;
    showClose?: boolean | null;
    bg?: string | null;
    color?: string | null;
    borderColor?: string | null;
    overlayColor?: string | null;
    width?: string | number | null;
    mutedColor?: string | null;
    shadow?: string | null;
    motion?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
    closeLabel?: string | null;
    closeIcon?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const [open, setOpen] = useOpenPath(p.openPath);
  const hostRef = useRef<HTMLDivElement | null>(null);
  // BEFORE the early return — a hook placed after `if (!open) return null` would be
  // conditional, and this surface mounts and unmounts constantly.
  useEscapeToClose(open && (p.dismissable ?? true), () => { emitWith('dismiss', { open: false }); setOpen(false); }, hostRef);
  if (!open) return null;
  const dismissable = p.dismissable ?? true;
  const showClose = p.showClose ?? true;
  // CONTENT: close affordance text + glyph. Label defaults to the English "Close";
  // the glyph NAME resolves through the closed registry, unknown/absent → literal ×.
  const closeLabel = typeof p.closeLabel === 'string' ? p.closeLabel : 'Close';
  const closeIcon = typeof p.closeIcon === 'string' && hasIcon(p.closeIcon) ? p.closeIcon : null;
  // Close = write the openPath false AND mirror the resolved dismiss into
  // spec.state/_ui so the interaction is captured for the agent (the openPath
  // write alone is invisible to the _ui state mirror).
  const close = (): void => {
    emitWith('dismiss', { open: false });
    setOpen(false);
  };
  return (
    <div
      // DEFAULT TO CENTER. `overlay` has no defaultVariants (Drawer shares it and
      // supplies `side` instead), so passing undefined applied NO align classes —
      // leaving the raw `flex`, i.e. align-items:stretch + justify-content:flex-start.
      // Every Dialog without an explicit align rendered hard against the top-left at
      // full viewport height.
      ref={hostRef}
      // Marks this as a modal layer so Escape only reaches the TOP one — two stacked
      // dialogs would otherwise both answer a single keypress.
      data-fr-modal=""
      className={cn(overlay({ align: (p.align as 'center' | 'start' | null) ?? 'center' }))}
      role="presentation"
      onClick={dismissable ? close : undefined}
      style={styleVars({ var: '--fr-dialog-overlay', value: p.overlayColor, kind: 'color' })}
    >
      <div
        className={cn(
          dialogPanel({
            size: (p.size as 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
            radius: (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
            padding: (p.padding as 'sm' | 'md' | 'lg' | null) ?? undefined,
          }),
          // shadow LAST: a set value dedupe-wins the baked shadow-lg (same tw-merge
          // group); unset → undefined → cn drops it → byte-identical shadow-lg.
          shadowClass(p.shadow),
          // OPT-IN enter animation on the mounted panel. Its own animate-*
          // group (no conflict). Unset/none → undefined → cn drops it → no animation,
          // byte-identical (panel appears instantly, exactly as before).
          motionClass(p.motion),
          // the closed Font enum → a static font-* utility on the whole panel
          // region (title + body inherit); unset → undefined → dropped (inherit the
          // theme font, byte-identical) — typography-blanket parity with Banner/Callout.
          fontClass(p.font),
          // The Dialog panel paints var(--fr-dialog-bg,var(--color-card)) UNCONDITIONALLY, and it
          // is rendered in-tree (no portal), so custom properties inherit from wherever
          // it was declared. With no authored bg the channel is RESET to the token
          // actually painted — otherwise a the dialog panel declared inside a
          // Card{bg:"#12161f"} is a #ffffff panel still carrying that navy, and every
          // consumer paints inverted: measured, its Input ground computed #252831 on
          // white. Byte-identical — this is what the unpublished chain resolved to.
          p.bg == null && '[--fr-surface:var(--color-card)] [--fr-surface-fg:var(--color-card-foreground)] [--fr-surface-muted:var(--color-muted-foreground)] [--fr-surface-sunken:var(--color-muted)] [--fr-surface-raised:var(--color-card)] [--fr-surface-field:var(--color-card)]',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={p.title}
        onClick={(e) => e.stopPropagation()}
        style={styleVars(
          { var: '--fr-dialog-bg', value: p.bg, kind: 'color' },
                // Publish the shared surface channel too — see Card/Stack/Grid. A descendant
        // compositing over "whatever is behind me" (the DataTable actions column) needs
        // the NEAREST painter, which only one shared name can give it.
        // --fr-surface alone is not enough: 61 components accept `bg` and NONE
        // derives ink from it, and 25 of them expose no `color` prop at all. The
        // paired ink is published here so the whole subtree inherits it — see
        // surfaceStyle in _style.ts.
        { var: '--fr-surface', value: p.bg, kind: 'color' },
        { var: '--fr-surface-fg', value: surfaceInk(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-surface-muted', value: surfaceMuted(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-surface-field', value: surfaceField(p.bg) as string, kind: 'raw' },
        { var: '--fr-surface-sunken', value: surfaceSunken(p.bg) as string, kind: 'raw' },
        { var: '--fr-surface-raised', value: surfaceRaised(p.bg) as string, kind: 'raw' },
          { var: '--fr-dialog-fg', value: p.color, kind: 'color' },
          { var: '--fr-dialog-border', value: p.borderColor, kind: 'color' },
          { var: '--fr-dialog-muted', value: p.mutedColor, kind: 'color' },
          { var: '--fr-dialog-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem', '%'], max: 900 } },
          // exact panel corner radius → --fr-dialog-radius wins over the per-enum default.
          { var: '--fr-dialog-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        )}
      >
        <header className={cn(dialogHeader())}>
          <h3
            className={cn(
              dialogTitle(),
              // weight/tracking/leading closed enums → static utilities LAST so a set
              // value dedupe-wins its group; unset → undefined → byte-identical.
              weightClass(p.weight),
              trackingClass(p.tracking),
              leadingClass(p.leading),
            )}
            style={styleVars({ var: '--fr-dialog-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } })}
            title={p.title || undefined}
          >
            {p.title}
          </h3>
          {p.description != null && <p className={cn(dialogDescription())}>{p.description}</p>}
          {showClose && (
            <button type="button" className={cn(dialogClose())} aria-label={closeLabel} onClick={close}>
              {closeIcon ? <Icon name={closeIcon} size={18} /> : '×'}
            </button>
          )}
        </header>
        <div className={cn(dialogContent())}>{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ element, children, emit }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title: string;
    description?: string | null;
    openPath: string;
    side?: string | null;
    size?: string | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    padding?: string | null;
    dismissable?: boolean | null;
    showClose?: boolean | null;
    bg?: string | null;
    color?: string | null;
    borderColor?: string | null;
    overlayColor?: string | null;
    sizeValue?: string | number | null;
    mutedColor?: string | null;
    shadow?: string | null;
    motion?: string | null;
    font?: string | null;
    weight?: string | null;
    tracking?: string | null;
    leading?: string | null;
    fontSize?: string | number | null;
    closeLabel?: string | null;
    closeIcon?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);
  const [open, setOpen] = useOpenPath(p.openPath);
  const hostRef = useRef<HTMLDivElement | null>(null);
  // BEFORE the early return — a hook placed after `if (!open) return null` would be
  // conditional, and this surface mounts and unmounts constantly.
  useEscapeToClose(open && (p.dismissable ?? true), () => { emitWith('dismiss', { open: false }); setOpen(false); }, hostRef);
  if (!open) return null;
  const side = (p.side as 'bottom' | 'right' | 'left' | 'top' | null) ?? 'bottom';
  const dismissable = p.dismissable ?? true;
  const showClose = p.showClose ?? true;
  // CONTENT: close affordance text + glyph (defaults: English "Close" / literal ×).
  const closeLabel = typeof p.closeLabel === 'string' ? p.closeLabel : 'Close';
  const closeIcon = typeof p.closeIcon === 'string' && hasIcon(p.closeIcon) ? p.closeIcon : null;
  // Close = write the openPath false AND mirror the resolved dismiss into
  // spec.state/_ui so the interaction is captured for the agent (the openPath
  // write alone is invisible to the _ui state mirror).
  const close = (): void => {
    emitWith('dismiss', { open: false });
    setOpen(false);
  };
  return (
    <div
      ref={hostRef}
      data-fr-modal=""
      className={cn(overlay({ side }))}
      role="presentation"
      onClick={dismissable ? close : undefined}
      style={styleVars({ var: '--fr-dialog-overlay', value: p.overlayColor, kind: 'color' })}
    >
      <div
        className={cn(
          drawerPanel({
            side,
            size: (p.size as 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
            radius: (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
            padding: (p.padding as 'sm' | 'md' | 'lg' | null) ?? undefined,
          }),
          // A spec-supplied sizeValue overrides the size×side token.
          p.sizeValue != null &&
            (side === 'bottom' || side === 'top'
              ? '[height:var(--fr-drawer-size)]'
              : '[width:var(--fr-drawer-size)] max-w-full'),
          // shadow LAST: a set value dedupe-wins the baked shadow-lg (same tw-merge
          // group); unset → undefined → cn drops it → byte-identical shadow-lg.
          shadowClass(p.shadow),
          // OPT-IN enter animation on the mounted sheet. Its own animate-*
          // group (no conflict). Unset/none → undefined → cn drops it → no animation,
          // byte-identical (sheet appears instantly, exactly as before).
          motionClass(p.motion),
          // Font blanket on the whole sheet region (title + body inherit); unset →
          // dropped (inherit the theme font, byte-identical) — parity with Dialog.
          fontClass(p.font),
          // The Drawer sheet paints var(--fr-dialog-bg,var(--color-card)) UNCONDITIONALLY, and it
          // is rendered in-tree (no portal), so custom properties inherit from wherever
          // it was declared. With no authored bg the channel is RESET to the token
          // actually painted — otherwise a the drawer sheet declared inside a
          // Card{bg:"#12161f"} is a #ffffff panel still carrying that navy, and every
          // consumer paints inverted: measured, its Input ground computed #252831 on
          // white. Byte-identical — this is what the unpublished chain resolved to.
          p.bg == null && '[--fr-surface:var(--color-card)] [--fr-surface-fg:var(--color-card-foreground)] [--fr-surface-muted:var(--color-muted-foreground)] [--fr-surface-sunken:var(--color-muted)] [--fr-surface-raised:var(--color-card)] [--fr-surface-field:var(--color-card)]',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={p.title}
        onClick={(e) => e.stopPropagation()}
        style={styleVars(
          { var: '--fr-dialog-bg', value: p.bg, kind: 'color' },
        // --fr-surface alone is not enough: 61 components accept `bg` and NONE
        // derives ink from it, and 25 of them expose no `color` prop at all. The
        // paired ink is published here so the whole subtree inherits it — see
        // surfaceStyle in _style.ts.
        { var: '--fr-surface', value: p.bg, kind: 'color' },
        { var: '--fr-surface-fg', value: surfaceInk(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-surface-muted', value: surfaceMuted(p.bg, p.color) as string, kind: 'raw' },
        { var: '--fr-surface-field', value: surfaceField(p.bg) as string, kind: 'raw' },
        { var: '--fr-surface-sunken', value: surfaceSunken(p.bg) as string, kind: 'raw' },
        { var: '--fr-surface-raised', value: surfaceRaised(p.bg) as string, kind: 'raw' },
          { var: '--fr-dialog-fg', value: p.color, kind: 'color' },
          { var: '--fr-dialog-border', value: p.borderColor, kind: 'color' },
          { var: '--fr-dialog-muted', value: p.mutedColor, kind: 'color' },
          { var: '--fr-drawer-size', value: p.sizeValue, kind: 'dim', opts: { units: ['px', 'rem', '%'] } },
          // exact leading-edge corner radius → an inline --fr-drawer-radius wins over
          // the radius enum's class-set default (inline beats the class). Unset →
          // omitted → the enum/side-class fallback holds (byte-identical).
          { var: '--fr-drawer-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        )}
      >
        <header className={cn(dialogHeader())}>
          <h3
            className={cn(
              dialogTitle(),
              // weight/tracking/leading closed enums → static utilities LAST so a set
              // value dedupe-wins its group; unset → undefined → byte-identical.
              weightClass(p.weight),
              trackingClass(p.tracking),
              leadingClass(p.leading),
            )}
            style={styleVars({ var: '--fr-dialog-fs', value: p.fontSize, kind: 'dim', opts: { units: ['px', 'rem'], min: 8, max: 96 } })}
            title={p.title || undefined}
          >
            {p.title}
          </h3>
          {p.description != null && <p className={cn(dialogDescription())}>{p.description}</p>}
          {showClose && (
            <button type="button" className={cn(dialogClose())} aria-label={closeLabel} onClick={close}>
              {closeIcon ? <Icon name={closeIcon} size={18} /> : '×'}
            </button>
          )}
        </header>
        <div className={cn(dialogContent())}>{children}</div>
      </div>
    </div>
  );
}

/* Tooltip — a real, peer-driven inverted bubble (shown on :hover /
   :focus-visible) so the exact inverted-bubble styling survives without a
   custom CSS rule. The bubble bg/text default to the dark foreground / light
   card tokens and can be overridden by the `bg`/`color` value channels. */
// inline-flex + min-h-6, not inline-block: the trigger carries tabIndex 0, so it
// is a WCAG 2.5.8 target and measured 23px around a short term — one pixel under
// the 24px floor. `align-middle` keeps it sitting on the text baseline the way
// inline-block did, so a term inside a sentence does not shift.
const tooltipTrigger = cva(
  'relative inline-flex min-h-6 items-center align-middle cursor-help underline decoration-dotted',
);
const tooltipBubble = cva(
  // bubble radius: the baked calc(var(--radius-frayme)/2) becomes the var fallback so
  // an exact radiusValue (--fr-tt-radius) wins; byte-identical when unset.
  // whitespace-nowrap DROPPED (was: "the single-line-by-contract overlay ...
  // nothing is ever clipped away"). True but incomplete — nothing was clipped
  // because it left the screen instead. An unbounded nowrap bubble rendered
  // 1158px wide and overran the render surface by 473px at 1100px, 901px at 672
  // and 1057px at 320: text no one can read, at every width.
  //
  // whitespace-normal + a cap is not a behaviour change for short content: an
  // absolutely positioned box is shrink-to-fit, so it sizes to
  // min(max-content, max-width) and a two-word tooltip still renders on one
  // line. Only sentence-length content — the case that was broken — wraps.
  //
  // cqw, not vw: .frayme-root declares container-type:inline-size, so the cap
  // follows the RENDER SURFACE. vw would read the host viewport (1400px in a
  // browser test while the surface is 272px) and cap nothing.
  'pointer-events-none absolute z-40 whitespace-normal [max-width:min(18rem,calc(100cqw-1.5rem))] [border-radius:var(--fr-tt-radius,calc(var(--radius-frayme)/2))] [background:var(--fr-tt-bg,var(--color-foreground))] [color:var(--fr-tt-color,var(--color-card))] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
  {
    variants: {
      placement: {
        top: 'bottom-[calc(100%+0.375rem)] left-1/2 -translate-x-1/2',
        bottom: 'top-[calc(100%+0.375rem)] left-1/2 -translate-x-1/2',
        left: 'right-[calc(100%+0.375rem)] top-1/2 -translate-y-1/2',
        right: 'left-[calc(100%+0.375rem)] top-1/2 -translate-y-1/2',
      },
      size: {
        sm: 'px-2.5 py-1 text-xs',
        md: 'px-3 py-1.5 text-sm',
      },
    },
    defaultVariants: { placement: 'top', size: 'sm' },
  },
);

export function Tooltip({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    content: string;
    text: string;
    placement?: string | null;
    size?: string | null;
    bg?: string | null;
    color?: string | null;
    radiusValue?: string | number | null;
    // cap on the bubble width — a sentence-length content wraps instead of
    // overflowing the viewport as one enormous nowrap line.
    maxWidthValue?: string | number | null;
    // elevation + enter-motion channels (parity with the other overlays).
    shadow?: string | null;
    motion?: string | null;
  };
  // when a maxWidthValue is supplied, the bubble wraps (whitespace-normal dedupes the
  // base whitespace-nowrap) and caps at the exact width. Unset → the nowrap default holds
  // → byte-identical.
  // Gate on VALIDITY, not presence: an invalid-unit value (e.g. "50%" on this px/rem
  // channel) is omitted by styleVars, so `whitespace-normal` + the cap must engage
  // only when the dimension validated — else the bubble wraps uncapped.
  const capped = safeDimension(p.maxWidthValue, { units: ['px', 'rem'], min: 80, max: 640 }) != null;
  return (
    <span
      className={cn('group', tooltipTrigger())}
      tabIndex={0}
      data-content={p.content}
      style={styleVars(
        { var: '--fr-tt-bg', value: p.bg, kind: 'color' },
        { var: '--fr-tt-color', value: p.color, kind: 'color' },
        // exact bubble corner radius → --fr-tt-radius (set on the trigger, cascades
        // to the bubble) wins over the baked calc fallback.
        { var: '--fr-tt-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
        // exact bubble max width (cascades to the bubble; only read when `capped`).
        { var: '--fr-tt-maxw', value: p.maxWidthValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 80, max: 640 } },
      )}
    >
      {p.text}
      <span
        className={cn(
          tooltipBubble({
            placement: (p.placement as 'top' | 'bottom' | 'left' | 'right' | null) ?? undefined,
            size: (p.size as 'sm' | 'md' | null) ?? undefined,
          }),
          // wrap + cap (LAST so whitespace-normal dedupes the base nowrap). Only
          // when a maxWidthValue is named → byte-identical single-line bubble otherwise.
          capped && 'whitespace-normal [max-width:var(--fr-tt-maxw)]',
          // shadow LAST (its own tw-merge group; the base has none) — a set value
          // lifts the bubble; unset → undefined → dropped → flat (byte-identical).
          shadowClass(p.shadow),
          // opt-in enter motion (its own animate-* group). Unset/none → dropped →
          // the current fade-in via group-hover opacity is unchanged (byte-identical).
          motionClass(p.motion),
        )}
        role="tooltip"
        aria-hidden
      >
        {p.content}
      </span>
    </span>
  );
}

const popover = cva('relative inline-block [--fr-pop-accent:var(--fr-accent)]');
const popoverTrigger = cva(
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-frayme px-4 py-2 font-medium transition',
  {
    variants: {
      triggerVariant: {
        default: 'border border-border bg-[color:var(--fr-surface-sunken,var(--color-muted))] text-foreground hover:brightness-95',
        outline:
          'border [border-color:var(--fr-pop-accent)] bg-transparent text-[color:var(--fr-pop-accent)] hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
        ghost: 'border-0 bg-transparent text-[color:var(--fr-pop-accent)] hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))]',
      },
    },
    defaultVariants: { triggerVariant: 'default' },
  },
);
const popoverContent = cva(
  // radiusValue var-chain on the panel; the radius variant sets the per-enum default
  // var, an exact radiusValue (--fr-pop-radius) wins. Steps byte-identical to the
  // prior rounded-*: 0 / 0.25rem / radius-frayme / 1rem / 1.5rem.
  'absolute z-40 border [background:var(--fr-pop-bg,var(--color-card))] [border-radius:var(--fr-pop-radius,var(--fr-pop-radius-default,var(--radius-frayme)))] [border-color:var(--fr-pop-border,var(--color-border))] text-sm shadow-md [min-width:var(--fr-pop-minw,12rem)] [width:var(--fr-pop-w,auto)] max-w-full',
  {
    variants: {
      placement: {
        bottom: 'top-[calc(100%+0.375rem)]',
        top: 'bottom-[calc(100%+0.375rem)]',
        left: 'right-[calc(100%+0.375rem)] top-0',
        right: 'left-[calc(100%+0.375rem)] top-0',
      },
      align: {
        start: 'left-0',
        center: 'left-1/2 -translate-x-1/2',
        end: 'right-0',
      },
      size: {
        sm: 'p-2.5 [--fr-pop-minw:10rem]',
        md: 'p-3 [--fr-pop-minw:12rem]',
        lg: 'p-4 [--fr-pop-minw:16rem]',
      },
      radius: {
        none: '[--fr-pop-radius-default:0px]',
        sm: '[--fr-pop-radius-default:0.25rem]',
        md: '[--fr-pop-radius-default:var(--radius-frayme)]',
        lg: '[--fr-pop-radius-default:1rem]',
        full: '[--fr-pop-radius-default:1.5rem]',
      },
    },
    defaultVariants: { placement: 'bottom', align: 'start', size: 'md', radius: 'md' },
  },
);

export function Popover({ element, emit, bindings }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    trigger: string;
    content: string;
    open?: boolean | null;
    defaultOpen?: boolean | null;
    triggerVariant?: string | null;
    placement?: string | null;
    align?: string | null;
    size?: string | null;
    radius?: string | null;
    radiusValue?: string | number | null;
    bg?: string | null;
    borderColor?: string | null;
    accent?: string | null;
    width?: string | number | null;
    shadow?: string | null;
    motion?: string | null;
  };
  // Two-source open state (mirrors the OK Collapsible pattern): a bound `open`
  // reads/drives spec.state so an external Button can toggle the panel, while
  // `defaultOpen` remains the uncontrolled starting value. setOpen routes through
  // both so every open/close lands the flag in spec.state when bound.
  const emitWith = useIntrinsicEmit(emit, element);
  const [bound, setBound] = useBoundProp<boolean>(p.open ?? undefined, bindings?.open);
  const [localOpen, setLocalOpen] = useState(p.defaultOpen ?? false);
  const open = bound ?? localOpen;
  const setOpen = (next: boolean): void => {
    // ALSO mirror the resolved open flag into spec.state/_ui via the intrinsic emit
    // so every open/close (trigger click, outside-click, Escape) is captured for the
    // agent even when no prop is bound.
    emitWith('change', { open: next });
    setBound(next);
    setLocalOpen(next);
  };
  // light-dismiss — outside-mousedown + Escape close the open popover (the
  // Toggletip listener pattern, the house reference). Re-clicking the trigger still
  // toggles it. Listeners attach ONLY while open (no cost when closed). Matches
  // Radix/shadcn Popover's light-dismiss default.
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span
      ref={ref}
      className={cn(popover())}
      data-open={open}
      style={styleVars(
        { var: '--fr-pop-bg', value: p.bg, kind: 'color' },
        { var: '--fr-pop-border', value: p.borderColor, kind: 'color' },
        { var: '--fr-pop-accent', value: p.accent, kind: 'color' },
        { var: '--fr-pop-w', value: p.width, kind: 'dim', opts: { units: ['px', 'rem'], min: 120, max: 480 } },
        // exact panel corner radius → --fr-pop-radius (set on the wrapper, cascades to
        // the content panel) wins over the panel's per-enum default var.
        { var: '--fr-pop-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
      )}
    >
      <button
        type="button"
        className={cn(
          popoverTrigger({ triggerVariant: (p.triggerVariant as 'default' | 'outline' | 'ghost' | null) ?? undefined }),
        )}
        onClick={() => setOpen(!open)}
      >
        {p.trigger}
      </button>
      {open && (
        <span
          className={cn(
            popoverContent({
              placement: (p.placement as 'bottom' | 'top' | 'left' | 'right' | null) ?? undefined,
              align: (p.align as 'start' | 'center' | 'end' | null) ?? undefined,
              size: (p.size as 'sm' | 'md' | 'lg' | null) ?? undefined,
              radius: (p.radius as 'none' | 'sm' | 'md' | 'lg' | 'full' | null) ?? undefined,
            }),
            // shadow LAST: a set value dedupe-wins the baked shadow-md (same tw-merge
            // group); unset → undefined → cn drops it → byte-identical shadow-md.
            shadowClass(p.shadow),
            // OPT-IN enter animation on the mounted content panel. Its own
            // animate-* group (no conflict). Unset/none → undefined → cn drops it → no
            // animation, byte-identical (panel appears instantly, exactly as before).
            motionClass(p.motion),
          )}
          role="dialog"
        >
          {p.content}
        </span>
      )}
    </span>
  );
}
