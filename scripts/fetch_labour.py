#!/usr/bin/env python3
"""Fetch Irish labour market data from the CSO API and regenerate data/labour.js.

Sources:
- MUM01: Seasonally adjusted monthly unemployment (rates, all ages/sexes)
- QLF02: ILO participation and unemployment rates, seasonally adjusted

Usage: python3 scripts/fetch_labour.py
"""
import csv
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cso_common import pct_change_levels, pp_change_levels, quarter_label

CSO = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset"
MUM01_CSV = f"{CSO}/MUM01/CSV/1.0/en"
QLF02_CSV = f"{CSO}/QLF02/CSV/1.0/en"
QLF03_CSV = f"{CSO}/QLF03/CSV/1.0/en"
QLF18_CSV = f"{CSO}/QLF18/CSV/1.0/en"
QLF24_CSV = f"{CSO}/QLF24/CSV/1.0/en"
QLF33_CSV = f"{CSO}/QLF33/CSV/1.0/en"
EHQ08_JSON = f"{CSO}/EHQ08/JSON-stat/2.0/en"
EHQ03_CSV = f"{CSO}/EHQ03/CSV/1.0/en"
EHQ57_JSON = f"{CSO}/EHQ57/JSON-stat/2.0/en"
EHQ59_JSON = f"{CSO}/EHQ59/JSON-stat/2.0/en"
ROOT = Path(__file__).resolve().parent.parent

# MUM01: MUM01C02 = seasonally adjusted unemployment RATE
MUM01_RATE = "MUM01C02"
# QLF02: QLF02S1 = participation rate (SA), QLF02S2 = unemployment rate (SA)
QLF02_PARTIC = "QLF02S1"
QLF02_UNEMP = "QLF02S2"
# QLF03: QLF03S1 = persons in employment by NACE sector, seasonally adjusted
QLF03_EMPLOYMENT = "QLF03S1"
# QLF33: average usual hours worked per week (not seasonally adjusted)
QLF33_HOURS = "QLF33C01"
# QLF18: ILO unemployment rate by age (statistic 6); QLF24: ILO unemployment rate by education (statistic 6)
QLF18_UNEMP_RATE_AGE = "QLF18C06"
QLF24_UNEMP_RATE_EDU = "QLF24C06"
# EHQ03: average hourly earnings, seasonally adjusted (statistic S3), all sectors, all employees
EHQ08_HOURLY_EARNINGS_SA = "EHQ08S3"
# EHQ03: average hourly earnings by NACE sector, all employees (statistic C03, not SA)
EHQ03_HOURLY_EARNINGS = "EHQ03C03"
# EHQ57: average earnings by employee type (occupation), all sectors (the per-occupation rows in
# EHQ53/EHQ03 are discontinued/empty in the API; EHQ57 is the current occupation earnings table)
EHQ57_OCCUPATION_GROUPS = [
    "Managers, professionals and associated professionals",
    "Clerical, sales and service employees",
    "Production, transport, craft and other manual workers",
]
# EHQ59: job vacancies - EHQ59C03 = vacancy rate (%)
EHQ59_VACANCY_RATE = "EHQ59C03"
EHQ59_SECTOR_AGGREGATES = {"ZZ210011", "ZZ210228", "ZZ210221", "ZZ210223"}  # keep real sectors only

AGE_MAP = {"15 - 74 years": "15-74", "15 - 24 years": "15-24", "25 - 74 years": "25-74"}
SEX_MAP = {"Both sexes": "both", "Male": "male", "Female": "female"}


def fetch_csv(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=240) as resp:
        return resp.read().decode("utf-8-sig")


def month_index(code):
    # TLIST(M1) code: '202609' -> (2026, 9)
    return int(code[:4]) * 12 + int(code[4:6]) - 1


def month_label(idx):
    return f"{idx // 12}-{(idx % 12 + 1):02d}"


def build_monthly(rows, rate_stat):
    """Return {age: {sex: [{month, value, yoy}]}} sorted by month."""
    series = {}  # (age, sex) -> {month_idx: value}
    for r in rows:
        if r["STATISTIC"] != rate_stat or not r["VALUE"]:
            continue
        age = AGE_MAP.get(r["Age Group"])
        sex = SEX_MAP.get(r["Sex"])
        if not age or not sex:
            continue
        m = month_index(r["TLIST(M1)"])
        series.setdefault((age, sex), {})[m] = float(r["VALUE"])
    out = {}
    for (age, sex), by_month in series.items():
        recs = []
        for m in sorted(by_month):
            yoy = mom = None
            if m - 12 in by_month:
                yoy = round(by_month[m] - by_month[m - 12], 2)
            if m - 1 in by_month:
                mom = round(by_month[m] - by_month[m - 1], 2)
            recs.append({"month": month_label(m), "value": by_month[m], "mom": mom, "yoy": yoy})
        out.setdefault(age, {})[sex] = recs
    return out


def build_quarterly(rows, statistic):
    """Return {sex: [{quarter, value, qoq, yoy}]} for a QLF02 statistic."""
    series = {}
    for r in rows:
        if r["STATISTIC"] != statistic or not r["VALUE"]:
            continue
        sex = SEX_MAP.get(r["Sex"])
        if not sex:
            continue
        m = re.match(r"(\d{4})Q(\d)", r["Quarter"])
        if not m:
            continue
        t = int(m.group(1)) * 4 + int(m.group(2)) - 1
        series.setdefault(sex, {})[t] = float(r["VALUE"])
    out = {}
    for sex, by_q in series.items():
        recs = []
        for t in sorted(by_q):
            qoq = yoy = None
            if t - 1 in by_q:
                qoq = round(by_q[t] - by_q[t - 1], 2)
            if t - 4 in by_q:
                yoy = round(by_q[t] - by_q[t - 4], 2)
            recs.append({"quarter": f"{t // 4}Q{t % 4 + 1}", "value": by_q[t], "qoq": qoq, "yoy": yoy})
        out[sex] = recs
    return out


def build_employment_levels(rows, statistic):
    """Total employment (All NACE sectors) by sex, seasonally adjusted."""
    out = {}
    for r in rows:
        if r["STATISTIC"] != statistic or not r["VALUE"]:
            continue
        if r["NACE Rev 2 Economic Sector"] != "All NACE economic sectors":
            continue
        sex = SEX_MAP.get(r["Sex"])
        m = re.match(r"(\d{4})Q(\d)", r["Quarter"])
        if not sex or not m:
            continue
        t = int(m.group(1)) * 4 + int(m.group(2)) - 1
        out.setdefault(sex, {})[t] = float(r["VALUE"])
    series = {}
    for sex, q in out.items():
        recs = []
        for t in sorted(q):
            recs.append({"quarter": f"{t // 4}Q{t % 4 + 1}", "value": q[t]})
        series[sex] = recs
    return series


AGE_UNEMPLOYMENT_GROUPS = ["15 - 24 years", "25 - 34 years", "35 - 44 years", "45 - 54 years", "55 - 59 years", "60 - 64 years", "65 years and over"]
EDU_UNEMPLOYMENT_GROUPS = ["Primary or below", "Lower secondary", "Higher secondary", "Post-secondary non-tertiary", "Third level non-honours degree", "Third level honours degree or higher"]


def build_breakdown_rates(rows, statistic, group_labels, group_col, keep, years=5):
    """Range plot data: latest unemployment rate + 5-year range of rates, per group."""
    series = {}
    for r in rows:
        if r["STATISTIC"] != statistic or not r["VALUE"]:
            continue
        if r["Sex"] != "Both sexes":
            continue
        g = r[group_col]
        if g not in keep:
            continue
        m = re.match(r"(\d{4})Q(\d)", r["Quarter"])
        if not m:
            continue
        t = int(m.group(1)) * 4 + int(m.group(2)) - 1
        series.setdefault(g, {})[t] = float(r["VALUE"])
    if not series:
        return None
    latest_t = max(max(q.keys()) for q in series.values() if q)
    cutoff = latest_t - years * 4
    out = []
    for g, q in series.items():
        if latest_t not in q:
            continue
        window = [v for t, v in q.items() if t > cutoff and t <= latest_t]
        out.append(
            {
                "group": g,
                "rate": round(q[latest_t], 1),
                "min5": round(min(window), 1) if window else None,
                "max5": round(max(window), 1) if window else None,
            }
        )
    order = {g: i for i, g in enumerate(group_labels)}
    out.sort(key=lambda x: order.get(x["group"], 99))
    return {"quarter": f"{latest_t // 4}Q{latest_t % 4 + 1}", "groups": out}


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.loads(r.read())


def build_earnings():
    """SA average hourly earnings, All sectors (EHQ08S3, via JSON-stat).
    The SA statistics in EHQ03 are empty in the API; SA earnings live in EHQ08."""
    return series_to_records(build_ehq08_series(EHQ08_HOURLY_EARNINGS_SA))


def build_labour_costs():
    """SA average hourly other labour costs, All sectors (EHQ08S7)."""
    return series_to_records(build_ehq08_series("EHQ08S7"))


def build_vacancies():
    """Job vacancy rate (EHQ59C03): All-sectors level series + per-sector latest QoQ (pp) and YoY (pp)."""
    j = fetch_json(EHQ59_JSON)
    values = j["value"]
    nQ, nP, nS = j["size"][1], j["size"][2], j["size"][3]
    stats = list(j["dimension"]["STATISTIC"]["category"]["index"])
    secs = list(j["dimension"]["C04498V05282"]["category"]["index"])
    sec_codes = list(j["dimension"]["C04498V05282"]["category"]["index"])
    qcodes = list(j["dimension"]["TLIST(Q1)"]["category"]["index"])
    qlabels = j["dimension"]["TLIST(Q1)"]["category"]["label"]
    sl = j["dimension"]["C04498V05282"]["category"]["label"]
    privs = list(j["dimension"]["C02511V03040"]["category"]["index"])
    pl = j["dimension"]["C02511V03040"]["category"]["label"]
    si = stats.index(EHQ59_VACANCY_RATE)
    all_sec_code = [k for k, v in sl.items() if "All NACE" in v][0]
    all_i = secs.index(all_sec_code)
    priv_code = [k for k, v in pl.items() if v == "All sectors"][0]
    allp = privs.index(priv_code)

    def level_series(sec_i):
        series = {}
        for qi, qc in enumerate(qcodes):
            idx = si * (nQ * nP * nS) + qi * (nP * nS) + allp * nS + sec_i
            v = values[idx] if idx < len(values) else None
            if v is not None:
                m = re.match(r"(\d{4})Q(\d)", qlabels[qc])
                if m:
                    series[int(m.group(1)) * 4 + int(m.group(2)) - 1] = float(v)
        return series

    all_series = level_series(all_i)

    overall = pp_change_levels(all_series)
    sectors = []
    for sec_i, sec_code in enumerate(sec_codes):
        if sec_code in EHQ59_SECTOR_AGGREGATES or sec_code == all_sec_code:
            continue
        series = level_series(sec_i)
        if not series:
            continue
        latest_t = max(series)
        rec = {"sector": sl[sec_code]}
        rec["qoq"] = round(series[latest_t] - series[latest_t - 1], 2) if latest_t - 1 in series else None
        rec["yoy"] = round(series[latest_t] - series[latest_t - 4], 2) if latest_t - 4 in series else None
        sectors.append(rec)
    sectors.sort(key=lambda x: (x["yoy"] if x["yoy"] is not None else -99), reverse=True)
    latest_t = max(all_series)
    return {"quarter": f"{latest_t // 4}Q{latest_t % 4 + 1}", "overall": overall, "sectors": sectors}


def build_sector_earnings(rows, statistic, years=5):
    """Per NACE sector: latest YoY % change in average hourly earnings + 5-year range
    of YoY changes. EHQ03 C03, all employees, not seasonally adjusted."""
    series = {}
    for r in rows:
        if r["STATISTIC"] != statistic or not r["VALUE"]:
            continue
        if r["Type of Employee"] != "All employees":
            continue
        sector = r["Economic Sector NACE Rev 2"]
        if sector in (
            "All NACE economic sectors",
            "Not stated",
            "Industry and Construction (B to F)",
            "Services (G to U)",
            "Industry (B to E)",
            "Electricity, water supply and waste management (D,E)",
            "Financial, insurance and real estate activities (K,L)",
            "Arts, entertainment, recreation and other service activities (R,S)",
            "Real estate activities (L)",
        ):
            continue
        m = re.match(r"(\d{4})Q(\d)", r["Quarter"])
        if not m:
            continue
        t = int(m.group(1)) * 4 + int(m.group(2)) - 1
        series.setdefault(sector, {})[t] = float(r["VALUE"])
    if not series:
        return None
    latest_t = max(max(q.keys()) for q in series.values() if q)
    cutoff = latest_t - years * 4
    out = []
    for sector, q in series.items():
        if latest_t not in q or latest_t - 4 not in q:
            continue
        latest_change = round((q[latest_t] / q[latest_t - 4] - 1) * 100, 2)
        changes = [
            (q[t] / q[t - 4] - 1) * 100
            for t in sorted(q)
            if t > cutoff and t - 4 in q and t <= latest_t
        ]
        out.append(
            {
                "sector": sector,
                "change": latest_change,
                "min5": round(min(changes), 2) if changes else None,
                "max5": round(max(changes), 2) if changes else None,
            }
        )
    out.sort(key=lambda x: x["change"], reverse=True)
    return {"quarter": f"{latest_t // 4}Q{latest_t % 4 + 1}", "sectors": out}


def build_ehq08_series(statistic):
    """Extract an All-sectors SA series from EHQ08 (JSON-stat)."""
    j = fetch_json(EHQ08_JSON)
    values = j["value"]
    nQ, nP = j["size"][1], j["size"][2]
    stats = list(j["dimension"]["STATISTIC"]["category"]["index"])
    sectors = list(j["dimension"]["C02511V03040"]["category"]["index"])
    qcodes = list(j["dimension"]["TLIST(Q1)"]["category"]["index"])
    qlabels = j["dimension"]["TLIST(Q1)"]["category"]["label"]
    sector_label = j["dimension"]["C02511V03040"]["category"]["label"]
    si = stats.index(statistic)
    all_code = [k for k, v in sector_label.items() if v == "All sectors"][0]
    all_i = sectors.index(all_code)
    series = {}
    for qi, qc in enumerate(qcodes):
        idx = si * (nQ * nP) + qi * nP + all_i
        v = values[idx] if idx < len(values) else None
        if v is not None:
            m = re.match(r"(\d{4})Q(\d)", qlabels[qc])
            if m:
                series[int(m.group(1)) * 4 + int(m.group(2)) - 1] = float(v)
    return series


def series_to_records(series):
    return pct_change_levels(series)


def build_occupation_earnings(years=5):
    """Average weekly earnings by employee type (EHQ57, all sectors, not SA):
    latest YoY change + 5-year range of YoY changes."""
    j = fetch_json(EHQ57_JSON)
    values = j["value"]
    nQ, nE, nS = j["size"][1], j["size"][2], j["size"][3]
    emps = list(j["dimension"]["C02397V02888"]["category"]["index"])
    secs = list(j["dimension"]["C04498V05282"]["category"]["index"])
    qcodes = list(j["dimension"]["TLIST(Q1)"]["category"]["index"])
    qlabels = j["dimension"]["TLIST(Q1)"]["category"]["label"]
    el = j["dimension"]["C02397V02888"]["category"]["label"]
    sl = j["dimension"]["C04498V05282"]["category"]["label"]
    all_sec = [k for k, v in sl.items() if "All NACE" in v][0]
    all_i = secs.index(all_sec)
    out = []
    for group in EHQ57_OCCUPATION_GROUPS:
        code = [k for k, v in el.items() if v == group][0]
        e_i = emps.index(code)
        series = {}
        for qi, qc in enumerate(qcodes):
            idx = qi * (nE * nS) + e_i * nS + all_i
            v = values[idx] if idx < len(values) else None
            if v is not None:
                m = re.match(r"(\d{4})Q(\d)", qlabels[qc])
                if m:
                    series[int(m.group(1)) * 4 + int(m.group(2)) - 1] = float(v)
        if not series:
            continue
        latest_t = max(series)
        if latest_t - 4 not in series:
            continue
        cutoff = latest_t - years * 4
        latest_change = round((series[latest_t] / series[latest_t - 4] - 1) * 100, 2)
        changes = [
            (series[t] / series[t - 4] - 1) * 100
            for t in sorted(series)
            if t > cutoff and t - 4 in series and t <= latest_t
        ]
        out.append(
            {
                "group": group,
                "change": latest_change,
                "min5": round(min(changes), 2) if changes else None,
                "max5": round(max(changes), 2) if changes else None,
            }
        )
    order = {g: i for i, g in enumerate(EHQ57_OCCUPATION_GROUPS)}
    out.sort(key=lambda x: order.get(x["group"], 99))
    if not out:
        return None
    return {"quarter": f"{latest_t // 4}Q{latest_t % 4 + 1}", "groups": out}


def build_hours(rows, statistic):
    """Average usual hours worked per week by sex (QLF33)."""
    out = {}
    for r in rows:
        if r["STATISTIC"] != statistic or not r["VALUE"]:
            continue
        sex = SEX_MAP.get(r["Sex"])
        m = re.match(r"(\d{4})Q(\d)", r["Quarter"])
        if not sex or not m:
            continue
        t = int(m.group(1)) * 4 + int(m.group(2)) - 1
        out.setdefault(sex, {})[t] = float(r["VALUE"])
    series = {}
    for sex, q in out.items():
        recs = []
        for t in sorted(q):
            recs.append({"quarter": f"{t // 4}Q{t % 4 + 1}", "value": q[t]})
        series[sex] = recs
    return series


def build_sector_change(rows, statistic, years=5):
    """Per-sector: latest quarterly change (dot) and range of quarterly changes over
    the past `years` years (bar), both sexes, seasonally adjusted."""
    series = {}
    for r in rows:
        if r["STATISTIC"] != statistic or not r["VALUE"]:
            continue
        if r["Sex"] != "Both sexes":
            continue
        sector = r["NACE Rev 2 Economic Sector"]
        if sector in ("All NACE economic sectors", "Not stated", "Industry and Construction (B to F)", "Services (G to U)"):
            continue
        m = re.match(r"(\d{4})Q(\d)", r["Quarter"])
        if not m:
            continue
        t = int(m.group(1)) * 4 + int(m.group(2)) - 1
        series.setdefault(sector, {})[t] = float(r["VALUE"])
    if not series:
        return None
    latest_t = max(max(q.keys()) for q in series.values() if q)
    cutoff = latest_t - years * 4  # changes from quarters up to cutoff need level at cutoff
    out = []
    for sector, q in series.items():
        if latest_t not in q or latest_t - 1 not in q:
            continue
        latest_change = round(q[latest_t] - q[latest_t - 1], 1)
        changes = [q[t] - q[t - 1] for t in sorted(q) if t > cutoff and t - 1 in q and t <= latest_t]
        out.append(
            {
                "sector": sector,
                "prev": q[latest_t - 1],
                "latest": q[latest_t],
                "change": latest_change,
                "min5": round(min(changes), 1) if changes else None,
                "max5": round(max(changes), 1) if changes else None,
            }
        )
    out.sort(key=lambda x: x["change"], reverse=True)
    return {"quarter": f"{latest_t // 4}Q{latest_t % 4 + 1}", "sectors": out}


def write_js(name, payload, path):
    with path.open("w") as f:
        f.write("// Generated by scripts/fetch_labour.py - CSO MUM01, QLF02\n")
        f.write(f"const {name} = ")
        json.dump(payload, f, separators=(",", ":"))
        f.write(";\n")


def main():
    mum = list(csv.DictReader(io.StringIO(fetch_csv(MUM01_CSV))))
    qlf = list(csv.DictReader(io.StringIO(fetch_csv(QLF02_CSV))))
    qlf3 = list(csv.DictReader(io.StringIO(fetch_csv(QLF03_CSV))))
    qlf18 = list(csv.DictReader(io.StringIO(fetch_csv(QLF18_CSV))))
    qlf24 = list(csv.DictReader(io.StringIO(fetch_csv(QLF24_CSV))))
    qlf33 = list(csv.DictReader(io.StringIO(fetch_csv(QLF33_CSV))))
    ehq3 = list(csv.DictReader(io.StringIO(fetch_csv(EHQ03_CSV))))

    monthly = build_monthly(mum, MUM01_RATE)
    participation = build_quarterly(qlf, QLF02_PARTIC)
    unemployment = build_quarterly(qlf, QLF02_UNEMP)

    for label, d in [("monthly unemployment", monthly), ("participation", participation), ("ILO unemployment", unemployment)]:
        if not d:
            raise SystemExit(f"No {label} data fetched")
    sector_change = build_sector_change(qlf3, QLF03_EMPLOYMENT)
    if not sector_change:
        raise SystemExit("No sector employment data fetched")
    employment_levels = build_employment_levels(qlf3, QLF03_EMPLOYMENT)
    if not employment_levels:
        raise SystemExit("No employment levels data fetched")
    hours = build_hours(qlf33, QLF33_HOURS)
    if not hours:
        raise SystemExit("No hours data fetched")
    earnings = build_earnings()
    if not earnings:
        raise SystemExit("No earnings data fetched")
    sector_earnings = build_sector_earnings(ehq3, EHQ03_HOURLY_EARNINGS)
    if not sector_earnings:
        raise SystemExit("No sector earnings data fetched")
    occupation_earnings = build_occupation_earnings()
    if not occupation_earnings:
        raise SystemExit("No occupation earnings data fetched")
    labour_costs = build_labour_costs()
    if not labour_costs:
        raise SystemExit("No labour costs data fetched")
    vacancies = build_vacancies()
    if not vacancies or not vacancies["overall"]:
        raise SystemExit("No vacancies data fetched")

    # unemployment rate ranges: sex from QLF02 (SA); age from QLF18C06; education from QLF24C06
    sex_rows = [r for r in qlf if r["STATISTIC"] == QLF02_UNEMP and r["Sex"] in ("Male", "Female") and r["VALUE"]]
    sex_breakdown = build_breakdown_rates(
        [{**r, "Sex": "Both sexes", "Group": r["Sex"]} | {"SexKey": r["Sex"]} for r in sex_rows],
        QLF02_UNEMP,
        ["Male", "Female"],
        "SexKey",
        {"Male", "Female"},
    )
    age_breakdown = build_breakdown_rates(qlf18, QLF18_UNEMP_RATE_AGE, AGE_UNEMPLOYMENT_GROUPS, "Age Group", set(AGE_UNEMPLOYMENT_GROUPS))
    edu_breakdown = build_breakdown_rates(qlf24, QLF24_UNEMP_RATE_EDU, EDU_UNEMPLOYMENT_GROUPS, "Level of Education", set(EDU_UNEMPLOYMENT_GROUPS))
    for label, d in [("sex breakdown", sex_breakdown), ("age breakdown", age_breakdown), ("education breakdown", edu_breakdown)]:
        if not d:
            raise SystemExit(f"No {label} data fetched")

    out = ROOT / "data"
    out.mkdir(parents=True, exist_ok=True)
    payload = {
        "monthly_unemployment": monthly,
        "participation": participation,
        "ilo_unemployment": unemployment,
        "sector_change": sector_change,
        "employment_levels": employment_levels,
        "hours": hours,
        "earnings": earnings,
        "sector_earnings": sector_earnings,
        "occupation_earnings": occupation_earnings,
        "labour_costs": labour_costs,
        "vacancies": vacancies,
        "demographics": {
            "sex": sex_breakdown,
            "age": age_breakdown,
            "education": edu_breakdown,
        },
    }
    write_js("LABOUR_DATA", payload, out / "labour.js")
    (out / "labour.json").write_text(json.dumps(payload, indent=1))

    mu = monthly["15-74"]["both"]
    print(f"Monthly unemployment (15-74, both): {len(mu)} months, last: {mu[-1]}")
    y = monthly["15-24"]["both"]
    print(f"Youth unemployment (15-24, both): last: {y[-1]}")
    p = participation["both"]
    print(f"Participation (both): {len(p)} quarters, last: {p[-1]}")
    u = unemployment["both"]
    print(f"ILO unemployment (both): last: {u[-1]}")
    sc = sector_change
    print(f"Sector change ({sc['quarter']}): {len(sc['sectors'])} sectors, top: {sc['sectors'][0]['sector']} {sc['sectors'][0]['change']:+.1f}k, bottom: {sc['sectors'][-1]['sector']} {sc['sectors'][-1]['change']:+.1f}k")
    el = employment_levels["both"]
    print(f"Employment levels (both): {len(el)} quarters, last: {el[-1]}")
    h = hours["both"]
    print(f"Hours (both): {len(h)} quarters, last: {h[-1]}")
    print(f"Earnings: {len(earnings)} quarters, last: {earnings[-1]}")
    lc = labour_costs
    print(f"Labour costs: {len(lc)} quarters, last: {lc[-1]}")
    va = vacancies
    print(f"Vacancies: overall last: {va['overall'][-1]}, sectors: {len(va['sectors'])}")
    oe = occupation_earnings
    print(f"Occupation earnings ({oe['quarter']}): {len(oe['groups'])} groups, latest: " + ", ".join(f"{g['group'].split(',')[0]} {g['change']:+.1f}%" for g in oe["groups"]))
    se = sector_earnings
    print(f"Sector earnings ({se['quarter']}): {len(se['sectors'])} sectors, top: {se['sectors'][0]['sector'][:40]} {se['sectors'][0]['change']:+.1f}%, bottom: {se['sectors'][-1]['sector'][:40]} {se['sectors'][-1]['change']:+.1f}%")
    print(f"Sex rates: male {sex_breakdown['groups'][0]['rate']}%, female {sex_breakdown['groups'][1]['rate']}%")
    print(f"Age rates: {len(age_breakdown['groups'])} groups, first: {age_breakdown['groups'][0]['group']} {age_breakdown['groups'][0]['rate']}%")
    print(f"Education rates: {len(edu_breakdown['groups'])} groups")


if __name__ == "__main__":
    main()
