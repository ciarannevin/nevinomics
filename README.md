# Economic Indicators Dashboard

A web-based dashboard of economic indicators, starting with Irish GDP growth.
Built to be simple to read and easy to extend — one indicator at a time.

## Current indicators

- **GDP Growth — Ireland**: quarterly GDP, seasonally adjusted, constant (chain-linked) prices,
  with year-on-year growth. Source: CSO Quarterly National Accounts, table `NAQ04`.

## Run it

No build tools or server needed:

1. Open `index.html` in a browser (double-click works).
   - If charts don't render, serve locally instead: `python3 -m http.server` from this folder,
     then visit `http://localhost:8000`.

## Project structure

```
index.html          Page layout
style.css           Styling
app.js              Dashboard logic (KPIs, chart, interactions)
data/gdp.js         GDP data (generated — do not edit by hand)
scripts/fetch_cso.py  Refreshes data/gdp.js from the live CSO API
```

## Refresh the data

```bash
python3 scripts/fetch_cso.py
```

The CSO API (https://www.cso.ie/) is free and requires no API key.

## Roadmap

- [ ] Add more Irish indicators (inflation/CPI, unemployment, interest rates)
- [ ] European indicators (Eurostat API)
- [ ] Global indicators (World Bank / IMF APIs)
- [ ] Consider a component framework (React) or backend once the scope grows
