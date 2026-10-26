#!/usr/bin/env python3
"""Inventory active data writers and browser mutation sites without account data.

This is a static source inventory, not proof that a Cloud Run revision is live.
It deliberately reports file/line references rather than treating every timer or
workflow dependency as a demonstrated collision.
"""
import argparse
import json
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]


def runtime_asset_graph(root=ROOT):
    """Potential local executable graph, not evidence of runtime execution order."""
    graph, pending = {}, ['index.html']
    while pending:
        name=pending.pop()
        if name in graph:
            continue
        file=root/name
        if not file.is_file():
            continue
        children=sorted({m for m in re.findall(r'([A-Za-z0-9_-]+[.]js)[?]',file.read_text()) if (root/m).is_file()})
        graph[name]=children
        pending.extend(child for child in children if child not in graph)
    return graph


def inventory(root=ROOT):
    workflows = []
    for path in sorted((root / '.github/workflows').glob('*.yml')):
        text = path.read_text()
        doc = yaml.safe_load(text)
        triggers = doc.get('on', doc.get(True, {})) or {}
        rows = []
        for line, content in enumerate(text.splitlines(), 1):
            if 'publish_observatory_data.py' in content or re.search(r'\bgit push\b', content):
                rows.append({'line': line, 'entry': content.strip()})
        workflows.append({'path': str(path.relative_to(root)), 'name': doc.get('name'),
                          'triggers': list(triggers), 'schedules': triggers.get('schedule', []),
                          'upstreams': (triggers.get('workflow_run') or {}).get('workflows', []),
                          'publish_sites': rows})
    modules = []
    for path in sorted([*root.glob('*.js'), *(root / 'market-observatory').glob('*.js')]):
        text = path.read_text()
        sites = []
        for line, content in enumerate(text.splitlines(), 1):
            kinds = [name for name in ('setInterval', 'MutationObserver') if name in content
                     and not content.lstrip().startswith('//')]
            if kinds:
                sites.append({'line': line, 'kinds': kinds})
        modules.append({'path': str(path.relative_to(root)), 'bytes': path.stat().st_size,
                        'recurring_or_observer_sites': sites})
    loader = (root / 'trade-review-loader.js').read_text()
    module_list = loader.split('const modules=[', 1)[1].split('];preloadModules', 1)[0]
    required = re.findall(r"\['([^']+)','([^']+)','([^']+)'\]", module_list)
    violations = []
    ids = [x[0] for x in required]
    if len(ids) != len(set(ids)):
        violations.append('DUPLICATE_REQUIRED_MODULE_ID')
    for ident, url, label in required:
        if not (root / url.split('?')[0]).is_file():
            violations.append('MISSING_REQUIRED_MODULE:' + label)
    for file in ('boot-coordinator-v33.js', 'fast-refresh-v32.js'):
        if re.search(r"dispatchEvent\(new Event\(['\"]visibilitychange", (root / file).read_text()):
            violations.append('SYNTHETIC_LIFECYCLE_REFRESH:' + file)
    bootstrap = re.findall(r"['\"]([a-zA-Z0-9_-]+\.js)\?v=", (root / 'ui-bootstrap-v1.js').read_text())
    deferred = re.search(r"DEFERRED_LABELS=new Set\(\[([^]]+)\]", loader)
    deferred_labels = re.findall(r"'([^']+)'", deferred.group(1)) if deferred else []
    runtime_graph=runtime_asset_graph(root)
    archived = list((root / 'ops/archive/workflows').glob('*.yml'))
    return {'schema': 'CT_ARCHITECTURE_INVENTORY_V1', 'scope': 'STATIC_SOURCE_ONLY_NO_ACCOUNT_VALUES',
            'counts': {'active_workflows': len(workflows), 'archived_one_shots': len(archived),
                       'scheduled_workflows': sum(bool(w['schedules']) for w in workflows),
                       'browser_js_files': len(modules), 'required_boot_modules': len(required), 'declared_ui_modules':len(required),
                       'critical_ui_modules':sum(row[2] not in deferred_labels for row in required), 'bootstrap_modules':len(bootstrap), 'potential_runtime_js_assets':sum(name.endswith('.js') for name in runtime_graph),
                       'recurring_or_observer_sites': sum(len(m['recurring_or_observer_sites']) for m in modules)},
            'potential_runtime_graph':runtime_graph,
            'runtime_graph_contract':'STATIC_LOCAL_ASSET_CANDIDATES_INCLUDING_NESTED_LOADERS_NOT_MEASURED_EXECUTION',
            'bootstrap_modules': bootstrap, 'deferred_ui_labels':deferred_labels,
            'lazy_assets':['security-names-v1.js'],
            'inventory_note':'required_boot_modules retains the legacy declared-list count; critical_ui_modules excludes deferred features. Bootstrap and lazy assets are explicit.',
            'violations': violations, 'required_boot_modules': [dict(zip(('id', 'url', 'label'), row)) for row in required],
            'workflows': workflows, 'browser_modules': modules}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = inventory()
    if args.output:
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'counts': result['counts'], 'violations': result['violations']}, ensure_ascii=False))
    if args.check and result['violations']:
        raise SystemExit(1)
