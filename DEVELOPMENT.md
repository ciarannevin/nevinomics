# nevinomics — development notes

Conventions and lessons learned while building the Output page. Apply these on every other page.

## Layout & responsive rules

- **Tiles/cards: natural flex-wrap, never hard `min-width`.** Use `flex: 1 1 <preferred-width>` so items wrap to the next row the moment space runs out, instead of squeezing through ugly intermediate states. Inside a tile, let sub-columns (`.mini-cols`, `.forecast-years`) wrap too.
- **Multi-column layouts: `repeat(auto-fit, minmax(<content minimum>, 1fr))`**, not fixed column counts with abrupt breakpoints. Charts need ≥420px per card; use `@media (max-width: 480px)` only as a final single-column fallback.
- **`min-width: 0` on grid/flex children** containing canvases or tables — otherwise they refuse to shrink and overflow.
- **Tables on mobile:** wrap in `.table-scroll` (overflow-x: auto) with a sticky first column (`position: sticky; left: 0;` with opaque background). Give the table a sensible `min-width`.
- Units go in table **headers** ("(€m)", "(%)", "(pp)"), not repeated in cells.

## UI conventions

- **KPI tile format:** mini-columns (small muted label on top, value beneath, Space Grotesk, green/red by sign). Used for growth (QoQ/YoY) and forecast (year) groups. Section headings in `.kpi-heading` style ("Growth rates", "Annual growth forecasts").
- **Tooltips on the whole tile** (`title` on the outer div), with full indicator names — not on the small label span.
- **Legends must be scoped per chart.** Never mutate shared chart config; the forecast chart's duplicate-hiding legend filter leaked into the growth chart and hid GNP. The forecast chart's legend click toggles the actual+forecast **pair** together.
- Charts keep: watermark plugin, `.chart-wrap` heights, source footnotes.

## Data conventions & known gotchas

- **CSO PxStat:** seasonally adjusted constant prices = statistic `NAQ04S02` (NAQ04), `NAQ05S02` (NAQ05). GDP sector `007`, GNP `009`, MDD = Modified **Final** Domestic Demand `0155` (NOT Modified Total `0165` — verify against the CBI bulletin text).
- **GNI\* is annual-only.** GNP is the quarterly proxy. GNI\* needs quoting as a JS object key (`'GNI*'`).
- **Investment sub-components:** exactly three (Machinery & equipment `0035`, Intangible assets `0037`, Building & construction `0038`), all available SA and summing to the GFCF total. Do NOT go deeper (dwellings etc.) — those series are non-SA only.
- **Imports are stored as negative values** in the CSO data — display as magnitudes with "Less:" label.
- **Contributions to GDP growth** (pp): (Δcomponent ÷ GDP in base period) × 100, per quarter; 4-quarter column = average of last 4 quarterly contributions. Top-level components only (not investment sub-rows). Sum of contributions must equal GDP growth — use as a QA check.
- **Forecast vs outturn:** scraper reads the CBI bulletin's own "f" suffixes; every data point carries `forecast: true/false`. Charts draw forecast years dashed from the last actual; tiles take the first 3 forecast-flagged years and roll forward automatically.
- **Sources must be credited** in section footnotes: CSO table codes; Central Bank of Ireland Quarterly Bulletin for forecasts.

## Testing discipline (before every push)

1. `node --check` every touched JS file.
2. Run the Node DOM harnesses (see `/tmp` pattern: shim `document`, eval data files + page JS, call the init functions, assert rendered HTML) — this catches "empty strip" class bugs that static checks miss. **Recreate the harnesses inside the repo if `/tmp` is lost.**
3. Validate HTML tag balance.
4. Verify data identities: sub-components sum to totals; contributions sum to GDP growth.
5. After deploy, fetch the live files and confirm the change is actually served (deploys can lag ~75–120s).

## Page inventory

- Output page complete: highlights (growth + forecasts), growth chart (YoY/QoQ toggle), forecast chart (GDP/GNI*/MDD, solid/dashed), components table (with investment breakdown + contributions).
- Other pages are styled shells awaiting content, following the same patterns.

## Conventions (established during Labour page build, 2026)

- **Shared helpers live in `common.js`** (loaded before every page script): date/quarter conversions, windowing, tile builder, `sectorLabel`, `setBadge`, `rangePlotConfig`, `quarterlyLineConfig`, `bulletinName`. Page scripts contain only page-specific init functions. Do not redefine these in page scripts.
- **Badge = data period** (e.g. `2026Q2`, `September 2026`), never units. Units live in axis titles. Forecast badges show the bulletin's period, e.g. `2026Q3`, derived via `bulletinName()`.
- **Tile mini-columns use `.mini-cols`** everywhere (`.forecast-years` is retired).
- **Range plots** (horizontal bar+dot) all use `rangePlotConfig(breakdown, labelFmt, opts)` from common.js; supports both `{groups:[{group,...}]}` and `{sectors:[{sector,...}]}` shapes.
- **Quarterly line charts** use `quarterlyLineConfig(datasets, opts)`; dual-axis level+change charts use `dualAxisLevelChangeConfig` (labour.js, may promote to common.js when a second page needs it).
- **Sex colour coding**: total/all = green `#009a44`, male = blue `#0e5c8a`, female = amber `#c28a00`.
- **Footnote sources**: `Source: Central Statistics Office (<a href="https://data.cso.ie">Table XXX</a>)` as a suffix where possible; CBI: `Source: Central Bank of Ireland <a href="...bulletins-list">Quarterly Bulletin</a>`.
- **Month format**: badges use long month (`September 2026`); chart tooltips use short (`Sep 2026`).
- **Data files**: both `.js` (site payload) and `.json` (identical, for inspection/testing) are generated; this is intentional.
- **Python fetch scripts share `scripts/cso_common.py`**: `quarter_index`, `quarter_label`, `pct_change_levels` (ratio % changes), `pp_change_levels` (pp differences for rates), `year_window`.
- **PxStat quirks**: SA statistics in EHQ03/EHQ04 and occupation rows in EHQ53 are EMPTY in the API; SA earnings live in EHQ08, occupation earnings in EHQ57. EHQ59 uses NACE Rev 2.1 title-case labels - `sectorLabel` normalises both styles.
