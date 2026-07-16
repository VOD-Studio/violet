// Package recommend 定义推荐接口的声明。
package recommend

import (
	"encoding/json"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// GetDailyRecommend 是获取每日推荐歌曲的接口声明（需登录态）。
var GetDailyRecommend = &engine.Endpoint[*mmpb.GetDailyRecommendRequest, *mmpb.GetDailyRecommendResponse]{
	Meta: engine.Meta{
		Path:   "/weapi/v3/discovery/recommend/songs",
		Method: "POST",
		Crypto: engine.CryptoWeAPI,
		Auth:   session.AuthLoggedIn,
	},
	Cache: &engine.CachePolicy[*mmpb.GetDailyRecommendRequest]{
		Key: func(*mmpb.GetDailyRecommendRequest) string {
			return "recommend:daily"
		},
		TTL: time.Hour,
	},
	NewResp: func() *mmpb.GetDailyRecommendResponse { return &mmpb.GetDailyRecommendResponse{} },
	MapRequest: func(*mmpb.GetDailyRecommendRequest) (map[string]any, error) {
		return map[string]any{
			"limit":  30,
			"offset": 0,
			"total":  true,
			"n":      1000,
		}, nil
	},
	MapResponse: func(req *mmpb.GetDailyRecommendRequest, raw json.RawMessage) (*mmpb.GetDailyRecommendResponse, error) {
		songs, err := model.DecodeDailyRecommend(raw)
		if err != nil {
			return &mmpb.GetDailyRecommendResponse{}, err
		}
		return &mmpb.GetDailyRecommendResponse{Songs: songs}, nil
	},
}
