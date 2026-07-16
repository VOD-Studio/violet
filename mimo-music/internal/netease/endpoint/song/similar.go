// Package song 的相似音乐接口声明（按返回实体归属 SongService）。
package song

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// SimilarSongs 基于歌曲获取相似音乐（weapi，匿名，24h 缓存）。
var SimilarSongs = &engine.Endpoint[*mmpb.SimilarSongsRequest, *mmpb.SimilarSongsResponse]{
	Meta: engine.Meta{
		Path: "/weapi/v1/discovery/simiSong", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.SimilarSongsRequest]{
		Key: func(r *mmpb.SimilarSongsRequest) string {
			return fmt.Sprintf("song:similar:%d:%d:%d", r.GetSongId(), r.GetLimit(), r.GetOffset())
		},
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.SimilarSongsResponse { return &mmpb.SimilarSongsResponse{} },
	MapRequest: func(req *mmpb.SimilarSongsRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 50
		}
		return map[string]any{"songid": req.GetSongId(), "limit": limit, "offset": req.GetOffset()}, nil
	},
	MapResponse: func(req *mmpb.SimilarSongsRequest, raw json.RawMessage) (*mmpb.SimilarSongsResponse, error) {
		var resp struct {
			Songs []rawSimilarSong `json:"songs"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.SimilarSongsResponse{}, fmt.Errorf("解析相似音乐失败: %w", err)
		}
		out := make([]*mmpb.Song, 0, len(resp.Songs))
		for _, s := range resp.Songs {
			out = append(out, s.toProto())
		}
		return &mmpb.SimilarSongsResponse{Songs: out}, nil
	},
}

// rawSimilarSong 是相似音乐接口的歌曲项（字段名与 rawSong 略有不同，网易云历史包袱）。
type rawSimilarSong struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Artists []struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
	} `json:"artists"` // 注意是 artists 不是 ar
	Album struct {
		ID     int64  `json:"id"`
		Name   string `json:"name"`
		PicUrl string `json:"picUrl"`
	} `json:"album"` // 注意是 album 不是 al
	Duration int64 `json:"duration"` // 注意是 duration 不是 dt
	Fee      int   `json:"fee"`
}

// toProto 把相似音乐原始结构转成 proto Song。
func (s rawSimilarSong) toProto() *mmpb.Song {
	artists := make([]*mmpb.Artist, 0, len(s.Artists))
	for _, a := range s.Artists {
		artists = append(artists, &mmpb.Artist{Id: a.ID, Name: a.Name})
	}
	return &mmpb.Song{
		Id: s.ID, Name: s.Name, Artists: artists,
		Album:      &mmpb.Album{Id: s.Album.ID, Name: s.Album.Name, PicUrl: s.Album.PicUrl},
		DurationMs: s.Duration, Fee: int32(s.Fee),
	}
}
