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
- Labour, Prices and Fiscal pages complete, same patterns (see their page scripts).
- Financial page complete: highlights (Latest only - the CBI bulletin series scraped carry no rate forecasts), 7 charts: ECB policy rates (FM daily DFR/MRO), new lending rates HH (MIR A2C/A2B IE + A2C EA), NFC (MIR A2I IE/EA), household deposit rates (MIR L21/L22 IE + L21 EA), loans outstanding and annual growth (BSI A22/A20 stocks, YoY derived), net mortgage lending (BSI A22 flows, trailing 3 months). Homepage financial tile sparkline = IE new mortgage rate, last 5 years.
- Global page is a styled shell awaiting content, following the same patterns.

## ECB Data Portal (SDW) notes (Financial page, Nov 2026)

- Keyless REST API: `https://data-api.ecb.europa.eu/service/data/{DATAFLOW}/{series key}?startPeriod=YYYY-MM-DD` with `Accept: text/csv`; response columns include `TIME_PERIOD`, `OBS_VALUE`. No wildcards (`+` returns 400); a well-formed but absent key returns 404, a malformed one 400.
- Key rates (daily, euro area): `FM/D.U2.EUR.4F.KR.DFR.LEV`, `FM/D.U2.EUR.4F.KR.MRR_FR.LEV` (marginal lending `ML` no longer exists under that code).
- MIR (10-dim keys): `MIR.{FREQ}.{AREA}.{BS_ITEM}.{INSTRUMENT}.{FIXATION}.{BUSINESS}.{AMOUNT}.{SECTOR}.{CURRENCY}.{RATE_TYPE}` - e.g. `MIR.M.IE.B.A2C.A.R.A.2250.EUR.N` (IE new mortgage rate, AAR narrow); HH products use sector 2250, NFC loans use 2240 with instrument A2I (cost of borrowing, fixation AM) or A2A; deposits L21 overnight / L22 agreed maturity / L23 redeemable at notice.
- BSI (11-dim keys): `BSI.M.IE.N.A.{BS_ITEM}.A.{1=outstanding|4=flows}.U2.{SECTOR}.Z01.E` - A22 = house purchase loans (HH, 2250), A20 = NFC loans (2240); currency dim must be `A` (all currencies combined), dim8 is `U2` even for country data. NOTE: ECB recoded BSI keys under Regulation ECB/2021/2 (old keys still resolve as of Nov 2026, may be removed later).
- CSO PxStat CBM01/CBM02/HSQ08 money & banking tables are ARCHIVED (end 2023/2016) - do not use for current credit/rates; ECB BSI/MIR (CBI-submitted) are the current source.

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

## Chart windows & axes (Nov 2026)

- **Time-series charts show the latest 5 years by default** (`lastNYears*` helpers). A longer
  window only when the site owner explicitly specifies it - a footnote written by the builder does
  NOT count as a specification. Enforced by `tests/window-audit.js` (allowlist inside for
  owner-specified exceptions).
- **X-axis is year-only on all time charts** (`scales.x.time.unit = 'year'`); quarter/month detail
  stays in tooltips. Also enforced by `tests/window-audit.js`.

## Chart palette (selected Oct 2026)

**Nordic botanical** — series colours in order:
1. `#3E7C59` spruce (first series; also the semantic positive)
2. `#E8A33D` marigold (second)
3. `#8C5A7A` heather (third)
4. `#4A6FA5` fjord blue (fourth)

Semantic pair: positive `#3E7C59` spruce / negative `#8C5A7A` heather (palette-coherent; third colour where needed is `#E8A33D` marigold).
Range-plot bars: neutral translucent family colour (e.g. `rgba(62,124,89,0.12)` fill, `0.3` border).
Axis/ticks: `#9a9a9a`; legend text `#6b6b6b`.

Rationale: distinctive-but-beautiful for shared screenshots; chosen over terracotta editorial,
Dublin Bay (continuity), and ink & citrus in a four-way rendered comparison (fiscal.html mock).
When restyling live charts: line charts take series colours in order; multi-series charts never
exceed four series; watermark and neutral greys per the Scandinavian mock.

## Cache-busting convention (Oct 2026)

All local CSS/JS references carry `?v=N` (currently v2). **Whenever style.css or a shared JS file
changes, bump the version in every HTML file** (`?v=2` -> `?v=3`). Browsers cache per-URL, so a
version bump forces every visitor onto fresh assets. This was added after a stale stylesheet
served a mixed old/new layout (label overlapping sparkline) while the HTML was fresh.

Data files are versioned too; bump all versions together in one pass (the fetch scripts should
also append the version when they regenerate - or simpler: keep versions in HTML only and bump
on data refresh).


## Staging nevinomics.ie via the `live` branch (Nov 2026)

GitHub Pages publishes a whole branch - there is no per-page switch, and both the
custom domain and the github.io URL serve the configured source. To stage pages
gradually on nevinomics.ie:

- The `live` branch contains only pages approved for the custom domain, plus shared
  assets (style.css, fonts/, nav.js). It currently ships just `preview.html`.
- Go live: repo Settings -> Pages -> Source = branch `live` (folder `/`), add custom
  domain `nevinomics.ie`, then point DNS at GitHub Pages (ALIAS/ANAME to
  `ciarannevin.github.io`, or the A/AAAA records GitHub lists). HTTPS cert is automatic.
- Add a page to live: `git checkout live && git checkout main -- <page>.html <page>.js data/<data>.js ...`
  then add its entry to the `pages` list in nav.js (on live) and push. Each push redeploys.
- Publish everything: switch the Pages source back to `main`.
- Note: the daily data-refresh workflow only runs on the default branch (main), so
  copy refreshed data files into `live` when staging pages.

## Session workflow & work safety (Nov 2026)

The sandbox is disposable: it can expire between sessions ("Sandbox expired: the execution
environment was reclaimed") and even /tmp is wiped within a session. The ONLY durable storage
is the GitHub repo - anything not committed and pushed is gone when the sandbox dies.
Confirmed after the Nov 2026 sandbox expiry: full history (143 commits), PR #1 (merged) and all
branches were intact on origin; only the local checkout and /tmp scratch files were lost.

**Working rules**
- Commit after every meaningful chunk of work; push the branch before ending a session
  (a pushed branch or open PR protects the work even if the sandbox dies immediately after).
- Never keep important notes only in the sandbox: conventions, roadmap and checklists live in
  this file and README.md, committed to the repo. Test harnesses live in `tests/`, not `/tmp`.
- Data files are generated by `scripts/fetch_*.py` and committed - regenerate, never hand-edit.

**Session startup checklist (how to pick up where the last session left off)**
1. Clone if the sandbox is fresh: `gh repo clone ciarannevin/nevinomics /workspace/github__ciarannevin__nevinomics`
2. `git fetch` and read this file + README.md (page inventory above says what is built vs shell).
3. `git log --oneline -15` (what changed last) and `gh pr list --repo ciarannevin/nevinomics --state open` (any PR in flight).

**Session end checklist**
1. `git status` - commit anything uncommitted (WIP is fine if the message says so).
2. `git push -u origin <branch>`.
3. Update this file / README if conventions or page status changed.

**Long-run automation (no session required)**
- `.github/workflows/update-data.yml` refreshes `data/*.js|json` DAILY (06:00 UTC; CSO/CBI
  releases land on arbitrary weekday mornings, so daily keeps lag under 24h) and on demand,
  validates via `scripts/validate_data.py` + `node tests/dom-harness.js`, and only then
  auto-commits to main (each push triggers a Pages deploy). The site stays current for months
  even if nobody opens a session.

## Pre-go-live checklist (Nov 2026)

Privacy/legal items to resolve before public launch:
- [x] Fonts self-hosted (no third-party requests for Inter/Sora; OFL licenses in fonts/)
- [ ] Substack embed vs plain link decision - the embed iframe loads Substack's domain and
      may set cookies in that context; the plain link avoids the question entirely
- [ ] Cookie notice NOT required while the site sets no non-essential cookies; revisit the
      moment any analytics/tracking is added (consent required BEFORE any non-essential storage)
- [ ] Privacy policy page when the newsletter/any personal data collection goes live
- [ ] nevinomics.ie domain DNS + GitHub Pages custom domain (parked, user handling)
- [x] Scheduled data-fetch workflow: `.github/workflows/update-data.yml` (daily cron 06:00 UTC
      + manual dispatch) runs all `scripts/fetch_*.py`, gates the auto-commit on
      `scripts/validate_data.py` + `tests/dom-harness.js`, pushes to main -> Pages deploy.
      See "Session workflow & work safety" above.
