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
		AboutConfig        *string `json:"about_config"`
		// 关于博主（A 线）内容字段
		AvatarURL       *string `json:"avatar_url"`
		Tagline         *string `json:"tagline"`
		ProfileRole     *string `json:"profile_role"`
		ProfileLocation *string `json:"profile_location"`
		AvailableFor    *string `json:"available_for"`
		SkillsStrong    *string `json:"skills_strong"`
		SkillsLearning  *string `json:"skills_learning"`
		SkillsInterests *string `json:"skills_interests"`
		SocialTwitter   *string `json:"social_twitter"`
		SocialMastodon  *string `json:"social_mastodon"`
		SocialEmail     *string `json:"social_email"`
		SocialRss       *string `json:"social_rss"`
		SocialBilibili  *string `json:"social_bilibili"`
		ReleasesRepo    *string `json:"releases_repo"`
		LLMAPIKey       *string `json:"llm_api_key"`
		LLMAPIURL          *string `json:"llm_api_url"`
		LLMModel           *string `json:"llm_model"`
		LLMProtocol        *string `json:"llm_protocol"`
		CodeRunnerEnabled        *bool    `json:"code_runner_enabled"`
		CodeRunnerMaxCPUCores    *float64 `json:"code_runner_max_cpu_cores"`
		CodeRunnerMaxMemoryMB    *uint64  `json:"code_runner_max_memory_mb"`
		CodeRunnerMaxTimeoutSecs *uint64  `json:"code_runner_max_timeout_secs"`
		CodeRunnerMaxOutputBytes *uint64  `json:"code_runner_max_output_bytes"`
		CodeRunnerMaxSourceBytes *uint64  `json:"code_runner_max_source_bytes"`
		CodeRunnerAllowNetwork   *bool    `json:"code_runner_allow_network"`
		CodeRunnerLanguages      *string  `json:"code_runner_languages"`
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
		AboutConfig: req.AboutConfig,
		AvatarURL: req.AvatarURL, Tagline: req.Tagline,
		ProfileRole: req.ProfileRole, ProfileLocation: req.ProfileLocation,
		AvailableFor: req.AvailableFor, SkillsStrong: req.SkillsStrong,
		SkillsLearning: req.SkillsLearning, SkillsInterests: req.SkillsInterests,
		SocialTwitter: req.SocialTwitter, SocialMastodon: req.SocialMastodon,
		SocialEmail: req.SocialEmail, SocialRss: req.SocialRss, SocialBilibili: req.SocialBilibili,
		ReleasesRepo: req.ReleasesRepo,
		LLMAPIKey: req.LLMAPIKey, LLMAPIURL: req.LLMAPIURL,
		LLMModel: req.LLMModel, LLMProtocol: req.LLMProtocol,
		CodeRunnerEnabled:        req.CodeRunnerEnabled,
		CodeRunnerMaxCPUCores:    req.CodeRunnerMaxCPUCores,
		CodeRunnerMaxMemoryMB:    req.CodeRunnerMaxMemoryMB,
		CodeRunnerMaxTimeoutSecs: req.CodeRunnerMaxTimeoutSecs,
		CodeRunnerMaxOutputBytes: req.CodeRunnerMaxOutputBytes,
		CodeRunnerMaxSourceBytes: req.CodeRunnerMaxSourceBytes,
		CodeRunnerAllowNetwork:   req.CodeRunnerAllowNetwork,
		CodeRunnerLanguages:      req.CodeRunnerLanguages,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}
