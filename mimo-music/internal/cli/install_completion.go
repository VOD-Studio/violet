package cli

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/VOD-Studio/mimo-music/internal/cli/doctor"
)

// newInstallCompletionCommand 创建 install-completion 命令:生成当前 shell 的
// Tab 补全脚本到标准目录(不改用户 shell 配置)。
//
// 设计(回应 PR #60 评审):不自动改写 ~/.zshrc——那会拖慢启动(重复 compinit)、
// 覆盖用户框架策略、且 fpath 追加位置无法保证在用户 compinit 之前。沿用 rustup/gh
// 的惯例:只生成脚本到标准目录,bash/fish 自动加载;zsh 需用户手动加一行 fpath
// (zsh 无用户级自动加载目录,~/.zsh/completions 不在默认 fpath)。
func newInstallCompletionCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "install-completion",
		Short: "生成当前 shell 的 Tab 补全脚本到标准目录(bash/fish 自动加载;zsh 需手动加 fpath)",
		Long: `生成 musicctl 的 Tab 补全脚本到当前 shell($SHELL)的标准目录:

  zsh   → ~/.zsh/completions/_musicctl(zsh 默认 fpath 不含此目录,需手动加 fpath)
  bash  → ~/.local/share/bash-completion/completions/musicctl(bash-completion 自动加载)
  fish  → ~/.config/fish/completions/musicctl.fish(fish 自动加载)

本命令不改写你的 shell 配置文件(避免拖慢启动/覆盖框架策略)。bash/fish 装好即用;
zsh 需在 ~/.zshrc 的 compinit 之前手动加一行:
  fpath=(~/.zsh/completions $fpath)
然后重开终端。重复运行是幂等的(脚本内容一致则不重写)。`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			// 必须传 root:cobra 生成脚本时用命令的 Name() 注册,
			// 传子命令会生成 install-completion 的补全而非 musicctl 的。
			return runInstallCompletion(cmd.Root(), cmd.OutOrStdout())
		},
	}
}

// runInstallCompletion 生成补全脚本。
//
// 输出遵循 clig.dev「默认安静」:只在变更/失败输出,末尾给下一步指引;
// 幂等(脚本内容一致)简短确认。
func runInstallCompletion(root *cobra.Command, out io.Writer) error {
	shell := doctor.ShellName(os.Getenv("SHELL"))
	switch shell {
	case "zsh", "bash", "fish":
		// 继续生成。
	default:
		return fmt.Errorf("无法识别当前 shell($SHELL=%q);手动跑 musicctl completion <shell> 并按 shell 文档加载", os.Getenv("SHELL"))
	}
	script, err := genCompletionScript(root, shell)
	if err != nil {
		return fmt.Errorf("生成 %s 补全脚本: %w", shell, err)
	}
	changed, target, err := writeCompletionScript(shell, script)
	if err != nil {
		return fmt.Errorf("写补全脚本: %w", err)
	}

	// zsh 需手动加 fpath(无用户级自动加载目录);bash/fish 自动加载。
	// fpath 教程只在首次生成时输出一次,幂等重跑保持安静(clig.dev)。
	if changed {
		fmt.Fprintf(out, "已生成 %s 补全脚本:%s\n", shell, target)
		if shell == "zsh" {
			fmt.Fprintln(out, "zsh 默认 fpath 不含 ~/.zsh/completions,需在 ~/.zshrc 的 compinit 之前加一行:")
			fmt.Fprintln(out, "  fpath=(~/.zsh/completions $fpath)")
		}
		fmt.Fprintln(out, "重开终端后 musicctl <TAB> 会列命令。")
	} else {
		fmt.Fprintf(out, "%s 补全脚本已是最新(%s)。\n", shell, target)
	}
	return nil
}

// genCompletionScript 用 cobra 生成指定 shell 的补全脚本(写到 buffer)。
func genCompletionScript(root *cobra.Command, shell string) ([]byte, error) {
	var buf strings.Builder
	var err error
	switch shell {
	case "zsh":
		err = root.GenZshCompletion(&buf)
	case "bash":
		err = root.GenBashCompletion(&buf)
	case "fish":
		err = root.GenFishCompletion(&buf, true)
	default:
		return nil, fmt.Errorf("不支持的 shell: %s", shell)
	}
	if err != nil {
		return nil, err
	}
	return []byte(buf.String()), nil
}

// completionScriptPath 返回指定 shell 的补全脚本目标路径。
func completionScriptPath(shell string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	switch shell {
	case "zsh":
		return filepath.Join(home, ".zsh", "completions", "_musicctl"), nil
	case "bash":
		return filepath.Join(home, ".local", "share", "bash-completion", "completions", "musicctl"), nil
	case "fish":
		return filepath.Join(home, ".config", "fish", "completions", "musicctl.fish"), nil
	}
	return "", fmt.Errorf("不支持的 shell: %s", shell)
}

// writeCompletionScript 写补全脚本到目标路径(mkdir 父目录 + 0644)。
// 返回 (是否内容有变更, 路径, error)——内容与现存一致则 changed=false(幂等)。
func writeCompletionScript(shell string, script []byte) (bool, string, error) {
	path, err := completionScriptPath(shell)
	if err != nil {
		return false, "", err
	}
	if existing, rerr := os.ReadFile(path); rerr == nil && bytes.Equal(existing, script) {
		return false, path, nil // 内容一致,幂等
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return false, "", err
	}
	if err := os.WriteFile(path, script, 0o644); err != nil {
		return false, "", err
	}
	return true, path, nil
}
