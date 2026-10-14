#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /home/runner

case "${1:-run}" in
  register)
    if [[ -f .runner ]]; then
      printf '%s\n' 'Runner is already registered; existing credentials were preserved.'
      exit 0
    fi
    if ! IFS= read -r registration_token || [[ -z "$registration_token" ]]; then
      printf '%s\n' 'A fresh GitHub registration token is required on stdin.' >&2
      exit 1
    fi
    args=(--unattended --url "$RUNNER_URL" --name "$RUNNER_NAME"
          --runnergroup "$RUNNER_GROUP" --labels "$RUNNER_LABELS" --work _work)
    # No --replace: do not silently replace another registered runner.
    # Auto-updates remain enabled and are retained in the persistent home volume.
    ./config.sh "${args[@]}" --token "$registration_token"
    unset registration_token
    chmod 600 .runner .credentials .credentials_rsaparams
    ;;
  run)
    # Workflow files must remain readable inside containers with another UID.
    umask 022
    if [[ ! -s .runner || ! -s .credentials ]]; then
      printf '%s\n' 'Runner is not registered. Run ./register.sh first.' >&2
      exit 1
    fi
    deadline=$((SECONDS + 120))
    until docker info >/dev/null 2>&1; do
      if ((SECONDS >= deadline)); then
        printf '%s\n' 'Timed out waiting for the dedicated Docker daemon.' >&2
        exit 1
      fi
      sleep 2
    done
    exec ./run.sh
    ;;
  *)
    printf '%s\n' 'Usage: runner-entrypoint.sh {register|run}' >&2
    exit 2
    ;;
esac
