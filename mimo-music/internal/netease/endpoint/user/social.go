// Package user 的社交与动态接口声明。
//
// Follows/Followeds/Events/Record/Level 五个接口。复用 UserService。
package user

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// Follows 是获取用户关注列表的接口声明。
var Follows = &engine.Endpoint[*mmpb.FollowsRequest, *mmpb.FollowsResponse]{
	Meta: engine.Meta{
		Path: "/weapi/user/getfollows", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.FollowsRequest]{
		Key: func(req *mmpb.FollowsRequest) string {
			return fmt.Sprintf("user:follows:%d:%d:%d", req.GetUserId(), req.GetLimit(), req.GetOffset())
		},
		TTL: 24 * time.Hour,
	},
	NewResp:    func() *mmpb.FollowsResponse { return &mmpb.FollowsResponse{} },
	MapRequest: func(req *mmpb.FollowsRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 30
		}
		return map[string]any{"uid": fmt.Sprintf("%d", req.GetUserId()), "limit": limit, "offset": req.GetOffset()}, nil
	},
	MapResponse: parseFollowList,
}

// Followeds 是获取用户粉丝列表的接口声明。
var Followeds = &engine.Endpoint[*mmpb.FollowedsRequest, *mmpb.FollowedsResponse]{
	Meta: engine.Meta{
		Path: "/weapi/user/getfolloweds", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.FollowedsRequest]{
		Key: func(req *mmpb.FollowedsRequest) string {
			return fmt.Sprintf("user:followeds:%d:%d:%d", req.GetUserId(), req.GetLimit(), req.GetLastTime())
		},
		TTL: 24 * time.Hour,
	},
	NewResp:    func() *mmpb.FollowedsResponse { return &mmpb.FollowedsResponse{} },
	MapRequest: func(req *mmpb.FollowedsRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 30
		}
		return map[string]any{
			"userId": fmt.Sprintf("%d", req.GetUserId()),
			"limit":  limit, "lasttime": req.GetLastTime(),
		}, nil
	},
	MapResponse: parseFollowedList,
}

// Events 是获取用户动态的接口声明。
var Events = &engine.Endpoint[*mmpb.EventsRequest, *mmpb.EventsResponse]{
	Meta: engine.Meta{
		Path: "/weapi/event/get", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.EventsRequest]{
		Key: func(req *mmpb.EventsRequest) string {
			return fmt.Sprintf("user:events:%d:%d:%d", req.GetUserId(), req.GetLimit(), req.GetLastEventId())
		},
		TTL: 10 * time.Minute,
	},
	NewResp: func() *mmpb.EventsResponse { return &mmpb.EventsResponse{} },
	MapRequest: func(req *mmpb.EventsRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 30
		}
		return map[string]any{
			"uid": fmt.Sprintf("%d", req.GetUserId()), "limit": limit,
			"lasttime": req.GetLastEventId(),
		}, nil
	},
	MapResponse: func(_ *mmpb.EventsRequest, raw json.RawMessage) (*mmpb.EventsResponse, error) {
		var resp struct {
			Events []struct {
				ID        int64  `json:"id"`        // 动态ID
				UserID    int64  `json:"userId"`    // 发布者ID
				Type      int    `json:"type"`      // 动态类型
				JSON      string `json:"json"`      // 动态JSON内容
				ShowTime  int64  `json:"showTime"`  // 发布时间(毫秒)
			} `json:"events"`
			More      bool  `json:"more"`      // 是否更多
			LastEvent int64 `json:"lasttime"`  // 最后动态ID
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析动态列表失败: %w", err)
		}
		out := &mmpb.EventsResponse{More: resp.More, LastEventId: resp.LastEvent}
		for _, e := range resp.Events {
			out.Events = append(out.Events, &mmpb.UserEvent{
				EventId: e.ID, UserId: e.UserID, Type: int32(e.Type),
				JsonContent: e.JSON, EventTime: e.ShowTime,
			})
		}
		return out, nil
	},
}

// Record 是获取用户播放记录的接口声明。
var Record = &engine.Endpoint[*mmpb.RecordRequest, *mmpb.RecordResponse]{
	Meta: engine.Meta{
		Path: "/weapi/v1/play/record", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.RecordRequest]{
		Key: func(req *mmpb.RecordRequest) string {
			return fmt.Sprintf("user:record:%d:%d", req.GetUserId(), req.GetType())
		},
		TTL: 10 * time.Minute,
	},
	NewResp: func() *mmpb.RecordResponse { return &mmpb.RecordResponse{} },
	MapRequest: func(req *mmpb.RecordRequest) (map[string]any, error) {
		return map[string]any{
			"uid": fmt.Sprintf("%d", req.GetUserId()),
			"type": req.GetType(),
		}, nil
	},
	MapResponse: parsePlayRecord,
}

// Level 是获取用户等级信息的接口声明。
var Level = &engine.Endpoint[*mmpb.LevelRequest, *mmpb.LevelResponse]{
	Meta: engine.Meta{
		Path: "/weapi/user/level", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.LevelRequest]{
		Key: func(req *mmpb.LevelRequest) string { return fmt.Sprintf("user:level:%d", req.GetUserId()) },
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.LevelResponse { return &mmpb.LevelResponse{} },
	MapRequest: func(req *mmpb.LevelRequest) (map[string]any, error) {
		return map[string]any{"userId": fmt.Sprintf("%d", req.GetUserId())}, nil
	},
	MapResponse: func(_ *mmpb.LevelRequest, raw json.RawMessage) (*mmpb.LevelResponse, error) {
		var resp struct {
			Data struct {
				Level int   `json:"level"` // 当前等级
				Now   int64 `json:"now"`   // 当前经验
				Next  int64 `json:"next"`  // 升级所需
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析用户等级失败: %w", err)
		}
		return &mmpb.LevelResponse{
			Level: &mmpb.UserLevel{Level: int32(resp.Data.Level), Now: resp.Data.Now, Next: resp.Data.Next},
		}, nil
	},
}
