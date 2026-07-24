// Package cli 装配 musicctl 的根命令。
package cli

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/VOD-Studio/mimo-music/internal/cli/album"
	"github.com/VOD-Studio/mimo-music/internal/cli/artist"
	"github.com/VOD-Studio/mimo-music/internal/cli/auth"
	"github.com/VOD-Studio/mimo-music/internal/cli/fm"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"github.com/VOD-Studio/mimo-music/internal/cli/playlist"
	"github.com/VOD-Studio/mimo-music/internal/cli/recent"
	"github.com/VOD-Studio/mimo-music/internal/cli/recommend"
	"github.com/VOD-Studio/mimo-music/internal/cli/search"
	"github.com/VOD-Studio/mimo-music/internal/cli/song"
	"github.com/VOD-Studio/mimo-music/internal/cli/user"
	"github.com/VOD-Studio/mimo-music/internal/cli/version"
)

// NewRootCommand 创建根命令并装配所有命令组。
//
// 登录类命令挂顶层(高频入口),接口按领域分组(song/album/...)。
// 登录态来源: 1. NETEASE_COOKIE 环境变量(优先,临时换号调试)
// 2. 本地配置目录下的 session.json(login/login-cellphone 写入,logout 删除);
//    路径见 musicctl doctor(macOS ~/Library/Application Support/musicctl/、
//    Linux ~/.config/musicctl/、Windows %AppData%\musicctl\)。
func NewRootCommand() *cobra.Command {
	k := kit.New()

	root := &cobra.Command{
		Use:   "musicctl",
		Short: "musicctl - mimo-music 网易云接口 CLI",
		Long: `musicctl - mimo-music 接口调试与实用工具

直连 engine + endpoint 声明,不经 gRPC/gateway。
登录态接口需先 login(扫码)或 login-cellphone(手机号验证码)。

登录态来源:
  1. 环境变量 NETEASE_COOKIE(优先,用于临时换号调试)
  2. 本地配置目录的 session.json(login 写入,logout 删除);
     路径见 musicctl doctor(macOS: ~/Library/Application Support/musicctl/ 等)`,
		SilenceUsage:  true,
		SilenceErrors: true, // 错误由 Execute 统一以「错误: 」格式打印(与旧 CLI 一致)
		// 裸跑(无子命令)→ onboarding 引导:未登录给登录引导,已登录按时段/周末推荐
		// 下一步命令。输出走 stderr(不污染 stdout),本地读登录态无网络,秒出(PRD #39)。
		// --help-verbose 是普通 flag(非 cobra --help),需在此显式转发到 help func。
		RunE: func(cmd *cobra.Command, _ []string) error {
			if flagBool(cmd, "help-verbose") {
				cmd.Help()
				return nil
			}
			// 走 cmd 的 stderr writer(支持 2> 重定向;测试可 SetErr 静音)。
			renderOnboarding(cmd.ErrOrStderr(), k.CurrentCookie() != "", time.Now())
			return nil
		},
	}

	// --version:经 debug.ReadBuildInfo() 读 module version + vcs revision(#36)。
	// 设 Version 字段后 cobra 自动注册 --version flag;模板定制为人类可读单行。
	// --json 与 --version 同给时 --json 优先(输出层规矩:--json 永远结构化),
	// 在 Execute 入口拦截(见 executeVersionOrJSON)。
	root.Version = version.LoadVersion().Version
	root.SetVersionTemplate("{{.Version}}\n") // 占位;实际输出由 Execute 拦截后渲染

	// 全局 flag:输出形态与写操作确认,绑定到 kit 实例,所有子命令生效。
	root.PersistentFlags().BoolVar(&k.JSON, "json", false, "以 JSON 输出(管道/重定向时自动启用)")
	root.PersistentFlags().BoolVar(&k.Yes, "yes", false, "写操作跳过 y/N 确认(脚本场景)")

	// flag 解析失败统一包 ErrUsage,Execute 映射退出码 2。
	root.SetFlagErrorFunc(func(_ *cobra.Command, err error) error {
		return errors.Join(kit.ErrUsage, err)
	})

	root.AddGroup(
		&cobra.Group{ID: "quickstart", Title: "快速上手:"},
		&cobra.Group{ID: "account", Title: "账号:"},
		&cobra.Group{ID: "music", Title: "音乐:"},
		&cobra.Group{ID: "discover", Title: "发现:"},
		&cobra.Group{ID: "tools", Title: "工具:"},
	)

	// 命令按 5 组归属(PRD-0014 #E help 分组)。父命令分组,子命令继承。
	// 新 Bounded Context 接入时默认归既有 5 组之一;单组超 ~30 命令再评估拆组。
	for _, c := range []*cobra.Command{
		auth.NewLoginCommand(k),
		auth.NewLoginCellphoneCommand(k),
		auth.NewLoginStatusCommand(k),
		auth.NewLogoutCommand(k),
		search.NewCommand(k), // 高频入口,归快速上手(PRD 既定)
	} {
		c.GroupID = "quickstart"
		root.AddCommand(c)
	}

	for _, c := range []*cobra.Command{
		auth.NewSendCaptchaCommand(k), // 登录辅助(验证码),归账号
		user.NewCommand(k),
	} {
		c.GroupID = "account"
		root.AddCommand(c)
	}

	for _, c := range []*cobra.Command{
		song.NewCommand(k),
		album.NewCommand(k),
		artist.NewCommand(k),
		playlist.NewCommand(k),
	} {
		c.GroupID = "music"
		root.AddCommand(c)
	}

	for _, c := range []*cobra.Command{
		recommend.NewCommand(k),
		fm.NewCommand(k),
		recent.NewCommand(k), // #47 recent 归发现(读召回池,复听场景)
	} {
		c.GroupID = "discover"
		root.AddCommand(c)
	}

	// cobra 自动生成的 completion / help 命令归「工具」组(否则落 Additional Commands,
	// #F 守护会拦无 GroupID 命令)。InitDefaultCompletionCmd/InitDefaultHelpCmd 在
	// 首次 Execute/Help 时懒生成,这里显式触发后赋组。doctor(#41)同归工具组。
	root.InitDefaultCompletionCmd()
	root.InitDefaultHelpCmd()
	doctorCmd := newDoctorCommand(k)
	doctorCmd.GroupID = "tools"
	root.AddCommand(doctorCmd)
	installCompCmd := newInstallCompletionCommand()
	installCompCmd.GroupID = "tools"
	root.AddCommand(installCompCmd)
	for _, c := range root.Commands() {
		if c.Name() == "completion" || c.Name() == "help" {
			c.GroupID = "tools"
		}
	}

	// --help-verbose:列全部命令平铺(不分组),供需要穷举时用(PRD #40)。
	var helpVerbose bool
	root.Flags().BoolVar(&helpVerbose, "help-verbose", false, "列出全部命令(不分组)")

	// 保存原始 help func,verbose 时用平铺模板,否则原样 + 追加别名节。
	defaultHelp := root.HelpFunc()
	root.SetHelpFunc(func(c *cobra.Command, args []string) {
		// verbose 只对 root 生效(子命令 --help-verbose 无意义,走默认)。
		if c.Name() == root.Name() && flagBool(c, "help-verbose") {
			renderHelpVerbose(c)
			renderAliasSection(c)
			return
		}
		defaultHelp(c, args)
		// root 的默认 help 末尾追加别名节(子命令 help 不加)。
		if c.Name() == root.Name() {
			renderAliasSection(c)
		}
	})

	// 命令树构造完毕:统一挂载参数补全(--id→召回池候选,--level/--area/--op→枚举)。
	// 新命令带同名 flag 自动获得补全,零登记(PRD-0014 #48)。
	kit.MountCompletion(root, k)

	return root
}

// flagBool 读命令的 bool flag 值(未解析或不存在返回 false)。
func flagBool(c *cobra.Command, name string) bool {
	f := c.Flag(name)
	if f == nil {
		return false
	}
	v, err := strconv.ParseBool(f.Value.String())
	if err != nil {
		return false
	}
	return v
}

// renderHelpVerbose 渲染平铺的全部命令(不分组)。直接自绘命令列表,
// 不走 cobra 的 usage 模板——模板会列出已注册的组标题(即便组空),破坏平铺效果。
func renderHelpVerbose(root *cobra.Command) {
	w := root.OutOrStdout()
	fmt.Fprintf(w, "%s\n\n", root.Short)
	fmt.Fprintln(w, "命令(全部):")
	// 按命令名排序,平铺展示。
	cmds := root.Commands()
	// cobra 的 Commands() 已按 Name 排序(除 help/completion 顺序),手动稳定排序。
	sortedCmds := make([]*cobra.Command, len(cmds))
	copy(sortedCmds, cmds)
	// 简单冒泡(命令数少,无必要引 sort)。
	for i := 0; i < len(sortedCmds); i++ {
		for j := i + 1; j < len(sortedCmds); j++ {
			if sortedCmds[j].Name() < sortedCmds[i].Name() {
				sortedCmds[i], sortedCmds[j] = sortedCmds[j], sortedCmds[i]
			}
		}
	}
	// 对齐宽度:取最长命令名。
	maxLen := 0
	for _, c := range sortedCmds {
		if l := len(c.Name()); l > maxLen {
			maxLen = l
		}
	}
	for _, c := range sortedCmds {
		pad := strings.Repeat(" ", maxLen-len(c.Name()))
		fmt.Fprintf(w, "  %s%s   %s\n", c.Name(), pad, c.Short)
	}
	fmt.Fprintln(w, "\nFlags:")
	fmt.Fprint(w, root.Flags().FlagUsages())
	fmt.Fprintf(w, "\nUse \"%s [command] --help\" for more information about a command.\n", root.Name())
}

// renderAliasSection 在 help 输出末尾追加静态别名节(PRD #40)。
// 读 aliases.aliasList()(单一真相,非复制),别名不进命令树故需此处显式列。
func renderAliasSection(root *cobra.Command) {
	entries := aliasList()
	if len(entries) == 0 {
		return
	}
	fmt.Fprintln(root.OutOrStdout(), "\n别名(跨级简写):")
	for _, e := range entries {
		fmt.Fprintf(root.OutOrStdout(), "  %s\t%s\n", e.Alias, strings.Join(e.Expands, " "))
	}
}

// Execute 运行根命令:取消静默退出 0;其余错误统一打印后按类别映射退出码。
//
// 入口先做 argv 重写(跨级别名):执行路径重写 os.Args[1],__complete/__completeNoDesc
// 补全路径重写 os.Args[2](cobra Execute 从 os.Args[1:] 读,故别名在 [1] 而非 [0];
// 补全协议下 [1] 是 __complete,真实命令从 [2] 起)。cobra 解析前完成重写,
// 使别名与补全对命令层透明。
func Execute() {
	rewriteAliases()
	// --version 拦截:cobra 内置的 --version 处理走固定模板,无法与 --json 联动。
	// 在此提前拦截:--version 时按 --json 决定人类/结构化输出后直接退出(输出层规矩:
	// --json 永远结构化)。--json 与 --version 同给时 --json 优先。
	if handleVersion() {
		return
	}
	err := NewRootCommand().Execute()
	switch {
	case err == nil, errors.Is(err, kit.ErrCancelled):
		return
	default:
		fmt.Fprintln(os.Stderr, "错误:", err)
		os.Exit(ExitCode(err))
	}
}

// rewriteAliases 就地重写 os.Args 以展开跨级别名。
//
// cobra.Command.Execute() 从 os.Args[1:] 取参数,故:
//   - 执行路径:别名在 os.Args[1](musicctl pp --id X → 重写 [1])。
//   - __complete/__completeNoDesc 路径:os.Args[1]=__complete,别名在 os.Args[2]。
//
// 未命中别名时 os.Args 不变。
func rewriteAliases() {
	args := os.Args
	// 补全协议路径优先判(args[1] 是 __complete/__completeNoDesc)。
	if rewritten, ok := expandForCompletion(args[1:]); ok {
		os.Args = append([]string{args[0]}, rewritten...)
		return
	}
	// 执行路径。
	if rewritten, ok := expand(args[1:]); ok {
		os.Args = append([]string{args[0]}, rewritten...)
	}
}

// handleVersion 检测 --version flag 并自行渲染后退出,返回 true 表示已处理。
//
// 必须在 cobra Execute 前拦截:cobra 的内置 --version 走 VersionTemplate,
// 无法按 --json 切结构化输出。这里手动扫 os.Args(--version 形态:
// --version、--version=true、-v 若注册了简写;musicctl 只用 --version)。
// --json 与 --version 同给时 --json 优先(结构化),否则人类可读单行。
//
// 不用 cobra 的 flag 解析(那需要构造 root),手扫足够 robust:
// 只看 os.Args[1:] 是否含 --version / --version=true(忽略其他 flag 与值)。
func handleVersion() bool {
	wantVersion := false
	wantJSON := false
	for _, a := range os.Args[1:] {
		// 遇到子命令或 -- 后停止(子命令的 --version 不是 root 的)。
		if a == "--" {
			break
		}
		if !strings.HasPrefix(a, "-") {
			break // 第一个非 flag 参数 = 子命令,停止(version 是 root flag)
		}
		switch {
		case a == "--version" || a == "--version=true":
			wantVersion = true
		case a == "--json" || a == "--json=true":
			wantJSON = true
		}
	}
	if !wantVersion {
		return false
	}
	v := version.LoadVersion()
	if wantJSON {
		out, err := v.JSONString()
		if err != nil {
			fmt.Fprintln(os.Stderr, "错误:", err)
			os.Exit(1)
		}
		fmt.Println(out)
		return true
	}
	fmt.Println(v.String())
	return true
}

// ExitCode 把错误映射为退出码: 3=未登录,2=用法错误,1=其余通用错误。
func ExitCode(err error) int {
	switch {
	case errors.Is(err, kit.ErrNotLogin):
		return 3
	case errors.Is(err, kit.ErrUsage):
		return 2
	case strings.HasPrefix(err.Error(), "required flag(s)"):
		// cobra 必填 flag 缺失(不经 FlagErrorFunc,按消息前缀归类)
		return 2
	default:
		return 1
	}
}
