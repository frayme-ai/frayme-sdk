/**
 * The CLOSED icon registry — a small lucide-style glyph subset resolved by NAME.
 *
 * SECURITY (non-negotiable #1, master §4.6): the `icon`/`icons` props are plain
 * CONTENT strings carrying a glyph NAME, NEVER raw SVG. A name is looked up in
 * this fixed map; a KNOWN name renders our own author-controlled `<svg>`, an
 * UNKNOWN name renders NOTHING (graceful — no icon, no crash, no markup from
 * spec input ever reaches the DOM). The SVG markup is OURS, not the model's, so
 * there is no injection surface — the model only ever names an entry.
 *
 * Glyph paths are the lucide 24×24 outline geometry (stroke-based: width 2,
 * round caps/joins, no fill). ~45 high-frequency glyphs (master open #2 proposed
 * 40-60). Add a glyph = add one entry here; the schema stays a bare `z.string()`.
 */
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { safeImageSrc } from './url-safety.js';

/** An `icon` value that is an image URL (http/https or a raster data: URI) rather
 *  than a registry NAME — enables ANY custom/brand icon, still injection-safe (it
 *  renders as a URL-guarded <img>, never raw SVG). */
function isUrlIcon(name: string): boolean {
  return /^https?:\/\//i.test(name) || /^data:image\//i.test(name);
}

/** name → the inner SVG markup (paths/lines/circles) of a 24×24 lucide glyph. */
const ICONS: Record<string, string> = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-up': '<path d="m18 15-6-6-6 6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-left': '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  'arrow-up-right': '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  'external-link':
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  settings:
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  trash:
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
  'more-horizontal':
    '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'more-vertical':
    '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'alert-triangle':
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'alert-circle': '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  star: '<path d="M11.5 2.6 8.9 8 3 8.7l4.3 4.1L6.2 19 11.5 16l5.3 3-1.1-6.2L20 8.7 14.1 8z"/>',
  heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  calendar:
    '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54Z"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  clipboard:
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  paperclip:
    '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  link:
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  image:
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  'refresh-cw':
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  sparkles:
    '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
  italic: '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
  underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  'credit-card':
    '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  'arrow-down-right': '<path d="m7 7 10 10" /> <path d="M17 7v10H7" />',
  'chevrons-left': '<path d="m11 17-5-5 5-5" /> <path d="m18 17-5-5 5-5" />',
  'chevrons-right': '<path d="m6 17 5-5-5-5" /> <path d="m13 17 5-5-5-5" />',
  'chevrons-up-down': '<path d="m7 15 5 5 5-5" /> <path d="m7 9 5-5 5 5" />',
  'move': '<path d="M12 2v20" /> <path d="m15 19-3 3-3-3" /> <path d="m19 9 3 3-3 3" /> <path d="M2 12h20" /> <path d="m5 9-3 3 3 3" /> <path d="m9 5 3-3 3 3" />',
  'maximize': '<path d="M8 3H5a2 2 0 0 0-2 2v3" /> <path d="M21 8V5a2 2 0 0 0-2-2h-3" /> <path d="M3 16v3a2 2 0 0 0 2 2h3" /> <path d="M16 21h3a2 2 0 0 0 2-2v-3" />',
  'minimize': '<path d="M8 3v3a2 2 0 0 1-2 2H3" /> <path d="M21 8h-3a2 2 0 0 1-2-2V3" /> <path d="M3 16h3a2 2 0 0 1 2 2v3" /> <path d="M16 21v-3a2 2 0 0 1 2-2h3" />',
  'expand': '<path d="m15 15 6 6" /> <path d="m15 9 6-6" /> <path d="M21 16v5h-5" /> <path d="M21 8V3h-5" /> <path d="M3 16v5h5" /> <path d="m3 21 6-6" /> <path d="M3 8V3h5" /> <path d="M9 9 3 3" />',
  'shrink': '<path d="m15 15 6 6m-6-6v4.8m0-4.8h4.8" /> <path d="M9 19.8V15m0 0H4.2M9 15l-6 6" /> <path d="M15 4.2V9m0 0h4.8M15 9l6-6" /> <path d="M9 4.2V9m0 0H4.2M9 9 3 3" />',
  'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /> <path d="m15 5 4 4" />',
  'trash-2': '<path d="M10 11v6" /> <path d="M14 11v6" /> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /> <path d="M3 6h18" /> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
  'save-all': '<path d="M10 2v3a1 1 0 0 0 1 1h5" /> <path d="M18 18v-6a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6" /> <path d="M18 22H4a2 2 0 0 1-2-2V6" /> <path d="M8 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9.172a2 2 0 0 1 1.414.586l2.828 2.828A2 2 0 0 1 22 6.828V16a2 2 0 0 1-2.01 2z" />',
  'scissors': '<circle cx="6" cy="6" r="3" /> <path d="M8.12 8.12 12 12" /> <path d="M20 4 8.12 15.88" /> <circle cx="6" cy="18" r="3" /> <path d="M14.8 14.8 20 20" />',
  'share': '<path d="M12 2v13" /> <path d="m16 6-4-4-4 4" /> <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />',
  'share-2': '<circle cx="18" cy="5" r="3" /> <circle cx="6" cy="12" r="3" /> <circle cx="18" cy="19" r="3" /> <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /> <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />',
  'rotate-cw': '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /> <path d="M21 3v5h-5" />',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" />',
  'undo': '<path d="M3 7v6h6" /> <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />',
  'redo': '<path d="M21 7v6h-6" /> <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />',
  'printer': '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /> <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" /> <rect x="6" y="14" width="12" height="8" rx="1" />',
  'sliders': '<path d="M10 8h4" /> <path d="M12 21v-9" /> <path d="M12 8V3" /> <path d="M17 16h4" /> <path d="M19 12V3" /> <path d="M19 21v-5" /> <path d="M3 14h4" /> <path d="M5 10V3" /> <path d="M5 21v-7" />',
  'sliders-horizontal': '<path d="M10 5H3" /> <path d="M12 19H3" /> <path d="M14 3v4" /> <path d="M16 17v4" /> <path d="M21 12h-9" /> <path d="M21 19h-5" /> <path d="M21 5h-7" /> <path d="M8 10v4" /> <path d="M8 12H3" />',
  'plus-circle': '<circle cx="12" cy="12" r="10" /> <path d="M8 12h8" /> <path d="M12 8v8" />',
  'minus-circle': '<circle cx="12" cy="12" r="10" /> <path d="M8 12h8" />',
  'x-circle': '<circle cx="12" cy="12" r="10" /> <path d="m15 9-6 6" /> <path d="m9 9 6 6" />',
  'circle-check': '<circle cx="12" cy="12" r="10" /> <path d="m9 12 2 2 4-4" />',
  'circle-x': '<circle cx="12" cy="12" r="10" /> <path d="m15 9-6 6" /> <path d="m9 9 6 6" />',
  'circle-alert': '<circle cx="12" cy="12" r="10" /> <line x1="12" x2="12" y1="8" y2="12" /> <line x1="12" x2="12.01" y1="16" y2="16" />',
  'file': '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /> <path d="M14 2v5a1 1 0 0 0 1 1h5" />',
  'file-text': '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /> <path d="M14 2v5a1 1 0 0 0 1 1h5" /> <path d="M10 9H8" /> <path d="M16 13H8" /> <path d="M16 17H8" />',
  'file-plus': '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /> <path d="M14 2v5a1 1 0 0 0 1 1h5" /> <path d="M9 15h6" /> <path d="M12 18v-6" />',
  'files': '<path d="M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" /> <path d="M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z" /> <path d="M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1" />',
  'folder': '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />',
  'folder-open': '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />',
  'folder-plus': '<path d="M12 10v6" /> <path d="M9 13h6" /> <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />',
  'archive': '<rect width="20" height="5" x="2" y="3" rx="1" /> <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /> <path d="M10 12h4" />',
  'book': '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />',
  'book-open': '<path d="M12 7v14" /> <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />',
  'bookmark': '<path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />',
  'clipboard-list': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /> <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /> <path d="M12 11h4" /> <path d="M12 16h4" /> <path d="M8 11h.01" /> <path d="M8 16h.01" />',
  'clipboard-check': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /> <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /> <path d="m9 14 2 2 4-4" />',
  'clipboard-copy': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /> <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /> <path d="M16 4h2a2 2 0 0 1 2 2v4" /> <path d="M21 14H11" /> <path d="m15 10-4 4 4 4" />',
  'play': '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />',
  'pause': '<rect x="14" y="3" width="5" height="18" rx="1" /> <rect x="5" y="3" width="5" height="18" rx="1" />',
  'square-play': '<rect x="3" y="3" width="18" height="18" rx="2" /> <path d="M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z" />',
  'circle-play': '<path d="M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z" /> <circle cx="12" cy="12" r="10" />',
  'skip-forward': '<path d="M21 4v16" /> <path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" />',
  'skip-back': '<path d="M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z" /> <path d="M3 20V4" />',
  'fast-forward': '<path d="M12 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 12 18z" /> <path d="M2 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 2 18z" />',
  'rewind': '<path d="M12 6a2 2 0 0 0-3.414-1.414l-6 6a2 2 0 0 0 0 2.828l6 6A2 2 0 0 0 12 18z" /> <path d="M22 6a2 2 0 0 0-3.414-1.414l-6 6a2 2 0 0 0 0 2.828l6 6A2 2 0 0 0 22 18z" />',
  'volume': '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />',
  'volume-1': '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /> <path d="M16 9a5 5 0 0 1 0 6" />',
  'volume-2': '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /> <path d="M16 9a5 5 0 0 1 0 6" /> <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />',
  'volume-x': '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /> <line x1="22" x2="16" y1="9" y2="15" /> <line x1="16" x2="22" y1="9" y2="15" />',
  'mic': '<path d="M12 19v3" /> <path d="M19 10v2a7 7 0 0 1-14 0v-2" /> <rect x="9" y="2" width="6" height="13" rx="3" />',
  'mic-off': '<path d="M12 19v3" /> <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" /> <path d="M16.95 16.95A7 7 0 0 1 5 12v-2" /> <path d="M18.89 13.23A7 7 0 0 0 19 12v-2" /> <path d="m2 2 20 20" /> <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />',
  'video': '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /> <rect x="2" y="6" width="14" height="12" rx="2" />',
  'video-off': '<path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196" /> <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" /> <path d="m2 2 20 20" />',
  'camera': '<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" /> <circle cx="12" cy="13" r="3" />',
  'music': '<path d="M9 18V5l12-2v13" /> <circle cx="6" cy="18" r="3" /> <circle cx="18" cy="16" r="3" />',
  'headphones': '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />',
  'film': '<rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M7 3v18" /> <path d="M3 7.5h4" /> <path d="M3 12h18" /> <path d="M3 16.5h4" /> <path d="M17 3v18" /> <path d="M17 7.5h4" /> <path d="M17 16.5h4" />',
  'images': '<path d="m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16" /> <path d="M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2" /> <circle cx="13" cy="7" r="1" fill="currentColor" /> <rect x="8" y="2" width="14" height="14" rx="2" />',
  'message-square': '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />',
  'message-circle': '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />',
  'mail-open': '<path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z" /> <path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" />',
  'phone': '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />',
  'phone-call': '<path d="M13 2a9 9 0 0 1 9 9" /> <path d="M13 6a5 5 0 0 1 5 5" /> <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />',
  'phone-off': '<path d="M10.1 13.9a14 14 0 0 0 3.732 2.668 1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2 18 18 0 0 1-12.728-5.272" /> <path d="M22 2 2 22" /> <path d="M4.76 13.582A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 .244.473" />',
  'bell-off': '<path d="M10.268 21a2 2 0 0 0 3.464 0" /> <path d="M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742" /> <path d="m2 2 20 20" /> <path d="M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05" />',
  'at-sign': '<circle cx="12" cy="12" r="4" /> <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />',
  'hash': '<line x1="4" x2="20" y1="9" y2="9" /> <line x1="4" x2="20" y1="15" y2="15" /> <line x1="10" x2="8" y1="3" y2="21" /> <line x1="16" x2="14" y1="3" y2="21" />',
  'link-2': '<path d="M9 17H7A5 5 0 0 1 7 7h2" /> <path d="M15 7h2a5 5 0 1 1 0 10h-2" /> <line x1="8" x2="16" y1="12" y2="12" />',
  'globe': '<circle cx="12" cy="12" r="10" /> <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /> <path d="M2 12h20" />',
  'wifi': '<path d="M12 20h.01" /> <path d="M2 8.82a15 15 0 0 1 20 0" /> <path d="M5 12.859a10 10 0 0 1 14 0" /> <path d="M8.5 16.429a5 5 0 0 1 7 0" />',
  'wifi-off': '<path d="M12 20h.01" /> <path d="M8.5 16.429a5 5 0 0 1 7 0" /> <path d="M5 12.859a10 10 0 0 1 5.17-2.69" /> <path d="M19 12.859a10 10 0 0 0-2.007-1.523" /> <path d="M2 8.82a15 15 0 0 1 4.177-2.643" /> <path d="M22 8.82a15 15 0 0 0-11.288-3.764" /> <path d="m2 2 20 20" />',
  'rss': '<path d="M4 11a9 9 0 0 1 9 9" /> <path d="M4 4a16 16 0 0 1 16 16" /> <circle cx="5" cy="19" r="1" />',
  'signal': '<path d="M2 20h.01" /> <path d="M7 20v-4" /> <path d="M12 20v-8" /> <path d="M17 20V8" /> <path d="M22 4v16" />',
  'help-circle': '<circle cx="12" cy="12" r="10" /> <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /> <path d="M12 17h.01" />',
  'circle-help': '<circle cx="12" cy="12" r="10" /> <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /> <path d="M12 17h.01" />',
  'loader': '<path d="M12 2v4" /> <path d="m16.2 7.8 2.9-2.9" /> <path d="M18 12h4" /> <path d="m16.2 16.2 2.9 2.9" /> <path d="M12 18v4" /> <path d="m4.9 19.1 2.9-2.9" /> <path d="M2 12h4" /> <path d="m4.9 4.9 2.9 2.9" />',
  'loader-circle': '<path d="M21 12a9 9 0 1 1-6.219-8.56" />',
  'zap': '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />',
  'flag': '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528" />',
  'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /> <path d="m9 12 2 2 4-4" />',
  'thumbs-up': '<path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /> <path d="M7 10v12" />',
  'thumbs-down': '<path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" /> <path d="M17 14V2" />',
  'smile': '<circle cx="12" cy="12" r="10" /> <path d="M8 14s1.5 2 4 2 4-2 4-2" /> <line x1="9" x2="9.01" y1="9" y2="9" /> <line x1="15" x2="15.01" y1="9" y2="9" />',
  'frown': '<circle cx="12" cy="12" r="10" /> <path d="M16 16s-1.5-2-4-2-4 2-4 2" /> <line x1="9" x2="9.01" y1="9" y2="9" /> <line x1="15" x2="15.01" y1="9" y2="9" />',
  'meh': '<circle cx="12" cy="12" r="10" /> <line x1="8" x2="16" y1="15" y2="15" /> <line x1="9" x2="9.01" y1="9" y2="9" /> <line x1="15" x2="15.01" y1="9" y2="9" />',
  'octagon-alert': '<path d="M12 16h.01" /> <path d="M12 8v4" /> <path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z" />',
  'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /> <path d="M12 9v4" /> <path d="M12 17h.01" />',
  'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <circle cx="9" cy="7" r="4" /> <line x1="19" x2="19" y1="8" y2="14" /> <line x1="22" x2="16" y1="11" y2="11" />',
  'user-check': '<path d="m16 11 2 2 4-4" /> <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <circle cx="9" cy="7" r="4" />',
  'user-x': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <circle cx="9" cy="7" r="4" /> <line x1="17" x2="22" y1="8" y2="13" /> <line x1="22" x2="17" y1="8" y2="13" />',
  'user-round': '<circle cx="12" cy="8" r="5" /> <path d="M20 21a8 8 0 0 0-16 0" />',
  'contact': '<path d="M16 2v2" /> <path d="M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" /> <path d="M8 2v2" /> <circle cx="12" cy="11" r="3" /> <rect x="3" y="4" width="18" height="18" rx="2" />',
  'circle-user': '<circle cx="12" cy="12" r="10" /> <circle cx="12" cy="10" r="3" /> <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />',
  'shopping-cart': '<circle cx="8" cy="21" r="1" /> <circle cx="19" cy="21" r="1" /> <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />',
  'shopping-bag': '<path d="M16 10a4 4 0 0 1-8 0" /> <path d="M3.103 6.034h17.794" /> <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />',
  'dollar-sign': '<line x1="12" x2="12" y1="2" y2="22" /> <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />',
  'tag': '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /> <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />',
  'tags': '<path d="M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z" /> <path d="M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193" /> <circle cx="10.5" cy="6.5" r=".5" fill="currentColor" />',
  'gift': '<path d="M12 7v14" /> <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" /> <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5" /> <rect x="3" y="7" width="18" height="4" rx="1" />',
  'package': '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /> <path d="M12 22V12" /> <polyline points="3.29 7 12 12 20.71 7" /> <path d="m7.5 4.27 9 5.15" />',
  'truck': '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /> <path d="M15 18H9" /> <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /> <circle cx="17" cy="18" r="2" /> <circle cx="7" cy="18" r="2" />',
  'wallet': '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /> <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />',
  'receipt': '<path d="M12 17V7" /> <path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" /> <path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" />',
  'percent': '<line x1="19" x2="5" y1="5" y2="19" /> <circle cx="6.5" cy="6.5" r="2.5" /> <circle cx="17.5" cy="17.5" r="2.5" />',
  'banknote': '<rect width="20" height="12" x="2" y="6" rx="2" /> <circle cx="12" cy="12" r="2" /> <path d="M6 12h.01M18 12h.01" />',
  'coins': '<path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" /> <path d="M15 6h1v4" /> <path d="m6.134 14.768.866-.5 2 3.464" /> <circle cx="16" cy="8" r="6" />',
  'timer': '<line x1="10" x2="14" y1="2" y2="2" /> <line x1="12" x2="15" y1="14" y2="11" /> <circle cx="12" cy="14" r="8" />',
  'alarm-clock': '<circle cx="12" cy="13" r="8" /> <path d="M12 9v4l2 2" /> <path d="M5 3 2 6" /> <path d="m22 6-3-3" /> <path d="M6.38 18.7 4 21" /> <path d="M17.64 18.67 20 21" />',
  'watch': '<path d="M12 10v2.2l1.6 1" /> <path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05" /> <path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05" /> <circle cx="12" cy="12" r="6" />',
  'history': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" /> <path d="M12 7v5l4 2" />',
  'hourglass': '<path d="M5 22h14" /> <path d="M5 2h14" /> <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /> <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />',
  'calendar-days': '<path d="M8 2v4" /> <path d="M16 2v4" /> <rect width="18" height="18" x="3" y="4" rx="2" /> <path d="M3 10h18" /> <path d="M8 14h.01" /> <path d="M12 14h.01" /> <path d="M16 14h.01" /> <path d="M8 18h.01" /> <path d="M12 18h.01" /> <path d="M16 18h.01" />',
  'calendar-clock': '<path d="M16 14v2.2l1.6 1" /> <path d="M16 2v4" /> <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" /> <path d="M3 10h5" /> <path d="M8 2v4" /> <circle cx="16" cy="16" r="6" />',
  'layout': '<rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M3 9h18" /> <path d="M9 21V9" />',
  'layout-grid': '<rect width="7" height="7" x="3" y="3" rx="1" /> <rect width="7" height="7" x="14" y="3" rx="1" /> <rect width="7" height="7" x="14" y="14" rx="1" /> <rect width="7" height="7" x="3" y="14" rx="1" />',
  'layout-list': '<rect width="7" height="7" x="3" y="3" rx="1" /> <rect width="7" height="7" x="3" y="14" rx="1" /> <path d="M14 4h7" /> <path d="M14 9h7" /> <path d="M14 15h7" /> <path d="M14 20h7" />',
  'list': '<path d="M3 5h.01" /> <path d="M3 12h.01" /> <path d="M3 19h.01" /> <path d="M8 5h13" /> <path d="M8 12h13" /> <path d="M8 19h13" />',
  'list-checks': '<path d="M13 5h8" /> <path d="M13 12h8" /> <path d="M13 19h8" /> <path d="m3 17 2 2 4-4" /> <path d="m3 7 2 2 4-4" />',
  'list-ordered': '<path d="M11 5h10" /> <path d="M11 12h10" /> <path d="M11 19h10" /> <path d="M4 4h1v5" /> <path d="M4 9h2" /> <path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02" />',
  'columns': '<rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M12 3v18" />',
  'columns-2': '<rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M12 3v18" />',
  'sidebar': '<rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M9 3v18" />',
  'panel-left': '<rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M9 3v18" />',
  'align-left': '<path d="M21 5H3" /> <path d="M15 12H3" /> <path d="M17 19H3" />',
  'align-center': '<path d="M21 5H3" /> <path d="M17 12H7" /> <path d="M19 19H5" />',
  'align-right': '<path d="M21 5H3" /> <path d="M21 12H9" /> <path d="M21 19H7" />',
  'align-justify': '<path d="M3 5h18" /> <path d="M3 12h18" /> <path d="M3 19h18" />',
  'table-2': '<path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />',
  'rows-2': '<rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M3 12h18" />',
  'eye-off': '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /> <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /> <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /> <path d="m2 2 20 20" />',
  'unlock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 9.9-1" />',
  'sun': '<circle cx="12" cy="12" r="4" /> <path d="M12 2v2" /> <path d="M12 20v2" /> <path d="m4.93 4.93 1.41 1.41" /> <path d="m17.66 17.66 1.41 1.41" /> <path d="M2 12h2" /> <path d="M20 12h2" /> <path d="m6.34 17.66-1.41 1.41" /> <path d="m19.07 4.93-1.41 1.41" />',
  'moon': '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />',
  'cloud': '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />',
  'cloud-off': '<path d="M10.94 5.274A7 7 0 0 1 15.71 10h1.79a4.5 4.5 0 0 1 4.222 6.057" /> <path d="M18.796 18.81A4.5 4.5 0 0 1 17.5 19H9A7 7 0 0 1 5.79 5.78" /> <path d="m2 2 20 20" />',
  'cloud-rain': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /> <path d="M16 14v6" /> <path d="M8 14v6" /> <path d="M12 16v6" />',
  'cloud-drizzle': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /> <path d="M8 19v1" /> <path d="M8 14v1" /> <path d="M16 19v1" /> <path d="M16 14v1" /> <path d="M12 21v1" /> <path d="M12 16v1" />',
  'cloud-snow': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /> <path d="M8 15h.01" /> <path d="M8 19h.01" /> <path d="M12 17h.01" /> <path d="M12 21h.01" /> <path d="M16 15h.01" /> <path d="M16 19h.01" />',
  'cloud-lightning': '<path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" /> <path d="m13 12-3 5h4l-3 5" />',
  'cloud-fog': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /> <path d="M16 17H7" /> <path d="M17 21H9" />',
  'cloud-sun': '<path d="M12 2v2" /> <path d="m4.93 4.93 1.41 1.41" /> <path d="M20 12h2" /> <path d="m19.07 4.93-1.41 1.41" /> <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" /> <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />',
  'cloud-moon': '<path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" /> <path d="M10.1 9A6 6 0 0 1 16 4a4 4 0 0 0 0 8 6 6 0 0 1-2.417-.502" />',
  'cloud-sun-rain': '<path d="M12 2v2" /> <path d="m4.93 4.93 1.41 1.41" /> <path d="M20 12h2" /> <path d="m19.07 4.93-1.41 1.41" /> <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" /> <path d="M3 20a5 5 0 1 1 8.9-4H13a3 3 0 0 1 2 5.24" /> <path d="M11 20v2" /> <path d="M7 19v2" />',
  'map': '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" /> <path d="M15 5.764v15" /> <path d="M9 3.236v15" />',
  'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /> <circle cx="12" cy="10" r="3" />',
  'navigation': '<polygon points="3 11 22 2 13 21 11 13 3 11" />',
  'compass': '<circle cx="12" cy="12" r="10" /> <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />',
  'building': '<path d="M12 10h.01" /> <path d="M12 14h.01" /> <path d="M12 6h.01" /> <path d="M16 10h.01" /> <path d="M16 14h.01" /> <path d="M16 6h.01" /> <path d="M8 10h.01" /> <path d="M8 14h.01" /> <path d="M8 6h.01" /> <path d="M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /> <rect x="4" y="2" width="16" height="20" rx="2" />',
  'building-2': '<path d="M10 12h4" /> <path d="M10 8h4" /> <path d="M14 21v-3a2 2 0 0 0-4 0v3" /> <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" /> <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />',
  'briefcase': '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /> <rect width="20" height="14" x="2" y="6" rx="2" />',
  'key': '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /> <path d="m21 2-9.6 9.6" /> <circle cx="7.5" cy="15.5" r="5.5" />',
  'coffee': '<path d="M10 2v2" /> <path d="M14 2v2" /> <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" /> <path d="M6 2v2" />',
  'battery': '<path d="M 22 14 L 22 10" /> <rect x="2" y="6" width="16" height="12" rx="2" />',
  'cpu': '<path d="M12 20v2" /> <path d="M12 2v2" /> <path d="M17 20v2" /> <path d="M17 2v2" /> <path d="M2 12h2" /> <path d="M2 17h2" /> <path d="M2 7h2" /> <path d="M20 12h2" /> <path d="M20 17h2" /> <path d="M20 7h2" /> <path d="M7 20v2" /> <path d="M7 2v2" /> <rect x="4" y="4" width="16" height="16" rx="2" /> <rect x="8" y="8" width="8" height="8" rx="1" />',
  'database': '<ellipse cx="12" cy="5" rx="9" ry="3" /> <path d="M3 5V19A9 3 0 0 0 21 19V5" /> <path d="M3 12A9 3 0 0 0 21 12" />',
  'server': '<rect width="20" height="8" x="2" y="2" rx="2" ry="2" /> <rect width="20" height="8" x="2" y="14" rx="2" ry="2" /> <line x1="6" x2="6.01" y1="6" y2="6" /> <line x1="6" x2="6.01" y1="18" y2="18" />',
  'hard-drive': '<path d="M10 16h.01" /> <path d="M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /> <path d="M21.946 12.013H2.054" /> <path d="M6 16h.01" />',
  'terminal': '<path d="M12 19h8" /> <path d="m4 17 6-6-6-6" />',
  'code': '<path d="m16 18 6-6-6-6" /> <path d="m8 6-6 6 6 6" />',
  'code-2': '<path d="m18 16 4-4-4-4" /> <path d="m6 8-4 4 4 4" /> <path d="m14.5 4-5 16" />',
  'git-branch': '<path d="M15 6a9 9 0 0 0-9 9V3" /> <circle cx="18" cy="6" r="3" /> <circle cx="6" cy="18" r="3" />',
  'git-commit-horizontal': '<circle cx="12" cy="12" r="3" /> <line x1="3" x2="9" y1="12" y2="12" /> <line x1="15" x2="21" y1="12" y2="12" />',
  'bar-chart-3': '<path d="M3 3v16a2 2 0 0 0 2 2h16" /> <path d="M18 17V9" /> <path d="M13 17V5" /> <path d="M8 17v-3" />',
  'chart-bar': '<path d="M3 3v16a2 2 0 0 0 2 2h16" /> <path d="M7 16h8" /> <path d="M7 11h12" /> <path d="M7 6h3" />',
  'chart-line': '<path d="M3 3v16a2 2 0 0 0 2 2h16" /> <path d="m19 9-5 5-4-4-3 3" />',
  'chart-pie': '<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z" /> <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />',
  'trending-up': '<path d="M16 7h6v6" /> <path d="m22 7-8.5 8.5-5-5L2 17" />',
  'trending-down': '<path d="M16 17h6v-6" /> <path d="m22 17-8.5-8.5-5 5L2 7" />',
  'activity': '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />',
  'gauge': '<path d="m12 14 4-4" /> <path d="M3.34 19a10 10 0 1 1 17.32 0" />',
  'circle': '<circle cx="12" cy="12" r="10" />',
  'square': '<rect width="18" height="18" x="3" y="3" rx="2" />',
  'triangle': '<path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />',
  'hexagon': '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />',
  'diamond': '<path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z" />',
  'dot': '<circle cx="12.1" cy="12.1" r="1" />',
  'palette': '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" /> <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /> <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /> <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /> <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />',
  'brush': '<path d="m11 10 3 3" /> <path d="M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z" /> <path d="M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031" />',
  'droplet': '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />',
  'feather': '<path d="M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z" /> <path d="M16 8 2 22" /> <path d="M17.5 15H9" />',
  'anchor': '<path d="M12 6v16" /> <path d="m19 13 2-1a9 9 0 0 1-18 0l2 1" /> <path d="M9 11h6" /> <circle cx="12" cy="4" r="2" />',
  'award': '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" /> <circle cx="12" cy="8" r="6" />',
  'target': '<circle cx="12" cy="12" r="10" /> <circle cx="12" cy="12" r="6" /> <circle cx="12" cy="12" r="2" />',
  'crosshair': '<circle cx="12" cy="12" r="10" /> <line x1="22" x2="18" y1="12" y2="12" /> <line x1="6" x2="2" y1="12" y2="12" /> <line x1="12" x2="12" y1="6" y2="2" /> <line x1="12" x2="12" y1="22" y2="18" />',
  'layers': '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /> <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /> <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />',
  'box': '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /> <path d="m3.3 7 8.7 5 8.7-5" /> <path d="M12 22V12" />',
  'grid-2x2': '<path d="M12 3v18" /> <path d="M3 12h18" /> <rect x="3" y="3" width="18" height="18" rx="2" />',
  'grip-vertical': '<circle cx="9" cy="12" r="1" /> <circle cx="9" cy="5" r="1" /> <circle cx="9" cy="19" r="1" /> <circle cx="15" cy="12" r="1" /> <circle cx="15" cy="5" r="1" /> <circle cx="15" cy="19" r="1" />',
  'grip-horizontal': '<circle cx="12" cy="9" r="1" /> <circle cx="19" cy="9" r="1" /> <circle cx="5" cy="9" r="1" /> <circle cx="12" cy="15" r="1" /> <circle cx="19" cy="15" r="1" /> <circle cx="5" cy="15" r="1" />',
  'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />',
  'hammer': '<path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9" /> <path d="m18 15 4-4" /> <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />',
  'bug': '<path d="M12 20v-9" /> <path d="M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z" /> <path d="M14.12 3.88 16 2" /> <path d="M21 21a4 4 0 0 0-3.81-4" /> <path d="M21 5a4 4 0 0 1-3.55 3.97" /> <path d="M22 13h-4" /> <path d="M3 21a4 4 0 0 1 3.81-4" /> <path d="M3 5a4 4 0 0 0 3.55 3.97" /> <path d="M6 13H2" /> <path d="m8 2 1.88 1.88" /> <path d="M9 7.13V6a3 3 0 1 1 6 0v1.13" />',
  'rocket': '<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /> <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09" /> <path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z" /> <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" />',
  'flame': '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />',
  'bolt': '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /> <circle cx="12" cy="12" r="4" />',
  'lightbulb': '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /> <path d="M9 18h6" /> <path d="M10 22h4" />',
  'thermometer': '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />',
  'wind': '<path d="M12.8 19.6A2 2 0 1 0 14 16H2" /> <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" /> <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />',
  'snowflake': '<path d="m10 20-1.25-2.5L6 18" /> <path d="M10 4 8.75 6.5 6 6" /> <path d="m14 20 1.25-2.5L18 18" /> <path d="m14 4 1.25 2.5L18 6" /> <path d="m17 21-3-6h-4" /> <path d="m17 3-3 6 1.5 3" /> <path d="M2 12h6.5L10 9" /> <path d="m20 10-1.5 2 1.5 2" /> <path d="M22 12h-6.5L14 15" /> <path d="m4 10 1.5 2L4 14" /> <path d="m7 21 3-6-1.5-3" /> <path d="m7 3 3 6h4" />',
  'umbrella': '<path d="M12 13v7a2 2 0 0 0 4 0" /> <path d="M12 2v2" /> <path d="M20.992 13a1 1 0 0 0 .97-1.274 10.284 10.284 0 0 0-19.923 0A1 1 0 0 0 3 13z" />',
  'droplets': '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" /> <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />',
  'thermometer-sun': '<path d="M12 9a4 4 0 0 0-2 7.5" /> <path d="M12 3v2" /> <path d="m6.6 18.4-1.4 1.4" /> <path d="M20 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" /> <path d="M4 13H2" /> <path d="M6.34 7.34 4.93 5.93" />',
  'thermometer-snowflake': '<path d="M20 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" /> <path d="m2 15 2 2 2-2" /> <path d="m2 9 2 2 2-2" /> <path d="M4 5v14" /> <path d="M10 8H2" /> <path d="M10 16H2" />',
  'sunrise': '<path d="M12 2v8" /> <path d="m4.93 10.93 1.41 1.41" /> <path d="M2 18h2" /> <path d="M20 18h2" /> <path d="m19.07 10.93-1.41 1.41" /> <path d="M22 22H2" /> <path d="m8 6 4-4 4 4" /> <path d="M16 18a4 4 0 0 0-8 0" />',
  'sunset': '<path d="M12 10V2" /> <path d="m4.93 10.93 1.41 1.41" /> <path d="M2 18h2" /> <path d="M20 18h2" /> <path d="m19.07 10.93-1.41 1.41" /> <path d="M22 22H2" /> <path d="m16 6-4 4-4-4" /> <path d="M16 18a4 4 0 0 0-8 0" />',
  'tornado': '<path d="M21 4H3" /> <path d="M18 8H6" /> <path d="M19 12H9" /> <path d="M16 16h-6" /> <path d="M11 20H9" />',
  'rainbow': '<path d="M22 17a10 10 0 0 0-20 0" /> <path d="M6 17a6 6 0 0 1 12 0" /> <path d="M10 17a2 2 0 0 1 4 0" />',
  'haze': '<path d="m5.2 6.2 1.4 1.4" /> <path d="M2 13h2" /> <path d="M20 13h2" /> <path d="m17.4 7.6 1.4-1.4" /> <path d="M22 17H2" /> <path d="M22 21H2" /> <path d="M16 13a4 4 0 0 0-8 0" />',
  'trophy': '<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978" /> <path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978" /> <path d="M18 9h1.5a1 1 0 0 0 0-5H18" /> <path d="M4 22h16" /> <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" /> <path d="M6 9H4.5a1 1 0 0 1 0-5H6" />',
  'medal': '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" /> <path d="M11 12 5.12 2.2" /> <path d="m13 12 5.88-9.8" /> <path d="M8 7h8" /> <circle cx="12" cy="17" r="5" /> <path d="M12 18v-2h-.5" />',
  'crown': '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /> <path d="M5 21h14" />',
  'ticket': '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /> <path d="M13 5v2" /> <path d="M13 17v2" /> <path d="M13 11v2" />',
  'qr-code': '<rect width="5" height="5" x="3" y="3" rx="1" /> <rect width="5" height="5" x="16" y="3" rx="1" /> <rect width="5" height="5" x="3" y="16" rx="1" /> <path d="M21 16h-3a2 2 0 0 0-2 2v3" /> <path d="M21 21v.01" /> <path d="M12 7v3a2 2 0 0 1-2 2H7" /> <path d="M3 12h.01" /> <path d="M12 3h.01" /> <path d="M12 16v.01" /> <path d="M16 12h1" /> <path d="M21 12v.01" /> <path d="M12 21v-1" />',
  'scan': '<path d="M3 7V5a2 2 0 0 1 2-2h2" /> <path d="M17 3h2a2 2 0 0 1 2 2v2" /> <path d="M21 17v2a2 2 0 0 1-2 2h-2" /> <path d="M7 21H5a2 2 0 0 1-2-2v-2" />',
  'fingerprint': '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" /> <path d="M14 13.12c0 2.38 0 6.38-1 8.88" /> <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" /> <path d="M2 12a10 10 0 0 1 18-6" /> <path d="M2 16h.01" /> <path d="M21.8 16c.2-2 .131-5.354 0-6" /> <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" /> <path d="M8.65 22c.21-.66.45-1.32.57-2" /> <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />',
};

/**
 * Brand glyphs — FILLED 24×24 marks (simple-icons geometry, CC0). Unlike the
 * stroke-based ICONS above, these render `fill:currentColor; stroke:none`, so a
 * caller tints them with the surrounding text color (or a SocialBar `accent`).
 * Same closed-registry security model: a NAME is looked up; the markup is OURS.
 * (We deliberately do NOT add a brand named `x` — `x` is the reserved close
 * glyph above; the X/Twitter brand is named `twitter`.)
 */
const FILLED_ICONS: Record<string, string> = {
  github:
    '<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>',
  twitter:
    '<path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>',
  facebook:
    '<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>',
  instagram:
    '<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>',
  linkedin:
    '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/>',
  youtube:
    '<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>',
};

/** All registry glyph names (for tests / docs) — stroke + filled brand glyphs. */
export const ICON_NAMES = [...Object.keys(ICONS), ...Object.keys(FILLED_ICONS)];

/** True if `name` resolves to a known glyph (stroke OR filled brand) OR a safe image URL. */
/**
 * A single emoji (or one symbol character) that can stand in for a registry glyph.
 * The icon slots were registry-NAME only, but host DATA carries emoji ("🗼" on a trip
 * stop, "🗺️" on a summary tile) and the model passes it through verbatim — this is
 * host input, not drift.
 * A name nobody knows still renders nothing; an emoji now renders itself. Exactly ONE
 * grapheme: a pictographic (with VS16 / skin tone / ZWJ sequence), a flag, a keycap, or
 * a lone symbol such as "$" / "%" / "→" — never letters or digits, so a stray word can
 * not masquerade as an icon.
 */
const EMOJI_GLYPH =
  /^(?:(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3)(?:\uFE0F|\uFE0E|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*)*|[\p{S}%#&*+])$/u;
export function isEmojiGlyph(name: string): boolean {
  return typeof name === 'string' && name.length > 0 && name.length <= 16 && EMOJI_GLYPH.test(name);
}

export function hasIcon(name: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(ICONS, name) ||
    Object.prototype.hasOwnProperty.call(FILLED_ICONS, name) ||
    (isUrlIcon(name) && !!safeImageSrc(name)) ||
    isEmojiGlyph(name)
  );
}

/**
 * Render a registry glyph by NAME. A KNOWN name → our `<svg>`; an UNKNOWN name
 * (or null/undefined/non-string) → `null` (renders nothing, never raw markup).
 * The inner SVG is OUR author-controlled string, set via dangerouslySetInnerHTML
 * on an element whose markup we wrote — the spec only ever supplies the lookup
 * KEY, so this is not an injection surface.
 */
export function Icon({
  name,
  size = 16,
  className,
  filled = false,
}: {
  name?: string | null;
  size?: number;
  className?: string;
  /** Paint a closed-path glyph (star, heart) as a SOLID shape. A stroke-only
   *  outline recoloured to signal "on" conveys its state by hue alone, which
   *  fails for anyone who cannot tell the two hues apart. */
  filled?: boolean;
}): ReactNode {
  if (typeof name !== 'string') return null;
  // Image-URL icon → ANY custom/brand icon, rendered as a URL-guarded <img> (never
  // raw SVG). Unsafe/unsupported URL → nothing. Keeps the closed-registry security.
  if (isUrlIcon(name)) {
    const safe = safeImageSrc(name);
    if (!safe) return null;
    return createElement('img', {
      src: safe,
      width: size,
      height: size,
      alt: '',
      'aria-hidden': true,
      className,
      style: { objectFit: 'contain', display: 'inline-block' },
    });
  }
  const isBrand = Object.prototype.hasOwnProperty.call(FILLED_ICONS, name);
  const stroke = Object.prototype.hasOwnProperty.call(ICONS, name);
  if (!isBrand && !stroke) {
    // An emoji glyph renders as TEXT inside the same square the svg would occupy, so
    // a "🗺️" on a Stat tile sits where "map" would; layout is unchanged either way.
    if (!isEmojiGlyph(name)) return null;
    return createElement(
      'span',
      {
        'aria-hidden': true,
        className,
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          fontSize: Math.round(size * 0.92),
          lineHeight: 1,
          fontStyle: 'normal',
        },
      },
      name,
    );
  }
  const solid = isBrand || filled;
  return createElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    // Brand glyphs are FILLED paths (fill:currentColor); the rest are stroke-based.
    fill: solid ? 'currentColor' : 'none',
    stroke: solid ? 'none' : 'currentColor',
    ...(solid ? {} : { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    'aria-hidden': true,
    className,
    // OUR markup (looked up by the spec's name), never the model's raw SVG.
    dangerouslySetInnerHTML: { __html: isBrand ? FILLED_ICONS[name] : ICONS[name] },
  });
}
