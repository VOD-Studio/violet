// Package model 的用户详情解码。
package model

import (
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// rawUserDetail 是网易云用户详情接口的响应。
type rawUserDetail struct {
	Code   int `json:"code"`
	Level  int `json:"level"`
	Profile struct {
		UserID      int64  `json:"userId"`
		Nickname    string `json:"nickname"`
		AvatarURL   string `json:"avatarUrl"`
		Gender      int    `json:"gender"`
		Signature   string `json:"signature"`
		Followeds   int64  `json:"followeds"`
		Follows     int64  `json:"follows"`
	} `json:"profile"`
}

// DecodeUserDetail 解析用户详情响应。
func DecodeUserDetail(raw json.RawMessage) (*mmpb.UserDetail, error) {
	var r rawUserDetail
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("解析用户详情失败: %w", err)
	}
	if r.Profile.UserID == 0 {
		return nil, fmt.Errorf("用户不存在")
	}
	p := r.Profile
	return &mmpb.UserDetail{
		UserId:    p.UserID,
		Nickname:  p.Nickname,
		AvatarUrl: p.AvatarURL,
		Gender:    int32(p.Gender),
		Signature: p.Signature,
		Level:     int32(r.Level),
		Followeds: p.Followeds,
		Follows:   p.Follows,
	}, nil
}

// rawUserSubCount 是用户数量统计响应。
type rawUserSubCount struct {
	Code          int `json:"code"`
	PlaylistCount int `json:"playlistCount"`
	DjRadioCount  int `json:"djRadiosCount"`
	MvCount       int `json:"mvCount"`
	ArtistCount   int `json:"artistCount"`
	NewAlbumCount int `json:"newAlbumsCount"`
}

// DecodeUserSubCount 解析用户数量统计响应。
func DecodeUserSubCount(raw json.RawMessage) (*mmpb.UserSubCount, error) {
	var r rawUserSubCount
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("解析用户统计失败: %w", err)
	}
	return &mmpb.UserSubCount{
		PlaylistCount: int32(r.PlaylistCount),
		DjRadioCount:  int32(r.DjRadioCount),
		MvCount:       int32(r.MvCount),
		ArtistCount:   int32(r.ArtistCount),
		NewAlbumCount: int32(r.NewAlbumCount),
	}, nil
}

// rawUserPlaylists 是用户歌单列表响应。
type rawUserPlaylists struct {
	Code int `json:"code"`
	More bool `json:"more"`
	Playlist []struct {
		ID          int64  `json:"id"`
		Name        string `json:"name"`
		CoverImgUrl string `json:"coverImgUrl"`
		PlayCount   int64  `json:"playCount"`
		TrackCount  int    `json:"trackCount"`
		Creator     struct {
			UserID int64 `json:"userId"`
		} `json:"creator"`
	} `json:"playlist"`
}

// DecodeUserPlaylists 解析用户歌单列表响应。
// filter 按 userId == creator.userId 判断创建/收藏。
func DecodeUserPlaylists(raw json.RawMessage, ownerUserID int64, filter mmpb.PlaylistFilter) ([]*mmpb.SearchPlaylist, int32, error) {
	var r rawUserPlaylists
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, 0, fmt.Errorf("解析用户歌单失败: %w", err)
	}
	var out []*mmpb.SearchPlaylist
	for _, p := range r.Playlist {
		isCreated := p.Creator.UserID == ownerUserID
		switch filter {
		case mmpb.PlaylistFilter_PLAYLIST_FILTER_CREATED:
			if !isCreated {
				continue
			}
		case mmpb.PlaylistFilter_PLAYLIST_FILTER_SUBSCRIBED:
			if isCreated {
				continue
			}
		}
		out = append(out, &mmpb.SearchPlaylist{
			Id:         p.ID,
			Name:       p.Name,
			CoverUrl:   p.CoverImgUrl,
			PlayCount:  p.PlayCount,
			TrackCount: int32(p.TrackCount),
		})
	}
	return out, int32(len(r.Playlist)), nil
}
