// Package user 的相似用户接口声明（按返回实体归属 UserService）。
package user

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// SimilarUsers 基于歌曲获取听歌的人（weapi，匿名，24h 缓存）。
var SimilarUsers = &engine.Endpoint[*mmpb.SimilarUsersRequest, *mmpb.SimilarUsersResponse]{
	Meta: engine.Meta{
		Path: "/weapi/discovery/simiUser", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.SimilarUsersRequest]{
		Key: func(r *mmpb.SimilarUsersRequest) string {
			return fmt.Sprintf("user:similar:%d:%d:%d", r.GetSongId(), r.GetLimit(), r.GetOffset())
		},
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.SimilarUsersResponse { return &mmpb.SimilarUsersResponse{} },
	MapRequest: func(req *mmpb.SimilarUsersRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 50
		}
		return map[string]any{"songid": req.GetSongId(), "limit": limit, "offset": req.GetOffset()}, nil
	},
	MapResponse: func(req *mmpb.SimilarUsersRequest, raw json.RawMessage) (*mmpb.SimilarUsersResponse, error) {
		var resp struct {
			Userprofiles []struct {
				UserID    int64  `json:"userId"`    // 用户ID
				Nickname  string `json:"nickname"`  // 昵称
				AvatarUrl string `json:"avatarUrl"` // 头像URL
			} `json:"userprofiles"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析相似用户失败: %w", err)
		}
		out := make([]*mmpb.User, 0, len(resp.Userprofiles))
		for _, u := range resp.Userprofiles {
			out = append(out, &mmpb.User{
				Id: u.UserID, Nickname: u.Nickname, AvatarUrl: u.AvatarUrl,
			})
		}
		return &mmpb.SimilarUsersResponse{Users: out}, nil
	},
}
