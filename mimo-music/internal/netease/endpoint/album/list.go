// Package album 的专辑列表/浏览接口声明。
//
// NewestAlbums / AllNewAlbums / NewAlbumShelf / SubscribedAlbums 四个列表接口，
// 全部 weapi，返回完整 Album 实体（遵循列表响应统一实体 ADR，不建精简 DTO）。
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

// anonymousWeapiMeta 构造 weapi POST + Anonymous 的 Meta（专辑查询统一参数）。
func anonymousWeapiMeta(path string) engine.Meta {
	return engine.Meta{Path: path, Method: "POST", Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous}
}

// loggedInWeapiMeta 构造 weapi POST + LoggedIn 的 Meta（需登录态的专辑查询）。
func loggedInWeapiMeta(path string) engine.Meta {
	return engine.Meta{Path: path, Method: "POST", Crypto: engine.CryptoWeAPI, Auth: session.AuthLoggedIn}
}

// areaToString 把 proto AlbumArea enum 转成网易云 area 字符串。
func areaToString(area mmpb.AlbumArea) string {
	switch area {
	case mmpb.AlbumArea_ALBUM_AREA_ZH:
		return "ZH"
	case mmpb.AlbumArea_ALBUM_AREA_EA:
		return "EA"
	case mmpb.AlbumArea_ALBUM_AREA_KR:
		return "KR"
	case mmpb.AlbumArea_ALBUM_AREA_JP:
		return "JP"
	default:
		return "ALL"
	}
}

// NewestAlbums 获取云音乐首页最新专辑（无入参）。
var NewestAlbums = &engine.Endpoint[*mmpb.NewestAlbumsRequest, *mmpb.NewestAlbumsResponse]{
	Meta: anonymousWeapiMeta("/weapi/discovery/newAlbum"),
	Cache: &engine.CachePolicy[*mmpb.NewestAlbumsRequest]{
		Key: func(req *mmpb.NewestAlbumsRequest) string { return "album:newest" },
		TTL: time.Hour,
	},
	NewResp: func() *mmpb.NewestAlbumsResponse { return &mmpb.NewestAlbumsResponse{} },
	MapRequest: func(req *mmpb.NewestAlbumsRequest) (map[string]any, error) {
		return map[string]any{}, nil
	},
	MapResponse: func(req *mmpb.NewestAlbumsRequest, raw json.RawMessage) (*mmpb.NewestAlbumsResponse, error) {
		albums, err := model.DecodeAlbumList(raw)
		if err != nil {
			return &mmpb.NewestAlbumsResponse{}, err
		}
		return &mmpb.NewestAlbumsResponse{Albums: albums}, nil
	},
}

// AllNewAlbums 获取全部新碟（分页，按地区过滤）。
var AllNewAlbums = &engine.Endpoint[*mmpb.AllNewAlbumsRequest, *mmpb.AllNewAlbumsResponse]{
	Meta: anonymousWeapiMeta("/weapi/album/new"),
	Cache: &engine.CachePolicy[*mmpb.AllNewAlbumsRequest]{
		Key: func(req *mmpb.AllNewAlbumsRequest) string {
			return fmt.Sprintf("album:new:%s:%d:%d", areaToString(req.GetArea()), req.GetLimit(), req.GetOffset())
		},
		TTL: time.Hour,
	},
	NewResp: func() *mmpb.AllNewAlbumsResponse { return &mmpb.AllNewAlbumsResponse{} },
	MapRequest: func(req *mmpb.AllNewAlbumsRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 30
		}
		return map[string]any{
			"limit":  limit,
			"offset": req.GetOffset(),
			"total":  true,
			"area":   areaToString(req.GetArea()),
		}, nil
	},
	MapResponse: func(req *mmpb.AllNewAlbumsRequest, raw json.RawMessage) (*mmpb.AllNewAlbumsResponse, error) {
		albums, total, err := model.DecodeAlbumListWithTotal(raw)
		if err != nil {
			return &mmpb.AllNewAlbumsResponse{}, err
		}
		return &mmpb.AllNewAlbumsResponse{Albums: albums, Total: total}, nil
	},
}

// NewAlbumShelf 获取新碟上架（按地区/年/月过滤的榜单式新碟）。
var NewAlbumShelf = &engine.Endpoint[*mmpb.NewAlbumShelfRequest, *mmpb.NewAlbumShelfResponse]{
	Meta: anonymousWeapiMeta("/weapi/discovery/new/albums/area"),
	Cache: &engine.CachePolicy[*mmpb.NewAlbumShelfRequest]{
		Key: func(req *mmpb.NewAlbumShelfRequest) string {
			return fmt.Sprintf("album:shelf:%s:%s:%d:%d:%d:%d",
				areaToString(req.GetArea()), req.GetType(), req.GetYear(), req.GetMonth(), req.GetLimit(), req.GetOffset())
		},
		TTL: time.Hour,
	},
	NewResp: func() *mmpb.NewAlbumShelfResponse { return &mmpb.NewAlbumShelfResponse{} },
	MapRequest: func(req *mmpb.NewAlbumShelfRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 50
		}
		typ := req.GetType()
		if typ == "" {
			typ = "new"
		}
		year, month, day := time.Now().Date()
		_ = day
		if req.GetYear() > 0 {
			year = int(req.GetYear())
		}
		if req.GetMonth() > 0 {
			month = time.Month(req.GetMonth())
		}
		return map[string]any{
			"area":   areaToString(req.GetArea()),
			"limit":  limit,
			"offset": req.GetOffset(),
			"type":   typ,
			"year":   year,
			"month":  int(month),
			"total":  false,
			"rcmd":   true,
		}, nil
	},
	MapResponse: func(req *mmpb.NewAlbumShelfRequest, raw json.RawMessage) (*mmpb.NewAlbumShelfResponse, error) {
		albums, hasMore, err := model.DecodeAlbumListWithMore(raw)
		if err != nil {
			return &mmpb.NewAlbumShelfResponse{}, err
		}
		return &mmpb.NewAlbumShelfResponse{Albums: albums, HasMore: hasMore}, nil
	},
}

// SubscribedAlbums 获取已收藏专辑列表（需登录态，分页）。
//
// 结果按调用方（登录用户）而异，不缓存：cookie 经 session 池选取但不透明，
// 无法派生稳定的 per-user cache key（与 song.IsLike 同理）。
var SubscribedAlbums = &engine.Endpoint[*mmpb.SubscribedAlbumsRequest, *mmpb.SubscribedAlbumsResponse]{
	Meta:    loggedInWeapiMeta("/weapi/album/sublist"),
	Cache:   nil,
	NewResp: func() *mmpb.SubscribedAlbumsResponse { return &mmpb.SubscribedAlbumsResponse{} },
	MapRequest: func(req *mmpb.SubscribedAlbumsRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 25
		}
		return map[string]any{
			"limit":  limit,
			"offset": req.GetOffset(),
			"total":  true,
		}, nil
	},
	MapResponse: func(req *mmpb.SubscribedAlbumsRequest, raw json.RawMessage) (*mmpb.SubscribedAlbumsResponse, error) {
		albums, total, err := model.DecodeAlbumListWithTotal(raw)
		if err != nil {
			return &mmpb.SubscribedAlbumsResponse{}, err
		}
		return &mmpb.SubscribedAlbumsResponse{Albums: albums, Total: total}, nil
	},
}
