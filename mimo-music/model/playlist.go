// Package model 定义 mimo-music 的跨平台统一数据模型（DTO）。
package model

// Playlist 是统一的歌单数据。
type Playlist struct {
	// ID 是平台内的歌单 ID。
	ID string `json:"id"`

	// Title 是歌单标题。
	Title string `json:"title"`

	// Cover 是歌单封面 URL。
	Cover string `json:"cover"`

	// Creator 是歌单创建者昵称。
	Creator string `json:"creator"`

	// Platform 是来源平台（netease / huawei）。
	Platform string `json:"platform"`

	// Songs 是歌单内的歌曲列表。
	Songs []Song `json:"songs"`
}

// SearchResult 是统一搜索结果。
type SearchResult struct {
	// Songs 是匹配的歌曲列表。
	Songs []Song `json:"songs"`

	// Total 是搜索结果总数。
	Total int `json:"total"`
}
