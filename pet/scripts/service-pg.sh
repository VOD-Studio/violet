#!/bin/sh
# 在一次性 Postgres 容器上运行服务端到端验收，结束后删除容器。
set -e
cd "$(dirname "$0")/.."
NAME=pet-e2e-pg-$$
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=pet -e POSTGRES_DB=pet -p 127.0.0.1:55433:5432 postgres:16-alpine >/dev/null
trap 'docker stop "$NAME" >/dev/null 2>&1 || true' EXIT
i=0
until docker exec "$NAME" psql -U postgres -d pet -tAc 'select 1' >/dev/null 2>&1; do
  i=$((i + 1)); [ "$i" -gt 80 ] && { echo "FAIL: postgres did not start"; exit 1; }
  sleep 0.5
done
PET_TEST_PG_URL="host=127.0.0.1 port=55433 user=postgres password=pet dbname=pet" ./consumers/service-e2e.sh
