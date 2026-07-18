package song

import (
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
)

// song download 命令构造测试。
//
// shouldSkip / proxyReader 测试随实现迁至 internal/cli/songdl/download_test.go。
// 本文件只测命令层:flag 必填校验 + 默认值。

// TestNewDownload_FlagRequired --id 缺失(且无位置参数)时 ResolveID 报用法错误(exit 2)。
func TestNewDownload_FlagRequired(t *testing.T) {
	t.Parallel()
	k := kit.New()
	cmd := newDownload(k)
	cmd.SetOut(io.Discard)
	cmd.SetErr(io.Discard)
	err := cmd.Execute()
	if err == nil {
		t.Fatal("缺 --id 应报错")
	}
	// ResolveID「缺少 id」→ kit.ErrUsage(exit 2)。
	if !errors.Is(err, kit.ErrUsage) {
		t.Errorf("缺 id 应 ErrUsage, got %v", err)
	}
}

// TestNewDownload_PositionalArgs 位置参数 Args 校验(issue #24):
// 2+ 个位置参数 → cobra MaximumNArgs(1) 拒绝。单个位置参数的解析逻辑在 kit.ResolveID
// 已充分测试(不在此重复,避免触发真实网络下载)。
func TestNewDownload_PositionalArgs(t *testing.T) {
	t.Parallel()
	k := kit.New()
	cmd := newDownload(k)
	cmd.SetOut(io.Discard)
	cmd.SetErr(io.Discard)
	cmd.SetArgs([]string{"1", "2"})
	if err := cmd.Execute(); err == nil || !strings.Contains(err.Error(), "at most 1 arg") {
		t.Errorf("2 个位置参数应被拒绝, got %v", err)
	}
}

// TestNewDownload_DefaultFlags flag 默认值正确。
func TestNewDownload_DefaultFlags(t *testing.T) {
	t.Parallel()
	k := kit.New()
	cmd := newDownload(k)
	if lvl, err := cmd.Flags().GetInt("level"); err != nil || lvl != 1 {
		t.Errorf("--level 默认应为 1, got %v (err %v)", lvl, err)
	}
	if out, err := cmd.Flags().GetString("out"); err != nil || out != "." {
		t.Errorf("--out 默认应为 '.', got %q (err %v)", out, err)
	}
	if f, err := cmd.Flags().GetBool("force"); err != nil || f {
		t.Errorf("--force 默认应为 false, got %v (err %v)", f, err)
	}
}
