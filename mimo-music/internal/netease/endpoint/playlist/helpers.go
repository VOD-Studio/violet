// Package playlist 的 endpoint 辅助函数。
package playlist

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// weapiMeta 构造 weapi POST + Anonymous 的 Meta（歌单浏览接口统一参数）。
func weapiMeta(path string) engine.Meta {
	return engine.Meta{Path: path, Method: "POST", Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous}
}

// browseCache 构造 24h 缓存策略（带动态 key）。
func browseCache[Req any](prefix string, keyFn func(Req) string) *engine.CachePolicy[Req] {
	return &engine.CachePolicy[Req]{Key: keyFn, TTL: 24 * time.Hour}
}

// browseCacheConst 构造 24h 缓存策略（固定 key）。
func browseCacheConst[Req any](key string) *engine.CachePolicy[Req] {
	return &engine.CachePolicy[Req]{
		Key: func(Req) string { return key },
		TTL: 24 * time.Hour,
	}
}

// parsePlaylistListResponse 解析精品歌单列表响应（HighQuality 用）。
//
// 网易云返回 {playlists: [...]} 结构。
func parsePlaylistListResponse(raw json.RawMessage) (*mmpb.HighQualityResponse, error) {
	var resp struct {
		Playlists []struct {
			ID          int64  `json:"id"`          // 歌单ID
			Name        string `json:"name"`        // 歌单名
			CoverImgUrl string `json:"coverImgUrl"` // 封面URL
			PlayCount   int64  `json:"playCount"`   // 播放数
			TrackCount  int    `json:"trackCount"`  // 曲目数
			Creator     struct {
				Nickname string `json:"nickname"` // 创建者昵称
			} `json:"creator"` // 创建者
		} `json:"playlists"`
		Total int `json:"total"` // 总数
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("解析精品歌单失败: %w", err)
	}
	out := &mmpb.HighQualityResponse{Total: int32(resp.Total)}
	for _, p := range resp.Playlists {
		out.Playlists = append(out.Playlists, &mmpb.SearchPlaylist{
			Id: p.ID, Name: p.Name, CoverUrl: p.CoverImgUrl,
			PlayCount: p.PlayCount, TrackCount: int32(p.TrackCount), Creator: p.Creator.Nickname,
		})
	}
	return out, nil
}

// parseHotPlaylistResponse 解析热门歌单列表响应（BrowseHot 用）。
//
// 结构同精品歌单（{playlists: [...], total: N}），复用解析逻辑。
func parseHotPlaylistResponse(raw json.RawMessage) (*mmpb.BrowseHotResponse, error) {
	var resp struct {
		Playlists []struct {
			ID          int64  `json:"id"`          // 歌单ID
			Name        string `json:"name"`        // 歌单名
			CoverImgUrl string `json:"coverImgUrl"` // 封面URL
			PlayCount   int64  `json:"playCount"`   // 播放数
			TrackCount  int    `json:"trackCount"`  // 曲目数
			Creator     struct {
				Nickname string `json:"nickname"` // 创建者昵称
			} `json:"creator"` // 创建者
		} `json:"playlists"`
		Total int `json:"total"` // 总数
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("解析热门歌单失败: %w", err)
	}
	out := &mmpb.BrowseHotResponse{Total: int32(resp.Total)}
	for _, p := range resp.Playlists {
		out.Playlists = append(out.Playlists, &mmpb.SearchPlaylist{
			Id: p.ID, Name: p.Name, CoverUrl: p.CoverImgUrl,
			PlayCount: p.PlayCount, TrackCount: int32(p.TrackCount), Creator: p.Creator.Nickname,
		})
	}
	return out, nil
}
