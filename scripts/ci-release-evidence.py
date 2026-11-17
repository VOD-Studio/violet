#!/usr/bin/env python3
"""Create, retrieve or verify immutable full-main-CI release evidence."""

import argparse
import importlib.util
import os
from pathlib import Path
import subprocess
import sys


spec = importlib.util.spec_from_file_location("release_candidate", Path(__file__).with_name("release-candidate.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def create(args, github, env):
    if env.get("CI_FULL") != "true":
        raise release.ReleaseError("只有 FULL main CI 可以创建发布证据")
    for key in ("VALIDATE_RESULT", "BUILD_API_RESULT", "BUILD_WEB_RESULT"):
        if env.get(key) != "success":
            raise release.ReleaseError(f"{key} 未成功，禁止创建证据")
    sha = release.revision(args.revision)
    workflow_sha = release.revision(env.get("GITHUB_WORKFLOW_SHA"))
    if sha != release.revision(env.get("GITHUB_SHA")) or workflow_sha != sha:
        raise release.ReleaseError("CI 源码/workflow SHA 与证据 revision 不一致")
    manifest = release.build_manifest(args.version, sha, args.api_digest, args.web_digest,
                                      env.get("GITHUB_RUN_ID"), env.get("GITHUB_RUN_ATTEMPT"), workflow_sha)
    github.verify_ci_run(manifest["verification"]["run_id"], sha, workflow_sha,
                         manifest["verification"]["run_attempt"], creating=True)
    if github.ci_source_version(sha) != manifest["version"]:
        raise release.ReleaseError("CI 源码 manifest 与证据 version 不一致")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(release.compact(manifest) + "\n", encoding="utf-8")
    return manifest


def main(argv=None, *, github=None, env=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    creation = commands.add_parser("create")
    for field in ("revision", "version", "api-digest", "web-digest"):
        creation.add_argument(f"--{field}", required=True)
    creation.add_argument("--output", type=Path, required=True)
    verification = commands.add_parser("verify")
    verification.add_argument("--manifest", type=Path, required=True)
    verification.add_argument("--run-id")
    retrieval = commands.add_parser("fetch")
    retrieval.add_argument("--revision", required=True)
    retrieval.add_argument("--output", type=Path, required=True)
    retrieval.add_argument("--run-id")
    args = parser.parse_args(argv)
    environment = os.environ if env is None else env
    try:
        adapter = github if github is not None else release.GitHub(
            environment.get("GH_REPO") or environment.get("GITHUB_REPOSITORY", ""),
        )
        if args.command == "create":
            manifest = create(args, adapter, environment)
        elif args.command == "fetch":
            sha = release.revision(args.revision)
            target_version = adapter.ci_source_version(sha)
            manifest = (adapter.ci_evidence(args.run_id, sha, target_version) if args.run_id
                        else adapter.find_ci_evidence(sha, target_version))
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(release.compact(manifest) + "\n", encoding="utf-8")
        else:
            manifest = adapter.verify_ci_evidence(release.read_manifest(args.manifest), args.run_id)
        release.write_outputs(release.evidence_outputs(manifest), environment)
        evidence = manifest["verification"]
        print(f"CI evidence {args.command}: {manifest['version']} {manifest['revision']} "
              f"run={evidence['run_id']} attempt={evidence['run_attempt']}")
        return 0
    except (release.ReleaseError, subprocess.CalledProcessError, OSError, KeyError, TypeError, ValueError) as error:
        message = str(error).replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        print(f"::error::{message}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
