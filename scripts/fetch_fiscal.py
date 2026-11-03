#!/usr/bin/env python3
"""Fetch Irish general government finance indicators from the CSO API and
regenerate data/fiscal.js.

Sources:
- GFQ01: General Government Transactions ESA2010 (revenue, expenditure, balance B9, interest;
  seasonally adjusted variants of the first three)
- GFQ02: General Government Net Worth, Gross and Net Debt (gross debt, EDP face value)
- NA001: Modified Gross National Income at Current Market Prices (annual nominal GDP, GNI*)

Derived by this script (flagged as our methodology in the page footnotes):
- primary balance = B9 + interest expenditure (non-SA, ESA concept)
- debt/GDP and debt/GNI* annual ratios = end-year gross debt / annual nominal aggregate

Usage: python3 scripts/fetch_fiscal.py
"""
import csv
import io
import json
import re
import urllib.request
from pathlib import Path

CSO = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset"
ROOT = Path(__file__).resolve().parent.parent

GFQ01_CSV = f"{CSO}/GFQ01/CSV/1.0/en"
GFQ02_CSV = f"{CSO}/GFQ02/CSV/1.0/en"
NA001_CSV = f"{CSO}/NA001/CSV/1.0/en"

# GFQ01 item codes
GFQ01_REVENUE = "01"        # Total revenue (NSA)
GFQ01_EXPENDITURE = "09"    # Total expenditure (NSA)
GFQ01_INTEREST = "14"       # Interest excl FISIM (NSA)
GFQ01_BALANCE = "21"        # Net lending/borrowing B9 (NSA)
GFQ01_REV_SA = "30"         # Revenue (SA)
GFQ01_EXP_SA = "31"         # Expenditure (SA)
GFQ01_BAL_SA = "32"         # B9 (SA)

# GFQ02 item codes
GFQ02_GROSS_DEBT = "26"     # Gross General Government Debt (EDP face value)

# NA001 item codes
NA001_GDP = "01"            # GDP at current market prices
NA001_GNI_STAR = "10"       # Modified GNI at current market prices


def fetch_csv(url):
    with urllib.request.urlopen(url, timeout=120) as resp:
        return resp.read().decode("utf-8-sig")


def quarter_records(text, item_col, item_code, levels=True):
    """Extract {t: level} for one item of a GFQ quarterly table, then build
    records with qoq/yoy (percent for levels, pp for balances handled by caller)."""
    series = {}
    for row in csv.DictReader(io.StringIO(text)):
        if row[item_col] != item_code or not row["VALUE"]:
            continue
        m = re.match(r"(\d{4})Q(\d)", row["Quarter"])
        if not m:
            continue
        t = int(m.group(1)) * 4 + int(m.group(2)) - 1
        series[t] = float(row["VALUE"])
    return series


def to_records(series, pct=True):
    """Series {t: level} -> [{quarter, value, qoq, yoy}] with growth for levels."""
    out = []
    for t in sorted(series):
        if pct:
            qoq = round((series[t] / series[t - 1] - 1) * 100, 2) if t - 1 in series else None
            yoy = round((series[t] / series[t - 4] - 1) * 100, 2) if t - 4 in series else None
        else:
            qoq = round(series[t] - series[t - 1], 2) if t - 1 in series else None
            yoy = round(series[t] - series[t - 4], 2) if t - 4 in series else None
        out.append({"quarter": f"{t // 4}Q{t % 4 + 1}", "value": series[t], "qoq": qoq, "yoy": yoy})
    return out


def main():
    gfq01 = fetch_csv(GFQ01_CSV)
    gfq02 = fetch_csv(GFQ02_CSV)
    na001 = fetch_csv(NA001_CSV)

    def gfq01_series(item):
        return quarter_records(gfq01, "C03144V03796", item)

    revenue = gfq01_series(GFQ01_REVENUE)
    expenditure = gfq01_series(GFQ01_EXPENDITURE)
    interest = gfq01_series(GFQ01_INTEREST)
    balance = gfq01_series(GFQ01_BALANCE)
    revenue_sa = gfq01_series(GFQ01_REV_SA)
    expenditure_sa = gfq01_series(GFQ01_EXP_SA)
    balance_sa = gfq01_series(GFQ01_BAL_SA)
    debt = quarter_records(gfq02, "C03145V03797", GFQ02_GROSS_DEBT)

    # primary balance (NSA): B9 + interest expenditure
    primary = {t: round(balance[t] + interest[t], 2) for t in balance if t in interest}

    # annual nominal aggregates from NA001
    gdp_nominal, gni_star = {}, {}
    for row in csv.DictReader(io.StringIO(na001)):
        if not row["VALUE"]:
            continue
        year = int(row["Year"])
        if row["C03399V04176"] == NA001_GDP:
            gdp_nominal[year] = float(row["VALUE"])
        elif row["C03399V04176"] == NA001_GNI_STAR:
            gni_star[year] = float(row["VALUE"])

    # annual ratios: end-year gross debt / nominal aggregate (percent)
    debt_gdp, debt_gni = [], []
    for year in sorted(gdp_nominal):
        t = year * 4 + 3  # Q4 index
        if t not in debt:
            continue
        d = debt[t]
        rec = {"year": str(year), "value": round(d / gdp_nominal[year] * 100, 1)}
        rec["yoy"] = (
            round(rec["value"] - debt_gdp[-1]["value"], 1) if debt_gdp else None
        )
        debt_gdp.append(rec)
        if year in gni_star:
            rec2 = {"year": str(year), "value": round(d / gni_star[year] * 100, 1)}
            rec2["yoy"] = (
                round(rec2["value"] - debt_gni[-1]["value"], 1) if debt_gni else None
            )
            debt_gni.append(rec2)

    data = {
        # quarterly flows, EUR millions
        "revenue_sa": to_records(revenue_sa),
        "expenditure_sa": to_records(expenditure_sa),
        "balance_sa": to_records(balance_sa, pct=False),
        "revenue": to_records(revenue),
        "expenditure": to_records(expenditure),
        "interest": to_records(interest, pct=False),
        "balance": to_records(balance, pct=False),
        "primary_balance": to_records(primary, pct=False),
        # quarterly stocks, EUR millions (EDP face value)
        "debt": to_records(debt, pct=False),
        # annual nominal aggregates, EUR millions
        "gdp_nominal": gdp_nominal,
        "gni_star": gni_star,
        # annual ratios, percent (our derivation from CSO data)
        "debt_gdp": debt_gdp,
        "debt_gni_star": debt_gni,
    }

    js = "const FISCAL_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n"
    (ROOT / "data" / "fiscal.js").write_text(js)
    print(f"Wrote data/fiscal.js")
    for k in data:
        v = data[k]
        n = len(v) if isinstance(v, list) else len(v)
        last = v[-1] if isinstance(v, list) and v else None
        print(f"  {k}: n={n}" + (f" last={last}" if last else ""))


if __name__ == "__main__":
    main()
