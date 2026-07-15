// Package model 的歌单实体映射。
package model

import (
	"encoding/json"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// rawPlaylistDetail 是网易云歌单详情接口的响应。
type rawPlaylistDetail struct {
	Code     int `json:"code"`
	Playlist struct {
		ID          int64     `json:"id"`
		Name        string    `json:"name"`
		CoverImgUrl string    `json:"coverImgUrl"`
		TrackCount  int       `json:"trackCount"`
		Creator     rawUser   `json:"creator"`
		Tracks      []rawSong `json:"tracks"`
		TrackIds    []struct {
			ID int64 `json:"id"`
		} `json:"trackIds"`
	} `json:"playlist"`
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
