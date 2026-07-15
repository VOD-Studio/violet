// Package playlist 的写操作 MapRequest 测试。
//
// 写操作的入参构造（网易云古怪格式）是重点验证对象。
package playlist

import (
	"encoding/json"
	"testing"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/stretchr/testify/require"
)

// TestSubscribeRequest 收藏入参构造。
func TestSubscribeRequest(t *testing.T) {
	t.Parallel()

	params := SubscribeRequest(&mmpb.SubscribeRequest{PlaylistId: 100})
	require.Equal(t, "100", params["id"])
}

// TestCreateRequest 新建歌单入参构造。
func TestCreateRequest(t *testing.T) {
	t.Parallel()

	params := CreateRequest(&mmpb.CreateRequest{Name: "我的歌单", Privacy: true})
	require.Equal(t, "我的歌单", params["name"])
	require.Equal(t, 1, params["privacy"])
}

// TestDeleteRequest 删除入参构造。
func TestDeleteRequest(t *testing.T) {
	t.Parallel()

	params := DeleteRequest(&mmpb.DeleteRequest{PlaylistId: 200})
	require.Equal(t, "[200]", params["ids"])
}

// TestUpdateTracksRequest_Add 添加歌曲入参。
func TestUpdateTracksRequest_Add(t *testing.T) {
	t.Parallel()

	params := UpdateTracksRequest(&mmpb.UpdateTracksRequest{
		PlaylistId: 1, Op: mmpb.TracksOp_TRACKS_OP_ADD, TrackIds: []int64{10, 20, 30},
	})
	require.Equal(t, "add", params["op"])
	require.Equal(t, "1", params["pid"])
	require.Equal(t, "10,20,30", params["tracks"])
}

// TestUpdateTracksRequest_Del 删除歌曲入参。
func TestUpdateTracksRequest_Del(t *testing.T) {
	t.Parallel()

	params := UpdateTracksRequest(&mmpb.UpdateTracksRequest{
		PlaylistId: 1, Op: mmpb.TracksOp_TRACKS_OP_DEL, TrackIds: []int64{5},
	})
	require.Equal(t, "del", params["op"])
	require.Equal(t, "5", params["tracks"])
}

// TestParseSubscribed 收藏响应解析。
func TestParseSubscribed(t *testing.T) {
	t.Parallel()

	resp := ParseSubscribed(json.RawMessage(`{"subscribed":true}`))
	require.True(t, resp.Subscribed)
}

// TestParseCreateResponse 新建歌单响应解析。
func TestParseCreateResponse(t *testing.T) {
	t.Parallel()

	resp := ParseCreateResponse(json.RawMessage(`{"id":999}`))
	require.Equal(t, int64(999), resp.PlaylistId)
}

// TestParseCreateResponse_PlaylistField playlist.id 字段回退。
func TestParseCreateResponse_PlaylistField(t *testing.T) {
	t.Parallel()

	resp := ParseCreateResponse(json.RawMessage(`{"playlist":{"id":888}}`))
	require.Equal(t, int64(888), resp.PlaylistId)
}
