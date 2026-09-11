/**
 * What counts as a json-render DYNAMIC value.
 *
 * `{$state}` / `{$item}` / `{$cond}` / `{$bindState}` / `{$template}` and
 * friends: a non-array object carrying any `$`-prefixed key. The prop schemas
 * type the RESOLVED value, so a binding can never satisfy one and must never be
 * read as a violation — and no structural check can count what arrives at
 * runtime either.
 *
 * It lives in its own module because BOTH the prop gate (props.ts) and the
 * structural gate (structure.ts) need it, and props.ts already imports
 * structure.ts — importing it back the other way would make a cycle.
 * `isDynamicValue` is re-exported from props.ts, which is the public surface
 * validate/index.ts advertises.
 */
export function isDynamicValue(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value as object).some((k) => k.startsWith('$'))
  );
}
