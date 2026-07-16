// Package user 的 endpoint MapResponse 测试。
package user

import (
	"encoding/json"
	"testing"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/stretchr/testify/require"
)

// TestDetail_MapResponse 用户详情解析。
func TestDetail_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"level":8,"profile":{"userId":123,"nickname":"alice","avatarUrl":"http://a.jpg","gender":1,"signature":"hi","followeds":100,"follows":50}}`

	resp, err := Detail.MapResponse(&mmpb.DetailRequest{}, json.RawMessage(fixture))
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

	resp, err := SubCount.MapResponse(&mmpb.SubCountRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, int32(5), resp.Count.PlaylistCount)
	require.Equal(t, int32(10), resp.Count.MvCount)
}

// TestUserPlaylist_MapResponse 用户歌单列表解析。
func TestUserPlaylist_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"more":false,"playlist":[{"id":1,"name":"我喜欢的","coverImgUrl":"http://c.jpg","playCount":0,"trackCount":30,"creator":{"userId":123}}]}`

	resp, err := UserPlaylist.MapResponse(&mmpb.UserPlaylistRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Playlists, 1)
	require.Equal(t, "我喜欢的", resp.Playlists[0].Name)
	require.Equal(t, int32(1), resp.Total)
}

// TestUserPlaylist_Filter 按 creator.userId 过滤创建/收藏歌单。
//
// fixture 含两个歌单：id=1 creator=123（用户自己创建），id=2 creator=999（收藏的）。
// filter 在 endpoint 的 MapResponse 里按 req.UserId == creator.userId 判断。
func TestUserPlaylist_Filter(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"more":false,"playlist":[
		{"id":1,"name":"我创建的","creator":{"userId":123}},
		{"id":2,"name":"我收藏的","creator":{"userId":999}}
	]}`

	t.Run("ALL返回全部", func(t *testing.T) {
		t.Parallel()
		resp, err := UserPlaylist.MapResponse(
			&mmpb.UserPlaylistRequest{UserId: 123, Filter: mmpb.PlaylistFilter_PLAYLIST_FILTER_ALL},
			json.RawMessage(fixture),
		)
		require.NoError(t, err)
		require.Len(t, resp.Playlists, 2)
	})

	t.Run("CREATED只返回创建的", func(t *testing.T) {
		t.Parallel()
		resp, err := UserPlaylist.MapResponse(
			&mmpb.UserPlaylistRequest{UserId: 123, Filter: mmpb.PlaylistFilter_PLAYLIST_FILTER_CREATED},
			json.RawMessage(fixture),
		)
		require.NoError(t, err)
		require.Len(t, resp.Playlists, 1)
		require.Equal(t, int64(1), resp.Playlists[0].Id)
		require.Equal(t, "我创建的", resp.Playlists[0].Name)
	})

	t.Run("SUBSCRIBED只返回收藏的", func(t *testing.T) {
		t.Parallel()
		resp, err := UserPlaylist.MapResponse(
			&mmpb.UserPlaylistRequest{UserId: 123, Filter: mmpb.PlaylistFilter_PLAYLIST_FILTER_SUBSCRIBED},
			json.RawMessage(fixture),
		)
		require.NoError(t, err)
		require.Len(t, resp.Playlists, 1)
		require.Equal(t, int64(2), resp.Playlists[0].Id)
		require.Equal(t, "我收藏的", resp.Playlists[0].Name)
	})

	t.Run("ownerUserID为0时不过滤返回全部", func(t *testing.T) {
		t.Parallel()
		// UserId=0 时无法判断创建/收藏，CREATED filter 不生效，返回全部。
		resp, err := UserPlaylist.MapResponse(
			&mmpb.UserPlaylistRequest{UserId: 0, Filter: mmpb.PlaylistFilter_PLAYLIST_FILTER_CREATED},
			json.RawMessage(fixture),
		)
		require.NoError(t, err)
		require.Len(t, resp.Playlists, 2, "ownerUserID=0 时 filter 不应生效")
	})
}
