import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("retry_deploy", Path(__file__).parents[1] / "retry-deploy.py")
retry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retry)


class RetryDeployTests(unittest.TestCase):
    def setUp(self):
        self.run = {"path": ".github/workflows/deploy.yml", "status": "completed",
                    "conclusion": "failure", "event": "push", "run_attempt": 1}

    def jobs(self, *names):
        return [{"name": name, "conclusion": "failure"} for name in names]

    def test_only_build_failures_are_retryable(self):
        self.assertIsNone(retry.retry_reason(self.run, self.jobs("build-api", "build-web")))
        for name in ("deploy", "validate / Backend (Go)", "prepare", "notify-failure"):
            with self.subTest(name=name):
                self.assertIsNotNone(retry.retry_reason(self.run, self.jobs("build-web", name)))

    def test_manual_cancelled_and_unrelated_runs_are_not_retried(self):
        for changes in ({"event": "workflow_dispatch"}, {"status": "in_progress"},
                        {"conclusion": "cancelled"}, {"path": ".github/workflows/ci.yml"},
                        {"run_attempt": 3}):
            with self.subTest(changes=changes):
                self.assertIsNotNone(retry.retry_reason(self.run | changes, self.jobs("build-api")))
        self.assertIsNotNone(retry.retry_reason(self.run, []))
        self.assertIsNotNone(retry.retry_reason(self.run, self.jobs("build-api") +
                             [{"name": "build-web", "conclusion": "cancelled"}]))


if __name__ == "__main__":
    unittest.main()
