#!/usr/bin/env python3
"""Require every job in a needs JSON on stdin to succeed; --optional jobs may also be skipped."""

import argparse
import json
import sys


def check(needs: dict, optional: frozenset = frozenset()) -> None:
    if not isinstance(needs, dict) or not needs:
        raise ValueError("Expected job results")

    failures = []
    for job, value in needs.items():
        result = value.get("result") if isinstance(value, dict) else None
        if result == "success" or (result == "skipped" and job in optional):
            continue
        failures.append(f"{job}: expected success, got {result!r}")
    if failures:
        raise ValueError("; ".join(failures))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--optional", nargs="*", default=[], help="jobs allowed to be skipped")
    args = parser.parse_args()
    try:
        check(json.load(sys.stdin), frozenset(args.optional))
    except ValueError as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1
    print("All jobs in the group passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
