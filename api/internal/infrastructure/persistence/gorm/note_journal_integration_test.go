package gorm

import (
	"context"
	"testing"
	"time"

	appnote "blog-api/internal/application/note"
	domainnote "blog-api/internal/domain/note"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJournalIntegrationRoundTripAndProjectRemoval(t *testing.T) {
	db := setupIntegrationDB(t)
	ctx := context.Background()
	svc := appnote.NewService(NewNoteRepository(db), NewNotePublicationUnitOfWork(db))
	author := preseedAuthor(t, db).String()
	project := shared.NewID().String()
	require.NoError(t, db.Exec("INSERT INTO projects (id, title, slug) VALUES (?, '原项目名', 'journal-project')", project).Error)

	legacyID := shared.NewID().String()
	require.NoError(t, db.Exec(`INSERT INTO notes (id, author_id, title, content_md, content_html, status, published_at)
		VALUES (?, ?, '旧笔记标题里有坑', '原内容', '<p>原内容</p>', 'published', CURRENT_TIMESTAMP)`, legacyID, author).Error)
	legacy, err := svc.GetPublished(ctx, legacyID)
	require.NoError(t, err)
	assert.Equal(t, domainnote.TypeUnclassified, legacy.Type)
	assert.Nil(t, legacy.Pitfall)

	info := appnote.PitfallDTO{Symptom: "输出异常", Cause: "分隔符被展开", Remedy: "改用普通字符串", Code: "  echo ok\n"}
	journal := &appnote.JournalDTO{Type: domainnote.TypePitfall, ProjectID: &project, Pitfall: &info}
	draft, err := svc.Create(ctx, appnote.CreateInput{UserID: author, Title: "脚本排障", ContentMD: "正文", Journal: journal})
	require.NoError(t, err)
	_, err = svc.GetPublished(ctx, draft.ID)
	require.ErrorIs(t, err, domainnote.ErrNotFound)

	_, err = svc.Update(ctx, appnote.UpdateInput{NoteID: draft.ID, Title: "脚本排障", ContentMD: "旧客户端更新了正文"})
	require.NoError(t, err)
	_, err = svc.Publish(ctx, draft.ID)
	require.NoError(t, err)
	require.NoError(t, db.Exec("UPDATE projects SET title = '新项目名' WHERE id = ?", project).Error)
	published, err := svc.GetPublished(ctx, draft.ID)
	require.NoError(t, err)
	assert.Equal(t, domainnote.TypePitfall, published.Type)
	assert.Equal(t, &appnote.PublicNoteProjectDTO{ID: project, Title: "新项目名"}, published.Project)
	assert.Equal(t, &info, published.Pitfall)
	assert.Contains(t, published.ContentHTML, "旧客户端更新了正文")

	require.NoError(t, db.Exec("DELETE FROM projects WHERE id = ?", project).Error)
	published, err = svc.GetPublished(ctx, draft.ID)
	require.NoError(t, err)
	assert.Nil(t, published.Project)
	_, err = svc.Create(ctx, appnote.CreateInput{UserID: author, ContentMD: "无效关联", Journal: journal})
	require.ErrorContains(t, err, "关联项目不存在")

	_, err = svc.Update(ctx, appnote.UpdateInput{NoteID: draft.ID, ContentMD: "作为想法整理", Journal: &appnote.JournalDTO{Type: domainnote.TypeIdea}})
	require.NoError(t, err)
	published, err = svc.GetPublished(ctx, draft.ID)
	require.NoError(t, err)
	assert.Equal(t, domainnote.TypeIdea, published.Type)
	assert.Nil(t, published.Pitfall)
}

func TestJournalIntegrationFiltersAndCursorShareTimestamp(t *testing.T) {
	db := setupIntegrationDB(t)
	ctx := context.Background()
	repo := NewNoteRepository(db)
	svc := appnote.NewService(repo, NewNotePublicationUnitOfWork(db))
	author := preseedAuthor(t, db)
	project, other := shared.NewID(), shared.NewID()
	require.NoError(t, db.Exec("INSERT INTO projects (id, title, slug) VALUES (?, '一', 'one'), (?, '二', 'two')", project.UUID(), other.UUID()).Error)
	require.NoError(t, db.Create(&model.Tag{Name: "联调标签", Slug: "journal-contract-tag"}).Error)
	instant := time.Date(2026, time.October, 29, 2, 0, 0, 123456000, time.UTC)
	seed := func(title string, projectID *shared.ID, kind domainnote.Type, tagged, published bool) string {
		t.Helper()
		var pitfall *domainnote.Pitfall
		if kind == domainnote.TypePitfall {
			pitfall = &domainnote.Pitfall{Symptom: "示例现象"}
		}
		var tags []string
		if tagged {
			tags = []string{"联调标签"}
		}
		id := shared.NewID()
		n, err := domainnote.NewNote(id, author, title, "正文", "<p>正文</p>", tags, &domainnote.Journal{
			Type: kind, ProjectID: projectID, Pitfall: pitfall,
		})
		require.NoError(t, err)
		if published {
			n.Publish(instant)
		}
		require.NoError(t, repo.Create(ctx, n))
		return id.String()
	}
	first := seed("同一天第一条", &project, domainnote.TypePitfall, true, true)
	second := seed("同一天第二条", &project, domainnote.TypePitfall, true, true)
	seed("他项目", &other, domainnote.TypePitfall, true, true)
	seed("另一类型", &project, domainnote.TypeIdea, true, true)
	seed("无标签", &project, domainnote.TypePitfall, false, true)
	seed("草稿", &project, domainnote.TypePitfall, true, false)

	query := appnote.BrowseQuery{Limit: 1, TagSlug: "journal-contract-tag", ProjectID: project.String(), Type: domainnote.TypePitfall}
	page, cursor, err := svc.BrowsePublished(ctx, query)
	require.NoError(t, err)
	require.Len(t, page, 1)
	require.NotEmpty(t, cursor)
	query.Cursor = cursor
	remaining, cursor, err := svc.BrowsePublished(ctx, query)
	require.NoError(t, err)
	require.Len(t, remaining, 1)
	assert.Empty(t, cursor)
	assert.Equal(t, max(first, second), page[0].ID)
	assert.Equal(t, min(first, second), remaining[0].ID)
}
