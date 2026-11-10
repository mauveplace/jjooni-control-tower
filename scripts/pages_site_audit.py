#!/usr/bin/env python3
"""Verify static local references in a staged GitHub Pages site."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        key = {"script": "src", "img": "src", "source": "src",
               "video": "poster", "link": "href"}.get(tag)
        if key and a.get(key):
            if tag != "link" or {"stylesheet", "icon", "preload", "modulepreload"} & set(
                (a.get("rel") or "").split()
            ):
                self.refs.append(a[key])


CSS_URL = re.compile(r"url\(\s*[\"']?([^\"')]+)", re.I)
STATIC_JS = re.compile(r"(?:fetch|import)\s*\(\s*[\"'](\.{1,2}/[^\"']+)[\"']", re.I)


def local_ref(root, origin, raw):
    if not raw or raw.startswith(("#", "//")):
        return None
    part = urlsplit(raw.strip())
    if part.scheme or part.netloc:
        return None
    path = unquote(part.path).strip()
    if not path:
        return None
    # Absolute API routes are not static Pages files; JS dynamic APIs are
    # governed by their own source/freshness contracts.
    if path.startswith("/api/"):
        return None
    target = (root / path.lstrip("/")) if path.startswith("/") else (origin.parent / path)
    target = target.resolve()
    if not target.is_relative_to(root.resolve()):
        return "path escapes site root: " + raw
    # Literal "./data/" can be the prefix for a dynamic asset URL.
    if path.endswith("/") and target.is_dir():
        return None
    if target.is_file() or (target.is_dir() and (target / "index.html").is_file()):
        return None
    return f"{origin.relative_to(root)} -> {raw}"


def audit(root):
    root = Path(root).resolve()
    errors = []
    checked = 0
    for page in root.rglob("*"):
        if not page.is_file() or page.suffix.lower() not in (".html", ".css", ".js"):
            continue
        content = page.read_text(encoding="utf-8", errors="replace")
        refs = []
        if page.suffix.lower() == ".html":
            parser = Assets()
            parser.feed(content)
            refs.extend(parser.refs)
        if page.suffix.lower() == ".css":
            refs.extend(CSS_URL.findall(content))
        # Only literal local imports/fetches are validated. Dynamic URLs
        # remain guarded at runtime by the Observatory freshness UI.
        if page.suffix.lower() in (".html", ".js"):
            refs.extend(STATIC_JS.findall(content))
        for ref in refs:
            checked += 1
            result = local_ref(root, page, ref)
            if result:
                errors.append(result)
    return checked, sorted(set(errors))


def main(argv):
    if len(argv) != 2:
        raise SystemExit("usage: pages_site_audit.py SITE_DIRECTORY")
    checked, missing = audit(Path(argv[1]))
    if missing:
        print("PAGES_STATIC_REF_AUDIT=FAIL")
        for item in missing[:80]:
            print("::error::" + item)
        raise SystemExit(1)
    print(f"PAGES_STATIC_REF_AUDIT=PASS checked={checked}")


if __name__ == "__main__":
    main(sys.argv)
