#!/usr/bin/env python3
"""Compatibility entrypoint for the Observatory FedWatch V2 builder.

Historically Daily Observatory called this path directly. Keep that contract,
but delegate execution to the full conditional-meeting matrix builder. Core
settlement helpers are re-exported so existing imports continue to work.
"""
from __future__ import annotations

from fedwatch_core import *  # noqa: F401,F403


def main() -> None:
    from build_fed_watch_v2 import main as build_v2

    build_v2()


if __name__ == "__main__":
    main()
