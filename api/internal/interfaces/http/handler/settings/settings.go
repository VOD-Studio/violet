// Package settings 提供 settings 模块的 HTTP handler。
package settings

import (
	"encoding/json"
	"net/http"

	appsettings "blog-api/internal/application/settings"
	"blog-api/internal/interfaces/http/response"
)

// Handler 站点配置 HTTP handler
type Handler struct {
	svc *appsettings.Service
}

// NewHandler 构造配置 handler
func NewHandler(svc *appsettings.Service) *Handler {
	return &Handler{svc: svc}
}

// GetPublicSettings 获取公开站点配置（不含敏感字段）
func (h *Handler) GetPublicSettings(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetPublic(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetSettings 获取全部站点配置（含敏感字段，需管理员）
func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetAll(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// UpdateSettings 更新站点配置
func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SiteName           *string `json:"site_name"`
		SiteDescription    *string `json:"site_description"`
		SiteURL            *string `json:"site_url"`
		AdminEmail         *string `json:"admin_email"`
		PostsPerPage       *int    `json:"posts_per_page"`
		CommentsEnabled    *bool   `json:"comments_enabled"`
		CommentsModeration *bool   `json:"comments_moderation"`
		GoogleLoginEnabled *bool   `json:"google_login_enabled"`
		GithubLoginEnabled *bool   `json:"github_login_enabled"`
		GitHubUsername     *string `json:"github_username"`
		GitHubToken        *string `json:"github_token"`
		TechStack          *string `json:"tech_stack"`
		Bio                *string `json:"bio"`
		FooterText         *string `json:"footer_text"`
		LLMAPIKey          *string `json:"llm_api_key"`
		LLMAPIURL          *string `json:"llm_api_url"`
		LLMModel           *string `json:"llm_model"`
		LLMProtocol        *string `json:"llm_protocol"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	data, err := h.svc.Update(r.Context(), appsettings.UpdateInput{
		SiteName: req.SiteName, SiteDescription: req.SiteDescription,
		SiteURL: req.SiteURL, AdminEmail: req.AdminEmail,
		PostsPerPage: req.PostsPerPage, CommentsEnabled: req.CommentsEnabled,
		CommentsModeration: req.CommentsModeration,
		GoogleLoginEnabled: req.GoogleLoginEnabled, GithubLoginEnabled: req.GithubLoginEnabled,
		GitHubUsername: req.GitHubUsername, GitHubToken: req.GitHubToken,
		TechStack: req.TechStack, Bio: req.Bio, FooterText: req.FooterText,
		LLMAPIKey: req.LLMAPIKey, LLMAPIURL: req.LLMAPIURL,
		LLMModel: req.LLMModel, LLMProtocol: req.LLMProtocol,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}
