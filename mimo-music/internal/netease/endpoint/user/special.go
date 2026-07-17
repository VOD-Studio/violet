// Package user 的特殊接口声明（不走标准 Execute 缓存路径）。
//
// DetailByName/FollowEachOther 是匿名 cookie 的直接调用。DetailByName 用公开搜索实现,
// 仍是 engine.Endpoint;FollowEachOther 需要动态 path(uid 拼进 URL)且要遍历关注列表
// 做业务判断,改用 Meta 函数 + Request/Parse 形式,service 层调 RawDoWithCookieAndInput
// （第三条执行路径,见 ADR §4.5）。两者不缓存（动态/即时数据）。
package user

import (
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// DetailByName 根据 nickname 获取 userid（匿名 cookie）。
//
// 上游没有昵称直查接口（旧 path /weapi/v1/w/user/info/detail 真机返回 404),
// 改用公开搜索 type=1002(用户)取第一条结果。
var DetailByName = &engine.Endpoint[*mmpb.DetailByNameRequest, *mmpb.DetailByNameResponse]{
	Meta: engine.Meta{
		Path:   "/api/search/get",
		Method: "GET",
		Crypto: engine.CryptoNone,
		Auth:   session.AuthAnonymous,
	},
	MapRequest: func(req *mmpb.DetailByNameRequest) (map[string]any, error) {
		return map[string]any{
			"s":      req.GetNickname(),
			"type":   1002, // 搜索用户
			"limit":  1,
			"offset": 0,
		}, nil
	},
	MapResponse: func(_ *mmpb.DetailByNameRequest, raw json.RawMessage) (*mmpb.DetailByNameResponse, error) {
		var resp struct {
			Result struct {
				Userprofiles []struct {
					UserID int64 `json:"userId"` // 用户ID
				} `json:"userprofiles"`
			} `json:"result"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析昵称查询失败: %w", err)
		}
		if len(resp.Result.Userprofiles) == 0 {
			return nil, fmt.Errorf("未找到该昵称对应的用户")
		}
		return &mmpb.DetailByNameResponse{UserId: resp.Result.Userprofiles[0].UserID}, nil
	},
}

// FollowEachOther 判断两个用户是否互相关注（查 target 的关注列表里是否含 user）。
//
// 网易云无直接接口，取 target 的关注列表遍历判断。path 需要把 target uid 拼进 URL
// （/weapi/user/getfollows/{uid}），endpoint 架构暂不支持动态 path，
// 因此用 Meta 函数 + Request/Parse 的第三条执行路径（同 auth/playlist 写接口）。

// FollowEachOtherMeta 构造获取 target 关注列表的 Meta（uid 拼进 path）。
func FollowEachOtherMeta(targetUID int64) engine.Meta {
	return engine.Meta{
		Path:   fmt.Sprintf("/weapi/user/getfollows/%d", targetUID),
		Method: "POST",
		Crypto: engine.CryptoWeAPI,
		Auth:   session.AuthAnonymous,
	}
}

// FollowEachOtherRequest 构造关注列表入参（最多拉前 100 条做包含判断）。
func FollowEachOtherRequest(_ *mmpb.FollowEachOtherRequest) map[string]any {
	return map[string]any{"offset": 0, "limit": 100, "order": true}
}

// ParseFollowEachOther 遍历响应的 follow 数组,判断是否包含 req.UserId。
func ParseFollowEachOther(req *mmpb.FollowEachOtherRequest, raw json.RawMessage) (*mmpb.FollowEachOtherResponse, error) {
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
}
