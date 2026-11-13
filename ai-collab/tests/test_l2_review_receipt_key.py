"""L2 regression acceptance: tests are immutable during automated repair."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from l2_review_receipt_key import review_receipt_key


class ReceiptKeyTests(unittest.TestCase):
    def test_same_event_same_key(self):
        one = review_receipt_key("mauveplace/jjooni-control-tower", 323, 6842687765)
        two = review_receipt_key("mauveplace/jjooni-control-tower", 323, 6842687765)
        self.assertEqual(one, two)

    def test_different_comment_ids_get_different_keys(self):
        a = review_receipt_key("mauveplace/jjooni-control-tower", 323, 1001)
        b = review_receipt_key("mauveplace/jjooni-control-tower", 323, 1002)
        self.assertNotEqual(a, b)

    def test_same_comment_id_in_different_prs_must_not_collide(self):
        a = review_receipt_key("mauveplace/jjooni-control-tower", 323, 42)
        b = review_receipt_key("mauveplace/jjooni-control-tower", 422, 42)
        self.assertNotEqual(a, b, "Dedup namespace must include PR number")

    def test_same_pr_and_comment_id_in_different_repos_must_not_collide(self):
        a = review_receipt_key("mauveplace/jjooni-control-tower", 323, 42)
        b = review_receipt_key("someone/other-repo", 323, 42)
        self.assertNotEqual(a, b, "Dedup namespace must include repository")

    def test_repository_case_normalized(self):
        a = review_receipt_key("MauvePlace/JJOONI-Control-Tower", 323, 42)
        b = review_receipt_key("mauveplace/jjooni-control-tower", 323, 42)
        self.assertEqual(a, b)

    def test_reject_nonpositive_or_boolean_ids(self):
        for value in (0, -1, True, "323", None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                review_receipt_key("mauveplace/jjooni-control-tower", value, 42)
            with self.subTest(comment_id=value), self.assertRaises(ValueError):
                review_receipt_key("mauveplace/jjooni-control-tower", 323, value)

    def test_invalid_repo_rejected(self):
        for repo in ("", "a", "../other", "a/b/c", None, 12):
            with self.subTest(repo=repo), self.assertRaises(ValueError):
                review_receipt_key(repo, 323, 42)


if __name__ == "__main__":
    unittest.main()
