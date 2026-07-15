// Package album 的 endpoint MapResponse 测试。
package album

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestGetAlbum_MapResponse 专辑详情解析。
func TestGetAlbum_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"album":{"id":10,"name":"乐与怒","picUrl":"http://c.jpg","publishTime":"1993-06-08","artists":[{"id":20,"name":"Beyond"}]},"songs":[{"id":1,"name":"海阔天空","ar":[{"id":20,"name":"Beyond"}],"al":{"id":10,"name":"乐与怒"},"dt":326000,"fee":0}]}`

	resp, err := GetAlbum.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, "乐与怒", resp.Album.Name)
	require.Equal(t, "Beyond", resp.Album.Artist.Name)
	require.Len(t, resp.Songs, 1)
	require.Equal(t, "海阔天空", resp.Songs[0].Name)
}
