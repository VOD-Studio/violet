package doctor

import (
	"context"
	"fmt"

	"github.com/VOD-Studio/mimo-music/internal/cli/version"
)

// VersionChecker 检查版本(build info)。直接调 version.LoadVersion,无依赖。
func VersionChecker() Checker {
	return CheckerFunc(func() Result {
		v := version.LoadVersion()
		detail := v.String()
		if v.Commit == "" {
			// 无 vcs 信息不是 fail(本地构建合法),但提示影响 bug report 质量。
			return Result{Name: "版本", Status: StatusWarn, Detail: detail,
				FixHint: "经 go install 安装可嵌入 commit 信息,便于 bug report"}
		}
		return Result{Name: "版本", Status: StatusPass, Detail: detail}
	})
}

// SessionChecker 检查会话与网络(一次轻量 rpc 合一)。
//
// cookieProbe 返回当前 cookie(空=未登录);netProbe 用该 cookie 发一次最轻量 rpc
// (生产:login-status endpoint)验证 cookie 仍有效。两者合并避免重复请求:
//   - 无 cookie → fail「未登录」
//   - 有 cookie 但 netProbe 失败 → fail「cookie 失效或网络问题」
//   - 成功 → pass
//
// 注入两个 probe 使测试用 fake(不碰真实网络/cookie)。
func SessionChecker(cookieProbe func() string, netProbe func(ctx context.Context, cookie string) error) Checker {
	return CheckerFunc(func() Result {
		cookie := cookieProbe()
		if cookie == "" {
			return Result{Name: "会话", Status: StatusFail, Detail: "未登录",
				FixHint: "运行 musicctl login 扫码登录"}
		}
		if err := netProbe(context.Background(), cookie); err != nil {
			return Result{Name: "会话", Status: StatusFail,
				Detail: "cookie 失效或网络不可达",
				FixHint: fmt.Sprintf("重新 login;或检查网络。详情: %v", err)}
		}
		return Result{Name: "会话", Status: StatusPass, Detail: "已登录,cookie 有效"}
	})
}

// CompletionChecker 检查补全安装。
//
// 无法可靠检测各 shell 的补全是否已 source(依赖 shell 配置文件),退化为静态指引:
// 告诉用户跑 musicctl completion <shell> 并 source。这是 pass(指引性,非问题)。
func CompletionChecker() Checker {
	return CheckerFunc(func() Result {
		return Result{Name: "补全", Status: StatusPass,
			Detail: "运行 musicctl completion <shell> 生成并 source 即可启用 TAB 补全"}
	})
}

// AudioChecker 检查音频后端(beep speaker 探测)。
//
// audioProbe 尝试初始化音频设备(生产:speaker.Init);失败视为 warn(合法场景:
// headless/容器无音频,用 song download 替代),不是 fail。
func AudioChecker(audioProbe func() error) Checker {
	return CheckerFunc(func() Result {
		if err := audioProbe(); err != nil {
			return Result{Name: "音频", Status: StatusWarn,
				Detail: "无可用音频设备(headless?)",
				FixHint: "用 musicctl song download 替代播放"}
		}
		return Result{Name: "音频", Status: StatusPass, Detail: "音频后端可用"}
	})
}
