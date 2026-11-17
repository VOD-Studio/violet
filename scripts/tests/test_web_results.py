import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "check-web-results.py"
spec = importlib.util.spec_from_file_location("web_results", SCRIPT)
web_results = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web_results)


def results(selected=True):
    needs = {name: {"result": "success"} for name in (
        "changes", "web-plan", "web-lint", "web-typecheck", "web-build", "web-image")}
    needs["changes"]["outputs"] = {"web_image": "true"}
    needs["web-plan"]["outputs"] = {
        name: "true" if selected else "false" for name in (
            "has_unit", "has_contract", "has_packages")}
    for name in ("web-unit", "web-contract", "web-package"):
        needs[name] = {"result": "success" if selected else "skipped"}
    return needs


class WebResultsTests(unittest.TestCase):
    def test_selected_failure_or_skip_blocks_frontend(self):
        for name in ("web-plan", "web-lint", "web-typecheck", "web-build",
                     "web-unit", "web-contract", "web-package", "web-image"):
            for result in ("failure", "cancelled", "skipped"):
                with self.subTest(job=name, result=result):
                    needs = results()
                    needs[name]["result"] = result
                    with self.assertRaises(ValueError):
                        web_results.check(needs)

    def test_only_explicitly_unselected_matrices_can_skip(self):
        needs = results(False)
        web_results.check(needs)
        needs["web-plan"]["outputs"]["has_contract"] = "true"
        with self.assertRaises(ValueError):
            web_results.check(needs)

    def test_missing_plan_does_not_become_empty_success(self):
        for flag in (None, "", "unknown", True):
            with self.subTest(flag=flag):
                needs = results()
                needs["web-plan"]["outputs"]["has_unit"] = flag
                with self.assertRaises(ValueError):
                    web_results.check(needs)

    def test_unselected_image_may_skip_but_not_fail(self):
        needs = results()
        needs["changes"]["outputs"]["web_image"] = "false"
        needs["web-image"]["result"] = "skipped"
        web_results.check(needs)
        needs["web-image"]["result"] = "failure"
        with self.assertRaises(ValueError):
            web_results.check(needs)

    def test_cli_propagates_failed_required_work(self):
        needs = results()
        needs["web-contract"]["result"] = "failure"
        failed = subprocess.run([sys.executable, str(SCRIPT)], input=json.dumps(needs),
                                text=True, capture_output=True)
        self.assertEqual(failed.returncode, 1)
        self.assertIn("web-contract", failed.stderr)
        needs["web-contract"]["result"] = "success"
        passed = subprocess.run([sys.executable, str(SCRIPT)], input=json.dumps(needs),
                                text=True, capture_output=True)
        self.assertEqual(passed.returncode, 0, passed.stderr)


if __name__ == "__main__":
    unittest.main()
