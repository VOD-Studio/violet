// Package album 定义专辑接口的声明。
package album

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// GetAlbum 是获取专辑详情的接口声明。
var GetAlbum = &engine.Endpoint[*mmpb.GetAlbumRequest, mmpb.GetAlbumResponse]{
	Meta: engine.Meta{
		Path:   "/weapi/v1/album/detail",
		Method: "POST",
		Crypto: engine.CryptoWeAPI,
		Auth:   session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.GetAlbumRequest]{
		Key: func(req *mmpb.GetAlbumRequest) string {
			return fmt.Sprintf("album:detail:%d", req.GetAlbumId())
		},
		TTL: 24 * time.Hour,
	},
	MapRequest: func(req *mmpb.GetAlbumRequest) (map[string]any, error) {
		return map[string]any{"id": fmt.Sprintf("%d", req.GetAlbumId())}, nil
	},
	MapResponse: func(raw json.RawMessage) (mmpb.GetAlbumResponse, error) {
		a, songs, err := model.DecodeAlbumDetail(raw)
		if err != nil {
			return mmpb.GetAlbumResponse{}, err
		}
		return mmpb.GetAlbumResponse{Album: a, Songs: songs}, nil
	},
}
