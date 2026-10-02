import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest


spec = importlib.util.spec_from_file_location(
    "check_release_version", Path(__file__).parents[1] / "check-release-version.py"
)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class ReleaseVersionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git("init", "-q")
        self.git("config", "user.email", "ci@example.invalid")
        self.git("config", "user.name", "CI test")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "core.hooksPath", "/dev/null")
        self.manifest("2.8.51")
        self.commit("chore: baseline\n\nRelease-As: v2.8.51")
        self.base = self.git("rev-parse", "HEAD")

    def git(self, *args):
        return subprocess.run(
            ["git", *args], cwd=self.repo, check=True, text=True, capture_output=True
        ).stdout.strip()

    def manifest(self, value):
        (self.repo / checker.MANIFEST).write_text(json.dumps({".": value}))

    def commit(self, message):
        self.git("add", ".")
        self.git("commit", "-q", "--allow-empty", "-m", message)

    def check(self, release_pr=False):
        with contextlib.redirect_stdout(io.StringIO()):
            checker.check(self.base, "HEAD", release_pr, self.repo)

    def test_ignores_already_merged_release_trailers(self):
        self.commit("fix: next feature")
        self.check()

    def test_same_future_version_allowed_for_one_batch(self):
        self.commit("fix: feature one\n\nRelease-As: v2.8.52")
        self.commit("fix: feature two\n\nRelease-As: v2.8.52")
        self.check()

    def test_rejects_already_published_same_version(self):
        self.commit("fix: stale task\n\nRelease-As: v2.8.51")
        with self.assertRaisesRegex(ValueError, "already published"):
            self.check()

    def test_rejects_older_version(self):
        self.commit("fix: stale task\n\nRelease-As: v2.8.50")
        with self.assertRaisesRegex(ValueError, "already published"):
            self.check()

    def test_accepts_new_release_manifest(self):
        self.manifest("2.8.52")
        self.commit("chore(release): release 2.8.52")
        self.check(release_pr=True)

    def test_rejects_unchanged_release_manifest(self):
        self.commit("chore(release): stale release")
        with self.assertRaisesRegex(ValueError, "must be newer"):
            self.check(release_pr=True)

    def test_rejects_manifest_downgrade_in_any_pr(self):
        self.manifest("2.8.50")
        self.commit("chore: alter manifest")
        with self.assertRaisesRegex(ValueError, "must be newer"):
            self.check()

    def test_unmodified_manifest_on_stale_feature_branch_is_allowed(self):
        self.git("branch", "feature")
        self.manifest("2.8.52")
        self.commit("chore(release): release 2.8.52")
        self.base = self.git("rev-parse", "HEAD")
        self.git("checkout", "-q", "feature")
        self.commit("fix: feature branched before the release")
        self.check()

    def test_footer_is_rechecked_against_advanced_base(self):
        self.git("branch", "feature")
        self.manifest("2.8.52")
        self.commit("chore(release): release 2.8.52")
        self.base = self.git("rev-parse", "HEAD")
        self.git("checkout", "-q", "feature")
        self.commit("fix: task allocated an already published version\n\nRelease-As: v2.8.52")
        with self.assertRaisesRegex(ValueError, "already published"):
            self.check()

    def test_numeric_version_order(self):
        self.manifest("2.8.100")
        self.commit("chore(release): release 2.8.100")
        self.check(release_pr=True)


if __name__ == "__main__":
    unittest.main()
