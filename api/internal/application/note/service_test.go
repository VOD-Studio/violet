package note

import (
	"context"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainnote "blog-api/internal/domain/note"
	"blog-api/internal/domain/shared"
)

// fakeNoteRepo 记录调用参数并按内存数据应答，覆盖 service 用例所需行为。
type fakeNoteRepo struct {
	notes map[shared.ID]*domainnote.Note

	lastBrowseFilter domainnote.BrowseFilter
	lastBrowseLimit  int
}

func newFakeRepo() *fakeNoteRepo {
	return &fakeNoteRepo{notes: map[shared.ID]*domainnote.Note{}}
}

func (f *fakeNoteRepo) Create(_ context.Context, n *domainnote.Note) error {
	f.notes[n.ID()] = n
	return nil
}

func (f *fakeNoteRepo) FindByID(_ context.Context, id shared.ID) (*domainnote.Note, error) {
	n, ok := f.notes[id]
	if !ok {
		return nil, domainnote.ErrNotFound
	}
	return n, nil
}

func (f *fakeNoteRepo) Save(_ context.Context, n *domainnote.Note) error {
	f.notes[n.ID()] = n
	return nil
}

func (f *fakeNoteRepo) Delete(_ context.Context, id shared.ID) error {
	delete(f.notes, id)
	return nil
}

func (f *fakeNoteRepo) FindPage(_ context.Context, filter domainnote.ListFilter, q shared.PageQuery) (shared.PageResult[*domainnote.Note], error) {
	items := make([]*domainnote.Note, 0)
	for _, n := range f.notes {
		if filter.Status != "" && n.Status() != filter.Status {
			continue
		}
		items = append(items, n)
	}
	sort.Slice(items, func(i, j int) bool {
		a, b := items[i], items[j]
		if !a.CreatedAt().Equal(b.CreatedAt()) {
			return a.CreatedAt().After(b.CreatedAt())
		}
		return a.ID().String() > b.ID().String()
	})
	total := int64(len(items))
	start := q.Offset()
	if start >= len(items) {
		return shared.NewPageResult(q, []*domainnote.Note{}, total), nil
	}
	end := start + q.Limit
	if end > len(items) {
		end = len(items)
	}
	return shared.NewPageResult(q, items[start:end], total), nil
}

func (f *fakeNoteRepo) FindPublishedPage(_ context.Context, cursor *domainnote.PublishedCursor, filter domainnote.BrowseFilter, limit int) ([]domainnote.PublishedNote, error) {
	f.lastBrowseFilter = filter
	f.lastBrowseLimit = limit
	rows := make([]domainnote.PublishedNote, 0)
	for _, n := range f.notes {
		if !n.IsPublished() || n.PublishedAt() == nil {
			continue
		}
		if filter.TagSlug != "" && !hasTagSlug(n.Tags(), filter.TagSlug) {
			continue
		}
		rows = append(rows, domainnote.PublishedNote{
			ID: n.ID(), Title: n.Title(), ContentHTML: n.ContentHTML(),
			Tags: n.Tags(), PublishedAt: *n.PublishedAt(),
		})
	}
	sort.Slice(rows, func(i, j int) bool {
		if !rows[i].PublishedAt.Equal(rows[j].PublishedAt) {
			return rows[i].PublishedAt.After(rows[j].PublishedAt)
		}
		return rows[i].ID.String() > rows[j].ID.String()
	})
	if cursor != nil {
		filtered := make([]domainnote.PublishedNote, 0, len(rows))
		for _, r := range rows {
			if r.PublishedAt.Before(cursor.PublishedAt) ||
				(r.PublishedAt.Equal(cursor.PublishedAt) && r.ID.String() < cursor.ID.String()) {
				filtered = append(filtered, r)
			}
		}
		rows = filtered
	}
	if limit >= 0 && len(rows) > limit {
		rows = rows[:limit]
	}
	return rows, nil
}

func (f *fakeNoteRepo) FindPublishedByID(_ context.Context, id shared.ID) (domainnote.PublishedNote, error) {
	n, ok := f.notes[id]
	if !ok || !n.IsPublished() || n.PublishedAt() == nil {
		return domainnote.PublishedNote{}, domainnote.ErrNotFound
	}
	return domainnote.PublishedNote{
		ID: n.ID(), Title: n.Title(), ContentHTML: n.ContentHTML(),
		Tags: n.Tags(), PublishedAt: *n.PublishedAt(),
	}, nil
}

// hasTagSlug fake 简化：标签名与 slug 视为同名匹配。
func hasTagSlug(tags []string, slug string) bool {
	for _, t := range tags {
		if t == slug {
			return true
		}
	}
	return false
}

func newService(t *testing.T) (*Service, *fakeNoteRepo) {
	t.Helper()
	repo := newFakeRepo()
	return NewService(repo), repo
}

func seedAuthor(t *testing.T) string {
	t.Helper()
	return shared.NewID().String()
}

func TestCreate_GeneratesHTMLAndDraft(t *testing.T) {
	svc, _ := newService(t)
	dto, err := svc.Create(context.Background(), CreateInput{
		UserID: seedAuthor(t), Title: "标题", ContentMD: "# 现象\n\n正文", Tags: []string{"redis", "redis", " "},
	})
	require.NoError(t, err)
	assert.Equal(t, domainnote.StatusDraft, dto.Status)
	assert.Contains(t, dto.ContentHTML, "<h1", "content_html 应由 markdown 管线生成")
	assert.Equal(t, []string{"redis"}, dto.Tags)
	assert.Nil(t, dto.PublishedAt)
}

func TestCreate_BlankContentRejected(t *testing.T) {
	svc, _ := newService(t)
	_, err := svc.Create(context.Background(), CreateInput{UserID: seedAuthor(t), ContentMD: "  "})
	require.Error(t, err)
}

func TestUpdate_EditsContentKeepsPublishedAt(t *testing.T) {
	svc, repo := newService(t)
	created, err := svc.Create(context.Background(), CreateInput{UserID: seedAuthor(t), ContentMD: "旧正文"})
	require.NoError(t, err)
	_, err = svc.Publish(context.Background(), created.ID)
	require.NoError(t, err)
	first, err := svc.Get(context.Background(), created.ID)
	require.NoError(t, err)
	require.NotNil(t, first.PublishedAt)

	updated, err := svc.Update(context.Background(), UpdateInput{NoteID: created.ID, ContentMD: "新正文"})
	require.NoError(t, err)
	assert.Equal(t, "新正文", updated.ContentMD)
	assert.Contains(t, updated.ContentHTML, "新正文")
	assert.Equal(t, domainnote.StatusPublished, updated.Status, "编辑不改变状态")
	require.NotNil(t, updated.PublishedAt)
	assert.Equal(t, *first.PublishedAt, *updated.PublishedAt, "编辑不刷新发布时间")

	got, err := repo.FindByID(context.Background(), mustID(t, created.ID))
	require.NoError(t, err)
	assert.Equal(t, "新正文", got.ContentMD(), "保存应写回仓储")
}

func TestUpdate_NotFound(t *testing.T) {
	svc, _ := newService(t)
	_, err := svc.Update(context.Background(), UpdateInput{NoteID: shared.NewID().String(), ContentMD: "x"})
	require.ErrorIs(t, err, domainnote.ErrNotFound)
}

func TestGetPublished_DraftHidden(t *testing.T) {
	svc, _ := newService(t)
	created, err := svc.Create(context.Background(), CreateInput{UserID: seedAuthor(t), ContentMD: "草稿"})
	require.NoError(t, err)
	_, err = svc.GetPublished(context.Background(), created.ID)
	require.ErrorIs(t, err, domainnote.ErrNotFound, "草稿在公开侧按不存在处理")
}

func TestBrowsePublished_CursorFlow(t *testing.T) {
	svc, _ := newService(t)
	author := seedAuthor(t)
	base := time.Now().UTC()
	ids := make([]string, 0, 3)
	for i := 0; i < 3; i++ {
		dto, err := svc.Create(context.Background(), CreateInput{UserID: author, ContentMD: "正文"})
		require.NoError(t, err)
		n, err := svc.repo.FindByID(context.Background(), mustID(t, dto.ID))
		require.NoError(t, err)
		n.Publish(base.Add(time.Duration(i) * time.Minute))
		require.NoError(t, svc.repo.Save(context.Background(), n))
		ids = append(ids, dto.ID)
	}

	page1, next, err := svc.BrowsePublished(context.Background(), "", 2, "")
	require.NoError(t, err)
	require.Len(t, page1, 2)
	assert.NotEmpty(t, next, "还有第三条，应返回游标")
	assert.Equal(t, ids[2], page1[0].ID, "published_at 倒序")

	page2, next2, err := svc.BrowsePublished(context.Background(), next, 2, "")
	require.NoError(t, err)
	require.Len(t, page2, 1)
	assert.Empty(t, next2)
	assert.Equal(t, ids[0], page2[0].ID)
}

func TestBrowsePublished_InvalidCursor(t *testing.T) {
	svc, _ := newService(t)
	_, _, err := svc.BrowsePublished(context.Background(), "!!!not-base64!!!", 10, "")
	require.Error(t, err)
}

func TestBrowsePublished_PassesTagFilter(t *testing.T) {
	svc, repo := newService(t)
	_, err := svc.Create(context.Background(), CreateInput{UserID: seedAuthor(t), ContentMD: "x", Tags: []string{"redis"}})
	require.NoError(t, err)
	_, _, err = svc.BrowsePublished(context.Background(), "", 10, "redis")
	require.NoError(t, err)
	assert.Equal(t, "redis", repo.lastBrowseFilter.TagSlug, "标签筛选应透传仓储")
	assert.Equal(t, 11, repo.lastBrowseLimit, "limit+1 探测 hasMore")
}

func TestDelete(t *testing.T) {
	svc, repo := newService(t)
	created, err := svc.Create(context.Background(), CreateInput{UserID: seedAuthor(t), ContentMD: "x"})
	require.NoError(t, err)
	require.NoError(t, svc.Delete(context.Background(), created.ID))
	_, err = repo.FindByID(context.Background(), mustID(t, created.ID))
	require.ErrorIs(t, err, domainnote.ErrNotFound)
}

func TestList_StatusFilter(t *testing.T) {
	svc, _ := newService(t)
	author := seedAuthor(t)
	draft, err := svc.Create(context.Background(), CreateInput{UserID: author, ContentMD: "d"})
	require.NoError(t, err)
	pub, err := svc.Create(context.Background(), CreateInput{UserID: author, ContentMD: "p"})
	require.NoError(t, err)
	_, err = svc.Publish(context.Background(), pub.ID)
	require.NoError(t, err)

	drafts, total, err := svc.List(context.Background(), ListQuery{Status: domainnote.StatusDraft, Page: 1, Limit: 20})
	require.NoError(t, err)
	assert.EqualValues(t, 1, total)
	require.Len(t, drafts, 1)
	assert.Equal(t, draft.ID, drafts[0].ID)

	all, totalAll, err := svc.List(context.Background(), ListQuery{})
	require.NoError(t, err)
	assert.EqualValues(t, 2, totalAll)
	assert.Len(t, all, 2)
}

func mustID(t *testing.T, s string) shared.ID {
	t.Helper()
	id, err := shared.ParseID(s)
	require.NoError(t, err)
	return id
}
