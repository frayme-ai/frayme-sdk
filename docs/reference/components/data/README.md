# Data display

32 components in this group.

| Component | Description |
|---|---|
| [AvatarGroup](avatar-group.md) | An overlapping stack of avatars with a "+N" overflow chip — for showing who is on a team / who reacted. Each a |
| [Avatar](avatar.md) | Circular user avatar: renders the image at `src`, falling back to initials derived from `name` when the image  |
| [Badge](badge.md) | Compact status or count chip holding a 1-3 word `text` ("Active", "Beta", "12 new"). Reach for it to label an  |
| [BoardColumn](board-column.md) | One kanban column: a header (title + optional count badge) over a vertical stack of KanbanCard children. Set ` |
| [CodeBlock](code-block.md) | Read-only code block. Renders `code` as escaped text (never HTML) in a mono &lt;pre>&lt;code> with an optional |
| [ColumnHeader](column-header.md) | Standalone sortable/resizable column header cell for composing custom table heads. Bind on.sort for the toggle |
| [DataTable](data-table.md) | A full-fledged data table: sortable, selectable, client-paginated, with optional per-column drag-resize (`resi |
| [DescriptionList](description-list.md) | A list of term → definition pairs rendered as a semantic &lt;dl>/&lt;dt>/&lt;dd>. Pick stacked, inline, or gri |
| [DiffView](diff-view.md) | A line-based diff of two text blocks: added lines tinted green (+), removed lines tinted red (-), unchanged ne |
| [EditableSpreadsheetGrid](editable-spreadsheet-grid.md) | A bounded, editable data grid: header-labelled columns and rows where you edit one cell at a time (click or Ta |
| [FacetList](facet-list.md) | A multi-select facet list with optional result counts: each row is a labelled checkbox that toggles its value  |
| [FilterBar](filter-bar.md) | A horizontal filter bar: removable active-filter chips, an inline search box, a clear-all, and an Apply button |
| [FilterPanel](filter-panel.md) | A vertical filter panel grouping several collapsible facet sections, plus an Apply button. Each section header |
| [Gantt](gantt.md) | A read-only Gantt / timeline chart: each task is a horizontal bar positioned on a shared 0..rangeMax axis (lef |
| [Heading](heading.md) | Section heading rendered as a real h1-h4 tag. `level` sets the semantic tag (a11y/SEO); `size` sets the visual |
| [Highlight](highlight.md) | Wraps every `query` match inside `text` in &lt;mark> spans — reach for it to highlight the search terms within |
| [JsonView](json-view.md) | A read-only, collapsible JSON tree. `data` is any JSON value; objects/arrays are expandable nodes, primitives  |
| [KanbanBoard](kanban-board.md) | A horizontal, side-scrolling row of kanban columns. Either pass a `columns` array (each with its own cards) OR |
| [KanbanCard](kanban-card.md) | A single board card: a title, optional description, status label chips, an assignee avatar + meta line, and (w |
| [Kbd](kbd.md) | Renders one or more keyboard keys as styled `<kbd>` chips joined by "+" (e.g. "Cmd + K") — for documenting sho |
| [ListItem](list-item.md) | A single list/menu row: leading icon + title/description stack + trailing text/badge. Renders an &lt;a> when ` |
| [ProgramGuideGrid](program-guide-grid.md) | A broadcast EPG: a channel gutter on the left, a proportional horizontal time axis across the top, and one tim |
| [RelativeTime](relative-time.md) | A self-updating relative timestamp ("2h ago") or countdown ("expires in 3:42"). `target` is an ISO string or e |
| [StatGroup](stat-group.md) | A responsive grid wrapper around several Stat tiles (children). Lays KPIs out in a row/grid with an optional d |
| [Stat](stat.md) | A KPI/metric tile: muted label, large value, an optional colored delta with an up/down arrow, and an optional  |
| [Table](table.md) | Static data table: `columns` are the header labels and `rows` a 2D array of cell strings, e.g. [["Alice","admi |
| [Tag](tag.md) | Compact chip/tag for labels, filters, and selected tokens. `tone` colors it by intent; set `removable` for a d |
| [Text](text.md) | Paragraph or inline body copy holding a single plain-text string. Reach for it for prose, captions, help lines |
| [TimelineItem](timeline-item.md) | A single timeline entry — a dot (with optional icon), a connector line, and a title/time/description — for com |
| [Timeline](timeline.md) | A vertical or horizontal sequence of events, each a dot on a connector line with a title, optional time/descri |
| [Tree](tree.md) | A hierarchical expand/collapse tree. Branch rows toggle their children (aria-expanded); recursion is hard-capp |
| [VirtualList](virtual-list.md) | A long list rendered with hand-rolled virtualization (only the visible rows are in the DOM, for performance).  |
