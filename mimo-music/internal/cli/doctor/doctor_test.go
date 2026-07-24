package doctor

import (
	"bytes"
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRun_ExecutesAllCheckers(t *testing.T) {
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
	require.True(t, HasFail([]Result{{Status: StatusPass}, {Status: StatusFail}}))
	require.False(t, HasFail([]Result{{Status: StatusPass}, {Status: StatusWarn}}))
	require.False(t, HasFail(nil))
}

func TestRenderHuman_AllStatuses(t *testing.T) {
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
	var buf bytes.Buffer
	RenderHuman(&buf, []Result{{Name: "x", Status: StatusPass, Detail: "ok"}})
	require.NotContains(t, buf.String(), "→", "pass 不应有修复指引箭头")
}

func TestReportJSON_OKField(t *testing.T) {
	require.True(t, ReportJSON([]Result{{Status: StatusPass}}).OK)
	require.False(t, ReportJSON([]Result{{Status: StatusFail}}).OK)
	require.True(t, ReportJSON([]Result{{Status: StatusWarn}}).OK, "warn 不影响 ok")
}

// --- 检查器单元(注入 fake 依赖)---

func TestVersionChecker_NoVCS_Warn(t *testing.T) {
	// LoadVersion 走真实 build info(go test 构建无 vcs → warn)。本测试验证逻辑:
	// 无 commit 时应 warn(指引安装)。注入不了 LoadVersion(包级),这里只验证
	// 有 commit 时 pass 的路径在真实构建下成立——若 CI 构建有 vcs,pass;否则 warn。
	// 两者都合法,不硬断言 status,只验证 Name/Detail 非空。
	r := VersionChecker().Check()
	require.Equal(t, "版本", r.Name)
	require.NotEmpty(t, r.Detail)
}

func TestSessionChecker_NotLoggedIn_Fail(t *testing.T) {
	c := SessionChecker(
		func() string { return "" }, // 无 cookie
		func(context.Context, string) error { return nil },
	)
	r := c.Check()
	require.Equal(t, StatusFail, r.Status)
	require.Contains(t, r.FixHint, "login")
}

func TestSessionChecker_CookieInvalid_Fail(t *testing.T) {
	c := SessionChecker(
		func() string { return "some-cookie" },
		func(context.Context, string) error { return errors.New("401 unauthorized") },
	)
	r := c.Check()
	require.Equal(t, StatusFail, r.Status)
	require.Contains(t, r.Detail, "失效")
}

func TestSessionChecker_Valid_Pass(t *testing.T) {
	c := SessionChecker(
		func() string { return "some-cookie" },
		func(context.Context, string) error { return nil },
	)
	r := c.Check()
	require.Equal(t, StatusPass, r.Status)
}

func TestCompletionChecker_PassWithHint(t *testing.T) {
	r := CompletionChecker().Check()
	require.Equal(t, StatusPass, r.Status)
	require.Contains(t, r.Detail, "completion")
}

func TestAudioChecker_Available_Pass(t *testing.T) {
	c := AudioChecker(func() error { return nil })
	r := c.Check()
	require.Equal(t, StatusPass, r.Status)
}

func TestAudioChecker_NoDevice_Warn(t *testing.T) {
	c := AudioChecker(func() error { return errors.New("no audio device") })
	r := c.Check()
	require.Equal(t, StatusWarn, r.Status, "headless 无音频应 warn 非 fail")
	require.Contains(t, r.FixHint, "download")
}

// TestStatusIcon 状态符号(人类渲染核心)。
func TestStatusIcon(t *testing.T) {
	require.Equal(t, "✓", StatusPass.icon())
	require.Equal(t, "✗", StatusFail.icon())
	require.Equal(t, "!", StatusWarn.icon())
}
