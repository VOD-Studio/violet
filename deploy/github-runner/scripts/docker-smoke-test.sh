#!/usr/bin/env bash
# Run inside the runner container; all temporary Docker resources are named.
set -euo pipefail
test_id="runner-smoke-$(date +%s)-$$"
test_dir="/home/runner/_work/$test_id"
image="$test_id:local"
service="$test_id-http"
# shellcheck disable=SC2329 # Invoked by the EXIT trap.
cleanup() {
  docker rm -f "$service" >/dev/null 2>&1 || true
  docker image rm "$image" >/dev/null 2>&1 || true
  rm -rf -- "$test_dir"
}
trap 'cleanup' EXIT
mkdir -p "$test_dir"
printf '%s\n' 'github-runner-docker-ok' > "$test_dir/message.txt"
printf '%s\n' 'github-runner-service-ok' > "$test_dir/index.html"
cat > "$test_dir/Dockerfile" <<'EOF'
FROM busybox:1.37.0
COPY message.txt /message.txt
CMD ["cat", "/message.txt"]
EOF
docker version --format 'Docker client={{.Client.Version}} server={{.Server.Version}}'
docker compose version
docker buildx version
docker build -t "$image" "$test_dir"
[[ "$(docker run --rm "$image")" == github-runner-docker-ok ]]
docker run --rm --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$test_dir,dst=/github/workspace" \
  --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
  busybox:1.37.0 sh -c 'test -S /var/run/docker.sock && cat /github/workspace/message.txt && touch /github/workspace/container-write-ok'
[[ -f "$test_dir/container-write-ok" ]]
docker run -d --name "$service" --publish 127.0.0.1::8080 \
  --mount "type=bind,src=$test_dir,dst=/www,readonly" \
  busybox:1.37.0 httpd -f -p 8080 -h /www >/dev/null
port="$(docker inspect --format '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}' "$service")"
for _ in {1..20}; do
  if response="$(curl --silent --show-error --max-time 2 "http://127.0.0.1:$port/" 2>/dev/null)"; then
    [[ "$response" == github-runner-service-ok ]]
    printf '%s\n' 'PASS: build, run, shared workspace, action socket, and localhost service ports.'
    exit 0
  fi
  sleep 1
done
printf '%s\n' 'Service port test failed.' >&2
exit 1
