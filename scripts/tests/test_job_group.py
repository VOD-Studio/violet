import json
from pathlib import Path
import subprocess
import sys
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "check-job-group.py"


def results(**overrides):
    needs = {
        "changes": {"result": "success"},
        "lint": {"result": "success"},
        "test": {"result": "success"},
        "image": {"result": "success"},
    }
    for job, result in overrides.items():
        needs[job] = {"result": result}
    return needs


class JobGroupTests(unittest.TestCase):
    def gate(self, needs, *optional):
        args = [sys.executable, str(SCRIPT)]
        if optional:
            args += ["--optional", *optional]
        return subprocess.run(
            args, input=json.dumps(needs), text=True, capture_output=True, check=False,
        )

    def test_all_jobs_succeeding_passes(self):
        self.assertEqual(self.gate(results()).returncode, 0)

    def test_any_job_not_succeeding_fails(self):
        for job in ("changes", "lint", "test", "image"):
            for status in ("failure", "cancelled", "skipped"):
                with self.subTest(job=job, status=status):
                    self.assertNotEqual(self.gate(results(**{job: status})).returncode, 0)

    def test_optional_job_may_be_skipped_but_not_fail(self):
        self.assertEqual(self.gate(results(image="skipped"), "image").returncode, 0)
        for status in ("failure", "cancelled"):
            with self.subTest(status=status):
                self.assertNotEqual(self.gate(results(image=status), "image").returncode, 0)

    def test_optional_does_not_excuse_other_skipped_jobs(self):
        self.assertNotEqual(self.gate(results(test="skipped"), "image").returncode, 0)

    def test_every_failing_job_is_reported(self):
        result = self.gate(results(lint="failure", test="cancelled"))
        self.assertIn("lint", result.stderr)
        self.assertIn("test", result.stderr)

    def test_missing_or_malformed_results_fail_closed(self):
        for needs in ({}, [], None, {"lint": None}, {"lint": {}}, {"lint": {"result": None}}):
            with self.subTest(needs=needs):
                self.assertNotEqual(self.gate(needs).returncode, 0)


if __name__ == "__main__":
    unittest.main()
