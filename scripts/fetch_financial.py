#!/usr/bin/env python3
"""Fetch Irish financial indicators (rates & credit) and regenerate data/financial.js.

Sources (all free, no API key):
- ECB Data Portal SDW API (https://data-api.ecb.europa.eu), keyless:
  - FM  key ECB interest rates (daily): deposit facility (DFR), main refinancing (MRO)
  - MIR MFI interest rate statistics (monthly, Ireland IE and euro area U2):
        new business AAR rates for household mortgages (A2C), consumer credit (A2B),
        NFC loans (A2I), household overnight deposits (L21) and agreed-maturity deposits (L22)
  - BSI balance sheet items (monthly, Ireland): loans outstanding and flows
        for house purchase (A22) and NFC loans (A20)
  National MIR/BSI data are compiled from Central Bank of Ireland submissions.
- Note: CSO PxStat CBM01/CBM02/HSQ08 money & banking tables are archived (end 2023/2016),
  so ECB BSI/MIR are used for current credit and rate data.

Usage: python3 scripts/fetch_financial.py
"""
import csv
import io
import json
import re
import urllib.request
from datetime import date
from pathlib import Path

ECB = "https://data-api.ecb.europa.eu/service/data"
ROOT = Path(__file__).resolve().parent.parent

START_MONTHLY = "2015-01"
START_DAILY = "2015-01-01"

# --- ECB series keys ---------------------------------------------------------

# FM daily key rates (euro area)
FM_DFR = "FM/D.U2.EUR.4F.KR.DFR.LEV"      # deposit facility rate
FM_MRO = "FM/D.U2.EUR.4F.KR.MRR_FR.LEV"   # main refinancing operations, fixed rate

# MIR monthly new-business rates, AAR narrowly defined (dim10=N), EUR
MIR = {
    "mortgage_ie": "MIR/M.IE.B.A2C.A.R.A.2250.EUR.N",      # HH lending for house purchase
    "consumer_ie": "MIR/M.IE.B.A2B.A.R.A.2250.EUR.N",      # HH loans for consumption
    "dep_overnight_ie": "MIR/M.IE.B.L21.A.R.A.2250.EUR.N", # HH overnight deposits
    "dep_agreed_ie": "MIR/M.IE.B.L22.A.R.A.2250.EUR.N",    # HH deposits with agreed maturity
    "loans_nfc_ie": "MIR/M.IE.B.A2I.AM.R.A.2240.EUR.N",    # NFC loans, cost of borrowing, total
    "mortgage_ea": "MIR/M.U2.B.A2C.A.R.A.2250.EUR.N",
    "loans_nfc_ea": "MIR/M.U2.B.A2I.AM.R.A.2240.EUR.N",
    "dep_overnight_ea": "MIR/M.U2.B.L21.A.R.A.2250.EUR.N",
}

# BSI monthly, Ireland, all currencies combined, not adjusted, EUR millions
BSI = {
    "hh_house_outstanding": "BSI/M.IE.N.A.A22.A.1.U2.2250.Z01.E",  # loans for house purchase, outstanding
    "nfc_outstanding": "BSI/M.IE.N.A.A20.A.1.U2.2240.Z01.E",       # loans to NFCs, outstanding
    "hh_house_flows": "BSI/M.IE.N.A.A22.A.4.U2.2250.Z01.E",        # house purchase loans, financial transactions
}


def fetch_csv(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "text/csv"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read().decode("utf-8-sig")


def ecb_series(key, start):
    """-> {period: float} from an ECB SDW CSV series (monthly 'YYYY-MM' or daily 'YYYY-MM-DD')."""
    url = f"{ECB}/{key}?startPeriod={start}"
    rows = csv.DictReader(io.StringIO(fetch_csv(url)))
    out = {}
    for r in rows:
        v = r.get("OBS_VALUE", "")
        if v in ("", "NaN"):
            continue
        out[r["TIME_PERIOD"]] = float(v)
    return out


def month_index(label):
    m = re.match(r"(\d{4})M(\d{2})$", label) or re.match(r"(\d{4})-(\d{2})$", label)
    if not m:
        return None
    return int(m.group(1)) * 12 + int(m.group(2)) - 1


def month_label(t):
    return f"{t // 12}-{(t % 12 + 1):02d}"


def rate_records(series):
    """{t: rate%} monthly -> [{month, value, mom pp, yoy pp}]."""
    out = []
    for t in sorted(series):
        mom = round(series[t] - series[t - 1], 2) if t - 1 in series else None
        yoy = round(series[t] - series[t - 12], 2) if t - 12 in series else None
        out.append({"month": month_label(t), "value": series[t], "mom": mom, "yoy": yoy})
    return out


def level_records(series):
    """{t: level} monthly -> [{month, value, yoy %}] with YoY from level ratio."""
    out = []
    for t in sorted(series):
        yoy = round((series[t] / series[t - 12] - 1) * 100, 2) if t - 12 in series and series[t - 12] else None
        out.append({"month": month_label(t), "value": series[t], "yoy": yoy})
    return out


def flow_records(series):
    out = []
    for t in sorted(series):
        out.append({"month": month_label(t), "value": series[t]})
    return out


def compress_daily(series):
    """Policy rates are step functions: keep the first point, and at every change
    both the previous observation (old value) and the change date (new value), so
    a plain line chart draws exact plateaus. Final observation appended so the last
    plateau extends to the latest date."""
    items = sorted(series.items())
    if not items:
        return {}
    out = {items[0][0]: items[0][1]}
    prev_p, prev_v = items[0]
    for p, v in items[1:]:
        if v != prev_v:
            out[prev_p] = prev_v
            out[p] = v
            prev_v = v
        prev_p = p
    if items[-1][0] not in out:
        out[items[-1][0]] = items[-1][1]
    return out


def daily_records(series):
    out = []
    for p in sorted(series):
        y, m, d = p.split("-")
        out.append({"date": f"{y}-{m}-{d}", "value": series[p]})
    return out


def main():
    data = {"meta": {"fetched": date.today().isoformat(), "ecb_keys": {**{f"fm_{k}": v for k, v in [("dfr", FM_DFR), ("mro", FM_MRO)]}, **MIR, **BSI}}}

    policy = {}
    for name, key in [("dfr", FM_DFR), ("mro", FM_MRO)]:
        s = ecb_series(key, START_DAILY)
        if not s:
            raise SystemExit(f"No data for {key}")
        policy[name] = daily_records(compress_daily(s))
    data["policy"] = policy

    rates = {}
    for name, key in MIR.items():
        s = ecb_series(key, START_MONTHLY)
        if not s:
            raise SystemExit(f"No data for {key}")
        rates[name] = rate_records({month_index(p): v for p, v in s.items() if month_index(p)})
    data["rates"] = rates

    credit = {}
    for name, key in BSI.items():
        s = ecb_series(key, START_MONTHLY)
        if not s:
            raise SystemExit(f"No data for {key}")
        idx = {month_index(p): v for p, v in s.items() if month_index(p)}
        credit[name] = level_records(idx) if name.endswith("outstanding") else flow_records(idx)
    data["credit"] = credit

    # sanity checks
    for name, recs in rates.items():
        last = recs[-1]["value"]
        assert 0 <= last <= 25, f"rate {name} out of range: {last}"
        assert len(recs) > 100, f"rate {name} too short: {len(recs)}"
    for name, recs in credit.items():
        assert len(recs) > 100, f"credit {name} too short: {len(recs)}"
    assert 0 <= policy["dfr"][-1]["value"] <= 15, "DFR out of range"

    js = "// Generated by scripts/fetch_financial.py - ECB Data Portal (FM key rates, MIR rates, BSI credit); CBI-submitted national data\n"
    js += "const FINANCIAL_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n"
    out = ROOT / "data"
    (out / "financial.js").write_text(js)
    (out / "financial.json").write_text(json.dumps(data, indent=1))

    print(f"Wrote data/financial.js and data/financial.json (fetched {data['meta']['fetched']})")
    for name, recs in policy.items():
        print(f"  policy {name}: n={len(recs)} last={recs[-1]}")
    for name, recs in rates.items():
        print(f"  rate {name}: n={len(recs)} last={recs[-1]}")
    for name, recs in credit.items():
        print(f"  credit {name}: n={len(recs)} last={recs[-1]}")


if __name__ == "__main__":
    main()
