// Package playlist 的写操作接口声明。
//
// 7 个写操作（Subscribe/Create/Delete/UpdateName/UpdateDesc/UpdateTags/UpdateTracks）。
// 歌单排序（UpdateOrder）和歌曲排序（UpdateSongOrder）的网易云端点不稳定，推迟验证。
// 全部 CachePolicy=nil（写操作不缓存）、AuthLoggedIn（需登录态）。
// cookie 从请求的 cookie 字段传入（不走 session 池选取），
// 所以 service 直接调 engine.RawDoWithCookieAndInput 而非 Execute。
//
// endpoint 只含 Meta + MapRequest，不含 MapResponse（service 内联解析简单响应）。
package playlist

import (
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// --- 写操作响应解析（供 service 层调用） ---

// ParseSubscribed 解析收藏操作响应（返回是否已收藏）。
func ParseSubscribed(raw json.RawMessage) *mmpb.SubscribeResponse {
	var resp struct {
		Subscribed bool `json:"subscribed"` // 操作后是否已收藏
	}
	_ = json.Unmarshal(raw, &resp)
	return &mmpb.SubscribeResponse{Subscribed: resp.Subscribed}
}

// ParseCreateResponse 解析新建歌单响应（返回歌单 ID）。
func ParseCreateResponse(raw json.RawMessage) *mmpb.CreateResponse {
	var resp struct {
		ID int64 `json:"id"` // 新建歌单ID（部分版本在 playlist.id）
		Playlist struct {
			ID int64 `json:"id"` // 歌单ID
		} `json:"playlist"` // 歌单信息
	}
	_ = json.Unmarshal(raw, &resp)
	id := resp.ID
	if id == 0 {
		id = resp.Playlist.ID
	}
	return &mmpb.CreateResponse{PlaylistId: id}
}

// ParseUpdateTracksResponse 解析添加/删除歌曲响应。
func ParseUpdateTracksResponse(raw json.RawMessage) *mmpb.UpdateTracksResponse {
	var resp struct {
		Body []struct {
			TrackID int64 `json:"trackId"` // 歌曲ID
		} `json:"body"` // 成功操作的歌曲
	}
	_ = json.Unmarshal(raw, &resp)
	out := &mmpb.UpdateTracksResponse{}
	for _, b := range resp.Body {
		out.BodyTrackIds = append(out.BodyTrackIds, b.TrackID)
	}
	return out
}

// writeMeta 构造 weapi POST + AuthLoggedIn 的 Meta（歌单写操作统一参数）。
func writeMeta(path string) engine.Meta {
	return engine.Meta{Path: path, Method: "POST", Crypto: engine.CryptoWeAPI, Auth: session.AuthLoggedIn}
}

// 写操作 Meta 集合。
var (
	SubscribeMeta   = writeMeta("/weapi/playlist/subscribe")
	CreateMeta      = writeMeta("/weapi/playlist/create")
	DeleteMeta      = writeMeta("/weapi/playlist/delete")
	UpdateNameMeta  = writeMeta("/weapi/playlist/update/name")
	UpdateDescMeta  = writeMeta("/weapi/playlist/update/description")
	UpdateTagsMeta  = writeMeta("/weapi/playlist/update/tags")
	UpdateTracksMeta = writeMeta("/weapi/playlist/manipulate/tracks")
)

// SubscribeRequest 构造收藏/取消收藏入参。
func SubscribeRequest(req *mmpb.SubscribeRequest) map[string]any {
	return map[string]any{"id": fmt.Sprintf("%d", req.GetPlaylistId())}
}

// CreateRequest 构造新建歌单入参。
func CreateRequest(req *mmpb.CreateRequest) map[string]any {
	return map[string]any{
		"name": req.GetName(),
		"privacy": boolToInt(req.GetPrivacy()),
	}
}

// DeleteRequest 构造删除歌单入参。
func DeleteRequest(req *mmpb.DeleteRequest) map[string]any {
	return map[string]any{"ids": fmt.Sprintf("[%d]", req.GetPlaylistId())}
}

// UpdateNameRequest 构造更新歌单名入参。
func UpdateNameRequest(req *mmpb.UpdateNameRequest) map[string]any {
	return map[string]any{"id": fmt.Sprintf("%d", req.GetPlaylistId()), "name": req.GetName()}
}

// UpdateDescRequest 构造更新描述入参。
func UpdateDescRequest(req *mmpb.UpdateDescRequest) map[string]any {
	return map[string]any{"id": fmt.Sprintf("%d", req.GetPlaylistId()), "desc": req.GetDesc()}
}

// UpdateTagsRequest 构造更新标签入参。
func UpdateTagsRequest(req *mmpb.UpdateTagsRequest) map[string]any {
	return map[string]any{"id": fmt.Sprintf("%d", req.GetPlaylistId()), "tags": req.GetTags()}
}

// UpdateTracksRequest 构造添加/删除歌曲入参。
// op=add: trackIds 用逗号分隔；op=del: trackIds 用逗号分隔。
func UpdateTracksRequest(req *mmpb.UpdateTracksRequest) map[string]any {
	op := "add"
	if req.GetOp() == mmpb.TracksOp_TRACKS_OP_DEL {
		op = "del"
	}
	ids := make([]string, 0, len(req.GetTrackIds()))
	for _, id := range req.GetTrackIds() {
		ids = append(ids, fmt.Sprintf("%d", id))
	}
	return map[string]any{
		"op": op,
		"pid": fmt.Sprintf("%d", req.GetPlaylistId()),
		"tracks": joinComma(ids),
	}
}

// joinComma 把字符串切片用逗号连接。
func joinComma(ss []string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += ","
		}
		result += s
	}
	return result
}

// boolToInt 把 bool 转成 0/1（网易云用整数表示布尔）。
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
