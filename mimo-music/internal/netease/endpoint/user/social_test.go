// Package user 的社交与动态接口 MapResponse 测试。
package user

import (
	"encoding/json"
	"testing"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/stretchr/testify/require"
)

// TestFollows_MapResponse 关注列表解析。
func TestFollows_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"follow":[{"userId":1,"nickname":"alice","avatarUrl":"http://a.jpg","followeds":50,"follows":10}]}`

	resp, err := Follows.MapResponse(&mmpb.FollowsRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Follows, 1)
	require.Equal(t, "alice", resp.Follows[0].Nickname)
	require.Equal(t, int64(50), resp.Follows[0].Followeds)
}

// TestFolloweds_MapResponse 粉丝列表解析。
func TestFolloweds_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"followeds":[{"userId":2,"nickname":"bob","avatarUrl":"http://b.jpg","followeds":5,"follows":20}],"more":false}`

	resp, err := Followeds.MapResponse(&mmpb.FollowedsRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Followeds, 1)
	require.Equal(t, "bob", resp.Followeds[0].Nickname)
}

// TestEvents_MapResponse 动态列表解析。
func TestEvents_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"events":[{"id":100,"userId":1,"type":5,"json":"{\"song\":\"test\"}","showTime":1700000000000}],"more":true,"lasttime":100}`

	resp, err := Events.MapResponse(&mmpb.EventsRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Events, 1)
	require.Equal(t, int64(100), resp.Events[0].EventId)
	require.True(t, resp.More)
	require.Equal(t, int64(100), resp.LastEventId)
}

// TestRecord_MapResponse 播放记录解析。
func TestRecord_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"weekData":[{"playCount":10,"song":{"id":1,"name":"歌A"}}],"allData":[]}`

	resp, err := Record.MapResponse(&mmpb.RecordRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Records, 1)
	require.Equal(t, int32(10), resp.Records[0].PlayCount)
	require.Equal(t, "歌A", resp.Records[0].Song.Name)
}

// TestLevel_MapResponse 等级信息解析。
func TestLevel_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"data":{"level":8,"now":5000,"next":8000}}`

	resp, err := Level.MapResponse(&mmpb.LevelRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, int32(8), resp.Level.Level)
	require.Equal(t, int64(5000), resp.Level.Now)
	require.Equal(t, int64(8000), resp.Level.Next)
}

// TestSimilarUsers_MapResponse 听歌的人解析。
func TestSimilarUsers_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"userprofiles":[{"userId":1,"nickname":"听者A","avatarUrl":"http://a.jpg"}]}`
	resp, err := SimilarUsers.MapResponse(&mmpb.SimilarUsersRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Users, 1)
	require.Equal(t, "听者A", resp.Users[0].Nickname)
	require.Equal(t, "http://a.jpg", resp.Users[0].AvatarUrl)
}

// TestSimilarUsers_MapRequest limit 默认值。
func TestSimilarUsers_MapRequest(t *testing.T) {
	t.Parallel()

	params, err := SimilarUsers.MapRequest(&mmpb.SimilarUsersRequest{SongId: 347230})
	require.NoError(t, err)
	require.Equal(t, int32(50), params["limit"])
	require.Equal(t, int64(347230), params["songid"])
}
