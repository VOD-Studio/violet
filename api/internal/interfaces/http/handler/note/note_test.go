package note

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appnote "blog-api/internal/application/note"
	"blog-api/internal/domain/shared"
)

// stubNoteService 记录入参并返回预设，覆盖 handler 适配逻辑。
type stubNoteService struct {
	createInput  appnote.CreateInput
	createCalled bool
	createErr    error

	updateInput  appnote.UpdateInput
	updateCalled bool
	updateErr    error

	publishID     string
	publishCalled bool

	deleteID     string
	deleteCalled bool
	deleteErr    error

	browseTag    string
	browseCursor string
	browseCalled bool

	getPublishedID string

	getID string
}

func (s *stubNoteService) Create(_ context.Context, in appnote.CreateInput) (appnote.NoteDTO, error) {
	s.createCalled = true
	s.createInput = in
	if s.createErr != nil {
		return appnote.NoteDTO{}, s.createErr
	}
	return appnote.NoteDTO{ID: "n1", Status: "draft", Tags: []string{}}, nil
}

func (s *stubNoteService) Update(_ context.Context, in appnote.UpdateInput) (appnote.NoteDTO, error) {
	s.updateCalled = true
	s.updateInput = in
	if s.updateErr != nil {
		return appnote.NoteDTO{}, s.updateErr
	}
	return appnote.NoteDTO{ID: in.NoteID, Status: "published", Tags: []string{}}, nil
}

func (s *stubNoteService) Get(_ context.Context, id string) (appnote.NoteDTO, error) {
	s.getID = id
	return appnote.NoteDTO{ID: id, Tags: []string{}}, nil
}

func (s *stubNoteService) List(_ context.Context, _ appnote.ListQuery) ([]appnote.NoteSummaryDTO, int64, error) {
	return []appnote.NoteSummaryDTO{{ID: "n1", Tags: []string{}}}, 1, nil
}

func (s *stubNoteService) Publish(_ context.Context, id string) (appnote.NoteDTO, error) {
	s.publishCalled = true
	s.publishID = id
	return appnote.NoteDTO{ID: id, Status: "published"}, nil
}

func (s *stubNoteService) Delete(_ context.Context, id string) error {
	s.deleteCalled = true
	s.deleteID = id
	return s.deleteErr
}

func (s *stubNoteService) BrowsePublished(_ context.Context, cursor string, _ int, tag string) ([]appnote.PublicNoteDTO, string, error) {
	s.browseCalled = true
	s.browseCursor = cursor
	s.browseTag = tag
	return []appnote.PublicNoteDTO{{ID: "n1", Tags: []string{}}}, "", nil
}

func (s *stubNoteService) GetPublished(_ context.Context, id string) (appnote.PublicNoteDTO, error) {
	s.getPublishedID = id
	return appnote.PublicNoteDTO{ID: id}, nil
}

func newHandlerFor(s *stubNoteService) *Handler { return &Handler{service: s} }

func perform(handler http.HandlerFunc, method, target string, body any) *httptest.ResponseRecorder {
	var req *http.Request
	if body != nil {
		raw, _ := json.Marshal(body)
		req = httptest.NewRequest(method, target, bytes.NewReader(raw))
	} else {
		req = httptest.NewRequest(method, target, nil)
	}
	rec := httptest.NewRecorder()
	handler(rec, req)
	return rec
}

func TestCreate_RequiresContentMD(t *testing.T) {
	stub := &stubNoteService{}
	rec := perform(newHandlerFor(stub).Create, http.MethodPost, "/api/v1/admin/notes", map[string]any{"title": "t"})
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.False(t, stub.createCalled)
}

func TestCreate_OptionalTitleAndTags(t *testing.T) {
	stub := &stubNoteService{}
	rec := perform(newHandlerFor(stub).Create, http.MethodPost, "/api/v1/admin/notes", map[string]any{
		"content_md": "# 正文",
		"tags":       []string{"redis"},
	})
	require.Equal(t, http.StatusCreated, rec.Code)
	assert.True(t, stub.createCalled)
	assert.Equal(t, "", stub.createInput.Title, "缺失 title 视为空标题")
	assert.Equal(t, "# 正文", stub.createInput.ContentMD)
	assert.Equal(t, []string{"redis"}, stub.createInput.Tags)
}

func TestCreate_DomainErrorMapped(t *testing.T) {
	stub := &stubNoteService{createErr: shared.BadRequest("笔记正文不能为空")}
	rec := perform(newHandlerFor(stub).Create, http.MethodPost, "/api/v1/admin/notes", map[string]any{"content_md": " "})
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUpdate_PathIDAndFullReplace(t *testing.T) {
	stub := &stubNoteService{}
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/notes/n42", bytes.NewReader(mustJSON(t, map[string]any{
		"content_md": "x", "title": "T", "tags": []string{},
	})))
	req.SetPathValue("id", "n42")
	rec := httptest.NewRecorder()
	newHandlerFor(stub).Update(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, stub.updateCalled)
	assert.Equal(t, "n42", stub.updateInput.NoteID)
}

func TestUpdate_NotFoundMapped(t *testing.T) {
	stub := &stubNoteService{updateErr: shared.NotFound("笔记")}
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/notes/missing", bytes.NewReader(mustJSON(t, map[string]any{"content_md": "x"})))
	req.SetPathValue("id", "missing")
	rec := httptest.NewRecorder()
	newHandlerFor(stub).Update(rec, req)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestPublishAndDelete(t *testing.T) {
	stub := &stubNoteService{}
	h := newHandlerFor(stub)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/notes/n7/publish", nil)
	req.SetPathValue("id", "n7")
	rec := httptest.NewRecorder()
	h.Publish(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "n7", stub.publishID)

	req = httptest.NewRequest(http.MethodDelete, "/api/v1/admin/notes/n7", nil)
	req.SetPathValue("id", "n7")
	rec = httptest.NewRecorder()
	h.Delete(rec, req)
	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.Equal(t, "n7", stub.deleteID)
}

func TestBrowsePublished_PassesCursorAndTag(t *testing.T) {
	stub := &stubNoteService{}
	rec := perform(newHandlerFor(stub).BrowsePublished, http.MethodGet, "/api/v1/notes?cursor=abc&tag=redis", nil)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, stub.browseCalled)
	assert.Equal(t, "abc", stub.browseCursor)
	assert.Equal(t, "redis", stub.browseTag)
}

func TestGetPublished_PathID(t *testing.T) {
	stub := &stubNoteService{}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/notes/n9", nil)
	req.SetPathValue("id", "n9")
	rec := httptest.NewRecorder()
	newHandlerFor(stub).GetPublished(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "n9", stub.getPublishedID)
}

func TestList_Paging(t *testing.T) {
	stub := &stubNoteService{}
	rec := perform(newHandlerFor(stub).List, http.MethodGet, "/api/v1/admin/notes?page=2&limit=5", nil)
	require.Equal(t, http.StatusOK, rec.Code)
	var envelope struct {
		Meta *struct {
			Pagination *struct {
				Page int `json:"page"`
			} `json:"pagination"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &envelope))
	assert.Equal(t, 2, envelope.Meta.Pagination.Page)
}

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return b
}
