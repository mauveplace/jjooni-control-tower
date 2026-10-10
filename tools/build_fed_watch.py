#!/usr/bin/env python3
"""Compatibility entrypoint for the Observatory FedWatch V2 builder.

Historically Daily Observatory called this path directly. Keep that contract,
but delegate execution to the full conditional-meeting matrix builder. Core
settlement helpers are re-exported so existing imports continue to work.
"""
from __future__ import annotations

import fedwatch_core as _core

# `from module import *` intentionally omits underscore-prefixed helpers, while
# the V2 builder consumes the legacy private helper surface. Re-export the full
# non-dunder module contract explicitly for compatibility.
for _name in dir(_core):
    if not _name.startswith("__"):
        globals()[_name] = getattr(_core, _name)


def main() -> None:
    from build_fed_watch_v2 import main as build_v2

    # The general market pipeline consumes the last published daily observation.
    from pathlib import Path
    existing = Path(__file__).resolve().parents[1] / "market-observatory/data/fed-watch.json"
    if existing.exists():
        print("FEDWATCH=REUSE_DAILY_SNAPSHOT")
        return
    build_v2()


if __name__ == "__main__":
    main()
