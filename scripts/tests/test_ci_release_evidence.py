import base64
import contextlib
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import zipfile


spec = importlib.util.spec_from_file_location(
    "ci_release_evidence", Path(__file__).parents[1] / "ci-release-evidence.py",
)
cli = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cli)
release = cli.release

REPO = "VOD-Studio/violet"
SHA = "1" * 40
OTHER = "2" * 40
API = "sha256:" + "a" * 64
WEB = "sha256:" + "b" * 64
RUN = 44090000001
ATTEMPT = 2
WORKFLOW = 987
ARTIFACT = 456
ROOT = f"repos/{REPO}"


def manifest():
    return release.build_manifest("v2.26.1", SHA, API, WEB, RUN, ATTEMPT, SHA)


def archive_bytes(value=None, *, entries=None):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, body in entries or [(release.ASSET_NAME, release.compact(value or manifest()))]:
            archive.writestr(name, body)
    return buffer.getvalue()


class GitHubAPI:
    """REST-shaped fixtures exercised through the production gh subprocess adapter."""

    def __init__(self, *, creating=False):
        self.calls = []
        self.payload = archive_bytes()
        self.current = {
            "id": RUN, "run_attempt": ATTEMPT, "workflow_id": WORKFLOW,
            "head_sha": SHA, "head_branch": "release/2.0", "event": "push",
            "path": ".github/workflows/ci.yml", "status": "in_progress" if creating else "completed",
            "conclusion": None if creating else "success",
            "repository": {"id": 123, "full_name": REPO},
            "head_repository": {"id": 123, "full_name": REPO},
            "triggering_actor": {"login": "maintainer"},
        }
        self.attempt = copy.deepcopy(self.current)
        self.workflow = {"id": WORKFLOW, "path": ".github/workflows/ci.yml", "state": "active"}
        self.jobs = [
            {"id": index, "run_id": RUN, "run_attempt": ATTEMPT, "head_sha": SHA,
             "name": name, "status": "completed", "conclusion": "success"}
            for index, name in enumerate((*release.CI_REQUIRED_JOBS, release.CI_EVIDENCE_JOB), start=1)
        ]
        if creating:
            self.jobs[-1].update(status="in_progress", conclusion=None)
        self.artifacts = [{
            "id": ARTIFACT, "name": release.evidence_artifact_name(ATTEMPT), "expired": False,
            "digest": "sha256:" + hashlib.sha256(self.payload).hexdigest(),
            "workflow_run": {"id": RUN, "head_sha": SHA, "head_branch": "release/2.0"},
        }]
        self.permission = {"permission": "write", "user": {"login": "maintainer"}}
        self.version = "2.26.1"
        self.responses = {}
        self.failures = {}

    def __call__(self, command, **kwargs):
        self.calls.append((command, kwargs))
        method, path = command[3:5]
        if method != "GET":
            raise AssertionError(f"evidence must be read-only: {command}")
        if path in self.failures:
            return subprocess.CompletedProcess(command, 1, "", self.failures[path])
        if path in self.responses:
            value = self.responses[path]
        elif path == f"{ROOT}/actions/runs/{RUN}":
            value = self.current
        elif path == f"{ROOT}/actions/runs/{RUN}/attempts/{ATTEMPT}":
            value = self.attempt
        elif path == f"{ROOT}/actions/workflows/{WORKFLOW}":
            value = self.workflow
        elif path == f"{ROOT}/actions/runs/{RUN}/attempts/{ATTEMPT}/jobs?per_page=100&page=1":
            value = {"total_count": len(self.jobs), "jobs": self.jobs}
        elif path == f"{ROOT}/actions/runs/{RUN}/artifacts?per_page=100&page=1":
            value = {"total_count": len(self.artifacts), "artifacts": self.artifacts}
        elif path == f"{ROOT}/actions/artifacts/{ARTIFACT}/zip":
            if kwargs.get("text"):
                raise AssertionError("ZIP download must preserve bytes")
            return subprocess.CompletedProcess(command, 0, self.payload, b"")
        elif path == f"{ROOT}/contents/.release-please-manifest.json?ref={SHA}":
            value = {"type": "file", "encoding": "base64",
                     "content": base64.b64encode(json.dumps({".": self.version}).encode()).decode()}
        elif path == f"{ROOT}/collaborators/maintainer/permission":
            value = self.permission
        elif path == f"{ROOT}/actions/workflows/ci.yml/runs?branch=release/2.0&head_sha={SHA}&status=success&per_page=100&page=1":
            value = {"workflow_runs": [self.current]}
        else:
            raise AssertionError(f"unexpected API request: {path}")
        return subprocess.CompletedProcess(command, 0, json.dumps(value), "")

    def github(self):
        return release.GitHub(REPO, self)

    def install_payload(self, payload):
        self.payload = payload
        self.artifacts[0]["digest"] = "sha256:" + hashlib.sha256(payload).hexdigest()


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.api = GitHubAPI()
        self.github = self.api.github()

    def verify(self, value=None):
        return self.github.verify_ci_evidence(manifest() if value is None else value)

    def test_full_ci_keeps_exact_source_images_attempt_and_workflow(self):
        self.assertEqual(self.verify(), manifest())
        paths = [command[4] for command, _ in self.api.calls]
        self.assertIn(f"{ROOT}/actions/runs/{RUN}/attempts/{ATTEMPT}/jobs?per_page=100&page=1", paths)
        self.assertIn(f"{ROOT}/actions/artifacts/{ARTIFACT}/zip", paths)

    def test_wrong_sha_branch_repository_workflow_event_or_conclusion_fails(self):
        broken = [("head_sha", OTHER), ("head_branch", "feature"), ("path", ".github/workflows/deploy.yml"),
                  ("event", "pull_request"), ("event", "pull_request_target"),
                  ("repository", {"full_name": "attacker/violet"}),
                  ("head_repository", {"full_name": "attacker/violet"}),
                  ("conclusion", "failure"), ("conclusion", "skipped"), ("status", "in_progress")]
        for field, value in broken:
            for source in ("current", "attempt"):
                api = GitHubAPI()
                getattr(api, source)[field] = value
                with self.subTest(field=field, source=source), self.assertRaises(release.ReleaseError):
                    api.github().verify_ci_evidence(manifest())

    def test_workflow_id_and_actual_workflow_path_must_match(self):
        for field, value in (("id", WORKFLOW + 1), ("path", ".github/workflows/pr.yml"), ("state", "disabled_manually")):
            api = GitHubAPI()
            api.workflow[field] = value
            with self.subTest(field=field), self.assertRaises(release.ReleaseError):
                api.github().verify_ci_evidence(manifest())
        self.api.current["workflow_id"] = WORKFLOW + 1
        with self.assertRaises(release.ReleaseError):
            self.verify()

    def test_every_full_job_and_matrix_element_must_succeed(self):
        for index, original in enumerate(self.api.jobs):
            for bad in ("skipped", "failure", "cancelled", None):
                api = GitHubAPI()
                api.jobs[index]["conclusion"] = bad
                with self.subTest(job=original["name"], conclusion=bad), self.assertRaises(release.ReleaseError):
                    api.github().verify_ci_evidence(manifest())

    def test_absent_duplicate_wrong_attempt_and_wrong_sha_jobs_fail(self):
        variants = [lambda jobs: jobs.pop(), lambda jobs: jobs.append(copy.deepcopy(jobs[0])),
                    lambda jobs: jobs[0].update(run_attempt=1), lambda jobs: jobs[0].update(head_sha=OTHER),
                    lambda jobs: jobs[0].update(run_id=RUN + 1)]
        for mutate in variants:
            api = GitHubAPI()
            mutate(api.jobs)
            with self.subTest(mutate=mutate), self.assertRaises(release.ReleaseError):
                api.github().verify_ci_evidence(manifest())

    def test_later_attempt_invalidates_old_success_even_if_old_artifact_exists(self):
        self.api.current["run_attempt"] += 1
        with self.assertRaisesRegex(release.ReleaseError, "attempt"):
            self.verify()
        self.assertEqual(len(self.api.calls), 1)

    def test_local_full_flag_is_not_release_authority(self):
        self.api.jobs = [job for job in self.api.jobs if job["name"] != "Web contract (2/2)"]
        with self.assertRaises(release.ReleaseError):
            self.verify()

    def test_dispatch_requires_actual_write_permission_and_actor(self):
        for granted in ("write", "maintain", "admin", "read", "none", None):
            api = GitHubAPI()
            api.current["event"] = api.attempt["event"] = "workflow_dispatch"
            api.permission["permission"] = granted
            with self.subTest(permission=granted):
                if granted in ("write", "maintain", "admin"):
                    self.assertEqual(api.github().verify_ci_evidence(manifest()), manifest())
                else:
                    with self.assertRaises(release.ReleaseError):
                        api.github().verify_ci_evidence(manifest())

    def test_altered_local_digests_version_and_workflow_cannot_replace_artifact(self):
        for field, value in (("api_image", "ghcr.io/vod-studio/violet-api@" + WEB),
                             ("web_image", "ghcr.io/vod-studio/violet-web@" + API), ("version", "v2.26.2")):
            changed = {**manifest(), field: value}
            with self.subTest(field=field), self.assertRaises(release.ReleaseError):
                self.verify(changed)
        changed = manifest()
        changed["verification"]["workflow_revision"] = OTHER
        with self.assertRaises(release.ReleaseError):
            self.verify(changed)

    def test_source_release_version_is_checked_at_exact_sha(self):
        self.api.version = "2.26.2"
        with self.assertRaises(release.ReleaseError):
            self.verify()

    def test_artifact_name_origin_expiration_and_archive_digest_are_checked(self):
        variants = [lambda artifact: artifact.update(name="user-supplied-evidence"),
                    lambda artifact: artifact.update(expired=True),
                    lambda artifact: artifact.update(digest="sha256:" + "f" * 64),
                    lambda artifact: artifact["workflow_run"].update(head_sha=OTHER),
                    lambda artifact: artifact["workflow_run"].update(id=RUN + 1),
                    lambda artifact: artifact["workflow_run"].update(head_branch="feature")]
        for mutate in variants:
            api = GitHubAPI()
            mutate(api.artifacts[0])
            with self.subTest(mutate=mutate), self.assertRaises(release.ReleaseError):
                api.github().verify_ci_evidence(manifest())
        self.api.artifacts.append(copy.deepcopy(self.api.artifacts[0]))
        with self.assertRaises(release.ReleaseError):
            self.verify()

    def test_archive_requires_single_fixed_filename_and_valid_json(self):
        variants = [b"not a zip", archive_bytes(entries=[("../release-manifest.json", "{}")]),
                    archive_bytes(entries=[("release-manifest.json", "{}"), ("extra", "untrusted")]),
                    archive_bytes(entries=[("release-manifest.json", "{invalid")]),
                    archive_bytes(entries=[("release-manifest.json", "x" * 65537)])]
        for payload in variants:
            api = GitHubAPI()
            api.install_payload(payload)
            with self.subTest(size=len(payload)), self.assertRaises(release.ReleaseError):
                api.github().verify_ci_evidence(manifest())

    def test_canonical_evidence_for_old_attempt_cannot_be_reused(self):
        old = manifest()
        old["verification"]["run_attempt"] = ATTEMPT - 1
        self.api.install_payload(archive_bytes(old))
        with self.assertRaises(release.ReleaseError):
            self.verify()
        with self.assertRaises(release.ReleaseError):
            self.github.ci_evidence(RUN, SHA, "v2.26.1")

    def test_api_errors_and_malformed_pagination_fail_closed(self):
        self.verify()
        paths = [command[4] for command, _ in self.api.calls]
        for path in paths:
            for message in ("gh: Forbidden (HTTP 403)", "gh: Bad Gateway (HTTP 502)", "connection reset"):
                api = GitHubAPI()
                api.failures[path] = message
                with self.subTest(path=path, error=message), self.assertRaises(release.ReleaseError):
                    api.github().verify_ci_evidence(manifest())
        api = GitHubAPI()
        api.responses[f"{ROOT}/actions/runs/{RUN}/attempts/{ATTEMPT}/jobs?per_page=100&page=1"] = {"jobs": None}
        with self.assertRaises(release.ReleaseError):
            api.github().verify_ci_evidence(manifest())

    def test_jobs_pagination_never_discards_required_last_page(self):
        filler = [{"name": f"optional {index}"} for index in range(100)]
        path = f"{ROOT}/actions/runs/{RUN}/attempts/{ATTEMPT}/jobs?per_page=100&page="
        self.api.responses[path + "1"] = {"jobs": filler}
        self.api.responses[path + "2"] = {"jobs": self.api.jobs}
        self.assertEqual(self.verify(), manifest())

    def test_manual_lookup_requires_successful_exact_main_ci(self):
        self.assertEqual(self.github.find_ci_evidence(SHA, "v2.26.1"), manifest())
        self.api.current["event"] = "pull_request"
        with self.assertRaisesRegex(release.ReleaseError, "精确 SHA"):
            self.github.find_ci_evidence(SHA, "v2.26.1")


class CLITests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        self.path = self.root / "release-manifest.json"
        self.output = self.root / "outputs"
        self.env = {"GH_REPO": REPO, "GITHUB_OUTPUT": str(self.output), "CI_FULL": "true",
                    "GITHUB_SHA": SHA, "GITHUB_WORKFLOW_SHA": SHA,
                    "GITHUB_RUN_ID": str(RUN), "GITHUB_RUN_ATTEMPT": str(ATTEMPT),
                    "VALIDATE_RESULT": "success", "BUILD_API_RESULT": "success", "BUILD_WEB_RESULT": "success"}

    def invoke(self, args, api):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            return cli.main(args, github=api.github(), env=self.env)

    def create_args(self):
        return ["create", "--revision", SHA, "--version", "v2.26.1", "--api-digest", API,
                "--web-digest", WEB, "--output", str(self.path)]

    def test_create_checks_real_jobs_but_allows_its_own_running_job(self):
        api = GitHubAPI(creating=True)
        api.jobs.append({"name": "Record test timings", "status": "in_progress", "conclusion": None})
        self.assertEqual(self.invoke(self.create_args(), api), 0)
        self.assertEqual(json.loads(self.path.read_text()), manifest())
        self.assertIn(f"verification_run_id={RUN}\n", self.output.read_text())
        self.assertIn(f"verification_run_attempt={ATTEMPT}\n", self.output.read_text())

    def test_create_rejects_failed_skipped_or_missing_jobs_despite_success_env(self):
        api = GitHubAPI(creating=True)
        api.jobs[0]["conclusion"] = "skipped"
        self.assertEqual(self.invoke(self.create_args(), api), 1)
        self.assertFalse(self.path.exists())
        self.assertFalse(self.output.exists())

    def test_create_rejects_missing_full_gate_source_and_workflow_sha(self):
        variants = [("CI_FULL", "false"), ("CI_FULL", None), ("GITHUB_SHA", OTHER),
                    ("GITHUB_WORKFLOW_SHA", OTHER), ("GITHUB_WORKFLOW_SHA", None),
                    ("VALIDATE_RESULT", "skipped"), ("BUILD_API_RESULT", "failure"), ("BUILD_WEB_RESULT", "cancelled")]
        for key, value in variants:
            old = self.env.get(key)
            self.env[key] = value
            with self.subTest(key=key, value=value):
                self.assertEqual(self.invoke(self.create_args(), GitHubAPI(creating=True)), 1)
                self.assertFalse(self.path.exists())
                self.assertFalse(self.output.exists())
            self.env[key] = old

    def test_verify_emits_original_run_identifiers_and_image_digests(self):
        self.path.write_text(release.compact(manifest()))
        self.output.write_text("prior=value\n")
        self.assertEqual(self.invoke(["verify", "--manifest", str(self.path), "--run-id", str(RUN)], GitHubAPI()), 0)
        self.assertEqual(self.output.read_text(), "prior=value\n" + "".join(
            f"{key}={value}\n" for key, value in release.evidence_outputs(manifest()).items()
        ))

    def test_verify_wrong_run_or_untrusted_api_never_emits_outputs(self):
        self.path.write_text(release.compact(manifest()))
        args = ["verify", "--manifest", str(self.path), "--run-id", str(RUN + 1)]
        self.assertEqual(self.invoke(args, GitHubAPI()), 1)
        self.assertFalse(self.output.exists())
        api = GitHubAPI()
        api.failures[f"{ROOT}/actions/runs/{RUN}"] = "gh: Forbidden (HTTP 403)"
        self.assertEqual(self.invoke(["verify", "--manifest", str(self.path)], api), 1)
        self.assertFalse(self.output.exists())

    def test_fetch_automatic_run_downloads_verified_canonical_manifest(self):
        api = GitHubAPI()
        args = ["fetch", "--revision", SHA, "--run-id", str(RUN), "--output", str(self.path)]
        self.assertEqual(self.invoke(args, api), 0)
        self.assertEqual(json.loads(self.path.read_text()), manifest())
        self.assertIn(f"verification_run_id={RUN}\n", self.output.read_text())

    def test_fetch_manual_run_selects_exact_sha_and_fails_closed_for_pr(self):
        args = ["fetch", "--revision", SHA, "--output", str(self.path)]
        self.assertEqual(self.invoke(args, GitHubAPI()), 0)
        self.assertEqual(json.loads(self.path.read_text()), manifest())
        self.path.unlink()
        self.output.unlink()
        api = GitHubAPI()
        api.current["event"] = "pull_request"
        self.assertEqual(self.invoke(args, api), 1)
        self.assertFalse(self.path.exists())
        self.assertFalse(self.output.exists())

    def test_fetch_wrong_source_or_digest_cannot_write_evidence(self):
        args = ["fetch", "--revision", SHA, "--run-id", str(RUN), "--output", str(self.path)]
        for mutate in (lambda api: api.attempt.update(head_sha=OTHER),
                       lambda api: api.artifacts[0].update(digest="sha256:" + "f" * 64)):
            api = GitHubAPI()
            mutate(api)
            with self.subTest(mutate=mutate):
                self.assertEqual(self.invoke(args, api), 1)
                self.assertFalse(self.path.exists())
                self.assertFalse(self.output.exists())


class PublicationContractTests(unittest.TestCase):
    def setUp(self):
        fixture_spec = importlib.util.spec_from_file_location(
            "candidate_fixtures", Path(__file__).with_name("test_release_candidate.py"),
        )
        fixtures = importlib.util.module_from_spec(fixture_spec)
        fixture_spec.loader.exec_module(fixtures)
        self.git = fixtures.MemoryGit()
        self.git.nodes[SHA]["version"] = "v2.26.1"
        self.git.notes[SHA] = "# Changelog\n\n## 2.26.1\n\n* Fixed release validation.\n"
        self.github = fixtures.MemoryGitHub()
        self.github.refs[release.CANDIDATE_REF] = SHA
        self.api = GitHubAPI()
        self.github.verify_ci_evidence = self.api.github().verify_ci_evidence
        self.controller = release.Coordinator(self.git, self.github, {
            "GITHUB_SHA": OTHER, "GITHUB_RUN_ID": "9999", "GITHUB_RUN_ATTEMPT": "1",
        })
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.path = Path(self.folder.name) / release.ASSET_NAME
        self.path.write_text(release.compact(manifest()))

    def publish(self):
        return self.controller.publish("v2.26.1", SHA, API, WEB, verification=self.path)

    def test_good_evidence_publishes_original_full_ci_run(self):
        result = self.publish()
        self.assertEqual(result["status"], "published")
        self.assertEqual(json.loads(result["manifest"]), manifest())
        self.assertEqual(self.github.refs["tags/v2.26.1"], SHA)

    def test_rejected_ci_cannot_create_release_tag_or_upload(self):
        variants = [lambda api: api.current.update(head_sha=OTHER),
                    lambda api: api.current.update(event="pull_request"),
                    lambda api: api.current.update(run_attempt=ATTEMPT + 1),
                    lambda api: api.jobs[0].update(conclusion="skipped"),
                    lambda api: api.artifacts[0].update(digest="sha256:" + "f" * 64),
                    lambda api: api.artifacts[0].update(name="other-artifact")]
        for mutate in variants:
            api = GitHubAPI()
            mutate(api)
            self.github.verify_ci_evidence = api.github().verify_ci_evidence
            with self.subTest(mutate=mutate), self.assertRaises(release.ReleaseError):
                self.publish()
            self.assertEqual(self.github.effects, [])
            self.assertEqual(self.github.releases, {})

    def test_good_old_ci_cannot_publish_over_newer_frozen_revision(self):
        self.github.refs[release.CANDIDATE_REF] = OTHER
        self.assertEqual(self.publish(), {"status": "superseded"})
        self.assertEqual(self.github.effects, [])


if __name__ == "__main__":
    unittest.main()
