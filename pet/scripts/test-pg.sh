#!/bin/sh
# 在一次性 Postgres 容器上运行存储契约验收,结束后删除容器。不触碰任何已有数据库。
set -e
cd "$(dirname "$0")/.."
NAME=pet-test-pg-$$
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=pet -e POSTGRES_DB=pet -p 127.0.0.1:55432:5432 postgres:16-alpine >/dev/null
trap 'docker stop "$NAME" >/dev/null 2>&1 || true' EXIT
i=0
until docker exec "$NAME" psql -U postgres -d pet -tAc 'select 1' >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -gt 80 ] && { echo "FAIL: postgres did not start"; exit 1; }
  sleep 0.5
done
PET_TEST_PG_URL="host=127.0.0.1 port=55432 user=postgres password=pet dbname=pet" cargo test -p pet-store -- --include-ignored "$@"
