"""Load the isolated V4 role/security tests in the repository root test suite."""
import importlib.util
from pathlib import Path


def load_tests(loader, tests, pattern):
    source = Path(__file__).resolve().parents[1] / "ai-collab" / "tests" / "test_coordinator.py"
    spec = importlib.util.spec_from_file_location("ai_collab_v4_tests", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    tests.addTests(loader.loadTestsFromModule(module))
    return tests
