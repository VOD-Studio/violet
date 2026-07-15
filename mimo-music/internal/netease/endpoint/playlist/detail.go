// Package playlist 定义歌单接口的声明。
package playlist

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// GetPlaylist 是获取歌单详情的接口声明。
var GetPlaylist = &engine.Endpoint[*mmpb.GetPlaylistRequest, *mmpb.GetPlaylistResponse]{
	Meta: engine.Meta{
		Path:   "/weapi/v6/playlist/detail",
		Method: "POST",
		Crypto: engine.CryptoWeAPI,
		Auth:   session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.GetPlaylistRequest]{
		Key: func(req *mmpb.GetPlaylistRequest) string {
			return fmt.Sprintf("playlist:detail:%d", req.GetPlaylistId())
		},
		TTL: 24 * time.Hour,
	},
	MapRequest: func(req *mmpb.GetPlaylistRequest) (map[string]any, error) {
		return map[string]any{
			"id": fmt.Sprintf("%d", req.GetPlaylistId()),
			"n":  1000,
			"s":  8,
		}, nil
	},
	MapResponse: func(raw json.RawMessage) (*mmpb.GetPlaylistResponse, error) {
		pl, err := model.MapPlaylist(raw)
		if err != nil {
			return &mmpb.GetPlaylistResponse{}, err
		}
		return &mmpb.GetPlaylistResponse{Playlist: pl}, nil
	},
}
