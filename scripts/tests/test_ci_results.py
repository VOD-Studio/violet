import json
from pathlib import Path
import subprocess
import sys
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "check-ci-results.py"


def results(*, api=False, web=False, infrastructure=False):
    return {
        "changes": {
            "result": "success",
            "outputs": {
                "api": str(api).lower(),
                "web": str(web).lower(),
                "infrastructure": str(infrastructure).lower(),
            },
        },
        "runner": {"result": "success"},
        "infrastructure": {"result": "success"},
        "backend": {"result": "success" if api else "skipped"},
        "frontend": {"result": "success" if web else "skipped"},
        "dependency-scan": {"result": "success" if api or web else "skipped"},
    }


class CIResultsTests(unittest.TestCase):
    def gate(self, needs):
        return subprocess.run(
            [sys.executable, str(SCRIPT)], input=json.dumps(needs),
            text=True, capture_output=True, check=False,
        )

    def test_documentation_allows_unneeded_jobs_to_be_skipped(self):
        result = self.gate(results())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_selected_sides_and_full_validation_pass(self):
        for api, web in ((True, False), (False, True), (True, True)):
            with self.subTest(api=api, web=web):
                result = self.gate(results(api=api, web=web, infrastructure=True))
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_infrastructure_only_change_allows_application_jobs_to_skip(self):
        result = self.gate(results(infrastructure=True))
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_prerequisite_failures_never_become_documentation_success(self):
        for job in ("changes", "runner", "infrastructure"):
            for status in ("failure", "cancelled", "skipped"):
                with self.subTest(job=job, status=status):
                    needs = results()
                    needs[job]["result"] = status
                    self.assertNotEqual(self.gate(needs).returncode, 0)

    def test_selected_checks_must_succeed(self):
        for job in ("backend", "frontend", "dependency-scan"):
            for status in ("failure", "cancelled", "skipped"):
                with self.subTest(job=job, status=status):
                    needs = results(api=True, web=True)
                    needs[job]["result"] = status
                    self.assertNotEqual(self.gate(needs).returncode, 0)

    def test_missing_or_invalid_impact_flags_fail_closed(self):
        for flag in ("api", "web", "infrastructure"):
            for value in (None, "", True, False, "invalid"):
                with self.subTest(flag=flag, value=value):
                    needs = results()
                    needs["changes"]["outputs"][flag] = value
                    self.assertNotEqual(self.gate(needs).returncode, 0)
            needs = results()
            del needs["changes"]["outputs"][flag]
            self.assertNotEqual(self.gate(needs).returncode, 0)

    def test_missing_jobs_and_outputs_fail_closed(self):
        for job in results():
            with self.subTest(job=job):
                needs = results()
                del needs[job]
                self.assertNotEqual(self.gate(needs).returncode, 0)
        needs = results()
        del needs["changes"]["outputs"]
        self.assertNotEqual(self.gate(needs).returncode, 0)

    def test_unselected_jobs_must_actually_be_skipped(self):
        for job in ("backend", "frontend", "dependency-scan"):
            for status in ("success", "failure", "cancelled"):
                with self.subTest(job=job, status=status):
                    needs = results()
                    needs[job]["result"] = status
                    self.assertNotEqual(self.gate(needs).returncode, 0)

    def test_malformed_results_fail_closed(self):
        for needs in (None, [], {"changes": None}):
            with self.subTest(needs=needs):
                self.assertNotEqual(self.gate(needs).returncode, 0)
        result = subprocess.run(
            [sys.executable, str(SCRIPT)], input="{",
            text=True, capture_output=True, check=False,
        )
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
