#!/usr/bin/env python3
"""Fetch the NTMA 'Composition of Debt' breakdown (Gross National Debt by
instrument) and regenerate data/ntma.js / data/ntma.json.

Source: NTMA Funding & Debt Management statistics page
(https://www.ntma.ie/business-areas/funding-and-debt-management/statistics),
whose 'Download in excel' link points at a Composition-of-Debt .xlsx on
assets.ntma.ie. The xlsx is parsed with the standard library only (zipfile +
XML), so no openpyxl dependency is needed locally or in CI.

The sheet's top-level instrument categories are matched by name (sub-component
rows are skipped); the script asserts that the categories sum to the published
'Gross National Debt' total (within rounding) before writing anything.

Usage: python3 scripts/fetch_ntma.py
"""
import io
import json
import re
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
NTMA_STATS_PAGE = "https://www.ntma.ie/business-areas/funding-and-debt-management/statistics"
UA = {"User-Agent": "Mozilla/5.0"}

# top-level instrument categories of the Composition of Debt table
# (matched by prefix; sub-component rows like 'Fixed Rate Treasury Bonds' are skipped)
CATEGORIES = [
    "Government Bonds",
    "EU Loans",
    "Ireland State Savings",
    "Short Term Paper",
    "Other Medium/Long Term Debt",
    "Borrowing from Ministerial Funds",
]
TOTAL_LABEL = "Gross National Debt"

M_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def http_get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    return data if binary else data.decode("utf-8-sig")


def find_xlsx_url(page_html):
    m = re.search(r'href="(https://assets\.ntma\.ie/[^"]+\.xlsx[^"]*)"', page_html, re.I)
    if not m:
        raise RuntimeError("no Composition-of-Debt xlsx link found on NTMA statistics page")
    return m.group(1)


def parse_sheet(xlsx_bytes):
    """Return {row_number: {col_letter: value}} for the first worksheet."""
    z = zipfile.ZipFile(io.BytesIO(xlsx_bytes))
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall(f"{M_NS}si"):
            shared.append("".join(t.text or "" for t in si.iter(f"{M_NS}t")))
    sheet = sorted(n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n))[0]
    root = ET.fromstring(z.read(sheet))
    rows = {}
    for row in root.iter(f"{M_NS}row"):
        rnum = int(row.get("r"))
        cells = {}
        for c in row.iter(f"{M_NS}c"):
            ref = c.get("r")
            col = re.match(r"([A-Z]+)", ref).group(1)
            t = c.get("t")
            v = c.find(f"{M_NS}v")
            isel = c.find(f"{M_NS}is")
            val = None
            if v is not None:
                val = v.text
                if t == "s":
                    val = shared[int(val)]
            elif isel is not None:
                val = "".join(x.text or "" for x in isel.iter(f"{M_NS}t"))
            cells[col] = val
        rows[rnum] = cells
    return rows


def main():
    page = http_get(NTMA_STATS_PAGE)
    xlsx_url = find_xlsx_url(page)
    print(f"xlsx: {xlsx_url}")
    rows = parse_sheet(http_get(xlsx_url, binary=True))

    # as-of date from the sheet title, e.g. 'Composition of Debt at End-October 2026'
    title = rows.get(1, {}).get("A", "")
    m = re.search(r"End-([A-Za-z]+)\s+(\d{4})", title)
    if not m:
        raise RuntimeError(f"cannot parse as-of date from title: {title!r}")
    months = ["January","February","March","April","May","June","July","August",
              "September","October","November","December"]
    as_of = f"{m.group(2)}-{months.index(m.group(1)) + 1:02d}"

    # collect label -> EUR bn (column D) for all populated rows
    values = {}
    for rnum, cells in sorted(rows.items()):
        label = (cells.get("A") or "").strip()
        raw = cells.get("D")
        if label and raw not in (None, ""):
            try:
                values[label] = float(raw)
            except ValueError:
                pass

    instruments = []
    for cat in CATEGORIES:
        match = next((lbl for lbl in values if lbl.startswith(cat)), None)
        if match is None:
            raise RuntimeError(f"category {cat!r} not found in NTMA sheet")
        instruments.append({"label": match.rstrip("* ").strip(), "value_bn": round(values[match], 2)})

    total = next((v for lbl, v in values.items() if lbl.startswith(TOTAL_LABEL)), None)
    if total is None:
        raise RuntimeError("Gross National Debt total row not found")
    s = sum(i["value_bn"] for i in instruments)
    if abs(s - total) > 0.5:  # 'rounding may affect totals' per the sheet's own note
        raise RuntimeError(f"instrument sum {s:.2f} != published total {total:.2f} (EUR bn)")

    data = {"as_of": as_of, "source_url": NTMA_STATS_PAGE, "total_bn": round(total, 2), "instruments": instruments}
    js = "const NTMA_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n"
    (ROOT / "data" / "ntma.js").write_text(js)
    (ROOT / "data" / "ntma.json").write_text(json.dumps(data, indent=1))
    print(f"as_of={as_of} total=EUR{total:.2f}bn instruments={len(instruments)}")
    for i in instruments:
        print(f"  {i['label']}: {i['value_bn']}")


if __name__ == "__main__":
    main()
