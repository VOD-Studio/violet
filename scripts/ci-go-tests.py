#!/usr/bin/env python3
"""Plan Go tests from the PR merge-base diff and Go's package dependency graph."""

import argparse
from collections import defaultdict, deque
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "api"
INTEGRATION_DIRECTORIES = (
    "internal/migrate",
    "internal/infrastructure/persistence/gorm/chatappearance",
)
PACKAGE_FILES = (
    "GoFiles", "CgoFiles", "TestGoFiles", "XTestGoFiles", "CFiles",
    "CXXFiles", "MFiles", "HFiles", "FFiles", "SFiles", "SwigFiles",
    "SwigCXXFiles", "SysoFiles", "EmbedFiles", "TestEmbedFiles",
    "XTestEmbedFiles",
)
UNSAFE_DIRECTIVE = re.compile(
    rb"(?m)^\s*//(?:go:(?:build|generate|linkname)\b|\s*\+build\b|"
    rb"\s*Code generated\b[^\n]*DO NOT EDIT\.)"
)
ROOT_DOCUMENTS = {
    "AGENTS.md", "CHANGELOG.md", "CONTEXT.md", "CONTRIBUTING.md", "DESIGN.md",
    "LICENSE", "PRODUCT.md", "README.md", "SECURITY.md",
}


class PlanError(Exception):
    pass


def run(arguments, *, cwd=ROOT):
    try:
        return subprocess.run(arguments, cwd=cwd, capture_output=True, check=False)
    except OSError as error:
        raise PlanError(f"Cannot execute {arguments[0]}: {error}") from error


def git(*arguments):
    result = run(["git", *arguments])
    if result.returncode:
        raise PlanError(f"Git {arguments[0]} failed")
    return result.stdout


def resolve_revision(value):
    return git("rev-parse", "--verify", "--end-of-options", f"{value}^{{commit}}").decode().strip()


def json_stream(data):
    decoder = json.JSONDecoder()
    text = data.decode()
    offset = 0
    objects = []
    while offset < len(text):
        if text[offset].isspace():
            offset += 1
            continue
        value, offset = decoder.raw_decode(text, offset)
        if not isinstance(value, dict):
            raise PlanError("Go list returned a non-object package")
        objects.append(value)
    return objects


def package_graph(*, integration=False):
    arguments = ["go", "list", "-e", "-test", "-json", "-mod=readonly"]
    if integration:
        arguments.append("-tags=integration")
    result = run([*arguments, "./..."], cwd=API)
    try:
        listed = json_stream(result.stdout)
    except (UnicodeError, ValueError) as error:
        raise PlanError("Go list returned invalid JSON") from error
    if result.returncode or not listed:
        raise PlanError("Go list could not enumerate the backend packages")

    packages = {}
    incomplete = any(
        package.get("Error") or package.get("DepsErrors") or package.get("Incomplete")
        for package in listed
    )
    indexed = {package.get("ImportPath"): package for package in listed}
    for package in listed:
        name = package.get("ImportPath", "")
        directory = package.get("Dir")
        # -test resolves test embeds and also emits non-runnable test variants.
        original = indexed.get(name.removesuffix(".test"))
        if package.get("ForTest") or (
            name.endswith(".test") and package.get("Name") == "main" and original
            and original.get("Dir") == directory
            and (original.get("TestGoFiles") or original.get("XTestGoFiles"))
        ):
            continue
        if not directory or not name or name.startswith(("-", ".")) or any(char.isspace() for char in name):
            raise PlanError("Go list returned an unsafe package identity")
        try:
            relative = Path(directory).resolve().relative_to(API)
        except ValueError as error:
            raise PlanError("Go list returned a package outside the backend module") from error
        package["relative_directory"] = PurePosixPath("api", *relative.parts)
        packages[name] = package
    return packages, incomplete


def reverse_closure(packages, changed):
    reverse = defaultdict(set)
    for name, package in packages.items():
        for field in ("Imports", "TestImports", "XTestImports"):
            for dependency in package.get(field, []):
                reverse[dependency].add(name)
    selected = set(changed)
    pending = deque(sorted(changed))
    while pending:
        for dependent in sorted(reverse[pending.popleft()] - selected):
            selected.add(dependent)
            pending.append(dependent)
    return selected & packages.keys()


def changes_since(base, revision):
    records = git(
        "diff", "--no-ext-diff", "--no-textconv", "--name-status", "-z",
        "--find-renames", base, revision, "--",
    ).split(b"\0")
    changes = []
    index = 0
    while index < len(records) and records[index]:
        status = records[index].decode("ascii")
        count = 2 if status.startswith(("R", "C")) else 1
        index += 1
        if index + count > len(records) or any(not value for value in records[index:index + count]):
            raise PlanError("Git returned an incomplete changed-file record")
        for value in records[index:index + count]:
            changes.append(PurePosixPath(os.fsdecode(value)))
        index += count
    return sorted(set(changes))


def documentation(path):
    if path.as_posix() in ROOT_DOCUMENTS:
        return True
    if path.parts[0] == "docs":
        return path.suffix.lower() in {".md", ".mdx", ".rst", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
    return path.name in {"README.md", "AGENTS.md"} and "testdata" not in path.parts


def plan(base=None, full=False):
    revision = resolve_revision("HEAD")
    ordinary, ordinary_incomplete = package_graph()
    tagged, tagged_incomplete = package_graph(integration=True)
    candidates = {
        name for name, package in {**ordinary, **tagged}.items()
        if package["relative_directory"].as_posix() in {
            f"api/{directory}" for directory in INTEGRATION_DIRECTORIES
        }
    }
    reasons = []

    def result(selected, integration, mode):
        return {
            "version": 1,
            "revision": revision,
            "mode": mode,
            "packages": sorted(selected),
            "integration_packages": sorted(integration),
            "reasons": list(dict.fromkeys(reasons)),
        }

    def all_packages(reason):
        reasons.append(reason)
        return result(ordinary, candidates, "full")

    if full:
        return all_packages("Full backend test selection requested")
    if not base:
        return all_packages("No PR base supplied; selecting all backend tests")
    try:
        base_revision = resolve_revision(base)
        merge_base = git("merge-base", base_revision, revision).decode().strip()
        changed_files = changes_since(merge_base, revision)
    except (PlanError, UnicodeError, ValueError):
        return all_packages("PR merge-base diff is unavailable; selecting all backend tests")

    reasons.append(f"Compared PR merge base {merge_base} with {revision}")
    if ordinary_incomplete or tagged_incomplete:
        return all_packages("Go package graph is incomplete; selecting all backend tests")

    owners = defaultdict(set)
    directories = defaultdict(set)
    for packages in (ordinary, tagged):
        for name, package in packages.items():
            directory = package["relative_directory"]
            directories[directory].add(name)
            for field in PACKAGE_FILES:
                for filename in package.get(field, []):
                    owners[directory / filename].add(name)

    changed_packages = set()
    unsafe = []
    go_changes = []
    for path in changed_files:
        if path.parts[0] == "web":
            continue
        if path.parts[0] == "api":
            if path.parts[:2] in {("api", "config"), ("api", "migrations")}:
                unsafe.append(f"Shared backend configuration or migrations changed: {path}")
                continue
            if path in owners:
                changed_packages.update(owners[path])
            elif path.suffix == ".go" and path.parent in directories:
                # Deleted Go files retain their package's reverse dependencies.
                changed_packages.update(directories[path.parent])
            elif not documentation(path):
                unsafe.append(f"Backend input has no proven package owner: {path}")
            if path.suffix == ".go":
                go_changes.append(path)
                current = ROOT / path
                if current.is_file() and UNSAFE_DIRECTIVE.search(current.read_bytes()):
                    unsafe.append(f"Build constraints or shared generation changed: {path}")
        elif not documentation(path):
            unsafe.append(f"Shared or unknown repository input changed: {path}")

    if go_changes and not unsafe:
        # Removed directives are absent from the current package inventory.
        diff = git(
            "diff", "--no-ext-diff", "--no-textconv", "--unified=0",
            merge_base, revision, "--", *(str(path) for path in go_changes),
        )
        removed = b"\n".join(line[1:] for line in diff.splitlines() if line.startswith(b"-"))
        if UNSAFE_DIRECTIVE.search(removed):
            unsafe.append("Build constraints or shared generation were removed")
    if unsafe:
        reasons.extend(unsafe)
        return all_packages("Unproven impact requires all backend tests")

    selected = reverse_closure(ordinary, changed_packages)
    integration = reverse_closure(tagged, changed_packages) & candidates
    if changed_packages:
        reasons.append("Selected changed packages and transitive consumers, including test imports")
    else:
        reasons.append("No backend test inputs changed")
    return result(selected, integration, "affected")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--base")
    mode.add_argument("--full", action="store_true")
    arguments = parser.parse_args()
    try:
        selected = plan(base=arguments.base, full=arguments.full)
        arguments.output.parent.mkdir(parents=True, exist_ok=True)
        arguments.output.write_text(json.dumps(selected, indent=2, ensure_ascii=True) + "\n")
    except (PlanError, OSError) as error:
        print(f"Go test planning failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
