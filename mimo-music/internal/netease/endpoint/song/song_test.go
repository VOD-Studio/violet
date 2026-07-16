// Package song 的 endpoint MapRequest/MapResponse 测试。
package song

import (
	"encoding/json"
	"testing"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/stretchr/testify/require"
)

// TestDetail_MapResponse 歌曲详情解析。
func TestDetail_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"songs":[{"id":347230,"name":"海阔天空","ar":[{"id":111,"name":"Beyond"}],"al":{"id":222,"name":"乐与怒","picUrl":"http://c.jpg"},"dt":326000,"fee":0}]}`

	resp, err := Detail.MapResponse(&mmpb.GetSongDetailRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, int64(347230), resp.Song.Id)
	require.Equal(t, "海阔天空", resp.Song.Name)
	require.Len(t, resp.Song.Artists, 1)
	require.Equal(t, "Beyond", resp.Song.Artists[0].Name)
	require.Equal(t, "乐与怒", resp.Song.Album.Name)
	require.Equal(t, int64(326000), resp.Song.DurationMs)
}

// TestDetail_MapResponse_Empty 歌曲不存在报错。
func TestDetail_MapResponse_Empty(t *testing.T) {
	t.Parallel()

	_, err := Detail.MapResponse(&mmpb.GetSongDetailRequest{}, json.RawMessage(`{"code":200,"songs":[]}`))
	require.Error(t, err)
}

// TestURL_MapResponse 播放URL解析。
func TestURL_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"data":[{"id":347230,"url":"http://m.mp3","br":320000,"size":5000000,"type":"mp3"}]}`

	resp, err := URL.MapResponse(&mmpb.GetSongURLRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, "http://m.mp3", resp.Url.Url)
	require.Equal(t, int64(320000), resp.Url.Bitrate)
	require.Equal(t, "mp3", resp.Url.Format)
}

// TestURL_MapResponse_VIP VIP歌曲URL为空。
func TestURL_MapResponse_VIP(t *testing.T) {
	t.Parallel()

	_, err := URL.MapResponse(&mmpb.GetSongURLRequest{}, json.RawMessage(`{"code":200,"data":[]}`))
	require.Error(t, err)
}

// TestLyric_MapResponse 歌词解析。
func TestLyric_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"lrc":{"version":1,"lyric":"[00:01]词"},"tlyric":{"version":1,"lyric":"[00:01]Translation"},"romalrc":{"version":1,"lyric":"[00:01]ci"}}`

	resp, err := Lyric.MapResponse(&mmpb.GetLyricRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Contains(t, resp.Lyric.Lrc, "词")
	require.Contains(t, resp.Lyric.Translated, "Translation")
	require.Contains(t, resp.Lyric.Romanized, "ci")
}

// TestURL_MapRequest level enum 转网易云字符串。
func TestURL_MapRequest(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		level mmpb.SongLevel
		want  string
	}{
		{"标准", mmpb.SongLevel_SONG_LEVEL_STANDARD, "standard"},
		{"极高", mmpb.SongLevel_SONG_LEVEL_EXHIGH, "exhigh"},
		{"无损", mmpb.SongLevel_SONG_LEVEL_LOSSLESS, "lossless"},
		{"HiRes", mmpb.SongLevel_SONG_LEVEL_HRES, "hires"},
		{"默认回退", mmpb.SongLevel_SONG_LEVEL_UNSPECIFIED, "standard"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			params, err := URL.MapRequest(&mmpb.GetSongURLRequest{SongId: 1, Level: tt.level})
			require.NoError(t, err)
			require.Equal(t, tt.want, params["level"])
		})
	}
}

// --- 写类接口（cookie override 路径） ---

// TestLike_MapRequest 喜欢音乐入参构造。
func TestLike_MapRequest(t *testing.T) {
	t.Parallel()

	t.Run("喜欢", func(t *testing.T) {
		t.Parallel()
		params, err := Like.MapRequest(&mmpb.LikeRequest{SongId: 347230, Like: true})
		require.NoError(t, err)
		require.Equal(t, "itembased", params["alg"])
		require.Equal(t, int64(347230), params["trackId"])
		require.Equal(t, true, params["like"])
		require.Equal(t, "3", params["time"])
	})
	t.Run("取消", func(t *testing.T) {
		t.Parallel()
		params, _ := Like.MapRequest(&mmpb.LikeRequest{SongId: 1, Like: false})
		require.Equal(t, false, params["like"])
	})
}

// TestLike_MapResponse 回填操作后状态。
func TestLike_MapResponse(t *testing.T) {
	t.Parallel()

	resp, err := Like.MapResponse(&mmpb.LikeRequest{Like: true}, json.RawMessage(`{"code":200}`))
	require.NoError(t, err)
	require.True(t, resp.Liked)
}

// TestLike_CacheNil 写操作不缓存。
func TestLike_CacheNil(t *testing.T) {
	t.Parallel()
	require.Nil(t, Like.Cache)
}

// TestTrash_MapRequest 垃圾桶入参。
func TestTrash_MapRequest(t *testing.T) {
	t.Parallel()

	params, err := Trash.MapRequest(&mmpb.TrashRequest{SongId: 347230})
	require.NoError(t, err)
	require.Equal(t, int64(347230), params["songId"])
	require.Equal(t, "RT", params["alg"])
	require.Equal(t, 25, params["time"])
	require.Nil(t, Trash.Cache)
}

// TestDisallowRecommend_MapRequest 不感兴趣入参含固定常量。
func TestDisallowRecommend_MapRequest(t *testing.T) {
	t.Parallel()

	params, err := DisallowRecommend.MapRequest(&mmpb.DisallowRecommendRequest{SongId: 347230})
	require.NoError(t, err)
	require.Equal(t, int64(347230), params["resId"])
	require.Equal(t, 4, params["resType"])
	require.Equal(t, 1, params["sceneType"])
	require.Nil(t, DisallowRecommend.Cache)
}

// --- 读类接口（走缓存） ---

// TestCheckAvailable_MapRequest 可用检查入参（ids 是 stringified JSON 数组）。
func TestCheckAvailable_MapRequest(t *testing.T) {
	t.Parallel()

	params, err := CheckAvailable.MapRequest(&mmpb.CheckAvailableRequest{SongId: 347230})
	require.NoError(t, err)
	require.Equal(t, "[347230]", params["ids"])
	require.Equal(t, 999000, params["br"])
}

// TestCheckAvailable_MapResponse 可用性判定（code==200 且 data[0].code==200）。
func TestCheckAvailable_MapResponse(t *testing.T) {
	t.Parallel()

	t.Run("可用", func(t *testing.T) {
		t.Parallel()
		resp, err := CheckAvailable.MapResponse(&mmpb.CheckAvailableRequest{}, json.RawMessage(`{"code":200,"data":[{"code":200}]}`))
		require.NoError(t, err)
		require.True(t, resp.Available)
		require.Equal(t, "ok", resp.Message)
	})
	t.Run("无版权", func(t *testing.T) {
		t.Parallel()
		resp, err := CheckAvailable.MapResponse(&mmpb.CheckAvailableRequest{}, json.RawMessage(`{"code":200,"data":[{"code":-110}]}`))
		require.NoError(t, err)
		require.False(t, resp.Available)
	})
}

// TestLikedList_MapResponse 喜欢列表解析。
func TestLikedList_MapResponse(t *testing.T) {
	t.Parallel()

	resp, err := LikedList.MapResponse(&mmpb.LikedListRequest{}, json.RawMessage(`{"code":200,"ids":[347230,347231,347232]}`))
	require.NoError(t, err)
	require.Equal(t, []int64{347230, 347231, 347232}, resp.SongIds)
}

// TestQualityDetail_MapResponse 音质详情解析。
// 真实结构：data 下按音质等级动态 key（h/m/l/sq 等），每个含 br。
func TestQualityDetail_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"data":{"songId":347230,"h":{"br":320001,"size":100},"m":{"br":192001},"l":{"br":128001},"sq":{"br":797831},"hr":null}}`
	resp, err := QualityDetail.MapResponse(&mmpb.QualityDetailRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	// 应解析出 h/m/l/sq 4 个音质（songId 和 hr=null 跳过）。
	require.Len(t, resp.Qualities, 4)
	// 找到 h 音质验证比特率。
	var hBitrate int64
	for _, q := range resp.Qualities {
		if q.Level == "h" {
			hBitrate = q.Bitrate
		}
	}
	require.Equal(t, int64(320001), hBitrate)
}

// TestLikeCount_MapResponse 红心数量解析。
func TestLikeCount_MapResponse(t *testing.T) {
	t.Parallel()

	resp, err := LikeCount.MapResponse(&mmpb.LikeCountRequest{}, json.RawMessage(`{"code":200,"data":{"count":12345}}`))
	require.NoError(t, err)
	require.Equal(t, int64(12345), resp.Count)
}

// TestIsLike_MapRequest trackIds 是 stringified JSON 数组。
func TestIsLike_MapRequest(t *testing.T) {
	t.Parallel()

	params, err := IsLike.MapRequest(&mmpb.IsLikeRequest{SongId: 347230})
	require.NoError(t, err)
	require.Equal(t, "[347230]", params["trackIds"])
}

// TestIsLike_MapResponse 按请求 songId 匹配 like 状态。
func TestIsLike_MapResponse(t *testing.T) {
	t.Parallel()

	t.Run("已喜爱", func(t *testing.T) {
		t.Parallel()
		resp, err := IsLike.MapResponse(&mmpb.IsLikeRequest{SongId: 347230}, json.RawMessage(`{"code":200,"songs":[{"songId":347230,"like":true}]}`))
		require.NoError(t, err)
		require.True(t, resp.Liked)
	})
	t.Run("未命中回退false", func(t *testing.T) {
		t.Parallel()
		resp, err := IsLike.MapResponse(&mmpb.IsLikeRequest{SongId: 999}, json.RawMessage(`{"code":200,"songs":[{"songId":347230,"like":true}]}`))
		require.NoError(t, err)
		require.False(t, resp.Liked)
	})
}

// TestIsLike_CacheNil 结果按调用方而异，不缓存（避免跨用户缓存污染）。
func TestIsLike_CacheNil(t *testing.T) {
	t.Parallel()
	require.Nil(t, IsLike.Cache)
}

// TestDynamicCover_MapResponse 动态封面解析。
func TestDynamicCover_MapResponse(t *testing.T) {
	t.Parallel()

	resp, err := DynamicCover.MapResponse(&mmpb.DynamicCoverRequest{}, json.RawMessage(`{"code":200,"data":{"url":"http://cover.gif"}}`))
	require.NoError(t, err)
	require.Equal(t, "http://cover.gif", resp.Url)
}

// TestChorusTime_MapRequest ids 是 stringified JSON 数组。
func TestChorusTime_MapRequest(t *testing.T) {
	t.Parallel()

	params, err := ChorusTime.MapRequest(&mmpb.ChorusTimeRequest{SongId: 347230})
	require.NoError(t, err)
	require.Equal(t, "[347230]", params["ids"])
}

// TestChorusTime_MapResponse 副歌时间段解析。
func TestChorusTime_MapResponse(t *testing.T) {
	t.Parallel()

	resp, err := ChorusTime.MapResponse(&mmpb.ChorusTimeRequest{}, json.RawMessage(`{"code":200,"data":[{"start":30000,"end":45000}]}`))
	require.NoError(t, err)
	require.Len(t, resp.Segments, 1)
	require.Equal(t, int64(30000), resp.Segments[0].StartMs)
	require.Equal(t, int64(45000), resp.Segments[0].EndMs)
}

// TestCreatorInfo_MapResponse 创作者信息解析。
func TestCreatorInfo_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"data":{"creators":[{"id":1,"name":"黄家驹","role":"作词"},{"id":2,"name":"黄家强","role":"作曲"}]}}`
	resp, err := CreatorInfo.MapResponse(&mmpb.CreatorInfoRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Creators, 2)
	require.Equal(t, "黄家驹", resp.Creators[0].Name)
	require.Equal(t, "作词", resp.Creators[0].Role)
}

// TestWordLyric_MapRequest 逐字歌词入参（含 yv/ytv/yrv 等 0 标记）。
func TestWordLyric_MapRequest(t *testing.T) {
	t.Parallel()

	params, err := WordLyricEP.MapRequest(&mmpb.GetWordLyricRequest{SongId: 347230})
	require.NoError(t, err)
	require.Equal(t, int64(347230), params["id"])
	require.Equal(t, false, params["cp"])
	require.Equal(t, 0, params["yv"])
	require.Equal(t, 0, params["ytv"])
}

// TestWordLyric_MapResponse 逐字歌词 yrc blob 解析成结构化 WordLyric。
func TestWordLyric_MapResponse(t *testing.T) {
	t.Parallel()

	// yrc 是逐字文本 blob（字段顺序 startMs,durMs,0）。
	yrc := `[420,4440](420,1320,0)Lately(1740,570,0)I've`
	ytlrc := `[420,4440](420,1320,0)最近(1740,570,0)我`
	fixture := `{"code":200,"yrc":{"lyric":"` + escapeYrc(yrc) + `"},"ytlrc":{"lyric":"` + escapeYrc(ytlrc) + `"}}`

	resp, err := WordLyricEP.MapResponse(&mmpb.GetWordLyricRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.NotNil(t, resp.WordLyric)
	require.Len(t, resp.WordLyric.Lines, 1)
	require.Equal(t, "Lately", resp.WordLyric.Lines[0].Words[0].Content)
	// 逐字翻译也应被解析。
	require.Len(t, resp.WordLyric.TranslatedLines, 1)
	require.Equal(t, "最近", resp.WordLyric.TranslatedLines[0].Words[0].Content)
}

// escapeYrc 把 yrc blob 里的字符转义成可嵌入 JSON 字符串的形式（仅处理双引号/反斜杠）。
func escapeYrc(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '"':
			out = append(out, '\\', '"')
		case '\\':
			out = append(out, '\\', '\\')
		default:
			out = append(out, s[i])
		}
	}
	return string(out)
}

// TestSimilarSongs_MapResponse 相似音乐解析（artists/album 全名而非缩写）。
func TestSimilarSongs_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"songs":[{"id":1,"name":"相似歌","artists":[{"id":10,"name":"歌手"}],"album":{"id":20,"name":"专辑","picUrl":"http://a.jpg"},"duration":180000,"fee":0}]}`
	resp, err := SimilarSongs.MapResponse(&mmpb.SimilarSongsRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Songs, 1)
	require.Equal(t, "相似歌", resp.Songs[0].Name)
	require.Equal(t, "歌手", resp.Songs[0].Artists[0].Name)
	require.Equal(t, "专辑", resp.Songs[0].Album.Name)
	require.Equal(t, int64(180000), resp.Songs[0].DurationMs)
}

// TestSimilarSongs_MapRequest limit 默认值。
func TestSimilarSongs_MapRequest(t *testing.T) {
	t.Parallel()

	params, err := SimilarSongs.MapRequest(&mmpb.SimilarSongsRequest{SongId: 347230})
	require.NoError(t, err)
	require.Equal(t, int32(50), params["limit"])
	require.Equal(t, int64(347230), params["songid"])
}
