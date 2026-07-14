// Package model 定义 mimo-music 的跨平台统一数据模型（DTO）。
//
// 所有 provider 实现返回 model 包中的类型，不泄漏各自的原始结构。
// 这样 server / service 层只认 model，换平台不影响上层。
package model

// Song 是统一的歌曲数据。
type Song struct {
	// ID 是平台内的歌曲 ID。
	ID string `json:"id"`

	// Name 是歌曲名。
	Name string `json:"name"`

	// Artist 是歌手名（多人用 / 分隔）。
	Artist string `json:"artist"`

	// Album 是专辑名。
	Album string `json:"album"`

	// Cover 是封面图 URL。
	Cover string `json:"cover"`

	// URL 是播放直链（可能为空，需单独通过 SongURL 获取）。
	URL string `json:"url,omitempty"`

	// Duration 是歌曲时长，单位毫秒。
	Duration int64 `json:"duration"`
}
