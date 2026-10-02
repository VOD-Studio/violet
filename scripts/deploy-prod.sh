#!/usr/bin/env bash
set -euo pipefail

# Runner 不可用时，通过 SSH 调用与 Actions 相同的部署事务。
remote_host=rua
manifest=''
source_root=''
rollback=''
while (($#)); do
    case "$1" in
        --host) remote_host="${2:?--host needs a value}"; shift 2 ;;
        --manifest) manifest="${2:?--manifest needs a file}"; shift 2 ;;
        --source-root) source_root="${2:?--source-root needs a remote checkout}"; shift 2 ;;
        --rollback) rollback="${2:?--rollback needs an archived version}"; shift 2 ;;
        -h|--help)
            echo '用法: deploy-prod.sh [--host rua] --rollback <归档版本>'
            echo '      deploy-prod.sh [--host rua] --manifest <本地JSON> --source-root <服务器Git检出目录>'
            exit 0 ;;
        *) echo "不支持的参数: $1；使用 --help 查看统一部署入口" >&2; exit 1 ;;
    esac
done
if [[ -n "$rollback" ]]; then
    [[ -z "$manifest" && -z "$source_root" ]] || { echo '回滚不能同时指定 manifest/source-root' >&2; exit 1; }
else
    [[ -f "$manifest" && -n "$source_root" ]] || { echo '正向部署必须指定 manifest 文件与服务器 source-root' >&2; exit 1; }
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
remote_tmp=$(ssh "$remote_host" 'mktemp -d /tmp/violet-deploy.XXXXXXXXXX')
[[ "$remote_tmp" =~ ^/tmp/violet-deploy\.[a-zA-Z0-9]+$ ]] || { echo '服务器返回了无效临时目录' >&2; exit 1; }
trap 'ssh "$remote_host" "rm -rf -- $remote_tmp" >/dev/null 2>&1 || true' EXIT
scp "$script_dir/deploy-release.py" "$remote_host:$remote_tmp/deploy-release.py"
args=(python3 "$remote_tmp/deploy-release.py")
if [[ -n "$rollback" ]]; then
    args+=(--rollback "$rollback")
else
    scp "$manifest" "$remote_host:$remote_tmp/manifest.json"
    args+=(--manifest "$remote_tmp/manifest.json" --source-root "$source_root")
fi
printf -v remote_command '%q ' "${args[@]}"
# bash 在远端解析 argv；不要求用户默认 shell 支持 bash 数组或 quoting。
printf -v remote_command 'bash -lc %q' "$remote_command"
# shellcheck disable=SC2029 # remote_command 已逐参数用 printf %q 转义。
ssh "$remote_host" "$remote_command"
