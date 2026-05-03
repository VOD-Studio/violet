package handler

import (
	"encoding/json"
	"net/http"

	"blog-api/internal/service"
)

// SettingsHandler 站点设置接口处理器
type SettingsHandler struct {
	settingsService *service.SettingsService
}

// NewSettingsHandler 创建站点设置处理器实例
func NewSettingsHandler(settingsService *service.SettingsService) *SettingsHandler {
	return &SettingsHandler{
		settingsService: settingsService,
	}
}

// PublicSettings 公开的站点设置，不包含敏感信息
type PublicSettings struct {
	SiteName        string `json:"site_name"`
	SiteDescription string `json:"site_description"`
	GitHubUsername  string `json:"github_username"`
	FooterText      string `json:"footer_text"`
}

// GetPublicSettings 获取公开站点设置
// GET /api/v1/settings
// 无需认证，返回非敏感的站点配置
func (h *SettingsHandler) GetPublicSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.settingsService.GetAllSettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取站点设置失败")
		return
	}

	public := PublicSettings{
		SiteName:        settings.SiteName,
		SiteDescription: settings.SiteDescription,
		GitHubUsername:  settings.GitHubUsername,
		FooterText:      settings.FooterText,
	}

	writeJSON(w, http.StatusOK, public)
}

// GetSettings 获取站点设置
// GET /api/v1/admin/settings
// 需要管理员认证，返回所有站点配置项
func (h *SettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.settingsService.GetAllSettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取站点设置失败")
		return
	}

	writeJSON(w, http.StatusOK, settings)
}

// UpdateSettings 更新站点设置
// PUT /api/v1/admin/settings
// 需要管理员认证，支持部分更新（只传需要修改的字段）
func (h *SettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req service.UpdateSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	settings, err := h.settingsService.UpdateSettings(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "更新站点设置失败")
		return
	}

	writeJSON(w, http.StatusOK, settings)
}
