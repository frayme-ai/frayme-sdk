'use client';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { type ComponentRenderProps } from '../upstream.js';
import { useIntrinsicEmit } from '../intrinsic.js';
import { cn } from '../cn.js';
import { styleVars, fontClass } from './_style.js';
import { clampInt } from './_num.js';
import { safeImageSrc } from './url-safety.js';
import { printFraymeRoot } from './_print.js';

/* Catalog component (print-layout): PrintLayout — paginated print-ready document.
 *
 * STATELESS pure-view: page grouping + section layout + validated colors derive
 * from props each render (SSR byte-identical). window is touched ONLY inside the
 * Print onClick, which scopes printing to THIS layout (adds `fr-printing` to
 * <html>; the frayme.css @media-print rule hides everything except the marked
 * [data-fr-print-root]). All section text renders as ESCAPED React children;
 * images pass safeImageSrc; page size / margin / font are closed enums → static
 * classes; sections + tables are capped (render-bomb guard). */

const MAX_SECTIONS = 500;
const MAX_COLS = 20;
const MAX_ROWS = 200;

const PAGE_CLASS: Record<string, string> = {
  a4: 'w-[210mm] mx-auto',
  letter: 'w-[216mm] mx-auto',
  legal: 'w-[216mm] mx-auto',
  auto: 'w-full',
};
const MARGIN_CLASS: Record<string, string> = { none: 'p-0', narrow: 'p-6', normal: 'p-10', wide: 'p-16' };

interface Field {
  label: string;
  value?: string | null;
}
interface Section {
  id?: string | null;
  kind: 'heading' | 'paragraph' | 'fields' | 'table' | 'image' | 'divider' | 'pageBreak' | 'spacer';
  text?: string | null;
  level?: number | null;
  fields?: Field[] | null;
  columns?: string[] | null;
  rows?: string[][] | null;
  src?: string | null;
  alt?: string | null;
  caption?: string | null;
}

const DEMO_SECTIONS: Section[] = [
  { kind: 'heading', text: 'Executive summary', level: 2 },
  { kind: 'paragraph', text: 'Revenue grew 24% quarter-over-quarter, driven by the Platform tier and improved retention across all segments.' },
  { kind: 'fields', fields: [{ label: 'Total revenue', value: '£1,284,000' }, { label: 'Net new customers', value: '312' }, { label: 'Churn', value: '2.1%' }] },
  { kind: 'heading', text: 'By product line', level: 3 },
  { kind: 'table', columns: ['Product', 'Revenue', 'Growth'], rows: [['Platform', '£742k', '+31%'], ['API', '£389k', '+18%'], ['Marketplace', '£153k', '+9%']] },
  { kind: 'divider' },
  { kind: 'paragraph', text: 'Prepared by Finance. Confidential — do not distribute.' },
];

/** Split sections into pages at every pageBreak; drop empty pages. */
function groupPages(secs: Section[]): Section[][] {
  const pages: Section[][] = [[]];
  for (const s of secs) {
    if (s && s.kind === 'pageBreak') {
      pages.push([]);
      continue;
    }
    if (s) pages[pages.length - 1].push(s);
  }
  const nonEmpty = pages.filter((pg) => pg.length > 0);
  return nonEmpty.length ? nonEmpty : [[]];
}

export function PrintLayout({ element, emit }: ComponentRenderProps): ReactNode {
  const p = (element.props ?? {}) as {
    title?: string | null;
    subtitle?: string | null;
    sections?: Section[] | null;
    pageSize?: string | null;
    margin?: string | null;
    showHeader?: boolean | null;
    showFooter?: boolean | null;
    showPageNumbers?: boolean | null;
    showPrintButton?: boolean | null;
    printLabel?: string | null;
    headerText?: string | null;
    footerText?: string | null;
    accent?: unknown;
    buttonColor?: unknown;
    mutedColor?: unknown;
    gridColor?: unknown;
    font?: string | null;
  };
  const emitWith = useIntrinsicEmit(emit, element);

  const provided = Array.isArray(p.sections);
  const sections = (provided ? (p.sections as Section[]) : DEMO_SECTIONS).slice(0, MAX_SECTIONS);
  const isEmpty = provided && sections.length === 0;
  const pages = groupPages(sections);
  const pageCount = pages.length;

  const pageCls = PAGE_CLASS[(p.pageSize as string) ?? 'a4'] ?? PAGE_CLASS.a4;
  const marginCls = MARGIN_CLASS[(p.margin as string) ?? 'normal'] ?? MARGIN_CLASS.normal;
  const showHeader = p.showHeader !== false;
  const showFooter = p.showFooter !== false;
  const showPageNumbers = p.showPageNumbers !== false;
  const showPrintButton = p.showPrintButton !== false;

  const vars = styleVars(
    { var: '--fr-prn-accent', value: p.accent, kind: 'color' },
    { var: '--fr-prn-btn', value: p.buttonColor, kind: 'color' },
    { var: '--fr-prn-muted', value: p.mutedColor, kind: 'color' },
    { var: '--fr-prn-grid', value: p.gridColor, kind: 'color' },
  );
  const accentRule = 'border-[color:var(--fr-prn-accent,var(--color-primary))]';
  const gridRule = 'border-[color:var(--fr-prn-grid,var(--color-border))]';
  const mutedText = 'text-[color:var(--fr-prn-muted,var(--color-muted-foreground))]';

  // Print ONLY this layout via the shared helper (registry/_print.ts): it collapses
  // the surrounding app to zero height (no blank pages) while keeping this document
  // in normal flow (long documents still paginate). See _print.ts for the mechanism.
  const printRootRef = useRef<HTMLElement>(null);
  const onPrint = (): void => {
    emitWith('commit', { reason: 'print', title: p.title ?? null, sections: sections.length, pageCount });
    printFraymeRoot(printRootRef.current);
  };

  const renderInner = (s: Section): ReactNode => {
    switch (s.kind) {
      case 'heading': {
        const level = clampInt(s.level, 1, 3, 2);
        const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3';
        const size = level === 1 ? 'text-2xl font-bold' : level === 3 ? 'text-base font-semibold' : 'text-lg font-semibold';
        return <Tag className={cn(size, 'mt-4 mb-1 border-b pb-1 first:mt-0', accentRule)}>{s.text}</Tag>;
      }
      case 'paragraph':
        return <p className="my-2 break-words text-sm leading-relaxed text-foreground">{s.text}</p>;
      case 'fields':
        return (
          <dl className="my-2 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
            {(s.fields ?? []).slice(0, 60).map((f, i) => (
              <div key={i} className="contents">
                <dt className={cn('font-medium', mutedText)}>{f.label}</dt>
                <dd className="text-foreground">{f.value ?? ''}</dd>
              </div>
            ))}
          </dl>
        );
      case 'table': {
        const cols = (s.columns ?? []).slice(0, MAX_COLS);
        const rows = (s.rows ?? []).slice(0, MAX_ROWS);
        return (
          <table className="my-3 w-full border-collapse text-sm print:text-black" aria-label={sectionAria(s)}>
            {cols.length > 0 && (
              <thead>
                <tr>
                  {cols.map((c, i) => (
                    <th key={i} scope="col" className={cn('border-b px-2 py-1.5 text-left font-semibold', gridRule, mutedText)}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {(cols.length > 0 ? cols.map((_c, ci) => r[ci]) : r.slice(0, MAX_COLS)).map((cell, ci) => (
                    <td key={ci} className={cn('border-b px-2 py-1.5 align-top text-foreground', gridRule)}>
                      {cell ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      case 'image': {
        const src = safeImageSrc(s.src); // raster data-URI / http(s) / relative; svg + blob rejected
        if (!src) return null;
        return (
          <figure className="my-3 break-inside-avoid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={s.alt ?? ''} className={cn('mx-auto block max-h-96 max-w-full rounded border object-contain print:max-h-none', gridRule)} />
            {s.caption && <figcaption className={cn('mt-1 text-center text-xs', mutedText)}>{s.caption}</figcaption>}
          </figure>
        );
      }
      case 'divider':
        return <hr className={cn('my-4 border-t', gridRule)} aria-hidden="true" />;
      case 'spacer':
        return <div className="h-6" aria-hidden="true" />;
      default:
        return null; // unknown kind → skipped, never throws
    }
  };

  let gIndex = 0;
  return (
    <article ref={printRootRef} data-fr-print-root aria-label={p.title ?? 'Document'} style={vars} className={cn('block w-full', fontClass(p.font))}>
      {showPrintButton && (
        <div className="mb-3 flex justify-end print:hidden">
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--fr-prn-btn,var(--fr-prn-accent,var(--color-foreground)))] px-3 py-1.5 text-sm font-medium text-card hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:[--tw-ring-color:color-mix(in_srgb,var(--fr-prn-btn,var(--fr-prn-accent,var(--fr-accent)))_20%,transparent)]"
          >
            {p.printLabel ?? 'Print'}
          </button>
        </div>
      )}

      {pages.map((page, pi) => (
        <div
          key={pi}
          className={cn(
            'relative mb-6 border bg-card text-foreground shadow-sm',
            'print:mb-0 print:border-0 print:bg-white print:text-black print:shadow-none',
            pi < pages.length - 1 && 'break-after-page',
            gridRule,
            pageCls,
            'max-w-full',
          )}
        >
          {showHeader && (
            <div className={cn('flex items-center justify-between border-b px-8 pt-4 pb-2 text-[11px]', gridRule, mutedText)} aria-hidden="true">
              {/* The running header looks like a fixed one-line band, but nothing
                  here depends on its height: pages are split at explicit
                  pageBreak sections, never by measured geometry, and the page box
                  sets a WIDTH (w-[210mm]) only. So the document title wraps
                  rather than losing its tail on `auto` page size or a narrow
                  host — a header that says "Q3 Financial Rev…" is worse than a
                  header two lines tall. It keeps its automatic minimum (no
                  min-w-0): a text LEAF's min-content is its longest word, and
                  below that floor break-words breaks mid-word instead. */}
              <span className="break-words font-medium" title={(p.headerText ?? p.title) || undefined}>{p.headerText ?? p.title ?? ''}</span>
            </div>
          )}

          <div className={marginCls}>
            {pi === 0 && p.title && (
              <header className={cn('mb-4 border-b-2 pb-3', accentRule)}>
                <h1 className="text-2xl font-bold text-foreground">{p.title}</h1>
                {p.subtitle && <p className={cn('mt-0.5 text-sm', mutedText)}>{p.subtitle}</p>}
              </header>
            )}
            {isEmpty && pi === 0 ? (
              <p className={cn('py-16 text-center text-sm', mutedText)}>No content</p>
            ) : (
              page.map((s) => {
                const idx = gIndex++;
                const inner = renderInner(s);
                return inner == null ? null : <div key={idx}>{inner}</div>;
              })
            )}
          </div>

          {showFooter && (
            <div className={cn('flex items-center justify-between border-t px-8 pt-2 pb-4 text-[11px]', gridRule, mutedText)}>
              {/* Same as the header band — it wraps. The page counter is the one
                  fixed token in the row, so it is shrink-0 and the footer text is
                  the item that gives — down to its own longest word (a LEAF's
                  automatic minimum), never under it. */}
              <span className="break-words" title={p.footerText || undefined}>{p.footerText ?? ''}</span>
              {showPageNumbers && (
                <span className="shrink-0 tabular-nums">
                  Page {pi + 1} of {pageCount}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </article>
  );
}

function sectionAria(s: Section): string {
  switch (s.kind) {
    case 'heading':
      return `Heading: ${s.text ?? ''}`;
    case 'table':
      return `Table, ${(s.columns ?? []).length} columns ${(s.rows ?? []).length} rows`;
    default:
      return s.kind;
  }
}
