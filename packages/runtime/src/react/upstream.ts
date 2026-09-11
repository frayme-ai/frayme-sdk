/**
 * THE ONLY module allowed to import '@json-render/react'.
 *
 * json-render is pre-1.0 and has renamed its entire state/action surface once
 * before (v0.6: DataProvider→StateProvider, onAction→emit, …). Routing every
 * upstream name through this file makes the next rename a one-file fix.
 *
 * Verified against @json-render/react@0.19.0:
 *  - ComponentRegistry = Record<string, ComponentType<ComponentRenderProps>>
 *  - ComponentRenderProps = { element, children?, emit(event), on(event), bindings?, loading? }
 *  - JSONUIProvider { registry, initialState?, handlers?, onStateChange?, … }
 *  - Renderer { spec, registry, loading?, fallback? }
 *  - useBoundProp(propValue, bindingPath) → [value, setValue]
 */
export {
  JSONUIProvider,
  Renderer,
  useBoundProp,
  useStateValue,
  useActions,
  // The repeat scope a child renders under ({item, index, basePath}), or null
  // outside one. Read by the commit latch so a per-row action latches THAT row
  // rather than every row sharing the element definition.
  useRepeatScope,
  buildSpecFromParts,
  createStateStore,
} from '@json-render/react';

export type {
  ComponentRegistry,
  ComponentRenderer,
  ComponentRenderProps,
  DataPart,
  StateStore,
  StateModel,
} from '@json-render/react';
