// Package artist 的扩展查询接口声明。
//
// AllSongs/TopSongs/Albums/Desc/Similar/Fans 六个查询接口 + TopArtists 热门列表。
// 全部 weapi + Anonymous + 24h 缓存。Subscribe 写操作单独处理。
package artist

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// weapiMeta 构造 weapi POST + Anonymous 的 Meta（歌手查询统一参数）。
func weapiMeta(path string) engine.Meta {
	return engine.Meta{Path: path, Method: "POST", Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous}
}

// AllSongs 获取歌手全部歌曲（分页）。
var AllSongs = &engine.Endpoint[*mmpb.AllSongsRequest, *mmpb.AllSongsResponse]{
	Meta: weapiMeta("/weapi/v1/artist/songs"),
	Cache: &engine.CachePolicy[*mmpb.AllSongsRequest]{
		Key: func(r *mmpb.AllSongsRequest) string { return fmt.Sprintf("artist:songs:%d:%d:%d", r.GetArtistId(), r.GetLimit(), r.GetOffset()) },
		TTL: 24 * time.Hour,
	},
	MapRequest: func(req *mmpb.AllSongsRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 50
		}
		return map[string]any{"id": fmt.Sprintf("%d", req.GetArtistId()), "limit": limit, "offset": req.GetOffset()}, nil
	},
	MapResponse: func(raw json.RawMessage) (*mmpb.AllSongsResponse, error) {
		return parseArtistSongs(raw)
	},
}

// TopSongs 获取歌手热门 50 首。
var TopSongs = &engine.Endpoint[*mmpb.TopSongsRequest, *mmpb.TopSongsResponse]{
	Meta: weapiMeta("/weapi/artist/top/song"),
	Cache: &engine.CachePolicy[*mmpb.TopSongsRequest]{
		Key: func(r *mmpb.TopSongsRequest) string { return fmt.Sprintf("artist:top:%d", r.GetArtistId()) },
		TTL: 24 * time.Hour,
	},
	MapRequest: func(req *mmpb.TopSongsRequest) (map[string]any, error) {
		return map[string]any{"id": fmt.Sprintf("%d", req.GetArtistId())}, nil
	},
	MapResponse: func(raw json.RawMessage) (*mmpb.TopSongsResponse, error) {
		resp, err := parseArtistSongs(raw)
		if err != nil {
			return nil, err
		}
		return &mmpb.TopSongsResponse{Songs: resp.Songs}, nil
	},
}

// Albums 获取歌手专辑列表。
var Albums = &engine.Endpoint[*mmpb.AlbumsRequest, *mmpb.AlbumsResponse]{
	Meta: weapiMeta("/weapi/artist/albums"),
	Cache: &engine.CachePolicy[*mmpb.AlbumsRequest]{
		Key: func(r *mmpb.AlbumsRequest) string { return fmt.Sprintf("artist:albums:%d:%d:%d", r.GetArtistId(), r.GetLimit(), r.GetOffset()) },
		TTL: 24 * time.Hour,
	},
	MapRequest: func(req *mmpb.AlbumsRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 30
		}
		return map[string]any{"id": fmt.Sprintf("%d", req.GetArtistId()), "limit": limit, "offset": req.GetOffset()}, nil
	},
	MapResponse: func(raw json.RawMessage) (*mmpb.AlbumsResponse, error) {
		var resp struct {
			HotAlbums []struct {
				ID     int64  `json:"id"`     // 专辑ID
				Name   string `json:"name"`   // 专辑名
				PicUrl string `json:"picUrl"` // 封面URL
				Artist struct {
					ID   int64  `json:"id"`   // 歌手ID
					Name string `json:"name"` // 歌手名
				} `json:"artist"` // 歌手
			} `json:"hotAlbums"`
			More bool `json:"more"` // 是否更多
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析歌手专辑失败: %w", err)
		}
		out := &mmpb.AlbumsResponse{More: resp.More}
		for _, a := range resp.HotAlbums {
			out.Albums = append(out.Albums, &mmpb.Album{
				Id: a.ID, Name: a.Name, PicUrl: a.PicUrl,
				Artist: &mmpb.Artist{Id: a.Artist.ID, Name: a.Artist.Name},
			})
		}
		return out, nil
	},
}

// Desc 获取歌手详细描述。
var Desc = &engine.Endpoint[*mmpb.DescRequest, *mmpb.DescResponse]{
	Meta: weapiMeta("/weapi/artist/introduction/desc"),
	Cache: &engine.CachePolicy[*mmpb.DescRequest]{
		Key: func(r *mmpb.DescRequest) string { return fmt.Sprintf("artist:desc:%d", r.GetArtistId()) },
		TTL: 24 * time.Hour,
	},
	MapRequest: func(req *mmpb.DescRequest) (map[string]any, error) {
		return map[string]any{"id": fmt.Sprintf("%d", req.GetArtistId())}, nil
	},
	MapResponse: func(raw json.RawMessage) (*mmpb.DescResponse, error) {
		var resp struct {
			BriefDesc string `json:"briefDesc"` // 详细描述
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析歌手描述失败: %w", err)
		}
		return &mmpb.DescResponse{Desc: resp.BriefDesc}, nil
	},
}

// Similar 获取相似歌手。
var Similar = &engine.Endpoint[*mmpb.SimilarRequest, *mmpb.SimilarResponse]{
	Meta: weapiMeta("/weapi/discovery/simiArtist"),
	Cache: &engine.CachePolicy[*mmpb.SimilarRequest]{
		Key: func(r *mmpb.SimilarRequest) string { return fmt.Sprintf("artist:similar:%d", r.GetArtistId()) },
		TTL: 24 * time.Hour,
	},
	MapRequest: func(req *mmpb.SimilarRequest) (map[string]any, error) {
		return map[string]any{"artistid": fmt.Sprintf("%d", req.GetArtistId())}, nil
	},
	MapResponse: func(raw json.RawMessage) (*mmpb.SimilarResponse, error) {
		var resp struct {
			Artists []struct {
				ID     int64  `json:"id"`        // 歌手ID
				Name   string `json:"name"`      // 歌手名
				PicUrl string `json:"img1v1Url"` // 1:1头像
			} `json:"artists"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析相似歌手失败: %w", err)
		}
		out := &mmpb.SimilarResponse{}
		for _, a := range resp.Artists {
			out.Artists = append(out.Artists, &mmpb.Artist{Id: a.ID, Name: a.Name, PicUrl: a.PicUrl})
		}
		return out, nil
	},
}

// Fans 获取歌手粉丝数。
var Fans = &engine.Endpoint[*mmpb.FansRequest, *mmpb.FansResponse]{
	Meta: weapiMeta("/weapi/artist/fans/count"),
	Cache: &engine.CachePolicy[*mmpb.FansRequest]{
		Key: func(r *mmpb.FansRequest) string { return fmt.Sprintf("artist:fans:%d", r.GetArtistId()) },
		TTL: 24 * time.Hour,
	},
	MapRequest: func(req *mmpb.FansRequest) (map[string]any, error) {
		return map[string]any{"id": fmt.Sprintf("%d", req.GetArtistId())}, nil
	},
	MapResponse: func(raw json.RawMessage) (*mmpb.FansResponse, error) {
		var resp struct {
			Data struct {
				FansCount int64 `json:"fansCount"` // 粉丝数
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析粉丝数失败: %w", err)
		}
		return &mmpb.FansResponse{Fans: resp.Data.FansCount}, nil
	},
}

// TopArtists 获取热门歌手列表。
var TopArtists = &engine.Endpoint[*mmpb.TopArtistsRequest, *mmpb.TopArtistsResponse]{
	Meta: weapiMeta("/weapi/artist/top"),
	Cache: &engine.CachePolicy[*mmpb.TopArtistsRequest]{
		Key: func(r *mmpb.TopArtistsRequest) string { return fmt.Sprintf("artist:toplist:%d:%d", r.GetLimit(), r.GetOffset()) },
		TTL: 24 * time.Hour,
	},
	MapRequest: func(req *mmpb.TopArtistsRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 30
		}
		return map[string]any{"limit": limit, "offset": req.GetOffset()}, nil
	},
	MapResponse: func(raw json.RawMessage) (*mmpb.TopArtistsResponse, error) {
		var resp struct {
			Artists []struct {
				ID     int64  `json:"id"`        // 歌手ID
				Name   string `json:"name"`      // 歌手名
				PicUrl string `json:"img1v1Url"` // 1:1头像
			} `json:"artists"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析热门歌手失败: %w", err)
		}
		out := &mmpb.TopArtistsResponse{}
		for _, a := range resp.Artists {
			out.Artists = append(out.Artists, &mmpb.Artist{Id: a.ID, Name: a.Name, PicUrl: a.PicUrl})
		}
		return out, nil
	},
}

// parseArtistSongs 解析歌手歌曲列表响应（AllSongs/TopSongs 共用）。
func parseArtistSongs(raw json.RawMessage) (*mmpb.AllSongsResponse, error) {
	var resp struct {
		Songs []struct {
			ID   int64  `json:"id"`   // 歌曲ID
			Name string `json:"name"` // 歌曲名
			Ar   []struct {
				ID   int64  `json:"id"`   // 歌手ID
				Name string `json:"name"` // 歌手名
			} `json:"ar"` // 歌手数组
			Al struct {
				ID     int64  `json:"id"`     // 专辑ID
				Name   string `json:"name"`   // 专辑名
				PicUrl string `json:"picUrl"` // 封面URL
			} `json:"al"` // 专辑
			Dt int64 `json:"dt"` // 时长毫秒
		} `json:"songs"`
		Total int `json:"total"` // 总数
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("解析歌手歌曲失败: %w", err)
	}
	out := &mmpb.AllSongsResponse{Total: int32(resp.Total)}
	for _, s := range resp.Songs {
		artists := make([]*mmpb.Artist, 0, len(s.Ar))
		for _, a := range s.Ar {
			artists = append(artists, &mmpb.Artist{Id: a.ID, Name: a.Name})
		}
		out.Songs = append(out.Songs, &mmpb.Song{
			Id: s.ID, Name: s.Name, Artists: artists,
			Album: &mmpb.Album{Id: s.Al.ID, Name: s.Al.Name, PicUrl: s.Al.PicUrl},
			DurationMs: s.Dt,
		})
	}
	return out, nil
}
