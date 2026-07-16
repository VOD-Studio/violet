// Package song 的可用性检查接口声明。
package song

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// CheckAvailable 是检查音乐是否可用的接口声明。
//
// 复用播放 URL 端点（/weapi/song/enhance/player/url）作可用性探测：code==200 且
// data[0].code==200 表示可播放。br 默认 999000（最高探测）。TTL 1h（版权状态偶有变化）。
var CheckAvailable = &engine.Endpoint[*mmpb.CheckAvailableRequest, *mmpb.CheckAvailableResponse]{
	Meta: engine.Meta{
		Path: "/weapi/song/enhance/player/url", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.CheckAvailableRequest]{
		Key: func(req *mmpb.CheckAvailableRequest) string {
			return fmt.Sprintf("song:available:%d", req.GetSongId())
		},
		TTL: time.Hour,
	},
	NewResp: func() *mmpb.CheckAvailableResponse { return &mmpb.CheckAvailableResponse{} },
	MapRequest: func(req *mmpb.CheckAvailableRequest) (map[string]any, error) {
		return map[string]any{
			"ids": fmt.Sprintf("[%d]", req.GetSongId()),
			"br":  999000,
		}, nil
	},
	MapResponse: func(req *mmpb.CheckAvailableRequest, raw json.RawMessage) (*mmpb.CheckAvailableResponse, error) {
		var resp struct {
			Code int `json:"code"`
			Data []struct {
				Code int `json:"code"` // 单曲业务码，200 表示有版权
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.CheckAvailableResponse{}, fmt.Errorf("解析可用性响应失败: %w", err)
		}
		available := resp.Code == 200 && len(resp.Data) > 0 && resp.Data[0].Code == 200
		msg := "ok"
		if !available {
			msg = "亲爱的,暂无版权"
		}
		return &mmpb.CheckAvailableResponse{Available: available, Message: msg}, nil
	},
}
