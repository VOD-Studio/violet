#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ -t 0 ]]; then
  IFS= read -r -s -p 'GitHub registration token (hidden): ' registration_token
  printf '\n'
else
  IFS= read -r registration_token
fi
[[ -n "$registration_token" ]] || { printf '%s\n' 'Token cannot be empty.' >&2; exit 1; }
printf '%s\n' "$registration_token" | docker compose --profile setup run --rm -T --no-deps register
unset registration_token
docker compose up -d --wait --wait-timeout 180
