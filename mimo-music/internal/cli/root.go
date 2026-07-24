// Package cli 装配 musicctl 的根命令。
package cli

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/VOD-Studio/mimo-music/internal/cli/album"
	"github.com/VOD-Studio/mimo-music/internal/cli/artist"
	"github.com/VOD-Studio/mimo-music/internal/cli/auth"
	"github.com/VOD-Studio/mimo-music/internal/cli/fm"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"github.com/VOD-Studio/mimo-music/internal/cli/playlist"
	"github.com/VOD-Studio/mimo-music/internal/cli/recommend"
	"github.com/VOD-Studio/mimo-music/internal/cli/search"
	"github.com/VOD-Studio/mimo-music/internal/cli/song"
	"github.com/VOD-Studio/mimo-music/internal/cli/user"
)

// NewRootCommand 创建根命令并装配所有命令组。
//
// 登录类命令挂顶层(高频入口),接口按领域分组(song/album/...)。
// 登录态来源: 1. NETEASE_COOKIE 环境变量(优先,临时换号调试)
// 2. 本地会话文件 ~/.musicctl/session.json(login/login-cellphone 写入,logout 删除)。
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
  2. 本地会话文件 ~/.musicctl/session.json(login 写入,logout 删除)`,
		SilenceUsage:  true,
		SilenceErrors: true, // 错误由 Execute 统一以「错误: 」格式打印(与旧 CLI 一致)
	}

	// 全局 flag:输出形态与写操作确认,绑定到 kit 实例,所有子命令生效。
	root.PersistentFlags().BoolVar(&k.JSON, "json", false, "以 JSON 输出(管道/重定向时自动启用)")
	root.PersistentFlags().BoolVar(&k.Yes, "yes", false, "写操作跳过 y/N 确认(脚本场景)")

	// flag 解析失败统一包 ErrUsage,Execute 映射退出码 2。
	root.SetFlagErrorFunc(func(_ *cobra.Command, err error) error {
		return errors.Join(kit.ErrUsage, err)
	})

	root.AddGroup(
		&cobra.Group{ID: "auth", Title: "登录:"},
		&cobra.Group{ID: "domain", Title: "接口分组:"},
	)

	for _, c := range []*cobra.Command{
		auth.NewLoginCommand(k),
		auth.NewLoginCellphoneCommand(k),
		auth.NewSendCaptchaCommand(k),
		auth.NewLoginStatusCommand(k),
		auth.NewLogoutCommand(k),
	} {
		c.GroupID = "auth"
		root.AddCommand(c)
	}

	for _, c := range []*cobra.Command{
		song.NewCommand(k),
		album.NewCommand(k),
		artist.NewCommand(k),
		playlist.NewCommand(k),
		user.NewCommand(k),
		search.NewCommand(k),
		recommend.NewCommand(k),
		fm.NewCommand(k),
	} {
		c.GroupID = "domain"
		root.AddCommand(c)
	}

	return root
}

// Execute 运行根命令:取消静默退出 0;其余错误统一打印后按类别映射退出码。
//
// 入口先做 argv 重写(跨级别名):执行路径重写 os.Args[1],__complete/__completeNoDesc
// 补全路径重写 os.Args[2](cobra Execute 从 os.Args[1:] 读,故别名在 [1] 而非 [0];
// 补全协议下 [1] 是 __complete,真实命令从 [2] 起)。cobra 解析前完成重写,
// 使别名与补全对命令层透明。
func Execute() {
	rewriteAliases()
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
