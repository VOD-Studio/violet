package gallery

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appgallery "blog-api/internal/application/gallery"
	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/permission"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

type stubGalleryService struct {
	saveInput       appgallery.SaveInput
	saveDTO         appgallery.GalleryDetailDTO
	saveErr         error
	getErr          error
	publishInput    appgallery.PublishInput
	publishDTO      appgallery.GalleryDetailDTO
	publishErr      error
	unpublishInput  appgallery.VersionInput
	unpublishDTO    appgallery.GalleryDetailDTO
	unpublishErr    error
	deleteInput     appgallery.VersionInput
	deleteErr       error
	browseCursor    string
	browseLimit     int
	browseDTOs      []appgallery.PublicGalleryDTO
	browseNext      string
	browseErr       error
	getPublishedDTO appgallery.PublicGalleryDTO
	getPublishedErr error
	saveCalls       int
	publishCalls    int
	unpublishCalls  int
	deleteCalls     int
	browseCalls     int
	getPublicCalls  int
}

func (s *stubGalleryService) CreateDraft(context.Context, string) (appgallery.GalleryDetailDTO, error) {
	return appgallery.GalleryDetailDTO{}, nil
}
func (s *stubGalleryService) ListForEditor(context.Context, string, int, int) ([]appgallery.GallerySummaryDTO, int64, error) {
	return []appgallery.GallerySummaryDTO{}, 0, nil
}
func (s *stubGalleryService) GetForEditor(context.Context, string, string) (appgallery.GalleryDetailDTO, error) {
	return appgallery.GalleryDetailDTO{}, s.getErr
}
func (s *stubGalleryService) Save(_ context.Context, input appgallery.SaveInput) (appgallery.GalleryDetailDTO, error) {
	s.saveCalls++
	s.saveInput = input
	return s.saveDTO, s.saveErr
}
func (s *stubGalleryService) Publish(_ context.Context, input appgallery.PublishInput) (appgallery.GalleryDetailDTO, error) {
	s.publishCalls++
	s.publishInput = input
	return s.publishDTO, s.publishErr
}
func (s *stubGalleryService) Unpublish(_ context.Context, input appgallery.VersionInput) (appgallery.GalleryDetailDTO, error) {
	s.unpublishCalls++
	s.unpublishInput = input
	return s.unpublishDTO, s.unpublishErr
}
func (s *stubGalleryService) Delete(_ context.Context, input appgallery.VersionInput) error {
	s.deleteCalls++
	s.deleteInput = input
	return s.deleteErr
}
func (s *stubGalleryService) BrowsePublished(_ context.Context, cursor string, limit int) ([]appgallery.PublicGalleryDTO, string, error) {
	s.browseCalls++
	s.browseCursor = cursor
	s.browseLimit = limit
	return s.browseDTOs, s.browseNext, s.browseErr
}
func (s *stubGalleryService) GetPublished(_ context.Context, _ string) (appgallery.PublicGalleryDTO, error) {
	s.getPublicCalls++
	return s.getPublishedDTO, s.getPublishedErr
}

type permissionChecker struct{ allow map[string]bool }

func (c permissionChecker) HasPermission(_ string, _ bool, codes ...string) bool {
	for _, code := range codes {
		if !c.allow[code] {
			return false
		}
	}
	return true
}

func fakeSessionAuth(authenticated bool, userID string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !authenticated {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, requestWithUser(r, userID))
		})
	}
}

func requestWithUser(req *http.Request, userID string) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, userID))
}

func TestSaveAcceptsCompleteSnakeCaseDocument(t *testing.T) {
	userID, galleryID, fileID := shared.NewID().String(), shared.NewID().String(), shared.NewID().String()
	stub := &stubGalleryService{saveDTO: appgallery.GalleryDetailDTO{
		GallerySummaryDTO: appgallery.GallerySummaryDTO{ID: galleryID, Version: 2, Status: "draft"},
		Items:             []appgallery.GalleryItemDTO{},
	}}
	handler := &Handler{service: stub}
	body := []byte(`{"expected_version":1,"title":"测试","summary":"摘要","items":[{"file_id":"` + fileID + `","caption":"说明","alt_text_override":"替代"}]}`)
	req := requestWithUser(httptest.NewRequest(http.MethodPut, "/api/v1/admin/galleries/"+galleryID, bytes.NewReader(body)), userID)
	req.SetPathValue("id", galleryID)
	recorder := httptest.NewRecorder()

	handler.Save(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, userID, stub.saveInput.UserID)
	assert.Equal(t, galleryID, stub.saveInput.GalleryID)
	assert.Equal(t, int64(1), stub.saveInput.ExpectedVersion)
	require.Len(t, stub.saveInput.Items, 1)
	assert.Equal(t, fileID, stub.saveInput.Items[0].FileID)
	assert.Contains(t, recorder.Body.String(), `"status":"draft"`)
	assert.Contains(t, recorder.Body.String(), `"item_count":0`)
}

func TestSaveMapsVersionConflictTo409(t *testing.T) {
	galleryID := shared.NewID().String()
	stub := &stubGalleryService{saveErr: shared.Conflict("图集工作稿已更新，请重新载入后再保存")}
	handler := &Handler{service: stub}
	req := requestWithUser(httptest.NewRequest(http.MethodPut, "/api/v1/admin/galleries/"+galleryID, bytes.NewReader([]byte(`{"expected_version":1,"title":"","summary":"","items":[]}`))), shared.NewID().String())
	req.SetPathValue("id", galleryID)
	recorder := httptest.NewRecorder()

	handler.Save(recorder, req)

	assert.Equal(t, http.StatusConflict, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"error":"CONFLICT"`)
}

func TestSaveRejectsPartialDocument(t *testing.T) {
	handler := &Handler{service: &stubGalleryService{}}
	req := requestWithUser(httptest.NewRequest(http.MethodPut, "/api/v1/admin/galleries/id", bytes.NewReader([]byte(`{"expected_version":1,"items":[]}`))), shared.NewID().String())
	req.SetPathValue("id", shared.NewID().String())
	recorder := httptest.NewRecorder()

	handler.Save(recorder, req)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"error":"BAD_REQUEST"`)
}

func TestSaveAcceptsFiftyItemsAndRejectsFiftyOne(t *testing.T) {
	galleryID := shared.NewID().String()
	for _, count := range []int{domaingallery.MaxItems, domaingallery.MaxItems + 1} {
		t.Run(fmt.Sprintf("items_%d", count), func(t *testing.T) {
			stub := &stubGalleryService{}
			handler := &Handler{service: stub}
			body := `{"expected_version":1,"title":"","summary":"","items":[`
			for index := 0; index < count; index++ {
				if index > 0 {
					body += ","
				}
				body += `{"file_id":"` + shared.NewID().String() + `","caption":"","alt_text_override":""}`
			}
			body += `]}`
			req := requestWithUser(httptest.NewRequest(http.MethodPut, "/api/v1/admin/galleries/"+galleryID, bytes.NewReader([]byte(body))), shared.NewID().String())
			req.SetPathValue("id", galleryID)
			recorder := httptest.NewRecorder()

			handler.Save(recorder, req)

			if count == domaingallery.MaxItems {
				assert.Equal(t, http.StatusOK, recorder.Code)
				assert.Equal(t, 1, stub.saveCalls)
				return
			}
			assert.Equal(t, http.StatusBadRequest, recorder.Code)
			assert.Zero(t, stub.saveCalls)
		})
	}
}

func TestGetMapsOwnershipAndMissingErrors(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{name: "not owner", err: domaingallery.ErrNotOwner, want: http.StatusForbidden},
		{name: "not found", err: domaingallery.ErrNotFound, want: http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := &Handler{service: &stubGalleryService{getErr: tt.err}}
			req := requestWithUser(httptest.NewRequest(http.MethodGet, "/api/v1/admin/galleries/id", nil), shared.NewID().String())
			req.SetPathValue("id", shared.NewID().String())
			recorder := httptest.NewRecorder()

			handler.GetForEditor(recorder, req)

			assert.Equal(t, tt.want, recorder.Code)
		})
	}
}

func TestAdminSaveRouteRejectsMissingSessionOrPermission(t *testing.T) {
	userID := shared.NewID().String()
	body := []byte(`{"expected_version":1,"title":"","summary":"","items":[]}`)
	tests := []struct {
		name          string
		authenticated bool
		permissions   map[string]bool
		want          int
	}{
		{name: "no session", authenticated: false, permissions: map[string]bool{}, want: http.StatusUnauthorized},
		{name: "no gallery permission", authenticated: true, permissions: map[string]bool{"admin:access": true}, want: http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stub := &stubGalleryService{}
			handler := &Handler{service: stub}
			checker := permissionChecker{allow: tt.permissions}
			chain := fakeSessionAuth(tt.authenticated, userID)(
				middleware.AdminRequired(checker)(
					middleware.RequirePermission(checker, permission.GalleryManage.String())(http.HandlerFunc(handler.Save)),
				),
			)
			req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/galleries/id", bytes.NewReader(body))
			req.SetPathValue("id", shared.NewID().String())
			recorder := httptest.NewRecorder()

			chain.ServeHTTP(recorder, req)

			assert.Equal(t, tt.want, recorder.Code)
			assert.Zero(t, stub.saveCalls)
		})
	}
}

func TestPublishAcceptsExpectedVersionAndReturnsPublishedDetail(t *testing.T) {
	userID, galleryID := shared.NewID().String(), shared.NewID().String()
	slug, publishedAt := "summer-light", "2026-08-31T06:30:00Z"
	stub := &stubGalleryService{publishDTO: appgallery.GalleryDetailDTO{
		GallerySummaryDTO: appgallery.GallerySummaryDTO{
			ID: galleryID, Slug: &slug, PublishedAt: &publishedAt,
			Version: 2, Status: "published",
		},
		Items: []appgallery.GalleryItemDTO{},
	}}
	handler := &Handler{service: stub}
	req := requestWithUser(httptest.NewRequest(http.MethodPost, "/api/v1/admin/galleries/"+galleryID+"/publish", bytes.NewReader([]byte(`{"expected_version":1}`))), userID)
	req.SetPathValue("id", galleryID)
	recorder := httptest.NewRecorder()

	handler.Publish(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, appgallery.PublishInput{UserID: userID, GalleryID: galleryID, ExpectedVersion: 1}, stub.publishInput)
	assert.Contains(t, recorder.Body.String(), `"slug":"summer-light"`)
	assert.Contains(t, recorder.Body.String(), `"published_at":"2026-08-31T06:30:00Z"`)
	assert.Contains(t, recorder.Body.String(), `"status":"published"`)
}

func TestPublishRejectsMissingOrInvalidExpectedVersion(t *testing.T) {
	for _, body := range []string{`{}`, `{"expected_version":0}`} {
		stub := &stubGalleryService{}
		handler := &Handler{service: stub}
		req := requestWithUser(httptest.NewRequest(http.MethodPost, "/api/v1/admin/galleries/id/publish", bytes.NewReader([]byte(body))), shared.NewID().String())
		req.SetPathValue("id", shared.NewID().String())
		recorder := httptest.NewRecorder()

		handler.Publish(recorder, req)

		assert.Equal(t, http.StatusBadRequest, recorder.Code)
		assert.Zero(t, stub.publishCalls)
	}
}

func TestPublishMapsApplicationErrors(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{name: "validation", err: shared.BadRequest("标题不能为空"), want: http.StatusBadRequest},
		{name: "not owner", err: domaingallery.ErrNotOwner, want: http.StatusForbidden},
		{name: "missing", err: domaingallery.ErrNotFound, want: http.StatusNotFound},
		{name: "stale version", err: shared.Conflict("图集工作稿已更新"), want: http.StatusConflict},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := &Handler{service: &stubGalleryService{publishErr: tt.err}}
			req := requestWithUser(httptest.NewRequest(http.MethodPost, "/api/v1/admin/galleries/id/publish", bytes.NewReader([]byte(`{"expected_version":1}`))), shared.NewID().String())
			req.SetPathValue("id", shared.NewID().String())
			recorder := httptest.NewRecorder()

			handler.Publish(recorder, req)

			assert.Equal(t, tt.want, recorder.Code)
		})
	}
}

func TestAdminPublishRouteRejectsMissingSessionOrPermission(t *testing.T) {
	userID := shared.NewID().String()
	tests := []struct {
		name          string
		authenticated bool
		permissions   map[string]bool
		want          int
	}{
		{name: "no session", authenticated: false, permissions: map[string]bool{}, want: http.StatusUnauthorized},
		{name: "no gallery permission", authenticated: true, permissions: map[string]bool{"admin:access": true}, want: http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stub := &stubGalleryService{}
			handler := &Handler{service: stub}
			checker := permissionChecker{allow: tt.permissions}
			chain := fakeSessionAuth(tt.authenticated, userID)(
				middleware.AdminRequired(checker)(
					middleware.RequirePermission(checker, permission.GalleryManage.String())(http.HandlerFunc(handler.Publish)),
				),
			)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/galleries/id/publish", bytes.NewReader([]byte(`{"expected_version":1}`)))
			req.SetPathValue("id", shared.NewID().String())
			recorder := httptest.NewRecorder()

			chain.ServeHTTP(recorder, req)

			assert.Equal(t, tt.want, recorder.Code)
			assert.Zero(t, stub.publishCalls)
		})
	}
}

func TestUnpublishAcceptsExpectedVersionAndReturnsUnpublishedDetail(t *testing.T) {
	userID, galleryID := shared.NewID().String(), shared.NewID().String()
	slug := "summer-light"
	stub := &stubGalleryService{unpublishDTO: appgallery.GalleryDetailDTO{
		GallerySummaryDTO: appgallery.GallerySummaryDTO{ID: galleryID, Slug: &slug, Version: 5, Status: "unpublished"},
		Items:             []appgallery.GalleryItemDTO{},
	}}
	handler := &Handler{service: stub}
	req := requestWithUser(httptest.NewRequest(http.MethodPost, "/api/v1/admin/galleries/"+galleryID+"/unpublish", bytes.NewReader([]byte(`{"expected_version":4}`))), userID)
	req.SetPathValue("id", galleryID)
	recorder := httptest.NewRecorder()

	handler.Unpublish(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, appgallery.VersionInput{UserID: userID, GalleryID: galleryID, ExpectedVersion: 4}, stub.unpublishInput)
	assert.Contains(t, recorder.Body.String(), `"status":"unpublished"`)
	assert.Contains(t, recorder.Body.String(), `"slug":"summer-light"`)
}

func TestDeleteAcceptsExpectedVersionAndReturnsNoContent(t *testing.T) {
	userID, galleryID := shared.NewID().String(), shared.NewID().String()
	stub := &stubGalleryService{}
	handler := &Handler{service: stub}
	req := requestWithUser(httptest.NewRequest(http.MethodDelete, "/api/v1/admin/galleries/"+galleryID, bytes.NewReader([]byte(`{"expected_version":7}`))), userID)
	req.SetPathValue("id", galleryID)
	recorder := httptest.NewRecorder()

	handler.Delete(recorder, req)

	assert.Equal(t, http.StatusNoContent, recorder.Code)
	assert.Equal(t, appgallery.VersionInput{UserID: userID, GalleryID: galleryID, ExpectedVersion: 7}, stub.deleteInput)
	assert.Empty(t, recorder.Body.String())
}

func TestMaintenanceActionsMapVersionConflictTo409(t *testing.T) {
	for _, tt := range []struct {
		name string
		call func(*Handler, http.ResponseWriter, *http.Request)
		stub *stubGalleryService
	}{
		{name: "unpublish", call: (*Handler).Unpublish, stub: &stubGalleryService{unpublishErr: domaingallery.ErrVersionConflict}},
		{name: "delete", call: (*Handler).Delete, stub: &stubGalleryService{deleteErr: domaingallery.ErrVersionConflict}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			handler := &Handler{service: tt.stub}
			req := requestWithUser(httptest.NewRequest(http.MethodPost, "/api/v1/admin/galleries/id", bytes.NewReader([]byte(`{"expected_version":1}`))), shared.NewID().String())
			req.SetPathValue("id", shared.NewID().String())
			recorder := httptest.NewRecorder()

			tt.call(handler, recorder, req)

			assert.Equal(t, http.StatusConflict, recorder.Code)
			assert.Contains(t, recorder.Body.String(), `"error":"CONFLICT"`)
		})
	}
}

func TestBrowsePublishedIsAnonymousAndUsesCursorPagination(t *testing.T) {
	stub := &stubGalleryService{
		browseDTOs: []appgallery.PublicGalleryDTO{{
			ID: "gallery-id", Slug: "summer-light", Title: "夏日光影", Summary: "摘要",
			PublishedAt: "2026-08-31T06:30:00Z",
			Items: []appgallery.PublicGalleryItemDTO{{
				FileID: "file-id", Position: 0, Thumbnail: "/thumb.webp", URL: "/image.webp",
				Width: 1200, Height: 800, AltText: "树影", Caption: "午后",
			}},
		}},
		browseNext: "next-token",
	}
	handler := &Handler{service: stub}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/galleries?cursor=cursor-token&limit=8", nil)
	recorder := httptest.NewRecorder()

	handler.BrowsePublished(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "cursor-token", stub.browseCursor)
	assert.Equal(t, 8, stub.browseLimit)
	assert.Contains(t, recorder.Body.String(), `"file_id":"file-id"`)
	assert.Contains(t, recorder.Body.String(), `"published_at":"2026-08-31T06:30:00Z"`)
	assert.Contains(t, recorder.Body.String(), `"next_cursor":"next-token"`)
}

func TestBrowsePublishedClampsLimitToFifty(t *testing.T) {
	stub := &stubGalleryService{browseDTOs: []appgallery.PublicGalleryDTO{}}
	handler := &Handler{service: stub}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/galleries?limit=100", nil)
	recorder := httptest.NewRecorder()

	handler.BrowsePublished(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, 50, stub.browseLimit)
	assert.Contains(t, recorder.Body.String(), `"limit":50`)
}

func TestGetPublishedIsAnonymousAndMapsMissingTo404(t *testing.T) {
	t.Run("published detail", func(t *testing.T) {
		stub := &stubGalleryService{getPublishedDTO: appgallery.PublicGalleryDTO{ID: "gallery-id", Slug: "summer-light", Items: []appgallery.PublicGalleryItemDTO{}}}
		handler := &Handler{service: stub}
		req := httptest.NewRequest(http.MethodGet, "/api/v1/galleries/summer-light", nil)
		req.SetPathValue("slug", "summer-light")
		recorder := httptest.NewRecorder()

		handler.GetPublished(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Contains(t, recorder.Body.String(), `"slug":"summer-light"`)
	})

	t.Run("missing published edition", func(t *testing.T) {
		handler := &Handler{service: &stubGalleryService{getPublishedErr: domaingallery.ErrNotFound}}
		req := httptest.NewRequest(http.MethodGet, "/api/v1/galleries/draft-only", nil)
		req.SetPathValue("slug", "draft-only")
		recorder := httptest.NewRecorder()

		handler.GetPublished(recorder, req)

		assert.Equal(t, http.StatusNotFound, recorder.Code)
	})
}
