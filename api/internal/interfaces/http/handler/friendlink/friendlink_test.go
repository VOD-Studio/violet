package friendlink

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appfriendlink "blog-api/internal/application/friendlink"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	ifmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/middleware"
)

// stubFriendlinkService 手写 stub，记录调用入参供断言。
//
// 沿用仓内定型模式（mirror comment_test.go）：
//   - stub service：手写实现 friendlinkService 接口，不引 mock 框架
//   - stub auth context：用 ifmw + middleware.UserIDKey 注入登录态，模拟认证中间件效果
//   - stub permission chain：用测试辅助 fakeSessionAuth + 真实 middleware.RequirePermission
//     覆盖「未登录 401」「无权限 403」两个 routing 层契约
//   - 直接调 handler 方法 + httptest.NewRecorder 断言状态码/响应体
type stubFriendlinkService struct {
	listPublicResult []appfriendlink.FriendLinkDTO

	applyInput  appfriendlink.ApplyInput
	applyCalled bool
	applyErr    error
	applyResult appfriendlink.FriendLinkDTO

	sendCodeInput  appfriendlink.SendCodeInput
	sendCodeErr    error
	sendCodeCalled bool

	listByStatusCalled bool
	listByStatusResult []appfriendlink.FriendLinkAdminDTO
	listByStatusTotal  int64
	listByStatusStatus string

	countPendingCalled bool
	countPendingResult int64

	createManualCalled bool
	createManualResult appfriendlink.FriendLinkAdminDTO

	updateCalled bool
	updateID     string
	updateResult appfriendlink.FriendLinkAdminDTO

	approveCalled bool
	approveID     string
	approveErr    error

	rejectCalled bool
	rejectID     string

	disableCalled bool
	disableID     string

	restoreCalled bool
	restoreID     string

	deleteCalled bool
	deleteID     string
	deleteErr    error
}

func (s *stubFriendlinkService) ListPublic(context.Context) ([]appfriendlink.FriendLinkDTO, error) {
	return s.listPublicResult, nil
}
func (s *stubFriendlinkService) Apply(_ context.Context, in appfriendlink.ApplyInput) (appfriendlink.FriendLinkDTO, error) {
	s.applyCalled = true
	s.applyInput = in
	return s.applyResult, s.applyErr
}
func (s *stubFriendlinkService) SendCode(_ context.Context, in appfriendlink.SendCodeInput) error {
	s.sendCodeCalled = true
	s.sendCodeInput = in
	return s.sendCodeErr
}

func (s *stubFriendlinkService) ListByStatus(_ context.Context, status string, _, _ int) ([]appfriendlink.FriendLinkAdminDTO, int64, error) {
	s.listByStatusCalled = true
	s.listByStatusStatus = status
	return s.listByStatusResult, s.listByStatusTotal, nil
}

func (s *stubFriendlinkService) CountPending(context.Context) (int64, error) {
	s.countPendingCalled = true
	return s.countPendingResult, nil
}

func (s *stubFriendlinkService) CreateManual(_ context.Context, _ appfriendlink.ManualInput) (appfriendlink.FriendLinkAdminDTO, error) {
	s.createManualCalled = true
	return s.createManualResult, nil
}

func (s *stubFriendlinkService) Update(_ context.Context, id string, _ appfriendlink.ManualInput) (appfriendlink.FriendLinkAdminDTO, error) {
	s.updateCalled = true
	s.updateID = id
	return s.updateResult, nil
}

func (s *stubFriendlinkService) Approve(_ context.Context, id string) error {
	s.approveCalled = true
	s.approveID = id
	return s.approveErr
}

func (s *stubFriendlinkService) Reject(_ context.Context, id string) error {
	s.rejectCalled = true
	s.rejectID = id
	return nil
}

func (s *stubFriendlinkService) Disable(_ context.Context, id string) error {
	s.disableCalled = true
	s.disableID = id
	return nil
}

func (s *stubFriendlinkService) Restore(_ context.Context, id string) error {
	s.restoreCalled = true
	s.restoreID = id
	return nil
}

func (s *stubFriendlinkService) Delete(_ context.Context, id string) error {
	s.deleteCalled = true
	s.deleteID = id
	return s.deleteErr
}

// 编译期断言：确保 stubFriendlinkService 满足 friendlinkService 接口。
var _ friendlinkService = (*stubFriendlinkService)(nil)

// newHandlerWithStub 构造带 stub service 的 handler（users=nil：登录路径仅测「忽略请求体」语义）。
func newHandlerWithStub(svc *stubFriendlinkService) *Handler {
	return &Handler{svc: svc, users: nil, validate: validator.New()}
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

// =====================================================================
// ListPublic 公开列表：匿名访问 200。
// =====================================================================

func TestListPublic_Anon_Returns200(t *testing.T) {
	svc := &stubFriendlinkService{
		listPublicResult: []appfriendlink.FriendLinkDTO{{ID: "f1", Name: "rua"}},
	}
	h := newHandlerWithStub(svc)

	req := httptest.NewRequest("GET", "/friend-links", nil)
	rr := httptest.NewRecorder()
	h.ListPublic(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

// =====================================================================
// Apply 双轨认证
// =====================================================================

func TestApply_AnonMissingEmail_Returns400(t *testing.T) {
	svc := &stubFriendlinkService{}
	h := newHandlerWithStub(svc)

	body := `{"name":"rua","url":"https://rua.plus","code":"123456"}`
	req := newJSONRequest(t, "POST", "/friend-links", body)
	rr := httptest.NewRecorder()
	h.Apply(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.False(t, svc.applyCalled, "匿名缺 contact_email 不应进入 service")
}

func TestApply_AnonInvalidCode_Returns400(t *testing.T) {
	svc := &stubFriendlinkService{
		applyErr: appfriendlink.ErrInvalidCode,
	}
	h := newHandlerWithStub(svc)

	body := `{"name":"rua","url":"https://rua.plus","contact_email":"alice@x.com","code":"wrong"}`
	req := newJSONRequest(t, "POST", "/friend-links", body)
	rr := httptest.NewRecorder()
	h.Apply(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.True(t, svc.applyCalled, "进入 service 后由 service 判 ErrInvalidCode")
}

func TestApply_AnonWithValidPayload_PassesInput(t *testing.T) {
	svc := &stubFriendlinkService{}
	h := newHandlerWithStub(svc)

	body := `{"name":"rua","url":"https://rua.plus","contact_email":"alice@x.com","code":"123456"}`
	req := newJSONRequest(t, "POST", "/friend-links", body)
	rr := httptest.NewRecorder()
	h.Apply(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
	require.True(t, svc.applyCalled)
	assert.Empty(t, svc.applyInput.UserID, "匿名 UserID 应为空")
	assert.Equal(t, "alice@x.com", svc.applyInput.ContactEmail)
	assert.NotEmpty(t, svc.applyInput.IPHash, "ip_hash 应被 handler 填充")
}

func TestApply_LoggedIn_IgnoresRequestContactEmail(t *testing.T) {
	svc := &stubFriendlinkService{}
	h := &Handler{svc: svc, users: nil, validate: validator.New()}
	// users=nil：handler 不查资料，contact_email 留空——本测试只验「登录时请求体 contact_email 被忽略」语义。

	body := `{"name":"rua","url":"https://rua.plus","contact_email":"FAKE@x.com"}`
	req := newJSONRequest(t, "POST", "/friend-links", body)
	viewerID := domainshared.NewID()
	req = withViewer(req, viewerID.String())
	rr := httptest.NewRecorder()
	h.Apply(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code, "登录合法申请应 201")
	require.True(t, svc.applyCalled)
	assert.Equal(t, viewerID.String(), svc.applyInput.UserID, "登录态 UserID 透传")
	assert.Empty(t, svc.applyInput.ContactEmail, "登录态应忽略请求体 contact_email（防伪造）；users=nil 时留空")
}

// =====================================================================
// SendCode 匿名发码
// =====================================================================

func TestSendCode_ValidEmail_CallsService(t *testing.T) {
	svc := &stubFriendlinkService{}
	h := newHandlerWithStub(svc)

	body := `{"email":"alice@x.com"}`
	req := newJSONRequest(t, "POST", "/friend-links/code", body)
	rr := httptest.NewRecorder()
	h.SendCode(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	require.True(t, svc.sendCodeCalled)
	assert.Equal(t, "alice@x.com", svc.sendCodeInput.Email)
}

func TestSendCode_InvalidEmail_Returns400(t *testing.T) {
	svc := &stubFriendlinkService{}
	h := newHandlerWithStub(svc)

	body := `{"email":"not-an-email"}`
	req := newJSONRequest(t, "POST", "/friend-links/code", body)
	rr := httptest.NewRecorder()
	h.SendCode(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.False(t, svc.sendCodeCalled)
}

// =====================================================================
// 后台路由层契约（401 / 403）—— 用最小中间件链验证 routing 挂法。
// =====================================================================

// fakeSessionAuth 模拟 session 中间件：authenticated=true → 注入 user_id 后 pass-through；
// authenticated=false → 写 401 短路（与 SessionAuth 一致）。
func fakeSessionAuth(authenticated bool, userID string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !authenticated {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"unauthorized"}`))
				return
			}
			ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// fakeChecker 满足 middleware.PermissionChecker，按 allow 列表判定。
type fakeChecker struct {
	allow map[string]bool
}

func (f fakeChecker) HasPermission(role string, isRoot bool, codes ...string) bool {
	if isRoot {
		return true
	}
	for _, c := range codes {
		if f.allow[c] {
			return true
		}
	}
	return false
}

// TestAdmin_NoSession_Returns401 未登录访问管理端点 → 401（routing SessionAuth 短路）。
// 这是 routing 层契约，handler 测试用 fakeSessionAuth(false) 模拟 SessionAuth 行为。
func TestAdmin_NoSession_Returns401(t *testing.T) {
	svc := &stubFriendlinkService{}
	h := newHandlerWithStub(svc)

	chain := fakeSessionAuth(false, "")(http.HandlerFunc(h.ListByStatus))
	req := httptest.NewRequest("GET", "/admin/friend-links", nil)
	rr := httptest.NewRecorder()
	chain.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code, "未登录管理端点应 401")
	assert.False(t, svc.listByStatusCalled, "401 不应进入 handler")
}

// TestAdmin_NoPermission_Returns403 已登录但缺 friendlink:manage 权限 → 403。
// 用真实 middleware.RequirePermission + fakeChecker 验证 routing 挂法正确。
func TestAdmin_NoPermission_Returns403(t *testing.T) {
	svc := &stubFriendlinkService{}
	h := newHandlerWithStub(svc)
	// 已登录但权限码集合为空 → RequirePermission 判 false → 403
	checker := fakeChecker{allow: map[string]bool{}}
	chain := fakeSessionAuth(true, domainshared.NewID().String())(
		middleware.RequirePermission(checker, "friendlink:manage")(http.HandlerFunc(h.Approve)),
	)

	req := httptest.NewRequest("POST", "/admin/friend-links/abc/approve", nil)
	req.SetPathValue("id", "abc")
	rr := httptest.NewRecorder()
	chain.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusForbidden, rr.Code, "无权限应 403")
	assert.False(t, svc.approveCalled, "403 不应进入 handler")
}

// TestAdmin_WithPermission_OK 已登录 + 有权限 → handler 正常被调用。
func TestAdmin_WithPermission_OK(t *testing.T) {
	svc := &stubFriendlinkService{}
	h := newHandlerWithStub(svc)
	checker := fakeChecker{allow: map[string]bool{"friendlink:manage": true}}
	chain := fakeSessionAuth(true, domainshared.NewID().String())(
		middleware.RequirePermission(checker, "friendlink:manage")(http.HandlerFunc(h.Approve)),
	)

	req := httptest.NewRequest("POST", "/admin/friend-links/abc/approve", nil)
	req.SetPathValue("id", "abc")
	rr := httptest.NewRecorder()
	chain.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.True(t, svc.approveCalled)
	assert.Equal(t, "abc", svc.approveID)
}

// =====================================================================
// 引用以防未使用 import 警告（登录路径测试用 nil users，但保留接口契约）。
// =====================================================================
var _ domainuser.UserRepository
var _ = ifmw.GetUserIDFromContext
