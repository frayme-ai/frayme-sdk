# SearchInput

Search box with a leading search icon, an optional clear (×) button, and a loading spinner. Use { $bindState } on value for two-way binding; bind on.commit to run the search on Enter. Reach for it over a plain Input whenever a field is specifically a query box — it adds the icon, the one-click clear affordance, and a `loading` spinner slot for showing that results are in flight.

## Example

```json
{
  "root": "search-input",
  "elements": {
    "search-input": {
      "type": "SearchInput",
      "props": {
        "placeholder": "Search…",
        "clearable": true
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `placeholder` | `string` | Empty-state hint text shown when the box is empty (e.g. "Search products…"); make it name what the user is searching over. |
| `value` | `string` | Current query string. Use { $bindState } for two-way binding. |
| `name` | `string` | Form field name emitted in event params and used for native form submission; set it when the box lives inside a submitted &lt;form> or you need to identify the field. |
| `width` | `string \| number` | Exact box width (e.g. "320px" / "100%"). Overrides the default full width. |
| `size` | `"sm" \| "md" \| "lg"` | Control height, font size, and padding together (default md). Reach for `sm` in a dense toolbar/header and `lg` for a prominent landing-page search bar. |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner rounding (default md; `full` for a rounded search pill). |
| `radiusValue` | `string \| number` | Exact corner radius (e.g. "10px" / "0.75rem"). Overrides the `radius` enum, which is the default. |
| `loading` | `boolean` | Show a trailing spinner while results are fetching (replaces the clear button). |
| `clearable` | `boolean` | Show a clear (×) button when there is a query (default true). |
| `disabled` | `boolean` | Grey out the box (60% opacity, not-allowed cursor) and block typing, the clear button, and Enter-to-commit (default false). |
| `borderColor` | `string` | Resting border color of the search box (default the border token). Name a brand color to match a themed toolbar; the focus ring uses `accent`, not this. |
| `bg` | `string` | Field background color of the search box (default the card token). Set it when the box sits on a tinted surface and the default card fill does not read against it. |
| `accent` | `string` | Focus-ring color (default the primary token) + leading-icon tint (default the muted-foreground token; the icon is tinted only when `accent` is set). |
| `mutedColor` | `string` | Secondary/muted text colour — the placeholder hint and clear/loading affordances (default the muted-foreground token). When set (or with a custom `bg`), the clear button’s hover pill derives from it via color-mix instead of the neutral token. |
| `emitOnChange` | `boolean` | Emit `change` on every keystroke/drag (default true). Set false to hold the value in (bindable) state and deliver it only on commit/submit — no per-keystroke stream. |

## Events

### change

The input was typed into (only when emitOnChange !== false) or the clear (×) button was clicked; params carry { value, name } (name is the `name` prop, or null).

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The new value after the change. |
| `name` | `string` | Optional. The control’s machine name when it has one. |

### commit

Enter was pressed in the field (ignored while an IME composition is in progress); params carry { value, name } — bind this to trigger the search.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control — item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
