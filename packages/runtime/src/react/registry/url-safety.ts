/**
 * URL-scheme safety for spec-supplied href/src values. A catalog-validated spec
 * can still carry `javascript:`/`data:`/`vbscript:` URLs (the catalog checks
 * shape, not scheme), so the renderer neutralizes them at the point of use.
 *
 * - safeUrl: navigable links — allow http/https/mailto/tel + relative/fragment.
 * - safeImageSrc: image sources — allow http/https + relative, and RASTER `data:`
 *   images ONLY (png/jpeg/gif/webp/avif). `data:image/svg+xml` is rejected (SVG
 *   can carry CSS/foreignObject exfil + UI-redress on no-CSP surfaces), and
 *   `blob:` is rejected (no provenance for a model-supplied value).
 *
 * Control chars are stripped first so `java\tscript:` can't slip past the
 * scheme check (browsers ignore them when parsing the scheme).
 */
const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
const IMAGE_SCHEMES = new Set(['http', 'https']);
/** Only inline raster image data URIs — never svg+xml (active content). */
const RASTER_DATA_RE = /^data:image\/(png|jpe?g|gif|webp|avif)[;,]/i;
/**
 * Inline data-URI length cap (~256KB of encoded string). A scheme-valid raster
 * data-URI can still be arbitrarily large, so a generated inline image is a
 * memory/DoS payload with no other backstop on the render path. base64
 * encodes ~4/3 bytes, so 256KB of string ≈ ~190KB of binary — ample for an
 * avatar / small illustration / a captured signature, far below a render-bomb.
 * Author-hosted URLs (unbounded here, but not held in memory) remain preferred;
 * an inline image over budget is rejected → the renderer shows its fallback.
 */
const MAX_DATA_URI_LEN = 256 * 1024;

function clean(value: unknown): string {
  if (typeof value !== 'string') return '';
  // Strip control chars (0x00–0x1F, 0x7F) but keep ordinary characters intact,
  // then trim. Browsers drop control chars when parsing a URL scheme.
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) continue;
    out += value[i];
  }
  return out.trim();
}

function schemeOf(cleaned: string): string | undefined {
  return cleaned.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
}

/** Safe href for a navigable link, or '#' when the scheme is disallowed. */
export function safeUrl(value: unknown): string {
  const c = clean(value);
  if (!c) return '#';
  const scheme = schemeOf(c);
  return scheme && !LINK_SCHEMES.has(scheme) ? '#' : c;
}

/** Safe image source, or null (→ render a fallback) when disallowed/empty. */
export function safeImageSrc(value: unknown): string | null {
  const c = clean(value);
  if (!c) return null;
  const scheme = schemeOf(c);
  if (!scheme) return c; // relative / fragment
  if (scheme === 'data') {
    if (c.length > MAX_DATA_URI_LEN) return null; // bound inline-image memory/DoS
    return RASTER_DATA_RE.test(c) ? c : null; // raster only; rejects svg+xml + non-image
  }
  return IMAGE_SCHEMES.has(scheme) ? c : null; // http/https only; blob: + everything else rejected
}

/**
 * Map-provider hostnames allowed as an <iframe> embed src. An iframe src is a
 * scripted cross-origin frame, so — unlike a navigable link — it MUST be
 * hostname-allowlisted (safeUrl only checks the scheme). Registrable domains
 * only; any sub-host of these is accepted (maps.google.com, www.google.com,
 * api.mapbox.com, …). Everything else → null → the caller renders a static
 * fallback instead of framing an arbitrary origin.
 */
const EMBED_HOSTS = ['google.com', 'openstreetmap.org', 'mapbox.com'];

/**
 * A safe <iframe> src for a MAP embed, or null when disallowed. https-only +
 * hostname must be (a sub-host of) an allowlisted map provider. Uses the URL
 * parser so `https://google.com@evil.com/…` resolves its hostname to evil.com
 * and is rejected (userinfo spoof); returns the normalized href.
 */
export function safeEmbedUrl(value: unknown): string | null {
  const c = clean(value);
  if (!c) return null;
  let u: URL;
  try {
    u = new URL(c);
  } catch {
    return null; // not an absolute URL → cannot be framed safely
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  const ok = EMBED_HOSTS.some((d) => host === d || host.endsWith('.' + d));
  return ok ? u.toString() : null;
}

/**
 * `target`/`rel` for a spec-driven link. The spec may set only the boolean
 * `external` (never `target`/`rel` directly), and an external link ALWAYS gets
 * `rel="noopener noreferrer"` — no reverse-tabnabbing, no referrer leak. Spread
 * onto the `<a>` of every navigable component (Link, Breadcrumb, SidebarItem,
 * Navbar, …) so the secure-link convention is identical everywhere.
 */
export function linkTargetRel(
  external: boolean | null | undefined,
): { target: '_blank'; rel: 'noopener noreferrer' } | Record<string, never> {
  return external === true ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}
