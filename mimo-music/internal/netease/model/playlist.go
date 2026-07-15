// Package model 的歌单实体映射。
package model

import (
	"encoding/json"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// rawPlaylistDetail 是网易云歌单详情接口的响应。
type rawPlaylistDetail struct {
	Code     int `json:"code"` // 业务码
	Playlist struct {
		ID          int64     `json:"id"`          // 歌单ID
		Name        string    `json:"name"`        // 歌单名
		CoverImgUrl string    `json:"coverImgUrl"` // 封面URL
		TrackCount  int       `json:"trackCount"`  // 歌曲总数
		Creator     rawUser   `json:"creator"`     // 创建者
		Tracks      []rawSong `json:"tracks"`      // 歌曲列表（详情返回前若干首）
		TrackIds    []struct {
			ID int64 `json:"id"` // 歌曲ID
		} `json:"trackIds"` // 全部歌曲ID（大歌单分页拉取用）
	} `json:"playlist"` // 歌单信息
}

// MapPlaylist 把网易云原始歌单结构转成 proto Playlist。
func MapPlaylist(raw json.RawMessage) (*mmpb.Playlist, error) {
	var r rawPlaylistDetail
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, err
	}
	p := r.Playlist
	return &mmpb.Playlist{
		Id:         p.ID,
		Name:       p.Name,
		CoverUrl:   p.CoverImgUrl,
		TrackCount: int32(p.TrackCount),
		Creator:    MapUser(p.Creator),
		Songs:      MapSongs(p.Tracks),
	}, nil
}
