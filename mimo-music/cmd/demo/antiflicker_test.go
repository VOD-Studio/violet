package main

import (
	"bytes"
	"testing"
)

// TestAntiflicker_ReplacesEdJ 单次 Write 含完整 \x1b[J,应替换为 \x1b[K。
func TestAntiflicker_ReplacesEdJ(t *testing.T) {
	t.Parallel()
	var out bytes.Buffer
	w := newAntiflickerWriter(&out)
	in := "content\n\x1b[2A\x1b[Jnew\n"
	if _, err := w.Write([]byte(in)); err != nil {
		t.Fatal(err)
	}
	got := out.String()
	if bytes.Contains([]byte(got), []byte("\x1b[J")) {
		t.Errorf("still has \\x1b[J: %q", got)
	}
	if !bytes.Contains([]byte(got), []byte("\x1b[2A\x1b[K")) {
		t.Errorf("should have \\x1b[2A\\x1b[K: %q", got)
	}
}

// TestAntiflicker_MultipleEdJ 一帧多个 \x1b[J 全替换(理论多 bar 每帧1个,但容错)。
func TestAntiflicker_MultipleEdJ(t *testing.T) {
	t.Parallel()
	var out bytes.Buffer
	w := newAntiflickerWriter(&out)
	in := "\x1b[J\x1b[J\x1b[J"
	w.Write([]byte(in))
	if got := out.String(); got != "\x1b[K\x1b[K\x1b[K" {
		t.Errorf("got %q", got)
	}
}

// TestAntiflicker_SplitAcrossWrites \x1b[J 跨两次 Write(\x1b[ 和 J 分开)。
// 关键:carry 机制要正确拼接,不能误替换或漏替换。
func TestAntiflicker_SplitAcrossWrites(t *testing.T) {
	t.Parallel()
	var out bytes.Buffer
	w := newAntiflickerWriter(&out)
	// 模拟 mpb 分多次 Write:内容...\x1b[2A 然后 \x1b[J 然后 新内容
	w.Write([]byte("old\n\x1b[2A"))
	w.Write([]byte("\x1b[Jnew\n"))
	got := out.String()
	if bytes.Contains([]byte(got), []byte("\x1b[J")) {
		t.Errorf("should not contain \\x1b[J after split: %q", got)
	}
	// 光标上移保留,\x1b[J 变 \x1b[K
	if !bytes.Contains([]byte(got), []byte("\x1b[2A\x1b[Knew")) {
		t.Errorf("split should still produce \\x1b[2A\\x1b[Knew: %q", got)
	}
}

// TestAntiflicker_PreservesOtherEscapes 其他转义序列(颜色 \x1b[38;2;...)不受影响。
func TestAntiflicker_PreservesOtherEscapes(t *testing.T) {
	t.Parallel()
	var out bytes.Buffer
	w := newAntiflickerWriter(&out)
	in := "\x1b[38;2;64;220;200mfoo\x1b[0m\x1b[J"
	w.Write([]byte(in))
	got := out.String()
	// 颜色序列完整保留
	if !bytes.Contains([]byte(got), []byte("\x1b[38;2;64;220;200m")) {
		t.Errorf("color escape damaged: %q", got)
	}
	// \x1b[0m 保留
	if !bytes.Contains([]byte(got), []byte("\x1b[0m")) {
		t.Errorf("reset escape damaged: %q", got)
	}
	// \x1b[J → \x1b[K
	if !bytes.HasSuffix([]byte(got), []byte("\x1b[K")) {
		t.Errorf("should end with \\x1b[K: %q", got)
	}
}
