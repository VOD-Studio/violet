// Package model 的专辑实体映射与专辑详情解码。
package model

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// rawAlbum 是网易云专辑的原始 JSON 结构。
//
// 在歌曲的 al 字段、专辑详情等处出现。
type rawAlbum struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Pic         string    `json:"picUrl"`
	PublishTime int64     `json:"publishTime"`
	Artist      rawArtist `json:"artist"`
}

// rawAlbumDetail 是网易云专辑详情接口的响应。
type rawAlbumDetail struct {
	Code  int       `json:"code"`
	Album struct {
		ID          int64       `json:"id"`
		Name        string      `json:"name"`
		PicUrl      string      `json:"picUrl"`
		PublishTime string      `json:"publishTime"`
		Artists     []rawArtist `json:"artists"`
	} `json:"album"`
	Songs []rawSong `json:"songs"`
}

// MapAlbum 把网易云原始专辑结构转成 proto Album。
func MapAlbum(a rawAlbum) *mmpb.Album {
	publishTime := ""
	if a.PublishTime > 0 {
		// 网易云 publishTime 是毫秒级 Unix 时间戳，转成可读字符串。
		publishTime = time.UnixMilli(a.PublishTime).Format("2006-01-02")
	}
	return &mmpb.Album{
		Id:          a.ID,
		Name:        a.Name,
		PicUrl:      a.Pic,
		PublishTime: publishTime,
		Artist:      MapArtist(a.Artist),
	}
}

// DecodeAlbumDetail 解析专辑详情响应的原始 JSON。
func DecodeAlbumDetail(raw json.RawMessage) (*mmpb.Album, []*mmpb.Song, error) {
	var r rawAlbumDetail
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, nil, fmt.Errorf("解析专辑详情失败: %w", err)
	}
	a := r.Album
	var albumArtist *mmpb.Artist
	if len(a.Artists) > 0 {
		albumArtist = MapArtist(a.Artists[0])
	}
	album := &mmpb.Album{
		Id:          a.ID,
		Name:        a.Name,
		PicUrl:      a.PicUrl,
		PublishTime: a.PublishTime,
		Artist:      albumArtist,
	}
	return album, MapSongs(r.Songs), nil
}
