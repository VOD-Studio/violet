// Package artist 的收藏写操作接口声明。
package artist

import (
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// SubscribeMeta 是收藏/取消收藏歌手的执行元数据。
var SubscribeMeta = engine.Meta{
	Path: "/weapi/artist/sub", Method: "POST",
	Crypto: engine.CryptoWeAPI, Auth: session.AuthLoggedIn,
}

// SubscribeRequest 构造收藏歌手入参。
func SubscribeRequest(req *mmpb.ArtistSubscribeRequest) map[string]any {
	return map[string]any{
		"artistId": fmt.Sprintf("%d", req.GetArtistId()),
		"artistIds": fmt.Sprintf("[%d]", req.GetArtistId()),
	}
}

// ParseSubscribeResponse 解析收藏操作响应。
func ParseSubscribeResponse(raw json.RawMessage) *mmpb.ArtistSubscribeResponse {
	var resp struct {
		Sub bool `json:"sub"` // 操作后是否已收藏
	}
	_ = json.Unmarshal(raw, &resp)
	return &mmpb.ArtistSubscribeResponse{Subscribed: resp.Sub}
}
