// Package mimomusic 提供 mimo-music 服务的官方 HTTP client SDK。
package mimomusic

import "context"

// GetPlaylist 获取歌单详情（含全量歌曲列表）。
//
// 对应 GET /api/v1/playlists/{id}。
func (c *Client) GetPlaylist(ctx context.Context, id string) (Playlist, error) {
	var p Playlist
	err := c.doGET(ctx, "/api/v1/playlists/"+id, nil, &p)
	return p, err
}
