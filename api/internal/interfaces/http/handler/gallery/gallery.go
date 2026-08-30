// Package gallery 提供图集工作稿的 HTTP adapter。
package gallery

import (
	"context"
	"encoding/json"
	"net/http"

	appgallery "blog-api/internal/application/gallery"
	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
	ifmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

type galleryService interface {
	CreateDraft(ctx context.Context, userID string) (appgallery.GalleryDetailDTO, error)
	ListForEditor(ctx context.Context, userID string, page, limit int) ([]appgallery.GallerySummaryDTO, int64, error)
	GetForEditor(ctx context.Context, userID, galleryID string) (appgallery.GalleryDetailDTO, error)
	Save(ctx context.Context, input appgallery.SaveInput) (appgallery.GalleryDetailDTO, error)
}

type Handler struct {
	service galleryService
}

func NewHandler(service *appgallery.Service) *Handler { return &Handler{service: service} }

func (h *Handler) CreateDraft(w http.ResponseWriter, r *http.Request) {
	dto, err := h.service.CreateDraft(r.Context(), ifmw.GetUserIDFromContext(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

func (h *Handler) ListForEditor(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	items, total, err := h.service.ListForEditor(r.Context(), ifmw.GetUserIDFromContext(r), page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
}

func (h *Handler) GetForEditor(w http.ResponseWriter, r *http.Request) {
	dto, err := h.service.GetForEditor(r.Context(), ifmw.GetUserIDFromContext(r), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

type saveItemRequest struct {
	FileID          string `json:"file_id"`
	Caption         string `json:"caption"`
	AltTextOverride string `json:"alt_text_override"`
}

// saveRequest 使用指针区分“完整文档中的空值”与“字段缺失”。
type saveRequest struct {
	ExpectedVersion *int64             `json:"expected_version"`
	Title           *string            `json:"title"`
	Summary         *string            `json:"summary"`
	Items           *[]saveItemRequest `json:"items"`
}

func (h *Handler) Save(w http.ResponseWriter, r *http.Request) {
	var req saveRequest
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if req.ExpectedVersion == nil || req.Title == nil || req.Summary == nil || req.Items == nil {
		response.RespondError(w, r, shared.BadRequest("保存请求必须包含 expected_version、title、summary 和 items"))
		return
	}
	if *req.ExpectedVersion < 1 {
		response.RespondError(w, r, shared.BadRequest("expected_version 必须大于 0"))
		return
	}
	if len(*req.Items) > domaingallery.MaxItems {
		response.RespondError(w, r, shared.BadRequest("图集最多包含 50 张图片"))
		return
	}
	items := make([]appgallery.SaveItemInput, 0, len(*req.Items))
	for _, item := range *req.Items {
		items = append(items, appgallery.SaveItemInput{
			FileID: item.FileID, Caption: item.Caption, AltTextOverride: item.AltTextOverride,
		})
	}
	dto, err := h.service.Save(r.Context(), appgallery.SaveInput{
		UserID: ifmw.GetUserIDFromContext(r), GalleryID: r.PathValue("id"),
		ExpectedVersion: *req.ExpectedVersion, Title: *req.Title, Summary: *req.Summary, Items: items,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}
