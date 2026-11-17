#!/usr/bin/env python3
"""Freeze, verify and publish one recoverable release candidate under release-state."""

import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import quote, urlsplit
import zipfile


MANIFEST_PATH = ".release-please-manifest.json"
ASSET_NAME = "release-manifest.json"
CANDIDATE_REF = "heads/release-candidate"
MAIN_REF = "origin/release/2.0"
SHA = re.compile(r"[a-f0-9]{40}\Z")
VERSION = re.compile(r"v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\Z")
ARCHIVE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z")
DIGEST = re.compile(r"sha256:[a-f0-9]{64}\Z")
CI_WORKFLOW = ".github/workflows/ci.yml"
CI_BRANCH = "release/2.0"
CI_EVIDENCE_JOB = "Release evidence"
CI_REQUIRED_JOBS = (
    "Detect Changes", "Pick runner / Pick runner", "Backend lint", "Backend build", "Backend tests",
    "Backend image", "Backend (Go)", "Web lint", "Web typecheck", "Web build", "Plan Web tests",
    *(f"Web unit ({shard}/3)" for shard in range(1, 4)),
    *(f"Web contract ({shard}/2)" for shard in range(1, 3)),
    *(f"Web package ({package})" for package in ("ui", "inkline", "react-tweet", "kanban", "theme")),
    "Frontend (React)", "Web image", "Dependency Scan", "Infrastructure", "CI Gate",
)


def evidence_artifact_name(attempt):
    return f"release-evidence-{positive_integer(attempt, 'run_attempt')}"


class ReleaseError(RuntimeError):
    pass


class APIError(ReleaseError):
    def __init__(self, status, message):
        self.status = status
        super().__init__(message)


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def revision(value):
    if not isinstance(value, str) or not SHA.fullmatch(value):
        raise ReleaseError("revision 必须是完整的 40 位小写 commit SHA")
    return value


def version(value):
    if not isinstance(value, str) or not VERSION.fullmatch(value):
        raise ReleaseError("version 必须是 vX.Y.Z 或 X.Y.Z 稳定版本")
    return "v" + value.removeprefix("v")


def positive_integer(value, field):
    if isinstance(value, bool) or not re.fullmatch(r"[1-9][0-9]*", str(value)):
        raise ReleaseError(f"{field} 必须是正整数")
    return int(value)


def validate_manifest(value, expected_version, expected_revision):
    if not isinstance(value, dict):
        raise ReleaseError("发布清单必须是 JSON 对象")
    if value.get("version") != expected_version or value.get("revision") != expected_revision:
        raise ReleaseError("发布清单的 version/revision 与候选或 tag 不一致")
    for component in ("api", "web"):
        image = value.get(f"{component}_image", "")
        prefix = f"ghcr.io/vod-studio/violet-{component}@"
        if not isinstance(image, str) or not image.startswith(prefix) or not DIGEST.fullmatch(image[len(prefix):]):
            raise ReleaseError(f"{component} 镜像必须是固定 GHCR 仓库的 sha256 digest")
    evidence = value.get("verification")
    if not isinstance(evidence, dict) or evidence.get("full") is not True:
        raise ReleaseError("发布清单缺少全量验收证据")
    for field in ("run_id", "run_attempt"):
        if type(evidence.get(field)) is not int:
            raise ReleaseError(f"verification.{field} 必须是整数")
        positive_integer(evidence[field], field)
    revision(evidence.get("workflow_revision"))
    return value


def build_manifest(target_version, sha, api_digest, web_digest, run_id, run_attempt, workflow_revision):
    value = {
        "version": version(target_version), "revision": revision(sha),
        "api_image": f"ghcr.io/vod-studio/violet-api@{api_digest}",
        "web_image": f"ghcr.io/vod-studio/violet-web@{web_digest}",
        "verification": {"run_id": positive_integer(run_id, "run_id"),
                         "run_attempt": positive_integer(run_attempt, "run_attempt"),
                         "workflow_revision": revision(workflow_revision), "full": True},
    }
    return validate_manifest(value, value["version"], value["revision"])


def read_manifest(path):
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ReleaseError("发布清单必须是 JSON 对象")
    return validate_manifest(value, version(value.get("version")), revision(value.get("revision")))


def evidence_outputs(manifest):
    return {"revision": manifest["revision"], "version": manifest["version"],
            "api_digest": manifest["api_image"].split("@", 1)[1],
            "web_digest": manifest["web_image"].split("@", 1)[1],
            **{f"verification_{key}": str(value).lower() for key, value in manifest["verification"].items()}}


def write_outputs(result, env):
    for value in result.values():
        if "\n" in value or "\r" in value:
            raise ReleaseError("GITHUB_OUTPUT 值不能包含换行")
    if env.get("GITHUB_OUTPUT"):
        with open(env["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
            for key, value in result.items():
                stream.write(f"{key}={value}\n")


def release_notes(changelog, target_version):
    number = re.escape(target_version.removeprefix("v"))
    headings = list(re.finditer(r"^##[ \t]+(.+)$", changelog, re.MULTILINE))
    matching = [index for index, heading in enumerate(headings)
                if re.match(rf"(?:\[v?{number}\]|v?{number})(?=[\s(]|$)", heading[1])]
    if len(matching) != 1:
        raise ReleaseError(f"CHANGELOG 必须恰好包含一个 {target_version} 章节")
    index = matching[0]
    end = headings[index + 1].start() if index + 1 < len(headings) else len(changelog)
    notes = changelog[headings[index].end():end].strip()
    if not notes:
        raise ReleaseError(f"CHANGELOG 的 {target_version} 章节不能为空")
    return notes


class Git:
    def __init__(self, cwd=Path("."), runner=subprocess.run):
        self.cwd = cwd
        self.runner = runner

    def command(self, *args):
        return self.runner(["git", *args], cwd=self.cwd, text=True, capture_output=True, check=True).stdout.strip()

    def resolve(self, value):
        return revision(self.command("rev-parse", "--verify", "--end-of-options", f"{value}^{{commit}}"))

    def read(self, sha, path):
        return self.command("show", f"{revision(sha)}:{path}")

    def version(self, sha):
        try:
            return version(json.loads(self.read(sha, MANIFEST_PATH))["."])
        except (KeyError, TypeError, ValueError) as error:
            raise ReleaseError("候选 revision 的 release-please manifest 无效") from error

    def parent(self, sha):
        parents = self.command("rev-list", "--parents", "-n", "1", revision(sha)).split()
        return revision(parents[1]) if len(parents) > 1 else None

    def ancestor(self, older, newer):
        result = self.runner(["git", "merge-base", "--is-ancestor", revision(older), revision(newer)],
                             cwd=self.cwd, text=True, capture_output=True)
        if result.returncode not in (0, 1):
            raise ReleaseError("无法确定候选的 Git 祖先关系")
        return result.returncode == 0

    def release_commit(self, sha):
        return revision(self.command("log", "--first-parent", "-1", "--format=%H", revision(sha), "--", MANIFEST_PATH))


class GitHub:
    """Only explicit HTTP 404 from optional reads becomes an absent resource.

    All writers must hold the shared release-state Actions lock. GitHub refs have
    no compare-and-delete API; the final read protects newer pointers in that lock.
    """

    def __init__(self, repo, runner=subprocess.run):
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
            raise ReleaseError("GH_REPO 必须是 owner/repo")
        self.repo = repo
        self.runner = runner
        self.root = f"repos/{repo}"

    def request(self, method, path, body=None, raw=False, binary=False):
        headers = ["-H", "Accept: application/octet-stream" if binary else "Accept: application/vnd.github+json",
                   "-H", "X-GitHub-Api-Version: 2022-11-28"]
        command = ["gh", "api", "--method", method, path, *headers]
        payload = None
        if body is not None:
            payload = body if isinstance(body, str) else compact(body)
            command += ["-H", "Content-Type: application/json",
                        "-H", f"Content-Length: {len(payload.encode('utf-8'))}", "--input", "-"]
        result = self.runner(command, input=payload, text=True, capture_output=True)
        if result.returncode:
            # gh emits '(HTTP NNN)' for REST failures; prose such as 'not found'
            # is insufficient to classify transport, authentication or Git errors.
            codes = re.findall(r"\(HTTP (\d{3})\)", result.stderr)
            status = int(codes[-1]) if codes else None
            raise APIError(status, f"GitHub {method} {path} 失败 ({status or 'transport'})：{result.stderr.strip()}")
        if raw:
            return result.stdout
        if not result.stdout.strip():
            return None
        try:
            return json.loads(result.stdout)
        except ValueError as error:
            raise ReleaseError("GitHub 返回了无效 JSON") from error

    def optional(self, path):
        try:
            value = self.request("GET", path)
            if not isinstance(value, dict):
                raise ReleaseError("GitHub 资源读取返回了非对象，不能视为不存在")
            return value
        except APIError as error:
            if error.status == 404:
                return None
            raise

    def pages(self, path):
        page = 1
        while True:
            separator = "&" if "?" in path else "?"
            values = self.request("GET", f"{path}{separator}per_page=100&page={page}")
            if not isinstance(values, list):
                raise ReleaseError("GitHub 分页接口返回了非数组")
            yield from values
            if len(values) < 100:
                return
            page += 1

    def ref(self, name):
        value = self.optional(f"{self.root}/git/ref/{name}")
        if value is None:
            return None
        if value.get("ref") != f"refs/{name}":
            raise ReleaseError("GitHub 返回了不匹配的 ref")
        item = value["object"]
        seen = set()
        while item.get("type") == "tag":
            tag_sha = revision(item.get("sha"))
            if tag_sha in seen:
                raise ReleaseError("annotated tag 存在循环引用")
            seen.add(tag_sha)
            item = self.request("GET", f"{self.root}/git/tags/{tag_sha}")["object"]
        if item.get("type") != "commit":
            raise ReleaseError("ref 未指向 commit")
        return revision(item.get("sha"))

    def set_candidate(self, sha, previous):
        if self.ref(CANDIDATE_REF) != previous:
            raise ReleaseError("候选指针已变化，必须重新 prepare")
        if previous is None:
            self.request("POST", f"{self.root}/git/refs", {"ref": f"refs/{CANDIDATE_REF}", "sha": sha})
        else:
            self.request("PATCH", f"{self.root}/git/refs/{CANDIDATE_REF}", {"sha": sha, "force": True})

    def clear_candidate(self, sha):
        if self.ref(CANDIDATE_REF) == sha:
            self.request("DELETE", f"{self.root}/git/refs/{CANDIDATE_REF}")

    def release(self, target_version):
        value = self.optional(f"{self.root}/releases/tags/{target_version}")
        if value is not None:
            return value
        # The by-tag endpoint only guarantees published releases. Drafts must be
        # found through the authenticated listing, including every page.
        matches = [item for item in self.pages(f"{self.root}/releases") if item.get("tag_name") == target_version]
        if len(matches) > 1:
            raise ReleaseError("同一 tag 存在多份 Release，拒绝自动选择")
        return matches[0] if matches else None

    def assets(self, release):
        return list(self.pages(f"{self.root}/releases/{release['id']}/assets"))

    def read_asset(self, asset):
        return self.request("GET", f"{self.root}/releases/assets/{asset['id']}", raw=True, binary=True)

    def delete_asset(self, asset):
        self.request("DELETE", f"{self.root}/releases/assets/{asset['id']}")

    def upload_asset(self, release, manifest):
        url = release["upload_url"].split("{", 1)[0]
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.netloc != "uploads.github.com" or parsed.path != f"/{self.root}/releases/{release['id']}/assets":
            raise ReleaseError("Release upload_url 不属于当前仓库")
        return self.request("POST", f"{url}?name={ASSET_NAME}", compact(manifest))

    def create_release(self, target_version, sha, notes):
        return self.request("POST", f"{self.root}/releases", {
            "tag_name": target_version, "target_commitish": sha, "name": target_version,
            "body": notes, "draft": True, "prerelease": False, "generate_release_notes": False,
        })

    def publish_release(self, release):
        return self.request("PATCH", f"{self.root}/releases/{release['id']}", {"draft": False, "make_latest": "legacy"})

    def close_release_pr(self, sha):
        for pull in self.pages(f"{self.root}/commits/{sha}/pulls"):
            if not pull.get("merged_at") or pull.get("base", {}).get("ref") != "release/2.0":
                continue
            labels = {label["name"] for label in pull.get("labels", [])}
            if "autorelease: pending" not in labels:
                continue
            number = positive_integer(pull["number"], "PR number")
            detail = self.request("GET", f"{self.root}/pulls/{number}")
            if detail.get("merged") is not True or detail.get("merge_commit_sha") != sha:
                continue
            labels = {label["name"] for label in detail.get("labels", [])}
            if "autorelease: pending" not in labels:
                continue
            if "autorelease: tagged" not in labels:
                self.request("POST", f"{self.root}/issues/{number}/labels", {"labels": ["autorelease: tagged"]})
            label = quote("autorelease: pending", safe="")
            self.request("DELETE", f"{self.root}/issues/{number}/labels/{label}")

    def object_pages(self, path, field):
        page = 1
        while True:
            separator = "&" if "?" in path else "?"
            value = self.request("GET", f"{path}{separator}per_page=100&page={page}")
            if not isinstance(value, dict) or not isinstance(value.get(field), list):
                raise ReleaseError(f"GitHub {field} 分页响应无效")
            yield from value[field]
            if len(value[field]) < 100:
                return
            page += 1

    def verify_ci_run(self, run_id, sha, workflow_revision, attempt=None, *, creating=False):
        run_id = positive_integer(run_id, "run_id")
        sha = revision(sha)
        if revision(workflow_revision) != sha:
            raise ReleaseError("主干 CI workflow revision 必须等于已验收源码 SHA")
        current = self.request("GET", f"{self.root}/actions/runs/{run_id}")
        if not isinstance(current, dict):
            raise ReleaseError("CI run 响应无效")
        latest = positive_integer(current.get("run_attempt"), "run_attempt")
        attempt = latest if attempt is None else positive_integer(attempt, "run_attempt")
        if latest != attempt:
            raise ReleaseError("CI 证据已被新的 run attempt 替代")
        run = self.request("GET", f"{self.root}/actions/runs/{run_id}/attempts/{attempt}")
        for value in (current, run):
            if not isinstance(value, dict) or value.get("id") != run_id or value.get("run_attempt") != attempt:
                raise ReleaseError("CI run/attempt 身份不匹配")
            if (value.get("head_sha") != sha or value.get("head_branch") != CI_BRANCH
                    or value.get("path") != CI_WORKFLOW or value.get("event") not in ("push", "workflow_dispatch")
                    or value.get("repository", {}).get("full_name", "").lower() != self.repo.lower()
                    or value.get("head_repository", {}).get("full_name", "").lower() != self.repo.lower()):
                raise ReleaseError("CI 必须来自当前仓库 release/2.0 的精确 SHA 主干工作流")
            if creating:
                if value.get("status") != "in_progress" or value.get("conclusion") is not None:
                    raise ReleaseError("只能在正在执行的全量 CI 中创建证据")
            elif value.get("status") != "completed" or value.get("conclusion") != "success":
                raise ReleaseError("CI run/attempt 尚未完整成功")
        workflow_id = positive_integer(run.get("workflow_id"), "workflow_id")
        workflow = self.request("GET", f"{self.root}/actions/workflows/{workflow_id}")
        if (current.get("workflow_id") != workflow_id or not isinstance(workflow, dict)
                or workflow.get("id") != workflow_id or workflow.get("path") != CI_WORKFLOW
                or workflow.get("state") != "active"):
            raise ReleaseError("CI workflow 身份不匹配")
        if run["event"] == "workflow_dispatch":
            actor = run.get("triggering_actor", {}).get("login", "")
            if not re.fullmatch(r"[A-Za-z0-9-]+(?:\[bot\])?", actor):
                raise ReleaseError("手动 CI 缺少有效触发者")
            permission = self.request("GET", f"{self.root}/collaborators/{quote(actor, safe='')}/permission")
            if not isinstance(permission, dict) or permission.get("permission") not in ("admin", "maintain", "write"):
                raise ReleaseError("手动 CI 触发者没有发布权限")
        jobs = list(self.object_pages(f"{self.root}/actions/runs/{run_id}/attempts/{attempt}/jobs", "jobs"))
        for name in (*CI_REQUIRED_JOBS, CI_EVIDENCE_JOB):
            matches = [job for job in jobs if job.get("name") == name]
            if len(matches) != 1:
                raise ReleaseError(f"全量 CI 必须恰好包含一个 {name} job")
            job = matches[0]
            if job.get("run_id") != run_id or job.get("run_attempt") != attempt or job.get("head_sha") != sha:
                raise ReleaseError(f"{name} job 不属于指定 CI SHA/attempt")
            if creating and name == CI_EVIDENCE_JOB:
                if job.get("status") != "in_progress" or job.get("conclusion") is not None:
                    raise ReleaseError("证据必须由当前 Release evidence job 创建")
            elif job.get("status") != "completed" or job.get("conclusion") != "success":
                raise ReleaseError(f"全量 CI 的 {name} job 未成功")
        return run

    def ci_artifact(self, run_id, attempt, sha):
        artifacts = list(self.object_pages(f"{self.root}/actions/runs/{run_id}/artifacts", "artifacts"))
        matches = [item for item in artifacts if item.get("name") == evidence_artifact_name(attempt)]
        if len(matches) != 1:
            raise ReleaseError("指定 CI attempt 必须恰好有一份 release evidence artifact")
        asset = matches[0]
        source = asset.get("workflow_run", {})
        digest = asset.get("digest", "")
        if (asset.get("expired") is not False or source.get("id") != run_id
                or source.get("head_sha") != sha or source.get("head_branch") != CI_BRANCH
                or not isinstance(digest, str) or not DIGEST.fullmatch(digest)):
            raise ReleaseError("CI artifact 来源、有效期或 digest 无效")
        identifier = positive_integer(asset.get("id"), "artifact_id")
        result = self.runner(["gh", "api", "--method", "GET", f"{self.root}/actions/artifacts/{identifier}/zip",
                              "-H", "Accept: application/vnd.github+json",
                              "-H", "X-GitHub-Api-Version: 2022-11-28"], capture_output=True)
        if result.returncode:
            raise ReleaseError("下载 CI evidence artifact 失败，禁止发布")
        if not isinstance(result.stdout, bytes) or "sha256:" + hashlib.sha256(result.stdout).hexdigest() != digest:
            raise ReleaseError("CI evidence artifact digest 不匹配")
        try:
            with zipfile.ZipFile(io.BytesIO(result.stdout)) as archive:
                entries = archive.infolist()
                if len(entries) != 1 or entries[0].filename != ASSET_NAME or entries[0].file_size > 65536:
                    raise ReleaseError("CI artifact 必须只包含 release-manifest.json")
                return json.loads(archive.read(entries[0]).decode("utf-8"))
        except (ValueError, UnicodeError, zipfile.BadZipFile, RuntimeError) as error:
            raise ReleaseError("CI evidence artifact 内容无效") from error

    def ci_source_version(self, sha):
        source = self.request("GET", f"{self.root}/contents/{MANIFEST_PATH}?ref={revision(sha)}")
        if not isinstance(source, dict) or source.get("type") != "file" or source.get("encoding") != "base64":
            raise ReleaseError("CI 源码 release manifest 响应无效")
        try:
            content = base64.b64decode("".join(source["content"].split()), validate=True)
            return version(json.loads(content)["."])
        except (KeyError, TypeError, ValueError) as error:
            raise ReleaseError("CI 源码 release manifest 无效") from error

    def ci_evidence(self, run_id, sha, target_version):
        run = self.verify_ci_run(run_id, sha, sha)
        manifest = self.ci_artifact(run["id"], run["run_attempt"], sha)
        validate_manifest(manifest, target_version, sha)
        evidence = manifest["verification"]
        if (evidence["run_id"] != run["id"] or evidence["run_attempt"] != run["run_attempt"]
                or evidence["workflow_revision"] != sha or self.ci_source_version(sha) != target_version):
            raise ReleaseError("CI evidence 与实际 run/源码版本不一致")
        return manifest

    def find_ci_evidence(self, sha, target_version):
        runs = self.object_pages(
            f"{self.root}/actions/workflows/ci.yml/runs?branch={CI_BRANCH}&head_sha={revision(sha)}&status=success",
            "workflow_runs",
        )
        for run in runs:
            if run.get("event") in ("push", "workflow_dispatch") and run.get("head_sha") == sha:
                return self.ci_evidence(positive_integer(run.get("id"), "run_id"), sha, target_version)
        raise ReleaseError("没有该精确 SHA 的成功全量主干 CI，禁止隐式重建或部署")

    def verify_ci_evidence(self, manifest, run_id=None):
        validate_manifest(manifest, version(manifest.get("version")), revision(manifest.get("revision")))
        evidence = manifest["verification"]
        if run_id is not None and positive_integer(run_id, "run_id") != evidence["run_id"]:
            raise ReleaseError("CI evidence run_id 与指定运行不一致")
        self.verify_ci_run(evidence["run_id"], manifest["revision"], evidence["workflow_revision"], evidence["run_attempt"])
        canonical = self.ci_artifact(evidence["run_id"], evidence["run_attempt"], manifest["revision"])
        if canonical != manifest or self.ci_source_version(manifest["revision"]) != manifest["version"]:
            raise ReleaseError("CI evidence 清单与可信 artifact/源码版本不一致")
        return manifest


class Coordinator:
    def __init__(self, git, github, env):
        self.git = git
        self.github = github
        self.env = env

    def state(self, target_version):
        tag = self.github.ref(f"tags/{target_version}")
        release = self.github.release(target_version)
        manifest = None
        incomplete = None
        if release is not None:
            if release.get("tag_name") != target_version or type(release.get("draft")) is not bool or release.get("prerelease") is not False:
                raise ReleaseError("Release 的 tag/draft/prerelease 状态无效")
            assets = [asset for asset in self.github.assets(release) if asset.get("name") == ASSET_NAME]
            if len(assets) > 1:
                raise ReleaseError("Release 存在重复发布清单")
            if assets:
                asset = assets[0]
                if asset.get("state") == "starter" and asset.get("size") == 0:
                    incomplete = asset
                elif asset.get("state") == "uploaded":
                    try:
                        manifest = json.loads(self.github.read_asset(asset))
                    except ValueError as error:
                        raise ReleaseError("已上传的发布清单不是有效 JSON，禁止覆盖") from error
                    expected = tag or revision(release.get("target_commitish"))
                    validate_manifest(manifest, target_version, expected)
                else:
                    raise ReleaseError("发布清单上传状态未知，禁止覆盖")
            if not release["draft"] and tag is None:
                raise ReleaseError("公开 Release 缺少真实 tag")
        return tag, release, manifest, incomplete

    @staticmethod
    def complete(state):
        tag, release, manifest, _ = state
        return tag is not None and release is not None and not release["draft"] and manifest is not None

    def ensure_main(self, sha):
        if not self.git.ancestor(sha, self.git.resolve(MAIN_REF)):
            raise ReleaseError("候选提交必须已合入 release/2.0")

    def finish(self, sha):
        self.github.close_release_pr(self.git.release_commit(sha))
        self.github.clear_candidate(sha)

    def prepare(self, requested_version="", requested_revision="", rollback=False, component="both"):
        event = self.env.get("GITHUB_EVENT_NAME")
        if event not in ("push", "workflow_dispatch", "workflow_run"):
            raise ReleaseError("prepare 只接受 push、workflow_dispatch 或 workflow_run")
        if component not in ("both", "api", "web"):
            raise ReleaseError("component 必须是 both、api 或 web")
        if rollback:
            if event != "workflow_dispatch" or not ARCHIVE.fullmatch(requested_version) or component != "both" or requested_revision:
                raise ReleaseError("回滚必须手动指定安全归档版本、component=both，且不能重选 revision")
            return {"mode": "rollback", "version": requested_version, "revision": revision(self.env.get("GITHUB_SHA"))}
        if requested_revision:
            revision(requested_revision)
        target_version = version(requested_version) if requested_version else None
        if event == "workflow_run":
            source = self.env.get("CI_REVISION", "")
            if source and requested_revision and source != requested_revision:
                raise ReleaseError("workflow_run revision 与 CI_REVISION 不一致")
            sha = revision(requested_revision or source)
            self.ensure_main(sha)
            actual_version = self.git.version(sha)
            if target_version and target_version != actual_version:
                raise ReleaseError("指定版本与 CI revision manifest 不一致")
            target_version = actual_version
            self.github.ci_evidence(self.env.get("CI_RUN_ID"), sha, target_version)
        if event == "push":
            if requested_revision or requested_version:
                raise ReleaseError("push 候选必须使用事件 SHA，不能指定 version/revision")
            sha = revision(self.env.get("GITHUB_SHA"))
            target_version = self.git.version(sha)
            self.ensure_main(sha)
            parent = self.git.parent(sha)
            if parent is not None and self.git.version(parent) == target_version:
                return {"mode": "skip", "version": target_version, "revision": sha}
        frozen = self.github.ref(CANDIDATE_REF)
        if event == "workflow_run" and frozen and frozen != sha and self.git.ancestor(sha, frozen):
            return {"mode": "skip", "version": self.git.version(frozen), "revision": frozen}
        state = self.state(target_version) if target_version else None
        if event == "workflow_dispatch":
            if requested_revision:
                sha = requested_revision
            elif state and state[0]:
                sha = state[0]
            elif frozen:
                sha = frozen
            else:
                sha = self.git.resolve(MAIN_REF)
            self.ensure_main(sha)
            actual_version = self.git.version(sha)
            if target_version and actual_version != target_version:
                raise ReleaseError("指定版本与选中的 revision manifest 不一致")
            target_version = target_version or actual_version
        state = state or self.state(target_version)
        tag, release, manifest, _ = state
        if event == "workflow_run" and self.complete(state):
            return {"mode": "skip", "version": target_version, "revision": sha}
        if tag is not None and tag != sha:
            raise ReleaseError("已存在 tag 指向其他 revision，禁止移动")
        if manifest is not None and manifest["revision"] != sha:
            raise ReleaseError("同版本已有不可变发布清单，禁止重选 revision")
        if self.complete(state):
            self.finish(sha)
            return {"mode": "reuse", "version": target_version, "revision": sha, "manifest": compact(manifest)}
        same_frozen = frozen == sha
        if release and release["draft"] and release.get("target_commitish") != sha:
            raise ReleaseError("draft Release 未绑定选中的完整 revision")
        if (tag or (release and not release["draft"])) and not same_frozen and not (event == "workflow_dispatch" and requested_version):
            raise ReleaseError("旧 tag/Release 缺少验证清单，必须明确 version 手动接管")
        if frozen and not same_frozen:
            frozen_version = self.git.version(frozen)
            frozen_state = self.state(frozen_version)
            if not self.complete(frozen_state):
                if frozen_version != target_version:
                    raise ReleaseError("另一个未发布版本已冻结，不能挤占候选")
                if event == "workflow_run":
                    if not self.git.ancestor(frozen, sha):
                        raise ReleaseError("自动 CI 只能推进到冻结候选的后代")
                elif not requested_revision:
                    if event == "push":
                        return {"mode": "skip", "version": target_version, "revision": frozen}
                    raise ReleaseError("同版本已有冻结候选，必须明确 revision 才能重选")
                elif not self.git.ancestor(frozen, sha):
                    raise ReleaseError("只能将候选重选为原候选的后代")
        if event == "workflow_dispatch" and manifest is None:
            if self.env.get("CI_RUN_ID"):
                self.github.ci_evidence(self.env["CI_RUN_ID"], sha, target_version)
            else:
                self.github.find_ci_evidence(sha, target_version)
        if not same_frozen:
            self.github.set_candidate(sha, frozen)
        return {"mode": "candidate", "version": target_version, "revision": sha}

    def maintenance(self):
        sha = self.git.resolve("HEAD")
        target_version = self.git.version(sha)
        return {"maintain": "true" if self.complete(self.state(target_version)) else "false"}

    def publish(self, target_version, sha, api_digest, web_digest, verification):
        target_version = version(target_version)
        sha = revision(sha)
        if verification is None:
            raise ReleaseError("publish 必须指定可信 CI verification 清单")
        proposed = read_manifest(verification)
        validate_manifest(proposed, target_version, sha)
        if (proposed["api_image"] != f"ghcr.io/vod-studio/violet-api@{api_digest}"
                or proposed["web_image"] != f"ghcr.io/vod-studio/violet-web@{web_digest}"):
            raise ReleaseError("publish 参数与 CI verification digest 不一致")
        self.github.verify_ci_evidence(proposed)
        self.ensure_main(sha)
        if self.git.version(sha) != target_version:
            raise ReleaseError("候选 manifest 版本与 publish 版本不一致")
        frozen = self.github.ref(CANDIDATE_REF)
        if frozen is not None and frozen != sha:
            return {"status": "superseded"}
        state = self.state(target_version)
        tag, release, manifest, incomplete = state
        if frozen is None and not self.complete(state):
            return {"status": "superseded"}
        if tag is not None and tag != sha:
            raise ReleaseError("tag 与待发布 revision 不一致，禁止移动")
        if manifest is not None:
            validate_manifest(manifest, target_version, sha)
        if release and release["draft"] and release.get("target_commitish") != sha:
            raise ReleaseError("draft Release 与候选 revision 不一致")
        if not self.complete(state):
            notes = release_notes(self.git.read(sha, "CHANGELOG.md"), target_version)
            if release is None:
                release = self.github.create_release(target_version, sha, notes)
            if manifest is None:
                if incomplete is not None:
                    self.github.delete_asset(incomplete)
                self.github.upload_asset(release, proposed)
                # Re-read the uploaded artifact before exposing a public Release.
                state = self.state(target_version)
                tag, release, manifest, _ = state
                if manifest is None:
                    raise ReleaseError("发布清单未成功上传，保留 draft 等待恢复")
                validate_manifest(manifest, target_version, sha)
            if self.github.ref(CANDIDATE_REF) != sha:
                return {"status": "superseded"}
            actual_tag = self.github.ref(f"tags/{target_version}")
            if actual_tag is not None and actual_tag != sha:
                raise ReleaseError("发布前 tag 已变化，拒绝发布")
            if release["draft"]:
                self.github.publish_release(release)
            final = self.state(target_version)
            if not self.complete(final):
                raise ReleaseError("Release 尚未完整公开，保留候选等待恢复")
            manifest = validate_manifest(final[2], target_version, sha)
        self.finish(sha)
        return {"status": "published", "manifest": compact(manifest)}


def boolean(value):
    if value not in ("", "true", "false"):
        raise argparse.ArgumentTypeError("必须是 true 或 false")
    return value == "true"


def main(argv=None, *, git=None, github=None, env=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    prepare = commands.add_parser("prepare")
    prepare.add_argument("--version", default="")
    prepare.add_argument("--revision", default="")
    prepare.add_argument("--rollback", type=boolean, default=False)
    prepare.add_argument("--component", choices=("both", "api", "web"), default="both")
    commands.add_parser("maintenance")
    publish = commands.add_parser("publish")
    for field in ("version", "revision", "api-digest", "web-digest"):
        publish.add_argument(f"--{field}", required=True)
    publish.add_argument("--verification", type=Path, required=True)
    args = parser.parse_args(argv)
    environment = os.environ if env is None else env
    try:
        controller = Coordinator(git if git is not None else Git(),
                                 github if github is not None else GitHub(environment.get("GH_REPO", "")), environment)
        if args.command == "prepare":
            result = controller.prepare(args.version, args.revision, args.rollback, args.component)
        elif args.command == "maintenance":
            result = controller.maintenance()
        else:
            result = controller.publish(args.version, args.revision, args.api_digest, args.web_digest, args.verification)
        write_outputs(result, environment)
        print("发布状态：" + "，".join(f"{key}={value}" for key, value in result.items() if key != "manifest"))
        return 0
    except (ReleaseError, subprocess.CalledProcessError, OSError, KeyError, TypeError, ValueError) as error:
        message = str(error).replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        print(f"::error::{message}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
