// Package playlist 的相似/相关歌单接口声明。
//
// SimilarPlaylists（基于歌曲）/ RelatedPlaylistRecommend（基于歌单）两个接口，
// 全部返回完整 Playlist 实体（遵循列表响应统一实体 ADR）。
package playlist

import (
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// SimilarPlaylists 基于歌曲获取相似歌单（weapi，匿名，24h 缓存）。
var SimilarPlaylists = &engine.Endpoint[*mmpb.SimilarPlaylistsRequest, *mmpb.SimilarPlaylistsResponse]{
	Meta: weapiMeta("/weapi/discovery/simiPlaylist"),
	Cache: browseCache("playlist:simi", func(r *mmpb.SimilarPlaylistsRequest) string {
		return fmt.Sprintf("playlist:simiPlaylist:%d:%d:%d", r.GetSongId(), r.GetLimit(), r.GetOffset())
	}),
	NewResp: func() *mmpb.SimilarPlaylistsResponse { return &mmpb.SimilarPlaylistsResponse{} },
	MapRequest: func(req *mmpb.SimilarPlaylistsRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 50
		}
		return map[string]any{"songid": req.GetSongId(), "limit": limit, "offset": req.GetOffset()}, nil
	},
	MapResponse: func(req *mmpb.SimilarPlaylistsRequest, raw json.RawMessage) (*mmpb.SimilarPlaylistsResponse, error) {
		playlists, err := parseSimilarPlaylists(raw)
		if err != nil {
			return nil, fmt.Errorf("解析相似歌单失败: %w", err)
		}
		return &mmpb.SimilarPlaylistsResponse{Playlists: playlists}, nil
	},
}

// RelatedPlaylistRecommend 基于歌单获取相关歌单推荐（eapi）。
//
// 替代已废弃的 HTML 抓取相关歌单接口（/related/playlist，网易云已失效）。
var RelatedPlaylistRecommend = &engine.Endpoint[*mmpb.RelatedPlaylistRecommendRequest, *mmpb.RelatedPlaylistRecommendResponse]{
	Meta: engine.Meta{
		Path: "/eapi/playlist/detail/rcmd/get", Method: "POST",
		Crypto: engine.CryptoEAPI, Auth: session.AuthAnonymous,
	},
	Cache: browseCache("playlist:rcmd", func(r *mmpb.RelatedPlaylistRecommendRequest) string {
		return fmt.Sprintf("playlist:relatedRcmd:%d", r.GetPlaylistId())
	}),
	NewResp: func() *mmpb.RelatedPlaylistRecommendResponse { return &mmpb.RelatedPlaylistRecommendResponse{} },
	MapRequest: func(req *mmpb.RelatedPlaylistRecommendRequest) (map[string]any, error) {
		return map[string]any{
			"scene":      "playlist_head",
			"playlistId": req.GetPlaylistId(),
			"newStyle":   "true",
		}, nil
	},
	MapResponse: func(req *mmpb.RelatedPlaylistRecommendRequest, raw json.RawMessage) (*mmpb.RelatedPlaylistRecommendResponse, error) {
		playlists, err := parseSimilarPlaylists(raw)
		if err != nil {
			return nil, fmt.Errorf("解析相关歌单推荐失败: %w", err)
		}
		return &mmpb.RelatedPlaylistRecommendResponse{Playlists: playlists}, nil
	},
}

// parseSimilarPlaylists 解析相似/相关歌单列表响应（{playlists:[...]} 或 {data:{playlists:[...]}}）。
//
// 与 parsePlaylistSlice 同构，但 simi/rcmd 接口的响应字段集合略有差异（可能不带 total/trackCount），
// 故独立解析，宽松映射可用字段。
func parseSimilarPlaylists(raw json.RawMessage) ([]*mmpb.Playlist, error) {
	var resp struct {
		Playlists []struct {
			ID          int64  `json:"id"`          // 歌单ID
			Name        string `json:"name"`        // 歌单名
			CoverImgUrl string `json:"coverImgUrl"` // 封面URL
			PicUrl      string `json:"picUrl"`      // 封面URL（rcmd 接口可能用 picUrl）
			PlayCount   int64  `json:"playCount"`   // 播放数
			TrackCount  int    `json:"trackCount"`  // 曲目数
			Creator     struct {
				UserID   int64  `json:"userId"`   // 创建者用户ID
				Nickname string `json:"nickname"` // 创建者昵称
			} `json:"creator"` // 创建者
		} `json:"playlists"`
		// eapi rcmd 接口可能把列表嵌在 data 里。
		Data struct {
			Playlists []struct {
				ID          int64  `json:"id"`          // 歌单ID
				Name        string `json:"name"`        // 歌单名
				CoverImgUrl string `json:"coverImgUrl"` // 封面URL
				PicUrl      string `json:"picUrl"`      // 封面URL
				PlayCount   int64  `json:"playCount"`   // 播放数
				TrackCount  int    `json:"trackCount"`  // 曲目数
				Creator     struct {
					UserID   int64  `json:"userId"`   // 创建者用户ID
					Nickname string `json:"nickname"` // 创建者昵称
				} `json:"creator"` // 创建者
			} `json:"playlists"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, err
	}
	items := resp.Playlists
	if len(items) == 0 && len(resp.Data.Playlists) > 0 {
		items = resp.Data.Playlists
	}
	out := make([]*mmpb.Playlist, 0, len(items))
	for _, p := range items {
		cover := p.CoverImgUrl
		if cover == "" {
			cover = p.PicUrl
		}
		out = append(out, &mmpb.Playlist{
			Id: p.ID, Name: p.Name, CoverUrl: cover,
			PlayCount: p.PlayCount, TrackCount: int32(p.TrackCount),
			Creator: &mmpb.User{Id: p.Creator.UserID, Nickname: p.Creator.Nickname},
		})
	}
	return out, nil
}
