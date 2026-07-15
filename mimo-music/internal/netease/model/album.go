// Package model 的专辑实体映射。
package model

import (
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// rawAlbum 是网易云专辑的原始 JSON 结构。
//
// 在歌曲的 al 字段、专辑详情等处出现。
type rawAlbum struct {
	ID          int64      `json:"id"`
	Name        string     `json:"name"`
	Pic         string     `json:"picUrl"`
	PublishTime int64      `json:"publishTime"`
	Artist      rawArtist  `json:"artist"`
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
