// Package note 提供笔记的 HTTP adapter。
package note

import (
	"context"
	"encoding/json"
	"net/http"

	appnote "blog-api/internal/application/note"
	domainnote "blog-api/internal/domain/note"
	"blog-api/internal/domain/shared"
	ifmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

type noteService interface {
	Create(ctx context.Context, in appnote.CreateInput) (appnote.NoteDTO, error)
	Update(ctx context.Context, in appnote.UpdateInput) (appnote.NoteDTO, error)
	Get(ctx context.Context, noteID string) (appnote.NoteDTO, error)
	List(ctx context.Context, query appnote.ListQuery) ([]appnote.NoteSummaryDTO, int64, error)
	Publish(ctx context.Context, noteID string) (appnote.NoteDTO, error)
	Delete(ctx context.Context, noteID string) error
	BrowsePublished(ctx context.Context, query appnote.BrowseQuery) ([]appnote.PublicNoteDTO, string, error)
	GetPublished(ctx context.Context, noteID string) (appnote.PublicNoteDTO, error)
}

type Handler struct {
	service noteService
}

func NewHandler(service *appnote.Service) *Handler { return &Handler{service: service} }

// saveRequest 替换正文和标签；缺省的 journal 不改变已有时间线元数据。
type saveRequest struct {
	Title     *string             `json:"title"`
	ContentMD *string             `json:"content_md"`
	Tags      *[]string           `json:"tags"`
	Journal   *appnote.JournalDTO `json:"journal"`
}

func decodeSaveRequest(w http.ResponseWriter, r *http.Request) (saveRequest, bool) {
	var req saveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return saveRequest{}, false
	}
	if req.ContentMD == nil {
		response.RespondError(w, r, shared.BadRequest("保存请求必须包含 content_md"))
		return saveRequest{}, false
	}
	return req, true
}

func (req saveRequest) title() string {
	if req.Title == nil {
		return ""
	}
	return *req.Title
}

func (req saveRequest) tags() []string {
	if req.Tags == nil {
		return nil
	}
	return *req.Tags
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeSaveRequest(w, r)
	if !ok {
		return
	}
	dto, err := h.service.Create(r.Context(), appnote.CreateInput{
		UserID:    ifmw.GetUserIDFromContext(r),
		Title:     req.title(),
		ContentMD: *req.ContentMD,
		Tags:      req.tags(),
		Journal:   req.Journal,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeSaveRequest(w, r)
	if !ok {
		return
	}
	dto, err := h.service.Update(r.Context(), appnote.UpdateInput{
		NoteID:    r.PathValue("id"),
		Title:     req.title(),
		ContentMD: *req.ContentMD,
		Tags:      req.tags(),
		Journal:   req.Journal,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	dto, err := h.service.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	items, total, err := h.service.List(r.Context(), appnote.ListQuery{
		Status: r.URL.Query().Get("status"),
		Page:   page,
		Limit:  limit,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
}

func (h *Handler) Publish(w http.ResponseWriter, r *http.Request) {
	dto, err := h.service.Publish(r.Context(), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.service.Delete(r.Context(), r.PathValue("id")); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

func (h *Handler) BrowsePublished(w http.ResponseWriter, r *http.Request) {
	cursor, limit := response.ParseCursor(r)
	search := r.URL.Query()
	items, next, err := h.service.BrowsePublished(r.Context(), appnote.BrowseQuery{
		Cursor: cursor, Limit: limit, TagSlug: search.Get("tag"),
		Type: domainnote.Type(search.Get("type")), ProjectID: search.Get("project_id"),
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCursor(w, items, limit, next != "", next)
}

func (h *Handler) GetPublished(w http.ResponseWriter, r *http.Request) {
	dto, err := h.service.GetPublished(r.Context(), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}
