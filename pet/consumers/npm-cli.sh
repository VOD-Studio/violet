#!/bin/sh
# 在仓库外、PATH 不含 cargo 的环境,只用两个 tarball 安装并运行 pet-cli。
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
KEY=$("$HERE/../packages/pet-cli-npm/build.sh" "$WORK/pkg")
(cd "$WORK/pkg/platform" && pnpm pack --pack-destination "$WORK" >/dev/null)
# 本地验证用 tarball 代替 registry:把主包的该平台依赖指向本地文件。
node -e "
const fs=require('fs');const p='$WORK/pkg/main/package.json';const j=JSON.parse(fs.readFileSync(p));
const t=fs.readdirSync('$WORK').find(f=>f.startsWith('violet-pet-cli-')&&f.endsWith('.tgz'));
for(const k of Object.keys(j.optionalDependencies)) if(k.endsWith('-$KEY')) j.optionalDependencies[k]='file:$WORK/'+t; else delete j.optionalDependencies[k];
fs.writeFileSync(p,JSON.stringify(j));"
(cd "$WORK/pkg/main" && pnpm pack --pack-destination "$WORK" >/dev/null)
mkdir "$WORK/app" && cd "$WORK/app" && echo '{"name":"c","private":true}' > package.json
CLEAN=$(echo "$PATH" | tr ':' '\n' | grep -v cargo | paste -sd: -)
env PATH="$CLEAN" pnpm add -s "$WORK"/violet-pet-cli-0.0.0.tgz >/dev/null 2>&1 || env PATH="$CLEAN" pnpm add -s "$(ls "$WORK"/*.tgz | grep -v 'cli-'"$KEY" | head -1)"
env PATH="$CLEAN" sh -c 'command -v cargo >/dev/null && { echo "FAIL: cargo visible"; exit 1; }; true'
PLAT=$(find node_modules/.pnpm -type d -path "*node_modules/@violet/pet-cli-$KEY" | head -1)
test -x "$PLAT/bin/pet-cli" || { echo "FAIL: platform package not installed"; exit 1; }
OUT=$(echo '{"op":"frame","species":1,"genes":[1,2,3,4,5,6,7,8],"pose":"idle","charset":"ascii","w":10,"h":3,"t":"0"}' | env PATH="$CLEAN" pnpm exec pet-cli exec)
echo "$OUT" | grep -q '"ok":true' || { echo "FAIL: exec via launcher: $OUT"; exit 1; }
LIVE=$(env PATH="$CLEAN" pnpm exec pet-cli live | cat)
echo "$LIVE" | grep -q '"pose"' && ! echo "$LIVE" | grep -q "$(printf '\033')" || { echo "FAIL: non-tty live output"; exit 1; }
# 经启动器的真实 TTY:Ctrl+C 与 SIGTERM 都必须让原生进程恢复终端并以 0 退出
python3 - "$PLAT" <<'PY'
import os, pty, sys, time, signal, select, fcntl, termios, struct
plat = sys.argv[1]
def run(action):
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp("node", ["node", "node_modules/@violet/pet-cli/bin/pet-cli.cjs", "live"])
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 12, 40, 0, 0))
    buf = b""
    def pump(s):
        nonlocal buf
        end = time.time() + s
        while time.time() < end:
            r, _, _ = select.select([fd], [], [], 0.05)
            if r:
                try: d = os.read(fd, 65536)
                except OSError: return
                if not d: return
                buf += d
    pump(2.0)
    action(pid, fd)
    pump(1.5)
    end = time.time() + 3; st = None
    while time.time() < end:
        p, s = os.waitpid(pid, os.WNOHANG)
        if p: st = s; break
        time.sleep(0.05)
    if st is None: os.kill(pid, signal.SIGKILL); os.waitpid(pid, 0)
    return buf, st
for name, act in [("Ctrl+C", lambda p, fd: os.write(fd, b"\x03")), ("SIGTERM", lambda p, fd: os.kill(p, signal.SIGTERM))]:
    buf, st = run(act)
    good = st is not None and os.WIFEXITED(st) and b"\x1b[?1049l" in buf and b"\x1b[?25h" in buf
    print(("ok   " if good else "FAIL ") + f"via launcher: {name} restores terminal (status={st})")
    if not good: sys.exit(1)
PY
# 缺少平台包时的错误
rm -rf "$PLAT"
ERR=$(env PATH="$CLEAN" node node_modules/@violet/pet-cli/bin/pet-cli.cjs exec 2>&1 </dev/null || true)
echo "$ERR" | grep -q "no prebuilt binary" || { echo "FAIL: missing-platform message: $ERR"; exit 1; }
echo "PASS: tarball-only install on $KEY runs exec and live(non-tty); missing platform package gives actionable error"
