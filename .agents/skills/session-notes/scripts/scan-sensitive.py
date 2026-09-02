#!/usr/bin/env python3
"""Scan one UTF-8 text file for sensitive literals."""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Pattern


@dataclass(frozen=True)
class SensitivePattern:
    name: str
    expression: Pattern[str]


PATTERNS: tuple[SensitivePattern, ...] = (
    SensitivePattern(
        "ip_literal",
        re.compile(
            r"(?<![\d.])"
            r"(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}"
            r"(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)"
            r"(?![\d.])"
        ),
    ),
    SensitivePattern(
        "url_cred",
        re.compile(
            r"\b[a-zA-Z][a-zA-Z0-9+.-]*://"
            r"[^\s:/@]+:[^\s/@]+@[^\s]+"
        ),
    ),
    SensitivePattern(
        "secret_assign",
        re.compile(
            r"(?i)\b(?:token|secret|password|passwd|api[_-]?key|apikey)"
            r"\s*[:=]\s*[\"']?([^\s\"']{8,})"
        ),
    ),
    SensitivePattern(
        "known_prefix",
        re.compile(
            r"(?:"
            r"violet_pat_[A-Za-z0-9_-]+"
            r"|sk-[A-Za-z0-9_-]+"
            r"|ghp_[A-Za-z0-9_]+"
            r"|gho_[A-Za-z0-9_]+"
            r"|github_pat_[A-Za-z0-9_]+"
            r"|AKIA[A-Z0-9]{16}"
            r"|xox[baprs]-[A-Za-z0-9-]+"
            r")"
        ),
    ),
    SensitivePattern(
        "private_key",
        re.compile(r"-----BEGIN [^-]*PRIVATE KEY-----"),
    ),
    SensitivePattern(
        "ssh_endpoint",
        re.compile(r"\bssh\s+(?:-p\s+\d+|[^\s]+@[^\s]+)"),
    ),
    SensitivePattern(
        "dsn",
        re.compile(r"\b(?:postgres|postgresql|mysql|redis|amqp)://[^\s]+"),
    ),
)


def clipped_fragment(line: str, start: int, end: int) -> str:
    """Return the matched fragment truncated to at most 60 characters."""
    fragment = line[start:end].strip()
    if len(fragment) <= 60:
        return fragment
    return f"{fragment[:59]}…"


def scan(content: str) -> list[str]:
    findings: list[tuple[int, int, int, str]] = []

    for line_number, line in enumerate(content.splitlines(), start=1):
        for pattern_index, pattern in enumerate(PATTERNS):
            for match in pattern.expression.finditer(line):
                findings.append(
                    (
                        line_number,
                        match.start(),
                        pattern_index,
                        f"{line_number}: {pattern.name}: "
                        f"{clipped_fragment(line, match.start(), match.end())}",
                    )
                )

    findings.sort(key=lambda finding: (finding[0], finding[1], finding[2]))
    return [finding[3] for finding in findings]


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"usage: {Path(argv[0]).name} <file>", file=sys.stderr)
        return 2

    try:
        content = Path(argv[1]).read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        print(f"scan_error: {error}", file=sys.stderr)
        return 2

    findings = scan(content)
    if not findings:
        print("clean")
        return 0

    print("\n".join(findings))
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
