package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/require"

	"github.com/VOD-Studio/mimo-music/internal/cli/doctor"
)

// withTestHome 设临时 HOME,返回路径(隔离,不碰真实 ~/.zshrc 等)。
func withTestHome(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("HOME", dir)
	return dir
}

func TestCompletionScriptPath(t *testing.T) {
	dir := withTestHome(t)
	cases := []struct {
		shell string
		want  string
	}{
		{"zsh", filepath.Join(dir, ".zsh", "completions", "_musicctl")},
		{"bash", filepath.Join(dir, ".local", "share", "bash-completion", "completions", "musicctl")},
		{"fish", filepath.Join(dir, ".config", "fish", "completions", "musicctl.fish")},
	}
	for _, tc := range cases {
		t.Run(tc.shell, func(t *testing.T) {
			got, err := completionScriptPath(tc.shell)
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestCompletionScriptPath_UnsupportedShell(t *testing.T) {
	withTestHome(t)
	_, err := completionScriptPath("powershell")
	require.Error(t, err)
}

func TestWriteCompletionScript_FirstWrite_Changed(t *testing.T) {
	withTestHome(t)
	changed, path, err := writeCompletionScript("zsh", []byte("# script"))
	require.NoError(t, err)
	require.True(t, changed, "首次写应 changed=true")
	require.FileExists(t, path)
}

func TestWriteCompletionScript_Idempotent(t *testing.T) {
	withTestHome(t)
	script := []byte("# script")
	_, _, _ = writeCompletionScript("zsh", script)
	changed, _, err := writeCompletionScript("zsh", script)
	require.NoError(t, err)
	require.False(t, changed, "相同内容再写应 changed=false")
}

func TestWriteCompletionScript_ContentChange_Changed(t *testing.T) {
	withTestHome(t)
	_, _, _ = writeCompletionScript("zsh", []byte("# v1"))
	changed, _, err := writeCompletionScript("zsh", []byte("# v2"))
	require.NoError(t, err)
	require.True(t, changed, "内容变化应 changed=true")
}

// runInstallCompletion 端到端:用真实 NewRootCommand 生成脚本,隔离 HOME。

func TestRunInstallCompletion_ZshDoesNotTouchZshrc(t *testing.T) {
	dir := withTestHome(t)
	t.Setenv("SHELL", "/bin/zsh")
	root := &cobra.Command{Use: "musicctl"}
	var out strings.Builder
	require.NoError(t, runInstallCompletion(root, &out))
	// 脚本应生成。
	require.FileExists(t, filepath.Join(dir, ".zsh", "completions", "_musicctl"))
	// 关键(路线 A):绝不创建/改写 .zshrc。
	_, err := os.Stat(filepath.Join(dir, ".zshrc"))
	require.True(t, os.IsNotExist(err), "install-completion 不应碰 .zshrc")
	// 输出应提示手动加 fpath。
	require.Contains(t, out.String(), "fpath")
}

func TestRunInstallCompletion_BashNoFpathHint(t *testing.T) {
	dir := withTestHome(t)
	t.Setenv("SHELL", "/bin/bash")
	root := &cobra.Command{Use: "musicctl"}
	var out strings.Builder
	require.NoError(t, runInstallCompletion(root, &out))
	require.FileExists(t, filepath.Join(dir, ".local", "share", "bash-completion", "completions", "musicctl"))
	// bash 自动加载,不应有手动 fpath 提示。
	require.NotContains(t, out.String(), "fpath")
}

func TestRunInstallCompletion_FishNoFpathHint(t *testing.T) {
	dir := withTestHome(t)
	t.Setenv("SHELL", "/usr/local/bin/fish")
	root := &cobra.Command{Use: "musicctl"}
	var out strings.Builder
	require.NoError(t, runInstallCompletion(root, &out))
	require.FileExists(t, filepath.Join(dir, ".config", "fish", "completions", "musicctl.fish"))
	require.NotContains(t, out.String(), "fpath")
}

func TestRunInstallCompletion_UnknownShell_Error(t *testing.T) {
	withTestHome(t)
	t.Setenv("SHELL", "/bin/xonsh")
	root := &cobra.Command{Use: "musicctl"}
	err := runInstallCompletion(root, &strings.Builder{})
	require.Error(t, err)
	require.Contains(t, err.Error(), "无法识别")
}

func TestRunInstallCompletion_Idempotent(t *testing.T) {
	withTestHome(t)
	t.Setenv("SHELL", "/bin/bash")
	root := &cobra.Command{Use: "musicctl"}
	var out1, out2 strings.Builder
	require.NoError(t, runInstallCompletion(root, &out1))
	require.NoError(t, runInstallCompletion(root, &out2))
	require.Contains(t, out2.String(), "已是最新", "幂等再跑应提示已是最新")
}

// ShellName 复用 doctor 包(消除重复);Windows 路径 + .exe 后缀场景在 doctor 包测试,
// 这里验证 cli 调 doctor.ShellName 正确接线。
func TestRunInstallCompletion_WindowsPwshExe(t *testing.T) {
	withTestHome(t)
	t.Setenv("SHELL", `C:\Program Files\PowerShell\7\pwsh.exe`)
	root := &cobra.Command{Use: "musicctl"}
	err := runInstallCompletion(root, &strings.Builder{})
	// pwsh 不在 install-completion 支持列表(只 zsh/bash/fish),应报无法识别
	// (而非崩溃)。验证 Windows 路径解析不 panic。
	require.Error(t, err)
}

func TestDoctorShellName_Reused(t *testing.T) {
	// 验证 cli 包通过 doctor.ShellName 复用,行为正确。
	cases := []struct {
		shellPath string
		want      string
	}{
		{"/bin/zsh", "zsh"},
		{"/usr/local/bin/fish", "fish"},
		{"zsh", "zsh"},
		{"", ""},
		// Windows 场景(filepath.Base 处理反斜杠 + 去 .exe)。
		{`C:\tools\pwsh.exe`, "pwsh"},
		{`/usr/bin/zsh`, "zsh"},
	}
	for _, tc := range cases {
		t.Run(tc.shellPath, func(t *testing.T) {
			require.Equal(t, tc.want, doctor.ShellName(tc.shellPath))
		})
	}
}
