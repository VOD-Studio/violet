// Package netease 实现网易云音乐平台的 Provider。
//
// 本文件的 service 类型是占位实现，返回未实现错误。
// 各能力在后续 issue 中填充真实实现：
//   - AuthService: Issue-0006
//   - PlaylistService: Issue-0009
//   - SongService: Issue-0010
//   - SearchService: Issue-0011
package netease

import (
	"context"
	"errors"

	"github.com/VOD-Studio/mimo-music/provider"
)

// errNotImplemented 表示该能力尚未实现。
var errNotImplemented = errors.New("该能力尚未实现")

// AuthService 是网易云登录能力服务，后续 Issue-0006 填充。
type AuthService struct{ client *Client }

// PlaylistService 是网易云歌单能力服务，后续 Issue-0009 填充。
type PlaylistService struct{ client *Client }

// SongService 是网易云歌曲能力服务，后续 Issue-0010 填充。
type SongService struct{ client *Client }

// SearchService 是网易云搜索能力服务，后续 Issue-0011 填充。
type SearchService struct{ client *Client }

// --- AuthService 占位（Issue-0006 实现）---

// SendCaptcha 占位。
func (a *AuthService) SendCaptcha(ctx context.Context, phone string) error {
	return errNotImplemented
}

// LoginByCellphone 占位。
func (a *AuthService) LoginByCellphone(ctx context.Context, phone, captcha string) (provider.SessionResult, error) {
	return provider.SessionResult{}, errNotImplemented
}

// LoginByQrcode 占位。
func (a *AuthService) LoginByQrcode(ctx context.Context) (provider.QrcodeResult, error) {
	return provider.QrcodeResult{}, errNotImplemented
}

// CheckQrcode 占位。
func (a *AuthService) CheckQrcode(ctx context.Context, key string) (provider.QrcodeStatus, error) {
	return provider.QrcodeStatus{}, errNotImplemented
}

// LoginStatus 占位。
func (a *AuthService) LoginStatus(ctx context.Context, cookie string) (provider.SessionResult, error) {
	return provider.SessionResult{}, errNotImplemented
}

// Logout 占位。
func (a *AuthService) Logout(ctx context.Context, cookie string) error {
	return errNotImplemented
}

// --- PlaylistService 占位（Issue-0009 实现）---

// Detail 占位。
func (p *PlaylistService) Detail(ctx context.Context, playlistID string) (provider.PlaylistResult, error) {
	return provider.PlaylistResult{}, errNotImplemented
}

// --- SongService 占位（Issue-0010 实现）---

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

// --- SearchService 占位（Issue-0011 实现）---

// Search 占位。
func (s *SearchService) Search(ctx context.Context, keyword string, limit int) (provider.SearchResult, error) {
	return provider.SearchResult{}, errNotImplemented
}
