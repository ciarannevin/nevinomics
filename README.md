# Nevinomics

A dashboard of economic indicators for Ireland, with European and global context planned.
Personal learning project, built to make official statistics easy to read and share.

**Live site:** https://ciarannevin.github.io/nevinomics/

## Pages

| Page | Contents | Status |
|---|---|---|
| `index.html` | Home — latest key indicator, theme tiles | Live |
| `output.html` | Economic Output — GDP growth | Live (GNI*, industrial production planned) |
| `labour.html` | Labour market | Coming soon |
| `inflation.html` | Inflation & prices | Coming soon |
| `fiscal.html` | Government finances | Coming soon |
| `financial.html` | Rates & credit | Coming soon |
| `global.html` | Ireland in global context | Coming soon |
| `about.html` | Sources, methodology, roadmap | Live |

## Design

- Accent: `#009a44`; negative values in red; clean clinical layout
- Fonts: Space Grotesk (headings) + Inter (body)
- Every chart carries a `nevinomics` watermark (screenshot attribution)
- Shared nav/footer injected by `nav.js`; chart styling in `chart-theme.js`

## Project structure

```
*.html            Pages (one per theme)
style.css         Design system (colours, cards, layout)
nav.js            Shared navigation bar + footer
chart-theme.js    Chart.js defaults + watermark plugin
app.js            Page logic (GDP chart, KPIs, home hero)
data/gdp.js       GDP data (generated — do not edit by hand)
scripts/fetch_cso.py  Refreshes data/gdp.js from the CSO API
```

## Run locally

Open `index.html` in a browser, or serve: `python3 -m http.server` → http://localhost:8000

## Refresh the data

```bash
python3 scripts/fetch_cso.py
```

The CSO API (https://www.cso.ie/) is free and requires no API key.
Pushing to GitHub auto-deploys the site via GitHub Pages.
