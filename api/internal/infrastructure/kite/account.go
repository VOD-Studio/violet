package kite

import (
	"context"
	"net/http"
	"net/url"

	appmusic "blog-api/internal/application/music"
	"blog-api/internal/domain/music"
)

type sessionWire struct {
	UserID    string `json:"userId"`
	Cookie    string `json:"cookie"`
	Nickname  string `json:"nickname"`
	AvatarURL string `json:"avatarUrl"`
}

func (s *sessionWire) session() *appmusic.Session {
	if s == nil || s.UserID == "" || s.UserID == "0" {
		return nil
	}
	return &appmusic.Session{Cookie: s.Cookie, Profile: music.Profile{ID: s.UserID, Nickname: s.Nickname, AvatarURL: publicURL(s.AvatarURL)}}
}
func (c *Client) LoginQR(ctx context.Context) (appmusic.QRCode, error) {
	var response struct {
		QRCode struct {
			Key string `json:"key"`
			URL string `json:"url"`
		} `json:"qrcode"`
	}
	err := c.request(ctx, http.MethodGet, "/api/v1/auth/login/qrcode", "", nil, &response)
	if err != nil {
		return appmusic.QRCode{}, err
	}
	u, err := url.Parse(response.QRCode.URL)
	if err != nil || u.Scheme != "https" || u.Hostname() != "music.163.com" || u.User != nil || response.QRCode.Key == "" {
		return appmusic.QRCode{}, failure("UPSTREAM_ERROR", "Kite 返回了无效二维码")
	}
	return appmusic.QRCode{Key: response.QRCode.Key, URL: u.String()}, nil
}
func (c *Client) CheckQR(ctx context.Context, key string) (appmusic.QRResult, error) {
	var response struct {
		Code    string       `json:"code"`
		Session *sessionWire `json:"session"`
	}
	err := c.request(ctx, http.MethodGet, "/api/v1/auth/login/qrcode/check", "", url.Values{"key": {key}}, &response)
	if err != nil {
		return appmusic.QRResult{}, err
	}
	state := ""
	switch response.Code {
	case "QRCODE_CODE_EXPIRED":
		state = "expired"
	case "QRCODE_CODE_WAITING":
		state = "waiting"
	case "QRCODE_CODE_SCANNED":
		state = "scanned"
	case "QRCODE_CODE_CONFIRMED":
		state = "confirmed"
	default:
		return appmusic.QRResult{}, failure("UPSTREAM_ERROR", "Kite 返回了未知扫码状态")
	}
	return appmusic.QRResult{State: state, Session: response.Session.session()}, nil
}
func (c *Client) Account(ctx context.Context, cookie string) (*appmusic.Session, error) {
	var response struct {
		Session *sessionWire `json:"session"`
	}
	err := c.request(ctx, http.MethodGet, "/api/v1/auth/status", cookie, nil, &response)
	return response.Session.session(), err
}
func (c *Client) Refresh(ctx context.Context, cookie string) (string, error) {
	var response struct {
		Cookie string `json:"cookie"`
	}
	err := c.request(ctx, http.MethodPost, "/api/v1/auth/refresh", cookie, nil, &response)
	return response.Cookie, err
}
func (c *Client) Logout(ctx context.Context, cookie string) error {
	return c.request(ctx, http.MethodPost, "/api/v1/auth/logout", cookie, nil, nil)
}
