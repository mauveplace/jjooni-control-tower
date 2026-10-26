import tempfile
import unittest
from pathlib import Path
from tools.audit_control_tower_architecture import runtime_asset_graph

class RuntimeAssetGraphTest(unittest.TestCase):
    def test_nested_assets_cycles_and_lazy_master_are_visible_without_executing_anything(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for name,text in {'index.html':'<script src="a.js?v=1"></script>', 'a.js':"s.src='b.js?v=2';", 'b.js':"s.src='a.js?v=1';lazy.src='master.js?v=1';external='missing.js?v=1';", 'master.js':'// static names'}.items():
                (root/name).write_text(text)
            graph=runtime_asset_graph(root)
            self.assertEqual(graph['index.html'],['a.js'])
            self.assertEqual(graph['b.js'],['a.js','master.js'])
            self.assertEqual(set(graph),{'index.html','a.js','b.js','master.js'})
