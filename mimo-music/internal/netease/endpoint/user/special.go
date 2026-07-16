// Package user 的特殊接口声明（不走标准 Execute 缓存路径）。
//
// DetailByName/FollowEachOther 是匿名 cookie 的直接调用，且 FollowEachOther 需要遍历
// 关注列表做业务判断（非纯映射）。两者不缓存（动态/即时数据），Meta + MapRequest + MapResponse
// 仍声明在此，service 层调 RawDoWithCookieAndInput（第三条执行路径，见 ADR §4.5）。
package user

import (
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// DetailByName 根据 nickname 获取 userid（匿名 cookie）。
var DetailByName = &engine.Endpoint[*mmpb.DetailByNameRequest, *mmpb.DetailByNameResponse]{
	Meta: engine.Meta{
		Path:   "/weapi/v1/w/user/info/detail",
		Method: "POST",
		Crypto: engine.CryptoWeAPI,
		Auth:   session.AuthAnonymous,
	},
	MapRequest: func(req *mmpb.DetailByNameRequest) (map[string]any, error) {
		return map[string]any{"nickname": req.GetNickname()}, nil
	},
	MapResponse: func(_ *mmpb.DetailByNameRequest, raw json.RawMessage) (*mmpb.DetailByNameResponse, error) {
		var resp struct {
			Code int `json:"code"` // 业务码
			User struct {
				UserID int64 `json:"userId"` // 用户ID
			} `json:"user"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析昵称查询失败: %w", err)
		}
		return &mmpb.DetailByNameResponse{UserId: resp.User.UserID}, nil
	},
}

// FollowEachOther 判断两个用户是否互相关注（查 target 的关注列表里是否含 user）。
//
// 网易云无直接接口，取 target 的关注列表遍历判断。MapResponse 遍历响应的 follow 数组。
var FollowEachOther = &engine.Endpoint[*mmpb.FollowEachOtherRequest, *mmpb.FollowEachOtherResponse]{
	Meta: engine.Meta{
		Path:   "/weapi/user/getfollows",
		Method: "POST",
		Crypto: engine.CryptoWeAPI,
		Auth:   session.AuthAnonymous,
	},
	MapRequest: func(req *mmpb.FollowEachOtherRequest) (map[string]any, error) {
		return map[string]any{
			"uid":    fmt.Sprintf("%d", req.GetTargetUserId()),
			"limit":  100,
			"offset": 0,
		}, nil
	},
	MapResponse: func(req *mmpb.FollowEachOtherRequest, raw json.RawMessage) (*mmpb.FollowEachOtherResponse, error) {
		var resp struct {
			Follow []struct {
				UserID int64 `json:"userId"` // 被关注用户ID
			} `json:"follow"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析关注列表失败: %w", err)
		}
		for _, f := range resp.Follow {
			if f.UserID == req.GetUserId() {
				return &mmpb.FollowEachOtherResponse{FollowEachOther: true}, nil
			}
		}
		return &mmpb.FollowEachOtherResponse{FollowEachOther: false}, nil
	},
}
