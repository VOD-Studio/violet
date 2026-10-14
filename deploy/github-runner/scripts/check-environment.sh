#!/usr/bin/env bash
set -euo pipefail

[[ "$(id -u)" != 0 ]] || { echo 'Run environment checks as the runner user.' >&2; exit 1; }
for tool in curl git jq tar xz unzip cc c++ make python3 docker; do
  command -v "$tool"
done
python3 -m pip --version
python3 - <<'PY'
import ctypes

for library in ('libatomic.so.1', 'libnss3.so', 'libgbm.so.1', 'libasound.so.2',
                'libatk-bridge-2.0.so.0', 'libX11.so.6', 'libxkbcommon.so.0'):
    ctypes.CDLL(library)
    print(f'Loaded {library}')
PY

test_dir="$(mktemp -d)"
trap 'rm -rf -- "$test_dir"' EXIT
printf '%s\n' 'runner-environment-ok' > "$test_dir/message"
xz -c "$test_dir/message" > "$test_dir/message.xz"
xz -dc "$test_dir/message.xz" | cmp - "$test_dir/message"
printf '%s\n' 'int main(void) { return 0; }' > "$test_dir/check.c"
cc -Wall -Werror "$test_dir/check.c" -o "$test_dir/check-c"
"$test_dir/check-c"
printf '%s\n' '#include <iostream>' 'int main() { std::cout << "C++ ready\n"; }' > "$test_dir/check.cpp"
c++ -Wall -Werror "$test_dir/check.cpp" -o "$test_dir/check-cpp"
"$test_dir/check-cpp"
docker --version
docker compose version
docker buildx version
echo 'PASS: runner system dependencies, shared libraries, extraction and compilation.'
