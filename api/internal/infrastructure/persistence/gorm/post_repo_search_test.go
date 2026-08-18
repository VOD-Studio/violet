package gorm

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"blog-api/internal/domain/post"
	domainshared "blog-api/internal/domain/shared"
)

// seedSearchPost 写入一篇带正文/摘要的文章，供 Search 测试检索。
func seedSearchPost(t *testing.T, db *gorm.DB, authorID domainshared.ID, slug, title, contentMD, excerpt, status string) domainshared.ID {
	t.Helper()
	repo := NewPostRepository(db)
	pid := domainshared.NewID()
	p, err := post.NewPost(pid, authorID, title, slug)
	require.NoError(t, err)
	require.NoError(t, p.UpdateContent(title, contentMD, "<p>html</p>", excerpt, ""))
	switch status {
	case post.StatusPublished:
		p.Publish()
	case post.StatusArchived:
		p.Publish()
		p.Archive()
	}
	require.NoError(t, repo.Save(context.Background(), p))
	return pid
}

// searchPage 检索场景的 FindPage 适配：author + keyword + status + updated_at
// 倒序，返回当前页 items 与 total（对齐旧 repo.Search 签名，保持断言形态）。
func searchPage(ctx context.Context, repo *PostRepository, authorID domainshared.ID, query, status string, page, limit int) ([]*post.Post, int64, error) {
	result, err := repo.FindPage(ctx, post.ListFilter{
		AuthorID: &authorID, Keyword: query, Status: status, Sort: post.SortUpdated,
	}, domainshared.PageQuery{Page: page, Limit: limit})
	if err != nil {
		return nil, 0, err
	}
	return result.Items, result.Total, nil
}

func TestPostRepository_Search(t *testing.T) {
	db := setupPostTestDB(t)
	repo := NewPostRepository(db)
	ctx := context.Background()
	authorID := domainshared.NewID()
	otherAuthor := domainshared.NewID()

	// 三篇作者文章：分别命中 title / excerpt / content_md
	idTitle := seedSearchPost(t, db, authorID, "s-quantum-title", "Quantum 计算入门", "正文无关键词", "摘要无关键词", post.StatusPublished)
	idExcerpt := seedSearchPost(t, db, authorID, "s-quantum-excerpt", "无关键词标题", "正文无关键词", "量子力学摘要", post.StatusDraft)
	idContent := seedSearchPost(t, db, authorID, "s-quantum-content", "无关键词标题2", "quantum field theory 正文", "无关键词摘要", post.StatusArchived)
	// 一篇他人文章，含相同关键词，验证 author_id 隔离
	seedSearchPost(t, db, otherAuthor, "s-other", "Quantum 他人文章", "quantum", "quantum", post.StatusPublished)

	t.Run("三列分别命中", func(t *testing.T) {
		// title 命中（英文大小写不敏感 + 中文混合）
		got, total, err := searchPage(ctx, repo, authorID, "quantum", "all", 1, 20)
		require.NoError(t, err)
		assert.Equal(t, int64(2), total) // idTitle(title) + idContent(content_md)
		assert.ElementsMatch(t, []domainshared.ID{idTitle, idContent}, []domainshared.ID{got[0].ID(), got[1].ID()})

		// excerpt 命中（中文子串）
		got, total, err = searchPage(ctx, repo, authorID, "量子力学", "all", 1, 20)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		assert.Equal(t, idExcerpt, got[0].ID())
	})

	t.Run("大小写不敏感", func(t *testing.T) {
		got, total, err := searchPage(ctx, repo, authorID, "QUANTUM FIELD", "all", 1, 20)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		assert.Equal(t, idContent, got[0].ID())
	})

	t.Run("多关键词 AND", func(t *testing.T) {
		// 两词同文命中
		_, total, err := searchPage(ctx, repo, authorID, "quantum field", "all", 1, 20)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		// 一词缺失不命中："field" 只在 idContent，"入门" 只在 idTitle
		_, total, err = searchPage(ctx, repo, authorID, "field 入门", "all", 1, 20)
		require.NoError(t, err)
		assert.Equal(t, int64(0), total)
	})

	t.Run("status 过滤", func(t *testing.T) {
		_, total, err := searchPage(ctx, repo, authorID, "quantum", post.StatusPublished, 1, 20)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)

		_, total, err = searchPage(ctx, repo, authorID, "quantum", post.StatusArchived, 1, 20)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)

		// 空 status 与 "all" 等价（不过滤）
		_, totalEmpty, err := searchPage(ctx, repo, authorID, "quantum", "", 1, 20)
		require.NoError(t, err)
		_, totalAll, err := searchPage(ctx, repo, authorID, "quantum", "all", 1, 20)
		require.NoError(t, err)
		assert.Equal(t, totalAll, totalEmpty)
		assert.Equal(t, int64(2), totalAll)
	})

	t.Run("author_id 隔离", func(t *testing.T) {
		// 用他人 authorID 检索：只能看到他人那篇
		got, total, err := searchPage(ctx, repo, otherAuthor, "quantum", "all", 1, 20)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		assert.Equal(t, "s-other", got[0].Slug())
	})

	t.Run("分页边界", func(t *testing.T) {
		// 造 3 篇同关键词文章
		db2 := setupPostTestDB(t)
		repo2 := NewPostRepository(db2)
		author := domainshared.NewID()
		for i := range 3 {
			seedSearchPost(t, db2, author, fmt.Sprintf("pg-%d", i), fmt.Sprintf("分页量子 %d", i), "量子", "量子", post.StatusPublished)
		}
		page1, total, err := searchPage(ctx, repo2, author, "量子", "all", 1, 2)
		require.NoError(t, err)
		assert.Equal(t, int64(3), total)
		assert.Len(t, page1, 2)

		page2, total, err := searchPage(ctx, repo2, author, "量子", "all", 2, 2)
		require.NoError(t, err)
		assert.Equal(t, int64(3), total)
		assert.Len(t, page2, 1)

		// offset 超出：返回空，total 仍为 3
		page3, total, err := searchPage(ctx, repo2, author, "量子", "all", 3, 2)
		require.NoError(t, err)
		assert.Equal(t, int64(3), total)
		assert.Empty(t, page3)
	})

	t.Run("LIKE 通配符转义", func(t *testing.T) {
		db3 := setupPostTestDB(t)
		repo3 := NewPostRepository(db3)
		author := domainshared.NewID()
		seedSearchPost(t, db3, author, "pct-hit", "覆盖率 100% 达标", "无", "无", post.StatusPublished)
		seedSearchPost(t, db3, author, "pct-miss", "覆盖率 95 达标", "无", "无", post.StatusPublished)

		// "100%" 中的 % 是字面量，不应命中 "覆盖率 95"
		got, total, err := searchPage(ctx, repo3, author, "100%", "all", 1, 20)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		assert.Equal(t, "pct-hit", got[0].Slug())

		// 单独 "%" 被转义为字面量，两篇文章都不含 "%" 之外的语义 → 只命中含 % 的那篇
		got, total, err = searchPage(ctx, repo3, author, "%", "all", 1, 20)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		assert.Equal(t, "pct-hit", got[0].Slug())
	})

	t.Run("updated_at 倒序", func(t *testing.T) {
		db4 := setupPostTestDB(t)
		repo4 := NewPostRepository(db4)
		author := domainshared.NewID()
		oldID := seedSearchPost(t, db4, author, "ord-old", "排序量子旧", "量子", "", post.StatusPublished)
		newID := seedSearchPost(t, db4, author, "ord-new", "排序量子新", "量子", "", post.StatusPublished)
		// 强制拉开 updated_at
		require.NoError(t, db4.Exec("UPDATE posts SET updated_at = ? WHERE slug = ?", time.Now().Add(-48*time.Hour), "ord-new").Error)
		require.NoError(t, db4.Exec("UPDATE posts SET updated_at = ? WHERE slug = ?", time.Now(), "ord-old").Error)

		got, total, err := searchPage(ctx, repo4, author, "量子", "all", 1, 20)
		require.NoError(t, err)
		assert.Equal(t, int64(2), total)
		// updated_at 最新的（ord-old）排最前，与 created_at 顺序相反
		assert.Equal(t, oldID, got[0].ID())
		assert.Equal(t, newID, got[1].ID())
	})
}
