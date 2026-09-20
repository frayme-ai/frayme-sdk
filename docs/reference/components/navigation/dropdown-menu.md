# DropdownMenu

Dropdown menu with trigger button and selectable items. Use { $bindState } on value for selected item binding. `accent` colors the selected-item highlight, which also carries a trailing check glyph. The open menu light-dismisses on an outside click or Escape (or re-clicking the trigger).

## Example

```json
{
  "root": "dropdown-menu",
  "elements": {
    "dropdown-menu": {
      "type": "DropdownMenu",
      "props": {
        "label": "Sort by",
        "items": [
          {
            "label": "Newest first",
            "value": "newest"
          },
          {
            "label": "Oldest first",
            "value": "oldest"
          },
          {
            "label": "Most popular",
            "value": "popular"
          }
        ],
        "value": null,
        "placeholder": null,
        "triggerVariant": null,
        "menuSurface": null,
        "triggerColor": null,
        "menuBg": null,
        "borderColor": null,
        "menuWidth": null,
        "maxHeight": null,
        "radiusValue": null,
        "caretIcon": null,
        "motion": null,
        "accent": null,
        "accentText": null,
        "radius": null,
        "size": null,
        "fullWidth": null,
        "align": null
      }
    }
  }
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `label` | `string` | Fallback trigger text shown when nothing is selected and no `placeholder` is set. Keep to 1-3 words ("Sort by", "Actions"). |
| `items` | `({ label: string, value: string })[]` | The menu options as [{label, value}], label is the visible menu text, value the id emitted on `select` and matched against `value`, e.g. [{"label":"Newest first","value":"newest"},{"label":"Oldest first","value":"oldest"}]. |
| `value` | `string` | Currently selected item (must match one item's `value`); its `label` shows in the trigger. Use `{ $bindState }` for two-way binding; otherwise sets the initial selection (default none, the trigger shows `placeholder`/`label`). |
| `placeholder` | `string` | Trigger text when nothing is selected (defaults to `label`). |
| `triggerVariant` | `"primary" \| "secondary" \| "ghost" \| "outline"` | Visual hierarchy of the trigger button: primary (solid) · secondary (muted fill, default) · ghost (transparent until hover) · outline (bordered). Match it to the trigger's weight on the page, `ghost`/`outline` for a quiet menu, `primary` for a prominent action. |
| `menuSurface` | `"solid" \| "elevated" \| "glass"` | Popover treatment (mirrors Card surface): solid (default) · elevated · glass. |
| `triggerColor` | `string` | Background fill of the trigger button, naming a specific brand colour (default the token for the chosen `triggerVariant`). Pair with `accentText` for a legible label on that background. |
| `menuBg` | `string` | Menu panel background fill, the value channel over the `menuSurface` enum (default the card token; `glass` keeps its blur/shadow). |
| `borderColor` | `string` | Menu panel border colour (default the border token). |
| `menuWidth` | `string \| number` | Fixed popover width (e.g. "220px"); default auto (≥ trigger). |
| `maxHeight` | `string \| number` | Scroll the list past this height (e.g. "240px"); default unbounded. |
| `radiusValue` | `string \| number` | Exact corner radius of the trigger button AND the menu panel (e.g. "12px" / "1rem"), the two stay matched. Overrides the `radius` enum, which is the default. |
| `caretIcon` | `string` | Glyph NAME (from the closed icon registry (or a single emoji glyph, rendered as-is), e.g. "chevron-down") for the trigger caret. Default is the literal ▾ char; a known name swaps in that icon, an unknown/absent name keeps ▾. Never raw SVG. |
| `motion` | `"none" \| "fast" \| "normal" \| "slow"` | Enter-transition speed for the open menu (fast/normal/slow). Default: no animation, the menu appears instantly. |
| `accent` | `string` | Text colour of the selected menu item (which also carries a trailing check glyph), and a faint 12% tint of the same colour as the item hover background (default the primary token). It does not fill the trigger, `triggerColor` does that. |
| `accentText` | `string` | Text colour of the trigger label and the selected menu item, pairs with `triggerColor` on the trigger fill and with `accent` on the selected item (default the primary-foreground token on the trigger; the `accent` colour on the selected item). |
| `radius` | `"none" \| "sm" \| "md" \| "lg" \| "full"` | Corner-radius token for the control (default `md`); drop to `sm`/`none` on dense toolbars, `lg` or `full` for a pill-shaped button. |
| `size` | `"sm" \| "md" \| "lg"` | Control height + padding + font-size together (default md). |
| `fullWidth` | `boolean` | Stretch the control to fill its container width (default false); set true for stacked mobile CTAs or a button that spans a form row. |
| `align` | `"start" \| "center" \| "end"` | Inline content / justification within the control (default center). |
| `disabled` | `boolean` | Grey out + block input (adds `disabled`/`aria-disabled`). Also what the runtime sets once an action this control feeds has committed, see the param freeze. |

## Events

### select

A menu item was clicked; params carry {value, label} and the menu closes.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Optional. The picked item’s value (row object, ISO date, option value, node value). |
| `label` | `string` | Optional. The picked item’s visible label when distinct from value. |
| `id` | `string \| number` | Optional. The picked item’s id when the data carries one. |
| `index` | `number` | Optional. The picked item’s position in the rendered set. |
| `selected` | `unknown[]` | Optional. The FULL selection set after the pick (multi-select surfaces). |
| `checked` | `boolean` | Optional. Whether the pick turned the item on or off (checkbox-style rows). |

### commit

The same click, as the terminal "do it" signal, bind this when the menu IS the action (an Actions menu that archives, sends, files), rather than a picker that sets a value. Params carry {value, label}. Only fires when bound, so a picker menu is unaffected. Required actions are counted on commit, so a menu-driven required action must bind THIS, not select.

| Key | Type | Description |
| --- | --- | --- |
| `value` | `string` | Optional. The committed text/value when the affordance carries one (e.g. the typed prompt on Enter). |
| `fields` | `Record&lt;string, unknown>` | Optional. All named field values collected at submit (Form only, via FormData). |
| `label` | `string` | Optional. The visible label of the activated control, item identity for mapped buttons/actions. |
| `name` | `string` | Optional. The control’s machine name when it has one. |
| `index` | `number` | Optional. Position of the activated item when it came from a list (Fab actions, pricing plans). |
| `control` | `string` | Optional. Names a secondary affordance inside a composite control that fired the primary verb (e.g. PromptInput’s attach button → control:"attach"). |

See [Events](../../events.md) for the full payload contract.
