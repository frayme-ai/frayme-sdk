'use client';
/**
 * `createCustomComponents`: wrap a consumer's custom components so they render
 * inside a Frayme spec with the same guarantees the built-in catalog has.
 *
 * Per component the wrapper:
 *  - GATES props: unknown keys stripped, invalid values dropped to null
 *    (never crashes, never drops the element) — the client-side defense for
 *    props that reach the renderer without a server gate.
 *  - builds a typed `emit` on the intrinsic-payload path (same as built-ins), with
 *    dev warnings for an undeclared verb (forwarded anyway) or a declared verb the
 *    spec never bound (the emit silently drops upstream).
 *  - passes ONLY `{ props, emit }` — customs are LEAF components (no children).
 *  - `clientOnly`: renders a neutral skeleton during SSR, mounts on the client.
 *
 * The returned `catalog` is the built-ins ∪ manifests union; pass it to
 * `<FraymeRenderer catalog={…} components={…}>` so strict mode accepts the customs.
 */
import { createElement, useEffect, useState, type CSSProperties, type FunctionComponent, type ReactNode } from 'react';
import {
  extendCatalog,
  type CompiledManifest,
  type FraymeCatalogUnion,
  type FraymeParts,
  type ManifestInput,
} from '@frayme/catalog';
import { useIntrinsicEmit } from './intrinsic.js';
import { isDev } from './dev.js';
import type { ComponentRegistry, ComponentRenderProps, ComponentRenderer } from './upstream.js';

/** One registered custom component: its compiled manifest + the React component. */
export interface CustomComponentEntry<M extends ManifestInput = ManifestInput> {
  manifest: CompiledManifest<M>;
  /** The consumer types this via `FraymeParts<typeof Manifest>` — that signature
   * is where the typed props/emit guarantee lives. */
  component: (parts: FraymeParts<CompiledManifest<M>>) => ReactNode;
  /** Render a skeleton during SSR, mount the real component on the client. Set
   * for components that touch `window`/`document`. */
  clientOnly?: boolean;
}

export interface CustomComponents {
  /** Merge into `<FraymeRenderer components={…}>`. */
  registry: ComponentRegistry;
  /** Pass to `<FraymeRenderer catalog={…}>` so strict mode accepts the customs. */
  catalog: FraymeCatalogUnion;
}

function skeleton(name: string, props: Record<string, unknown>): ReactNode {
  const style: CSSProperties = {};
  if (typeof props.width === 'string') style.width = props.width;
  const mh = props.maxHeight ?? props.height;
  if (typeof mh === 'string') style.minHeight = mh;
  return createElement('div', { 'data-frayme-clientonly': name, style });
}

function makeWrapper(entry: CustomComponentEntry): ComponentRenderer {
  const { manifest, component, clientOnly } = entry;
  const name = manifest.manifest.name;
  const declared = new Set<string>(manifest.manifest.events);

  const Wrapper = (rp: ComponentRenderProps): ReactNode => {
    const emitWith = useIntrinsicEmit(rp.emit, rp.element);
    // clientOnly: unmounted on the server, flips true after hydration. Hooks run
    // unconditionally; the branch is on their result.
    const [mounted, setMounted] = useState(!clientOnly);
    useEffect(() => {
      if (clientOnly && !mounted) setMounted(true);
    }, [mounted]);

    const cleaned = manifest.cleanProps(rp.element.props ?? {});

    const emit = (event: string, payload?: Record<string, unknown>): void => {
      if (isDev) {
        if (!declared.has(event)) {
          console.warn(`[frayme] <${name}> emitted "${event}", which is not in its manifest events [${[...declared].join(', ')}] — forwarding anyway.`);
        } else if (rp.on(event)?.bound === false) {
          console.warn(`[frayme] <${name}> emitted "${event}" but the model did not bind on.${event} on this element — the interaction was dropped. (The model needs to wire it, or the manifest should not declare it.)`);
        }
      }
      emitWith(event, payload);
    };

    if (clientOnly && !mounted) return skeleton(name, cleaned);
    // Render the author component as an ELEMENT (not a bare `component(parts)` call)
    // so it owns its own fiber + hook list, independent of the clientOnly skeleton
    // branch above. A bare call ran the author's hooks inside THIS Wrapper's fiber,
    // so a clientOnly component using ANY hook (incl. the author-kit useLocalOrBound)
    // changed the Wrapper's hook count between the skeleton render and the mounted
    // render → "rendered more hooks than during the previous render". As an element
    // it mounts fresh on the client with its own consistent hook order (and regains
    // per-component memoization + error isolation). Customs are leaf: only
    // { props, emit } — never children.
    return createElement(
      component as unknown as FunctionComponent<FraymeParts<CompiledManifest>>,
      { props: cleaned, emit } as unknown as FraymeParts<CompiledManifest>,
    );
  };
  Wrapper.displayName = `FraymeCustom(${name})`;
  return Wrapper;
}

/**
 * Build a registry + catalog union from custom-component entries.
 * `createCustomComponents([{ manifest, component }])`.
 */
export function createCustomComponents(entries: readonly CustomComponentEntry<any>[]): CustomComponents {
  const registry: ComponentRegistry = {};
  const seen = new Set<string>();
  for (const entry of entries) {
    const name = entry.manifest.manifest.name;
    if (seen.has(name)) throw new Error(`duplicate custom component: "${name}"`);
    seen.add(name);
    registry[name] = makeWrapper(entry);
  }
  const catalog = extendCatalog(entries.map((e) => e.manifest));
  return { registry, catalog };
}
