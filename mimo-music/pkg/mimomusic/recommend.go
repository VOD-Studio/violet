// Package mimomusic 提供 mimo-music 服务的官方 HTTP client SDK。
package mimomusic

import "context"

// RecommendResult 是每日推荐响应。
type RecommendResult struct {
	// Songs 是推荐歌曲列表。
	Songs []Song `json:"songs"`
}

// GetDailyRecommend 获取每日推荐歌曲。
//
// 对应 GET /api/v1/recommend/daily。
// cookie 由 mimo-music 服务端从 SessionStore 轮换获取，调用方无需传入。
func (c *Client) GetDailyRecommend(ctx context.Context) (RecommendResult, error) {
	var r RecommendResult
	err := c.doGET(ctx, "/api/v1/recommend/daily", nil, &r)
	return r, err
}
