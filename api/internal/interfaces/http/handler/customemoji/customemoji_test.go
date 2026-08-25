// Package customemoji handler 测试：手写 stub service + httptest，参照
// interfaces/http/handler/comment 的定型模式。
package customemoji

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appcustomemoji "blog-api/internal/application/customemoji"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

type stubService struct {
	createIn     appcustomemoji.CreateInput
	createOut    appcustomemoji.CustomEmojiDTO
	createErr    error
	listMineOut  appcustomemoji.MineDTO
	listMineErr  error
	deleteID     domainshared.ID
	deleteErr    error
	favUserID    domainshared.ID
	favEmojiID   domainshared.ID
	favErr       error
	unfavUserID  domainshared.ID
	unfavEmojiID domainshared.ID
	unfavErr     error

	listAllKeyword string
	listAllQuery   domainshared.PageQuery
	listAllOut     domainshared.PageResult[appcustomemoji.AdminCustomEmojiDTO]
	listAllErr     error
}

func (s *stubService) Create(_ context.Context, in appcustomemoji.CreateInput) (appcustomemoji.CustomEmojiDTO, error) {
	s.createIn = in
	return s.createOut, s.createErr
}

func (s *stubService) ListMine(context.Context, domainshared.ID) (appcustomemoji.MineDTO, error) {
	return s.listMineOut, s.listMineErr
}

func (s *stubService) Delete(_ context.Context, emojiID domainshared.ID) error {
	s.deleteID = emojiID
	return s.deleteErr
}

func (s *stubService) Favorite(_ context.Context, userID, emojiID domainshared.ID) error {
	s.favUserID, s.favEmojiID = userID, emojiID
	return s.favErr
}

func (s *stubService) Unfavorite(_ context.Context, userID, emojiID domainshared.ID) error {
	s.unfavUserID, s.unfavEmojiID = userID, emojiID
	return s.unfavErr
}
func (s *stubService) ListAll(_ context.Context, keyword string, q domainshared.PageQuery) (domainshared.PageResult[appcustomemoji.AdminCustomEmojiDTO], error) {
	s.listAllKeyword, s.listAllQuery = keyword, q
	return s.listAllOut, s.listAllErr
}

func withViewer(req *http.Request, userID string) *http.Request {
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	return req.WithContext(ctx)
}

func setID(req *http.Request, id string) *http.Request {
	req.SetPathValue("id", id)
	return req
}

func TestCreate_LoggedIn_Succeeds(t *testing.T) {
	userID := domainshared.NewID()
	svc := &stubService{createOut: appcustomemoji.CustomEmojiDTO{ID: "x", Name: "mycat", URL: "/a.png"}}
	h := NewHandler(svc)

	req := httptest.NewRequest(http.MethodPost, "/custom-emojis", strings.NewReader(`{"name":"mycat","url":"/a.png"}`))
	req = withViewer(req, userID.String())
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	assert.True(t, svc.createIn.OwnerID.Equal(userID))
	assert.Equal(t, "mycat", svc.createIn.Name)
}

func TestCreate_NotLoggedIn_Returns401(t *testing.T) {
	svc := &stubService{}
	h := NewHandler(svc)

	req := httptest.NewRequest(http.MethodPost, "/custom-emojis", strings.NewReader(`{"name":"mycat","url":"/a.png"}`))
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestCreate_ServiceRejectsDuplicateName_PropagatesError(t *testing.T) {
	svc := &stubService{createErr: domainshared.Conflict("表情名称已存在")}
	h := NewHandler(svc)

	req := withViewer(httptest.NewRequest(http.MethodPost, "/custom-emojis", strings.NewReader(`{"name":"mycat","url":"/a.png"}`)), domainshared.NewID().String())
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	assert.Equal(t, http.StatusConflict, rec.Code)
}

func TestListMine_LoggedIn_ReturnsData(t *testing.T) {
	svc := &stubService{listMineOut: appcustomemoji.MineDTO{
		Owned:     []appcustomemoji.CustomEmojiDTO{{ID: "1", Name: "a", URL: "/a.png"}},
		Favorited: []appcustomemoji.CustomEmojiDTO{},
	}}
	h := NewHandler(svc)

	req := withViewer(httptest.NewRequest(http.MethodGet, "/custom-emojis/mine", nil), domainshared.NewID().String())
	rec := httptest.NewRecorder()

	h.ListMine(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "\"a\"")
}
func TestListAll_PassesKeywordAndPaging_ReturnsPaged(t *testing.T) {
	svc := &stubService{listAllOut: domainshared.PageResult[appcustomemoji.AdminCustomEmojiDTO]{
		Items: []appcustomemoji.AdminCustomEmojiDTO{{ID: "1", Name: "mycat", URL: "/a.png"}},
		Total: 1, Page: 2, Limit: 10,
	}}
	h := NewHandler(svc)

	req := httptest.NewRequest(http.MethodGet, "/admin/emojis/custom?keyword=mycat&page=2&limit=10", nil)
	rec := httptest.NewRecorder()

	h.ListAll(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "mycat", svc.listAllKeyword)
	assert.Equal(t, 2, svc.listAllQuery.Page)
	assert.Equal(t, 10, svc.listAllQuery.Limit)
	assert.Contains(t, rec.Body.String(), "mycat")
	assert.Contains(t, rec.Body.String(), "\"total\":1")
}

func TestListAll_ServiceError_Propagates(t *testing.T) {
	svc := &stubService{listAllErr: domainshared.Internal("查询失败", nil)}
	h := NewHandler(svc)

	req := httptest.NewRequest(http.MethodGet, "/admin/emojis/custom", nil)
	rec := httptest.NewRecorder()

	h.ListAll(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
}

func TestDelete_ValidID_CallsServiceAndReturns200(t *testing.T) {
	svc := &stubService{}
	h := NewHandler(svc)
	id := domainshared.NewID()

	req := setID(httptest.NewRequest(http.MethodDelete, "/custom-emojis/"+id.String(), nil), id.String())
	rec := httptest.NewRecorder()

	h.Delete(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, svc.deleteID.Equal(id))
}

func TestDelete_ServiceForbids_Returns403(t *testing.T) {
	svc := &stubService{deleteErr: domainshared.Forbidden("无权删除该表情")}
	h := NewHandler(svc)
	id := domainshared.NewID()

	req := setID(httptest.NewRequest(http.MethodDelete, "/custom-emojis/"+id.String(), nil), id.String())
	rec := httptest.NewRecorder()

	h.Delete(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestDelete_InvalidID_Returns400(t *testing.T) {
	svc := &stubService{}
	h := NewHandler(svc)

	req := setID(httptest.NewRequest(http.MethodDelete, "/custom-emojis/not-a-uuid", nil), "not-a-uuid")
	rec := httptest.NewRecorder()

	h.Delete(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestFavorite_LoggedIn_CallsServiceWithUserAndEmojiID(t *testing.T) {
	svc := &stubService{}
	h := NewHandler(svc)
	userID := domainshared.NewID()
	emojiID := domainshared.NewID()

	req := setID(withViewer(httptest.NewRequest(http.MethodPost, "/custom-emojis/"+emojiID.String()+"/favorite", nil), userID.String()), emojiID.String())
	rec := httptest.NewRecorder()

	h.Favorite(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, svc.favUserID.Equal(userID))
	assert.True(t, svc.favEmojiID.Equal(emojiID))
}

func TestFavorite_OwnEmoji_ServiceRejects_Returns400(t *testing.T) {
	svc := &stubService{favErr: domainshared.BadRequest("不能收藏自己上传的表情")}
	h := NewHandler(svc)
	emojiID := domainshared.NewID()

	req := setID(withViewer(httptest.NewRequest(http.MethodPost, "/custom-emojis/"+emojiID.String()+"/favorite", nil), domainshared.NewID().String()), emojiID.String())
	rec := httptest.NewRecorder()

	h.Favorite(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUnfavorite_LoggedIn_CallsServiceWithUserAndEmojiID(t *testing.T) {
	svc := &stubService{}
	h := NewHandler(svc)
	userID := domainshared.NewID()
	emojiID := domainshared.NewID()

	req := setID(withViewer(httptest.NewRequest(http.MethodDelete, "/custom-emojis/"+emojiID.String()+"/favorite", nil), userID.String()), emojiID.String())
	rec := httptest.NewRecorder()

	h.Unfavorite(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, svc.unfavUserID.Equal(userID))
	assert.True(t, svc.unfavEmojiID.Equal(emojiID))
}

var _ customEmojiService = (*stubService)(nil)
