package gorm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	apppost "blog-api/internal/application/post"
	appseries "blog-api/internal/application/series"
	"blog-api/internal/domain/post"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	posthttp "blog-api/internal/interfaces/http/handler/post"
	serieshttp "blog-api/internal/interfaces/http/handler/series"
)

func TestPostRepositoryIntegration_PublicBrowse(t *testing.T) {
	db := setupIntegrationDB(t)
	seedPublicBrowsePosts(t, db, preseedAuthor(t, db))
	assertPublicPostBrowse(t, db)
	repo := NewPostRepository(db)
	ctx := context.Background()
	for _, tc := range []struct {
		name      string
		filter    post.BrowseFilter
		years     []int
		posts2025 []string
	}{
		{name: "旧合同", years: []int{2025, 2024, 2023}, posts2025: []string{"repost-go", "original-empty"}},
		{name: "显式全部", filter: post.BrowseFilter{Source: "all"}, years: []int{2025, 2024, 2023}, posts2025: []string{"repost-go", "original-empty"}},
		{name: "原创标签", filter: post.BrowseFilter{Tag: "go", Source: "original"}, years: []int{2025, 2024}, posts2025: []string{"original-empty"}},
		{name: "转载标签", filter: post.BrowseFilter{Tag: "go", Source: "repost"}, years: []int{2025}, posts2025: []string{"repost-go"}},
		{name: "单标签", filter: post.BrowseFilter{Tag: "web"}, years: []int{2025, 2023}, posts2025: []string{"repost-go"}},
		{name: "空交集", filter: post.BrowseFilter{Tag: "web", Source: "original"}, years: []int{}, posts2025: []string{}},
		{name: "仅隐藏文章", filter: post.BrowseFilter{Tag: "hidden"}, years: []int{}, posts2025: []string{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			years, err := repo.FindArchiveYears(ctx, tc.filter)
			require.NoError(t, err)
			assert.Equal(t, tc.years, years)
			posts, err := repo.FindPublishedByYear(ctx, 2025, tc.filter)
			require.NoError(t, err)
			slugs := make([]string, 0, len(posts))
			for _, p := range posts {
				slugs = append(slugs, p.Slug())
			}
			assert.Equal(t, tc.posts2025, slugs)
		})
	}

	h := posthttp.NewHandler(apppost.NewService(repo, nil, nil, nil, nil, nil))
	w := httptest.NewRecorder()
	h.ArchiveYears(w, httptest.NewRequest(http.MethodGet, "/posts/archive?tag=go&source=repost", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	assert.JSONEq(t, `{"data":{"years":[2025]}}`, w.Body.String())
	w = httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/posts/archive/2025?tag=go&source=original", nil)
	r.SetPathValue("year", "2025")
	h.ArchiveByYear(w, r)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var body struct {
		Data apppost.ArchiveYearDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, 2025, body.Data.Year)
	assert.Equal(t, 1, body.Data.Count)
	require.Len(t, body.Data.Items, 1)
	assert.Equal(t, "original-empty", body.Data.Items[0].Slug)
}

func seedPublicBrowseSeries(t *testing.T, db *gorm.DB, authorID domainshared.ID, posts []model.Post) {
	t.Helper()
	created := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	books := []model.Series{
		{Slug: "mixed", Status: "published"},
		{Slug: "original", Status: "published"},
		{Slug: "empty", Status: "published"},
		{Slug: "draft-book", Status: "draft"},
		{Slug: "hidden-chapters", Status: "published"},
		{Slug: "deleted-chapters", Status: "published"},
	}
	for i := range books {
		books[i].ID = uuid.MustParse(fmt.Sprintf("00000000-0000-4000-8000-%012d", 101+i))
		books[i].AuthorID = authorID.UUID()
		books[i].Title = books[i].Slug
		books[i].CreatedAt, books[i].UpdatedAt = created, created
		require.NoError(t, db.Create(&books[i]).Error)
	}
	for _, assignment := range []struct{ post, book, order int }{
		{post: 0, book: 0, order: 0},
		{post: 2, book: 0, order: 1},
		{post: 1, book: 1, order: 0},
		{post: 3, book: 3, order: 0},
		{post: 4, book: 4, order: 0},
		{post: 6, book: 4, order: 1},
		{post: 5, book: 5, order: 0},
	} {
		require.NoError(t, db.Unscoped().Model(&model.Post{}).Where("id = ?", posts[assignment.post].ID).
			Updates(map[string]any{"series_id": books[assignment.book].ID, "chapter_order": assignment.order}).Error)
	}
}

func TestSeriesRepositoryIntegration_PublicBrowse(t *testing.T) {
	db := setupIntegrationDB(t)
	authorID := preseedAuthor(t, db)
	posts := seedPublicBrowsePosts(t, db, authorID)
	seedPublicBrowseSeries(t, db, authorID, posts)
	repo := NewSeriesRepository(db)
	ctx := context.Background()
	for _, tc := range []struct {
		name   string
		filter post.BrowseFilter
		want   []string
	}{
		{name: "旧合同包含空书", want: []string{"deleted-chapters", "hidden-chapters", "empty", "original", "mixed"}},
		{name: "显式全部包含空书", filter: post.BrowseFilter{Source: "all"}, want: []string{"deleted-chapters", "hidden-chapters", "empty", "original", "mixed"}},
		{name: "原创章节", filter: post.BrowseFilter{Source: "original"}, want: []string{"original", "mixed"}},
		{name: "原创和标签", filter: post.BrowseFilter{Tag: "go", Source: "original"}, want: []string{"original", "mixed"}},
		{name: "转载和标签", filter: post.BrowseFilter{Tag: "web", Source: "repost"}, want: []string{"mixed"}},
		{name: "仅标签", filter: post.BrowseFilter{Tag: "go"}, want: []string{"original", "mixed"}},
		{name: "仅隐藏章节不匹配", filter: post.BrowseFilter{Tag: "hidden"}, want: []string{}},
		{name: "两个条件必须命中同一章节", filter: post.BrowseFilter{Tag: "web", Source: "original"}, want: []string{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := make([]string, 0, len(tc.want))
			for page := 1; page <= len(tc.want)+1; page++ {
				result, err := repo.FindPublishedPage(ctx, tc.filter, domainshared.PageQuery{Page: page, Limit: 1})
				require.NoError(t, err)
				assert.Equal(t, int64(len(tc.want)), result.Total)
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

	h := serieshttp.NewHandler(appseries.NewService(repo, nil))
	w := httptest.NewRecorder()
	h.ListPublished(w, httptest.NewRequest(http.MethodGet, "/series?tag=web&source=repost&limit=1", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var body struct {
		Data []appseries.SeriesDTO `json:"data"`
		Meta struct {
			Pagination struct {
				Total int64 `json:"total"`
			} `json:"pagination"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Len(t, body.Data, 1)
	assert.Equal(t, "mixed", body.Data[0].Slug)
	assert.Equal(t, int64(2), body.Data[0].ChapterCount, "匹配一章仍返回整书两篇公开章节")
	assert.Equal(t, int64(1), body.Meta.Pagination.Total)
}
