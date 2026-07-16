// Package album 的专辑歌曲音质接口声明。
package album

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// AlbumSongQuality 获取专辑内歌曲可选音质。
//
// 走 eapi 加密（/api/album/privilege 默认 crypto=eapi）。
var AlbumSongQuality = &engine.Endpoint[*mmpb.AlbumSongQualityRequest, *mmpb.AlbumSongQualityResponse]{
	Meta: engine.Meta{
		Path: "/eapi/album/privilege", Method: "POST",
		Crypto: engine.CryptoEAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.AlbumSongQualityRequest]{
		Key: func(req *mmpb.AlbumSongQualityRequest) string {
			return fmt.Sprintf("album:songQuality:%d", req.GetAlbumId())
		},
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.AlbumSongQualityResponse { return &mmpb.AlbumSongQualityResponse{} },
	MapRequest: func(req *mmpb.AlbumSongQualityRequest) (map[string]any, error) {
		return map[string]any{"id": req.GetAlbumId()}, nil
	},
	MapResponse: func(req *mmpb.AlbumSongQualityRequest, raw json.RawMessage) (*mmpb.AlbumSongQualityResponse, error) {
		var resp struct {
			Songs []struct {
				ID         int64 `json:"id"`
				Privileges []struct {
					Level   string `json:"level"`
					Bitrate int64  `json:"maxbr"`
				} `json:"privileges"`
			} `json:"songs"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.AlbumSongQualityResponse{}, fmt.Errorf("解析专辑音质失败: %w", err)
		}
		out := &mmpb.AlbumSongQualityResponse{}
		for _, s := range resp.Songs {
			sq := &mmpb.AlbumSongQuality{SongId: s.ID}
			for _, p := range s.Privileges {
				sq.Qualities = append(sq.Qualities, &mmpb.SongQuality{
					Level: p.Level, Bitrate: p.Bitrate,
				})
			}
			out.Songs = append(out.Songs, sq)
		}
		return out, nil
	},
}
