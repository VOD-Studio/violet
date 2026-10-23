#!/usr/bin/env python3
"""Check required CI results against the selected impact from a needs JSON on stdin."""

import json
import sys


def check(needs: dict) -> None:
    if not isinstance(needs, dict):
        raise ValueError("Expected job results")

    def require_result(job: str, expected: str) -> None:
        value = needs.get(job)
        result = value.get("result") if isinstance(value, dict) else None
        if result != expected:
            raise ValueError(f"{job}: expected {expected}, got {result!r}")

    for job in ("changes", "runner", "infrastructure"):
        require_result(job, "success")

    outputs = needs["changes"].get("outputs")
    if not isinstance(outputs, dict):
        raise ValueError("Missing change detection outputs")
    for name in ("api", "web", "infrastructure"):
        if outputs.get(name) not in ("true", "false"):
            raise ValueError(f"Invalid {name} impact flag")

    api = outputs["api"] == "true"
    web = outputs["web"] == "true"
    for job, selected in (
        ("backend", api),
        ("frontend", web),
        ("dependency-scan", api or web),
    ):
        require_result(job, "success" if selected else "skipped")


def main() -> int:
    try:
        check(json.load(sys.stdin))
    except ValueError as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1
    print("All selected CI checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
