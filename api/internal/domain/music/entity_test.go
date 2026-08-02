package music

import (
	"testing"

	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
)

func newID(t *testing.T) shared.ID {
	t.Helper()
	return shared.NewID()
}

func TestNewPlaylist_ConstructsAndAccessors(t *testing.T) {
	id := newID(t)
	p, err := NewPlaylist(id, "我的歌单", "netease", "pl-123")
	assert.NoError(t, err)
	assert.NotNil(t, p)

	assert.Equal(t, id, p.ID())
	assert.Equal(t, "我的歌单", p.Title())
	assert.Equal(t, "netease", p.Platform())
	assert.Equal(t, "pl-123", p.PlaylistID())

	// 新建歌单默认字段
	assert.Empty(t, p.Cover(), "新建歌单 cover 应为空")
	assert.Empty(t, p.Creator(), "新建歌单 creator 应为空")
	assert.False(t, p.IsActive(), "新建歌单默认非活跃")
	assert.Equal(t, 0, p.SongCount(), "新建歌单歌曲数为 0")
	assert.Equal(t, []Song{}, p.Songs(), "新建歌单 songs 应为空切片而非 nil")
}

func TestNewPlaylist_RejectsEmptyTitle(t *testing.T) {
	_, err := NewPlaylist(newID(t), "", "netease", "pl-1")
	assert.Error(t, err, "空标题必须拒绝")

	// 空白标题（仅空格）目前按 =="" 判断，不拒绝；记录该行为
	p2, err2 := NewPlaylist(newID(t), "  ", "netease", "pl-2")
	assert.NoError(t, err2)
	assert.Equal(t, "  ", p2.Title())
}

func TestPlaylist_SetActive(t *testing.T) {
	p, _ := NewPlaylist(newID(t), "标题", "netease", "pl-1")
	assert.False(t, p.IsActive())

	p.SetActive(true)
	assert.True(t, p.IsActive())

	p.SetActive(false)
	assert.False(t, p.IsActive())
}

func TestPlaylist_SetSongs_UpdatesListAndCount(t *testing.T) {
	p, _ := NewPlaylist(newID(t), "标题", "netease", "pl-1")
	songs := []Song{
		{Name: "晴天", Artist: "周杰伦", URL: "https://example.com/a", Cover: "https://example.com/a.jpg"},
		{Name: "稻香", Artist: "周杰伦", URL: "https://example.com/b"},
	}

	p.SetSongs(songs)

	assert.Equal(t, songs, p.Songs())
	assert.Equal(t, 2, p.SongCount(), "songCount 应同步更新为 len(songs)")
}

func TestPlaylist_SetSongs_NilDefendsToEmpty(t *testing.T) {
	p, _ := NewPlaylist(newID(t), "标题", "netease", "pl-1")

	p.SetSongs(nil)

	assert.Equal(t, []Song{}, p.Songs(), "nil 应防御为空切片")
	assert.Equal(t, 0, p.SongCount())
}

func TestPlaylist_SetSongs_ReplacesAndResetsCount(t *testing.T) {
	p, _ := NewPlaylist(newID(t), "标题", "netease", "pl-1")
	p.SetSongs([]Song{{Name: "a"}, {Name: "b"}, {Name: "c"}})
	assert.Equal(t, 3, p.SongCount())

	// 用更少的歌曲替换，songCount 必须随之缩小
	p.SetSongs([]Song{{Name: "x"}})
	assert.Len(t, p.Songs(), 1)
	assert.Equal(t, 1, p.SongCount())
}

func TestReconstructPlaylist_PreservesAllFields(t *testing.T) {
	id := newID(t)
	songs := []Song{
		{Name: "七里香", Artist: "周杰伦", URL: "u1", Cover: "c1"},
		{Name: "夜曲", Artist: "周杰伦", URL: "u2", Cover: "c2"},
	}
	p := ReconstructPlaylist(id, "我的歌单", "cover.jpg", "创建者", "netease", "pl-999", 2, songs, true)

	assert.Equal(t, id, p.ID())
	assert.Equal(t, "我的歌单", p.Title())
	assert.Equal(t, "cover.jpg", p.Cover())
	assert.Equal(t, "创建者", p.Creator())
	assert.Equal(t, "netease", p.Platform())
	assert.Equal(t, "pl-999", p.PlaylistID())
	assert.Equal(t, 2, p.SongCount())
	assert.Equal(t, songs, p.Songs())
	assert.True(t, p.IsActive())
}

func TestReconstructPlaylist_DoesNotValidateTitle(t *testing.T) {
	// Reconstruct 用于从持久化重建，不做构造校验（空标题也允许）
	p := ReconstructPlaylist(newID(t), "", "", "", "", "", 0, []Song{}, false)
	assert.Empty(t, p.Title())
	assert.NotNil(t, p)
}

func TestReconstructPlaylist_NilSongsDefendsToEmpty(t *testing.T) {
	p := ReconstructPlaylist(newID(t), "标题", "", "", "", "", 0, nil, false)
	assert.Equal(t, []Song{}, p.Songs(), "nil songs 应防御为空切片")
	assert.Equal(t, 0, p.SongCount())
}
