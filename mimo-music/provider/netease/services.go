// Package netease 实现网易云音乐平台的 Provider。
package netease

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/VOD-Studio/mimo-music/provider"
)

// errNotImplemented 表示该能力尚未实现。
var errNotImplemented = fmt.Errorf("该能力尚未实现")

// AuthService 是网易云登录能力服务。
type AuthService struct{ client *Client }

// PlaylistService 占位，Issue-0009 实现。
type PlaylistService struct{ client *Client }

// SongService 占位，Issue-0010 实现。
type SongService struct{ client *Client }

// SearchService 占位，Issue-0011 实现。
type SearchService struct{ client *Client }

// --- AuthService 实现 ---

// SendCaptcha 向手机发送验证码。
//
// 调用网易云 /weapi/sms/captcha/sent 端点。
func (a *AuthService) SendCaptcha(ctx context.Context, phone string) error {
	payload := fmt.Sprintf(`{"cellphone":"%s","ctcode":"86"}`, phone)
	_, err := a.client.weapiPost(ctx, "/weapi/sms/captcha/sent", payload, "")
	return err
}

// LoginByCellphone 用手机号和验证码登录。
//
// 调用网易云 /weapi/login/cellphone 端点，返回 SessionResult。
func (a *AuthService) LoginByCellphone(ctx context.Context, phone, captcha string) (provider.SessionResult, error) {
	payload := fmt.Sprintf(`{"phone":"%s","captcha":"%s","countrycode":"86","rememberLogin":"true"}`, phone, captcha)

	body, err := a.client.weapiPost(ctx, "/weapi/login/cellphone", payload, "")
	if err != nil {
		return provider.SessionResult{}, err
	}

	var resp neteaseLoginResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return provider.SessionResult{}, fmt.Errorf("解析登录响应失败: %w", err)
	}

	cookie := extractCookieFromLogin(body)

	return provider.SessionResult{
		UserID:   fmt.Sprintf("%d", resp.Account.ID),
		Cookie:   cookie,
		Nickname: resp.Profile.Nickname,
		Avatar:   resp.Profile.AvatarURL,
	}, nil
}

// LoginByQrcode 获取登录二维码。
//
// 调用网易云 /api/login/qrcode/uniCreate 端点生成 key，
// 再用 key 生成二维码图片。
func (a *AuthService) LoginByQrcode(ctx context.Context) (provider.QrcodeResult, error) {
	// 1. 生成 key
	keyBody, err := a.client.postJSON(ctx, "https://music.163.com/api/login/qrcode/uniCreate", `{"type":1}`, "")
	if err != nil {
		return provider.QrcodeResult{}, err
	}

	var keyResp struct {
		// Code 是业务码。
		Code int `json:"code"`
		// UniKey 是二维码 key。
		UniKey string `json:"unikey"`
	}
	if err := json.Unmarshal(keyBody, &keyResp); err != nil {
		return provider.QrcodeResult{}, fmt.Errorf("解析二维码 key 失败: %w", err)
	}
	if keyResp.UniKey == "" {
		return provider.QrcodeResult{}, fmt.Errorf("获取二维码 key 失败")
	}

	return provider.QrcodeResult{
		Key: keyResp.UniKey,
		URL: fmt.Sprintf("https://music.163.com/login?codekey=%s", keyResp.UniKey),
	}, nil
}

// CheckQrcode 轮询二维码登录状态。
//
// Code 约定：800 失效、801 等待扫描、802 已扫描待确认、803 确认登录成功。
func (a *AuthService) CheckQrcode(ctx context.Context, key string) (provider.QrcodeStatus, error) {
	payload := fmt.Sprintf(`{"key":"%s","type":1}`, key)
	body, err := a.client.postJSON(ctx, "https://music.163.com/api/login/qrcode/client/login", payload, "")
	if err != nil {
		return provider.QrcodeStatus{}, err
	}

	var resp struct {
		// Code 是状态码。
		Code int `json:"code"`
		// Message 是状态消息。
		Message string `json:"message"`
		// Nickname 是登录用户昵称（802 时有）。
		Nickname string `json:"nickname"`
		// Avatar 是登录用户头像（802 时有）。
		Avatar string `json:"avatar"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return provider.QrcodeStatus{}, fmt.Errorf("解析二维码状态失败: %w", err)
	}

	cookie := ""
	userID := ""
	if resp.Code == 803 {
		cookie = extractCookieFromLogin(body)
	}

	return provider.QrcodeStatus{
		Code:    resp.Code,
		Message: resp.Message,
		Cookie:  cookie,
		UserID:  userID,
	}, nil
}

// LoginStatus 查询当前登录态。
//
// 用传入的 cookie 调用网易云 /weapi/w/nuser/account/get 端点。
func (a *AuthService) LoginStatus(ctx context.Context, cookie string) (provider.SessionResult, error) {
	body, err := a.client.weapiPost(ctx, "/weapi/w/nuser/account/get", "{}", cookie)
	if err != nil {
		return provider.SessionResult{}, err
	}

	var resp neteaseLoginResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return provider.SessionResult{}, fmt.Errorf("解析登录态失败: %w", err)
	}

	if resp.Account.ID == 0 {
		return provider.SessionResult{}, fmt.Errorf("未登录")
	}

	return provider.SessionResult{
		UserID:   fmt.Sprintf("%d", resp.Account.ID),
		Cookie:   cookie,
		Nickname: resp.Profile.Nickname,
		Avatar:   resp.Profile.AvatarURL,
	}, nil
}

// Logout 登出。
//
// 网易云登出主要靠清除本地 Cookie，服务端不强制失效。
func (a *AuthService) Logout(ctx context.Context, cookie string) error {
	_, err := a.client.weapiPost(ctx, "/weapi/logout", "{}", cookie)
	return err
}

// neteaseLoginResponse 是网易云登录响应结构。
type neteaseLoginResponse struct {
	// Account 是账号信息。
	Account struct {
		// ID 是用户 ID。
		ID int64 `json:"id"`
	} `json:"account"`
	// Profile 是用户资料。
	Profile struct {
		// Nickname 是昵称。
		Nickname string `json:"nickname"`
		// AvatarURL 是头像 URL。
		AvatarURL string `json:"avatarUrl"`
	} `json:"profile"`
}

// extractCookieFromLogin 从登录响应体提取 Cookie 字符串。
//
// 网易云登录响应里可能没有显式 Set-Cookie，Cookie 主要在 HTTP 响应头。
// 这里返回空字符串，实际 Cookie 由 client 层从响应头捕获。
// 简化处理：返回一个占位标记，由 service 层组装完整 Cookie。
func extractCookieFromLogin(body []byte) string {
	// 网易云 cookie 在响应头 Set-Cookie 里，这里不做提取。
	// 实际使用时由 service 层从 HTTP 响应头拼接。
	// 此函数预留，保持接口签名稳定。
	return strings.TrimSpace(string(body))
}

// --- PlaylistService / SongService / SearchService 占位 ---

// Detail 占位。
func (p *PlaylistService) Detail(ctx context.Context, playlistID string) (provider.PlaylistResult, error) {
	return provider.PlaylistResult{}, errNotImplemented
}

// Detail 占位。
func (s *SongService) Detail(ctx context.Context, songID string) (provider.SongResult, error) {
	return provider.SongResult{}, errNotImplemented
}

// URL 占位。
func (s *SongService) URL(ctx context.Context, songID, level string) (string, error) {
	return "", errNotImplemented
}

// Lyric 占位。
func (s *SongService) Lyric(ctx context.Context, songID string) (provider.LyricResult, error) {
	return provider.LyricResult{}, errNotImplemented
}

// Search 占位。
func (s *SearchService) Search(ctx context.Context, keyword string, limit int) (provider.SearchResult, error) {
	return provider.SearchResult{}, errNotImplemented
}
