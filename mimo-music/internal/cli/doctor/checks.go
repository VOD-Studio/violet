package doctor

import (
	"context"
	"fmt"
	"strings"

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

// CompletionChecker 检查当前 shell 的补全脚本是否已安装。
//
// 检测常见安装位置是否存在补全脚本(zsh: ~/.zsh/completions/_musicctl;
// bash: ~/.local/share/bash-completion/completions/musicctl;fish: ~/.config/fish/...)。
// 这覆盖大多数安装方式;fpath 是否真 source 无法跨进程可靠检测,故文件存在视为已装。
//
// 已装 → pass(显示路径);未装 → warn(给一键安装命令,引导用户装上)。
// warn 非 fail:没装补全 musicctl 仍可用,只是 Tab 不列命令。
//
// shell 从 $SHELL 推断;installedProbe 注入使测试用 fake(不碰真实文件系统)。
func CompletionChecker(shell string, installedProbe func(shell string) (path string, ok bool)) Checker {
	return CheckerFunc(func() Result {
		// 归一 shell 名:SHELL 可能是 /bin/zsh、/usr/local/bin/fish 等。
		sh := ShellName(shell)
		if sh == "" {
			return Result{Name: "补全", Status: StatusWarn,
				Detail: "无法识别当前 shell($SHELL 未设)",
				FixHint: "手动跑 musicctl completion <shell> 并按 shell 文档 source"}
		}
		path, ok := installedProbe(sh)
		if ok {
			// zsh 即便脚本在,默认 fpath 不含 ~/.zsh/completions,补全可能仍不生效。
			// 无法跨进程可靠检测 fpath,故 zsh 已装也附排查提示(诚实)。
			r := Result{Name: "补全", Status: StatusPass,
				Detail: fmt.Sprintf("%s 补全脚本已安装(%s)", sh, path)}
			if sh == "zsh" {
				r.FixHint = "若 musicctl <TAB> 仍列文件,确认 ~/.zshrc 在 compinit 前含: fpath=(~/.zsh/completions $fpath)"
			}
			return r
		}
		return Result{Name: "补全", Status: StatusWarn,
			Detail: fmt.Sprintf("%s 补全未安装(Tab 将列文件而非 musicctl 命令)", sh),
			FixHint: completionInstallHint(sh)}
	})
}

// ShellName 从 $SHELL 路径提取 shell 名(zsh/bash/fish/powershell),未知返回空。
//
// 跨平台处理路径分隔符:Unix 用 /、Windows 用 \。$SHELL 在 Windows 上可能是
// 反斜杠路径(如 C:\...\pwsh.exe)。filepath.Base 是平台相关的(Unix build 不认 \),
// 故用 strings.LastIndexAny 同时认 / 和 \,取末段,修复评审指出的 Windows 问题。
// Windows 可执行文件常带 .exe 后缀,去除后再匹配。
//
// 导出供 cli 包(install-completion)复用,避免重复实现(评审指出的代码臭味)。
func ShellName(shellPath string) string {
	if shellPath == "" {
		return ""
	}
	base := shellPath
	if i := strings.LastIndexAny(shellPath, `/\`); i >= 0 {
		base = shellPath[i+1:]
	}
	base = strings.TrimSuffix(base, ".exe")
	switch base {
	case "zsh", "bash", "fish", "pwsh", "powershell":
		return base
	}
	return ""
}

// completionInstallHint 返回该 shell 的一键安装命令。
// 统一指向 musicctl install-completion(自动检测 shell + 生成补全脚本,不改 shell 配置)。
func completionInstallHint(shell string) string {
	switch shell {
	case "zsh", "bash", "fish":
		return "运行 musicctl install-completion 生成补全脚本(bash/fish 自动加载;zsh 需手动加 fpath)"
	default:
		return "运行 musicctl install-completion,或手动 musicctl completion <shell> 并按 shell 文档 source"
	}
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
