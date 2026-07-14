// Package netease 实现网易云音乐平台的 Provider。
package netease

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/VOD-Studio/mimo-music/provider"
)

// AuthService 是网易云登录能力服务。
type AuthService struct{ client *Client }

// PlaylistService 是网易云歌单能力服务。
type PlaylistService struct{ client *Client }

// SongService 是网易云歌曲能力服务。
type SongService struct{ client *Client }

// SearchService 是网易云搜索能力服务。
type SearchService struct{ client *Client }

// --- AuthService 实现 ---

// SendCaptcha 向手机发送验证码。
func (a *AuthService) SendCaptcha(ctx context.Context, phone string) error {
	payload := fmt.Sprintf(`{"cellphone":"%s","ctcode":"86"}`, phone)
	_, err := a.client.weapiPost(ctx, "/weapi/sms/captcha/sent", payload, "")
	return err
}

// LoginByCellphone 用手机号和验证码登录。
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

	return provider.SessionResult{
		UserID:   fmt.Sprintf("%d", resp.Account.ID),
		Cookie:   extractCookieFromLogin(body),
		Nickname: resp.Profile.Nickname,
		Avatar:   resp.Profile.AvatarURL,
	}, nil
}

// LoginByQrcode 获取登录二维码。
func (a *AuthService) LoginByQrcode(ctx context.Context) (provider.QrcodeResult, error) {
	keyBody, err := a.client.postJSON(ctx, "https://music.163.com/api/login/qrcode/uniCreate", `{"type":1}`, "")
	if err != nil {
		return provider.QrcodeResult{}, err
	}

	var keyResp struct {
		Code   int    `json:"code"`
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
func (a *AuthService) CheckQrcode(ctx context.Context, key string) (provider.QrcodeStatus, error) {
	payload := fmt.Sprintf(`{"key":"%s","type":1}`, key)
	body, err := a.client.postJSON(ctx, "https://music.163.com/api/login/qrcode/client/login", payload, "")
	if err != nil {
		return provider.QrcodeStatus{}, err
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return provider.QrcodeStatus{}, fmt.Errorf("解析二维码状态失败: %w", err)
	}

	cookie := ""
	if resp.Code == 803 {
		cookie = extractCookieFromLogin(body)
	}
	return provider.QrcodeStatus{Code: resp.Code, Message: resp.Message, Cookie: cookie}, nil
}

// LoginStatus 查询当前登录态。
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
func (a *AuthService) Logout(ctx context.Context, cookie string) error {
	_, err := a.client.weapiPost(ctx, "/weapi/logout", "{}", cookie)
	return err
}

// --- PlaylistService 实现 ---

// Detail 获取歌单详情（含全量歌曲列表）。
//
// 网易云 /weapi/v6/playlist/detail 返回歌单元数据 + 前 10 首歌。
// 超过 10 首时需要用 /weapi/v3/song/detail 按歌曲 ID 批量拉取。
func (p *PlaylistService) Detail(ctx context.Context, playlistID string) (provider.PlaylistResult, error) {
	payload := fmt.Sprintf(`{"id":"%s","n":1000,"s":8}`, playlistID)
	body, err := p.client.weapiPost(ctx, "/weapi/v6/playlist/detail", payload, p.client.getCookie(""))
	if err != nil {
		return provider.PlaylistResult{}, err
	}

	var resp neteasePlaylistDetail
	if err := json.Unmarshal(body, &resp); err != nil {
		return provider.PlaylistResult{}, fmt.Errorf("解析歌单详情失败: %w", err)
	}

	pl := resp.Playlist
	songs := make([]provider.SongResult, 0, len(pl.Tracks))
	for _, track := range pl.Tracks {
		songs = append(songs, toSongResult(track))
	}

	return provider.PlaylistResult{
		ID:      fmt.Sprintf("%d", pl.ID),
		Title:   pl.Name,
		Cover:   pl.CoverImgUrl,
		Creator: pl.Creator.Nickname,
		Songs:   songs,
	}, nil
}

// --- SongService 实现 ---

// Detail 获取歌曲详情。
func (s *SongService) Detail(ctx context.Context, songID string) (provider.SongResult, error) {
	payload := fmt.Sprintf(`{"c":"[{\"id\":%s}]","ids":"[%s]"}`, songID, songID)
	body, err := s.client.weapiPost(ctx, "/weapi/v3/song/detail", payload, s.client.getCookie(""))
	if err != nil {
		return provider.SongResult{}, err
	}

	var resp neteaseSongDetail
	if err := json.Unmarshal(body, &resp); err != nil {
		return provider.SongResult{}, fmt.Errorf("解析歌曲详情失败: %w", err)
	}
	if len(resp.Songs) == 0 {
		return provider.SongResult{}, fmt.Errorf("歌曲不存在")
	}

	return toSongResult(resp.Songs[0]), nil
}

// URL 获取播放直链。
//
// level: standard（标准）/ exhigh（较高）/ lossless（无损）。
func (s *SongService) URL(ctx context.Context, songID, level string) (string, error) {
	if level == "" {
		level = "standard"
	}
	payload := fmt.Sprintf(`{"ids":"[%s]","level":"%s","encodeType":"flac"}`, songID, level)
	body, err := s.client.weapiPost(ctx, "/weapi/song/enhance/player/url/v1", payload, s.client.getCookie(""))
	if err != nil {
		return "", err
	}

	var resp neteaseSongURL
	if err := json.Unmarshal(body, &resp); err != nil {
		return "", fmt.Errorf("解析播放 URL 失败: %w", err)
	}
	if len(resp.Data) == 0 {
		return "", fmt.Errorf("未找到播放 URL（可能是 VIP 歌曲）")
	}

	return resp.Data[0].URL, nil
}

// Lyric 获取歌词。
func (s *SongService) Lyric(ctx context.Context, songID string) (provider.LyricResult, error) {
	payload := fmt.Sprintf(`{"id":"%s","lv":-1,"kv":-1,"tv":-1}`, songID)
	body, err := s.client.weapiPost(ctx, "/weapi/song/lyric", payload, s.client.getCookie(""))
	if err != nil {
		return provider.LyricResult{}, err
	}

	var resp neteaseLyric
	if err := json.Unmarshal(body, &resp); err != nil {
		return provider.LyricResult{}, fmt.Errorf("解析歌词失败: %w", err)
	}

	return provider.LyricResult{
		Lrc:        resp.Lrc.Lyric,
		Translated: resp.Tlyric.Lyric,
		Romanized:  resp.Romalrc.Lyric,
	}, nil
}

// --- SearchService 实现 ---

// Search 按关键词搜索歌曲。
func (s *SearchService) Search(ctx context.Context, keyword string, limit int) (provider.SearchResult, error) {
	if limit <= 0 {
		limit = 10
	}
	payload := fmt.Sprintf(`{"s":"%s","type":1,"limit":%d,"offset":0}`, keyword, limit)
	body, err := s.client.weapiPost(ctx, "/weapi/cloudsearch/get/web", payload, s.client.getCookie(""))
	if err != nil {
		return provider.SearchResult{}, err
	}

	var resp struct {
		Result struct {
			SongCount int `json:"songCount"`
			Songs     []neteaseSongDetailSongs `json:"songs"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return provider.SearchResult{}, fmt.Errorf("解析搜索结果失败: %w", err)
	}

	songs := make([]provider.SongResult, 0, len(resp.Result.Songs))
	for _, song := range resp.Result.Songs {
		songs = append(songs, toSongResult(song))
	}

	return provider.SearchResult{
		Songs: songs,
		Total: resp.Result.SongCount,
	}, nil
}

// --- 共享结构 ---

// neteaseLoginResponse 是网易云登录响应结构。
type neteaseLoginResponse struct {
	Account struct {
		ID int64 `json:"id"`
	} `json:"account"`
	Profile struct {
		Nickname  string `json:"nickname"`
		AvatarURL string `json:"avatarUrl"`
	} `json:"profile"`
}

// extractCookieFromLogin 从登录响应体提取 Cookie 字符串。
func extractCookieFromLogin(body []byte) string {
	return strings.TrimSpace(string(body))
}
