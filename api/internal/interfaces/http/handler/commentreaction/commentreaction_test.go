// Package commentreaction 提供 commentreaction 模块的 HTTP handler 测试。
//
// handler 依赖 *appcr.Service（具体结构体）。body 解析失败的 400 路径在调用
// svc 前返回，可用 nil svc；URL 参数注入测试构造真实 Service + 手写 store stub
// 以验证路径参数正确透传。
//
// 注：任务描述中的 ToggleReaction/GetBatchReactions 对应当前 handler 的
// AddReaction（POST 写）/ GetReactionsBatch（批量 GET）。
package commentreaction

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appcr "blog-api/internal/application/commentreaction"
	domaincr "blog-api/internal/domain/commentreaction"
)

// stubCRStore 手写 stub，实现 domaincr.CommentReactionStore，记录 List 调用入参。
type stubCRStore struct {
	listResult    []domaincr.AggregatedReaction
	listCalled    bool
	listCommentID string
	listViewer    string
}

func (s *stubCRStore) ListByComment(_ context.Context, commentID, viewerUserID string) ([]domaincr.AggregatedReaction, error) {
	s.listCalled = true
	s.listCommentID = commentID
	s.listViewer = viewerUserID
	return s.listResult, nil
}
func (s *stubCRStore) Add(context.Context, string, string, string, int32) error { return nil }
func (s *stubCRStore) Remove(context.Context, string, string, string, int32) error {
	return nil
}
func (s *stubCRStore) BatchByComments(context.Context, []string, string) ([]domaincr.ReactionList, error) {
	return nil, nil
}

// 编译期断言。
var _ domaincr.CommentReactionStore = (*stubCRStore)(nil)

// TestAddReaction_EmptyBody_Returns400 空 body → json.Decode EOF → 400。
func TestAddReaction_EmptyBody_Returns400(t *testing.T) {
	h := &Handler{} // nil svc：body 解析失败在 svc 前返回

	req := httptest.NewRequest(http.MethodPost, "/comments/c1/reactions", strings.NewReader(""))
	req.SetPathValue("comment_id", "c1")
	rec := httptest.NewRecorder()
	h.AddReaction(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "BAD_REQUEST")
}

// TestAddReaction_InvalidJSON_Returns400 非法 JSON → 400。
func TestAddReaction_InvalidJSON_Returns400(t *testing.T) {
	h := &Handler{}

	req := httptest.NewRequest(http.MethodPost, "/comments/c1/reactions", strings.NewReader("{bad"))
	req.SetPathValue("comment_id", "c1")
	rec := httptest.NewRecorder()
	h.AddReaction(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "BAD_REQUEST")
}

// TestGetCommentReactions_PassesCommentID URL 路径参数 comment_id 正确注入并透传给
// service → 200，且 store 收到的 commentID 与请求一致。
func TestGetCommentReactions_PassesCommentID(t *testing.T) {
	store := &stubCRStore{listResult: []domaincr.AggregatedReaction{
		{EmojiID: 1, EmojiName: "thumbsup", Count: 3, Self: true},
	}}
	h := NewHandler(appcr.NewService(store))

	req := httptest.NewRequest(http.MethodGet, "/comments/c-123/reactions", nil)
	req.SetPathValue("comment_id", "c-123")
	rec := httptest.NewRecorder()
	h.GetCommentReactions(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	require.True(t, store.listCalled)
	assert.Equal(t, "c-123", store.listCommentID, "comment_id 路径参数应透传给 service")

	var env struct {
		Data []domaincr.AggregatedReaction `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &env))
	require.Len(t, env.Data, 1)
	assert.Equal(t, int32(1), env.Data[0].EmojiID)
	assert.Equal(t, int64(3), env.Data[0].Count)
}

// TestGetReactionsBatch_EmptyBody_Returns400 批量接口空 body → 400。
func TestGetReactionsBatch_EmptyBody_Returns400(t *testing.T) {
	h := &Handler{}

	req := httptest.NewRequest(http.MethodGet, "/comments/reactions", strings.NewReader(""))
	rec := httptest.NewRecorder()
	h.GetReactionsBatch(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "BAD_REQUEST")
}
