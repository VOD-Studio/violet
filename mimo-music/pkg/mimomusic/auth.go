// Package mimomusic 提供 mimo-music 服务的官方 HTTP client SDK。
package mimomusic

import (
	"context"
	"net/url"
)

// SendCaptcha 发送验证码到手机。
//
// 对应 POST /api/v1/auth/captcha。
// 触发 mimo-music 调用网易云发送验证码，本方法无返回数据。
func (c *Client) SendCaptcha(ctx context.Context, phone string) error {
	return c.doPOST(ctx, "/api/v1/auth/captcha", map[string]string{"phone": phone}, nil)
}

// LoginByCellphone 用手机号和验证码登录。
//
// 对应 POST /api/v1/auth/login/cellphone。
// 登录成功后 cookie 由 mimo-music 服务端持有，调用方无需管理 cookie。
func (c *Client) LoginByCellphone(ctx context.Context, phone, captcha string) (LoginResult, error) {
	var r LoginResult
	err := c.doPOST(ctx, "/api/v1/auth/login/cellphone", map[string]string{
		"phone":   phone,
		"captcha": captcha,
	}, &r)
	return r, err
}

// LoginByQrcode 获取登录二维码。
//
// 对应 GET /api/v1/auth/login/qrcode。
// 返回二维码 URL 和轮询 key，调用方需用 CheckQrcode 轮询登录状态。
func (c *Client) LoginByQrcode(ctx context.Context) (QrcodeResult, error) {
	var r QrcodeResult
	err := c.doGET(ctx, "/api/v1/auth/login/qrcode", nil, &r)
	return r, err
}

// CheckQrcode 轮询二维码登录状态。
//
// 对应 GET /api/v1/auth/login/qrcode/check。
// 用 LoginByQrcode 返回的 key 轮询，Code=803（QrcodeStatusConfirmed）表示登录成功。
func (c *Client) CheckQrcode(ctx context.Context, key string) (QrcodeCheckResult, error) {
	q := url.Values{}
	q.Set("key", key)
	var r QrcodeCheckResult
	err := c.doGET(ctx, "/api/v1/auth/login/qrcode/check", q, &r)
	return r, err
}

// LoginStatus 查询登录态。
//
// 对应 GET /api/v1/auth/status。
// cookie 是要查询的登录凭证，放进 X-Cookie header 传给 mimo-music。
func (c *Client) LoginStatus(ctx context.Context, cookie string) (LoginStatusResult, error) {
	var r LoginStatusResult
	err := c.doGETWithXCookie(ctx, "/api/v1/auth/status", nil, cookie, &r)
	return r, err
}

// Logout 登出并删除 session。
//
// 对应 POST /api/v1/auth/logout。
// cookie 和 userID 标识要登出的会话，分别放进 X-Cookie header 和 user_id query。
func (c *Client) Logout(ctx context.Context, userID, cookie string) error {
	q := url.Values{}
	if userID != "" {
		q.Set("user_id", userID)
	}
	return c.doPOSTWithXCookie(ctx, "/api/v1/auth/logout", q, cookie, nil)
}
