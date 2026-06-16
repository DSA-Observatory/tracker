# Features

## Case Search

The case database is designed around a single powerful search workflow with lightweight controls for legal research.

### Global Search

- Searches case title, case ID, ECLI, court, jurisdiction, parties, DSA provisions, category/theme keywords, summaries, source text, commentary, and document links.
- Supports scoped search so users can limit a query to a specific field family.
- Available scopes: all fields, case details, parties, legal tags, sources, timeline, primary sources, and secondary sources.

### Faceted Filters

Every filter uses a Floating UI-positioned autocomplete dropdown with multi-select checkboxes and live result counts.

- Status
- Country
- Category
- Theme
- DSA provisions
- Court
- Parties, including plaintiffs and defendants
- Decision year

### Result Counts

- The search panel shows `Showing X of Y cases`.
- Each filter option shows the number of matching cases for that option after applying the other active filters.
- Counts update as search text, search scope, and filters change.

### Search Chips

- Active filters are displayed as removable chips.
- Clicking a chip removes that filter value.
- `Clear filters` resets search text and all selected filters.

### Country Display

- Countries show flags where known.
- Country cells and menu options keep the flag and country name on a single line.

### Large Result Performance

- The search and filter panel stays sticky while browsing results.
- The table header stays sticky inside the result scroller.
- Result rows are virtualized so only the visible slice of the table is rendered.
- The default result display is a detailed full-width row-card view.
- Users can switch between detailed rows, compact rows, and dense table views.

### Result Table Fields

- Case title, internal case ID, and ECLI.
- Plaintiffs and defendants.
- Status.
- Country/jurisdiction.
- Court and decision date.
- DSA provisions and legal tags.
- Case timeline excerpt.
- Source links when URLs are available.
- Source text excerpt when no URL is available.

## Data Currently Used By Search

- `case_id`
- `title`
- `ecli`
- `status`
- `court`
- `jurisdiction`
- `plaintiffs`
- `defendants`
- `summary`
- `keywords`
- `dsa_articles`
- `document_links`
- `commentary`
- `decision_date`

## Data Model Improvements To Consider

The current import stores spreadsheet `Category` and `Theme` together in `keywords`, and stores timeline/source sections inside `summary` HTML. Search supports this, but stronger long-term search would benefit from first-class fields:

- `category`
- `themes`
- `case_timeline`
- `primary_sources`
- `secondary_sources`
- `source_links`
- `decision_year`
- normalized DSA article references

These fields would make filtering, analytics, and API queries more precise without relying on summary parsing.
