package gorm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	apppost "blog-api/internal/application/post"
	"blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	posthttp "blog-api/internal/interfaces/http/handler/post"
)

type viewPermission struct {
	allowed bool
	codes   []string
}

func (p *viewPermission) HasPermission(_ string, _ bool, codes ...string) bool {
	p.codes = codes
	return p.allowed
}

func TestPostViewsPagingIsolationAndHTTP(t *testing.T) {
	db := setupPostTestDB(t)
	ctx := context.Background()
	articleID, otherID := shared.NewID(), shared.NewID()
	for i, id := range []shared.ID{articleID, otherID} {
		require.NoError(t, db.Create(&model.Post{ID: id.UUID(), AuthorID: shared.NewID().UUID(), Title: "article", Slug: []string{"views-a", "views-b"}[i], Status: "published", ViewCount: 100}).Error)
	}
	at := time.Date(2026, 11, 17, 10, 0, 0, 0, time.UTC)
	rows := []model.PostView{
		{ID: 3, PostID: articleID.UUID(), CreatedAt: at, IPAddress: "192.0.2.3", UserAgent: "agent-three"},
		{ID: 1, PostID: articleID.UUID(), CreatedAt: at, IPAddress: "192.0.2.1", UserAgent: "agent-one"},
		{ID: 2, PostID: otherID.UUID(), CreatedAt: at.Add(time.Hour), IPAddress: "192.0.2.2"},
		{ID: 4, PostID: articleID.UUID(), CreatedAt: at.Add(-time.Hour)},
	}
	require.NoError(t, db.Create(&rows).Error)
	repo := NewPostViewRepository(db)
	first, err := repo.FindPage(ctx, articleID, shared.PageQuery{Page: 1, Limit: 1})
	require.NoError(t, err)
	require.EqualValues(t, 3, first.Total)
	require.EqualValues(t, 1, first.Items[0].ID)
	second, err := repo.FindPage(ctx, articleID, shared.PageQuery{Page: 2, Limit: 1})
	require.NoError(t, err)
	require.EqualValues(t, 3, second.Items[0].ID)
	third, err := repo.FindPage(ctx, articleID, shared.PageQuery{Page: 3, Limit: 1})
	require.NoError(t, err)
	require.EqualValues(t, 4, third.Items[0].ID)
	empty, err := repo.FindPage(ctx, articleID, shared.PageQuery{Page: 4, Limit: 1})
	require.NoError(t, err)
	require.Empty(t, empty.Items)
	require.EqualValues(t, 3, empty.Total)
	require.NoError(t, db.Where("post_id = ?", otherID.UUID()).Delete(&model.PostView{}).Error)
	noViews, err := repo.FindPage(ctx, otherID, shared.PageQuery{})
	require.NoError(t, err)
	require.Empty(t, noViews.Items)
	require.Zero(t, noViews.Total)

	perm := &viewPermission{}
	handler := posthttp.NewHandler(nil, nil, apppost.NewViewQuery(repo, perm))
	request := func(id string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodGet, "/admin/posts/"+id+"/views?page=2&limit=1", nil)
		r.SetPathValue("id", id)
		w := httptest.NewRecorder()
		handler.ListViews(w, r)
		return w
	}
	require.Equal(t, http.StatusForbidden, request(articleID.String()).Code)
	require.Equal(t, []string{"post:view"}, perm.codes)
	perm.allowed = true
	response := request(articleID.String())
	require.Equal(t, http.StatusOK, response.Code)
	var body struct {
		Data []apppost.ViewDTO `json:"data"`
		Meta struct {
			Pagination struct {
				Total int64 `json:"total"`
				Page  int   `json:"page"`
			} `json:"pagination"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
	require.Len(t, body.Data, 1)
	require.Equal(t, "3", body.Data[0].ID)
	require.Equal(t, "agent-three", body.Data[0].UserAgent)
	require.EqualValues(t, 3, body.Meta.Pagination.Total)
	require.Equal(t, 2, body.Meta.Pagination.Page)
	require.Equal(t, http.StatusBadRequest, request("invalid").Code)

	require.NoError(t, db.Delete(&model.Post{}, "id = ?", articleID.UUID()).Error)
	require.Equal(t, http.StatusOK, request(articleID.String()).Code, "回收站仍可查看")
	var stored model.Post
	require.NoError(t, db.Unscoped().First(&stored, "id = ?", articleID.UUID()).Error)
	require.Equal(t, 100, stored.ViewCount, "只读查询不更改累计量")
	require.NoError(t, db.Unscoped().Delete(&model.Post{}, "id = ?", articleID.UUID()).Error)
	require.Equal(t, http.StatusNotFound, request(articleID.String()).Code, "即便有残留事件也不能读取丢失文章")
	_, err = repo.FindPage(ctx, shared.NewID(), shared.PageQuery{})
	require.ErrorIs(t, err, post.ErrNotFound)
}
