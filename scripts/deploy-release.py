#!/usr/bin/env python3
"""Deploy immutable images as one recoverable production transaction."""

import argparse
import contextlib
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from urllib.request import ProxyHandler, Request, build_opener


VERSION = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z")
DIGEST = re.compile(r"ghcr\.io/[a-z0-9/_.-]+@sha256:[a-f0-9]{64}\Z")
REVISION = re.compile(r"[a-f0-9]{40}\Z")
COMPOSE_FILES = ("docker-compose.prod.yml", "docker-compose.ci.yml")


class DeployError(RuntimeError):
    pass


def atomic_write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".deploy-")
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def write_json(path, value):
    atomic_write(path, json.dumps(value, indent=2) + "\n")


def image_id(value):
    return value.removeprefix("sha256:")


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = set()
        self.has_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.has_title = True
        if tag == "script" and attrs.get("src"):
            self.urls.add(attrs["src"])
        if tag == "link" and attrs.get("rel") in ("stylesheet", "modulepreload"):
            if attrs.get("href"):
                self.urls.add(attrs["href"])


class Deployment:
    def __init__(self, args):
        self.args = args
        self.root = args.deploy_dir.resolve()
        self.state = self.root / ".releases"
        self.current_path = self.state / "current.json"
        self.pending_path = self.state / "pending.json"
        self.images_file = self.root / ".release-images.json"
        self.schema_path = self.state / "schema.json"

    def run(self, command, *, env=None, check=True, cwd=None, timeout=600):
        result = subprocess.run(command, cwd=cwd or self.root, env=env,
                                text=True, capture_output=True, timeout=timeout)
        if check and result.returncode:
            # Compose output can contain resolved credentials; report only the command category.
            raise DeployError(f"Command failed ({result.returncode}): {' '.join(command[:3])}")
        return result

    def compose(self, manifest, *arguments, config_root=None):
        folder = config_root or self.root
        env = dict(os.environ, API_IMAGE=manifest["api_image"], WEB_IMAGE=manifest["web_image"])
        command = ["docker", "compose", "--project-directory", str(self.root), "--env-file", str(self.root / ".env")]
        for filename in (*COMPOSE_FILES, ".release-images.json"):
            command.extend(["-f", str(folder / filename)])
        return self.run(command + list(arguments), env=env)

    def inspect_image(self, name):
        return json.loads(self.run(["docker", "image", "inspect", name]).stdout)[0]["Id"]

    def pull_image(self, name):
        for attempt in range(3):
            try:
                self.run(["docker", "pull", name])
                return
            except (DeployError, subprocess.TimeoutExpired):
                if attempt == 2:
                    raise
                time.sleep(2 ** attempt)

    def actual_image(self, component, require_running=True):
        details = json.loads(self.run(["docker", "inspect", "blog-" + component]).stdout)[0]
        if require_running and not details["State"].get("Running"):
            raise DeployError(f"Existing {component} container is not running")
        return details["Image"]

    def schema(self):
        result = self.run(["docker", "exec", "blog-postgres", "sh", "-c",
                           'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT version, dirty FROM schema_migrations"'])
        row = result.stdout.strip().split("|")
        if len(row) != 2 or not row[0].isdigit() or row[1] != "f":
            raise DeployError("Database migration state is missing or dirty; manual repair required")
        return int(row[0])

    def snapshot(self, folder):
        folder.mkdir(parents=True)
        for filename in COMPOSE_FILES:
            shutil.copyfile(self.root / filename, folder / filename)
        if self.images_file.exists():
            shutil.copyfile(self.images_file, folder / self.images_file.name)
        nginx = self.args.nginx_config
        write_json(folder / "nginx.json", {"content": nginx.read_text() if nginx.exists() else None})

    def image_override(self, folder, manifest):
        services = {name: {"image": manifest[name + "_image"]} for name in ("api", "web")}
        if manifest.get("migration_bundle"):
            services["api"]["volumes"] = [{"type": "bind", "source": manifest["migration_bundle"],
                                           "target": "/app/migrations", "read_only": True}]
        write_json(folder / ".release-images.json", {"services": services})

    def current(self):
        if self.current_path.exists():
            current = json.loads(self.current_path.read_text())
            for component in ("api", "web"):
                if image_id(self.actual_image(component, require_running=not bool(self.args.rollback))) != image_id(self.inspect_image(current[component + "_image"])):
                    raise DeployError(f"Live {component} image differs from recorded release; reconcile before deploying")
            return current
        anchors = {}
        for component in ("api", "web"):
            anchor = self.root / (".current-version-" + component)
            anchors[component] = anchor.read_text().strip() if anchor.exists() else None
        baseline = {"version": "bootstrap-" + uuid.uuid4().hex[:12], "revision": None,
                    "api_image": self.actual_image("api", require_running=not bool(self.args.rollback)),
                    "web_image": self.actual_image("web", require_running=not bool(self.args.rollback)),
                    "component_versions": anchors, "schema_version": self.schema()}
        if anchors["api"] and anchors["api"] == anchors["web"]:
            resolved = self.run(["git", "rev-parse", "--verify", "refs/tags/" + anchors["api"] + "^{commit}"],
                                check=False, cwd=self.args.source_root)
            if resolved.returncode == 0 and REVISION.fullmatch(resolved.stdout.strip()):
                baseline["revision"] = resolved.stdout.strip()
        baseline["component_revisions"] = {name: baseline["revision"] for name in ("api", "web")}
        folder = self.state / "versions" / baseline["version"]
        self.snapshot(folder)
        self.image_override(folder, baseline)
        write_json(folder / "manifest.json", baseline)
        write_json(self.current_path, baseline)
        return baseline

    def fetch(self, url):
        request = Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "violet-deploy-check"})
        with build_opener(ProxyHandler({})).open(request, timeout=15) as response:
            return response.read(), response.headers.get("Content-Type", "")

    def verify(self, manifest):
        for component in ("api", "web"):
            expected = self.inspect_image(manifest[component + "_image"])
            if image_id(self.actual_image(component)) != image_id(expected):
                raise DeployError(f"Wrong {component} image is running")
        base = self.args.site_url.rstrip("/") + "/"
        health, _ = self.fetch(urljoin(base, "api/health"))
        if json.loads(health).get("status") != "ok":
            raise DeployError("Public API health check failed")
        posts, _ = self.fetch(urljoin(base, "api/v1/posts/"))
        posts = json.loads(posts)
        if (not isinstance(posts, dict) or "error" in posts or not isinstance(posts.get("data"), list)
                or not isinstance(posts.get("meta"), dict)
                or not isinstance(posts["meta"].get("pagination"), dict)):
            raise DeployError("Public posts endpoint did not return a successful paginated envelope")
        body, content_type = self.fetch(base)
        parser = Assets()
        parser.feed(body.decode("utf-8"))
        if "text/html" not in content_type or not parser.has_title or not parser.urls:
            raise DeployError("Public SSR page is missing HTML or its asset references")
        own_assets = [urljoin(base, asset) for asset in parser.urls
                      if urlsplit(urljoin(base, asset)).netloc == urlsplit(base).netloc]
        if not own_assets:
            raise DeployError("Public SSR page has no same-origin assets to validate")
        for asset in own_assets:
            content, content_type = self.fetch(asset)
            if not content or "text/html" in content_type:
                raise DeployError("SSR asset returned empty content or HTML")

    def wait_healthy(self, manifest):
        for attempt in range(self.args.health_attempts):
            try:
                self.verify(manifest)
                return
            except (DeployError, OSError, ValueError) as error:
                if attempt + 1 == self.args.health_attempts:
                    raise DeployError(f"Release verification failed: {error}") from error
                time.sleep(self.args.health_interval)

    def reload_nginx(self):
        self.run(["docker", "exec", "nginx-proxy", "nginx", "-t"])
        self.run(["docker", "exec", "nginx-proxy", "nginx", "-s", "reload"])

    def export_migrations(self, manifest):
        identifier = image_id(self.inspect_image(manifest["api_image"]))
        folder = self.state / "migrations" / identifier
        if not folder.exists():
            folder.parent.mkdir(parents=True, exist_ok=True)
            container = "violet-migrations-" + uuid.uuid4().hex[:12]
            self.run(["docker", "create", "--name", container, manifest["api_image"]])
            try:
                with tempfile.TemporaryDirectory(dir=folder.parent) as temporary:
                    staging = Path(temporary) / "bundle"
                    staging.mkdir(mode=0o755)
                    self.run(["docker", "cp", container + ":/app/migrations/.", str(staging)])
                    migrations = list(staging.glob("*.up.sql"))
                    if not migrations or any(path.is_symlink() for path in staging.rglob("*")):
                        raise DeployError("API migration bundle is empty or contains symlinks")
                    for path in staging.rglob("*"):
                        os.chmod(path, 0o755 if path.is_dir() else 0o644)
                    os.rename(staging, folder)
            finally:
                self.run(["docker", "rm", "-f", container])
        return str(folder)

    def validate_migration_bundle(self, manifest):
        bundle = manifest.get("migration_bundle")
        if not bundle:
            return
        folder = Path(bundle)
        if not folder.is_relative_to(self.state / "migrations") or not folder.is_dir():
            raise DeployError("Migration compatibility bundle is missing or outside release storage")
        versions = []
        for path in folder.iterdir():
            match = re.fullmatch(r"(\d+)_.+\.up\.sql", path.name)
            if match:
                if path.is_symlink() or not path.is_file():
                    raise DeployError("Invalid migration compatibility bundle")
                versions.append(int(match.group(1)))
        if not versions or max(versions) != self.schema():
            raise DeployError("Migration bundle must exactly match the clean database version before restarting API")

    def stage_assets(self, manifest):
        container = "violet-assets-" + uuid.uuid4().hex[:12]
        self.run(["docker", "create", "--name", container, manifest["web_image"]])
        try:
            with tempfile.TemporaryDirectory(dir=self.state) as directory:
                self.run(["docker", "cp", container + ":/app/dist/client/.", directory])
                for source in Path(directory).rglob("*"):
                    if source.is_symlink():
                        raise DeployError("Static asset bundle contains a symlink")
                    if source.is_file():
                        destination = self.args.assets_dir / source.relative_to(directory)
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        # Rename each file atomically; old hashed chunks remain available to open tabs.
                        fd, temporary = tempfile.mkstemp(dir=destination.parent, prefix=".asset-")
                        os.close(fd)
                        try:
                            shutil.copyfile(source, temporary)
                            os.chmod(temporary, 0o644)
                            os.replace(temporary, destination)
                        finally:
                            if os.path.exists(temporary):
                                os.unlink(temporary)
        finally:
            self.run(["docker", "rm", "-f", container])

    def install_config(self, folder):
        for filename in (*COMPOSE_FILES, ".release-images.json"):
            atomic_write(self.root / filename, (folder / filename).read_text())
        nginx = json.loads((folder / "nginx.json").read_text())["content"]
        if nginx is None:
            self.args.nginx_config.unlink(missing_ok=True)
        else:
            atomic_write(self.args.nginx_config, nginx)
            os.chmod(self.args.nginx_config, 0o644)

    def output(self, status):
        print(f"Deployment status: {status}", flush=True)
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a") as stream:
                stream.write(f"status={status}\n")
        if os.environ.get("GITHUB_STEP_SUMMARY") and self.current_path.exists():
            current = json.loads(self.current_path.read_text())
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as stream:
                stream.write(f"\nDeployment: **{status}**\n\n")
                for key in ("version", "revision", "api_image", "web_image", "schema_version"):
                    stream.write(f"- {key}: `{current.get(key, 'unknown')}`\n")

    def execute(self):
        self.state.mkdir(parents=True, exist_ok=True)
        with open(self.state / "deploy.lock", "a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            if self.pending_path.exists():
                pending = json.loads(self.pending_path.read_text())
                current = json.loads(self.current_path.read_text()) if self.current_path.exists() else {}
                if current.get("transaction") == pending.get("transaction"):
                    self.pending_path.unlink()
                else:
                    raise DeployError("Unfinished deployment recorded in .releases/pending.json; reconcile production before retrying")
            return self.transaction()

    def transaction(self):
        previous = self.current()
        rollback = self.args.rollback
        if rollback:
            if self.args.component != "both":
                raise DeployError("Rollback restores a complete release; --component must be both")
            if not VERSION.fullmatch(rollback):
                raise DeployError("Invalid rollback version")
            source = self.state / "versions" / rollback
            candidate = json.loads((source / "manifest.json").read_text())
            if self.schema_path.exists():
                schema = json.loads(self.schema_path.read_text())
                candidate["migration_bundle"] = schema["bundle"]
        else:
            candidate = json.loads(self.args.manifest.read_text())
            if not VERSION.fullmatch(candidate.get("version", "")) or not REVISION.fullmatch(candidate.get("revision", "")):
                raise DeployError("Manifest needs a safe version and full commit SHA")
            for component in ("api", "web"):
                if not re.fullmatch(r"ghcr\.io/vod-studio/violet-" + component + r"@sha256:[a-f0-9]{64}", candidate.get(component + "_image", "")):
                    raise DeployError(f"Manifest {component} image must be a GHCR digest")
            source_revision = self.run(["git", "rev-parse", "--verify", "HEAD"], cwd=self.args.source_root).stdout.strip()
            if source_revision != candidate["revision"]:
                raise DeployError("Source checkout HEAD does not match the candidate revision")
            config_paths = [*COMPOSE_FILES, "deploy/nginx/xunrua.top"]
            self.run(["git", "ls-files", "--error-unmatch", "--", *config_paths], cwd=self.args.source_root)
            clean = self.run(["git", "diff", "--quiet", "HEAD", "--", *config_paths],
                             cwd=self.args.source_root, check=False)
            if clean.returncode != 0:
                raise DeployError("Source deployment configuration differs from its committed revision")
            current_revision = previous.get("revision")
            if current_revision and current_revision != candidate["revision"]:
                older = self.run(["git", "merge-base", "--is-ancestor", candidate["revision"], current_revision],
                                 cwd=self.args.source_root, check=False)
                if older.returncode == 0:
                    for component in ("api", "web"):
                        if self.args.component not in ("both", component):
                            continue
                        deployed_revision = previous.get("component_revisions", {}).get(component, current_revision)
                        included = self.run(["git", "merge-base", "--is-ancestor", candidate["revision"], deployed_revision],
                                            cwd=self.args.source_root, check=False) if deployed_revision else None
                        if included is None or included.returncode != 0:
                            raise DeployError("Newer configuration is deployed but a selected component is older; deploy a fresh complete release")
                    self.output("superseded")
                    return
                if older.returncode != 1:
                    raise DeployError("Cannot determine release ancestry")
                forward = self.run(["git", "merge-base", "--is-ancestor", current_revision, candidate["revision"]],
                                   cwd=self.args.source_root, check=False)
                if forward.returncode != 0:
                    raise DeployError("Candidate is not a descendant of production; use an explicit rollback")
            candidate["component_versions"] = dict(previous.get("component_versions", {}))
            candidate["component_revisions"] = dict(previous.get("component_revisions", {
                name: previous.get("revision") for name in ("api", "web")
            }))
            for component in ("api", "web"):
                if self.args.component in ("both", component):
                    candidate["component_versions"][component] = candidate["version"]
                    candidate["component_revisions"][component] = candidate["revision"]
                else:
                    candidate[component + "_image"] = previous[component + "_image"]
            source = self.args.source_root
        transaction = uuid.uuid4().hex
        candidate["transaction"] = transaction
        workspace = self.state / "transactions" / transaction
        old_config = workspace / "previous"
        new_config = workspace / "candidate"
        self.snapshot(old_config)
        self.image_override(old_config, previous)
        write_json(old_config / "manifest.json", previous)
        new_config.mkdir(parents=True)
        for filename in COMPOSE_FILES:
            shutil.copyfile(source / filename, new_config / filename)
        self.image_override(new_config, candidate)
        nginx_source = source / "nginx.json" if rollback else source / "deploy/nginx/xunrua.top"
        nginx = json.loads(nginx_source.read_text()) if rollback else {"content": nginx_source.read_text()}
        write_json(new_config / "nginx.json", nginx)
        self.compose(candidate, "config", "--quiet", config_root=new_config)
        for component in ("api", "web"):
            image = candidate[component + "_image"]
            if not rollback and DIGEST.fullmatch(image):
                self.pull_image(image)
            else:
                self.inspect_image(image)
        archive = self.state / "versions" / candidate["version"]
        if archive.exists():
            recorded = json.loads((archive / "manifest.json").read_text())
            if any(recorded.get(key) != candidate.get(key) for key in ("revision", "api_image", "web_image")):
                raise DeployError("Version already identifies a different release")
        if not rollback and self.args.component in ("both", "api"):
            candidate["migration_bundle"] = self.export_migrations(candidate)
        elif self.schema_path.exists():
            candidate["migration_bundle"] = json.loads(self.schema_path.read_text())["bundle"]
        self.image_override(new_config, candidate)
        pending = {"transaction": transaction, "previous": str(old_config), "candidate": candidate,
                   "phase": "migration" if not rollback else "preparing"}
        write_json(self.pending_path, pending)
        switched = False
        migration_completed = False
        try:
            if not rollback and self.args.component in ("both", "api"):
                self.compose(candidate, "run", "--rm", "--no-deps", "--entrypoint", "/migrate", "api", "up", config_root=new_config)
            candidate["schema_version"] = self.schema()
            self.validate_migration_bundle(candidate)
            migration_completed = not rollback and candidate["schema_version"] > previous["schema_version"]
            if migration_completed:
                previous["migration_bundle"] = candidate["migration_bundle"]
            if not rollback and self.args.component in ("both", "api"):
                write_json(self.schema_path, {"version": candidate["schema_version"], "bundle": candidate["migration_bundle"]})
            if self.schema_path.exists():
                previous["migration_bundle"] = json.loads(self.schema_path.read_text())["bundle"]
                self.image_override(old_config, previous)
                write_json(old_config / "manifest.json", previous)
            pending["phase"] = "preparing"
            write_json(self.pending_path, pending)
            self.stage_assets(candidate)
            pending["phase"] = "switching"
            write_json(self.pending_path, pending)
            switched = True
            self.install_config(new_config)
            self.compose(candidate, "up", "-d", "--no-build", "--no-deps", "api", "web")
            self.reload_nginx()
            self.wait_healthy(candidate)
            write_json(new_config / "manifest.json", candidate)
            if not archive.exists():
                archive.parent.mkdir(parents=True, exist_ok=True)
                os.rename(new_config, archive)
            write_json(self.current_path, candidate)
            self.pending_path.unlink()
        except BaseException as error:
            if switched or migration_completed:
                # A second cancellation must not interrupt restoration of the previous release.
                with ignore_termination():
                    try:
                        self.validate_migration_bundle(previous)
                        self.image_override(old_config, previous)
                        self.install_config(old_config)
                        self.stage_assets(previous)
                        self.compose(previous, "up", "-d", "--no-build", "--no-deps", "api", "web")
                        self.reload_nginx()
                        self.wait_healthy(previous)
                        previous["schema_version"] = self.schema()
                        if previous.get("migration_bundle"):
                            write_json(self.schema_path, {"version": previous["schema_version"], "bundle": previous["migration_bundle"]})
                        write_json(self.current_path, previous)
                        self.pending_path.unlink()
                        self.output("rolled_back")
                    except BaseException as recovery_error:
                        raise DeployError(f"Deploy failed and restoration failed; pending record retained: {recovery_error}") from error
            elif pending["phase"] != "migration":
                self.pending_path.unlink()
            # A failed or interrupted migration requires inspection; never restart old services.
            raise
        self.output("rolled_back" if rollback else "deployed")


@contextlib.contextmanager
def ignore_termination():
    original = {sig: signal.signal(sig, signal.SIG_IGN) for sig in (signal.SIGINT, signal.SIGTERM)}
    try:
        yield
    finally:
        for sig, handler in original.items():
            signal.signal(sig, handler)


def arguments(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--manifest", type=Path)
    mode.add_argument("--rollback")
    parser.add_argument("--source-root", type=Path, default=Path.cwd())
    parser.add_argument("--component", choices=("both", "api", "web"), default="both")
    parser.add_argument("--deploy-dir", type=Path, default=Path("/root/docker/violet"))
    parser.add_argument("--nginx-config", type=Path, default=Path("/root/docker/nginx-proxy/vhost.d/xunrua.top"))
    parser.add_argument("--assets-dir", type=Path, default=Path("/root/docker/nginx-proxy/blog-client"))
    parser.add_argument("--site-url", default="https://xunrua.top")
    parser.add_argument("--health-attempts", type=int, default=15)
    parser.add_argument("--health-interval", type=float, default=6)
    result = parser.parse_args(argv)
    if result.health_attempts < 1 or result.health_interval < 0:
        parser.error("Health attempts must be positive and interval nonnegative")
    result.source_root = result.source_root.resolve()
    return result


def main():
    def interrupted(signum, _frame):
        raise InterruptedError(f"Deployment interrupted by signal {signum}")
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, interrupted)
    try:
        Deployment(arguments()).execute()
    except (DeployError, OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
