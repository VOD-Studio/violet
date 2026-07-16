// Package song 的播放 URL 接口声明。
package song

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// URL 是获取播放直链的接口声明。
var URL = &engine.Endpoint[*mmpb.GetSongURLRequest, *mmpb.GetSongURLResponse]{
	Meta: engine.Meta{
		Path:   "/weapi/song/enhance/player/url/v1",
		Method: "POST",
		Crypto: engine.CryptoWeAPI,
		Auth:   session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.GetSongURLRequest]{
		Key: func(req *mmpb.GetSongURLRequest) string {
			return fmt.Sprintf("song:url:%d:%d", req.GetSongId(), req.GetLevel())
		},
		TTL: 30 * time.Minute,
	},
	NewResp: func() *mmpb.GetSongURLResponse { return &mmpb.GetSongURLResponse{} },
	MapRequest: func(req *mmpb.GetSongURLRequest) (map[string]any, error) {
		level := levelToString(req.GetLevel())
		return map[string]any{
			"ids":         fmt.Sprintf("[%d]", req.GetSongId()),
			"level":       level,
			"encodeType":  "flac",
		}, nil
	},
	MapResponse: func(req *mmpb.GetSongURLRequest, raw json.RawMessage) (*mmpb.GetSongURLResponse, error) {
		var resp struct {
			Code int `json:"code"`
			Data []struct {
				ID   int64  `json:"id"`
				URL  string `json:"url"`
				Br   int64  `json:"br"`
				Size int64  `json:"size"`
				Type string `json:"type"`
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.GetSongURLResponse{}, fmt.Errorf("解析播放 URL 失败: %w", err)
		}
		if len(resp.Data) == 0 {
			return &mmpb.GetSongURLResponse{}, fmt.Errorf("未找到播放 URL（可能是 VIP 歌曲）")
		}
		d := resp.Data[0]
		return &mmpb.GetSongURLResponse{
			Url: &mmpb.SongURL{Id: d.ID, Url: d.URL, Bitrate: d.Br, Size: d.Size, Format: d.Type},
		}, nil
	},
}

// levelToString 把 proto SongLevel enum 转成网易云 level 字符串。
func levelToString(level mmpb.SongLevel) string {
	switch level {
	case mmpb.SongLevel_SONG_LEVEL_STANDARD:
		return "standard"
	case mmpb.SongLevel_SONG_LEVEL_EXHIGH:
		return "exhigh"
	case mmpb.SongLevel_SONG_LEVEL_LOSSLESS:
		return "lossless"
	case mmpb.SongLevel_SONG_LEVEL_HRES:
		return "hires"
	default:
		return "standard"
	}
}
