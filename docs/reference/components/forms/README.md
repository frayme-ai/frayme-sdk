# Forms & inputs

31 components in this group.

| Component | Description |
|---|---|
| [Calendar](calendar.md) | Standalone month calendar: a header (month name + prev/next chevrons), weekday labels, and a day grid. Days wi |
| [Checkbox](checkbox.md) | Single checkbox bound to a boolean `checked`. Use for an independent on/off choice (agree to terms, opt-in) or |
| [ColorPicker](color-picker.md) | Swatch-grid color picker with an optional hex field and a live preview chip. Two-way bound on `value`; per-swa |
| [Combobox](combobox.md) | Single-select typeahead / autocomplete. The input holds the query; a filtered menu lists matching options (cas |
| [DatePicker](date-picker.md) | Single-date picker: a bordered field button (formatted value or placeholder + a leading calendar icon) that op |
| [DateRangePicker](date-range-picker.md) | Date-range picker: a field button showing "start, end" that opens a month grid on demand, where days between  |
| [FieldError](field-error.md) | Inline validation error. Renders a small danger-toned line with a leading alert-circle icon and role="alert".  |
| [FileUpload](file-upload.md) | Click-to-upload zone: a dashed zone wrapping a native file picker (drag-drop is NOT handled, dropping a file  |
| [FormField](form-field.md) | Field group: a label + the wrapped control (children) + a help/error line. Use to give any bare control a cons |
| [Form](form.md) | Form wrapper that lays out fields + a submit button. Bind on.commit for the handler; the renderer prevents the |
| [Input](input.md) | Text input field, with optional inline prefix/suffix strings and a leading `icon` rendered inside the bordered |
| [Label](label.md) | Form/inline label. Renders a &lt;label> (with `htmlFor` when set to wire it to a control) plus an optional req |
| [MultiSelect](multi-select.md) | Multi-choice select that shows chosen items as removable chips plus an open option menu (selected options carr |
| [NumberInput](number-input.md) | Numeric field with −/+ step buttons that clamp to [min,max]. Reach for it over a bare Input when the value is  |
| [OTPInput](otp-input.md) | Segmented one-time-code entry: a row of single-character boxes. Typing routes characters into the code (respec |
| [PhoneInput](phone-input.md) | Phone-number field with a country dial-code prefix select and a tel input (renders the raw national-number dig |
| [QuantityStepper](quantity-stepper.md) | Compact −/+ quantity stepper with an editable numeric readout, clamped to [min,max]. Two-way bound on `value`. |
| [Radio](radio.md) | Mutually-exclusive single-choice group bound to a string `value` from a fixed `options` list. Use over Select  |
| [RangeSlider](range-slider.md) | Dual-thumb range filter for a price/age band, with an optional histogram behind the track. Bind valueMin & val |
| [Rating](rating.md) | Star/heart rating that doubles as an input or a display. Clicking sets value + emits change unless readOnly; w |
| [RichComposer](rich-composer.md) | A full-blown WYSIWYG rich-text composer (Salesforce Rich Text Area-style): a contentEditable surface + a deep  |
| [SearchInput](search-input.md) | Search box with a leading search icon, an optional clear (×) button, and a loading spinner. Use { $bindState } |
| [SegmentedControl](segmented-control.md) | Inline exclusive option group (a view/sort/density switch): a rounded track of segments where the selected one |
| [Select](select.md) | Native dropdown select bound to a single string `value` from a fixed `options` list (plain strings, or {value, |
| [Slider](slider.md) | Draggable single-thumb range control bound to a numeric `value` between `min` and `max`. Use for a continuous  |
| [Switch](switch.md) | Boolean on/off toggle bound to `checked`, applying immediately (no separate save step implied). Use over Check |
| [TagInput](tag-input.md) | Free-form chip/tag entry. Existing tags render as removable chips followed by a bare input; Enter or comma add |
| [Textarea](textarea.md) | Multi-line text input. Use { $bindState } on value for binding. Use checks for validation. validateOn controls |
| [TimePicker](time-picker.md) | Time-of-day field built on a native time input (SSR-safe, accessible) with a leading clock icon. `minuteStep`  |
| [ToggleGroup](toggle-group.md) | Group of toggle buttons. Type 'single' (default) or 'multiple'. Use { $bindState } on value. `attached` joins  |
| [Toggle](toggle.md) | Toggle button. Use { $bindState } on pressed for state binding. `activeColor`/`activeText` color the pressed s |
