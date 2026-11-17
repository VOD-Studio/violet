#!/usr/bin/env python3
"""Require the jobs selected by the Web test plan, not merely any green jobs."""

import json
import sys


def check(needs: dict) -> None:
    if not isinstance(needs, dict):
        raise ValueError("Expected Web job results")

    def require(job: str, expected: str = "success") -> None:
        value = needs.get(job)
        result = value.get("result") if isinstance(value, dict) else None
        if result != expected:
            raise ValueError(f"{job}: expected {expected}, got {result!r}")

    for job in ("changes", "web-plan", "web-lint", "web-typecheck", "web-build"):
        require(job)
    outputs = needs["web-plan"].get("outputs")
    if not isinstance(outputs, dict):
        raise ValueError("Missing Web test plan outputs")
    for job, flag in (("web-unit", "has_unit"), ("web-contract", "has_contract"),
                      ("web-package", "has_packages")):
        if outputs.get(flag) not in ("true", "false"):
            raise ValueError(f"Invalid selection flag {flag}")
        require(job, "success" if outputs[flag] == "true" else "skipped")
    image = needs.get("web-image")
    if not isinstance(image, dict) or image.get("result") not in ("success", "skipped"):
        raise ValueError("Web image did not succeed or qualify for skipping")
    change_outputs = needs["changes"].get("outputs", {})
    if change_outputs.get("web_image") == "true":
        require("web-image")


def main() -> int:
    try:
        check(json.load(sys.stdin))
    except (ValueError, TypeError) as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1
    print("All planned Web checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
