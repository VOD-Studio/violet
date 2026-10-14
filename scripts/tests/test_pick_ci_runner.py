import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "pick-ci-runner.sh"


class PickRunnerTests(unittest.TestCase):
    def pick(self, *, required=False, enabled=True, status="online", busy=False,
             event="push", head_repo="VOD-Studio/violet", token="test-token",
             labels=("omarchy",), response=None, curl_code=0):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            curl = root / "curl"
            curl.write_text('#!/bin/sh\nprintf "%s" "$TEST_RESPONSE"\nexit "$TEST_CURL_CODE"\n')
            curl.chmod(0o755)
            output = root / "output"
            summary = root / "summary"
            output.touch()
            summary.touch()
            environment = {
                **os.environ,
                "PATH": f"{root}:{os.environ['PATH']}",
                "GITHUB_OUTPUT": str(output),
                "GITHUB_STEP_SUMMARY": str(summary),
                "REQUIRE_SELF_HOSTED": str(required).lower(),
                "ENABLED": str(enabled).lower(),
                "EVENT": event,
                "HEAD_REPO": head_repo,
                "REPO": "VOD-Studio/violet",
                "TOKEN": token,
                "ORG": "VOD-Studio",
                "RUNNER_ID": "216",
                "TEST_RESPONSE": response if response is not None else json.dumps({
                    "status": status, "busy": busy,
                    "labels": [{"name": name} for name in labels],
                }),
                "TEST_CURL_CODE": str(curl_code),
            }
            result = subprocess.run(["bash", str(SCRIPT)], env=environment,
                                    text=True, capture_output=True, check=False)
            return result, output.read_text(), summary.read_text()

    def test_disabled_defaults_to_hosted(self):
        result, output, _ = self.pick(enabled=False)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(output, 'labels=["ubuntu-latest"]\n')

    def test_idle_runner_is_selected(self):
        result, output, _ = self.pick()
        self.assertEqual(result.returncode, 0)
        self.assertIn('"self-hosted"', output)

    def test_unavailable_runner_falls_back(self):
        for options in ({"busy": True}, {"status": "offline"}, {"token": ""},
                        {"labels": ()}, {"response": "invalid"}, {"curl_code": 22}):
            with self.subTest(options=options):
                result, output, _ = self.pick(**options)
                self.assertEqual(result.returncode, 0)
                self.assertEqual(output, 'labels=["ubuntu-latest"]\n')

    def test_fork_never_uses_self_hosted(self):
        result, output, _ = self.pick(event="pull_request", head_repo="external/violet")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(output, 'labels=["ubuntu-latest"]\n')

    def test_acceptance_ignores_daily_switch_and_can_queue(self):
        for event in ("push", "workflow_dispatch"):
            with self.subTest(event=event):
                result, output, _ = self.pick(required=True, enabled=False, busy=True, event=event)
                self.assertEqual(result.returncode, 0)
                self.assertIn('"self-hosted"', output)

    def test_acceptance_fails_instead_of_falling_back(self):
        for options in ({"status": "offline"}, {"token": ""}, {"labels": ()},
                        {"response": "invalid"}, {"curl_code": 22},
                        {"event": "pull_request"}, {"event": "pull_request_target"}):
            with self.subTest(options=options):
                result, output, _ = self.pick(required=True, **options)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(output, "")
                self.assertIn("cannot fall back", result.stderr)


if __name__ == "__main__":
    unittest.main()
