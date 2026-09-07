// Package persona 提供人设档案的公开与后台 HTTP adapter。
package persona

import (
	"context"
	"encoding/json"
	"net/http"

	apppersona "blog-api/internal/application/persona"
	domainpersona "blog-api/internal/domain/persona"
	"blog-api/internal/domain/shared"
	ifmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

type personaService interface {
	Create(ctx context.Context, userID string) (apppersona.DetailDTO, error)
	List(ctx context.Context, query apppersona.ListQuery) ([]apppersona.SummaryDTO, int64, int, int, error)
	GetForAdmin(ctx context.Context, personaID string) (apppersona.DetailDTO, error)
	Save(ctx context.Context, input apppersona.SaveInput) (apppersona.DetailDTO, error)
	Activate(ctx context.Context, input apppersona.VersionInput) (apppersona.DetailDTO, error)
	Delete(ctx context.Context, input apppersona.VersionInput) error
	GetActive(ctx context.Context) (apppersona.PublicPersonaDTO, error)
}

type Handler struct {
	service personaService
}

func NewHandler(service *apppersona.Service) *Handler { return &Handler{service: service} }

type factRequest struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type imageRequest struct {
	FileID          string `json:"file_id"`
	Caption         string `json:"caption"`
	AltTextOverride string `json:"alt_text_override"`
}

// saveRequest 使用指针区分完整文档中的空值与字段缺失。
type saveRequest struct {
	ExpectedVersion *int64          `json:"expected_version"`
	Name            *string         `json:"name"`
	Subtitle        *string         `json:"subtitle"`
	Summary         *string         `json:"summary"`
	ContentMD       *string         `json:"content_md"`
	Facts           *[]factRequest  `json:"facts"`
	Images          *[]imageRequest `json:"images"`
}

type versionRequest struct {
	ExpectedVersion *int64 `json:"expected_version"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	dto, err := h.service.Create(r.Context(), ifmw.GetUserIDFromContext(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	items, total, normalizedPage, normalizedLimit, err := h.service.List(r.Context(), apppersona.ListQuery{
		Search: r.URL.Query().Get("q"), Page: page, Limit: limit,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, normalizedPage, normalizedLimit, total)
}

func (h *Handler) GetForAdmin(w http.ResponseWriter, r *http.Request) {
	dto, err := h.service.GetForAdmin(r.Context(), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

func (h *Handler) Save(w http.ResponseWriter, r *http.Request) {
	var req saveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if req.ExpectedVersion == nil || req.Name == nil || req.Subtitle == nil || req.Summary == nil || req.ContentMD == nil || req.Facts == nil || req.Images == nil {
		response.RespondError(w, r, shared.BadRequest("保存请求必须包含 expected_version、name、subtitle、summary、content_md、facts 和 images"))
		return
	}
	if *req.ExpectedVersion < 1 {
		response.RespondError(w, r, shared.BadRequest("expected_version 必须大于 0"))
		return
	}
	if len(*req.Facts) > domainpersona.MaxFacts {
		response.RespondError(w, r, shared.BadRequest("人设资料项最多包含 24 项"))
		return
	}
	if len(*req.Images) > domainpersona.MaxImages {
		response.RespondError(w, r, shared.BadRequest("人设最多包含 30 张设定图"))
		return
	}

	facts := make([]apppersona.FactInput, 0, len(*req.Facts))
	for _, fact := range *req.Facts {
		facts = append(facts, apppersona.FactInput{Label: fact.Label, Value: fact.Value})
	}
	images := make([]apppersona.ImageInput, 0, len(*req.Images))
	for _, image := range *req.Images {
		images = append(images, apppersona.ImageInput{
			FileID: image.FileID, Caption: image.Caption, AltTextOverride: image.AltTextOverride,
		})
	}
	dto, err := h.service.Save(r.Context(), apppersona.SaveInput{
		PersonaID: r.PathValue("id"), ExpectedVersion: *req.ExpectedVersion,
		Name: *req.Name, Subtitle: *req.Subtitle, Summary: *req.Summary, ContentMD: *req.ContentMD,
		Facts: facts, Images: images,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

func (h *Handler) Activate(w http.ResponseWriter, r *http.Request) {
	expectedVersion, ok := decodeVersionRequest(w, r)
	if !ok {
		return
	}
	dto, err := h.service.Activate(r.Context(), apppersona.VersionInput{
		PersonaID: r.PathValue("id"), ExpectedVersion: expectedVersion,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	expectedVersion, ok := decodeVersionRequest(w, r)
	if !ok {
		return
	}
	if err := h.service.Delete(r.Context(), apppersona.VersionInput{
		PersonaID: r.PathValue("id"), ExpectedVersion: expectedVersion,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

func (h *Handler) GetActive(w http.ResponseWriter, r *http.Request) {
	dto, err := h.service.GetActive(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

func decodeVersionRequest(w http.ResponseWriter, r *http.Request) (int64, bool) {
	var req versionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return 0, false
	}
	if req.ExpectedVersion == nil || *req.ExpectedVersion < 1 {
		response.RespondError(w, r, shared.BadRequest("expected_version 必须大于 0"))
		return 0, false
	}
	return *req.ExpectedVersion, true
}
