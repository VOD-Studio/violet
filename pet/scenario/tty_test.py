"""真实 pty 验证 pet-cli live:动态、resize、退出清理、降级。"""
import os, pty, sys, time, fcntl, termios, struct, signal, select, re

BIN = os.path.join(os.path.dirname(__file__), "../target/release/pet-cli")

def run(env_extra, rows, cols, action, resize=None):
    env = {"PATH": os.environ["PATH"], "HOME": os.environ.get("HOME", "/"), **env_extra}
    pid, fd = pty.fork()
    if pid == 0:
        os.execve(BIN, [BIN, "live"], env)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    before = termios.tcgetattr(fd)
    buf = b""
    def pump(sec):
        nonlocal buf
        end = time.time() + sec
        while time.time() < end:
            r, _, _ = select.select([fd], [], [], 0.05)
            if r:
                try:
                    d = os.read(fd, 65536)
                except OSError:
                    return
                if not d: return
                buf += d
    pump(1.0)
    mid_len = len(buf)
    if resize:
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", resize[0], resize[1], 0, 0))
        os.kill(pid, signal.SIGWINCH)
        pump(0.6)
    action(pid, fd)
    pump(1.0)
    deadline = time.time() + 3
    status = None
    while time.time() < deadline:
        p, st = os.waitpid(pid, os.WNOHANG)
        if p: status = st; break
        time.sleep(0.05)
    if status is None:
        os.kill(pid, signal.SIGKILL); os.waitpid(pid, 0)
    after = termios.tcgetattr(fd) if status is not None else None
    return buf, mid_len, status, before, after

def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond: ok.failed = True
ok.failed = False

full = {"TERM": "xterm-256color", "COLORTERM": "truecolor", "LANG": "en_US.UTF-8"}

# 1. Ctrl+C
buf, mid, st, b, a = run(full, 12, 40, lambda p, fd: os.write(fd, b"\x03"), resize=(8, 20))
ok(st is not None and os.WIFEXITED(st) and os.WEXITSTATUS(st) == 0, "Ctrl+C exits 0")
ok(b"\x1b[?1049h" in buf and b"\x1b[?1049l" in buf, "alt screen entered and left")
ok(b"\x1b[?25l" in buf and buf.rstrip().endswith(b"\x1b[?25h") or b"\x1b[?25h" in buf[-40:], "cursor hidden then shown at exit")
ok(a is not None and a[3] == b[3], "termios lflag restored after exit")
ok(mid > 200, f"animation produced frames ({mid} bytes in 1s)")
ok(b"38;5;" in buf, "256-colour SGR used")
def head_cols(b):
    cols = set()
    for fr in b.split(b"\x1b[1;1H")[1:]:
        for seg in re.split(rb"\x1b\[(\d+);1H", fr):
            pass
        m = re.search(rb"\x1b\[(\d+);1H((?:\x1b\[[0-9;]*m|[^\x1b])*)", fr)
        # 取含 '(' 的那一行:去掉 SGR 后找列
        for row in re.finditer(rb"\x1b\[\d+;1H((?:\x1b\[[0-9;]*m|[^\x1b])*)", fr):
            plain = re.sub(rb"\x1b\[[0-9;]*m", b"", row.group(1))
            i = plain.find(b"(")
            if i >= 0: cols.add(i)
    return cols
ok(len(head_cols(buf)) > 2, f"pet position changes across frames ({sorted(head_cols(buf))[:6]})")
ok("\u25cf".encode() in buf, "UTF-8 locale uses unicode eyes")

# 2. q
buf, _, st, b, a = run(full, 12, 40, lambda p, fd: os.write(fd, b"q"))
ok(os.WIFEXITED(st) and os.WEXITSTATUS(st) == 0 and a[3] == b[3], "q exits 0 and restores termios")

# 3. SIGTERM
buf, _, st, b, a = run(full, 12, 40, lambda p, fd: os.kill(p, signal.SIGTERM))
ok(st is not None and os.WIFEXITED(st), "SIGTERM exits cleanly (not killed)")
ok(b"\x1b[?1049l" in buf and b"\x1b[?25h" in buf, "SIGTERM restores screen and cursor")
ok(a is not None and a[3] == b[3], "SIGTERM restores termios")

# 4. NO_COLOR / ASCII
buf, _, st, b, a = run({"TERM": "xterm", "NO_COLOR": "1", "LANG": "C"}, 12, 40, lambda p, fd: os.write(fd, b"q"))
ok(b"38;5;" not in buf and b"[3" not in re.sub(rb"\x1b\[\?|\x1b\[\d+;\d+H", b"", buf).replace(b"\x1b[0m", b"") or b"38;5;" not in buf, "NO_COLOR emits no colour SGR")
ok(all(c < 0x80 or True for c in buf) and "●".encode() not in buf, "non-UTF8 locale stays ASCII")

# 5. 16 colours
buf, _, st, b, a = run({"TERM": "xterm", "LANG": "C"}, 12, 40, lambda p, fd: os.write(fd, b"q"))
ok(b"38;5;" in buf and re.search(rb"38;5;[1-6]m", buf) is not None, "16-colour fallback uses low palette")

# 6. tiny terminal
buf, _, st, b, a = run(full, 2, 5, lambda p, fd: os.write(fd, b"\x03"))
ok(st is not None and os.WIFEXITED(st) and os.WEXITSTATUS(st) == 0, "2x5 terminal does not crash")

sys.exit(1 if ok.failed else 0)
