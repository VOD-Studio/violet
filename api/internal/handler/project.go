package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"blog-api/internal/service"
)

// ProjectHandler 项目接口处理器
type ProjectHandler struct {
	projectService *service.ProjectService
	validate       *validator.Validate
}

// NewProjectHandler 创建项目处理器实例
func NewProjectHandler(projectService *service.ProjectService) *ProjectHandler {
	return &ProjectHandler{
		projectService: projectService,
		validate:       validator.New(),
	}
}

// List 项目列表
// GET /api/projects
func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	projects, err := h.projectService.ListProjects(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "查询项目列表失败")
		return
	}

	type projectItem struct {
		ID          string   `json:"id"`
		Title       string   `json:"title"`
		Description *string  `json:"description,omitempty"`
		URL         *string  `json:"url,omitempty"`
		GithubURL   *string  `json:"github_url,omitempty"`
		ImageURL    *string  `json:"image_url,omitempty"`
		TechStack   []string `json:"tech_stack"`
		SortOrder   int32    `json:"sort_order"`
		CreatedAt   string   `json:"created_at"`
		UpdatedAt   string   `json:"updated_at"`
	}

	items := make([]projectItem, 0, len(projects))
	for _, p := range projects {
		item := projectItem{
			ID:        p.ID.String(),
			Title:     p.Title,
			TechStack: p.TechStack,
			SortOrder: p.SortOrder,
			CreatedAt: p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt: p.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
		if p.Description.Valid {
			item.Description = &p.Description.String
		}
		if p.Url.Valid {
			item.URL = &p.Url.String
		}
		if p.GithubUrl.Valid {
			item.GithubURL = &p.GithubUrl.String
		}
		if p.ImageUrl.Valid {
			item.ImageURL = &p.ImageUrl.String
		}
		items = append(items, item)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"projects": items,
	})
}

// GetByID 获取项目详情
// GET /api/projects/{id}
func (h *ProjectHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的项目 ID")
		return
	}

	project, err := h.projectService.GetProjectByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrProjectNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "项目不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "查询项目失败")
		return
	}

	description := ""
	if project.Description.Valid {
		description = project.Description.String
	}
	url := ""
	if project.Url.Valid {
		url = project.Url.String
	}
	githubURL := ""
	if project.GithubUrl.Valid {
		githubURL = project.GithubUrl.String
	}
	imageURL := ""
	if project.ImageUrl.Valid {
		imageURL = project.ImageUrl.String
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":          project.ID.String(),
		"title":       project.Title,
		"description": description,
		"url":         url,
		"github_url":  githubURL,
		"image_url":   imageURL,
		"tech_stack":  project.TechStack,
		"sort_order":  project.SortOrder,
		"created_at":  project.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		"updated_at":  project.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
}

// Create 创建项目
// POST /api/admin/projects
// 需要认证 + 管理员权限
func (h *ProjectHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	project, err := h.projectService.CreateProject(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "创建项目失败")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":         project.ID.String(),
		"title":      project.Title,
		"sort_order": project.SortOrder,
	})
}

// Update 更新项目
// PUT /api/admin/projects/{id}
// 需要认证 + 管理员权限
func (h *ProjectHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的项目 ID")
		return
	}

	var req service.UpdateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	project, err := h.projectService.UpdateProject(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, service.ErrProjectNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "项目不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "更新项目失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":         project.ID.String(),
		"title":      project.Title,
		"sort_order": project.SortOrder,
	})
}

// Delete 删除项目
// DELETE /api/admin/projects/{id}
// 需要认证 + 管理员权限
func (h *ProjectHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的项目 ID")
		return
	}

	if err := h.projectService.DeleteProject(r.Context(), id); err != nil {
		if errors.Is(err, service.ErrProjectNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "项目不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "删除项目失败")
		return
	}

	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "项目已删除",
	})
}
