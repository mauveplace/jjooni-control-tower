"""Expose the public-only AI collaboration V4 tests to the repository root suite."""
from pathlib import Path


def load_tests(loader, tests, pattern):
    nested = Path(__file__).resolve().parents[1] / "ai-collab" / "tests"
    tests.addTests(loader.discover(str(nested), pattern=pattern or "test_*.py"))
    return tests
