import copy,importlib.util,json,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('validator',Path('tools/validate_earnings.py'));v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
class ContractTests(unittest.TestCase):
 def setUp(self):self.d=json.loads(Path('market-observatory/data/earnings.json').read_text())
 def test_public_data(self):v.validate(self.d)
 def test_private_field_rejected(self):
  self.d['universe'][0]['held']=True
  with self.assertRaises(AssertionError):v.validate(self.d)
 def test_no_results_without_facts(self):
  self.d['events'][0]['status']='RELEASED'
  with self.assertRaises(AssertionError):v.validate(self.d)
 def test_incompatible_forecast(self):
  e=next(e for e in self.d['events'] if e['status']=='RELEASED');e['metrics'][0].update(consensus=1,consensus_basis='NON_GAAP')
  with self.assertRaises(AssertionError):v.validate(self.d)
