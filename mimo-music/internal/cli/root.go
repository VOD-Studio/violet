// Package cli 装配 musicctl 的根命令。
package cli

import (
	"os"

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
		SilenceUsage: true,
	}

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

// Execute 运行根命令,出错退出码 1(错误信息由 cobra 打印)。
func Execute() {
	if err := NewRootCommand().Execute(); err != nil {
		os.Exit(1)
	}
}
