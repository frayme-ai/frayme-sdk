# Input

Text input field, with optional inline prefix/suffix strings and a leading `icon` rendered inside the bordered box (adornments share the field background and dim with a disabled control). Use { $bindState } on value for two-way binding. Use checks for validation (e.g. required, email, minLength). validateOn controls timing (default: blur).

## Example

```json
{
  "root": "input",
  "elements": {
    "input": {
      "type": "Input",
      "props": {
        "label": "Email",
        "name": "email",
        "type": "email",
        "placeholder": "you@example.com"
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | The field label shown above (or visually hidden via `labelPlacement:hidden`, still read by screen readers). Keep to 1-3 words ("Email", "Full name"). |
| `name` | `string` | The form field name, the key this value is collected under in a Form's `commit` `fields` payload, and used to derive the input's DOM id. |
| `type` | `"text" \| "email" \| "password" \| "number" \| "tel" \| "url" \| "search"` | Native input type (default text), drives browser validation, the mobile keyboard, and masking (password dots, number spinners). Match it to the data: `email`/`tel`/`url` for contact fields, `number` for quantities, `search` for a filter box. |
| `placeholder` | `string` | Faint hint text shown inside the empty field (e.g. "you@example.com"). Not a substitute for `label`, it disappears on typing/for screen readers relying on it alone. |
| `value` | `string` | Current text value. Use `{ $bindState }` for two-way binding so other elements can read and drive it; otherwise sets the initial value. |
| `checks` | `({ type: string, message: string, args: Record&lt;string, any> })[]` | Client-side validation rules as [{type, message, args?}], e.g. [{"type":"required","message":"Required"},{"type":"minLength","message":"Too short","args":{"min":3}}]. `type` names the rule (required · minLength · maxLength · pattern · email · …), `message` is the shown error, `args` carries the rule's parameters. Evaluated per `validateOn` timing. |
| `validateOn` | `"change" \| "blur" \| "submit"` | When `checks` run: change (live) · blur (default, on leaving the field) · submit (only when an enclosing Form commits). |
| `inputMode` | `"text" \| "numeric" \| "decimal" \| "email" \| "tel" \| "url" \| "search"` | Mobile keyboard hint (derived from `type` when omitted). |
| `autocomplete` | `"on" \| "off" \| "name" \| "email" \| "username" \| "current-password" \| "new-password" \| "tel" \| "one-time-code"` | Browser autofill hint (the HTML `autocomplete` attribute; default on). |
| `autofocus` | `boolean` | Focus the field automatically on mount (default false). Use sparingly, at most one autofocused field per screen. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner-radius token for the input box: none · sm · md (default) · lg · full. Drop to `sm` on dense forms, reach for `full` for a pill search field; use `radiusValue` for an exact length. |
| `radiusValue` | `string \| number` | Exact corner radius (e.g. "12px" / "1rem"). Overrides the `radius` enum, which is the default. |
| `align` | `"left" \| "center" \| "right"` | Text alignment inside the box (default left; use right for currency/numeric fields). |
| `minLength` | `number` | Minimum character length, enforced natively via the `minlength` attribute (also enforce via `checks` for a custom error message). |
| `maxLength` | `number` | Maximum character length, enforced natively via the `maxlength` attribute (no default, unlimited). |
| `min` | `number` | Numeric lower bound, enforced natively via the `min` attribute (only meaningful when `type:number`). |
| `max` | `number` | Numeric upper bound, enforced natively via the `max` attribute (only meaningful when `type:number`). |
| `step` | `number` | Numeric step granularity for the native spinner/keyboard arrows, enforced via the `step` attribute (only meaningful when `type:number`; default 1). |
| `prefix` | `string` | Inline leading adornment string rendered INSIDE the bordered field, sharing its background (e.g. "£", "@"; default none). |
| `suffix` | `string` | Inline trailing adornment string rendered INSIDE the bordered field, sharing its background (e.g. ".com", "kg"; default none). |
| `icon` | `string` | Leading icon by registry name (same closed icon set as Button.icon, e.g. "mail" / "lock" / "user") rendered inside the field before the text, in the muted color; unknown names render nothing (default none). |
| `borderColor` | `string` | Resting border color of the field box (default border token). |
| `bg` | `string` | Field background color, shared by the box and any prefix/suffix/icon adornments (default card token). |
| `mutedColor` | `string` | Secondary/muted text colour, help text, the leading icon + prefix/suffix adornments, and the ::placeholder text (default the muted-foreground token). |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit, no per-keystroke stream. |
| `disabled` | `boolean` | Grey out + block input (adds `disabled`/`aria-disabled`). |
| `readonly` | `boolean` | Value is visible but not editable (`readOnly`; Select/Switch/Slider become non-interactive). |
| `required` | `boolean` | Mark the field required (`required` attr + a required marker on the label). |
| `helpText` | `string` | Muted hint line under the control, formatting guidance or context (hidden while `errorText` is set). |
| `errorText` | `string` | Error message under the field, the danger help line + `aria-invalid` on the control; the text-box controls (Input/Textarea/Select) also get a danger control border (overrides helpText when set). |
| `size` | `"sm" \| "md" \| "lg"` | Control height, font-size, and padding together (default `md`); use `sm` in dense forms and filter rows, `lg` for touch targets or roomy layouts. |
| `labelPlacement` | `"top" \| "hidden"` | Label position: top (default) · hidden (visually removed but kept for a11y via sr-only). |
| `labelColor` | `string` | Text colour of the field label/legend line above or beside the control (default the foreground token, inherits). Help text stays `mutedColor`; the error line stays the danger token. |
| `accent` | `string` | Brand color lever: focus ring + checked/active fill. Defaults to the accent token, a neutral until a theme sets one. |
| `width` | `string \| number` | Field width (e.g. "12rem" or "100%"; default 100%). For Checkbox/Radio/Switch (default auto) it constrains the whole field incl. label wrap. |

## Events

### commit

The field finished editing, Enter was pressed OR focus left it (tab/click away); params carry {value, name}, the finished text and the field name.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

### change

The text changed on every keystroke/edit; params carry {value, name}, the live current value and the field name. Only fires when `emitOnChange` !== false; the bound `value` state stays live regardless.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

See [Events](../../events.md) for the full payload contract.
