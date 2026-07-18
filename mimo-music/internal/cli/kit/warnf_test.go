package kit

import (
	"bytes"
	"strings"
	"testing"
)

// Warnf 验收(issue #16):格式化打印到 stderr,所有模式(--json/非TTY)都输出。
// 警告是非数据性提示(如「元数据写入失败」),管道/JSON 场景也要让用户看到。

// TestWarnf_WritesToErr Warnf 写入 Kit.Err(默认 os.Stderr),格式化生效。
func TestWarnf_WritesToErr(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	k := &Kit{Err: &buf}
	k.Warnf("⚠ 元数据写入失败: %v", "tag write error")
	got := buf.String()
	if !strings.Contains(got, "⚠ 元数据写入失败") {
		t.Errorf("应含警告文案,got %q", got)
	}
	if !strings.Contains(got, "tag write error") {
		t.Errorf("应含格式化参数,got %q", got)
	}
	if !strings.HasSuffix(got, "\n") {
		t.Errorf("应以换行结尾,got %q", got)
	}
}

// TestWarnf_ErrFallback Err 未设时回退 os.Stderr(不 panic,写真实 stderr)。
func TestWarnf_ErrFallback(t *testing.T) {
	t.Parallel()
	k := &Kit{}
	// 不 panic 即可(写到真实 os.Stderr,测试不断言内容)。
	k.Warnf("test warning %d", 1)
}

// TestWarnf_AlwaysEmits 警告在 --json 模式也输出(非数据,不抑制)。
// 对比 Render:--json 时结果走 protojson,但警告仍要 stderr。
func TestWarnf_AlwaysEmits(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	k := &Kit{JSON: true, Err: &buf}
	k.Warnf("⚠ 无歌词")
	if buf.String() == "" {
		t.Error("--json 模式 Warnf 应仍输出警告")
	}
}
