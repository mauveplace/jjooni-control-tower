#!/usr/bin/env python3
"""Prune stale content-addressed calendar revisions from the *staged* Pages tree.

Never modify the repository, only a disposable staging directory. The latest
calendar-history-index.json is the runtime authority for published series.
"""
from pathlib import Path
import json
import sys


def prune(site):
    site = Path(site).resolve()
    data = site / "market-observatory" / "data"
    index_file = data / "calendar-history-index.json"
    try:
        index = json.loads(index_file.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise RuntimeError("calendar series index unavailable; refusing prune") from exc
    if index.get("schema") != "JJOONI_CALENDAR_HISTORY_INDEX_V1":
        raise RuntimeError("calendar index schema mismatch; refusing prune")
    series = index.get("series")
    if not isinstance(series, dict) or not series:
        raise RuntimeError("missing calendar series map; refusing prune")
    series_root = (data / "calendar-history" / "series").resolve()
    keep = set()
    for entry in series.values():
        if not isinstance(entry, dict):
            raise RuntimeError("malformed calendar series entry")
        raw = entry.get("path")
        if not isinstance(raw, str) or not raw.startswith("./calendar-history/series/"):
            raise RuntimeError("invalid calendar series path: " + str(raw))
        ref = (data / raw).resolve()
        if ref.parent != series_root or ref.suffix != ".json" or not ref.is_file():
            raise RuntimeError("referenced calendar series file missing: " + raw)
        keep.add(ref)
    paths = list(series_root.glob("*.json"))
    missing = keep - set(paths)
    if missing:
        raise RuntimeError("calendar index contains missing published paths")
    unused = [p for p in paths if p.resolve() not in keep]
    saved = sum(p.stat().st_size for p in unused)
    for path in unused:
        path.unlink()
    return len(series), len(keep), len(unused), saved


def main(argv):
    if len(argv) != 2:
        raise SystemExit("usage: pages_calendar_prune.py SITE_DIRECTORY")
    indexed, kept, deleted, saved = prune(argv[1])
    print(
        "PAGES_CALENDAR_HISTORY_PRUNE=PASS "
        f"indexed={indexed} referenced_files={kept} "
        f"unreferenced_removed={deleted} saved_bytes={saved}"
    )


if __name__ == "__main__":
    main(sys.argv)
