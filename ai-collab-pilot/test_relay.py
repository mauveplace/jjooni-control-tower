import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
from relay import add, handoff, status

class RelayTests(unittest.TestCase):
    def setUp(self):
        self.doc = {"task_id":"TRIAL-1", "messages":[]}

    def test_complete_cycle(self):
        self.assertEqual(status(self.doc), "AWAITING_JJOONI_PROPOSAL")
        add(self.doc,"JJOONI","proposal","First draft.","draft-v1")
        self.assertEqual(status(self.doc), "AWAITING_ROY_AND_JJANGGU")
        add(self.doc,"ROY","risk_review","Check look-ahead.","risk-v1")
        self.assertEqual(status(self.doc), "AWAITING_JJANGGU")
        add(self.doc,"JJANGGU","data_review","Price data absent.","UNKNOWN")
        self.assertEqual(status(self.doc), "AWAITING_JJOONI_SYNTHESIS")
        add(self.doc,"JJOONI","synthesis","Do not assert unverified performance.","final-v1")
        self.assertEqual(status(self.doc), "REVIEW_COMPLETE_NOT_ORDER_APPROVED")
        self.assertEqual(len(handoff(self.doc)["items"]),4)

    def test_wrong_role_and_order(self):
        with self.assertRaises(ValueError): add(self.doc,"ROY","proposal","bad","1")
        with self.assertRaises(ValueError): add(self.doc,"ROY","risk_review","bad","1")
        add(self.doc,"JJOONI","proposal","draft","1")
        with self.assertRaises(ValueError): add(self.doc,"JJOONI","synthesis","too early","1")
        with self.assertRaises(ValueError): add(self.doc,"JJOONI","proposal","duplicate","2")

    def test_length_guard(self):
        with self.assertRaises(ValueError): add(self.doc,"JJOONI","proposal","a"*1201,"1")
        with self.assertRaises(ValueError): add(self.doc,"JJOONI","proposal","valid","")

if __name__ == "__main__": unittest.main()
