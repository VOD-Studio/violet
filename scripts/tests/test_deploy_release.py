"""Exercise transaction failures without a daemon or production network."""

import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("deploy_release", Path(__file__).parents[1] / "deploy-release.py")
DEPLOY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DEPLOY)
OLD_REVISION = "a" * 40
NEW_REVISION = "b" * 40


def digest(component, char):
    return f"ghcr.io/vod-studio/violet-{component}@sha256:{char * 64}"


class FakeDeployment(DEPLOY.Deployment):
    def __init__(self, args):
        super().__init__(args)
        self.live = {"api": "sha256:" + "1" * 64, "web": "sha256:" + "2" * 64}
        self.commands = []
        self.up_count = 0
        self.migrate_count = 0
        self.fail_migration = False
        self.fail_switch = False
        self.fail_verify = False
        self.wrong_image = False
        self.fail_reload = False
        self.superseded = False
        self.schema_version = 10
        self.outputs = []
        self.stopped = set()
        self.source_revision = None
        self.dirty_source = False

    def actual_image(self, component, require_running=True):
        if require_running and component in self.stopped:
            raise DEPLOY.DeployError(f"Existing {component} container is not running")
        return self.live[component]

    def inspect_image(self, name):
        return "sha256:" + name.rsplit("sha256:", 1)[-1]

    def schema(self):
        return self.schema_version

    def output(self, status):
        self.outputs.append(status)

    def run(self, command, **kwargs):
        self.commands.append(command)
        if command[:3] == ["git", "rev-parse", "--verify"]:
            revision = (self.source_revision or json.loads(self.args.manifest.read_text())["revision"]) if command[-1] == "HEAD" else OLD_REVISION
            return subprocess.CompletedProcess(command, 0, revision + "\n", "")
        if command[:3] == ["git", "diff", "--quiet"]:
            return subprocess.CompletedProcess(command, int(self.dirty_source), "", "")
        if command[:3] == ["git", "merge-base", "--is-ancestor"]:
            code = 0 if self.superseded or command[3] == OLD_REVISION else 1
            return subprocess.CompletedProcess(command, code, "", "")
        if command[:2] == ["docker", "cp"]:
            if ":/app/migrations/" in command[2]:
                (Path(command[-1]) / "11_new.up.sql").write_text("SELECT 1;")
            else:
                target = Path(command[-1]) / "assets"
                target.mkdir()
                (target / "new-hash.js").write_text("javascript")
        return subprocess.CompletedProcess(command, 0, "", "")

    def compose(self, manifest, *arguments, **kwargs):
        self.commands.append(["compose", *arguments])
        if arguments[0] == "run":
            self.migrate_count += 1
            if self.fail_migration:
                raise DEPLOY.DeployError("migration failure")
            self.schema_version = max(self.schema_version, 11)
        if arguments[0] == "up":
            self.stopped.clear()
            self.up_count += 1
            self.live["api"] = self.inspect_image(manifest["api_image"])
            if self.fail_switch and self.up_count == 1:
                raise DEPLOY.DeployError("web switch failure after API succeeded")
            if not self.wrong_image or self.up_count > 1:
                self.live["web"] = self.inspect_image(manifest["web_image"])

    def reload_nginx(self):
        if self.fail_reload and self.up_count == 1:
            raise DEPLOY.DeployError("nginx reload failed")

    def fetch(self, url):
        if self.fail_verify and self.up_count == 1:
            raise OSError("public ingress failure")
        if url.endswith("api/health"):
            return b'{"status":"ok"}', "application/json"
        if url.endswith("api/v1/posts/"):
            return b'{"data":[],"meta":{"pagination":{"limit":20}}}', "application/json"
        if url.endswith(".js"):
            return b"javascript", "application/javascript"
        return b'<html><title>violet</title><script src="/assets/new-hash.js"></script></html>', "text/html"


class Transactions(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.production = self.root / "production"
        self.source = self.root / "source"
        self.production.mkdir()
        (self.source / "deploy/nginx").mkdir(parents=True)
        (self.source / "deploy/nginx/xunrua.top").write_text("new nginx")
        for filename in DEPLOY.COMPOSE_FILES:
            (self.production / filename).write_text("old " + filename)
            (self.source / filename).write_text("new " + filename)
        (self.production / ".env").write_text("secret=keep")
        (self.production / ".current-version-api").write_text("v1.0.0")
        (self.production / ".current-version-web").write_text("v1.0.0")
        self.nginx = self.root / "nginx.conf"
        self.nginx.write_text("old nginx")
        self.assets = self.root / "assets"
        self.assets.mkdir()
        (self.assets / "old-hash.js").write_text("old javascript")
        self.candidate = {"version": "v1.1.0", "revision": NEW_REVISION,
                          "api_image": digest("api", "3"), "web_image": digest("web", "4")}
        self.manifest = self.root / "candidate.json"
        DEPLOY.write_json(self.manifest, self.candidate)
        self.args = DEPLOY.arguments([
            "--manifest", str(self.manifest), "--source-root", str(self.source),
            "--deploy-dir", str(self.production), "--nginx-config", str(self.nginx),
            "--assets-dir", str(self.assets), "--health-attempts", "1", "--health-interval", "0",
        ])
        self.deployment = FakeDeployment(self.args)

    def current(self):
        return json.loads(self.deployment.current_path.read_text())

    def assert_restored(self):
        self.assertEqual(self.deployment.live, {"api": "sha256:" + "1" * 64, "web": "sha256:" + "2" * 64})
        self.assertEqual(self.nginx.read_text(), "old nginx")
        for filename in DEPLOY.COMPOSE_FILES:
            self.assertEqual((self.production / filename).read_text(), "old " + filename)
        self.assertTrue(self.current()["version"].startswith("bootstrap-"))
        self.assertFalse(self.deployment.pending_path.exists())
        self.assertEqual(self.deployment.outputs, ["rolled_back"])

    def test_success_records_verified_images_schema_and_snapshot(self):
        self.deployment.execute()
        current = self.current()
        self.assertEqual(current["version"], "v1.1.0")
        self.assertEqual(current["schema_version"], 11)
        self.assertEqual(current["web_image"], self.candidate["web_image"])
        self.assertEqual(self.deployment.outputs, ["deployed"])
        self.assertTrue((self.deployment.state / "versions/v1.1.0/manifest.json").exists())
        self.assertFalse(self.deployment.pending_path.exists())

    def test_partial_switch_failure_restores_both_images_and_configuration(self):
        self.deployment.fail_switch = True
        with self.assertRaisesRegex(DEPLOY.DeployError, "web switch"):
            self.deployment.execute()
        self.assert_restored()
        self.assertEqual(self.current()["schema_version"], 11)
        self.assertEqual(self.deployment.migrate_count, 1)

    def test_public_ingress_failure_rolls_back(self):
        self.deployment.fail_verify = True
        with self.assertRaises(DEPLOY.DeployError):
            self.deployment.execute()
        self.assert_restored()

    def test_wrong_container_identity_rolls_back(self):
        self.deployment.wrong_image = True
        with self.assertRaisesRegex(DEPLOY.DeployError, "Wrong web image"):
            self.deployment.execute()
        self.assert_restored()

    def test_nginx_reload_failure_rolls_back(self):
        self.deployment.fail_reload = True
        with self.assertRaisesRegex(DEPLOY.DeployError, "nginx reload"):
            self.deployment.execute()
        self.assert_restored()

    def test_migration_failure_never_restarts_previous_services(self):
        self.deployment.fail_migration = True
        with self.assertRaisesRegex(DEPLOY.DeployError, "migration failure"):
            self.deployment.execute()
        self.assertEqual(self.deployment.up_count, 0)
        self.assertEqual(self.nginx.read_text(), "old nginx")
        self.assertEqual(json.loads(self.deployment.pending_path.read_text())["phase"], "migration")
        self.assertTrue(self.current()["version"].startswith("bootstrap-"))
        with self.assertRaisesRegex(DEPLOY.DeployError, "Unfinished deployment"):
            self.deployment.execute()

    def test_old_candidate_is_superseded_before_production_mutation(self):
        self.deployment.superseded = True
        self.deployment.execute()
        self.assertEqual(self.deployment.outputs, ["superseded"])
        self.assertEqual(self.deployment.up_count, 0)
        self.assertEqual(self.deployment.migrate_count, 0)

    def test_bootstrap_uses_running_image_ids_and_old_anchors(self):
        self.deployment.state.mkdir()
        baseline = self.deployment.current()
        self.assertEqual(baseline["api_image"], "sha256:" + "1" * 64)
        self.assertEqual(baseline["revision"], OLD_REVISION)
        self.assertEqual(baseline["component_versions"], {"api": "v1.0.0", "web": "v1.0.0"})
        saved = json.loads((self.deployment.state / "versions" / baseline["version"] / ".release-images.json").read_text())
        self.assertEqual(saved["services"]["api"]["image"], baseline["api_image"])

    def test_retries_keep_exact_digest(self):
        self.deployment.execute()
        self.deployment.execute()
        self.assertEqual(self.current()["api_image"], self.candidate["api_image"])
        self.assertEqual(self.deployment.outputs, ["deployed", "deployed"])
        self.assertFalse(any(":latest" in " ".join(cmd) for cmd in self.deployment.commands))

    def test_assets_are_staged_before_switch_and_old_chunks_survive(self):
        self.deployment.execute()
        self.assertEqual((self.assets / "old-hash.js").read_text(), "old javascript")
        self.assertTrue((self.assets / "assets/new-hash.js").exists())
        copy = next(i for i, cmd in enumerate(self.deployment.commands) if cmd[:2] == ["docker", "cp"])
        switch = next(i for i, cmd in enumerate(self.deployment.commands) if cmd[:2] == ["compose", "up"])
        self.assertLess(copy, switch)

    def test_same_version_cannot_be_replaced_with_different_digest(self):
        self.deployment.execute()
        self.candidate["api_image"] = digest("api", "5")
        DEPLOY.write_json(self.manifest, self.candidate)
        with self.assertRaisesRegex(DEPLOY.DeployError, "Version already"):
            self.deployment.execute()
        self.assertEqual(self.deployment.up_count, 1)

    def test_component_deploy_keeps_other_image(self):
        self.args.component = "web"
        self.deployment.execute()
        self.assertEqual(self.current()["api_image"], "sha256:" + "1" * 64)
        self.assertEqual(self.current()["component_versions"]["api"], "v1.0.0")
        self.assertEqual(self.deployment.migrate_count, 0)
        self.assertEqual(self.current()["component_revisions"], {"api": OLD_REVISION, "web": NEW_REVISION})

    def test_manual_rollback_restores_archive_without_migration(self):
        self.deployment.execute()
        bootstrap = next((self.deployment.state / "versions").glob("bootstrap-*"))
        self.args.rollback = bootstrap.name
        self.deployment.execute()
        self.assertEqual(self.current()["version"], bootstrap.name)
        self.assertEqual(self.current()["schema_version"], 11)
        self.assertEqual(self.deployment.migrate_count, 1)
        self.assertEqual(self.nginx.read_text(), "old nginx")

    def test_unrecorded_live_image_fails_closed(self):
        self.deployment.execute()
        self.deployment.live["api"] = "sha256:" + "5" * 64
        with self.assertRaisesRegex(DEPLOY.DeployError, "differs from recorded"):
            self.deployment.execute()

    def test_failed_first_release_restores_legacy_api_with_current_migration_bundle(self):
        self.deployment.fail_switch = True
        with self.assertRaises(DEPLOY.DeployError):
            self.deployment.execute()
        override = json.loads(self.deployment.images_file.read_text())
        mount = override["services"]["api"]["volumes"][0]
        self.assertEqual(mount["target"], "/app/migrations")
        self.assertTrue(mount["read_only"])
        self.assertTrue((Path(mount["source"]) / "11_new.up.sql").exists())
        self.assertEqual(self.current()["schema_version"], 11)
        self.assert_restored()

    def test_manual_rollback_uses_latest_schema_bundle(self):
        self.deployment.execute()
        bundle = self.current()["migration_bundle"]
        bootstrap = next((self.deployment.state / "versions").glob("bootstrap-*"))
        self.args.rollback = bootstrap.name
        self.deployment.execute()
        self.assertEqual(self.current()["migration_bundle"], bundle)
        override = json.loads(self.deployment.images_file.read_text())
        self.assertEqual(override["services"]["api"]["volumes"][0]["source"], bundle)
        self.assertEqual(self.deployment.migrate_count, 1)

    def test_migration_bundle_ahead_of_database_blocks_legacy_restart(self):
        self.deployment.execute()
        bundle = Path(self.current()["migration_bundle"])
        (bundle / "12_future.up.sql").write_text("SELECT 1;")
        bootstrap = next((self.deployment.state / "versions").glob("bootstrap-*"))
        self.args.rollback = bootstrap.name
        with self.assertRaisesRegex(DEPLOY.DeployError, "exactly match"):
            self.deployment.execute()
        self.assertEqual(self.deployment.up_count, 1)
        self.assertEqual(self.current()["version"], "v1.1.0")

    def test_interruption_after_switch_restores_previous_release(self):
        original_reload = self.deployment.reload_nginx
        def interrupted_reload():
            if self.deployment.up_count == 1:
                raise InterruptedError("SIGTERM")
            return original_reload()
        self.deployment.reload_nginx = interrupted_reload
        with self.assertRaises(InterruptedError):
            self.deployment.execute()
        self.assert_restored()

    def test_failed_restoration_retains_pending_record(self):
        self.deployment.fetch = lambda _url: (_ for _ in ()).throw(OSError("ingress down"))
        with self.assertRaisesRegex(DEPLOY.DeployError, "restoration failed"):
            self.deployment.execute()
        self.assertTrue(self.deployment.pending_path.exists())
        self.assertTrue(self.current()["version"].startswith("bootstrap-"))
        self.assertFalse((self.deployment.state / "versions/v1.1.0").exists())

    def test_missing_static_asset_causes_rollback(self):
        original_fetch = self.deployment.fetch
        def missing_asset(url):
            if url.endswith(".js") and self.deployment.up_count == 1:
                return b"<title>404</title>", "text/html"
            return original_fetch(url)
        self.deployment.fetch = missing_asset
        with self.assertRaisesRegex(DEPLOY.DeployError, "asset returned"):
            self.deployment.execute()
        self.assert_restored()

    def test_manual_rollback_only_uses_cached_images(self):
        self.deployment.execute()
        bootstrap = next((self.deployment.state / "versions").glob("bootstrap-*"))
        self.args.rollback = bootstrap.name
        self.deployment.commands.clear()
        self.deployment.execute()
        self.assertFalse(any(cmd[:2] == ["docker", "pull"] for cmd in self.deployment.commands))

    def test_partial_rollback_rejected_before_changes(self):
        self.deployment.execute()
        self.args.rollback = "v1.1.0"
        self.args.component = "web"
        with self.assertRaisesRegex(DEPLOY.DeployError, "complete release"):
            self.deployment.execute()
        self.assertEqual(self.deployment.up_count, 1)

    def test_partial_production_does_not_claim_all_older_candidates_are_included(self):
        self.args.component = "web"
        self.deployment.execute()
        self.args.component = "both"
        self.candidate["revision"] = "c" * 40
        self.candidate["version"] = "v1.0.1"
        DEPLOY.write_json(self.manifest, self.candidate)
        original_run = self.deployment.run
        def ancestry(command, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                return subprocess.CompletedProcess(command, 0 if command[4] == NEW_REVISION else 1, "", "")
            return original_run(command, **kwargs)
        self.deployment.run = ancestry
        with self.assertRaisesRegex(DEPLOY.DeployError, "selected component is older"):
            self.deployment.execute()
        self.assertNotIn("superseded", self.deployment.outputs)
        self.assertEqual(self.deployment.up_count, 1)

    def test_stopped_container_can_be_recovered_by_manual_rollback(self):
        self.deployment.execute()
        bootstrap = next((self.deployment.state / "versions").glob("bootstrap-*"))
        self.deployment.stopped.add("api")
        self.args.rollback = bootstrap.name
        self.deployment.execute()
        self.assertEqual(self.current()["version"], bootstrap.name)
        self.assertFalse(self.deployment.stopped)
        self.assertEqual(self.deployment.migrate_count, 1)

    def test_forward_deploy_still_rejects_stopped_current_container(self):
        self.deployment.execute()
        self.deployment.stopped.add("api")
        with self.assertRaisesRegex(DEPLOY.DeployError, "not running"):
            self.deployment.execute()
        self.assertEqual(self.deployment.up_count, 1)

    def test_asset_failure_after_migration_installs_legacy_bridge(self):
        original_stage = self.deployment.stage_assets
        def fail_candidate(manifest):
            if manifest["version"] == "v1.1.0":
                raise DEPLOY.DeployError("asset staging failed")
            original_stage(manifest)
        self.deployment.stage_assets = fail_candidate
        with self.assertRaisesRegex(DEPLOY.DeployError, "asset staging failed"):
            self.deployment.execute()
        self.assert_restored()
        self.assertEqual(self.deployment.up_count, 1)
        self.assertEqual(self.current()["schema_version"], 11)
        override = json.loads(self.deployment.images_file.read_text())
        self.assertEqual(override["services"]["api"]["volumes"][0]["target"], "/app/migrations")
        self.assertTrue(self.current()["migration_bundle"])

    def assert_posts_failure_restores(self, payload):
        original_fetch = self.deployment.fetch
        def bad_posts(url):
            if url.endswith("api/v1/posts/") and self.deployment.up_count == 1:
                return json.dumps(payload).encode(), "application/json"
            return original_fetch(url)
        self.deployment.fetch = bad_posts
        with self.assertRaisesRegex(DEPLOY.DeployError, "successful paginated envelope"):
            self.deployment.execute()
        self.assert_restored()

    def test_http_200_posts_error_causes_rollback(self):
        self.assert_posts_failure_restores({"error": "DATABASE_UNAVAILABLE", "message": "temporary failure"})

    def test_http_200_posts_error_rejected_even_with_collection(self):
        self.assert_posts_failure_restores({"error": "UPSTREAM_FAILURE", "data": [], "meta": {"pagination": {"limit": 20}}})

    def test_posts_null_data_causes_rollback(self):
        self.assert_posts_failure_restores({"data": None, "meta": {"pagination": {"limit": 20}}})

    def test_posts_missing_pagination_causes_rollback(self):
        self.assert_posts_failure_restores({"data": []})

    def test_source_revision_mismatch_rejected_before_migration_or_switch(self):
        self.deployment.source_revision = OLD_REVISION
        with self.assertRaisesRegex(DEPLOY.DeployError, "HEAD does not match"):
            self.deployment.execute()
        self.assertEqual(self.deployment.migrate_count, 0)
        self.assertEqual(self.deployment.up_count, 0)
        self.assertFalse(self.deployment.pending_path.exists())

    def test_source_config_changes_rejected_before_migration_or_switch(self):
        self.deployment.dirty_source = True
        with self.assertRaisesRegex(DEPLOY.DeployError, "differs from its committed revision"):
            self.deployment.execute()
        self.assertEqual(self.deployment.migrate_count, 0)
        self.assertEqual(self.deployment.up_count, 0)
        self.assertFalse(self.deployment.pending_path.exists())

    def test_untrusted_repository_digest_rejected(self):
        self.candidate["api_image"] = "ghcr.io/other/api@sha256:" + "3" * 64
        DEPLOY.write_json(self.manifest, self.candidate)
        with self.assertRaisesRegex(DEPLOY.DeployError, "GHCR digest"):
            self.deployment.execute()


if __name__ == "__main__":
    unittest.main()
