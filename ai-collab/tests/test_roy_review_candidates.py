import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from roy_review_candidates import parse_roy_review_candidate


TASK = "D-261113-COLLAB-REPLY-030"
HEAD = "adf9af4cee82e8597da54f492ff7c96bc549de26"


def review(marker, verdict="ROY_REVIEW=PASS"):
    return f"<!-- {marker} -->\n## ROY_REVIEW result\n{verdict}\n"


class ReviewCandidateParsingTests(unittest.TestCase):
    def test_current_roy_header_with_source_issue(self):
        got = parse_roy_review_candidate(
            review(f"JJOONI-COLLAB-ROY-REVIEW-V4 task={TASK} head={HEAD} stage=2 source-issue=419")
        )
        self.assertEqual((got["task_id"], got["reviewed_head"], got["source_issue"], got["verdict"]),
                         (TASK, HEAD, 419, "PASS"))
        self.assertEqual(got["status"], "UNVERIFIED_REVIEW_CANDIDATE")

    def test_second_actual_hyphenated_review_header(self):
        got = parse_roy_review_candidate(
            review(f"JJOONI-COLLAB-V4 ROY-REVIEW task={TASK} head={HEAD} stage=SYSTEM_REVIEW_ONLY issue=417",
                   "ROY_REVIEW=BLOCKED")
        )
        self.assertEqual(got["verdict"], "BLOCKED")
        self.assertEqual(got["source_issue"], 417)

    def test_underscored_real_header_and_markdown_verdict(self):
        got = parse_roy_review_candidate(
            review(f"JJOONI_COLLAB_V4 ROY-REVIEW task={TASK} head={HEAD} "
                   "stage=SYSTEM_REVIEW_ONLY issue=379", "**ROY review: NEEDS_CHANGES**")
        )
        self.assertEqual(got["verdict"], "NEEDS_CHANGES")
        self.assertEqual(got["source_issue"], 379)

    def test_legacy_actor_roy_review(self):
        got = parse_roy_review_candidate(
            review(f"JJOONI-COLLAB-V4 task={TASK} actor=ROY stage=review head={HEAD}")
        )
        self.assertEqual(got["verdict"], "PASS")
        self.assertIsNone(got["source_issue"])

    def test_legacy_reviewer_roy(self):
        got = parse_roy_review_candidate(
            review(f"JJOONI-COLLAB-V4 task={TASK} reviewer=ROY head={HEAD}")
        )
        self.assertIsNotNone(got)

    def test_every_candidate_is_unverified_and_non_authorizing(self):
        for value in (
            review(f"JJOONI-COLLAB-ROY-REVIEW-V4 task={TASK} head={HEAD}"),
            review(f"JJOONI_COLLAB_V4 ROY-REVIEW task={TASK} head={HEAD}",
                   "**ROY review: PASS**"),
        ):
            with self.subTest(value=value):
                got = parse_roy_review_candidate(value)
                for flag in ("provenance_verified", "can_merge", "can_deploy", "can_trade"):
                    self.assertIs(got[flag], False)

    def test_claimed_author_not_roy_is_rejected(self):
        self.assertIsNone(parse_roy_review_candidate(
            review(f"JJOONI-COLLAB-V4 task={TASK} actor=JJOONI head={HEAD}")
        ))

    def test_marker_not_on_first_line_is_rejected(self):
        self.assertIsNone(parse_roy_review_candidate(
            "Quoted content\n" + review(f"JJOONI-COLLAB-ROY-REVIEW-V4 task={TASK} head={HEAD}")
        ))

    def test_short_or_invalid_head_rejected(self):
        for sha in ("abc123", "g" * 40, "", HEAD + "f"):
            with self.subTest(sha=sha):
                self.assertIsNone(parse_roy_review_candidate(
                    review(f"JJOONI-COLLAB-ROY-REVIEW-V4 task={TASK} head={sha}")
                ))

    def test_missing_or_invalid_task_rejected(self):
        for task in ("", "../../secret", "a"):
            with self.subTest(task=task):
                self.assertIsNone(parse_roy_review_candidate(
                    review(f"JJOONI-COLLAB-ROY-REVIEW-V4 task={task} head={HEAD}")
                ))

    def test_missing_or_conflicting_verdict_rejected(self):
        marker = f"JJOONI-COLLAB-ROY-REVIEW-V4 task={TASK} head={HEAD}"
        self.assertIsNone(parse_roy_review_candidate(review(marker, "No verdict")))
        self.assertIsNone(parse_roy_review_candidate(review(marker, "ROY_REVIEW=PASS\nROY_REVIEW=BLOCKED")))

    def test_bad_source_issue_rejected(self):
        self.assertIsNone(parse_roy_review_candidate(
            review(f"JJOONI-COLLAB-ROY-REVIEW-V4 task={TASK} head={HEAD} source-issue=unknown")
        ))

    def test_missing_body_or_nonstring_rejected(self):
        marker = f"<!-- JJOONI-COLLAB-ROY-REVIEW-V4 task={TASK} head={HEAD} -->"
        for value in (None, "", marker, {}, []):
            with self.subTest(value=value):
                self.assertIsNone(parse_roy_review_candidate(value))


if __name__ == "__main__":
    unittest.main()
