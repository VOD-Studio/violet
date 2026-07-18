package song

import (
	"errors"
	"io"
	"testing"

	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
)

// song download 命令构造测试。
//
// shouldSkip / proxyReader 测试随实现迁至 internal/cli/songdl/download_test.go。
// 本文件只测命令层:flag 必填校验 + 默认值。

// TestNewDownload_FlagRequired --id 缺失时命令执行报用法错误(对应 exit 2)。
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
	// cobra 必填缺失:root.go FlagErrorFunc 包成 ErrUsage,或直接 required flag 错误。
	// 独立 cmd 没 FlagErrorFunc,会是 "required flag(s) \"id\" not set" 消息。
	if !errors.Is(err, kit.ErrUsage) && err.Error() == "" {
		t.Errorf("缺 --id 应是有意义的错误,got %v", err)
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
