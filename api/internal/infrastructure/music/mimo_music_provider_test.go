package music

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainmusic "blog-api/internal/domain/music"
	"blog-api/internal/domain/shared"
)

// ============================================================
// ParseEmbedURL（纯逻辑，不依赖服务）
// ============================================================

func TestParseEmbedURL_NeteaseSong(t *testing.T) {
	p := NewKiteProvider("http://localhost:3721")
	info, err := p.ParseEmbedURL("https://music.163.com/song/123456")
	require.NoError(t, err)
	assert.Equal(t, "netease", info.Platform)
	assert.Equal(t, "123456", info.SongID)
	assert.Contains(t, info.EmbedURL, "id=123456")
}

func TestParseEmbedURL_UnsupportedURL(t *testing.T) {
	p := NewKiteProvider("http://localhost:3721")
	_, err := p.ParseEmbedURL("https://y.qq.com/n/ryqq/songDetail/abc")
	require.ErrorIs(t, err, domainmusic.ErrUnsupportedMusicURL)
}

// ============================================================
// stub 联网方法：返回「服务未启用」
// ============================================================

// assertServiceDisabled 断言 stub 方法返回 Internal 域错误。
func assertServiceDisabled(t *testing.T, err error) {
	t.Helper()
	var de *shared.DomainError
	require.ErrorAs(t, err, &de)
	assert.Equal(t, shared.CodeInternal, de.Code)
}

func TestSearch_StubDisabled(t *testing.T) {
	p := NewKiteProvider("http://localhost:3721")
	songs, err := p.Search("周杰伦", 5)
	assert.Empty(t, songs)
	assertServiceDisabled(t, err)
}

func TestFetchLyrics_StubDisabled(t *testing.T) {
	p := NewKiteProvider("http://localhost:3721")
	lrc, err := p.FetchLyrics("netease", "123")
	assert.Empty(t, lrc)
	assertServiceDisabled(t, err)
}

func TestFetchSongDetail_StubDisabled(t *testing.T) {
	p := NewKiteProvider("http://localhost:3721")
	song, err := p.FetchSongDetail("netease", "456")
	assert.Nil(t, song)
	assertServiceDisabled(t, err)
}

func TestFetchSongMeta_StubDisabled(t *testing.T) {
	p := NewKiteProvider("http://localhost:3721")
	meta, err := p.FetchSongMeta("netease", "789")
	assert.Nil(t, meta)
	assertServiceDisabled(t, err)
}

func TestFetchPlaylist_StubDisabled(t *testing.T) {
	p := NewKiteProvider("http://localhost:3721")
	// 合法网易云歌单链接：URL 校验通过，但 stub 模式下服务未启用
	meta, err := p.FetchPlaylist("https://music.163.com/playlist/100")
	assert.Nil(t, meta)
	assertServiceDisabled(t, err)
}

func TestFetchPlaylist_UnsupportedURL(t *testing.T) {
	p := NewKiteProvider("http://localhost:3721")
	// 非法链接：URL 校验优先于 stub 错误，保持原有报错语义
	_, err := p.FetchPlaylist("https://example.com/random")
	require.ErrorIs(t, err, domainmusic.ErrUnsupportedMusicURL)
}

// ============================================================
// URL 解析
// ============================================================

func TestParseNeteaseSongID(t *testing.T) {
	cases := []struct {
		url  string
		want string
	}{
		{"https://music.163.com/song/123456", "123456"},
		{"https://music.163.com/#/song?id=789", "789"},
		{"https://music.163.com/album/999?id=123", "123"},
		{"https://y.qq.com/song/abc", ""},
		{"", ""},
	}
	for _, c := range cases {
		assert.Equal(t, c.want, parseNeteaseSongID(c.url), "url=%q", c.url)
	}
}

func TestParseNeteasePlaylistID(t *testing.T) {
	cases := []struct {
		url  string
		want string
	}{
		{"https://music.163.com/playlist/100", "100"},
		{"https://music.163.com/#/playlist?id=200", "200"},
		{"https://music.163.com/song/123", ""}, // 单曲链接不是歌单
		{"https://y.qq.com/playlist/abc", ""},
		{"", ""},
	}
	for _, c := range cases {
		assert.Equal(t, c.want, parseNeteasePlaylistID(c.url), "url=%q", c.url)
	}
}
