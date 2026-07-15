// Package user 的 endpoint MapResponse 测试。
package user

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestDetail_MapResponse 用户详情解析。
func TestDetail_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"level":8,"profile":{"userId":123,"nickname":"alice","avatarUrl":"http://a.jpg","gender":1,"signature":"hi","followeds":100,"follows":50}}`

	resp, err := Detail.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, int64(123), resp.User.UserId)
	require.Equal(t, "alice", resp.User.Nickname)
	require.Equal(t, int32(8), resp.User.Level)
	require.Equal(t, int64(100), resp.User.Followeds)
}

// TestSubCount_MapResponse 用户统计解析。
func TestSubCount_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"playlistCount":5,"djRadiosCount":2,"mvCount":10,"artistCount":3,"newAlbumsCount":1}`

	resp, err := SubCount.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, int32(5), resp.Count.PlaylistCount)
	require.Equal(t, int32(10), resp.Count.MvCount)
}

// TestUserPlaylist_MapResponse 用户歌单列表解析。
func TestUserPlaylist_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"more":false,"playlist":[{"id":1,"name":"我喜欢的","coverImgUrl":"http://c.jpg","playCount":0,"trackCount":30,"creator":{"userId":123}}]}`

	resp, err := UserPlaylist.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Playlists, 1)
	require.Equal(t, "我喜欢的", resp.Playlists[0].Name)
	require.Equal(t, int32(1), resp.Total)
}
