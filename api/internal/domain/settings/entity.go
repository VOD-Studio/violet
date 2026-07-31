// Package settings 提供站点设置的领域模型。
//
// 站点设置以 key-value 表存储，本包定义配置读模型与更新入参，
// 并通过 SettingsStore 端口解耦基础设施实现。
package settings

import (
	"context"
	"strconv"

	"blog-api/internal/domain/shared"
)

// SiteSettings 站点配置读模型（聚合全部配置项）
type SiteSettings struct {
	SiteName           string `json:"site_name"`
	SiteDescription    string `json:"site_description"`
	SiteURL            string `json:"site_url"`
	AdminEmail         string `json:"admin_email"`
	PostsPerPage       int    `json:"posts_per_page"`
	CommentsEnabled    bool   `json:"comments_enabled"`
	CommentsModeration bool   `json:"comments_moderation"`
	GoogleLoginEnabled bool   `json:"google_login_enabled"`
	GithubLoginEnabled bool   `json:"github_login_enabled"`
	GitHubUsername     string `json:"github_username"`
	GitHubToken        string `json:"github_token"`
	TechStack          string `json:"tech_stack"`
	Bio                string `json:"bio"`
	FooterText         string `json:"footer_text"`
	// AboutConfig 关于页区块版面配置（聚合 JSON 字符串，前台按 {sections:[{id,enabled,order,params}]} 渲染）。
	// 后端透明存储原始 JSON，不解析——解析与校验在前端消费侧。
	AboutConfig string `json:"about_config"`
	// 关于博主（A 线）内容字段：头像/标语/名片/技能/社交矩阵
	AvatarURL        string `json:"avatar_url"`
	Tagline          string `json:"tagline"`
	ProfileRole      string `json:"profile_role"`
	ProfileLocation  string `json:"profile_location"`
	AvailableFor     string `json:"available_for"`
	SkillsStrong     string `json:"skills_strong"`
	SkillsLearning   string `json:"skills_learning"`
	SkillsInterests  string `json:"skills_interests"`
	SocialTwitter    string `json:"social_twitter"`
	SocialMastodon   string `json:"social_mastodon"`
	SocialEmail      string `json:"social_email"`
	SocialRss        string `json:"social_rss"`
	SocialBilibili   string `json:"social_bilibili"`
	// ReleasesRepo 更新日志区块读取的 GitHub 仓库名（owner/repo 或 repo，配合 github_username）
	ReleasesRepo string `json:"releases_repo"`
	// ProjectMilestones 项目时间轴的手工里程碑（聚合 JSON 字符串，{milestones:[{date,title,description,link}]}）
	ProjectMilestones string `json:"project_milestones"`
	// B5/B6/B7 项目向区块内容（均为聚合 JSON 字符串，后端透明存储，前端解析）
	ProjectStack string `json:"project_stack"` // {stack:[{name,icon,purpose}]}
	BlogNumbers  string `json:"blog_numbers"`  // {numbers:[{label,value}]}
	Thanks       string `json:"thanks"`        // {thanks:[{name,url,reason}]}
	// LLM 配置（OpenAI 协议兼容端点，覆盖 OpenAI/DeepSeek/Moonshot/通义/智谱/Ollama/vLLM）
	LLMAPIKey   string `json:"llm_api_key"`
	LLMAPIURL   string `json:"llm_api_url"`
	LLMModel    string `json:"llm_model"`
	LLMProtocol string `json:"llm_protocol"`
	// 代码运行器配置（运行时可改，见 ADR-0006）
	CodeRunnerEnabled       bool    `json:"code_runner_enabled"`
	CodeRunnerMaxCPUCores   float64 `json:"code_runner_max_cpu_cores"`
	CodeRunnerMaxMemoryMB   uint64  `json:"code_runner_max_memory_mb"`
	CodeRunnerMaxTimeoutSecs uint64  `json:"code_runner_max_timeout_secs"`
	CodeRunnerMaxOutputBytes uint64  `json:"code_runner_max_output_bytes"`
	CodeRunnerMaxSourceBytes uint64  `json:"code_runner_max_source_bytes"`
	CodeRunnerAllowNetwork  bool    `json:"code_runner_allow_network"`
	CodeRunnerLanguages     string  `json:"code_runner_languages"`
}

// UpdateInput 更新入参（指针字段表部分更新，nil 不更新）
type UpdateInput struct {
	SiteName           *string
	SiteDescription    *string
	SiteURL            *string
	AdminEmail         *string
	PostsPerPage       *int
	CommentsEnabled    *bool
	CommentsModeration *bool
	GoogleLoginEnabled *bool
	GithubLoginEnabled *bool
	GitHubUsername     *string
	GitHubToken        *string
	TechStack          *string
	Bio                *string
	FooterText         *string
	AboutConfig        *string
	// 关于博主（A 线）内容字段
	AvatarURL       *string
	Tagline         *string
	ProfileRole     *string
	ProfileLocation *string
	AvailableFor    *string
	SkillsStrong    *string
	SkillsLearning  *string
	SkillsInterests *string
	SocialTwitter   *string
	SocialMastodon  *string
	SocialEmail     *string
	SocialRss       *string
	SocialBilibili  *string
	ReleasesRepo      *string
	ProjectMilestones *string
	ProjectStack      *string
	BlogNumbers       *string
	Thanks            *string
	LLMAPIKey         *string
	LLMAPIURL          *string
	LLMModel           *string
	LLMProtocol        *string
	CodeRunnerEnabled        *bool
	CodeRunnerMaxCPUCores    *float64
	CodeRunnerMaxMemoryMB    *uint64
	CodeRunnerMaxTimeoutSecs *uint64
	CodeRunnerMaxOutputBytes *uint64
	CodeRunnerMaxSourceBytes *uint64
	CodeRunnerAllowNetwork   *bool
	CodeRunnerLanguages      *string
}

// SettingsStore 站点配置存储端口（infrastructure 层实现）
type SettingsStore interface {
	// GetAll 读取全部配置键值对
	GetAll(ctx context.Context) (map[string]string, error)
	// Upsert 写入或更新单个配置
	Upsert(ctx context.Context, key, value string) error
	// UpsertMany 批量写入或更新多个配置（单事务，原子）
	UpsertMany(ctx context.Context, kvs map[string]string) error
}

// MergeFrom 从键值对还原配置读模型
func (s SiteSettings) MergeFrom(m map[string]string) SiteSettings {
	return fromMap(m)
}

// 从 map 还原配置读模型
func fromMap(m map[string]string) SiteSettings {
	s := SiteSettings{PostsPerPage: 10}
	s.SiteName = m["site_name"]
	s.SiteDescription = m["site_description"]
	s.SiteURL = m["site_url"]
	s.AdminEmail = m["admin_email"]
	if v, ok := parseInt(m["posts_per_page"]); ok {
		s.PostsPerPage = v
	}
	s.CommentsEnabled = m["comments_enabled"] == "true"
	s.CommentsModeration = m["comments_moderation"] == "true"
	s.GoogleLoginEnabled = parseBoolDefaultTrue(m["google_login_enabled"])
	s.GithubLoginEnabled = parseBoolDefaultTrue(m["github_login_enabled"])
	s.GitHubUsername = m["github_username"]
	s.GitHubToken = m["github_token"]
	s.TechStack = m["tech_stack"]
	s.Bio = m["bio"]
	s.FooterText = m["footer_text"]
	s.AboutConfig = m["about_config"]
	// 关于博主（A 线）内容字段
	s.AvatarURL = m["avatar_url"]
	s.Tagline = m["tagline"]
	s.ProfileRole = m["profile_role"]
	s.ProfileLocation = m["profile_location"]
	s.AvailableFor = m["available_for"]
	s.SkillsStrong = m["skills_strong"]
	s.SkillsLearning = m["skills_learning"]
	s.SkillsInterests = m["skills_interests"]
	s.SocialTwitter = m["social_twitter"]
	s.SocialMastodon = m["social_mastodon"]
	s.SocialEmail = m["social_email"]
	s.SocialRss = m["social_rss"]
	s.SocialBilibili = m["social_bilibili"]
	s.ReleasesRepo = m["releases_repo"]
	s.ProjectMilestones = m["project_milestones"]
	s.ProjectStack = m["project_stack"]
	s.BlogNumbers = m["blog_numbers"]
	s.Thanks = m["thanks"]
	s.LLMAPIKey = m["llm_api_key"]
	s.LLMAPIURL = m["llm_api_url"]
	s.LLMModel = m["llm_model"]
	s.LLMProtocol = m["llm_protocol"]
	// 代码运行器：enabled 默认 true（parseBoolDefaultTrue，老站点升级无感）；
	// 资源阈值为 0 表示未配置，消费方 fallback 到 env config（见 application/coderunner/service.go）。
	s.CodeRunnerEnabled = parseBoolDefaultTrue(m["code_runner_enabled"])
	s.CodeRunnerMaxCPUCores = parseFloat(m["code_runner_max_cpu_cores"])
	s.CodeRunnerMaxMemoryMB = parseUint64(m["code_runner_max_memory_mb"])
	s.CodeRunnerMaxTimeoutSecs = parseUint64(m["code_runner_max_timeout_secs"])
	s.CodeRunnerMaxOutputBytes = parseUint64(m["code_runner_max_output_bytes"])
	s.CodeRunnerMaxSourceBytes = parseUint64(m["code_runner_max_source_bytes"])
	s.CodeRunnerAllowNetwork = m["code_runner_allow_network"] == "true"
	s.CodeRunnerLanguages = m["code_runner_languages"]
	return s
}

// parseBoolDefaultTrue 解析布尔配置，未设置时默认启用。
// 键存在时按 "true"/"false" 解析；键不存在时返回 true，保证升级后已有功能不中断。
func parseBoolDefaultTrue(v string) bool {
	return v == "" || v == "true"
}

func parseInt(s string) (int, bool) {
	if s == "" {
		return 0, false
	}
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, false
		}
		n = n*10 + int(c-'0')
	}
	return n, true
}

// parseUint64 解析无符号整数，空串/非法返回 0（消费方据此 fallback 默认值）。
func parseUint64(s string) uint64 {
	if s == "" {
		return 0
	}
	var n uint64
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + uint64(c-'0')
	}
	return n
}

// parseFloat 解析浮点数，空串/非法返回 0（消费方据此 fallback 默认值）。
// 支持小数（如 "2.5"），用 strconv 保证精度。
func parseFloat(s string) float64 {
	if s == "" {
		return 0
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return v
}

// ErrInvalidSetting 无效配置
var ErrInvalidSetting = shared.BadRequest("无效的站点配置")

// ErrOAuthProviderDisabled OAuth 登录方式已被管理员禁用
var ErrOAuthProviderDisabled = shared.BadRequest("该登录方式已禁用")
