// Package album 的专辑动态信息接口声明。
package album

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
)

// AlbumDynamic 获取专辑动态信息（是否收藏、收藏数、评论数、分享数）。
//
// 注意：响应里的 isSub（当前用户是否已收藏）是 per-user 的，但该端点走匿名 session
// 且缓存（以计数信息为主用途）。调用方若需要准确的 per-user 收藏态，应另调 SubscribeAlbum
// 或 IsLike 类接口，不依赖此处的 isSub。
var AlbumDynamic = &engine.Endpoint[*mmpb.AlbumDynamicRequest, *mmpb.AlbumDynamicResponse]{
	Meta: anonymousWeapiMeta("/weapi/album/detail/dynamic"),
	Cache: &engine.CachePolicy[*mmpb.AlbumDynamicRequest]{
		Key: func(req *mmpb.AlbumDynamicRequest) string {
			return fmt.Sprintf("album:dynamic:%d", req.GetAlbumId())
		},
		TTL: 10 * time.Minute,
	},
	NewResp: func() *mmpb.AlbumDynamicResponse { return &mmpb.AlbumDynamicResponse{} },
	MapRequest: func(req *mmpb.AlbumDynamicRequest) (map[string]any, error) {
		return map[string]any{"id": req.GetAlbumId()}, nil
	},
	MapResponse: func(req *mmpb.AlbumDynamicRequest, raw json.RawMessage) (*mmpb.AlbumDynamicResponse, error) {
		var resp struct {
			SubCount     int64 `json:"subCount"`     // 收藏数
			CommentCount int64 `json:"commentCount"` // 评论数
			ShareCount   int64 `json:"shareCount"`   // 分享数
			IsSub        bool  `json:"isSub"`        // 当前用户是否已收藏
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.AlbumDynamicResponse{}, fmt.Errorf("解析专辑动态信息失败: %w", err)
		}
		return &mmpb.AlbumDynamicResponse{
			Info: &mmpb.AlbumDynamicInfo{
				Subscribed:      resp.IsSub,
				SubscribedCount: resp.SubCount,
				CommentCount:    resp.CommentCount,
				ShareCount:      resp.ShareCount,
			},
		}, nil
	},
}
