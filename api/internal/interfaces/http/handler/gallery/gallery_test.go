// handler HTTP 层测试。
//
// Handler 持有具体 *appgallery.Service（非接口），故构造真实 Service、
// stub 其仓储依赖（同 tweet handler 测试模式）。
// 401（匿名写操作）/ 403（无 gallery:delete-any）由路由层 SessionAuth 与
// RequirePermission 保证，不在 handler 测试范围（e2e 覆盖）。
package gallery

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	appgallery "blog-api/internal/application/gallery"
	appshared "blog-api/internal/application/shared"
	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	domainuser "blog-api/internal/domain/user"
)

// stubRepo 内嵌接口保持编译通过，仅覆盖用到的方法。
type stubRepo struct {
	domaingallery.GalleryRepository
	gallery *domaingallery.Gallery
}

func (s *stubRepo) FindByID(context.Context, shared.ID) (*domaingallery.Gallery, error) {
	if s.gallery != nil {
		return s.gallery, nil
	}
	return nil, domaingallery.ErrGalleryNotFound
}

func (s *stubRepo) FindPublishedPage(context.Context, shared.PageQuery) (shared.PageResult[*domaingallery.Gallery], error) {
	items := []*domaingallery.Gallery{}
	if s.gallery != nil {
		items = append(items, s.gallery)
	}
	return shared.PageResult[*domaingallery.Gallery]{Items: items, Total: int64(len(items))}, nil
}

// stubMedia 空媒体端口。
type stubMedia struct {
	appgallery.GalleryMediaChecker
}

func (stubMedia) FindByIDs(context.Context, []shared.ID) (map[shared.ID]*domainupload.File, error) {
	return map[shared.ID]*domainupload.File{}, nil
}

// stubUserRepo 空用户仓储（作者资料缺失时 DTO 兜底空卡）。
type stubUserRepo struct {
	domainuser.UserRepository
}

func (stubUserRepo) FindByIDs(context.Context, []shared.ID) ([]*domainuser.User, error) {
	return nil, nil
}

func newTestGallery(t *testing.T, status string) *domaingallery.Gallery {
	t.Helper()
	fid := shared.NewID()
	g := domaingallery.ReconstructGallery(
		shared.NewID(), shared.NewID(),
		"濑户内海", "", nil, status,
		[]domaingallery.GalleryItem{domaingallery.ReconstructGalleryItem(fid, "")},
		time.Now(), time.Now(),
	)
	return g
}

func newHandler(repo domaingallery.GalleryRepository) *Handler {
	svc := appgallery.NewService(repo, stubMedia{}, stubUserRepo{}, nil, appshared.NoopEventBus{})
	return NewHandler(svc)
}

func TestGet_RemovedReturns404(t *testing.T) {
	h := newHandler(&stubRepo{gallery: newTestGallery(t, domaingallery.StatusRemoved)})

	r := chi.NewRouter()
	r.Get("/galleries/{id}", h.Get)

	req := httptest.NewRequest(http.MethodGet, "/galleries/"+shared.NewID().String(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("removed 图集详情应 404，got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGet_PublishedOK(t *testing.T) {
	h := newHandler(&stubRepo{gallery: newTestGallery(t, domaingallery.StatusPublished)})

	r := chi.NewRouter()
	r.Get("/galleries/{id}", h.Get)

	req := httptest.NewRequest(http.MethodGet, "/galleries/"+shared.NewID().String(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "濑户内海") {
		t.Fatalf("body should contain title, got %s", rec.Body.String())
	}
}

func TestList_PagedShape(t *testing.T) {
	h := newHandler(&stubRepo{gallery: newTestGallery(t, domaingallery.StatusPublished)})

	r := chi.NewRouter()
	r.Get("/galleries", h.List)

	req := httptest.NewRequest(http.MethodGet, "/galleries?page=1&limit=10", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"total":1`) {
		t.Fatalf("body should contain paged total, got %s", rec.Body.String())
	}
}

func TestCreate_EmptyBody400(t *testing.T) {
	h := newHandler(&stubRepo{})

	r := chi.NewRouter()
	r.Post("/galleries", h.Create)

	req := httptest.NewRequest(http.MethodPost, "/galleries", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("空请求体应 400，got %d body=%s", rec.Code, rec.Body.String())
	}
}
