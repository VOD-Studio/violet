// Package model 定义 mimo-music 的跨平台统一数据模型（DTO）。
package model

// Lyrics 是统一的歌词数据。
type Lyrics struct {
	// Lrc 是原始 LRC 格式歌词（带时间标签）。
	Lrc string `json:"lrc"`

	// Translated 是翻译歌词（可能为空）。
	Translated string `json:"translated,omitempty"`

	// Romanized 是音译歌词（可能为空）。
	Romanized string `json:"romanized,omitempty"`
}
