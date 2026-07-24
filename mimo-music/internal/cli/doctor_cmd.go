package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/gopxl/beep/v2/speaker"
	"github.com/spf13/cobra"

	"github.com/VOD-Studio/mimo-music/internal/cli/doctor"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	mmauth "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/auth"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
)

// newDoctorCommand 创建 doctor 环境自检命令(PRD-0014 #J)。
//
// 检查项:版本(build info)/会话与网络/补全/音频后端。渲染层输出,
// 任一 fail → exit 1;warn 不影响。--json 白拿。
func newDoctorCommand(k *kit.Kit) *cobra.Command {
	c := &cobra.Command{
		Use:   "doctor",
		Short: "环境自检(版本/会话/补全/音频),出问题一眼定位",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runDoctor(k, cmd)
		},
	}
	return c
}

// runDoctor 装配真实检查器并执行,按 --json 决定渲染形态。
// 任一 fail → 返回 ExitCodeFailure(exit 1),纳入输出层退出码体系。
func runDoctor(k *kit.Kit, cmd *cobra.Command) error {
	// 装配真实检查器(注入生产依赖)。
	checkers := []doctor.Checker{
		doctor.VersionChecker(),
		doctor.SessionChecker(
			k.CurrentCookie,
			// netProbe:把 cookie 注入 ctx,用 login-status rpc 验证有效性。
			func(ctx context.Context, cookie string) error {
				engCtx := engine.WithCookie(ctx, cookie)
				_, _, err := k.RawDo(engCtx, mmauth.LoginStatus, nil)
				return err
			},
		),
		doctor.CompletionChecker(os.Getenv("SHELL"), probeCompletionInstalled),
		doctor.AudioChecker(probeSpeaker),
	}
	results := doctor.Run(checkers)

	if k.JSON {
		return renderDoctorJSON(cmd, results)
	}
	doctor.RenderHuman(os.Stdout, results)
	// fail → exit 1。
	if doctor.HasFail(results) {
		return fmt.Errorf("环境自检未通过(见上方 ✗ 项)")
	}
	return nil
}

// renderDoctorJSON 输出结构化 JSON(bug report 可粘贴)。
func renderDoctorJSON(cmd *cobra.Command, results []doctor.Result) error {
	report := doctor.ReportJSON(results)
	b, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	fmt.Fprintln(cmd.OutOrStdout(), string(b))
	if doctor.HasFail(results) {
		return fmt.Errorf("环境自检未通过")
	}
	return nil
}

// probeSpeaker 探测音频后端(标准采样率/缓冲区)。
// headless/容器无音频设备 → 返回 error(doctor 标记为 warn)。
func probeSpeaker() error {
	// 44100Hz / 4410 样本缓冲(与 beep.go outRate/speakerBuf 一致)。
	return speaker.Init(44100, 4410)
}

// probeCompletionInstalled 检测指定 shell 的补全脚本是否已安装到常见位置。
//
// 各 shell 的检测路径(覆盖主流安装方式):
//   - zsh:~/.zsh/completions/_musicctl、$XDG_DATA_HOME/zsh/site-functions/_musicctl
//   - bash:~/.local/share/bash-completion/completions/musicctl、/etc/bash_completion.d/musicctl、
//     $(brew --prefix)/etc/bash_completion.d/musicctl(省略 brew,需外部命令不查)
//   - fish:~/.config/fish/completions/musicctl.fish、$XDG_CONFIG_HOME/fish/completions/musicctl.fish
//   - powershell:不查文件(Microsoft.PowerShell_profile.ps1 里 source 不可靠),返回未装+指引
//
// 返回找到的路径(供 doctor 显示)+ 是否存在。fpath 是否真 source 无法跨进程检测,
// 文件存在视为已装(大多数用户装到这些位置即生效)。
func probeCompletionInstalled(shell string) (path string, ok bool) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", false
	}
	xdgData := os.Getenv("XDG_DATA_HOME")
	xdgConfig := os.Getenv("XDG_CONFIG_HOME")
	var candidates []string
	switch shell {
	case "zsh":
		candidates = []string{
			filepath.Join(home, ".zsh", "completions", "_musicctl"),
		}
		if xdgData != "" {
			candidates = append(candidates, filepath.Join(xdgData, "zsh", "site-functions", "_musicctl"))
		}
	case "bash":
		candidates = []string{
			filepath.Join(home, ".local", "share", "bash-completion", "completions", "musicctl"),
			filepath.Join("/etc", "bash_completion.d", "musicctl"),
		}
		if xdgData != "" {
			candidates = append(candidates, filepath.Join(xdgData, "bash-completion", "completions", "musicctl"))
		}
	case "fish":
		candidates = []string{
			filepath.Join(home, ".config", "fish", "completions", "musicctl.fish"),
		}
		if xdgConfig != "" {
			candidates = append(candidates, filepath.Join(xdgConfig, "fish", "completions", "musicctl.fish"))
		}
	default:
		// powershell 等不查文件,返回未装让 hint 引导。
		return "", false
	}
	for _, p := range candidates {
		if info, err := os.Stat(p); err == nil && !info.IsDir() {
			return p, true
		}
	}
	return "", false
}
