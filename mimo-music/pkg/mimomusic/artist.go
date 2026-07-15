// Package mimomusic 提供 mimo-music 服务的官方 HTTP client SDK。
package mimomusic

import "context"

// GetArtist 获取歌手信息及热门歌曲。
//
// 对应 GET /api/v1/artists/{id}。
func (c *Client) GetArtist(ctx context.Context, id string) (Artist, error) {
	var a Artist
	err := c.doGET(ctx, "/api/v1/artists/"+id, nil, &a)
	return a, err
}
