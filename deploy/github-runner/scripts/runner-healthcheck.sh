#!/usr/bin/env bash
set -euo pipefail
[[ -s /home/runner/.runner && -s /home/runner/.credentials ]] || exit 1
for comm_file in /proc/[0-9]*/comm; do
  IFS= read -r process_name < "$comm_file" 2>/dev/null || continue
  if [[ "$process_name" == Runner.Listener ]]; then
    docker info >/dev/null 2>&1
    exit $?
  fi
done
exit 1
