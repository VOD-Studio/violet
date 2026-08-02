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

// ---- admin 分组接口（按菜单子页拆分）----
//
// 原 GET/PUT /admin/settings 一次性返回/接收全量聚合，已拆成 7 组子接口：
//   /admin/settings/general      基础信息
//   /admin/settings/auth         第三方登录开关
//   /admin/settings/github       GitHub 资料
//   /admin/settings/profile      关于博主内容
//   /admin/settings/about        关于页区块版面配置
//   /admin/settings/llm          LLM 配置
//   /admin/settings/code-runner  代码运行器
//
// 每组 GET 只返回该组字段，PUT 只接收该组字段（指针表部分更新，nil 不动）。
// 前端各子页独立 queryKey，互不干扰，消除回填竞态。

// GetGeneral 获取基础信息组
func (h *Handler) GetGeneral(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetGeneral(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// UpdateGeneral 更新基础信息组
func (h *Handler) UpdateGeneral(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SiteName           *string `json:"site_name"`
		SiteDescription    *string `json:"site_description"`
		SiteURL            *string `json:"site_url"`
		AdminEmail         *string `json:"admin_email"`
		PostsPerPage       *int    `json:"posts_per_page"`
		CommentsEnabled    *bool   `json:"comments_enabled"`
		CommentsModeration *bool   `json:"comments_moderation"`
		TechStack          *string `json:"tech_stack"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	data, err := h.svc.UpdateGeneral(r.Context(), appsettings.GeneralUpdate{
		SiteName: req.SiteName, SiteDescription: req.SiteDescription,
		SiteURL: req.SiteURL, AdminEmail: req.AdminEmail,
		PostsPerPage: req.PostsPerPage, CommentsEnabled: req.CommentsEnabled,
		CommentsModeration: req.CommentsModeration, TechStack: req.TechStack,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetAuth 获取认证组
func (h *Handler) GetAuth(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetAuth(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// UpdateAuth 更新认证组
func (h *Handler) UpdateAuth(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GoogleLoginEnabled *bool `json:"google_login_enabled"`
		GithubLoginEnabled *bool `json:"github_login_enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	data, err := h.svc.UpdateAuth(r.Context(), appsettings.AuthUpdate{
		GoogleLoginEnabled: req.GoogleLoginEnabled, GithubLoginEnabled: req.GithubLoginEnabled,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetGithub 获取 GitHub 组
func (h *Handler) GetGithub(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetGithub(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// UpdateGithub 更新 GitHub 组
func (h *Handler) UpdateGithub(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GitHubUsername *string `json:"github_username"`
		GitHubToken    *string `json:"github_token"`
		ReleasesRepo   *string `json:"releases_repo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	data, err := h.svc.UpdateGithub(r.Context(), appsettings.GithubUpdate{
		GitHubUsername: req.GitHubUsername, GitHubToken: req.GitHubToken,
		ReleasesRepo: req.ReleasesRepo,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetProfile 获取关于博主组
func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetProfile(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// UpdateProfile 更新关于博主组
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Bio             *string `json:"bio"`
		FooterText      *string `json:"footer_text"`
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
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	data, err := h.svc.UpdateProfile(r.Context(), appsettings.ProfileUpdate{
		Bio: req.Bio, FooterText: req.FooterText,
		AvatarURL: req.AvatarURL, Tagline: req.Tagline,
		ProfileRole: req.ProfileRole, ProfileLocation: req.ProfileLocation,
		AvailableFor: req.AvailableFor, SkillsStrong: req.SkillsStrong,
		SkillsLearning: req.SkillsLearning, SkillsInterests: req.SkillsInterests,
		SocialTwitter: req.SocialTwitter, SocialMastodon: req.SocialMastodon,
		SocialEmail: req.SocialEmail, SocialRss: req.SocialRss, SocialBilibili: req.SocialBilibili,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetAbout 获取关于页区块配置组
func (h *Handler) GetAbout(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetAbout(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// UpdateAbout 更新关于页区块配置组
func (h *Handler) UpdateAbout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AboutConfig *json.RawMessage `json:"about_config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	data, err := h.svc.UpdateAbout(r.Context(), appsettings.AboutUpdate{
		AboutConfig: req.AboutConfig,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetLlm 获取 LLM 组
func (h *Handler) GetLlm(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetLlm(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// UpdateLlm 更新 LLM 组
func (h *Handler) UpdateLlm(w http.ResponseWriter, r *http.Request) {
	var req struct {
		LLMAPIKey   *string `json:"llm_api_key"`
		LLMAPIURL   *string `json:"llm_api_url"`
		LLMModel    *string `json:"llm_model"`
		LLMProtocol *string `json:"llm_protocol"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	data, err := h.svc.UpdateLlm(r.Context(), appsettings.LlmUpdate{
		LLMAPIKey: req.LLMAPIKey, LLMAPIURL: req.LLMAPIURL,
		LLMModel: req.LLMModel, LLMProtocol: req.LLMProtocol,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetCodeRunner 获取代码运行器组
func (h *Handler) GetCodeRunner(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetCodeRunner(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// UpdateCodeRunner 更新代码运行器组
func (h *Handler) UpdateCodeRunner(w http.ResponseWriter, r *http.Request) {
	var req struct {
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
	data, err := h.svc.UpdateCodeRunner(r.Context(), appsettings.CodeRunnerUpdate{
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
