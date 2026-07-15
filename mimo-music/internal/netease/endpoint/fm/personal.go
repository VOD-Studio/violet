// Package fm 定义私人电台接口的声明。
package fm

import (
	"encoding/json"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// GetPersonalFM 是获取私人 FM 歌曲的接口声明（需登录态）。
var GetPersonalFM = &engine.Endpoint[*mmpb.GetPersonalFMRequest, *mmpb.GetPersonalFMResponse]{
	Meta: engine.Meta{
		Path:   "/weapi/v1/radio/get",
		Method: "POST",
		Crypto: engine.CryptoWeAPI,
		Auth:   session.AuthLoggedIn,
	},
	Cache: &engine.CachePolicy[*mmpb.GetPersonalFMRequest]{
		Key: func(*mmpb.GetPersonalFMRequest) string {
			return "fm:personal"
		},
		TTL: 30 * time.Minute,
	},
	MapRequest: func(*mmpb.GetPersonalFMRequest) (map[string]any, error) {
		return map[string]any{}, nil
	},
	MapResponse: func(raw json.RawMessage) (*mmpb.GetPersonalFMResponse, error) {
		songs, err := model.DecodePersonalFM(raw)
		if err != nil {
			return &mmpb.GetPersonalFMResponse{}, err
		}
		return &mmpb.GetPersonalFMResponse{Songs: songs}, nil
	},
}
