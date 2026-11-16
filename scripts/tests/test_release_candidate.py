import contextlib
import copy
import importlib.util
import io
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest


spec = importlib.util.spec_from_file_location(
    "release_candidate", Path(__file__).parents[1] / "release-candidate.py"
)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

BASE = "0" * 40
S1 = "1" * 40
S2 = "2" * 40
S3 = "3" * 40
OTHER = "4" * 40
WORKFLOW = "a" * 40
API_DIGEST = "sha256:" + "b" * 64
WEB_DIGEST = "sha256:" + "c" * 64
NEXT_DIGEST = "sha256:" + "d" * 64


def evidence(sha=S1, target="v2.26.0"):
    return {
        "version": target, "revision": sha,
        "api_image": f"ghcr.io/vod-studio/violet-api@{API_DIGEST}",
        "web_image": f"ghcr.io/vod-studio/violet-web@{WEB_DIGEST}",
        "verification": {"run_id": 123, "run_attempt": 1,
                         "workflow_revision": WORKFLOW, "full": True},
    }


class MemoryGit:
    def __init__(self):
        self.nodes = {
            BASE: {"version": "v2.25.1", "parent": None, "release": BASE},
            S1: {"version": "v2.26.0", "parent": BASE, "release": S1},
            S2: {"version": "v2.26.0", "parent": S1, "release": S1},
            S3: {"version": "v2.27.0", "parent": S2, "release": S3},
            OTHER: {"version": "v2.26.0", "parent": BASE, "release": OTHER},
        }
        self.main = S2
        self.head = S2
        self.reads = []
        self.notes = {sha: f"# Changelog\n\n## [{node['version'][1:]}](https://example.test) (2026-11-16)\n\n### 修复\n\n* 用户改写的 {sha[:4]} 内容。\n\n## 1.0.0\n\n* Older.\n"
                      for sha, node in self.nodes.items()}

    def resolve(self, name):
        if name == release.MAIN_REF:
            return self.main
        if name == "HEAD":
            return self.head
        if name in self.nodes:
            return name
        raise release.ReleaseError("unknown commit")

    def version(self, sha):
        return self.nodes[sha]["version"]

    def parent(self, sha):
        return self.nodes[sha]["parent"]

    def ancestor(self, older, newer):
        while newer:
            if older == newer:
                return True
            newer = self.parent(newer)
        return False

    def read(self, sha, path):
        self.reads.append((sha, path))
        if path == "CHANGELOG.md":
            return self.notes[sha]
        raise AssertionError(path)

    def release_commit(self, sha):
        return self.nodes[sha]["release"]


class MemoryGitHub:
    """In-memory external state with failures before or after durable mutations."""

    def __init__(self):
        self.refs = {}
        self.releases = {}
        self.effects = []
        self.calls = []
        self.faults = {}
        self.pending = {S1, S3, BASE}
        self.tagged = set()

    def fail(self, operation, *, after=False, status=500):
        self.faults.setdefault((operation, after), []).append(release.APIError(status, f"{operation} interrupted"))

    def checkpoint(self, operation, after=False):
        self.calls.append((operation, after))
        errors = self.faults.get((operation, after), [])
        if errors:
            raise errors.pop(0)

    def ref(self, name):
        self.checkpoint("ref:" + name)
        return self.refs.get(name)

    def set_candidate(self, sha, previous):
        self.checkpoint("set_candidate")
        if self.refs.get(release.CANDIDATE_REF) != previous:
            raise release.ReleaseError("pointer changed")
        self.refs[release.CANDIDATE_REF] = sha
        self.effects.append(("set_candidate", sha))
        self.checkpoint("set_candidate", True)

    def clear_candidate(self, sha):
        self.checkpoint("clear_candidate")
        if self.refs.get(release.CANDIDATE_REF) == sha:
            del self.refs[release.CANDIDATE_REF]
            self.effects.append(("clear_candidate", sha))
        self.checkpoint("clear_candidate", True)

    def release(self, target):
        self.checkpoint("release")
        return copy.deepcopy(self.releases.get(target))

    def assets(self, value):
        self.checkpoint("assets")
        return copy.deepcopy(self.releases[value["tag_name"]]["assets"])

    def read_asset(self, asset):
        self.checkpoint("read_asset")
        return asset["body"]

    def delete_asset(self, asset):
        self.checkpoint("delete_asset")
        for value in self.releases.values():
            value["assets"] = [item for item in value["assets"] if item["id"] != asset["id"]]
        self.effects.append(("delete_asset", asset["id"]))
        self.checkpoint("delete_asset", True)

    def upload_asset(self, value, manifest):
        self.checkpoint("upload_asset")
        assets = self.releases[value["tag_name"]]["assets"]
        if assets:
            raise AssertionError("valid assets must never be overwritten")
        assets.append({"id": 10, "name": release.ASSET_NAME, "state": "uploaded",
                       "size": len(release.compact(manifest)), "body": release.compact(manifest)})
        self.effects.append(("upload_asset", copy.deepcopy(manifest)))
        self.checkpoint("upload_asset", True)

    def create_release(self, target, sha, notes):
        self.checkpoint("create_release")
        value = {"id": len(self.releases) + 1, "tag_name": target,
                 "target_commitish": sha, "body": notes, "draft": True,
                 "prerelease": False, "assets": []}
        self.releases[target] = value
        self.effects.append(("create_release", target))
        self.checkpoint("create_release", True)
        return copy.deepcopy(value)

    def publish_release(self, value):
        self.checkpoint("publish_release")
        stored = self.releases[value["tag_name"]]
        stored["draft"] = False
        self.refs["tags/" + value["tag_name"]] = stored["target_commitish"]
        self.effects.append(("publish_release", value["tag_name"]))
        self.checkpoint("publish_release", True)
        return copy.deepcopy(stored)

    def close_release_pr(self, sha):
        self.checkpoint("close_release_pr")
        if sha in self.pending:
            self.tagged.add(sha)
            self.pending.remove(sha)
            self.effects.append(("close_release_pr", sha))
        self.checkpoint("close_release_pr", True)

    def install_release(self, target="v2.26.0", sha=S1, *, draft=False, manifest=True, tag=True):
        self.releases[target] = {
            "id": len(self.releases) + 1, "tag_name": target, "target_commitish": sha,
            "body": "用户保留的 release notes", "draft": draft, "prerelease": False, "assets": [],
        }
        if manifest:
            self.releases[target]["assets"] = [{"id": 10, "name": release.ASSET_NAME,
                                                "state": "uploaded", "size": 100,
                                                "body": release.compact(evidence(sha, target))}]
        if tag:
            self.refs["tags/" + target] = sha


class CoordinatorTests(unittest.TestCase):
    def setUp(self):
        self.git = MemoryGit()
        self.github = MemoryGitHub()
        self.env = {
            "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_SHA": WORKFLOW,
            "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "1",
            "VALIDATE_RESULT": "success", "BUILD_API_RESULT": "success", "BUILD_WEB_RESULT": "success",
        }
        self.controller = release.Coordinator(self.git, self.github, self.env)

    def freeze(self, sha=S1):
        self.github.refs[release.CANDIDATE_REF] = sha

    def publish(self, sha=S1, target="v2.26.0", api_digest=API_DIGEST, web_digest=WEB_DIGEST, workflow=WORKFLOW):
        return self.controller.publish(target, sha, api_digest, web_digest, workflow)

    def test_push_freezes_event_sha_even_when_main_has_later_pr(self):
        self.env.update(GITHUB_EVENT_NAME="push", GITHUB_SHA=S1)
        result = self.controller.prepare()
        self.assertEqual(result, {"mode": "candidate", "version": "v2.26.0", "revision": S1})
        self.assertEqual(self.github.refs[release.CANDIDATE_REF], S1)

    def test_ordinary_push_skips_instead_of_broadening_candidate(self):
        self.freeze()
        self.env.update(GITHUB_EVENT_NAME="push", GITHUB_SHA=S2)
        self.assertEqual(self.controller.prepare()["mode"], "skip")
        self.assertEqual(self.github.refs[release.CANDIDATE_REF], S1)
        self.assertEqual(self.github.effects, [])

    def test_push_must_be_ancestor_of_main_even_without_version_change(self):
        self.env.update(GITHUB_EVENT_NAME="push", GITHUB_SHA=OTHER)
        with self.assertRaisesRegex(release.ReleaseError, "合入"):
            self.controller.prepare()
        self.assertEqual(self.github.effects, [])

    def test_manual_without_revision_resumes_frozen_sha(self):
        self.freeze()
        for requested in ("", "2.26.0", "v2.26.0"):
            with self.subTest(requested=requested):
                self.assertEqual(self.controller.prepare(requested)["revision"], S1)
        self.assertEqual(self.github.effects, [])

    def test_manual_initial_candidate_uses_current_main(self):
        result = self.controller.prepare()
        self.assertEqual(result["revision"], S2)
        self.assertEqual(self.github.refs[release.CANDIDATE_REF], S2)

    def test_manual_explicit_descendant_reselects_same_version(self):
        self.freeze()
        self.assertEqual(self.controller.prepare("", S2)["revision"], S2)
        self.assertEqual(self.publish()["status"], "superseded")
        self.assertNotIn("v2.26.0", self.github.releases)

    def test_reselection_rejects_ancestor_or_unmerged_revision(self):
        self.freeze(S2)
        for sha in (S1, OTHER):
            with self.subTest(sha=sha), self.assertRaises(release.ReleaseError):
                self.controller.prepare("v2.26.0", sha)
        self.assertEqual(self.github.refs[release.CANDIDATE_REF], S2)
        self.assertEqual(self.github.effects, [])

    def test_new_version_cannot_displace_pending_candidate(self):
        self.freeze()
        self.git.main = S3
        for event in ("push", "workflow_dispatch"):
            self.env.update(GITHUB_EVENT_NAME=event, GITHUB_SHA=S3)
            with self.subTest(event=event), self.assertRaisesRegex(release.ReleaseError, "不能挤占"):
                self.controller.prepare("" if event == "push" else "v2.27.0", "" if event == "push" else S3)
        self.assertEqual(self.github.refs[release.CANDIDATE_REF], S1)
        self.assertEqual(self.github.effects, [])

    def test_published_previous_candidate_allows_next_version(self):
        self.freeze()
        self.github.install_release()
        self.git.main = S3
        self.env.update(GITHUB_EVENT_NAME="push", GITHUB_SHA=S3)
        self.assertEqual(self.controller.prepare()["revision"], S3)
        self.assertEqual(self.github.refs[release.CANDIDATE_REF], S3)

    def test_manifest_version_must_match_selected_revision(self):
        with self.assertRaisesRegex(release.ReleaseError, "manifest 不一致"):
            self.controller.prepare("v2.27.0", S1)
        self.assertEqual(self.github.effects, [])

    def test_invalid_inputs_never_change_candidate(self):
        for kwargs in ({"requested_revision": "123"}, {"requested_revision": "f" * 40},
                       {"requested_version": "v2.26.0\nmode=reuse"}, {"component": "worker"}):
            with self.subTest(kwargs=kwargs), self.assertRaises((release.ReleaseError, KeyError)):
                self.controller.prepare(**kwargs)
        self.assertEqual(self.github.effects, [])

    def test_rollback_uses_archive_without_reading_github(self):
        self.github.fail("ref:" + release.CANDIDATE_REF)
        result = self.controller.prepare("bootstrap-20261116", rollback=True)
        self.assertEqual(result, {"mode": "rollback", "version": "bootstrap-20261116", "revision": WORKFLOW})
        self.assertEqual(self.github.calls, [])

    def test_rollback_requires_manual_whole_release_and_no_reselection(self):
        cases = [("", "", "both", "workflow_dispatch"), ("../old", "", "both", "workflow_dispatch"),
                 ("v2.26.0", S1, "both", "workflow_dispatch"), ("v2.26.0", "", "api", "workflow_dispatch"),
                 ("v2.26.0", "", "both", "push")]
        for target, sha, component, event in cases:
            self.env["GITHUB_EVENT_NAME"] = event
            with self.subTest(case=(target, sha, component, event)), self.assertRaises(release.ReleaseError):
                self.controller.prepare(target, sha, True, component)
        self.assertEqual(self.github.calls, [])

    def test_legacy_release_requires_explicit_version_and_keeps_tag(self):
        self.github.install_release(manifest=False)
        self.git.main = S1
        self.git.head = S1
        with self.assertRaisesRegex(release.ReleaseError, "明确 version"):
            self.controller.prepare()
        result = self.controller.prepare("2.26.0")
        self.assertEqual(result, {"mode": "candidate", "version": "v2.26.0", "revision": S1})
        self.assertEqual(self.publish()["status"], "published")
        self.assertEqual(self.github.refs["tags/v2.26.0"], S1)
        self.assertNotIn("create_release", [effect[0] for effect in self.github.effects])
        self.assertNotIn("publish_release", [effect[0] for effect in self.github.effects])

    def test_explicit_old_version_uses_tag_not_newer_main(self):
        self.github.install_release(target="v2.25.1", sha=BASE, manifest=False)
        result = self.controller.prepare("v2.25.1")
        self.assertEqual(result["revision"], BASE)
        self.assertEqual(self.git.main, S2)

    def test_legacy_takeover_cannot_displace_another_pending_version(self):
        self.freeze()
        self.github.install_release(target="v2.25.1", sha=BASE, manifest=False)
        with self.assertRaisesRegex(release.ReleaseError, "不能挤占"):
            self.controller.prepare("v2.25.1")
        self.assertEqual(self.github.refs[release.CANDIDATE_REF], S1)
        self.assertEqual(self.github.effects, [])

    def test_existing_tag_or_immutable_draft_prevents_reselection(self):
        for has_tag in (True, False):
            with self.subTest(tag=has_tag):
                self.github.install_release(draft=True, tag=has_tag)
                self.freeze()
                with self.assertRaises(release.ReleaseError):
                    self.controller.prepare("v2.26.0", S2)
                self.assertEqual(self.github.refs[release.CANDIDATE_REF], S1)
        self.assertEqual(self.github.effects, [])

    def test_reuse_keeps_original_digest_and_cleans_recovery_state(self):
        self.freeze()
        self.github.install_release()
        result = self.controller.prepare("v2.26.0")
        self.assertEqual(result["mode"], "reuse")
        self.assertEqual(json.loads(result["manifest"]), evidence())
        self.assertNotIn(release.CANDIDATE_REF, self.github.refs)
        self.assertIn(S1, self.github.tagged)

    def test_reusing_old_release_does_not_clear_newer_candidate(self):
        self.github.install_release(target="v2.25.1", sha=BASE)
        self.freeze()
        result = self.controller.prepare("v2.25.1")
        self.assertEqual(result["mode"], "reuse")
        self.assertEqual(self.github.refs[release.CANDIDATE_REF], S1)

    def test_reuse_refuses_different_explicit_revision(self):
        self.github.install_release()
        with self.assertRaisesRegex(release.ReleaseError, "tag 指向其他"):
            self.controller.prepare("v2.26.0", S2)
        self.assertEqual(self.github.effects, [])

    def test_maintenance_waits_for_public_release_tag_and_verified_manifest(self):
        self.git.head = S1
        self.assertEqual(self.controller.maintenance(), {"maintain": "false"})
        self.github.refs["tags/v2.26.0"] = S1
        self.assertEqual(self.controller.maintenance(), {"maintain": "false"})
        self.github.install_release(draft=True, manifest=False)
        self.assertEqual(self.controller.maintenance(), {"maintain": "false"})
        self.github.releases["v2.26.0"]["draft"] = False
        self.assertEqual(self.controller.maintenance(), {"maintain": "false"})
        self.github.install_release()
        self.assertEqual(self.controller.maintenance(), {"maintain": "true"})
        self.assertEqual(self.github.effects, [])

    def test_github_read_failures_are_never_interpreted_as_absent(self):
        for operation in ("ref:" + release.CANDIDATE_REF, "ref:tags/v2.26.0", "release", "assets", "read_asset"):
            for status in (403, 500):
                with self.subTest(operation=operation, status=status):
                    github = MemoryGitHub()
                    github.install_release()
                    github.fail(operation, status=status)
                    controller = release.Coordinator(self.git, github, self.env)
                    with self.assertRaises(release.APIError):
                        controller.prepare("v2.26.0")
                    self.assertEqual(github.effects, [])

    def test_each_full_gate_must_explicitly_succeed(self):
        self.freeze()
        for key in ("VALIDATE_RESULT", "BUILD_API_RESULT", "BUILD_WEB_RESULT"):
            for value in (None, "failed", "failure", "skipped", "cancelled", ""):
                with self.subTest(key=key, value=value):
                    self.env[key] = value
                    with self.assertRaisesRegex(release.ReleaseError, key):
                        self.publish()
                    self.env[key] = "success"
        self.assertEqual(self.github.effects, [])
        self.assertEqual(self.github.calls, [])

    def test_malformed_publish_evidence_fails_before_external_effects(self):
        self.freeze()
        cases = [("GITHUB_RUN_ID", "0"), ("GITHUB_RUN_ID", "-1"), ("GITHUB_RUN_ID", "1.2"),
                 ("GITHUB_RUN_ATTEMPT", None), ("GITHUB_RUN_ATTEMPT", "01"), ("GITHUB_SHA", S1)]
        for key, value in cases:
            old = self.env[key]
            self.env[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(release.ReleaseError):
                self.publish()
            self.env[key] = old
        self.assertEqual(self.github.effects, [])
        self.assertEqual(self.github.calls, [])

    def test_invalid_digests_and_workflow_sha_do_not_publish(self):
        self.freeze()
        for digest in ("latest", "sha256:" + "f" * 63, "SHA256:" + "f" * 64, "ghcr.io/other/api@" + API_DIGEST):
            with self.subTest(digest=digest), self.assertRaises(release.ReleaseError):
                self.publish(api_digest=digest)
        with self.assertRaises(release.ReleaseError):
            self.publish(workflow="abc")
        self.assertEqual(self.github.effects, [])

    def test_publish_requires_version_bound_to_candidate(self):
        self.freeze()
        with self.assertRaisesRegex(release.ReleaseError, "manifest 版本"):
            self.publish(target="v2.27.0")
        self.assertEqual(self.github.effects, [])

    def test_missing_or_replaced_pointer_cannot_create_release(self):
        self.assertEqual(self.publish(), {"status": "superseded"})
        self.freeze(S2)
        self.assertEqual(self.publish(), {"status": "superseded"})
        self.assertEqual(self.github.effects, [])

    def test_success_publishes_manifest_before_release_and_uses_target_notes(self):
        self.freeze()
        self.git.notes[S2] = "main notes must not leak"
        result = self.publish()
        self.assertEqual(result["status"], "published")
        self.assertEqual(json.loads(result["manifest"]), evidence())
        operations = [effect[0] for effect in self.github.effects]
        self.assertLess(operations.index("upload_asset"), operations.index("publish_release"))
        self.assertIn("1111", self.github.releases["v2.26.0"]["body"])
        self.assertNotIn("main notes", self.github.releases["v2.26.0"]["body"])
        self.assertEqual(self.git.reads, [(S1, "CHANGELOG.md")])
        self.assertNotIn(release.CANDIDATE_REF, self.github.refs)

    def test_missing_duplicate_or_empty_notes_leave_no_release_or_tag(self):
        self.freeze()
        for notes in ("## 2.25.1\n\nOld", "## 2.26.0\n\n", "## 2.26.0\n\nOne\n\n## [2.26.0](url)\n\nTwo"):
            self.git.notes[S1] = notes
            with self.subTest(notes=notes), self.assertRaises(release.ReleaseError):
                self.publish()
        self.assertEqual(self.github.effects, [])
        self.assertEqual(self.github.releases, {})
        self.assertNotIn("tags/v2.26.0", self.github.refs)

    def test_conflicting_existing_tag_cannot_publish(self):
        self.freeze()
        self.github.refs["tags/v2.26.0"] = S2
        with self.assertRaisesRegex(release.ReleaseError, "tag 与"):
            self.publish()
        self.assertEqual(self.github.effects, [])

    def test_wrong_draft_target_cannot_publish(self):
        self.freeze()
        self.github.install_release(sha=S2, draft=True, manifest=False, tag=False)
        with self.assertRaisesRegex(release.ReleaseError, "draft Release"):
            self.publish()
        self.assertEqual(self.github.effects, [])

    def test_creation_failure_before_or_after_commit_is_recoverable(self):
        for after in (False, True):
            with self.subTest(after=after):
                self.setUp()
                self.freeze()
                self.github.fail("create_release", after=after)
                with self.assertRaises(release.APIError):
                    self.publish()
                self.assertNotIn("tags/v2.26.0", self.github.refs)
                self.assertEqual(self.publish()["status"], "published")
                self.assertEqual([effect[0] for effect in self.github.effects].count("create_release"), 1)

    def test_upload_failure_preserves_draft_and_resumes(self):
        self.freeze()
        self.github.fail("upload_asset")
        with self.assertRaises(release.APIError):
            self.publish()
        self.assertTrue(self.github.releases["v2.26.0"]["draft"])
        self.assertNotIn("tags/v2.26.0", self.github.refs)
        self.assertEqual(self.publish()["status"], "published")
        self.assertEqual([effect[0] for effect in self.github.effects].count("create_release"), 1)

    def test_upload_timeout_after_commit_reuses_original_manifest(self):
        self.freeze()
        self.github.fail("upload_asset", after=True)
        with self.assertRaises(release.APIError):
            self.publish()
        result = self.publish(api_digest=NEXT_DIGEST, web_digest=NEXT_DIGEST)
        self.assertEqual(json.loads(result["manifest"]), evidence())
        self.assertEqual([effect[0] for effect in self.github.effects].count("upload_asset"), 1)

    def test_starter_asset_from_interrupted_upload_is_replaced(self):
        self.freeze()
        self.github.install_release(draft=True, manifest=False, tag=False)
        self.github.releases["v2.26.0"]["assets"] = [
            {"id": 20, "name": release.ASSET_NAME, "state": "starter", "size": 0}
        ]
        self.assertEqual(self.publish()["status"], "published")
        operations = [effect[0] for effect in self.github.effects]
        self.assertLess(operations.index("delete_asset"), operations.index("upload_asset"))

    def test_unknown_or_nonempty_partial_asset_is_not_deleted(self):
        self.freeze()
        self.github.install_release(draft=True, manifest=False, tag=False)
        for state, size in (("open", 0), ("starter", 100), (None, 0)):
            self.github.releases["v2.26.0"]["assets"] = [
                {"id": 20, "name": release.ASSET_NAME, "state": state, "size": size}
            ]
            with self.subTest(state=state, size=size), self.assertRaises(release.ReleaseError):
                self.publish()
        self.assertEqual(self.github.effects, [])

    def test_completed_draft_reuses_existing_manifest(self):
        self.freeze()
        self.github.install_release(draft=True, tag=False)
        result = self.publish(api_digest=NEXT_DIGEST, web_digest=NEXT_DIGEST)
        self.assertEqual(json.loads(result["manifest"]), evidence())
        self.assertNotIn("upload_asset", [effect[0] for effect in self.github.effects])

    def test_publish_timeout_before_or_after_commit_resumes_same_version(self):
        for after in (False, True):
            with self.subTest(after=after):
                self.setUp()
                self.freeze()
                self.github.fail("publish_release", after=after)
                with self.assertRaises(release.APIError):
                    self.publish()
                result = self.publish(api_digest=NEXT_DIGEST, web_digest=NEXT_DIGEST)
                self.assertEqual(json.loads(result["manifest"]), evidence())
                self.assertEqual([effect[0] for effect in self.github.effects].count("publish_release"), 1)

    def test_publication_requires_actual_tag_after_api_success(self):
        self.freeze()
        original = self.github.publish_release

        def publish_without_tag(value):
            result = original(value)
            self.github.refs.pop("tags/v2.26.0")
            return result

        self.github.publish_release = publish_without_tag
        with self.assertRaisesRegex(release.ReleaseError, "缺少真实 tag"):
            self.publish()
        self.assertEqual(self.github.refs[release.CANDIDATE_REF], S1)

    def test_pr_label_failure_is_completed_by_prepare_reuse(self):
        self.freeze()
        self.github.fail("close_release_pr")
        with self.assertRaises(release.APIError):
            self.publish()
        self.assertFalse(self.github.releases["v2.26.0"]["draft"])
        self.assertEqual(self.github.refs[release.CANDIDATE_REF], S1)
        self.assertEqual(self.controller.prepare("v2.26.0")["mode"], "reuse")
        self.assertIn(S1, self.github.tagged)
        self.assertNotIn(release.CANDIDATE_REF, self.github.refs)

    def test_candidate_cleanup_failure_is_recoverable(self):
        self.freeze()
        self.github.fail("clear_candidate")
        with self.assertRaises(release.APIError):
            self.publish()
        self.assertEqual(self.controller.prepare("v2.26.0")["mode"], "reuse")
        self.assertNotIn(release.CANDIDATE_REF, self.github.refs)
        self.assertEqual([effect[0] for effect in self.github.effects].count("publish_release"), 1)

    def test_publish_repeated_after_cleanup_is_idempotent(self):
        self.freeze()
        first = self.publish()
        effects = copy.deepcopy(self.github.effects)
        self.env.update(GITHUB_RUN_ID="456", GITHUB_RUN_ATTEMPT="2")
        second = self.publish(api_digest=NEXT_DIGEST, web_digest=NEXT_DIGEST)
        self.assertEqual(first, second)
        self.assertEqual(self.github.effects, effects)

    def test_reselected_descendant_closes_original_release_pr(self):
        self.freeze()
        self.controller.prepare("v2.26.0", S2)
        self.assertEqual(self.publish(sha=S2)["status"], "published")
        self.assertIn(S1, self.github.tagged)
        self.assertNotIn(S1, self.github.pending)

    def test_new_candidate_is_preserved_if_pointer_changes_during_cleanup(self):
        self.freeze()
        original = self.github.close_release_pr

        def finish_with_new_candidate(sha):
            original(sha)
            self.github.refs[release.CANDIDATE_REF] = S3

        self.github.close_release_pr = finish_with_new_candidate
        self.assertEqual(self.publish()["status"], "published")
        self.assertEqual(self.github.refs[release.CANDIDATE_REF], S3)

    def test_pointer_changed_during_upload_prevents_publication(self):
        self.freeze()
        original = self.github.upload_asset

        def upload_with_reselection(value, manifest):
            original(value, manifest)
            self.github.refs[release.CANDIDATE_REF] = S2

        self.github.upload_asset = upload_with_reselection
        self.assertEqual(self.publish()["status"], "superseded")
        self.assertTrue(self.github.releases["v2.26.0"]["draft"])
        self.assertNotIn("tags/v2.26.0", self.github.refs)

    def test_existing_manifest_must_validate_all_identity_and_evidence(self):
        self.freeze()
        self.github.install_release()
        broken = []
        for key, value in (("version", "v2.25.1"), ("revision", S2),
                           ("api_image", "ghcr.io/attacker/api@" + API_DIGEST),
                           ("web_image", "ghcr.io/vod-studio/violet-web:latest")):
            manifest = evidence()
            manifest[key] = value
            broken.append(manifest)
        for key, value in (("full", False), ("run_id", "123"), ("run_attempt", 0),
                           ("run_id", True), ("workflow_revision", "abc")):
            manifest = evidence()
            manifest["verification"][key] = value
            broken.append(manifest)
        broken.extend([None, {}, {**evidence(), "verification": None}])
        for manifest in broken:
            self.github.releases["v2.26.0"]["assets"][0]["body"] = release.compact(manifest)
            with self.subTest(manifest=manifest), self.assertRaises(release.ReleaseError):
                self.publish()
        self.assertEqual(self.github.effects, [])

    def test_corrupt_or_duplicate_manifest_is_never_overwritten(self):
        self.freeze()
        self.github.install_release(draft=True, tag=False)
        asset = self.github.releases["v2.26.0"]["assets"][0]
        asset["body"] = "{broken"
        with self.assertRaisesRegex(release.ReleaseError, "禁止覆盖"):
            self.publish()
        asset["body"] = release.compact(evidence())
        self.github.releases["v2.26.0"]["assets"].append(copy.deepcopy(asset))
        with self.assertRaisesRegex(release.ReleaseError, "重复发布清单"):
            self.publish()
        self.assertEqual(self.github.effects, [])

    def test_prepare_cli_writes_exact_single_line_outputs(self):
        self.freeze()
        with tempfile.TemporaryDirectory() as folder:
            self.env["GITHUB_OUTPUT"] = str(Path(folder) / "outputs")
            with contextlib.redirect_stdout(io.StringIO()):
                status = release.main(["prepare", "--version", "", "--revision", "", "--rollback", "", "--component", "both"],
                                      git=self.git, github=self.github, env=self.env)
            self.assertEqual(status, 0)
            self.assertEqual(Path(self.env["GITHUB_OUTPUT"]).read_text(),
                             f"mode=candidate\nversion=v2.26.0\nrevision={S1}\n")

    def test_publish_cli_outputs_compact_manifest_and_appends(self):
        self.freeze()
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "outputs"
            output.write_text("prior=value\n")
            self.env["GITHUB_OUTPUT"] = str(output)
            args = ["publish", "--version", "v2.26.0", "--revision", S1,
                    "--api-digest", API_DIGEST, "--web-digest", WEB_DIGEST, "--workflow-revision", WORKFLOW]
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(release.main(args, git=self.git, github=self.github, env=self.env), 0)
            self.assertEqual(output.read_text(), f"prior=value\nstatus=published\nmanifest={release.compact(evidence())}\n")

    def test_failed_cli_emits_no_outputs_and_returns_nonzero(self):
        self.env["VALIDATE_RESULT"] = "failure"
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "outputs"
            self.env["GITHUB_OUTPUT"] = str(output)
            args = ["publish", "--version", "v2.26.0", "--revision", S1,
                    "--api-digest", API_DIGEST, "--web-digest", WEB_DIGEST, "--workflow-revision", WORKFLOW]
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(release.main(args, git=self.git, github=self.github, env=self.env), 1)
            self.assertFalse(output.exists())
        self.assertEqual(self.github.effects, [])

    def test_out_of_order_release_push_preserves_reselected_descendant(self):
        self.freeze(S2)
        self.env.update(GITHUB_EVENT_NAME="push", GITHUB_SHA=S1)
        self.assertEqual(self.controller.prepare(), {"mode": "skip", "version": "v2.26.0", "revision": S2})
        self.assertEqual(self.github.effects, [])

    def test_all_remaining_cli_output_modes(self):
        for mode in ("reuse", "rollback", "skip", "maintenance", "superseded"):
            with self.subTest(mode=mode):
                self.setUp()
                if mode == "reuse":
                    self.github.install_release()
                    args = ["prepare", "--version", "2.26.0"]
                    expected = f"mode=reuse\nversion=v2.26.0\nrevision={S1}\nmanifest={release.compact(evidence())}\n"
                elif mode == "rollback":
                    args = ["prepare", "--version", "bootstrap-20261116", "--rollback", "true"]
                    expected = f"mode=rollback\nversion=bootstrap-20261116\nrevision={WORKFLOW}\n"
                elif mode == "skip":
                    self.env.update(GITHUB_EVENT_NAME="push", GITHUB_SHA=S2)
                    args = ["prepare"]
                    expected = f"mode=skip\nversion=v2.26.0\nrevision={S2}\n"
                elif mode == "maintenance":
                    args = ["maintenance"]
                    expected = "maintain=false\n"
                else:
                    args = ["publish", "--version", "v2.26.0", "--revision", S1,
                            "--api-digest", API_DIGEST, "--web-digest", WEB_DIGEST, "--workflow-revision", WORKFLOW]
                    expected = "status=superseded\n"
                with tempfile.TemporaryDirectory() as folder:
                    output = Path(folder) / "outputs"
                    self.env["GITHUB_OUTPUT"] = str(output)
                    with contextlib.redirect_stdout(io.StringIO()):
                        self.assertEqual(release.main(args, git=self.git, github=self.github, env=self.env), 0)
                    self.assertEqual(output.read_text(), expected)

    def test_uploaded_asset_must_be_read_back_before_publication(self):
        self.freeze()
        self.github.fail("read_asset")
        with self.assertRaises(release.APIError):
            self.publish()
        self.assertTrue(self.github.releases["v2.26.0"]["draft"])
        self.assertNotIn("tags/v2.26.0", self.github.refs)
        self.assertEqual(self.publish()["status"], "published")

    def test_tag_change_before_publication_does_not_move_it(self):
        self.freeze()
        original = self.github.upload_asset

        def upload_with_changed_tag(value, manifest):
            original(value, manifest)
            self.github.refs["tags/v2.26.0"] = S2

        self.github.upload_asset = upload_with_changed_tag
        with self.assertRaises(release.ReleaseError):
            self.publish()
        self.assertEqual(self.github.refs["tags/v2.26.0"], S2)
        self.assertTrue(self.github.releases["v2.26.0"]["draft"])

    def test_unexpected_event_and_push_target_override_are_rejected(self):
        self.env["GITHUB_EVENT_NAME"] = "pull_request"
        with self.assertRaises(release.ReleaseError):
            self.controller.prepare()
        self.env.update(GITHUB_EVENT_NAME="push", GITHUB_SHA=S1)
        with self.assertRaises(release.ReleaseError):
            self.controller.prepare("v2.26.0")
        with self.assertRaises(release.ReleaseError):
            self.controller.prepare(requested_revision=S1)
        self.assertEqual(self.github.calls, [])


class ScriptedRunner:
    def __init__(self, *results):
        self.results = list(results)
        self.calls = []

    def __call__(self, args, **kwargs):
        self.calls.append((args, kwargs))
        if not self.results:
            raise AssertionError(f"unexpected command: {args}")
        value = self.results.pop(0)
        if isinstance(value, Exception):
            raise value
        code, stdout, stderr = value
        if kwargs.get("check") and code:
            raise subprocess.CalledProcessError(code, args, stdout, stderr)
        return subprocess.CompletedProcess(args, code, stdout, stderr)


def response(value):
    return (0, json.dumps(value), "")


def ref_response(name, sha, kind="commit"):
    return response({"ref": "refs/" + name, "object": {"sha": sha, "type": kind}})


class GitHubAdapterTests(unittest.TestCase):
    def adapter(self, *results):
        runner = ScriptedRunner(*results)
        return release.GitHub("VOD-Studio/violet", runner), runner

    def test_only_explicit_http_404_means_missing(self):
        github, _ = self.adapter((1, "", "gh: Not Found (HTTP 404)"))
        self.assertIsNone(github.ref(release.CANDIDATE_REF))
        for message, status in (("gh: Forbidden (HTTP 403)", 403), ("gh: Server Error (HTTP 500)", 500),
                                ("connection reset: not found", None), ("gh: HTTP 404 maybe", None)):
            github, _ = self.adapter((1, "", message))
            with self.subTest(message=message), self.assertRaises(release.APIError) as caught:
                github.ref(release.CANDIDATE_REF)
            self.assertEqual(caught.exception.status, status)

    def test_null_empty_or_wrong_success_payload_does_not_mean_missing(self):
        for value in (None, [], "", 0):
            github, _ = self.adapter(response(value))
            with self.subTest(value=value), self.assertRaises(release.ReleaseError):
                github.ref(release.CANDIDATE_REF)
        github, _ = self.adapter((0, "", ""))
        with self.assertRaises(release.ReleaseError):
            github.ref(release.CANDIDATE_REF)

    def test_annotated_tags_are_peeled_to_commit(self):
        github, runner = self.adapter(ref_response("tags/v2.26.0", S3, "tag"),
                                      response({"object": {"type": "tag", "sha": S2}}),
                                      response({"object": {"type": "commit", "sha": S1}}))
        self.assertEqual(github.ref("tags/v2.26.0"), S1)
        self.assertEqual(len(runner.calls), 3)

    def test_wrong_ref_noncommit_or_cyclic_tag_is_rejected(self):
        responses = [(ref_response("tags/v2.26.00", S1),),
                     (ref_response("tags/v2.26.0", S1, "tree"),),
                     (ref_response("tags/v2.26.0", S1, "tag"), response({"object": {"type": "tag", "sha": S1}}))]
        for values in responses:
            github, _ = self.adapter(*values)
            with self.subTest(values=values), self.assertRaises(release.ReleaseError):
                github.ref("tags/v2.26.0")

    def test_published_lookup_does_not_list_drafts(self):
        item = {"tag_name": "v2.26.0", "draft": False}
        github, runner = self.adapter(response(item))
        self.assertEqual(github.release("v2.26.0"), item)
        self.assertEqual(len(runner.calls), 1)

    def test_draft_recovery_searches_all_pages_after_by_tag_404(self):
        filler = [{"tag_name": f"v0.0.{index}", "draft": False} for index in range(100)]
        draft = {"tag_name": "v2.26.0", "draft": True}
        github, runner = self.adapter((1, "", "gh: Not Found (HTTP 404)"), response(filler), response([draft]))
        self.assertEqual(github.release("v2.26.0"), draft)
        self.assertIn("page=2", runner.calls[-1][0][4])

    def test_lookup_network_error_or_denied_draft_listing_fails_closed(self):
        for results in (((1, "", "gh: Forbidden (HTTP 403)"),),
                        ((1, "", "gh: Not Found (HTTP 404)"), (1, "", "gh: Forbidden (HTTP 403)"))):
            github, _ = self.adapter(*results)
            with self.subTest(results=results), self.assertRaises(release.APIError):
                github.release("v2.26.0")

    def test_duplicate_drafts_cannot_be_chosen(self):
        item = {"tag_name": "v2.26.0", "draft": True}
        github, _ = self.adapter((1, "", "gh: Not Found (HTTP 404)"), response([item, item]))
        with self.assertRaises(release.ReleaseError):
            github.release("v2.26.0")

    def test_writes_preserve_json_types_and_never_swallow_404(self):
        github, runner = self.adapter(response({"id": 1}))
        github.create_release("v2.26.0", S1, "用户改写\n第二行")
        command, kwargs = runner.calls[0]
        body = json.loads(kwargs["input"])
        self.assertIs(body["draft"], True)
        self.assertIs(body["generate_release_notes"], False)
        self.assertEqual(body["body"], "用户改写\n第二行")
        self.assertIn("--input", command)
        github, _ = self.adapter((1, "", "gh: Not Found (HTTP 404)"))
        with self.assertRaises(release.APIError):
            github.create_release("v2.26.0", S1, "notes")

    def test_upload_uses_hypermedia_url_and_raw_compact_body(self):
        github, runner = self.adapter(response({"id": 10}))
        value = {"id": 1, "upload_url": "https://uploads.github.com/repos/VOD-Studio/violet/releases/1/assets{?name,label}"}
        github.upload_asset(value, evidence())
        command, kwargs = runner.calls[0]
        self.assertEqual(command[4], "https://uploads.github.com/repos/VOD-Studio/violet/releases/1/assets?name=release-manifest.json")
        self.assertEqual(kwargs["input"], release.compact(evidence()))
        self.assertIn("Content-Type: application/json", command)

    def test_gh_upload_sends_a_known_utf8_body_length(self):
        received = {}

        class UploadHandler(BaseHTTPRequestHandler):
            def do_POST(self):
                self.connection.settimeout(2)
                received["headers"] = dict(self.headers)
                length = self.headers.get("Content-Length")
                if length is None or self.headers.get("Transfer-Encoding"):
                    self.send_error(411, "Content-Length required")
                    return
                received["body"] = self.rfile.read(int(length))
                self.send_response(201)
                self.end_headers()
                self.wfile.write(b'{"id":10}')

            def log_message(self, *_):
                pass

        def runner(command, **kwargs):
            return subprocess.run(
                command, **kwargs, timeout=10,
                env={**os.environ, "GH_TOKEN": "local-contract", "GH_PROMPT_DISABLED": "1",
                     "NO_PROXY": "127.0.0.1"},
            )

        with ThreadingHTTPServer(("127.0.0.1", 0), UploadHandler) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                github = release.GitHub("VOD-Studio/violet", runner)
                result = github.request(
                    "POST", f"http://127.0.0.1:{server.server_port}/assets",
                    {"message": "中文清单"},
                )
            finally:
                server.shutdown()
                thread.join()
        self.assertEqual(result, {"id": 10})
        self.assertEqual(received["headers"]["Content-Length"], "26")
        self.assertNotIn("Transfer-Encoding", received["headers"])
        self.assertEqual(received["body"], '{"message":"中文清单"}'.encode("utf-8"))

    def test_upload_rejects_untrusted_urls_before_invoking_gh(self):
        for url in ("https://evil.test/upload", "https://uploads.github.com/repos/elsewhere/violet/releases/1/assets", "http://uploads.github.com/repos/VOD-Studio/violet/releases/1/assets"):
            github, runner = self.adapter()
            with self.subTest(url=url), self.assertRaises(release.ReleaseError):
                github.upload_asset({"id": 1, "upload_url": url}, evidence())
            self.assertEqual(runner.calls, [])

    def test_asset_download_uses_binary_accept_and_does_not_hide_404(self):
        body = release.compact(evidence())
        github, runner = self.adapter((0, body, ""))
        self.assertEqual(github.read_asset({"id": 10}), body)
        self.assertIn("Accept: application/octet-stream", runner.calls[0][0])
        github, _ = self.adapter((1, "", "gh: Not Found (HTTP 404)"))
        with self.assertRaises(release.APIError):
            github.read_asset({"id": 10})

    def test_candidate_update_checks_previous_value_before_writing(self):
        github, runner = self.adapter(ref_response(release.CANDIDATE_REF, S2))
        with self.assertRaises(release.ReleaseError):
            github.set_candidate(S3, S1)
        self.assertEqual(len(runner.calls), 1)
        github, runner = self.adapter(ref_response(release.CANDIDATE_REF, S1), response({"ref": release.CANDIDATE_REF}))
        github.set_candidate(S2, S1)
        self.assertEqual(json.loads(runner.calls[1][1]["input"]), {"sha": S2, "force": True})

    def test_candidate_clear_preserves_new_pointer_and_propagates_delete_error(self):
        github, runner = self.adapter(ref_response(release.CANDIDATE_REF, S2))
        github.clear_candidate(S1)
        self.assertEqual(len(runner.calls), 1)
        github, _ = self.adapter(ref_response(release.CANDIDATE_REF, S1), (1, "", "gh: Forbidden (HTTP 403)"))
        with self.assertRaises(release.APIError):
            github.clear_candidate(S1)

    def test_release_pr_labels_only_close_exact_merged_release_commit(self):
        eligible = {"number": 123, "merged_at": "2026-11-16T00:00:00Z",
                    "base": {"ref": "release/2.0"}, "labels": [{"name": "autorelease: pending"}]}
        open_pr = {**eligible, "number": 124, "merged_at": None}
        other_merge = {**eligible, "number": 125}
        other_branch = {**eligible, "number": 126, "base": {"ref": "feature"}}
        already_tagged = {**eligible, "number": 127, "labels": [{"name": "autorelease: tagged"}]}
        detail = {**eligible, "merged": True, "merge_commit_sha": S1}
        github, runner = self.adapter(response([open_pr, other_merge, other_branch, already_tagged, eligible]),
                                      response({**detail, "merge_commit_sha": S2}), response(detail), response([]), (0, "", ""))
        github.close_release_pr(S1)
        self.assertEqual(len(runner.calls), 5)
        self.assertEqual(runner.calls[3][0][4], "repos/VOD-Studio/violet/issues/123/labels")
        self.assertEqual(json.loads(runner.calls[3][1]["input"]), {"labels": ["autorelease: tagged"]})
        self.assertEqual(runner.calls[4][0][4], "repos/VOD-Studio/violet/issues/123/labels/autorelease%3A%20pending")

    def test_label_failure_never_removes_pending_before_tagged_is_added(self):
        pull = {"number": 123, "merged_at": "2026-11-16", "merge_commit_sha": S1,
                "base": {"ref": "release/2.0"}, "labels": [{"name": "autorelease: pending"}]}
        detail = {**pull, "merged": True}
        github, runner = self.adapter(response([pull]), response(detail), (1, "", "gh: Server Error (HTTP 500)"))
        with self.assertRaises(release.APIError):
            github.close_release_pr(S1)
        self.assertEqual(len(runner.calls), 3)
        pull["labels"].append({"name": "autorelease: tagged"})
        detail["labels"] = pull["labels"]
        github, runner = self.adapter(response([pull]), response(detail), (0, "", ""))
        github.close_release_pr(S1)
        self.assertEqual(runner.calls[2][0][3], "DELETE")


class GitAdapterTests(unittest.TestCase):
    def test_first_parent_comes_from_commit_parent_list(self):
        runner = ScriptedRunner((0, f"{S2} {S1} {OTHER}\n", ""))
        self.assertEqual(release.Git(runner=runner).parent(S2), S1)

    def test_git_failures_do_not_turn_into_nonancestor(self):
        runner = ScriptedRunner((128, "", "fatal: bad object"))
        with self.assertRaises(release.ReleaseError):
            release.Git(runner=runner).ancestor(S1, S2)
        for status, expected in ((0, True), (1, False)):
            runner = ScriptedRunner((status, "", ""))
            self.assertEqual(release.Git(runner=runner).ancestor(S1, S2), expected)

    def test_release_commit_is_resolved_at_selected_revision(self):
        runner = ScriptedRunner((0, S1 + "\n", ""))
        self.assertEqual(release.Git(runner=runner).release_commit(S2), S1)
        self.assertEqual(runner.calls[0][0], ["git", "log", "--first-parent", "-1", "--format=%H", S2, "--", release.MANIFEST_PATH])

    def test_manifest_version_uses_exact_revision_and_normalizes_tag(self):
        runner = ScriptedRunner(response({".": "2.26.0"}))
        self.assertEqual(release.Git(runner=runner).version(S1), "v2.26.0")
        self.assertEqual(runner.calls[0][0], ["git", "show", S1 + ":" + release.MANIFEST_PATH])

    def test_resolution_peels_commit_and_rejects_short_result(self):
        runner = ScriptedRunner((0, S1 + "\n", ""))
        self.assertEqual(release.Git(runner=runner).resolve(release.MAIN_REF), S1)
        runner = ScriptedRunner((0, "123\n", ""))
        with self.assertRaises(release.ReleaseError):
            release.Git(runner=runner).resolve(release.MAIN_REF)


if __name__ == "__main__":
    unittest.main()
