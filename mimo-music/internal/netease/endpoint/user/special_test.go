// Package user 的特殊接口测试。
package user

import (
	"encoding/json"
	"testing"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/stretchr/testify/require"
)

// TestDetailByName_MapResponse 昵称搜索结果解析(取第一条 userId)。
func TestDetailByName_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"result":{"userprofiles":[{"userId":32014612,"nickname":"网易云音乐"}],"userprofileCount":1},"code":200}`

	resp, err := DetailByName.MapResponse(&mmpb.DetailByNameRequest{Nickname: "网易云音乐"}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, int64(32014612), resp.UserId)
}

// TestDetailByName_MapResponse_Empty 昵称无结果时报错。
func TestDetailByName_MapResponse_Empty(t *testing.T) {
	t.Parallel()

	fixture := `{"result":{"userprofiles":[],"userprofileCount":0},"code":200}`

	_, err := DetailByName.MapResponse(&mmpb.DetailByNameRequest{Nickname: "不存在的昵称"}, json.RawMessage(fixture))
	require.Error(t, err)
}

// TestParseFollowEachOther 关注列表包含判断。
func TestParseFollowEachOther(t *testing.T) {
	t.Parallel()

	fixture := `{"follow":[{"userId":1},{"userId":2}],"code":200}`

	hit, err := ParseFollowEachOther(&mmpb.FollowEachOtherRequest{UserId: 2, TargetUserId: 99}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.True(t, hit.FollowEachOther)

	miss, err := ParseFollowEachOther(&mmpb.FollowEachOtherRequest{UserId: 3, TargetUserId: 99}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.False(t, miss.FollowEachOther)
}
