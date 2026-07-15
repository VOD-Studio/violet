// Package mimomusic 提供 mimo-music 服务的官方 HTTP client SDK。
package mimomusic

import (
	"context"
	"net/url"
	"strconv"
)

// SearchOption 是搜索的可选参数。
type SearchOption func(url.Values)

// WithLimit 设置返回结果数量上限。
func WithLimit(n int) SearchOption {
	return func(q url.Values) {
		if n > 0 {
			q.Set("limit", strconv.Itoa(n))
		}
	}
}

// Search 按关键词搜索歌曲。
//
// opts 控制分页等参数，不传时用服务端默认 limit。
// 对应 GET /api/v1/search?q={keyword}。
func (c *Client) Search(ctx context.Context, keyword string, opts ...SearchOption) (SearchResult, error) {
	q := url.Values{}
	q.Set("q", keyword)
	for _, opt := range opts {
		opt(q)
	}
	var r SearchResult
	err := c.doGET(ctx, "/api/v1/search", q, &r)
	return r, err
}
