#!/usr/bin/env python3
"""Sanity-check generated data files before they are committed/published.

Run after the fetch scripts (locally or in CI):
    python3 scripts/validate_data.py

Checks:
- every data/*.json parses and is non-empty
- every data/*.js defines a payload (const X = ...) and is non-trivial in size
- for scripts that write both formats from the same payload (MIRRORED below),
  the .js payload must equal its sibling .json
Legacy files (gdp/gnp/mdd/components/forecasts) have .js/.json in different shapes
by history, so they are only checked for parseability, not equality.
Exits non-zero on any failure so CI stops before committing.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

MIN_JS_BYTES = 500

# stems whose fetch script writes .js and .json from the identical payload
MIRRORED = {"labour", "prices", "fiscal", "financial"}


def main():
    failures = []

    jsons = sorted(DATA.glob("*.json"))
    if not jsons:
        failures.append("no data/*.json files found")
    parsed = {}
    for p in jsons:
        try:
            obj = json.loads(p.read_text())
            if not obj:
                failures.append(f"{p.name}: empty JSON")
            parsed[p.stem] = obj
        except Exception as e:
            failures.append(f"{p.name}: invalid JSON ({e})")

    for p in sorted(DATA.glob("*.js")):
        text = p.read_text()
        if len(text) < MIN_JS_BYTES:
            failures.append(f"{p.name}: suspiciously small ({len(text)} bytes)")
        m = re.search(r"const\s+([A-Z_]+)\s*=\s*(\{.*\}|\[.*\])\s*;?\s*$", text, re.S)
        if not m:
            failures.append(f"{p.name}: no payload const found")
            continue
        if p.stem in MIRRORED and p.stem in parsed:
            try:
                js_payload = json.loads(m.group(2))
                if js_payload != parsed[p.stem]:
                    failures.append(f"{p.name}: .js payload differs from .json")
            except Exception as e:
                failures.append(f"{p.name}: payload not valid JSON ({e})")

    if failures:
        print("DATA VALIDATION FAILED:")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    print(f"data OK: {len(jsons)} json, {len(list(DATA.glob('*.js')))} js files validated")


if __name__ == "__main__":
    main()
