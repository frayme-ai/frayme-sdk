import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * CLIENT-SIDE FIELD VALIDATION — the `checks` / `validateOn` surface, finally wired.
 *
 * The catalog has described this to the model in full detail for as long as it has
 * existed: rules as `[{type, message, args?}]` over required · minLength ·
 * maxLength · pattern · email, evaluated per a `validateOn` timing of change ·
 * blur · submit. The model believed it and emitted `checks` accordingly. Nothing
 * in the runtime read either prop. Every one of those screens shipped a
 * validation system that does precisely nothing, and — because the fallback
 * only fires on validation FAILURE — shipped it as a success.
 *
 * WHY WIRE RATHER THAN STRIP. The alternative was deleting the props from the
 * catalog and rewriting every affected spec onto `required` + native reportValidity(). But
 * native validation shows ONE browser tooltip on the FIRST invalid field, which
 * cannot express "highlight any mandatory field" — and a disabled-until-valid
 * button, the other way to avoid needing this, is the pattern that cannot tell you
 * WHY it is disabled. Field-level errors are the accessible answer and the one
 * generated specs were already reaching for.
 *
 * THE DEFAULT IS ENABLED-THEN-VALIDATE. A submit button stays pressable; pressing
 * an incomplete form reveals errors on the fields that are wrong, rather than
 * leaving a dead control the reader has to reverse-engineer. Disabling is reserved
 * for the case where the reason is visible from the button itself (a bulk action
 * over an empty selection), never for a form whose reasons are scattered across it.
 */

export interface FieldCheck {
  type: string;
  message: string;
  args?: Record<string, unknown> | null;
}

export type ValidateOn = 'change' | 'blur' | 'submit';

/** A value counts as EMPTY. Deliberately not bare truthiness, which is wrong twice:
 *  a numeric field holding 0 and a checkbox holding false are both ANSWERS, and
 *  treating them as empty is how a valid zero fails a required check. An empty
 *  array is empty, though truthiness says otherwise. */
export function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'number') return Number.isNaN(v);
  return false;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (v == null ? '' : String(v));

/** Deliberately permissive: shape only, no TLD list. Rejecting a valid address is a
 *  worse failure than accepting an implausible one, which the server checks anyway. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Run one rule. Returns the rule's own `message` on failure, null on pass.
 * An UNKNOWN rule type passes: the catalog's list is open-ended ("required ·
 * minLength · … · …"), and failing a field on a rule this runtime has not heard of
 * would block a form for a reason no one can act on.
 */
function runCheck(check: FieldCheck, value: unknown, checkedState?: boolean): string | null {
  const a = (check.args ?? {}) as Record<string, unknown>;
  const s = str(value);
  switch (check.type) {
    case 'required': {
      // For a boolean control, "required" means CHECKED — an unticked consent box
      // is not a filled-in field, and `false` is not empty in the general case.
      if (typeof checkedState === 'boolean') return checkedState ? null : check.message;
      return isEmptyValue(value) ? check.message : null;
    }
    // Every rule below is VACUOUSLY TRUE on an empty field. Only `required` decides
    // whether emptiness is allowed; a blank optional field must not also report
    // "too short".
    case 'minLength':
      return !isEmptyValue(value) && s.length < (num(a.min) ?? 0) ? check.message : null;
    case 'maxLength':
      return !isEmptyValue(value) && s.length > (num(a.max) ?? Infinity) ? check.message : null;
    case 'min': {
      const n = num(value);
      return !isEmptyValue(value) && n != null && n < (num(a.min) ?? -Infinity) ? check.message : null;
    }
    case 'max': {
      const n = num(value);
      return !isEmptyValue(value) && n != null && n > (num(a.max) ?? Infinity) ? check.message : null;
    }
    case 'pattern': {
      if (isEmptyValue(value)) return null;
      const src = typeof a.pattern === 'string' ? a.pattern : typeof a.value === 'string' ? a.value : null;
      if (!src) return null;
      // An unparseable pattern is an AUTHORING bug, not a user error. Failing the
      // field would blame the reader for it.
      try { return new RegExp(src).test(s) ? null : check.message; } catch { return null; }
    }
    case 'email':
      return !isEmptyValue(value) && !EMAIL.test(s) ? check.message : null;
    default:
      return null;
  }
}

/** First failing message, or null. First rather than all: one clear instruction
 *  beats a stack the reader has to triage. */
export function runChecks(checks: FieldCheck[] | null | undefined, value: unknown, checkedState?: boolean): string | null {
  if (!Array.isArray(checks)) return null;
  for (const c of checks) {
    if (!c || typeof c.type !== 'string' || typeof c.message !== 'string') continue;
    const err = runCheck(c, value, checkedState);
    if (err) return err;
  }
  return null;
}

interface FormValidationApi {
  register(id: string, entry: { validate: () => string | null }): () => void;
  /** Runs every field. Reveals errors and returns whether the form is valid. */
  validateAll(): boolean;
  /** True once a submit has been attempted — every field reveals from then on. */
  submitted: boolean;
}

const FormValidationContext = createContext<FormValidationApi | null>(null);

/**
 * Provided by Form. A field outside a Form still validates on its own timing — it
 * just has no submit to gate, which is the honest behaviour for a stray control.
 */
export function FormValidationProvider({ children }: { children: ReactNode }): ReactNode {
  const fields = useRef(new Map<string, { validate: () => string | null }>());
  const [submitted, setSubmitted] = useState(false);

  const register = useCallback((id: string, entry: { validate: () => string | null }) => {
    fields.current.set(id, entry);
    return () => { fields.current.delete(id); };
  }, []);

  const validateAll = useCallback(() => {
    setSubmitted(true);
    let ok = true;
    // Run EVERY field, not until-first-failure: the reader should see all of what
    // is wrong at once, which is the whole advantage over a native tooltip.
    for (const f of fields.current.values()) if (f.validate()) ok = false;
    return ok;
  }, []);

  const api = useMemo(() => ({ register, validateAll, submitted }), [register, validateAll, submitted]);
  return <FormValidationContext.Provider value={api}>{children}</FormValidationContext.Provider>;
}

/** The submit gate, for Button. Null when there is no enclosing Form. */
export function useFormValidation(): FormValidationApi | null {
  return useContext(FormValidationContext);
}

/**
 * Per-field validation. Returns the message to display, and the blur handler that
 * arms `blur` timing.
 *
 * An AUTHORED `errorText` always wins: a spec that states an error is reporting
 * something this runtime cannot know (a server rejection, a cross-field rule), and
 * a computed pass must never erase it.
 */
export function useFieldChecks(opts: {
  id: string;
  value: unknown;
  checked?: boolean;
  checks?: FieldCheck[] | null;
  validateOn?: ValidateOn | null;
  required?: boolean | null;
  errorText?: string | null;
}): { error: string | null; onBlur: () => void } {
  const { id, value, checked, checks, validateOn, required, errorText } = opts;
  const form = useFormValidation();
  const [blurred, setBlurred] = useState(false);
  const [, bump] = useState(0);

  // `required: true` with no explicit rule still has to mean something — it is
  // the common way a spec marks a field mandatory, far more often than `checks`.
  const rules = useMemo<FieldCheck[]>(() => {
    const out = Array.isArray(checks) ? [...checks] : [];
    if (required === true && !out.some((c) => c?.type === 'required')) {
      out.unshift({ type: 'required', message: 'Required' });
    }
    return out;
  }, [checks, required]);

  const latest = useRef({ rules, value, checked });
  latest.current = { rules, value, checked };

  useEffect(() => {
    if (!form) return;
    return form.register(id, {
      validate: () => {
        const { rules: r, value: v, checked: c } = latest.current;
        const err = runChecks(r, v, c);
        // Re-render so a field revealed by submit paints its message immediately,
        // rather than on whatever unrelated update happens next.
        bump((n) => n + 1);
        return err;
      },
    });
  }, [form, id]);

  const computed = runChecks(rules, value, checked);
  const timing: ValidateOn = validateOn ?? 'blur';
  // A submit attempt reveals EVERY field regardless of its own timing — that is the
  // "highlight any mandatory field" behaviour, and a field whose timing is 'blur'
  // must not stay silent just because the reader never focused it.
  const revealed = (form?.submitted ?? false) || (timing === 'change') || (timing === 'blur' && blurred);

  return {
    error: errorText != null ? errorText : revealed ? computed : null,
    onBlur: () => { if (timing === 'blur') setBlurred(true); },
  };
}
