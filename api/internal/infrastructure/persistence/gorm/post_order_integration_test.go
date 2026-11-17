package gorm

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	apppost "blog-api/internal/application/post"
	"blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	"blog-api/internal/middleware"
)

func seedOrderedPosts(t *testing.T, db *gorm.DB, count int) (*PostRepository, []shared.ID) {
	t.Helper()
	repo := NewPostRepository(db)
	author := preseedAuthor(t, db)
	ids := make([]shared.ID, count)
	for i := range count {
		id := shared.NewID()
		p, err := post.NewPost(id, author, fmt.Sprintf("Order %d", i), fmt.Sprintf("order-%d", i))
		require.NoError(t, err)
		p.Publish()
		require.NoError(t, repo.Save(context.Background(), p))
		ids[count-1-i] = id
	}
	return repo, ids
}

func readPostOrder(t *testing.T, repo *PostRepository) []shared.ID {
	t.Helper()
	page, err := repo.FindPage(context.Background(), post.ListFilter{Status: post.StatusPublished, Sort: post.SortPublished}, shared.PageQuery{Page: 1, Limit: 100})
	require.NoError(t, err)
	ids := make([]shared.ID, len(page.Items))
	for i, p := range page.Items {
		ids[i] = p.ID()
	}
	return ids
}

func TestPostOrderIntegrationSubsetAndPin(t *testing.T) {
	db := setupIntegrationDB(t)
	require.NoError(t, db.AutoMigrate(&model.Post{}))
	repo, original := seedOrderedPosts(t, db, 6)
	assert.Equal(t, original, readPostOrder(t, repo), "新文章通过序列排在前面")
	expected := []shared.ID{original[1], original[3]}
	require.NoError(t, repo.Reorder(context.Background(), expected, []shared.ID{expected[1], expected[0]}))
	want := append([]shared.ID(nil), original...)
	want[1], want[3] = want[3], want[1]
	assert.Equal(t, want, readPostOrder(t, NewPostRepository(db)), "筛选外与页外位置保持不变，重新读仓储仍持久化")

	p, err := repo.FindByID(context.Background(), want[1])
	require.NoError(t, err)
	require.NoError(t, repo.Save(context.Background(), p))
	assert.Equal(t, want, readPostOrder(t, repo), "正文保存不覆盖排序位置")

	ctx := context.WithValue(context.Background(), middleware.UserIsRootKey, true)
	svc := apppost.NewService(repo, nil, nil, nil, nil, NewPostPublicationUnitOfWork(db))
	_, err = svc.SetFeatured(ctx, want[4].String(), true)
	require.NoError(t, err)
	pinned := append([]shared.ID{want[4]}, want[:4]...)
	pinned = append(pinned, want[5:]...)
	assert.Equal(t, pinned, readPostOrder(t, repo))
	_, err = svc.SetFeatured(ctx, want[4].String(), false)
	require.NoError(t, err)
	assert.Equal(t, want, readPostOrder(t, repo), "取消置顶还原普通层位置")

	page, err := repo.FindPage(ctx, post.ListFilter{Sort: post.SortManual}, shared.PageQuery{Page: 2, Limit: 2})
	require.NoError(t, err)
	assert.Equal(t, want[2], page.Items[0].ID())
	assert.Equal(t, want[3], page.Items[1].ID())
}

func TestPostOrderIntegrationRejectsStaleDeletedAndMixed(t *testing.T) {
	db := setupIntegrationDB(t)
	repo, ids := seedOrderedPosts(t, db, 4)
	ctx := context.Background()
	require.Error(t, repo.Reorder(ctx, []shared.ID{ids[1], ids[0]}, []shared.ID{ids[0], ids[1]}))
	assert.Equal(t, ids, readPostOrder(t, repo))

	require.NoError(t, db.Exec("UPDATE posts SET is_featured = true WHERE id = ?", ids[0].UUID()).Error)
	require.Error(t, repo.Reorder(ctx, ids[:2], []shared.ID{ids[1], ids[0]}))
	assert.Equal(t, ids, readPostOrder(t, repo))

	require.NoError(t, repo.Delete(ctx, ids[1]))
	require.Error(t, repo.Reorder(ctx, ids[:2], []shared.ID{ids[1], ids[0]}))
	assert.Equal(t, []shared.ID{ids[0], ids[2], ids[3]}, readPostOrder(t, repo))
}

func TestPostOrderIntegrationRollsBackPartialWrite(t *testing.T) {
	db := setupIntegrationDB(t)
	repo, ids := seedOrderedPosts(t, db, 3)
	require.NoError(t, db.Exec(fmt.Sprintf(`CREATE FUNCTION reject_post_order() RETURNS trigger AS $$
	BEGIN
		IF NEW.id = '%s'::uuid THEN RAISE EXCEPTION 'forced order failure'; END IF;
		RETURN NEW;
	END; $$ LANGUAGE plpgsql;
	CREATE TRIGGER reject_post_order BEFORE UPDATE OF sort_order ON posts
	FOR EACH ROW EXECUTE FUNCTION reject_post_order();`, ids[0].String())).Error)
	require.Error(t, repo.Reorder(context.Background(), ids[:2], []shared.ID{ids[1], ids[0]}))
	assert.Equal(t, ids, readPostOrder(t, repo), "第二条更新失败须回滚第一条")
}

func TestPostOrderIntegrationConcurrentReorder(t *testing.T) {
	db := setupIntegrationDB(t)
	repo, ids := seedOrderedPosts(t, db, 3)
	start := make(chan struct{})
	errs := make([]error, 2)
	var group sync.WaitGroup
	for i := range errs {
		group.Add(1)
		go func() {
			defer group.Done()
			<-start
			errs[i] = repo.Reorder(context.Background(), ids[:2], []shared.ID{ids[1], ids[0]})
		}()
	}
	close(start)
	group.Wait()
	assert.NotEqual(t, errs[0] == nil, errs[1] == nil, "同一旧快照只能有一个事务成功")
	assert.Equal(t, []shared.ID{ids[1], ids[0], ids[2]}, readPostOrder(t, repo))
}
