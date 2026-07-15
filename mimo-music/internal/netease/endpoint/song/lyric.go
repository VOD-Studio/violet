// Package song 的歌词接口声明。
package song

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// Lyric 是获取歌词的接口声明。
var Lyric = &engine.Endpoint[*mmpb.GetLyricRequest, mmpb.GetLyricResponse]{
	Meta: engine.Meta{
		Path:   "/weapi/song/lyric",
		Method: "POST",
		Crypto: engine.CryptoWeAPI,
		Auth:   session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.GetLyricRequest]{
		Key: func(req *mmpb.GetLyricRequest) string {
			return fmt.Sprintf("song:lyric:%d", req.GetSongId())
		},
		TTL: 24 * time.Hour,
	},
	MapRequest: func(req *mmpb.GetLyricRequest) (map[string]any, error) {
		return map[string]any{
			"id": fmt.Sprintf("%d", req.GetSongId()),
			"lv": -1,
			"kv": -1,
			"tv": -1,
		}, nil
	},
	MapResponse: func(raw json.RawMessage) (mmpb.GetLyricResponse, error) {
		var resp struct {
			Lrc    struct{ Lyric string `json:"lyric"` }    `json:"lrc"`
			Tlyric struct{ Lyric string `json:"lyric"` }    `json:"tlyric"`
			Romalrc struct{ Lyric string `json:"lyric"` }   `json:"romalrc"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return mmpb.GetLyricResponse{}, fmt.Errorf("解析歌词失败: %w", err)
		}
		return mmpb.GetLyricResponse{
			Lyric: &mmpb.Lyric{
				Lrc:        resp.Lrc.Lyric,
				Translated: resp.Tlyric.Lyric,
				Romanized:  resp.Romalrc.Lyric,
			},
		}, nil
	},
}
