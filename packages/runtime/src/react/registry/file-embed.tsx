'use client';
import type { CSSProperties, ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { cn } from '../cn.js';
import { styleVars, aspectClass } from './_style.js';
import { safeDimension } from '@frayme/catalog/validate';
import { safeUrl, safeImageSrc, linkTargetRel } from './url-safety.js';

/* Catalog component (file-embed): FileEmbed — PDF / Office / image document viewer.
 * PDF → native browser viewer in a sandbox="" iframe (an HTML page masquerading as a
 * PDF can't run scripts or navigate the top). Office (docx/xlsx/pptx) → the Microsoft
 * Office Online viewer at a FIXED host (view.officeapps.live.com) with the file URL as
 * an encoded query param. Image → <img> via safeImageSrc. Unknown/blocked → a fallback
 * card + "Open / Download" link. Display-only; no key stored; src via safeUrl. */

const OFFICE_HOST = 'https://view.officeapps.live.com/op/embed.aspx';
const MAX_LABEL = 200;
const cap = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, MAX_LABEL) : '');

type Kind = 'pdf' | 'office' | 'image';
function inferKind(src: string, kind: string | null | undefined): Kind {
  if (kind === 'pdf' || kind === 'office' || kind === 'image') return kind;
  const s = src.toLowerCase().split(/[?#]/)[0];
  if (/\.pdf$/.test(s)) return 'pdf';
  if (/\.(docx?|xlsx?|pptx?)$/.test(s)) return 'office';
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(s)) return 'image';
  return 'pdf'; // sensible default for a "document" viewer
}

const FileGlyph = ({ size = 22 }: { size?: number }): ReactNode => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
  </svg>
);

export function FileEmbed({ element }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    src?: string | null; kind?: string | null; title?: string | null; filename?: string | null;
    showToolbar?: boolean | null; allowDownload?: boolean | null; aspect?: string | null;
    height?: unknown; accent?: unknown; borderColor?: unknown; radiusValue?: unknown;
  };

  const rawSrc = typeof p.src === 'string' ? p.src.trim() : '';
  const url = safeUrl(rawSrc);
  const valid = /^https?:\/\//i.test(url);
  const kind = valid || rawSrc ? inferKind(rawSrc, p.kind) : inferKind('', p.kind);
  const title = cap(p.title) || 'Document';
  const filename = cap(p.filename) || (rawSrc.split(/[?#]/)[0].split('/').pop() || 'document');
  const showToolbar = p.showToolbar !== false;
  const allowDownload = p.allowDownload !== false;

  // build the framed viewer src (null → fallback card)
  let iframeSrc: string | null = null;
  let sandbox: string | undefined;
  if (valid) {
    if (kind === 'office') { iframeSrc = `${OFFICE_HOST}?src=${encodeURIComponent(url)}`; sandbox = 'allow-scripts allow-same-origin allow-popups'; }
    // PDF: the browser's native (inert) PDF viewer needs an un-sandboxed frame to load;
    // src is a creator/agent-supplied https document URL (safeUrl-gated). No key, no scripts of ours.
    else if (kind === 'pdf') { iframeSrc = url; sandbox = undefined; }
  }
  const imageSrc = kind === 'image' ? safeImageSrc(rawSrc) : null;
  const openHref = valid ? url : null;

  const heightDim = safeDimension(p.height, { units: ['px', 'rem'], min: 160, max: 1200 });
  const aspCls = heightDim ? undefined : aspectClass(p.aspect === 'auto' || p.aspect == null ? '3/4' : p.aspect) ?? 'aspect-[3/4]';
  const bodyStyle: CSSProperties = heightDim ? { height: heightDim } : {};

  const vars = styleVars(
    { var: '--fr-fe-accent', value: p.accent, kind: 'color' },
    { var: '--fr-fe-border', value: p.borderColor, kind: 'color' },
    { var: '--fr-fe-radius', value: p.radiusValue, kind: 'dim', opts: { units: ['px', 'rem'], min: 0, max: 64 } },
  );
  const headingId = `fr-fe-${filename.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'file'}`;
  const frameCls = 'w-full overflow-hidden border bg-[color:var(--fr-surface-sunken,var(--color-muted))] [border-color:var(--fr-fe-border,var(--color-border))] [border-radius:var(--fr-fe-radius,0.5rem)]';
  const openLink = (label: string): ReactNode =>
    openHref ? (
      <a href={openHref} {...linkTargetRel(true)} aria-label={`Open ${filename} in a new tab`} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))] transition-colors hover:bg-[color:var(--fr-surface-sunken,var(--color-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-fe-accent,var(--fr-accent))_20%,transparent)]">
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
      </a>
    ) : null;

  return (
    <div role="group" aria-labelledby={headingId} className="w-full" style={vars}>
      {showToolbar && (
        <div className={cn('mb-2 flex items-center gap-2', 'text-sm')}>
          <span className="shrink-0 text-[color:var(--fr-fe-accent,var(--color-primary))]" aria-hidden><FileGlyph size={18} /></span>
          {/* This span is the group's accessible NAME (aria-labelledby) and the
              only place the file is identified — the glyph and the Open link
              beside it are both shrink-0, so it is the one item that gives. It
              wraps; the toolbar has no fixed height. */}
          <span id={headingId} className="min-w-0 flex-1 break-words font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))]" title={title === 'Document' ? filename : title}>{title === 'Document' ? filename : title}</span>
          {allowDownload && openLink('Open')}
        </div>
      )}

      <div className={cn(frameCls, aspCls)} style={bodyStyle}>
        {iframeSrc ? (
          <iframe title={title} src={iframeSrc} sandbox={sandbox} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="h-full w-full border-0" />
        ) : imageSrc ? (
          <img src={imageSrc} alt={title} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="text-[color:var(--fr-fe-accent,var(--color-primary))]" aria-hidden><FileGlyph size={40} /></span>
            {/* The 18rem cap stays as a reading measure inside the centred
                placeholder (the frame is 3/4 portrait, so there is height to
                spare), but it is now a WRAPPING width: a clipped filename in a
                "preview unavailable" card defeats the card's only purpose.
                break-words also breaks the unspaced long names this hits most. */}
            <span className="max-w-[18rem] break-words text-sm font-medium text-[color:var(--fr-surface-fg,var(--color-foreground))]" title={filename}>{filename}</span>
            <span className="text-xs text-[color:var(--fr-surface-muted,var(--color-muted-foreground))]">{openHref ? 'Preview unavailable on this surface.' : 'No document provided.'}</span>
            {openLink('Open document')}
          </div>
        )}
      </div>
      {!showToolbar && allowDownload && iframeSrc && <div className="mt-2 flex justify-end">{openLink('Open')}</div>}
    </div>
  );
}
