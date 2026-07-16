// Package model 的每日推荐解码。
package model

import (
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// rawRecommendDaily 是网易云每日推荐接口的响应。
type rawRecommendDaily struct {
	Code int `json:"code"` // 业务码
	Data struct {
		DailySongs []rawSong `json:"dailySongs"` // 每日推荐歌曲列表
	} `json:"data"` // 推荐数据
}

// DecodeDailyRecommend 解析每日推荐响应的原始 JSON。
func DecodeDailyRecommend(raw json.RawMessage) ([]*mmpb.Song, error) {
	var r rawRecommendDaily
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("解析每日推荐失败: %w", err)
	}
	return MapSongs(r.Data.DailySongs), nil
}

// rawFMPersonal 是网易云私人 FM 接口的响应。
type rawFMPersonal struct {
	Code int       `json:"code"` // 业务码
	Data []rawSong `json:"data"` // FM推荐歌曲列表
}

// DecodePersonalFM 解析私人 FM 响应的原始 JSON。
func DecodePersonalFM(raw json.RawMessage) ([]*mmpb.Song, error) {
	var r rawFMPersonal
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("解析私人 FM 失败: %w", err)
	}
	return MapSongs(r.Data), nil
}

// --- 推荐扩展解码 ---

// rawRecommendPlaylist 是推荐歌单列表项（每日推荐歌单 / 推荐歌单共用结构）。
type rawRecommendPlaylist struct {
	ID          int64   `json:"id"`          // 歌单ID
	Name        string  `json:"name"`        // 歌单名
	PicUrl      string  `json:"picUrl"`      // 封面URL
	CoverImgUrl string  `json:"coverImgUrl"` // 封面URL（部分接口用此字段名）
	PlayCount   float64 `json:"playCount"`   // 播放数（网易云大数字用科学计数法，float64 容纳）
	TrackCount  int     `json:"trackCount"`  // 曲目数
	Creator     struct {
		UserID   int64  `json:"userId"`   // 创建者用户ID
		Nickname string `json:"nickname"` // 创建者昵称
	} `json:"creator"` // 创建者
}

// rawRecommendPlaylistsResponse 是每日推荐歌单 / 推荐歌单的列表响应。
//
// 每日推荐歌单用 recommend[] 字段，推荐歌单用 result[]，两者结构一致故共用。
type rawRecommendPlaylistsResponse struct {
	Code      int                    `json:"code"`      // 业务码
	Recommend []rawRecommendPlaylist `json:"recommend"` // 每日推荐歌单（recommend/resource）
	Result    []rawRecommendPlaylist `json:"result"`    // 推荐歌单（personalized/playlist）
}

// DecodeRecommendPlaylists 解析推荐歌单列表响应（兼容 recommend/result 两种字段名）。
func DecodeRecommendPlaylists(raw json.RawMessage) ([]*mmpb.Playlist, error) {
	var r rawRecommendPlaylistsResponse
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("解析推荐歌单失败: %w", err)
	}
	items := r.Recommend
	if len(items) == 0 {
		items = r.Result
	}
	out := make([]*mmpb.Playlist, 0, len(items))
	for _, p := range items {
		cover := p.PicUrl
		if cover == "" {
			cover = p.CoverImgUrl
		}
		out = append(out, &mmpb.Playlist{
			Id: p.ID, Name: p.Name, CoverUrl: cover,
			PlayCount: int64(p.PlayCount), TrackCount: int32(p.TrackCount),
			Creator: &mmpb.User{Id: p.Creator.UserID, Nickname: p.Creator.Nickname},
		})
	}
	return out, nil
}

// rawRecommendNewSong 是推荐新音乐列表项（歌曲嵌在 song 字段下）。
type rawRecommendNewSong struct {
	ID   int64             `json:"id"`   // 列表项ID（非歌曲ID）
	Song rawRecommendSong  `json:"song"` // 实际歌曲信息（全名字段 artists/album/duration）
}

// rawRecommendSong 是推荐/新歌接口的歌曲项（字段名用全名，与 rawSong 的缩写不同）。
type rawRecommendSong struct {
	ID       int64  `json:"id"`       // 歌曲ID
	Name     string `json:"name"`     // 歌曲名
	Artists []struct {
		ID   int64  `json:"id"`   // 歌手ID
		Name string `json:"name"` // 歌手名
	} `json:"artists"` // 歌手数组（全名，非 ar）
	Album struct {
		ID     int64  `json:"id"`     // 专辑ID
		Name   string `json:"name"`   // 专辑名
		PicUrl string `json:"picUrl"` // 封面URL
	} `json:"album"` // 专辑（全名，非 al）
	Duration int64 `json:"duration"` // 时长毫秒（全名，非 dt）
	Fee      int   `json:"fee"`      // 付费类型
}

// rawRecommendNewSongsResponse 是推荐新音乐的列表响应。
type rawRecommendNewSongsResponse struct {
	Code   int                   `json:"code"`   // 业务码
	Result []rawRecommendNewSong `json:"result"` // 推荐新音乐列表
}

// DecodeRecommendNewSongs 解析推荐新音乐响应（歌曲嵌在 result[i].song 下，字段用全名）。
func DecodeRecommendNewSongs(raw json.RawMessage) ([]*mmpb.Song, error) {
	var r rawRecommendNewSongsResponse
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("解析推荐新音乐失败: %w", err)
	}
	out := make([]*mmpb.Song, 0, len(r.Result))
	for _, item := range r.Result {
		s := item.Song
		artists := make([]*mmpb.Artist, 0, len(s.Artists))
		for _, a := range s.Artists {
			artists = append(artists, &mmpb.Artist{Id: a.ID, Name: a.Name})
		}
		out = append(out, &mmpb.Song{
			Id: s.ID, Name: s.Name, Artists: artists,
			Album:      &mmpb.Album{Id: s.Album.ID, Name: s.Album.Name, PicUrl: s.Album.PicUrl},
			DurationMs: s.Duration, Fee: int32(s.Fee),
		})
	}
	return out, nil
}
