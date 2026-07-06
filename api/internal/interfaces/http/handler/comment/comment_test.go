// Package comment 提供 comment 模块的 HTTP handler 测试。
//
// 这是全仓首份 handler 层测试（httptest seam），定型了以下模式：
//   - stub service：手写实现 commentService 接口，不引 mock 框架
//   - stub auth context：用 middleware.UserIDKey 注入登录态，模拟认证中间件效果
//   - 直接调 handler 方法 + httptest.NewRecorder 断言状态码/响应体
package comment

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appcomment "blog-api/internal/application/comment"
	domaincomment "blog-api/internal/domain/comment"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/middleware"
)

// stubCommentService 手写 stub，记录调用入参供断言。
type stubCommentService struct {
	listByPostViewer       string
	listByPostAnchorFilter domaincomment.AnchorFilter
	listByPostCalled       bool
	listByPostResult       []appcomment.CommentDTO

	// 后台 ListAll/ListPending 的 anchor 透传记录（Issue-0008）
	listAllAnchorFilter     domaincomment.AnchorFilter
	listAllCalled           bool
	listAllResult           []appcomment.AdminCommentDTO
	listPendingAnchorFilter domaincomment.AnchorFilter
	listPendingCalled       bool

	// ListReplies 的 sort 透传记录
	listRepliesCalled bool
	listRepliesSort   string
	listRepliesResult []appcomment.CommentDTO

	createInput      appcomment.CreateInput
	createCalled     bool
	createErr        error
	createResult     appcomment.CommentDTO

	sendCodeInput  appcomment.SendCodeInput
	sendCodeErr    error
	sendCodeCalled bool
}

func (s *stubCommentService) ListByPost(ctx context.Context, postID, viewerUserID, postAuthorID string, anchorFilter domaincomment.AnchorFilter, depthFilter domaincomment.DepthFilter, page, limit int) ([]appcomment.CommentDTO, int64, error) {
	s.listByPostCalled = true
	s.listByPostViewer = viewerUserID
	s.listByPostAnchorFilter = anchorFilter
	return s.listByPostResult, int64(len(s.listByPostResult)), nil
}

// ListReplies stub：记录调用入参供 sort 透传断言。
func (s *stubCommentService) ListReplies(_ context.Context, _ string, _ string, sort string, _ int, _ int) ([]appcomment.CommentDTO, int64, error) {
	s.listRepliesCalled = true
	s.listRepliesSort = sort
	return s.listRepliesResult, int64(len(s.listRepliesResult)), nil
}

func (s *stubCommentService) Create(ctx context.Context, in appcomment.CreateInput) (appcomment.CommentDTO, error) {
	s.createCalled = true
	s.createInput = in
	return s.createResult, s.createErr
}

func (s *stubCommentService) SendCode(ctx context.Context, in appcomment.SendCodeInput) error {
	s.sendCodeCalled = true
	s.sendCodeInput = in
	return s.sendCodeErr
}

// 以下方法本测试不关心入参细节，但记录调用情况供 ListAll/ListPending 透传断言（Issue-0008）。
func (s *stubCommentService) ListPending(_ context.Context, anchorFilter domaincomment.AnchorFilter, _ int, _ int) ([]appcomment.CommentDTO, int64, error) {
	s.listPendingCalled = true
	s.listPendingAnchorFilter = anchorFilter
	return nil, 0, nil
}
func (s *stubCommentService) ListAll(_ context.Context, _ string, anchorFilter domaincomment.AnchorFilter, _ int, _ int) ([]appcomment.AdminCommentDTO, int64, error) {
	s.listAllCalled = true
	s.listAllAnchorFilter = anchorFilter
	return s.listAllResult, int64(len(s.listAllResult)), nil
}
func (s *stubCommentService) CountPending(context.Context) (int64, error)               { return 0, nil }
func (s *stubCommentService) GetDetail(context.Context, string) (appcomment.AdminCommentDTO, error) {
	return appcomment.AdminCommentDTO{}, nil
}
func (s *stubCommentService) BatchUpdateStatus(context.Context, []string, string) (int64, error) {
	return 0, nil
}
func (s *stubCommentService) Approve(context.Context, string) error { return nil }
func (s *stubCommentService) MarkSpam(context.Context, string) error { return nil }
func (s *stubCommentService) Delete(context.Context, string) error   { return nil }

// newHandlerWithStub 构造带 stub service 的 handler（users/posts 为 nil，登录路径测试另加）。
func newHandlerWithStub(svc *stubCommentService) *Handler {
	// NewHandler 收 *appcomment.Service；测试用 stub，直接构造 Handler 结构体绕过。
	return &Handler{svc: svc, users: nil, posts: nil, validate: validator.New()}
}

// newJSONRequest 测试辅助：构造带 JSON body 的请求。
func newJSONRequest(t *testing.T, method, target, body string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(method, target, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

// withViewer 注入登录态（模拟认证中间件）。
func withViewer(req *http.Request, userID string) *http.Request {
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	return req.WithContext(ctx)
}

// setPostID 模拟 chi 路径参数。
func setPostID(req *http.Request, postID string) *http.Request {
	req.SetPathValue("postId", postID)
	return req
}

// =====================================================================
// ListByPost 黑洞模式：匿名 viewer → 空；登录 viewer → 透传 viewer 给 service
// =====================================================================

func TestListByPost_AnonViewer_PassesEmptyViewer(t *testing.T) {
	svc := &stubCommentService{}
	h := newHandlerWithStub(svc)

	req := setPostID(newJSONRequest(t, "GET", "/posts/abc/comments", ""), "post-1")
	rr := httptest.NewRecorder()
	h.ListByPost(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.True(t, svc.listByPostCalled)
	assert.Empty(t, svc.listByPostViewer, "匿名 viewer 应传空字符串触发 service 黑洞模式")
}

func TestListByPost_LoggedInViewer_PassesUserID(t *testing.T) {
	svc := &stubCommentService{listByPostResult: []appcomment.CommentDTO{{ID: "c1"}}}
	h := newHandlerWithStub(svc)

	req := setPostID(newJSONRequest(t, "GET", "/posts/abc/comments", ""), "post-1")
	viewerID := domainshared.NewID()
	req = withViewer(req, viewerID.String())
	rr := httptest.NewRecorder()
	h.ListByPost(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, viewerID.String(), svc.listByPostViewer)
}

// TestListByPost_TypeQueryParam_PassthroughAndDefault 验证 ?type= query param 映射：
//   - 缺省 → AnchorFilterFree（保守默认，避免误返批注到评论区）
//   - ?type=annotation → AnchorFilterAnnotation
//   - ?type=all → AnchorFilterAll
//   - ?type=unknown → AnchorFilterFree（降级）
func TestListByPost_TypeQueryParam_PassthroughAndDefault(t *testing.T) {
	cases := []struct {
		query   string
		expect  domaincomment.AnchorFilter
		desc    string
	}{
		{"", domaincomment.AnchorFilterFree, "缺省 type 默认 free"},
		{"?type=free", domaincomment.AnchorFilterFree, "显式 free"},
		{"?type=annotation", domaincomment.AnchorFilterAnnotation, "annotation 透传"},
		{"?type=all", domaincomment.AnchorFilterAll, "all 透传"},
		{"?type=unknown", domaincomment.AnchorFilterFree, "未知值降级为 free"},
	}
	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			svc := &stubCommentService{}
			h := newHandlerWithStub(svc)
			req := setPostID(newJSONRequest(t, "GET", "/posts/abc/comments"+c.query, ""), "post-1")
			rr := httptest.NewRecorder()
			h.ListByPost(rr, req)
			require.Equal(t, http.StatusOK, rr.Code)
			require.True(t, svc.listByPostCalled)
			assert.Equal(t, c.expect, svc.listByPostAnchorFilter)
		})
	}
}

// =====================================================================
// ListAll（后台）type query param 透传：缺省默认 All（与前台 ListByPost 默认 free 区分）
// =====================================================================

// TestListAll_TypeQueryParam_PassthroughAndDefault 验证后台 ListAll 的 ?type= 映射：
//   - 缺省 → AnchorFilterAll（后台要看全部，与前台 ListByPost 默认 free 区分）
//   - ?type=annotation → AnchorFilterAnnotation
//   - ?type=free → AnchorFilterFree
//   - ?type=unknown → AnchorFilterAll（降级，后台保守显示全部）
func TestListAll_TypeQueryParam_PassthroughAndDefault(t *testing.T) {
	cases := []struct {
		query  string
		expect domaincomment.AnchorFilter
		desc   string
	}{
		{"", domaincomment.AnchorFilterAll, "缺省 type 默认 all"},
		{"?type=free", domaincomment.AnchorFilterFree, "显式 free"},
		{"?type=annotation", domaincomment.AnchorFilterAnnotation, "annotation 透传"},
		{"?type=all", domaincomment.AnchorFilterAll, "all 透传"},
		{"?type=unknown", domaincomment.AnchorFilterAll, "未知值降级为 all"},
	}
	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			svc := &stubCommentService{}
			h := newHandlerWithStub(svc)
			req := httptest.NewRequest("GET", "/admin/comments"+c.query, nil)
			rr := httptest.NewRecorder()
			h.ListAll(rr, req)
			require.Equal(t, http.StatusOK, rr.Code)
			require.True(t, svc.listAllCalled)
			assert.Equal(t, c.expect, svc.listAllAnchorFilter)
		})
	}
}

// =====================================================================
// ListReplies 回复列表：sort query param 透传 + 默认 asc
// =====================================================================

func TestListReplies_SortQueryParam_PassthroughAndDefault(t *testing.T) {
	cases := []struct {
		query  string
		expect string
		desc   string
	}{
		{"", "asc", "缺省 sort 默认 asc"},
		{"?sort=asc", "asc", "显式 asc"},
		{"?sort=desc", "desc", "desc 透传"},
	}
	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			svc := &stubCommentService{}
			h := newHandlerWithStub(svc)
			req := httptest.NewRequest("GET", "/comments/abc/replies"+c.query, nil)
			req.SetPathValue("commentId", "abc")
			rr := httptest.NewRecorder()
			h.ListReplies(rr, req)
			require.Equal(t, http.StatusOK, rr.Code)
			require.True(t, svc.listRepliesCalled)
			assert.Equal(t, c.expect, svc.listRepliesSort)
		})
	}
}

// =====================================================================
// Create 双轨认证
// =====================================================================

func TestCreate_AnonWithValidPayload_PassesAnonInput(t *testing.T) {
	svc := &stubCommentService{}
	h := newHandlerWithStub(svc)

	body := `{"body":"hi","author_name":"alice","author_email":"alice@x.com","code":"123456"}`
	req := setPostID(newJSONRequest(t, "POST", "/posts/abc/comments", body), "post-1")
	rr := httptest.NewRecorder()
	h.Create(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code, "匿名合法评论应 201")
	require.True(t, svc.createCalled)
	assert.Empty(t, svc.createInput.UserID, "匿名 UserID 应为空")
	assert.Equal(t, "alice", svc.createInput.AuthorName)
	assert.Equal(t, "alice@x.com", svc.createInput.AuthorEmail)
	assert.Equal(t, "123456", svc.createInput.Code)
	assert.NotEmpty(t, svc.createInput.IPHash, "ip_hash 应被 handler 填充")
}

func TestCreate_AnonMissingName_Returns400(t *testing.T) {
	svc := &stubCommentService{}
	h := newHandlerWithStub(svc)

	body := `{"body":"hi","author_email":"alice@x.com","code":"123456"}`
	req := setPostID(newJSONRequest(t, "POST", "/posts/abc/comments", body), "post-1")
	rr := httptest.NewRecorder()
	h.Create(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.False(t, svc.createCalled, "校验失败不应调 service")
}

func TestCreate_AnonWithAnchor_Returns401(t *testing.T) {
	svc := &stubCommentService{}
	h := newHandlerWithStub(svc)

	body := `{"body":"hi","author_name":"alice","author_email":"alice@x.com","code":"123456",` +
		`"anchor":{"block_id":"abc12345","start_offset":0,"end_offset":5,"selected_text":"hello","block_text_hash":"deadbeef"}}`
	req := setPostID(newJSONRequest(t, "POST", "/posts/abc/comments", body), "post-1")
	rr := httptest.NewRecorder()
	h.Create(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code, "匿名带 anchor 必须 401（批注强制登录）")
	assert.False(t, svc.createCalled, "401 不应调 service")
}

// TestCreate_AnonWithParentID_Returns401 回复强制登录：匿名带 parent_id → 401。
// 和批注强制登录同语义，避免匿名借回复绕过「一文一次」配额刷屏。
func TestCreate_AnonWithParentID_Returns401(t *testing.T) {
	svc := &stubCommentService{}
	h := newHandlerWithStub(svc)

	body := `{"body":"hi","author_name":"alice","author_email":"alice@x.com","code":"123456","parent_id":"some-parent-id"}`
	req := setPostID(newJSONRequest(t, "POST", "/posts/abc/comments", body), "post-1")
	rr := httptest.NewRecorder()
	h.Create(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code, "匿名带 parent_id 必须 401（回复强制登录）")
	assert.False(t, svc.createCalled, "401 不应调 service")
}

func TestCreate_LoggedIn_PassesUserIDAndIgnoresRequestAuthorFields(t *testing.T) {
	svc := &stubCommentService{}
	// 登录路径需要 users repo 填资料；这里用一个 nil users 的 handler，
	// 验证「登录时请求体的 author_name 被忽略、UserID 被透传」。
	// users 为 nil 时 handler 不查资料，AuthorName 留空——本测试只验透传与忽略。
	h := &Handler{svc: svc, users: nil, posts: nil, validate: validator.New()}

	body := `{"body":"hi","author_name":"FAKE"}`
	req := setPostID(newJSONRequest(t, "POST", "/posts/abc/comments", body), "post-1")
	viewerID := domainshared.NewID()
	req = withViewer(req, viewerID.String())
	rr := httptest.NewRecorder()
	h.Create(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code, "登录合法评论应 201")
	require.True(t, svc.createCalled)
	assert.Equal(t, viewerID.String(), svc.createInput.UserID)
	assert.Empty(t, svc.createInput.AuthorName, "登录态应忽略请求体 author_name（防伪造）；users 为 nil 时留空")
}

// =====================================================================
// SendCode
// =====================================================================

func TestSendCode_ValidEmail_CallsService(t *testing.T) {
	svc := &stubCommentService{}
	h := newHandlerWithStub(svc)

	body := `{"email":"alice@x.com"}`
	req := setPostID(newJSONRequest(t, "POST", "/posts/abc/comments/code", body), "post-1")
	rr := httptest.NewRecorder()
	h.SendCode(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	require.True(t, svc.sendCodeCalled)
	assert.Equal(t, "alice@x.com", svc.sendCodeInput.Email)
}

func TestSendCode_InvalidEmail_Returns400(t *testing.T) {
	svc := &stubCommentService{}
	h := newHandlerWithStub(svc)

	body := `{"email":"not-an-email"}`
	req := setPostID(newJSONRequest(t, "POST", "/posts/abc/comments/code", body), "post-1")
	rr := httptest.NewRecorder()
	h.SendCode(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.False(t, svc.sendCodeCalled)
}

// TestCreate_LoggedIn_PassesAnchorAndPictures 登录态带 anchor+pictures 应透传给 service（Issue-0003）。
func TestCreate_LoggedIn_PassesAnchorAndPictures(t *testing.T) {
	svc := &stubCommentService{}
	h := &Handler{svc: svc, users: nil, posts: nil, validate: validator.New()}

	body := `{"body":"note","anchor":{"block_id":"abc12345","start_offset":0,"end_offset":5,"selected_text":"hello","block_text_hash":"deadbeef"},"pictures":[{"url":"https://x/a.png","width":100,"height":200,"size":1024}]}`
	req := setPostID(newJSONRequest(t, "POST", "/posts/abc/comments", body), "post-1")
	req = withViewer(req, domainshared.NewID().String())
	rr := httptest.NewRecorder()
	h.Create(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
	assert.True(t, svc.createCalled)
	// anchor 透传
	require.NotNil(t, svc.createInput.Anchor)
	assert.Equal(t, "abc12345", svc.createInput.Anchor.BlockID)
	assert.Equal(t, "hello", svc.createInput.Anchor.SelectedText)
	// pictures 透传
	require.Len(t, svc.createInput.Pictures, 1)
	assert.Equal(t, "https://x/a.png", svc.createInput.Pictures[0].URL)
	assert.Equal(t, int64(1024), svc.createInput.Pictures[0].Size)
}

// 编译期断言：确保 stubCommentService 满足 commentService 接口。
var _ commentService = (*stubCommentService)(nil)

// 引用 domainuser 防止未使用 import（登录路径测试用 nil 时不需要，但保留接口契约）。
var _ domainuser.UserRepository
