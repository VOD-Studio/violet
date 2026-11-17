package post

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	apppost "blog-api/internal/application/post"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

type orderHTTPRepository struct {
	err    error
	called bool
}

func (r *orderHTTPRepository) Reorder(context.Context, []shared.ID, []shared.ID) error {
	r.called = true
	return r.err
}

func TestReorderHTTP(t *testing.T) {
	body := `{"expected_ids":["00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002"],"ids":["00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000001"]}`
	for _, tc := range []struct {
		name   string
		body   string
		root   bool
		err    error
		status int
		called bool
	}{
		{"anonymous denied", body, false, nil, http.StatusForbidden, false},
		{"malformed json", "{", true, nil, http.StatusBadRequest, false},
		{"invalid set", `{"ids":[]}`, true, nil, http.StatusBadRequest, false},
		{"stale", body, true, shared.Conflict("顺序已变化"), http.StatusConflict, true},
		{"saved", body, true, nil, http.StatusOK, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &orderHTTPRepository{err: tc.err}
			h := NewHandler(nil, apppost.NewOrderService(repo, nil), nil)
			r := newJSONRequest(http.MethodPost, "/admin/posts/reorder", tc.body)
			r = r.WithContext(context.WithValue(r.Context(), middleware.UserIsRootKey, tc.root))
			w := httptest.NewRecorder()
			h.Reorder(w, r)
			assert.Equal(t, tc.status, w.Code, w.Body.String())
			assert.Equal(t, tc.called, repo.called)
			if tc.status != http.StatusOK {
				assert.NotContains(t, w.Body.String(), "文章顺序已保存")
			}
		})
	}
}
