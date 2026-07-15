// Package model 的歌手实体映射与歌手详情解码。
package model

import (
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// rawArtist 是网易云歌手的原始 JSON 结构。
//
// 在歌曲的 ar 字段、专辑的 artist 字段、歌手详情等处出现。
type rawArtist struct {
	ID    int64    `json:"id"`
	Name  string   `json:"name"`
	Alias []string `json:"alias"`
	Pic   string   `json:"picUrl"`
	Img   string   `json:"img1v1Url"`
}

// rawArtistInfo 是网易云歌手详情接口的响应。
type rawArtistInfo struct {
	Code int `json:"code"`
	Artist struct {
		ID         int64  `json:"id"`
		Name       string `json:"name"`
		Img1v1URL  string `json:"img1v1Url"`
		BriefDesc  string `json:"briefDesc"`
	} `json:"artist"`
	HotSongs []rawSong `json:"hotSongs"`
}

// MapArtist 把网易云原始歌手结构转成 proto Artist。
func MapArtist(a rawArtist) *mmpb.Artist {
	return &mmpb.Artist{
		Id:     a.ID,
		Name:   a.Name,
		Alias:  a.Alias,
		PicUrl: firstNonEmpty(a.Pic, a.Img),
	}
}

// MapArtists 把网易云原始歌手数组转成 proto Artist 列表。
func MapArtists(in []rawArtist) []*mmpb.Artist {
	out := make([]*mmpb.Artist, 0, len(in))
	for _, a := range in {
		out = append(out, MapArtist(a))
	}
	return out
}

// DecodeArtistInfo 解析歌手详情响应的原始 JSON。
func DecodeArtistInfo(raw json.RawMessage) (*mmpb.Artist, []*mmpb.Song, error) {
	var r rawArtistInfo
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, nil, fmt.Errorf("解析歌手信息失败: %w", err)
	}
	a := r.Artist
	artist := &mmpb.Artist{
		Id:     a.ID,
		Name:   a.Name,
		PicUrl: a.Img1v1URL,
	}
	return artist, MapSongs(r.HotSongs), nil
}

// firstNonEmpty 返回第一个非空字符串。
func firstNonEmpty(ss ...string) string {
	for _, s := range ss {
		if s != "" {
			return s
		}
	}
	return ""
}
