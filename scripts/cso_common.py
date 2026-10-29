"""Shared helpers for CSO PxStat fetch scripts."""

import re


def quarter_index(code):
    """'2026Q2' or '20262' -> index (year*4 + q - 1)."""
    m = re.match(r"(\d{4})Q(\d)", code)
    if not m:
        raise ValueError(f"bad quarter code: {code}")
    return int(m.group(1)) * 4 + int(m.group(2)) - 1


def quarter_label(t):
    return f"{t // 4}Q{t % 4 + 1}"


def pct_change_levels(series):
    """{t: level} -> [{quarter, value, qoq%, yoy%}] using level ratios."""
    out = []
    for t in sorted(series):
        qoq = round((series[t] / series[t - 1] - 1) * 100, 2) if t - 1 in series else None
        yoy = round((series[t] / series[t - 4] - 1) * 100, 2) if t - 4 in series else None
        out.append({"quarter": quarter_label(t), "value": series[t], "qoq": qoq, "yoy": yoy})
    return out


def pp_change_levels(series):
    """{t: rate} -> [{quarter, value, qoq pp, yoy pp}] using differences."""
    out = []
    for t in sorted(series):
        qoq = round(series[t] - series[t - 1], 2) if t - 1 in series else None
        yoy = round(series[t] - series[t - 4], 2) if t - 4 in series else None
        out.append({"quarter": quarter_label(t), "value": series[t], "qoq": qoq, "yoy": yoy})
    return out


def year_window(series, latest_t, years):
    """Changes computed over the past `years` years ending latest_t (inclusive)."""
    cutoff = latest_t - years * 4
    return [t for t in sorted(series) if t > cutoff and t <= latest_t]
