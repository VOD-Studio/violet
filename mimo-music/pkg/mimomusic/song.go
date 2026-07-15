// Package mimomusic 提供 mimo-music 服务的官方 HTTP client SDK。
package mimomusic

import (
	"context"
	"net/url"
)

// GetSongDetail 获取歌曲详情。
//
// 对应 GET /api/v1/songs/{id}。
func (c *Client) GetSongDetail(ctx context.Context, id string) (SongDetail, error) {
	var s SongDetail
	err := c.doGET(ctx, "/api/v1/songs/"+id, nil, &s)
	return s, err
}

// GetSongURL 获取播放直链。
//
// level 是音质等级（如 standard / exhigh / lossless），传空用服务端默认。
// 对应 GET /api/v1/songs/{id}/url。
func (c *Client) GetSongURL(ctx context.Context, id, level string) (SongURL, error) {
	q := url.Values{}
	if level != "" {
		q.Set("level", level)
	}
	var u SongURL
	err := c.doGET(ctx, "/api/v1/songs/"+id+"/url", q, &u)
	return u, err
}

// GetLyric 获取歌词。
//
// 对应 GET /api/v1/songs/{id}/lyric。
func (c *Client) GetLyric(ctx context.Context, id string) (Lyric, error) {
	var l Lyric
	err := c.doGET(ctx, "/api/v1/songs/"+id+"/lyric", nil, &l)
	return l, err
}
