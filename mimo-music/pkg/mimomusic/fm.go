// Package mimomusic 提供 mimo-music 服务的官方 HTTP client SDK。
package mimomusic

import "context"

// FMResult 是私人 FM 响应。
type FMResult struct {
	// Songs 是 FM 歌曲列表。
	Songs []Song `json:"songs"`
}

// GetPersonalFM 获取私人 FM 歌曲。
//
// 对应 GET /api/v1/fm。
// cookie 由 mimo-music 服务端从 SessionStore 轮换获取，调用方无需传入。
func (c *Client) GetPersonalFM(ctx context.Context) (FMResult, error) {
	var r FMResult
	err := c.doGET(ctx, "/api/v1/fm", nil, &r)
	return r, err
}
