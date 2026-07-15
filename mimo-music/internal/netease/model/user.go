// Package model 的用户实体映射。
package model

import mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"

// rawUser 是网易云用户的原始 JSON 结构。
//
// 在歌单创建者、用户详情、关注/粉丝列表等处出现。
type rawUser struct {
	UserID    int64  `json:"userId"`   // 用户ID（歌单创建者等场景）
	Nickname  string `json:"nickname"` // 昵称
	AvatarURL string `json:"avatarUrl"` // 头像URL
	// LoginStatus 等接口用不同的字段名。
	ProfileUserID int64  `json:"id"` // 用户ID（LoginStatus 等 profile.id 场景）
}

// MapUser 把网易云原始用户结构转成 proto User。
func MapUser(u rawUser) *mmpb.User {
	// userId 和 id 两种字段名都可能出现，优先 userId。
	id := u.UserID
	if id == 0 {
		id = u.ProfileUserID
	}
	return &mmpb.User{
		Id:        id,
		Nickname:  u.Nickname,
		AvatarUrl: u.AvatarURL,
	}
}
