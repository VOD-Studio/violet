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
	ID          int64     `json:"id"`          // 专辑ID
	Name        string    `json:"name"`        // 专辑名
	Pic         string    `json:"picUrl"`      // 封面URL
	PublishTime int64     `json:"publishTime"` // 发行时间(毫秒时间戳)
	Artist      rawArtist `json:"artist"`      // 歌手
}

// rawAlbumDetail 是网易云专辑详情接口的响应。
type rawAlbumDetail struct {
	Code  int `json:"code"` // 业务码
	Album struct {
		ID          int64       `json:"id"`          // 专辑ID
		Name        string      `json:"name"`        // 专辑名
		PicUrl      string      `json:"picUrl"`      // 封面URL
		PublishTime string      `json:"publishTime"` // 发行时间（网易云原始字符串格式）
		Artists     []rawArtist `json:"artists"`     // 歌手数组
	} `json:"album"` // 专辑信息
	Songs []rawSong `json:"songs"` // 歌曲列表
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

// MapAlbums 把网易云原始专辑数组转成 proto Album 列表。
// 新碟列表、收藏列表、最新专辑等列表接口复用。
func MapAlbums(in []rawAlbum) []*mmpb.Album {
	out := make([]*mmpb.Album, 0, len(in))
	for _, a := range in {
		out = append(out, MapAlbum(a))
	}
	return out
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

// --- 专辑列表解码（新碟/最新/收藏列表等复用） ---

// rawAlbumList 是网易云专辑列表接口的通用响应（albums 字段名在不同接口一致）。
type rawAlbumList struct {
	Code   int        `json:"code"`   // 业务码
	Albums []rawAlbum `json:"albums"` // 专辑数组（newest/new/shelf/sublist 通用字段名）
	Total  int        `json:"total"`  // 总数（带分页的接口有）
	More   bool       `json:"more"`   // 是否还有更多（部分接口用此标记而非 total）
}

// DecodeAlbumList 解析专辑列表响应，只取专辑数组（最新专辑等不带分页的接口用）。
func DecodeAlbumList(raw json.RawMessage) ([]*mmpb.Album, error) {
	var r rawAlbumList
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("解析专辑列表失败: %w", err)
	}
	return MapAlbums(r.Albums), nil
}

// DecodeAlbumListWithTotal 解析带 total 的专辑列表响应（全部新碟/收藏列表用）。
func DecodeAlbumListWithTotal(raw json.RawMessage) ([]*mmpb.Album, int32, error) {
	var r rawAlbumList
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, 0, fmt.Errorf("解析专辑列表失败: %w", err)
	}
	return MapAlbums(r.Albums), int32(r.Total), nil
}

// DecodeAlbumListWithMore 解析带 more 标记的专辑列表响应（新碟上架用）。
func DecodeAlbumListWithMore(raw json.RawMessage) ([]*mmpb.Album, bool, error) {
	var r rawAlbumList
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, false, fmt.Errorf("解析专辑列表失败: %w", err)
	}
	return MapAlbums(r.Albums), r.More, nil
}
