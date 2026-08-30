package gorm

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/emoji"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func setupEmojiTestDB(t *testing.T) *EmojiGroupRepository {
	t.Helper()
	db := setupTestDB(t)
	// emoji 表不在 setupTestDB 的 migrate 列表里，单独补
	require.NoError(t, db.AutoMigrate(&model.EmojiGroup{}, &model.Emoji{}))
	return NewEmojiGroupRepository(db)
}

func TestCount_Empty(t *testing.T) {
	repo := setupEmojiTestDB(t)
	n, err := repo.Count(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int64(0), n)
}

func TestCount_AfterSave(t *testing.T) {
	repo := setupEmojiTestDB(t)
	g, _ := emoji.NewEmojiGroup(0, "test-group", emoji.SourceBilibili)
	_, err := repo.Save(context.Background(), g)
	require.NoError(t, err)

	n, err := repo.Count(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int64(1), n)
}

func TestFindGroupsNeedingCover(t *testing.T) {
	repo := setupEmojiTestDB(t)
	// 三种状态的 bilibili 分组
	g1, _ := emoji.NewEmojiGroup(0, "empty-cover", emoji.SourceBilibili)
	g1.SetCoverURL("")
	_, _ = repo.Save(context.Background(), g1)

	g2, _ := emoji.NewEmojiGroup(0, "remote-cover", emoji.SourceBilibili)
	g2.SetCoverURL("https://example.com/c.png")
	_, _ = repo.Save(context.Background(), g2)

	g3, _ := emoji.NewEmojiGroup(0, "local-cover", emoji.SourceBilibili)
	g3.SetCoverURL("/uploads/emojis/abc.png")
	_, _ = repo.Save(context.Background(), g3)

	// system 分组不应被选中
	g4, _ := emoji.NewEmojiGroup(0, "sys", emoji.SourceSystem)
	g4.SetCoverURL("")
	_, _ = repo.Save(context.Background(), g4)

	groups, err := repo.FindGroupsNeedingCover(context.Background(), emoji.SourceBilibili)
	require.NoError(t, err)
	require.Len(t, groups, 2) // empty-cover + remote-cover
	names := []string{groups[0].Name(), groups[1].Name()}
	assert.Contains(t, names, "empty-cover")
	assert.Contains(t, names, "remote-cover")
}

func TestUpdateCoverURL(t *testing.T) {
	repo := setupEmojiTestDB(t)
	g, _ := emoji.NewEmojiGroup(0, "g", emoji.SourceBilibili)
	id, _ := repo.Save(context.Background(), g)

	err := repo.UpdateCoverURL(context.Background(), id, "/uploads/emojis/new.png")
	require.NoError(t, err)

	loaded, _ := repo.FindByID(context.Background(), id)
	assert.Equal(t, "/uploads/emojis/new.png", loaded.CoverURL())
}

func TestUpdateCoverURL_NotFound(t *testing.T) {
	repo := setupEmojiTestDB(t)
	err := repo.UpdateCoverURL(context.Background(), 99999, "/x.png")
	require.Error(t, err)
	assert.ErrorIs(t, err, emoji.ErrNotFound)
}

func TestRefCountExpr_NegativeDeltaUsesAdditionOperator(t *testing.T) {
	expr := refCountExpr(-2)
	assert.Equal(t, "GREATEST(ref_count + ?, 0)", expr.SQL)
	assert.Equal(t, []any{-2}, expr.Vars)
}

func TestUpsertByName_CreateNew(t *testing.T) {
	repo := setupEmojiTestDB(t)
	g, _ := emoji.NewEmojiGroup(0, "new-pkg", emoji.SourceBilibili)
	g.SetCoverURL("https://example.com/c.png")
	g.SetSortOrder(3)
	g.SetEnabled(true)

	id, err := repo.UpsertByName(context.Background(), g)
	require.NoError(t, err)
	assert.Greater(t, id, int32(0))

	loaded, _ := repo.FindByID(context.Background(), id)
	assert.Equal(t, "new-pkg", loaded.Name())
	assert.Equal(t, "bilibili", loaded.Source())
	assert.Equal(t, "https://example.com/c.png", loaded.CoverURL())
	assert.Equal(t, 3, loaded.SortOrder())
	assert.True(t, loaded.IsEnabled())
}

func TestUpsertByName_UpdateExisting(t *testing.T) {
	repo := setupEmojiTestDB(t)
	g1, _ := emoji.NewEmojiGroup(0, "pkg", emoji.SourceBilibili)
	g1.SetCoverURL("https://old.com/c.png")
	id, _ := repo.UpsertByName(context.Background(), g1)

	g2, _ := emoji.NewEmojiGroup(0, "pkg", emoji.SourceBilibili)
	g2.SetCoverURL("/uploads/emojis/new.png")
	g2.SetSortOrder(9)
	g2.SetEnabled(false)
	id2, err := repo.UpsertByName(context.Background(), g2)
	require.NoError(t, err)
	assert.Equal(t, id, id2, "同 name 应返回同一 ID")

	loaded, _ := repo.FindByID(context.Background(), id)
	assert.Equal(t, "/uploads/emojis/new.png", loaded.CoverURL())
	assert.Equal(t, 9, loaded.SortOrder())
	assert.False(t, loaded.IsEnabled())

	n, _ := repo.Count(context.Background())
	assert.Equal(t, int64(1), n)
}

func TestUpsertEmojiByName_Upsert(t *testing.T) {
	repo := setupEmojiTestDB(t)
	g, _ := emoji.NewEmojiGroup(0, "pkg", emoji.SourceBilibili)
	groupID, _ := repo.Save(context.Background(), g)

	// 新建
	e1 := emoji.NewEmoji(0, groupID, "[e]", "/uploads/e1.png")
	id1, err := repo.UpsertEmojiByName(context.Background(), e1)
	require.NoError(t, err)
	assert.Greater(t, id1, int32(0))

	// 更新（同 groupID+name）
	e2 := emoji.NewEmoji(0, groupID, "[e]", "/uploads/e2.png")
	e2.Update("[e]", "/uploads/e2.png", "", "/uploads/e2.gif", "https://bili/e.png", 5)
	id2, err := repo.UpsertEmojiByName(context.Background(), e2)
	require.NoError(t, err)
	assert.Equal(t, id1, id2)

	loaded, _ := repo.FindEmojiByID(context.Background(), id1)
	assert.Equal(t, "/uploads/e2.png", loaded.URL())
	assert.Equal(t, "/uploads/e2.gif", loaded.GifURL())
}
