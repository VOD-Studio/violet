// Package artist 定义歌手接口的声明。
package artist

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// GetArtist 是获取歌手信息及热门歌曲的接口声明。
var GetArtist = &engine.Endpoint[*mmpb.GetArtistRequest, *mmpb.GetArtistResponse]{
	Meta: engine.Meta{
		Path:   "/weapi/artist/get",
		Method: "POST",
		Crypto: engine.CryptoWeAPI,
		Auth:   session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.GetArtistRequest]{
		Key: func(req *mmpb.GetArtistRequest) string {
			return fmt.Sprintf("artist:info:%d", req.GetArtistId())
		},
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.GetArtistResponse { return &mmpb.GetArtistResponse{} },
	MapRequest: func(req *mmpb.GetArtistRequest) (map[string]any, error) {
		return map[string]any{
			"id":     fmt.Sprintf("%d", req.GetArtistId()),
			"top":    50,
			"offset": 0,
		}, nil
	},
	MapResponse: func(req *mmpb.GetArtistRequest, raw json.RawMessage) (*mmpb.GetArtistResponse, error) {
		a, songs, err := model.DecodeArtistInfo(raw)
		if err != nil {
			return &mmpb.GetArtistResponse{}, err
		}
		return &mmpb.GetArtistResponse{Artist: a, HotSongs: songs}, nil
	},
}
