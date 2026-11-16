package gorm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	apppost "blog-api/internal/application/post"
	"blog-api/internal/domain/post"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	posthttp "blog-api/internal/interfaces/http/handler/post"
)

func seedPublicBrowsePosts(t *testing.T, db *gorm.DB, authorID domainshared.ID) []model.Post {
	t.Helper()
	empty, canonical := "", "https://example.com/source"
	old := time.Date(2023, 4, 5, 12, 0, 0, 0, time.UTC)
	featured := time.Date(2024, 4, 5, 12, 0, 0, 0, time.UTC)
	recent := time.Date(2025, 4, 5, 12, 0, 0, 0, time.UTC)
	hidden := time.Date(2026, 4, 5, 12, 0, 0, 0, time.UTC)
	tags := []model.Tag{
		{Name: "Go", Slug: "go"},
		{Name: "Web", Slug: "web"},
		{Name: "Hidden", Slug: "hidden"},
		{Name: "Unused", Slug: "unused"},
	}
	require.NoError(t, db.Create(&tags).Error)
	posts := []model.Post{
		{ID: uuid.MustParse("00000000-0000-4000-8000-000000000001"), Slug: "original-null", Status: "published", PublishedAt: &featured, IsFeatured: true, Tags: tags[:1]},
		{ID: uuid.MustParse("00000000-0000-4000-8000-000000000002"), Slug: "original-empty", Status: "published", PublishedAt: &recent, CanonicalURL: &empty, Tags: tags[:1]},
		{ID: uuid.MustParse("00000000-0000-4000-8000-000000000003"), Slug: "repost-go", Status: "published", PublishedAt: &recent, CanonicalURL: &canonical, Tags: tags[:2]},
		{ID: uuid.MustParse("00000000-0000-4000-8000-000000000004"), Slug: "repost-web", Status: "published", PublishedAt: &old, CanonicalURL: &canonical, Tags: tags[1:2]},
		{ID: uuid.MustParse("00000000-0000-4000-8000-000000000005"), Slug: "draft", Status: "draft", PublishedAt: &hidden, Tags: tags[2:3]},
		{ID: uuid.MustParse("00000000-0000-4000-8000-000000000006"), Slug: "deleted", Status: "published", PublishedAt: &hidden, Tags: []model.Tag{tags[0], tags[2]}, DeletedAt: gorm.DeletedAt{Time: hidden, Valid: true}},
		{ID: uuid.MustParse("00000000-0000-4000-8000-000000000007"), Slug: "archived", Status: "archived", PublishedAt: &hidden, CanonicalURL: &canonical, Tags: tags[2:3]},
	}
	for i := range posts {
		posts[i].Title = posts[i].Slug
		posts[i].AuthorID = authorID.UUID()
		require.NoError(t, db.Create(&posts[i]).Error)
	}
	return posts
}

func assertPublicPostBrowse(t *testing.T, db *gorm.DB) {
	t.Helper()
	repo := NewPostRepository(db)
	ctx := context.Background()
	for _, tc := range []struct {
		name   string
		source string
		tag    string
		want   []string
	}{
		{name: "旧合同", want: []string{"original-null", "repost-go", "original-empty", "repost-web"}},
		{name: "显式全部", source: "all", want: []string{"original-null", "repost-go", "original-empty", "repost-web"}},
		{name: "原创包括空值", source: "original", tag: "go", want: []string{"original-null", "original-empty"}},
		{name: "转载与标签交集", source: "repost", tag: "go", want: []string{"repost-go"}},
		{name: "仅标签", tag: "web", want: []string{"repost-go", "repost-web"}},
		{name: "隐藏标签无公开文章", tag: "hidden", want: []string{}},
		{name: "来源与标签不相交", source: "original", tag: "web", want: []string{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			filter := post.ListFilter{Status: post.StatusPublished, Source: tc.source, Sort: post.SortPublished}
			if tc.tag != "" {
				filter.Tags = []string{tc.tag}
			}
			got := make([]string, 0, len(tc.want))
			for page := 1; page <= len(tc.want)+1; page++ {
				result, err := repo.FindPage(ctx, filter, domainshared.PageQuery{Page: page, Limit: 1})
				require.NoError(t, err)
				assert.Equal(t, int64(len(tc.want)), result.Total)
				assert.Equal(t, page, result.Page)
				assert.Equal(t, 1, result.Limit)
				if page > len(tc.want) {
					assert.Empty(t, result.Items)
					continue
				}
				require.Len(t, result.Items, 1)
				got = append(got, result.Items[0].Slug())
			}
			assert.Equal(t, tc.want, got)
		})
	}
	for _, tc := range []struct {
		source string
		want   []post.TagCount
	}{
		{source: "", want: []post.TagCount{{Slug: "go", Name: "Go", Count: 3}, {Slug: "web", Name: "Web", Count: 2}}},
		{source: "all", want: []post.TagCount{{Slug: "go", Name: "Go", Count: 3}, {Slug: "web", Name: "Web", Count: 2}}},
		{source: "original", want: []post.TagCount{{Slug: "go", Name: "Go", Count: 2}}},
		{source: "repost", want: []post.TagCount{{Slug: "web", Name: "Web", Count: 2}, {Slug: "go", Name: "Go", Count: 1}}},
	} {
		counts, err := repo.FindPublishedTagCounts(ctx, tc.source)
		require.NoError(t, err)
		assert.Equal(t, tc.want, counts)
	}
}

func TestPostRepository_PublicBrowse(t *testing.T) {
	db := setupPostTestDB(t)
	seedPublicBrowsePosts(t, db, domainshared.NewID())
	assertPublicPostBrowse(t, db)
}

func TestPostRepository_PublicBrowseDuplicateTags(t *testing.T) {
	db := setupPostTestDB(t)
	// 生产表的主键阻止重复；这里刻意构造历史脏关联，验证读侧去重口径。
	require.NoError(t, db.Exec("DROP TABLE post_tags").Error)
	require.NoError(t, db.Exec("CREATE TABLE post_tags (post_id TEXT NOT NULL, tag_id INTEGER NOT NULL)").Error)
	posts := seedPublicBrowsePosts(t, db, domainshared.NewID())
	require.NoError(t, db.Exec("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", posts[0].ID, posts[0].Tags[0].ID).Error)
	assertPublicPostBrowse(t, db)
}

func TestPostPublicBrowseHTTP(t *testing.T) {
	db := setupPostTestDB(t)
	seedPublicBrowsePosts(t, db, domainshared.NewID())
	h := posthttp.NewHandler(apppost.NewService(NewPostRepository(db), nil, nil, nil, nil, nil))
	for _, tc := range []struct {
		query string
		want  string
		total int64
	}{
		{query: "?limit=1", want: "original-null", total: 4},
		{query: "?source=all&limit=1&page=2", want: "repost-go", total: 4},
		{query: "?source=original&tag=go&limit=1&page=2", want: "original-empty", total: 2},
		{query: "?source=repost&tag=go", want: "repost-go", total: 1},
	} {
		w := httptest.NewRecorder()
		h.ListPublished(w, httptest.NewRequest(http.MethodGet, "/posts"+tc.query, nil))
		require.Equal(t, http.StatusOK, w.Code, w.Body.String())
		var body struct {
			Data []apppost.PostListItemDTO `json:"data"`
			Meta struct {
				Pagination struct {
					Total int64 `json:"total"`
				} `json:"pagination"`
			} `json:"meta"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		require.Len(t, body.Data, 1)
		assert.Equal(t, tc.want, body.Data[0].Slug)
		assert.Equal(t, tc.total, body.Meta.Pagination.Total)
		switch tc.want {
		case "original-null":
			assert.Nil(t, body.Data[0].CanonicalURL)
			assert.NotContains(t, w.Body.String(), `"canonical_url"`)
		case "original-empty":
			require.NotNil(t, body.Data[0].CanonicalURL)
			assert.Empty(t, *body.Data[0].CanonicalURL)
		case "repost-go":
			require.NotNil(t, body.Data[0].CanonicalURL)
			assert.Equal(t, "https://example.com/source", *body.Data[0].CanonicalURL)
		}
	}
	w := httptest.NewRecorder()
	h.FilterTags(w, httptest.NewRequest(http.MethodGet, "/posts/filters/tags?source=repost&tag=hidden", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var tags struct {
		Data []apppost.PublishedTagDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &tags))
	assert.Equal(t, []apppost.PublishedTagDTO{{Slug: "web", Name: "Web", Count: 2}, {Slug: "go", Name: "Go", Count: 1}}, tags.Data)
}

func TestPostRepository_PublicTagCountsEmptyAndTie(t *testing.T) {
	db := setupPostTestDB(t)
	repo := NewPostRepository(db)
	ctx := context.Background()
	counts, err := repo.FindPublishedTagCounts(ctx, "")
	require.NoError(t, err)
	assert.Equal(t, []post.TagCount{}, counts)

	now := time.Now()
	p := model.Post{
		ID: uuid.New(), AuthorID: uuid.New(), Title: "公开文章", Slug: "visible",
		Status: "published", PublishedAt: &now,
		Tags: []model.Tag{{Name: "Zeta", Slug: "zeta"}, {Name: "Alpha", Slug: "alpha"}},
	}
	require.NoError(t, db.Create(&p).Error)
	counts, err = repo.FindPublishedTagCounts(ctx, "original")
	require.NoError(t, err)
	assert.Equal(t, []post.TagCount{
		{Slug: "alpha", Name: "Alpha", Count: 1},
		{Slug: "zeta", Name: "Zeta", Count: 1},
	}, counts)

	h := posthttp.NewHandler(apppost.NewService(repo, nil, nil, nil, nil, nil))
	w := httptest.NewRecorder()
	h.FilterTags(w, httptest.NewRequest(http.MethodGet, "/posts/filters/tags?source=repost", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	assert.JSONEq(t, `{"data":[]}`, w.Body.String())
}
