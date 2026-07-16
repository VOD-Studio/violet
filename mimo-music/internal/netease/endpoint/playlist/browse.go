// Package playlist 的浏览与发现接口声明。
//
// HighQuality/HighQualityTags/CatList/BrowseHot/Subscribers/AllTracks 六个读接口。
// 全部 AuthAnonymous + 24h 缓存（歌单浏览低频变化）。
package playlist

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
)

// HighQuality 获取精品歌单列表。
var HighQuality = &engine.Endpoint[*mmpb.HighQualityRequest, *mmpb.HighQualityResponse]{
	Meta:   weapiMeta("/weapi/playlist/highquality/list"),
	Cache:  browseCache("playlist:highquality", func(r *mmpb.HighQualityRequest) string {
		return fmt.Sprintf("%s:%s:%d:%d", "playlist:highquality", r.GetCat(), r.GetLimit(), r.GetOffset())
	}),
	NewResp:    func() *mmpb.HighQualityResponse { return &mmpb.HighQualityResponse{} },
	MapRequest: func(req *mmpb.HighQualityRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 20
		}
		return map[string]any{"cat": req.GetCat(), "limit": limit, "offset": req.GetOffset()}, nil
	},
	MapResponse: parsePlaylistListResponse,
}

// HighQualityTags 获取精品歌单标签列表。
var HighQualityTags = &engine.Endpoint[*mmpb.HighQualityTagsRequest, *mmpb.HighQualityTagsResponse]{
	Meta:  weapiMeta("/weapi/playlist/highquality/tags"),
	Cache: browseCacheConst[*mmpb.HighQualityTagsRequest]("playlist:hq:tags"),
	NewResp:    func() *mmpb.HighQualityTagsResponse { return &mmpb.HighQualityTagsResponse{} },
	MapRequest: func(*mmpb.HighQualityTagsRequest) (map[string]any, error) { return map[string]any{}, nil },
	MapResponse: func(_ *mmpb.HighQualityTagsRequest, raw json.RawMessage) (*mmpb.HighQualityTagsResponse, error) {
		var resp struct {
			Tags []struct {
				Name     string `json:"name"`     // 标签名
				Category string `json:"category"` // 分类
			} `json:"tags"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析精品标签失败: %w", err)
		}
		out := &mmpb.HighQualityTagsResponse{}
		for _, t := range resp.Tags {
			out.Tags = append(out.Tags, &mmpb.HighQualityTag{Name: t.Name, Category: t.Category})
		}
		return out, nil
	},
}

// CatList 获取歌单分类列表。
var CatList = &engine.Endpoint[*mmpb.CatListRequest, *mmpb.CatListResponse]{
	Meta:  weapiMeta("/weapi/playlist/catalogue"),
	Cache: browseCacheConst[*mmpb.CatListRequest]("playlist:catlist"),
	NewResp:    func() *mmpb.CatListResponse { return &mmpb.CatListResponse{} },
	MapRequest: func(*mmpb.CatListRequest) (map[string]any, error) { return map[string]any{}, nil },
	MapResponse: func(_ *mmpb.CatListRequest, raw json.RawMessage) (*mmpb.CatListResponse, error) {
		var resp struct {
			Sub []struct {
				Name          string `json:"name"`          // 分类名
				ResourceCount int64  `json:"resourceCount"` // 资源数
				Type          int64  `json:"type"`          // 类型ID
			} `json:"sub"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析歌单分类失败: %w", err)
		}
		out := &mmpb.CatListResponse{}
		for _, c := range resp.Sub {
			out.Categories = append(out.Categories, &mmpb.PlaylistCategory{
				Name: c.Name, ResourceCount: c.ResourceCount, TypeId: c.Type,
			})
		}
		return out, nil
	},
}

// BrowseHot 获取网友精选碟（热门歌单）。
var BrowseHot = &engine.Endpoint[*mmpb.BrowseHotRequest, *mmpb.BrowseHotResponse]{
	Meta:  weapiMeta("/weapi/playlist/list"),
	Cache: browseCache("playlist:hot", func(r *mmpb.BrowseHotRequest) string {
		return fmt.Sprintf("%s:%s:%s:%d:%d", "playlist:hot", r.GetCat(), r.GetOrder(), r.GetLimit(), r.GetOffset())
	}),
	NewResp:    func() *mmpb.BrowseHotResponse { return &mmpb.BrowseHotResponse{} },
	MapRequest: func(req *mmpb.BrowseHotRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 30
		}
		order := req.GetOrder()
		if order == "" {
			order = "hot"
		}
		return map[string]any{"cat": req.GetCat(), "order": order, "limit": limit, "offset": req.GetOffset()}, nil
	},
	MapResponse: parseHotPlaylistResponse,
}

// Subscribers 获取歌单收藏者列表。
var Subscribers = &engine.Endpoint[*mmpb.SubscribersRequest, *mmpb.SubscribersResponse]{
	Meta: weapiMeta("/weapi/playlist/subscribers"),
	Cache: &engine.CachePolicy[*mmpb.SubscribersRequest]{
		Key: func(r *mmpb.SubscribersRequest) string {
			return fmt.Sprintf("playlist:subscribers:%d:%d:%d", r.GetPlaylistId(), r.GetLimit(), r.GetOffset())
		},
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.SubscribersResponse { return &mmpb.SubscribersResponse{} },
	MapRequest: func(req *mmpb.SubscribersRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 30
		}
		return map[string]any{"id": fmt.Sprintf("%d", req.GetPlaylistId()), "limit": limit, "offset": req.GetOffset()}, nil
	},
	MapResponse: func(_ *mmpb.SubscribersRequest, raw json.RawMessage) (*mmpb.SubscribersResponse, error) {
		var resp struct {
			Subscribers []struct {
				UserID    int64  `json:"userId"`   // 用户ID
				Nickname  string `json:"nickname"` // 昵称
				AvatarURL string `json:"avatarUrl"` // 头像URL
			} `json:"subscribers"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析收藏者失败: %w", err)
		}
		out := &mmpb.SubscribersResponse{Total: int32(len(resp.Subscribers))}
		for _, s := range resp.Subscribers {
			out.Subscribers = append(out.Subscribers, &mmpb.User{
				Id: s.UserID, Nickname: s.Nickname, AvatarUrl: s.AvatarURL,
			})
		}
		return out, nil
	},
}

// AllTracks 获取歌单全量歌曲（分页）。
var AllTracks = &engine.Endpoint[*mmpb.AllTracksRequest, *mmpb.AllTracksResponse]{
	Meta: weapiMeta("/weapi/v6/playlist/detail"),
	Cache: &engine.CachePolicy[*mmpb.AllTracksRequest]{
		Key: func(r *mmpb.AllTracksRequest) string {
			return fmt.Sprintf("playlist:alltracks:%d:%d:%d", r.GetPlaylistId(), r.GetLimit(), r.GetOffset())
		},
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.AllTracksResponse { return &mmpb.AllTracksResponse{} },
	MapRequest: func(req *mmpb.AllTracksRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 100
		}
		return map[string]any{
			"id": fmt.Sprintf("%d", req.GetPlaylistId()), "n": limit, "s": 8,
		}, nil
	},
	MapResponse: func(_ *mmpb.AllTracksRequest, raw json.RawMessage) (*mmpb.AllTracksResponse, error) {
		// 复用 model.MapPlaylist 的解析（歌单详情里含 tracks）。
		pl, err := model.MapPlaylist(raw)
		if err != nil {
			return nil, err
		}
		return &mmpb.AllTracksResponse{Songs: pl.Songs, Total: pl.TrackCount}, nil
	},
}
