"""Keep scheduled data refreshes from downgrading the published UI cache key."""
import re
from urllib.parse import parse_qs, urlsplit


def _runtime_matches(html, filename):
    if not re.fullmatch(r'[a-zA-Z0-9_.-]+\.js', filename):
        raise ValueError('Expected a local JavaScript filename')
    return list(re.finditer(r'<script\b[^>]*\bsrc=["\'](\./' + re.escape(filename) + r'(?:\?[^"\']*)?)["\'][^>]*>\s*</script>', html))


def require_runtime(html, filename):
    matches = _runtime_matches(html, filename)
    if len(matches) != 1 or not parse_qs(urlsplit(matches[0].group(1)).query).get('v', [''])[0]:
        raise ValueError(f'Expected one versioned local runtime: {filename}')


def ensure_runtime(html, filename, default_version):
    matches = _runtime_matches(html, filename)
    if len(matches) > 1:
        raise ValueError(f'Duplicate UI runtime: {filename}')
    if matches:
        match = matches[0]
        url = match.group(1)
        if parse_qs(urlsplit(url).query).get('v', [''])[0]:
            return html  # The checked-in release owns its cache key.
        new = url + ('&' if '?' in url else '?') + 'v=' + default_version
        return html[:match.start(1)] + new + html[match.end(1):]
    if '</body>' not in html:
        raise ValueError('Missing Observatory body')
    tag = f'<script src="./{filename}?v={default_version}"></script>'
    return html.replace('</body>', tag + '</body>', 1)
