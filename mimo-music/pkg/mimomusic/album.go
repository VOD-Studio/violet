// Package mimomusic 提供 mimo-music 服务的官方 HTTP client SDK。
package mimomusic

import "context"

// GetAlbum 获取专辑详情（含歌曲列表）。
//
// 对应 GET /api/v1/albums/{id}。
func (c *Client) GetAlbum(ctx context.Context, id string) (Album, error) {
	var a Album
	err := c.doGET(ctx, "/api/v1/albums/"+id, nil, &a)
	return a, err
}
