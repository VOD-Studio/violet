// Package model 是网易云领域映射层。
//
// 每个领域实体定义「网易云原始 JSON 的 struct 镜像 + map 到 proto 的函数」，
// 写一次后全局复用。例如 MapSong 被歌曲详情、每日推荐、歌单曲目、专辑曲目、
// 搜索(单曲)等几十个接口复用。
//
// 这是「该复用的复用」的落点，把看似 357 次的映射塌缩为约 30 次领域映射 + 接口级组装。
package model

import (
	"encoding/json"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// --- raw struct 镜像（网易云原始 JSON，字段名保留缩写） ---

// rawSong 是网易云歌曲的原始 JSON 结构。
type rawSong struct {
	ID   int64       `json:"id"`
	Name string      `json:"name"`
	Ar   []rawArtist `json:"ar"`
	Al   rawAlbum    `json:"al"`
	Dt   int64       `json:"dt"`
	Fee  int         `json:"fee"`
}

// rawSongDetail 是歌曲详情接口的响应。
type rawSongDetail struct {
	Code  int       `json:"code"`
	Songs []rawSong `json:"songs"`
}

// --- map 函数（返回 proto 类型，全局复用） ---

// MapSong 把网易云原始歌曲结构转成 proto Song。
func MapSong(s rawSong) *mmpb.Song {
	return &mmpb.Song{
		Id:         s.ID,
		Name:       s.Name,
		Artists:    MapArtists(s.Ar),
		Album:      MapAlbum(s.Al),
		DurationMs: s.Dt,
		Fee:        int32(s.Fee),
	}
}

// MapSongs 把网易云原始歌曲数组转成 proto Song 列表。
func MapSongs(in []rawSong) []*mmpb.Song {
	out := make([]*mmpb.Song, 0, len(in))
	for _, s := range in {
		out = append(out, MapSong(s))
	}
	return out
}

// DecodeSongDetail 解析歌曲详情响应的原始 JSON。
func DecodeSongDetail(raw json.RawMessage) ([]*mmpb.Song, error) {
	var r rawSongDetail
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, err
	}
	return MapSongs(r.Songs), nil
}
