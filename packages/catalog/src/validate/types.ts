/** Result of validating a JSONL op stream / spec against the Frayme catalog. */
export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};
