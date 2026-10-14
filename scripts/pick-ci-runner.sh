#!/usr/bin/env bash
set -euo pipefail

fallback='["ubuntu-latest"]'
preferred='["self-hosted","Linux","X64","omarchy"]'
required="${REQUIRE_SELF_HOSTED:-false}"

fallback_or_fail() {
  echo "reason=$1" >> "$GITHUB_STEP_SUMMARY"
  if [[ "$required" == true ]]; then
    echo "::error::Self-hosted acceptance cannot fall back: $1" >&2
    exit 1
  fi
  echo "labels=$fallback" >> "$GITHUB_OUTPUT"
  exit 0
}

if [[ "$required" == true && "$EVENT" != push && "$EVENT" != workflow_dispatch ]]; then
  fallback_or_fail 'acceptance requires push or workflow_dispatch'
fi
if [[ "$required" != true && "$ENABLED" != true ]]; then
  fallback_or_fail 'SELF_HOSTED_RUNNER is not true'
fi
if [[ "$EVENT" == pull_request && "$HEAD_REPO" != "$REPO" ]]; then
  fallback_or_fail 'fork pull request'
fi
if [[ -z "$TOKEN" ]]; then
  fallback_or_fail 'RUNNER_STATUS_TOKEN not set'
fi

info=$(curl -fsS --max-time 10 \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/orgs/$ORG/actions/runners/$RUNNER_ID" 2>/dev/null) || info=''

if ! jq -e --argjson required "$required" \
  '.status == "online" and ($required or .busy == false) and
   ([.labels[].name] | index("omarchy") != null)' <<< "$info" >/dev/null 2>&1; then
  fallback_or_fail "runner $RUNNER_ID unavailable or labels mismatched"
fi

echo "reason=runner $RUNNER_ID selected; require_self_hosted=$required" >> "$GITHUB_STEP_SUMMARY"
echo "labels=$preferred" >> "$GITHUB_OUTPUT"
