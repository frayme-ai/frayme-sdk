import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * The class-name composer for CVA recipes — merges conditional class lists
 * (clsx) then resolves Tailwind conflicts (tailwind-merge), so a recipe's base
 * classes and a variant's overrides combine predictably.
 *
 * NOTE: this is for AUTHORING the catalog's component renderers (trusted, static
 * class strings). It is NOT a channel for model/spec-supplied classes — the spec
 * never carries raw Tailwind; it carries closed enum tokens the recipes map to
 * classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
