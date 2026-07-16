// Package song 的 eapi 读类接口声明。
//
// LikedList / QualityDetail / LikeCount / IsLike / DynamicCover / ChorusTime / CreatorInfo
// 七个查询走 eapi 加密（CryptoEAPI），Meta.Path 填 /eapi/...：EAPIEncrypt 内部转 /api/... 做 digest，
// HTTP 仍发 /eapi/...。host 用默认 music.163.com（chaunsin Go 版验证可行）。
//
// 注意：eapi 接口的响应字段内层结构 npm 源码只确认了 envelope，内层字段名按语义映射，
// 真机校验后可调。
package song

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// anonymousEapiMeta 构造 eapi POST + Anonymous 的 Meta（歌曲 eapi 查询统一参数）。
func anonymousEapiMeta(path string) engine.Meta {
	return engine.Meta{Path: path, Method: "POST", Crypto: engine.CryptoEAPI, Auth: session.AuthAnonymous}
}

// loggedInEapiMeta 构造 eapi POST + LoggedIn 的 Meta（需登录态的 eapi 查询）。
func loggedInEapiMeta(path string) engine.Meta {
	return engine.Meta{Path: path, Method: "POST", Crypto: engine.CryptoEAPI, Auth: session.AuthLoggedIn}
}

// LikedList 是获取喜欢音乐列表的接口声明（需登录态）。
// 返回用户已喜欢歌曲的 ID 集合（无序）。
var LikedList = &engine.Endpoint[*mmpb.LikedListRequest, *mmpb.LikedListResponse]{
	Meta: loggedInEapiMeta("/eapi/song/like/get"),
	Cache: &engine.CachePolicy[*mmpb.LikedListRequest]{
		Key: func(req *mmpb.LikedListRequest) string {
			return fmt.Sprintf("song:likedList:%d", req.GetUserId())
		},
		TTL: 10 * time.Minute,
	},
	NewResp: func() *mmpb.LikedListResponse { return &mmpb.LikedListResponse{} },
	MapRequest: func(req *mmpb.LikedListRequest) (map[string]any, error) {
		return map[string]any{"uid": req.GetUserId()}, nil
	},
	MapResponse: func(req *mmpb.LikedListRequest, raw json.RawMessage) (*mmpb.LikedListResponse, error) {
		var resp struct {
			IDs []int64 `json:"ids"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.LikedListResponse{}, fmt.Errorf("解析喜欢列表失败: %w", err)
		}
		return &mmpb.LikedListResponse{SongIds: resp.IDs}, nil
	},
}

// QualityDetail 是获取歌曲音质详情的接口声明。
// 返回该歌曲可选的音质等级（standard/higher/exhigh/lossless/hires）。
var QualityDetail = &engine.Endpoint[*mmpb.QualityDetailRequest, *mmpb.QualityDetailResponse]{
	Meta: anonymousEapiMeta("/eapi/song/music/detail/get"),
	Cache: &engine.CachePolicy[*mmpb.QualityDetailRequest]{
		Key: func(req *mmpb.QualityDetailRequest) string {
			return fmt.Sprintf("song:quality:%d", req.GetSongId())
		},
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.QualityDetailResponse { return &mmpb.QualityDetailResponse{} },
	MapRequest: func(req *mmpb.QualityDetailRequest) (map[string]any, error) {
		return map[string]any{"songId": req.GetSongId()}, nil
	},
	MapResponse: func(req *mmpb.QualityDetailRequest, raw json.RawMessage) (*mmpb.QualityDetailResponse, error) {
		var resp struct {
			Data struct {
				Qualities []struct {
					Level   string `json:"level"`
					Bitrate int64  `json:"bitrate"`
					URL     string `json:"url"`
				} `json:"qualities"`
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.QualityDetailResponse{}, fmt.Errorf("解析音质详情失败: %w", err)
		}
		out := &mmpb.QualityDetailResponse{}
		for _, q := range resp.Data.Qualities {
			out.Qualities = append(out.Qualities, &mmpb.SongQuality{
				Level: q.Level, Bitrate: q.Bitrate, Url: q.URL,
			})
		}
		return out, nil
	},
}

// LikeCount 是获取歌曲红心数量的接口声明。
var LikeCount = &engine.Endpoint[*mmpb.LikeCountRequest, *mmpb.LikeCountResponse]{
	Meta: anonymousEapiMeta("/eapi/song/red/count"),
	Cache: &engine.CachePolicy[*mmpb.LikeCountRequest]{
		Key: func(req *mmpb.LikeCountRequest) string {
			return fmt.Sprintf("song:likeCount:%d", req.GetSongId())
		},
		TTL: 10 * time.Minute,
	},
	NewResp: func() *mmpb.LikeCountResponse { return &mmpb.LikeCountResponse{} },
	MapRequest: func(req *mmpb.LikeCountRequest) (map[string]any, error) {
		return map[string]any{"songId": req.GetSongId()}, nil
	},
	MapResponse: func(req *mmpb.LikeCountRequest, raw json.RawMessage) (*mmpb.LikeCountResponse, error) {
		var resp struct {
			Data struct {
				Count int64 `json:"count"`
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.LikeCountResponse{}, fmt.Errorf("解析红心数量失败: %w", err)
		}
		return &mmpb.LikeCountResponse{Count: resp.Data.Count}, nil
	},
}

// IsLike 是判断当前用户是否喜爱指定歌曲的接口声明（需登录态）。
//
// 结果按调用方（当前登录用户）而异，不缓存：与 user.Account 同属「特定登录态查询」，
// cookie 经 context 注入走 executeOverride（ADR §第三条执行路径）。
var IsLike = &engine.Endpoint[*mmpb.IsLikeRequest, *mmpb.IsLikeResponse]{
	Meta:    loggedInEapiMeta("/eapi/song/like/check"),
	Cache:   nil,
	NewResp: func() *mmpb.IsLikeResponse { return &mmpb.IsLikeResponse{} },
	MapRequest: func(req *mmpb.IsLikeRequest) (map[string]any, error) {
		// trackIds 用 stringified JSON 数组形式（网易云 check 类接口约定）。
		return map[string]any{"trackIds": fmt.Sprintf("[%d]", req.GetSongId())}, nil
	},
	MapResponse: func(req *mmpb.IsLikeRequest, raw json.RawMessage) (*mmpb.IsLikeResponse, error) {
		var resp struct {
			Songs []struct {
				SongID int64 `json:"songId"`
				Like   bool  `json:"like"`
			} `json:"songs"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.IsLikeResponse{}, fmt.Errorf("解析是否喜爱失败: %w", err)
		}
		for _, s := range resp.Songs {
			if s.SongID == req.GetSongId() {
				return &mmpb.IsLikeResponse{Liked: s.Like}, nil
			}
		}
		return &mmpb.IsLikeResponse{Liked: false}, nil
	},
}

// DynamicCover 是获取歌曲动态封面的接口声明。
var DynamicCover = &engine.Endpoint[*mmpb.DynamicCoverRequest, *mmpb.DynamicCoverResponse]{
	Meta: anonymousEapiMeta("/eapi/songplay/dynamic-cover"),
	Cache: &engine.CachePolicy[*mmpb.DynamicCoverRequest]{
		Key: func(req *mmpb.DynamicCoverRequest) string {
			return fmt.Sprintf("song:dynamicCover:%d", req.GetSongId())
		},
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.DynamicCoverResponse { return &mmpb.DynamicCoverResponse{} },
	MapRequest: func(req *mmpb.DynamicCoverRequest) (map[string]any, error) {
		return map[string]any{"songId": req.GetSongId()}, nil
	},
	MapResponse: func(req *mmpb.DynamicCoverRequest, raw json.RawMessage) (*mmpb.DynamicCoverResponse, error) {
		var resp struct {
			Data struct {
				URL string `json:"url"`
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.DynamicCoverResponse{}, fmt.Errorf("解析动态封面失败: %w", err)
		}
		return &mmpb.DynamicCoverResponse{Url: resp.Data.URL}, nil
	},
}

// ChorusTime 是获取歌曲副歌时间段的接口声明。
var ChorusTime = &engine.Endpoint[*mmpb.ChorusTimeRequest, *mmpb.ChorusTimeResponse]{
	Meta: anonymousEapiMeta("/eapi/song/chorus"),
	Cache: &engine.CachePolicy[*mmpb.ChorusTimeRequest]{
		Key: func(req *mmpb.ChorusTimeRequest) string {
			return fmt.Sprintf("song:chorus:%d", req.GetSongId())
		},
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.ChorusTimeResponse { return &mmpb.ChorusTimeResponse{} },
	MapRequest: func(req *mmpb.ChorusTimeRequest) (map[string]any, error) {
		// ids 用 stringified JSON 数组形式（网易云 chorus 接口约定）。
		return map[string]any{"ids": fmt.Sprintf("[%d]", req.GetSongId())}, nil
	},
	MapResponse: func(req *mmpb.ChorusTimeRequest, raw json.RawMessage) (*mmpb.ChorusTimeResponse, error) {
		var resp struct {
			Data []struct {
				Start int64 `json:"start"`
				End   int64 `json:"end"`
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.ChorusTimeResponse{}, fmt.Errorf("解析副歌时间失败: %w", err)
		}
		out := &mmpb.ChorusTimeResponse{}
		for _, seg := range resp.Data {
			out.Segments = append(out.Segments, &mmpb.ChorusSegment{
				StartMs: seg.Start, EndMs: seg.End,
			})
		}
		return out, nil
	},
}

// CreatorInfo 是获取歌曲创作者信息的接口声明（作词/作曲/编曲）。
var CreatorInfo = &engine.Endpoint[*mmpb.CreatorInfoRequest, *mmpb.CreatorInfoResponse]{
	Meta: anonymousEapiMeta("/eapi/song/creators"),
	Cache: &engine.CachePolicy[*mmpb.CreatorInfoRequest]{
		Key: func(req *mmpb.CreatorInfoRequest) string {
			return fmt.Sprintf("song:creators:%d", req.GetSongId())
		},
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.CreatorInfoResponse { return &mmpb.CreatorInfoResponse{} },
	MapRequest: func(req *mmpb.CreatorInfoRequest) (map[string]any, error) {
		return map[string]any{"songId": req.GetSongId()}, nil
	},
	MapResponse: func(req *mmpb.CreatorInfoRequest, raw json.RawMessage) (*mmpb.CreatorInfoResponse, error) {
		var resp struct {
			Data struct {
				Creators []struct {
					ID   int64  `json:"id"`
					Name string `json:"name"`
					Role string `json:"role"`
				} `json:"creators"`
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.CreatorInfoResponse{}, fmt.Errorf("解析创作者信息失败: %w", err)
		}
		out := &mmpb.CreatorInfoResponse{}
		for _, c := range resp.Data.Creators {
			out.Creators = append(out.Creators, &mmpb.SongCreator{
				Id: c.ID, Name: c.Name, Role: c.Role,
			})
		}
		return out, nil
	},
}
