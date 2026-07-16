// Package artist 的 endpoint MapResponse 测试。
package artist

import (
	"encoding/json"
	"testing"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/stretchr/testify/require"
)

// TestGetArtist_MapResponse 歌手详情解析。
func TestGetArtist_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"artist":{"id":100,"name":"Beyond","img1v1Url":"http://b.jpg","briefDesc":"香港摇滚乐队"},"hotSongs":[{"id":1,"name":"海阔天空","ar":[{"id":100,"name":"Beyond"}],"al":{"id":10,"name":"乐与怒"},"dt":326000,"fee":0}]}`

	resp, err := GetArtist.MapResponse(&mmpb.GetArtistRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, int64(100), resp.Artist.Id)
	require.Equal(t, "Beyond", resp.Artist.Name)
	require.Len(t, resp.HotSongs, 1)
	require.Equal(t, "海阔天空", resp.HotSongs[0].Name)
}
