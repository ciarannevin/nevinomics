#!/usr/bin/env python3
"""Fetch Irish consumer price data from the CSO API and regenerate data/prices.js.

Sources:
- CPM20: Consumer Price Index (ECOICOP v2) - annual % change (C08), M-o-M % change (C07)
- CPM23: EU HICP - annual rate of change, monthly rate
- CPM22: Contributions to changes in the CPI (pp)

Note: from Feb 2026 the CSO archived the old CPM tables (CPM01/03/11/15) and
replaced them with ECOICOP Ver.2 versions: CPM20/21/22/23.

Usage: python3 scripts/fetch_prices.py
"""
import csv
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cso_common import quarter_label  # noqa: F401  (path setup)

CSO = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset"
CPM20_CSV = f"{CSO}/CPM20/CSV/1.0/en"
CPM23_CSV = f"{CSO}/CPM23/CSV/1.0/en"
CPM21_CSV = f"{CSO}/CPM21/CSV/1.0/en"
CPM22_CSV = f"{CSO}/CPM22/CSV/1.0/en"
ROOT = Path(__file__).resolve().parent.parent

CPI_YOY = "CPM20C08"
CPI_MOM = "CPM20C07"
HICP_YOY = "CHA..."
CPI_GROUPS = [
    "All Items",
    "Food and non-alcoholic beverages",
    "Alcoholic beverages, tobacco and narcotics",
    "Clothing and footwear",
    "Housing, water, electricity, gas and other fuels",
    "Furnishings, household equipment and routine household maintenance",
    "Health",
    "Transport",
    "Information and communication",
    "Recreation, sport and culture",
    "Education services",
    "Restaurants and accommodation services",
    "Personal care, social protection and miscellaneous goods and services",
]


def fetch_csv(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        return resp.read().decode("utf-8-sig")


MONTHS = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
}


def month_index(label):
    m = re.match(r"(\d{4})\s+(\w+)$", label)
    if not m or m.group(2) not in MONTHS:
        return None
    return int(m.group(1)) * 12 + MONTHS[m.group(2)] - 1


def month_label(t):
    return f"{t // 12}-{(t % 12 + 1):02d}"


def collect(rows, statistic, group_col, keep=None):
    """{group: {t: value}} for one statistic."""
    series = {}
    for r in rows:
        if r["STATISTIC"] != statistic or not r["VALUE"]:
            continue
        group = r[group_col]
        if keep is not None and group not in keep:
            continue
        t = month_index(r["Month"])
        if t is None:
            continue
        series.setdefault(group, {})[t] = float(r["VALUE"])
    return series


def to_records(by_t, years=5):
    """{t: yoy%} -> records with mom and yoy (already rates), windowed to years."""
    out = []
    if not by_t:
        return out
    latest_t = max(by_t)
    cutoff = latest_t - years * 12
    for t in sorted(by_t):
        if t < cutoff:
            continue
        mom = round(by_t[t - 1], 2) if t - 1 in by_t else None
        rec = {"month": month_label(t), "value": by_t[t], "mom": mom}
        out.append(rec)
    return out


def build_rates(rows, statistic, group_col, groups, years=5):
    """Annual rate series per group + latest month snapshot with ranges."""
    series = collect(rows, statistic, group_col, keep=set(groups))
    out = {}
    for group in groups:
        if group not in series:
            continue
        out[group] = to_records(series[group], years)
    return out


def build_group_snapshot(rows, statistic, group_col, groups, years=5):
    """Latest annual rate (dot) + 5-year range of annual rates (bar) per group."""
    series = collect(rows, statistic, group_col, keep=set(groups))
    latest_t = max(max(q.keys()) for q in series.values() if q)
    cutoff = latest_t - years * 12
    items = []
    for group in groups:
        if group not in series or latest_t not in series[group]:
            continue
        window = [v for t, v in series[group].items() if t > cutoff and t <= latest_t]
        items.append(
            {
                "group": group,
                "rate": round(series[group][latest_t], 1),
                "min5": round(min(window), 1) if window else None,
                "max5": round(max(window), 1) if window else None,
            }
        )
    items.sort(key=lambda x: x["rate"], reverse=True)
    return {"month": month_label(latest_t), "groups": items}


CONTRIBUTION_DIVISIONS = {
    "Food and Non-Alcoholic Beverages",
    "Alcoholic Beverages and Tobacco",
    "Clothing and Footwear",
    "Housing, Water, Electricity, Gas and Other Fuels",
    "Furnishings, Household Equipment and Routine Household Maintenance",
    "Health",
    "Transport",
    "Information and Communication",
    "Recreation, Sport and Culture",
    "Education Services",
    "Restaurants and Accommodation Services",
    "Personal Care, Social Protection and Miscellaneous Goods and Services",
    "Insurance and Financial Services",
}


def build_contributions(rows, statistic, group_col, months=1):
    """Latest month pp contributions by top-level division only, sorted."""
    series = collect(rows, statistic, group_col, keep=CONTRIBUTION_DIVISIONS)
    latest_t = max(t for q in series.values() for t in q)
    items = []
    for group, q in series.items():
        if latest_t not in q:
            continue
        items.append({"group": group, "contribution": round(q[latest_t], 2)})
    items.sort(key=lambda x: x["contribution"], reverse=True)
    return {"month": month_label(latest_t), "groups": items}


CPI21_CORE = {
    "excl_energy": "Overall index excluding energy",
    "excl_tobacco": "Overall index excluding tobacco",
}


def build_core(rows, years=5):
    """Annual % change for the CPM21 special aggregates (core measures)."""
    out = {}
    for key, label in CPI21_CORE.items():
        series = {}
        for r in rows:
            if r["STATISTIC"] != "CPM21C08" or not r["VALUE"]:
                continue
            if r["Selected Sub Indices"] != label:
                continue
            t = month_index(r["Month"])
            if t is None:
                continue
            series[t] = float(r["VALUE"])
        if not series:
            continue
        recs = to_records(series, years)
        for r in recs:
            r.pop("mom", None)  # MoM is a separate statistic; the value here would be misleading
        out[key] = {"label": label, "series": recs}
    return out


def write_js(name, payload, path):
    with path.open("w") as f:
        f.write("// Generated by scripts/fetch_prices.py - CSO CPM20, CPM23, CPM22\n")
        f.write(f"const {name} = ")
        json.dump(payload, f, separators=(",", ":"))
        f.write(";\n")


def main():
    r20 = list(csv.DictReader(io.StringIO(fetch_csv(CPM20_CSV))))
    r21 = list(csv.DictReader(io.StringIO(fetch_csv(CPM21_CSV))))
    r23 = list(csv.DictReader(io.StringIO(fetch_csv(CPM23_CSV))))
    r22 = list(csv.DictReader(io.StringIO(fetch_csv(CPM22_CSV))))

    # discover HICP YoY statistic code from labels
    hicp_stats = {}
    for r in r23:
        hicp_stats.setdefault(r["STATISTIC"], r["Statistic Label"])
    hicp_yoy_code = [k for k, v in hicp_stats.items() if "Annual rate" in v]
    hicp_mom_code = [k for k, v in hicp_stats.items() if "Monthly rate" in v]
    if not hicp_yoy_code or not hicp_mom_code:
        raise SystemExit("Could not identify HICP rate statistics")
    print("HICP stats:", {k: v for k, v in hicp_stats.items()})

    # contributions statistic
    c_stats = {}
    for r in r22:
        c_stats.setdefault(r["STATISTIC"], r["Statistic Label"])
    print("Contribution stats:", c_stats)
    contrib_code = [k for k, v in c_stats.items() if "12 months" in v]
    if not contrib_code:
        raise SystemExit("Could not identify contributions statistic")
    contrib_code = contrib_code[0]

    # CPI series: All Items YoY + MoM
    cpi_yoy = build_rates(r20, CPI_YOY, "Commodity Group", ["All Items"])
    cpi_mom = build_rates(r20, CPI_MOM, "Commodity Group", ["All Items"])
    # merge mom into yoy records
    cpi = []
    mom_by_month = {r["month"]: r["value"] for r in cpi_mom.get("All Items", [])}
    for r in cpi_yoy.get("All Items", []):
        cpi.append({**r, "mom": mom_by_month.get(r["month"])})

    # HICP All Items
    hicp_yoy = build_rates(r23, hicp_yoy_code[0], "Commodity Group", ["All Items"])
    hicp_mom = build_rates(r23, hicp_mom_code[0], "Commodity Group", ["All Items"])
    hicp = []
    mom_by_month = {r["month"]: r["value"] for r in hicp_mom.get("All Items", [])}
    for r in hicp_yoy.get("All Items", []):
        hicp.append({**r, "mom": mom_by_month.get(r["month"])})

    # CPI excluding energy products (special aggregate lives in CPM20 groups?)
    # Core measures from CPM21 special aggregates
    core = build_core(r21)

    # CPI by group snapshot (range plot)
    group_snapshot = build_group_snapshot(r20, CPI_YOY, "Commodity Group", CPI_GROUPS)

    # contributions
    contributions = build_contributions(r22, contrib_code, "COICOP Group")

    if not cpi or not hicp:
        raise SystemExit("No CPI/HICP data fetched")

    payload = {
        "cpi": cpi,
        "hicp": hicp,
        "core": core,
        "cpi_groups": group_snapshot,
        "contributions": contributions,
    }

    out = ROOT / "data"
    write_js("PRICES_DATA", payload, out / "prices.js")
    (out / "prices.json").write_text(json.dumps(payload, indent=1))

    print(f"CPI: {len(cpi)} months, last: {cpi[-1]}")
    print(f"HICP: {len(hicp)} months, last: {hicp[-1]}")
    print(f"Groups snapshot: {len(group_snapshot['groups'])} groups, month: {group_snapshot['month']}")
    print(f"Contributions: {len(contributions['groups'])} groups, month: {contributions['month']}")
    for k, v in core.items():
        print(f"Core {k}: last: {v['series'][-1] if v['series'] else 'none'}")


if __name__ == "__main__":
    main()
