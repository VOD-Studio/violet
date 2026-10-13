import os, pty, sys, time, signal, select, fcntl, termios, struct, re

def session(actions, rows=14, cols=60):
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp("node", ["node", "host.mjs"])
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    before = termios.tcgetattr(fd)
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
    pump(1.2)
    marks = [len(buf)]
    for a in actions:
        a(pid, fd); pump(0.8); marks.append(len(buf))
    end = time.time() + 3; st = None
    while time.time() < end:
        p, s = os.waitpid(pid, os.WNOHANG)
        if p: st = s; break
        time.sleep(0.05)
    if st is None: os.kill(pid, signal.SIGKILL); os.waitpid(pid, 0)
    return buf, marks, st, before, (termios.tcgetattr(fd) if st is not None else None)

fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

typed = lambda p, fd: os.write(fd, b"hello\r")
buf, marks, st, b, a = session([typed, lambda p, fd: os.write(fd, b"\x03")])
ok(b"echo: hello" in buf, "host still receives typed input and echoes it")
ok(b"\x1b[?1049" not in buf, "pet never enters the alternate screen")
ok(b"\x1b[?25l" not in buf, "pet never hides the cursor")
ok(buf.count(b"\x1b7") >= 5 and buf.count(b"\x1b8") >= 5, "frames drawn with save/restore cursor")
cups = set(re.findall(rb"\x1b\[(\d+);\d+H", buf))
rows_used = {int(x) for x in cups}
ok({1, 2, 3} <= rows_used, f"drawing happens in the host-assigned rows (rows used by CUP: {sorted(rows_used)[:8]})")
animated = len(set(re.findall(rb"\x1b\[2;\d+H([^\x1b]*)", buf))) > 2
ok(animated, "region content changes across frames")
ok(st is not None and os.WIFEXITED(st) and os.WEXITSTATUS(st) == 0, "host exits 0 on Ctrl+C")
ok(b"\x1b[r" in buf, "host's scroll region reset at exit")
ok(a is not None and a[3] == b[3], "termios unchanged after exit")
tail = buf[marks[-2]:]
ok(b"\x1b[2;" in tail and re.search(rb"\x1b\[1;\d+H {11}", tail) is not None, "pet region cleared on dispose")

buf, marks, st, b, a = session([lambda p, fd: os.kill(p, signal.SIGTERM)])
ok(st is not None and os.WIFEXITED(st) and os.WEXITSTATUS(st) == 0 and a[3] == b[3], "SIGTERM: clean exit, termios unchanged")

buf, marks, st, b, a = session([lambda p, fd: os.write(fd, b"quit\r")], rows=3, cols=5)
ok(st is not None and os.WIFEXITED(st) and os.WEXITSTATUS(st) == 0, "tiny terminal (3x5): no crash, clean exit")

if fails: sys.exit(1)
print("PASS: embedded pet leaves host input, cursor and terminal modes intact")
