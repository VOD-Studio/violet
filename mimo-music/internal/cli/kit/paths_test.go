package kit

import (
	"errors"
	"path/filepath"
	"testing"
)

// errSentinel 是注入 userConfigDir 用的错误,断言派生路径函数向上传播错误。
var errSentinel = errors.New("simulated config dir lookup failure")

// withTestConfigDir 把 userConfigDir 覆写为返回临时目录的函数,测试结束自动还原。
// 这是 PRD-0015 的核心 seam:所有路径派生自 userConfigDir,覆写它即可把整棵路径树
// 重定向到 t.TempDir(),不碰用户真实主目录。
func withTestConfigDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	orig := userConfigDir
	userConfigDir = func() (string, error) { return dir, nil }
	t.Cleanup(func() { userConfigDir = orig })
	return dir
}

func TestConfigDir_DelegatesToUserConfigDir(t *testing.T) {
	dir := withTestConfigDir(t)
	got, err := ConfigDir()
	if err != nil {
		t.Fatalf("ConfigDir() error: %v", err)
	}
	if got != dir {
		t.Errorf("ConfigDir() = %q, want %q", got, dir)
	}
}

func TestSessionPath_DerivesFromConfigDir(t *testing.T) {
	dir := withTestConfigDir(t)
	got, err := SessionPath()
	if err != nil {
		t.Fatalf("SessionPath() error: %v", err)
	}
	want := filepath.Join(dir, "session.json")
	if got != want {
		t.Errorf("SessionPath() = %q, want %q", got, want)
	}
}

func TestHistoryPath_DerivesFromConfigDir(t *testing.T) {
	dir := withTestConfigDir(t)
	got, err := HistoryPath()
	if err != nil {
		t.Fatalf("HistoryPath() error: %v", err)
	}
	want := filepath.Join(dir, "history.jsonl")
	if got != want {
		t.Errorf("HistoryPath() = %q, want %q", got, want)
	}
}

// TestPaths_PropagateUserConfigDirError 断言 userConfigDir 失败时,
// 所有派生路径函数把 error 向上传播(不静默回落)。
func TestPaths_PropagateUserConfigDirError(t *testing.T) {
	orig := userConfigDir
	userConfigDir = func() (string, error) { return "", errSentinel }
	t.Cleanup(func() { userConfigDir = orig })

	for _, tc := range []struct {
		name string
		fn   func() (string, error)
	}{
		{"ConfigDir", ConfigDir},
		{"SessionPath", SessionPath},
		{"HistoryPath", HistoryPath},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := tc.fn(); err == nil {
				t.Errorf("%s() error = nil, want non-nil", tc.name)
			}
		})
	}
}
