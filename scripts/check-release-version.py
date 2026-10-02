#!/usr/bin/env python3
"""Reject release versions already published before the commits under review."""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


MANIFEST = ".release-please-manifest.json"
VERSION = re.compile(r"v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)")
RELEASE_AS = re.compile(r"^Release-As:\s*(\S+)\s*$", re.MULTILINE | re.IGNORECASE)


def version(value: str) -> tuple[int, int, int]:
    match = VERSION.fullmatch(value)
    if not match:
        raise ValueError(f"Expected a stable release version, got {value!r}")
    return tuple(int(part) for part in match.groups())


def git(*args: str, cwd: Path) -> str:
    return subprocess.run(
        ["git", *args], cwd=cwd, check=True, text=True, capture_output=True
    ).stdout.strip()


def check(base: str, head: str, release_pr: bool = False, cwd: Path = Path(".")) -> None:
    # Resolve options as revisions before constructing ranges or object paths.
    base = git("rev-parse", "--verify", "--end-of-options", f"{base}^{{commit}}", cwd=cwd)
    head = git("rev-parse", "--verify", "--end-of-options", f"{head}^{{commit}}", cwd=cwd)
    published = json.loads(git("show", f"{base}:{MANIFEST}", cwd=cwd))["."]
    target = json.loads(git("show", f"{head}:{MANIFEST}", cwd=cwd))["."]
    baseline = version(published)
    fork = git("merge-base", base, head, cwd=cwd)
    changed_manifest = git("diff", "--name-only", fork, head, "--", MANIFEST, cwd=cwd)
    if release_pr or changed_manifest:
        if version(target) <= baseline:
            raise ValueError(f"Release manifest {target} must be newer than base {published}")
    # Exclude every commit already reachable from base, including old Release-As trailers.
    messages = git("log", "--format=%B%x00", f"{base}..{head}", cwd=cwd)
    for requested in RELEASE_AS.findall(messages):
        if version(requested) <= baseline:
            raise ValueError(f"Release-As {requested} is already published (base {published})")
    print(f"Release version intent is valid against {published}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--release-pr", action="store_true")
    args = parser.parse_args()
    try:
        check(args.base, args.head, args.release_pr)
    except (ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
