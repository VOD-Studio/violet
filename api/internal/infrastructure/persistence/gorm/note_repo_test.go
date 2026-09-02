package gorm

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	domainnote "blog-api/internal/domain/note"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func newNoteTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "note.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Note{}, &model.Tag{}))
	for _, name := range []string{"redis", "css", "deploy"} {
		require.NoError(t, db.Create(&model.Tag{Name: name, Slug: name}).Error)
	}
	return db
}

func mustNote(t *testing.T, author shared.ID, md string) *domainnote.Note {
	t.Helper()
	n, err := domainnote.NewNote(shared.NewID(), author, "", md, nil)
	require.NoError(t, err)
	return n
}

func TestNoteRepositoryCreateAndFindByID(t *testing.T) {
	db := newNoteTestDB(t)
	repo := NewNoteRepository(db)
	author := shared.NewID()

	n := mustNote(t, author, "# 正文")
	require.NoError(t, n.Edit("", "# 正文", "<h1>正文</h1>", []string{"redis", "css"}))
	require.NoError(t, repo.Create(context.Background(), n))

	got, err := repo.FindByID(context.Background(), n.ID())
	require.NoError(t, err)
	assert.Equal(t, "# 正文", got.ContentMD())
	assert.Equal(t, "<h1>正文</h1>", got.ContentHTML())
	assert.Equal(t, []string{"redis", "css"}, got.Tags())
	assert.Equal(t, domainnote.StatusDraft, got.Status())
}

func TestNoteRepositoryCreateUnknownTagRejected(t *testing.T) {
	db := newNoteTestDB(t)
	repo := NewNoteRepository(db)
	n := mustNote(t, shared.NewID(), "x")
	require.NoError(t, n.Edit("", "x", "x", []string{"不存在的标签"}))
	err := repo.Create(context.Background(), n)
	require.Error(t, err, "未知标签应报错而非静默丢弃")
}

func TestNoteRepositorySaveReplacesTags(t *testing.T) {
	db := newNoteTestDB(t)
	repo := NewNoteRepository(db)
	author := shared.NewID()

	n := mustNote(t, author, "x")
	require.NoError(t, n.Edit("", "x", "x", []string{"redis"}))
	require.NoError(t, repo.Create(context.Background(), n))

	require.NoError(t, n.Edit("", "x2", "x2", []string{"css", "deploy"}))
	require.NoError(t, repo.Save(context.Background(), n))

	got, err := repo.FindByID(context.Background(), n.ID())
	require.NoError(t, err)
	assert.Equal(t, []string{"css", "deploy"}, got.Tags(), "保存应整体替换标签关联")
	assert.Equal(t, "x2", got.ContentMD())
}

func TestNoteRepositoryDelete(t *testing.T) {
	db := newNoteTestDB(t)
	repo := NewNoteRepository(db)
	n := mustNote(t, shared.NewID(), "x")
	require.NoError(t, repo.Create(context.Background(), n))

	require.NoError(t, repo.Delete(context.Background(), n.ID()))
	_, err := repo.FindByID(context.Background(), n.ID())
	require.ErrorIs(t, err, domainnote.ErrNotFound)
	require.ErrorIs(t, repo.Delete(context.Background(), n.ID()), domainnote.ErrNotFound, "重复删除按不存在处理")

	var tagCount int64
	require.NoError(t, db.Model(&model.Tag{}).Count(&tagCount).Error)
	assert.EqualValues(t, 3, tagCount, "删除笔记不物理删除共享标签")
}

func TestNoteRepositoryFindPageFiltersAndOrders(t *testing.T) {
	db := newNoteTestDB(t)
	repo := NewNoteRepository(db)
	author := shared.NewID()

	// 显式给 createdAt：SQLite 的 CURRENT_TIMESTAMP 只有秒级分辨率，
	// 依赖插入间隔会因同秒并列退化为 id 排序。
	base := time.Now().UTC().Add(-time.Hour)
	old := domainnote.Reconstruct(shared.NewID(), author, "", "旧", "旧", domainnote.StatusDraft, nil, base, base, nil)
	fresh := domainnote.Reconstruct(shared.NewID(), author, "", "新", "新", domainnote.StatusDraft, nil, base.Add(time.Minute), base.Add(time.Minute), nil)
	require.NoError(t, repo.Create(context.Background(), old))
	require.NoError(t, repo.Create(context.Background(), fresh))
	fresh.Publish(time.Now().UTC())
	require.NoError(t, repo.Save(context.Background(), fresh))

	page, err := repo.FindPage(context.Background(), domainnote.ListFilter{Status: domainnote.StatusPublished}, shared.PageQuery{Page: 1, Limit: 10}.Normalize())
	require.NoError(t, err)
	require.Len(t, page.Items, 1)
	assert.Equal(t, fresh.ID(), page.Items[0].ID())

	all, err := repo.FindPage(context.Background(), domainnote.ListFilter{}, shared.PageQuery{Page: 1, Limit: 10}.Normalize())
	require.NoError(t, err)
	require.Len(t, all.Items, 2)
	assert.Equal(t, fresh.ID(), all.Items[0].ID(), "created_at 倒序")
	assert.EqualValues(t, 2, all.Total)
}

func TestNoteRepositoryFindPublishedPageKeyset(t *testing.T) {
	db := newNoteTestDB(t)
	repo := NewNoteRepository(db)
	author := shared.NewID()

	base := time.Now().UTC().Add(-time.Hour)
	ids := make([]shared.ID, 0, 3)
	for i := 0; i < 3; i++ {
		n := mustNote(t, author, "正文")
		require.NoError(t, n.Edit("", "正文", "<p>正文</p>", []string{"redis"}))
		n.Publish(base.Add(time.Duration(i) * time.Minute))
		require.NoError(t, repo.Create(context.Background(), n))
		ids = append(ids, n.ID())
	}
	draft := mustNote(t, author, "草稿不进公开流")
	require.NoError(t, repo.Create(context.Background(), draft))

	page1, err := repo.FindPublishedPage(context.Background(), nil, domainnote.BrowseFilter{}, 2)
	require.NoError(t, err)
	require.Len(t, page1, 2)
	assert.Equal(t, ids[2], page1[0].ID)
	assert.Equal(t, ids[1], page1[1].ID)

	cursor := &domainnote.PublishedCursor{PublishedAt: page1[len(page1)-1].PublishedAt, ID: page1[len(page1)-1].ID}
	page2, err := repo.FindPublishedPage(context.Background(), cursor, domainnote.BrowseFilter{}, 2)
	require.NoError(t, err)
	require.Len(t, page2, 1)
	assert.Equal(t, ids[0], page2[0].ID)
	assert.Equal(t, []string{"redis"}, page2[0].Tags)

	tagged, err := repo.FindPublishedPage(context.Background(), nil, domainnote.BrowseFilter{TagSlug: "css"}, 10)
	require.NoError(t, err)
	assert.Empty(t, tagged, "按标签 slug 筛选应过滤未挂标签的笔记")
}

func TestNoteRepositoryFindPublishedByID(t *testing.T) {
	db := newNoteTestDB(t)
	repo := NewNoteRepository(db)
	author := shared.NewID()

	published := mustNote(t, author, "已发布")
	published.Publish(time.Now().UTC())
	require.NoError(t, repo.Create(context.Background(), published))
	draft := mustNote(t, author, "草稿")
	require.NoError(t, repo.Create(context.Background(), draft))

	got, err := repo.FindPublishedByID(context.Background(), published.ID())
	require.NoError(t, err)
	assert.Equal(t, published.ID(), got.ID)

	_, err = repo.FindPublishedByID(context.Background(), draft.ID())
	require.ErrorIs(t, err, domainnote.ErrNotFound, "草稿在公开侧按不存在处理")
}
