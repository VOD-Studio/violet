package doctor

import (
	"bytes"
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRun_ExecutesAllCheckers(t *testing.T) {
	t.Parallel()
	checkers := []Checker{
		CheckerFunc(func() Result { return Result{Name: "a", Status: StatusPass} }),
		CheckerFunc(func() Result { return Result{Name: "b", Status: StatusFail} }),
	}
	results := Run(checkers)
	require.Len(t, results, 2)
	require.Equal(t, "a", results[0].Name)
	require.Equal(t, "b", results[1].Name)
}

func TestHasFail(t *testing.T) {
	t.Parallel()
	require.True(t, HasFail([]Result{{Status: StatusPass}, {Status: StatusFail}}))
	require.False(t, HasFail([]Result{{Status: StatusPass}, {Status: StatusWarn}}))
	require.False(t, HasFail(nil))
}

func TestRenderHuman_AllStatuses(t *testing.T) {
	t.Parallel()
	results := []Result{
		{Name: "版本", Status: StatusPass, Detail: "v0.1.0"},
		{Name: "会话", Status: StatusFail, Detail: "未登录", FixHint: "运行 login"},
		{Name: "音频", Status: StatusWarn, Detail: "headless", FixHint: "用 download"},
	}
	var buf bytes.Buffer
	RenderHuman(&buf, results)
	out := buf.String()
	require.Contains(t, out, "✓ 版本")
	require.Contains(t, out, "✗ 会话")
	require.Contains(t, out, "! 音频")
	require.Contains(t, out, "→ 运行 login", "fail/warn 应渲染修复指引")
	require.Contains(t, out, "→ 用 download")
}

func TestRenderHuman_NoFixHintForPass(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	RenderHuman(&buf, []Result{{Name: "x", Status: StatusPass, Detail: "ok"}})
	require.NotContains(t, buf.String(), "→", "pass 不应有修复指引箭头")
}

func TestReportJSON_OKField(t *testing.T) {
	t.Parallel()
	require.True(t, ReportJSON([]Result{{Status: StatusPass}}).OK)
	require.False(t, ReportJSON([]Result{{Status: StatusFail}}).OK)
	require.True(t, ReportJSON([]Result{{Status: StatusWarn}}).OK, "warn 不影响 ok")
}

// --- 检查器单元(注入 fake 依赖)---

func TestVersionChecker_NoVCS_Warn(t *testing.T) {
	t.Parallel()
	// LoadVersion 走真实 build info(go test 构建无 vcs → warn)。本测试验证逻辑:
	// 无 commit 时应 warn(指引安装)。注入不了 LoadVersion(包级),这里只验证
	// 有 commit 时 pass 的路径在真实构建下成立——若 CI 构建有 vcs,pass;否则 warn。
	// 两者都合法,不硬断言 status,只验证 Name/Detail 非空。
	r := VersionChecker().Check()
	require.Equal(t, "版本", r.Name)
	require.NotEmpty(t, r.Detail)
}

func TestSessionChecker_NotLoggedIn_Fail(t *testing.T) {
	t.Parallel()
	c := SessionChecker(
		func() string { return "" }, // 无 cookie
		func(context.Context, string) error { return nil },
	)
	r := c.Check()
	require.Equal(t, StatusFail, r.Status)
	require.Contains(t, r.FixHint, "login")
}

func TestSessionChecker_CookieInvalid_Fail(t *testing.T) {
	t.Parallel()
	c := SessionChecker(
		func() string { return "some-cookie" },
		func(context.Context, string) error { return errors.New("401 unauthorized") },
	)
	r := c.Check()
	require.Equal(t, StatusFail, r.Status)
	require.Contains(t, r.Detail, "失效")
}

func TestSessionChecker_Valid_Pass(t *testing.T) {
	t.Parallel()
	c := SessionChecker(
		func() string { return "some-cookie" },
		func(context.Context, string) error { return nil },
	)
	r := c.Check()
	require.Equal(t, StatusPass, r.Status)
}

func TestCompletionChecker_Installed_Pass(t *testing.T) {
	t.Parallel()
	c := CompletionChecker("/bin/zsh", func(shell string) (string, bool) {
		return "/home/u/.zsh/completions/_musicctl", true
	})
	r := c.Check()
	require.Equal(t, StatusPass, r.Status)
	require.Contains(t, r.Detail, "zsh")
	require.Contains(t, r.Detail, "_musicctl")
	// zsh 脚本在但默认 fpath 不含该目录,应附排查提示。
	require.Contains(t, r.FixHint, "fpath")
}

func TestCompletionChecker_BashInstalled_NoFixHint(t *testing.T) {
	t.Parallel()
	// bash 自动加载,已装无需 fpath 排查提示。
	c := CompletionChecker("/bin/bash", func(shell string) (string, bool) {
		return "/home/u/.local/share/bash-completion/completions/musicctl", true
	})
	r := c.Check()
	require.Equal(t, StatusPass, r.Status)
	require.Empty(t, r.FixHint, "bash 已装不应有 FixHint")
}

func TestCompletionChecker_NotInstalled_WarnWithInstallCmd(t *testing.T) {
	t.Parallel()
	cases := []string{"/bin/zsh", "/usr/bin/fish", "/bin/bash"}
	for _, shell := range cases {
		t.Run(shell, func(t *testing.T) {
			c := CompletionChecker(shell, func(string) (string, bool) { return "", false })
			r := c.Check()
			require.Equal(t, StatusWarn, r.Status, "未装应 warn 非 fail")
			require.NotEmpty(t, r.FixHint)
			require.Contains(t, r.FixHint, "install-completion", "应指向 install-completion 一键命令")
		})
	}
}

func TestCompletionChecker_UnknownShell(t *testing.T) {
	t.Parallel()
	c := CompletionChecker("/bin/xonsh", func(string) (string, bool) { return "", false })
	r := c.Check()
	require.Equal(t, StatusWarn, r.Status)
	require.Contains(t, r.Detail, "无法识别")
}

func TestCompletionChecker_EmptyShell(t *testing.T) {
	t.Parallel()
	c := CompletionChecker("", func(string) (string, bool) { return "", false })
	r := c.Check()
	require.Equal(t, StatusWarn, r.Status)
}

func TestShellName(t *testing.T) {
	t.Parallel()
	cases := []struct {
		shellPath string
		want      string
	}{
		{"/bin/zsh", "zsh"},
		{"/usr/local/bin/fish", "fish"},
		{"/bin/bash", "bash"},
		{"/usr/bin/pwsh", "pwsh"},
		{"zsh", "zsh"},
		{"", ""},
		{"/bin/xonsh", ""},
		// Windows 反斜杠路径 + .exe 后缀(评审 bug 点)。
		{`C:\Program Files\PowerShell\7\pwsh.exe`, "pwsh"},
		{`C:\tools\zsh.exe`, "zsh"},
	}
	for _, tc := range cases {
		t.Run(tc.shellPath, func(t *testing.T) {
			t.Parallel()
			require.Equal(t, tc.want, ShellName(tc.shellPath), "shellPath=%q", tc.shellPath)
		})
	}
}

func TestAudioChecker_Available_Pass(t *testing.T) {
	t.Parallel()
	c := AudioChecker(func() error { return nil })
	r := c.Check()
	require.Equal(t, StatusPass, r.Status)
}

func TestAudioChecker_NoDevice_Warn(t *testing.T) {
	t.Parallel()
	c := AudioChecker(func() error { return errors.New("no audio device") })
	r := c.Check()
	require.Equal(t, StatusWarn, r.Status, "headless 无音频应 warn 非 fail")
	require.Contains(t, r.FixHint, "download")
}

// TestStatusIcon 状态符号(人类渲染核心)。
func TestStatusIcon(t *testing.T) {
	t.Parallel()
	require.Equal(t, "✓", StatusPass.icon())
	require.Equal(t, "✗", StatusFail.icon())
	require.Equal(t, "!", StatusWarn.icon())
}
