// Package search 定义搜索接口的声明。
//
// 地基阶段只支持单曲搜索（type=1），type 扩展在 Phase 4。
// 网易云搜索用非加密 GET /api/search/get（2026 匿名可用），
// 返回结构字段名与歌曲详情不同（artists 而非 ar、album 而非 al），需独立 raw struct。
package search

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// Search 是搜索接口的声明。
var Search = &engine.Endpoint[*mmpb.SearchRequest, mmpb.SearchResponse]{
	Meta: engine.Meta{
		Path:   "/api/search/get",
		Method: "GET",
		Crypto: engine.CryptoNone,
		Auth:   session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.SearchRequest]{
		Key: func(req *mmpb.SearchRequest) string {
			return fmt.Sprintf("search:%d:%s:%d", req.GetType(), req.GetKeyword(), req.GetLimit())
		},
		TTL: 10 * time.Minute,
	},
	MapRequest: func(req *mmpb.SearchRequest) (map[string]any, error) {
		limit := int(req.GetLimit())
		if limit <= 0 {
			limit = 10
		}
		return map[string]any{
			"s":      req.GetKeyword(),
			"type":   1, // 地基阶段固定单曲
			"limit":  limit,
			"offset": req.GetOffset(),
		}, nil
	},
	MapResponse: func(raw json.RawMessage) (mmpb.SearchResponse, error) {
		var resp struct {
			Result struct {
				SongCount int `json:"songCount"`
				Songs     []struct {
					ID       int64  `json:"id"`
					Name     string `json:"name"`
					Artists  []struct {
						ID   int64  `json:"id"`
						Name string `json:"name"`
					} `json:"artists"`
					Album struct {
						ID     int64  `json:"id"`
						Name   string `json:"name"`
						PicUrl string `json:"img1v1Url"`
					} `json:"album"`
					Duration int64 `json:"duration"`
				} `json:"songs"`
			} `json:"result"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return mmpb.SearchResponse{}, fmt.Errorf("解析搜索结果失败: %w", err)
		}

		songs := make([]*mmpb.Song, 0, len(resp.Result.Songs))
		for _, s := range resp.Result.Songs {
			artists := make([]*mmpb.Artist, 0, len(s.Artists))
			for _, a := range s.Artists {
				artists = append(artists, &mmpb.Artist{Id: a.ID, Name: a.Name})
			}
			songs = append(songs, &mmpb.Song{
				Id:         s.ID,
				Name:       s.Name,
				Artists:    artists,
				Album:      &mmpb.Album{Id: s.Album.ID, Name: s.Album.Name, PicUrl: s.Album.PicUrl},
				DurationMs: s.Duration,
			})
		}
		return mmpb.SearchResponse{Songs: songs, Total: int32(resp.Result.SongCount)}, nil
	},
}
