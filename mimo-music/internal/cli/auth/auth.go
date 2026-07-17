// Package auth 提供 musicctl 的登录态命令:扫码/手机号登录、登录状态、登出。
package auth

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	authendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/auth"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
)

// NewLoginCommand 扫码登录:取二维码 → 轮询 → cookie 持久化到本地会话文件。
func NewLoginCommand(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "login",
		Short: "扫码登录,cookie 持久化到 ~/.musicctl/session.json",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runLogin(k)
		},
	}
}

// NewSendCaptchaCommand 发送手机验证码。
func NewSendCaptchaCommand(k *kit.Kit) *cobra.Command {
	var phone string
	c := &cobra.Command{
		Use:   "send-captcha",
		Short: "发送短信验证码",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			ctx := k.CookieCtx()
			_, _, err := k.RawDo(ctx, authendpoint.SendCaptcha, authendpoint.SendCaptchaRequest(&mmpb.SendCaptchaRequest{Phone: phone}))
			if err != nil {
				return err
			}
			fmt.Println("验证码已发送")
			return nil
		},
	}
	c.Flags().StringVar(&phone, "phone", "", "手机号(带区号,如 8613800138000)")
	_ = c.MarkFlagRequired("phone")
	return c
}

// NewLoginCellphoneCommand 手机号验证码登录,成功后同样落盘会话。
func NewLoginCellphoneCommand(k *kit.Kit) *cobra.Command {
	var phone, captcha string
	c := &cobra.Command{
		Use:   "login-cellphone",
		Short: "手机号验证码登录",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			ctx := k.CookieCtx()
			raw, setCookie, err := k.RawDo(ctx, authendpoint.LoginCellphone, authendpoint.LoginCellphoneRequest(&mmpb.LoginByCellphoneRequest{Phone: phone, Captcha: captcha}))
			if err != nil {
				return err
			}
			return persistLogin(k, raw, setCookie)
		},
	}
	c.Flags().StringVar(&phone, "phone", "", "手机号(带区号,如 8613800138000)")
	c.Flags().StringVar(&captcha, "captcha", "", "短信验证码(先运行 send-captcha 获取)")
	_ = c.MarkFlagRequired("phone")
	_ = c.MarkFlagRequired("captcha")
	return c
}

// NewLoginStatusCommand 查看当前登录态。
func NewLoginStatusCommand(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "login-status",
		Short: "查看当前登录态",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			ctx := k.CookieCtx()
			raw, _, err := k.RawDo(ctx, authendpoint.LoginStatus, authendpoint.LoginStatusRequest(nil))
			if err != nil {
				return err
			}
			sess, err := model.DecodeLoginResponse(raw)
			if err != nil {
				return err
			}
			sess.Cookie = engine.CookieFromContext(ctx)
			return kit.PrintJSON(sess)
		},
	}
}

// NewLogoutCommand 登出并删除本地会话文件。
// 远端登出失败(如 cookie 已过期)仅告警不阻断本地清理。
func NewLogoutCommand(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "登出并删除本地会话文件",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if cookie := k.CurrentCookie(); cookie != "" {
				ctx := k.CookieCtx()
				if _, _, err := k.RawDo(ctx, authendpoint.Logout, authendpoint.LogoutRequest(nil)); err != nil {
					fmt.Fprintf(os.Stderr, "警告: 远端登出失败(继续清除本地会话): %v\n", err)
				}
			}
			if err := k.ClearSession(); err != nil {
				fmt.Fprintf(os.Stderr, "警告: 删除本地会话失败: %v\n", err)
			}
			fmt.Println("已登出,本地会话已清除")
			return nil
		},
	}
}

// persistLogin 登录成功后落盘会话并打印结果。raw 为登录接口响应(尽力提取用户 ID)。
// 扫码登录和手机号登录共用。
func persistLogin(k *kit.Kit, raw json.RawMessage, setCookie string) error {
	if setCookie == "" {
		return fmt.Errorf("登录成功但未拿到 cookie")
	}
	sess := kit.Session{
		Cookie:  setCookie,
		SavedAt: time.Now().Format(time.RFC3339),
	}
	// 尝试提取用户信息(可选)。
	if s, err := model.DecodeLoginResponse(raw); err == nil && s.UserId != 0 {
		sess.UserID = s.UserId
	}
	if err := k.SaveSession(sess); err != nil {
		return fmt.Errorf("登录成功但保存会话失败: %w", err)
	}
	p, _ := kit.SessionPath()
	fmt.Println("✅ 登录成功!")
	if sess.UserID != 0 {
		fmt.Printf("用户 ID: %d\n", sess.UserID)
	}
	fmt.Printf("会话已保存到 %s,后续命令自动携带登录态。\n", p)
	fmt.Println("(如需临时换号,可设 NETEASE_COOKIE 环境变量,优先级高于会话文件)")
	return nil
}

// runLogin 扫码登录:取二维码 → 轮询 → cookie 持久化到本地会话文件。
func runLogin(k *kit.Kit) error {
	ctx := k.CookieCtx()

	// 1. 取二维码 key。
	raw, _, err := k.RawDo(ctx, authendpoint.LoginQrcode, authendpoint.LoginQrcodeRequest(&mmpb.LoginQrcodeRequest{}))
	if err != nil {
		return err
	}
	key, err := model.DecodeQrcodeKey(raw)
	if err != nil {
		return err
	}

	fmt.Println("请用网易云 App 扫描下方二维码登录:")
	fmt.Println()
	fmt.Print(renderQR(authendpoint.QrcodeURL(key)))
	fmt.Println()
	fmt.Printf("二维码内容: %s\n", authendpoint.QrcodeURL(key))
	fmt.Println("(如二维码无法识别,把上面 URL 在浏览器打开,用 App 扫浏览器里的码)")
	fmt.Println("轮询登录状态中...")

	// 2. 轮询状态。
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	timeout := time.After(3 * time.Minute)

	for {
		select {
		case <-timeout:
			return fmt.Errorf("登录超时(3 分钟)")
		case <-ticker.C:
			raw, setCookie, err := k.RawDo(ctx, authendpoint.CheckQrcode, authendpoint.CheckQrcodeRequest(&mmpb.CheckQrcodeRequest{Key: key}))
			if err != nil {
				fmt.Printf("轮询出错(将重试): %v\n", err)
				continue
			}
			code, message, err := model.DecodeQrcodeStatus(raw)
			if err != nil {
				fmt.Printf("解析轮询响应失败(将重试): %v\n", err)
				continue
			}

			switch code {
			case mmpb.QrcodeCode_QRCODE_CODE_WAITING:
				fmt.Printf("等待扫码...\n")
			case mmpb.QrcodeCode_QRCODE_CODE_SCANNED:
				fmt.Printf("已扫描,请在 App 确认登录...\n")
			case mmpb.QrcodeCode_QRCODE_CODE_CONFIRMED:
				return persistLogin(k, raw, setCookie)
			case mmpb.QrcodeCode_QRCODE_CODE_EXPIRED:
				return fmt.Errorf("二维码已过期,请重新运行 login")
			default:
				fmt.Printf("未知状态: code=%d message=%s\n", code, message)
			}
		}
	}
}
