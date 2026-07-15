// Package mimomusic 提供 mimo-music 服务的官方 HTTP client SDK。
package mimomusic

// Song 是歌曲的简要信息，出现在歌单、搜索、专辑、歌手等多种响应中。
//
// 镜像 mimo-music HTTP 响应的 Song JSON 结构。
type Song struct {
	// ID 是歌曲 ID。
	ID string `json:"id"`

	// Name 是歌曲名。
	Name string `json:"name"`

	// Artist 是歌手名。
	Artist string `json:"artist"`

	// Album 是专辑名。
	Album string `json:"album"`

	// Cover 是封面 URL。
	Cover string `json:"cover"`
}

// Playlist 是歌单详情。
type Playlist struct {
	// ID 是歌单 ID。
	ID string `json:"id"`

	// Title 是歌单标题。
	Title string `json:"title"`

	// Cover 是封面 URL。
	Cover string `json:"cover"`

	// Creator 是创建者。
	Creator string `json:"creator"`

	// Songs 是歌曲列表。
	Songs []Song `json:"songs"`
}

// SongDetail 是歌曲详情。
type SongDetail struct {
	// ID 是歌曲 ID。
	ID string `json:"id"`

	// Name 是歌曲名。
	Name string `json:"name"`

	// Artist 是歌手名。
	Artist string `json:"artist"`

	// Album 是专辑名。
	Album string `json:"album"`

	// Cover 是封面 URL。
	Cover string `json:"cover"`
}

// SongURL 是播放直链响应。
type SongURL struct {
	// URL 是播放直链。
	URL string `json:"url"`
}

// Lyric 是歌词。
type Lyric struct {
	// Lrc 是原始 LRC 歌词。
	Lrc string `json:"lrc"`

	// Translated 是翻译歌词。
	Translated string `json:"translated,omitempty"`

	// Romanized 是音译歌词。
	Romanized string `json:"romanized,omitempty"`
}

// SearchResult 是搜索结果。
type SearchResult struct {
	// Songs 是匹配的歌曲列表。
	Songs []Song `json:"songs"`

	// Total 是总数。
	Total int `json:"total"`
}

// Album 是专辑详情。
type Album struct {
	// ID 是专辑 ID。
	ID string `json:"id"`

	// Name 是专辑名。
	Name string `json:"name"`

	// Cover 是封面 URL。
	Cover string `json:"cover"`

	// Artist 是专辑歌手。
	Artist string `json:"artist"`

	// PublishTime 是发行时间。
	PublishTime string `json:"publish_time"`

	// Songs 是歌曲列表。
	Songs []Song `json:"songs"`
}

// Artist 是歌手信息。
type Artist struct {
	// ID 是歌手 ID。
	ID string `json:"id"`

	// Name 是歌手名。
	Name string `json:"name"`

	// Cover 是歌手封面 URL。
	Cover string `json:"cover"`

	// Description 是歌手简介。
	Description string `json:"description"`

	// Songs 是热门歌曲列表。
	Songs []Song `json:"songs"`
}

// LoginResult 是登录成功响应（手机登录）。
//
// 注意：mimo-music 采用服务端 session 管理，登录成功后 cookie 由 mimo-music
// 自己持有并存入 SessionStore，HTTP 响应不返回 cookie。调用方无需关心 cookie。
type LoginResult struct {
	// UserID 是平台用户 ID。
	UserID string `json:"user_id"`

	// Nickname 是用户昵称。
	Nickname string `json:"nickname"`

	// Avatar 是用户头像 URL。
	Avatar string `json:"avatar"`
}

// QrcodeResult 是获取二维码的响应。
type QrcodeResult struct {
	// Key 是轮询用的 key。
	Key string `json:"key"`

	// URL 是二维码扫描 URL。
	URL string `json:"url"`
}

// QrcodeCheckResult 是二维码轮询的响应。
type QrcodeCheckResult struct {
	// Code 是状态码（800 失效、801 等待、802 扫描、803 确认登录）。
	Code int `json:"code"`

	// Message 是状态描述。
	Message string `json:"message"`
}

// LoginStatusResult 是登录态查询响应。
type LoginStatusResult struct {
	// LoggedIn 表示是否已登录。
	LoggedIn bool `json:"logged_in"`

	// UserID 是用户 ID。
	UserID string `json:"user_id"`

	// Nickname 是用户昵称。
	Nickname string `json:"nickname"`
}

// 二维码轮询状态码。
const (
	// QrcodeStatusExpired 是二维码已失效（需重新获取）。
	QrcodeStatusExpired = 800
	// QrcodeStatusWaiting 是等待扫码。
	QrcodeStatusWaiting = 801
	// QrcodeStatusScanned 是已扫码待确认。
	QrcodeStatusScanned = 802
	// QrcodeStatusConfirmed 是已确认登录。
	QrcodeStatusConfirmed = 803
)
