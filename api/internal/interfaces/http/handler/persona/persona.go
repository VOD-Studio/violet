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
	GetActive(ctx context.Context, requestedLocale string) (apppersona.PublicPersonaDTO, error)
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

type localizationRequest struct {
	Locale    string         `json:"locale"`
	Name      string         `json:"name"`
	Subtitle  string         `json:"subtitle"`
	Summary   string         `json:"summary"`
	ContentMD string         `json:"content_md"`
	Facts     []factRequest  `json:"facts"`
	Images    []imageRequest `json:"images"`
}

// saveRequest 使用指针区分完整文档中的空值与字段缺失。
type saveRequest struct {
	ExpectedVersion *int64                 `json:"expected_version"`
	DefaultLocale   *string                `json:"default_locale"`
	AvatarFileID    *string                `json:"avatar_file_id"`
	Localizations   *[]localizationRequest `json:"localizations"`
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
	if req.ExpectedVersion == nil || req.DefaultLocale == nil || req.AvatarFileID == nil || req.Localizations == nil {
		response.RespondError(w, r, shared.BadRequest("保存请求必须包含 expected_version、default_locale、avatar_file_id 和 localizations"))
		return
	}
	if *req.ExpectedVersion < 1 {
		response.RespondError(w, r, shared.BadRequest("expected_version 必须大于 0"))
		return
	}
	if len(*req.Localizations) == 0 || len(*req.Localizations) > domainpersona.MaxLocales {
		response.RespondError(w, r, shared.BadRequest("人设档案需要包含 1 至 8 个语言版本"))
		return
	}

	localizations := make([]apppersona.LocalizationInput, 0, len(*req.Localizations))
	for _, localization := range *req.Localizations {
		if len(localization.Facts) > domainpersona.MaxFacts {
			response.RespondError(w, r, shared.BadRequest("单个语言版本的资料项最多包含 24 项"))
			return
		}
		if len(localization.Images) > domainpersona.MaxImages {
			response.RespondError(w, r, shared.BadRequest("单个语言版本最多包含 30 张设定图"))
			return
		}
		facts := make([]apppersona.FactInput, 0, len(localization.Facts))
		for _, fact := range localization.Facts {
			facts = append(facts, apppersona.FactInput{Label: fact.Label, Value: fact.Value})
		}
		images := make([]apppersona.ImageInput, 0, len(localization.Images))
		for _, image := range localization.Images {
			images = append(images, apppersona.ImageInput{
				FileID: image.FileID, Caption: image.Caption, AltTextOverride: image.AltTextOverride,
			})
		}
		localizations = append(localizations, apppersona.LocalizationInput{
			Locale: localization.Locale, Name: localization.Name, Subtitle: localization.Subtitle,
			Summary: localization.Summary, ContentMD: localization.ContentMD,
			Facts: facts, Images: images,
		})
	}
	dto, err := h.service.Save(r.Context(), apppersona.SaveInput{
		PersonaID: r.PathValue("id"), ExpectedVersion: *req.ExpectedVersion,
		DefaultLocale: *req.DefaultLocale, AvatarFileID: *req.AvatarFileID,
		Localizations: localizations,
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
	dto, err := h.service.GetActive(r.Context(), r.URL.Query().Get("locale"))
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
