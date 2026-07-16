// Package user 的社交接口解析辅助函数。
package user

import (
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// rawFollowItem 是网易云关注/粉丝列表的单个用户结构。
type rawFollowItem struct {
	UserID      int64  `json:"userId"`   // 用户ID
	Nickname    string `json:"nickname"` // 昵称
	AvatarURL   string `json:"avatarUrl"` // 头像URL
	Followeds   int64  `json:"followeds"` // 粉丝数
	Follows     int64  `json:"follows"`   // 关注数
}

// parseFollowList 解析关注列表。
func parseFollowList(_ *mmpb.FollowsRequest, raw json.RawMessage) (*mmpb.FollowsResponse, error) {
	var resp struct {
		Follow []rawFollowItem `json:"follow"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("解析关注列表失败: %w", err)
	}
	out := &mmpb.FollowsResponse{Total: int32(len(resp.Follow))}
	for _, f := range resp.Follow {
		out.Follows = append(out.Follows, followItemToDetail(f))
	}
	return out, nil
}

// parseFollowedList 解析粉丝列表。
func parseFollowedList(_ *mmpb.FollowedsRequest, raw json.RawMessage) (*mmpb.FollowedsResponse, error) {
	var resp struct {
		Followeds []rawFollowItem `json:"followeds"`
		More      bool            `json:"more"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("解析粉丝列表失败: %w", err)
	}
	out := &mmpb.FollowedsResponse{Total: int32(len(resp.Followeds))}
	for _, f := range resp.Followeds {
		out.Followeds = append(out.Followeds, followItemToDetail(f))
	}
	return out, nil
}

// followItemToDetail 把关注/粉丝条目转成 UserDetail。
func followItemToDetail(f rawFollowItem) *mmpb.UserDetail {
	return &mmpb.UserDetail{
		UserId:    f.UserID,
		Nickname:  f.Nickname,
		AvatarUrl: f.AvatarURL,
		Followeds: f.Followeds,
		Follows:   f.Follows,
	}
}

// parsePlayRecord 解析播放记录。
func parsePlayRecord(_ *mmpb.RecordRequest, raw json.RawMessage) (*mmpb.RecordResponse, error) {
	// 网易云播放记录可能返回 weekData / allData 两个数组，按请求 type 决定。
	var resp struct {
		WeekData []struct {
			PlayCount int `json:"playCount"` // 播放次数
			Song      struct {
				ID   int64  `json:"id"`   // 歌曲ID
				Name string `json:"name"` // 歌曲名
			} `json:"song"`
		} `json:"weekData"`
		AllData []struct {
			PlayCount int `json:"playCount"`
			Song      struct {
				ID   int64  `json:"id"`
				Name string `json:"name"`
			} `json:"song"`
		} `json:"allData"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("解析播放记录失败: %w", err)
	}
	out := &mmpb.RecordResponse{}
	for _, r := range resp.WeekData {
		out.Records = append(out.Records, &mmpb.PlayRecord{
			PlayCount: int32(r.PlayCount),
			Song:      &mmpb.Song{Id: r.Song.ID, Name: r.Song.Name},
		})
	}
	for _, r := range resp.AllData {
		out.Records = append(out.Records, &mmpb.PlayRecord{
			PlayCount: int32(r.PlayCount),
			Song:      &mmpb.Song{Id: r.Song.ID, Name: r.Song.Name},
		})
	}
	return out, nil
}
