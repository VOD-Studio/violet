// Package provider 定义 mimo-music 的平台抽象核心层。
package provider

import "context"

// Auth 是平台登录能力接口。
//
// 各平台实现此接口提供登录、验证码、二维码、登出等能力。
// 返回 model.Session 或 model 中的类型，不泄漏平台原始结构。
type Auth interface {
	// SendCaptcha 发送验证码到手机。
	SendCaptcha(ctx context.Context, phone string) error

	// LoginByCellphone 用手机号和验证码登录，返回会话。
	LoginByCellphone(ctx context.Context, phone, captcha string) (SessionResult, error)

	// LoginByQrcode 获取二维码（返回图片和轮询 key）。
	LoginByQrcode(ctx context.Context) (QrcodeResult, error)

	// CheckQrcode 轮询二维码登录状态。
	CheckQrcode(ctx context.Context, key string) (QrcodeStatus, error)

	// LoginStatus 查询当前登录态。
	LoginStatus(ctx context.Context, cookie string) (SessionResult, error)

	// Logout 登出。
	Logout(ctx context.Context, cookie string) error
}

// SessionResult 是登录结果。
type SessionResult struct {
	// UserID 是平台用户 ID。
	UserID string

	// Cookie 是登录态 Cookie 字符串。
	Cookie string

	// Nickname 是用户昵称。
	Nickname string

	// Avatar 是用户头像 URL。
	Avatar string
}

// QrcodeResult 是获取二维码的结果。
type QrcodeResult struct {
	// Key 是轮询用的 key。
	Key string

	// QRImage 是 base64 编码的二维码图片。
	QRImage string

	// URL 是二维码扫描 URL。
	URL string
}

// QrcodeStatus 是二维码轮询状态。
type QrcodeStatus struct {
	// Code 是状态码（800 失效、801 等待、802 扫描、803 确认登录）。
	Code int

	// Message 是状态描述。
	Message string

	// Cookie 是登录成功时的 Cookie（Code=803 时有值）。
	Cookie string

	// UserID 是登录成功时的用户 ID。
	UserID string
}

// Playlist 是平台歌单能力接口。
type Playlist interface {
	// Detail 获取歌单详情（含全量歌曲列表）。
	Detail(ctx context.Context, playlistID string) (PlaylistResult, error)
}

// PlaylistResult 是歌单查询结果。
type PlaylistResult struct {
	// ID 是歌单 ID。
	ID string

	// Title 是歌单标题。
	Title string

	// Cover 是歌单封面 URL。
	Cover string

	// Creator 是歌单创建者。
	Creator string

	// Songs 是歌单内的歌曲列表。
	Songs []SongResult
}

// SongResult 是歌单内歌曲的简要信息。
type SongResult struct {
	// ID 是歌曲 ID。
	ID string

	// Name 是歌曲名。
	Name string

	// Artist 是歌手名。
	Artist string

	// Album 是专辑名。
	Album string

	// Cover 是封面 URL。
	Cover string

	// Duration 是时长（毫秒）。
	Duration int64
}

// Song 是平台歌曲能力接口。
type Song interface {
	// Detail 获取歌曲详情。
	Detail(ctx context.Context, songID string) (SongResult, error)

	// URL 获取播放直链。
	URL(ctx context.Context, songID, level string) (string, error)

	// Lyric 获取歌词。
	Lyric(ctx context.Context, songID string) (LyricResult, error)
}

// LyricResult 是歌词查询结果。
type LyricResult struct {
	// Lrc 是原始 LRC 歌词。
	Lrc string

	// Translated 是翻译歌词。
	Translated string

	// Romanized 是音译歌词。
	Romanized string
}

// Search 是平台搜索能力接口。
type Search interface {
	// Search 按关键词搜索歌曲。
	Search(ctx context.Context, keyword string, limit int) (SearchResult, error)
}

// SearchResult 是搜索结果。
type SearchResult struct {
	// Songs 是匹配的歌曲列表。
	Songs []SongResult

	// Total 是总数。
	Total int
}

// Provider 是所有音乐平台实现的统一接口。
type Provider interface {
	// Platform 返回平台标识（netease / huawei）。
	Platform() string

	// Auth 返回该平台的登录能力。
	Auth() Auth

	// Playlist 返回歌单能力。
	Playlist() Playlist

	// Song 返回歌曲能力。
	Song() Song

	// Search 返回搜索能力。
	Search() Search
}
