// Package settings 提供站点配置的应用用例。
package settings

import (
	"encoding/json"

	domainsettings "blog-api/internal/domain/settings"
)

// 本文件定义 admin 分组视图。
//
// 站点设置在领域层是单一聚合根（domain SiteSettings），公开接口与其他用例
// （auth OAuth 判断、github/releases 数据读取）都复用聚合 GetAll。
//
// 但 admin 后台按职责拆成 7 个菜单子页，每个子页只关心本组字段。
// 一次性返回全量聚合会带来两个问题：
//  1. 回填竞态——任一子页编辑期间若聚合 data 因 refetch 变化，useForm.reset
//     会用服务端值覆盖未保存编辑（about_config 是嵌套对象，最易踩中）。
//  2. 子页拿到无关字段，耦合面大。
//
// 故在应用层定义分组视图：GET 返回该组字段子集，PUT 只接收该组字段。
// 每组独立 queryKey 后，子页间互不干扰。聚合 SiteSettings 与底层 key-value
// 存储不变，公开接口与既有用例零影响。

// ---- 分组读模型（admin GET 返回视图，聚合字段的子集）----

// GeneralView 基础信息组：站点名称/URL/页脚文案/分页/评论开关/技术栈
type GeneralView struct {
	SiteName           string `json:"site_name"`
	SiteURL            string `json:"site_url"`
	FooterText         string `json:"footer_text"`
	PostsPerPage       int    `json:"posts_per_page"`
	CommentsEnabled    bool   `json:"comments_enabled"`
	CommentsModeration bool   `json:"comments_moderation"`
	TechStack          string `json:"tech_stack"`
	// CustomEmojiMaxPerUser 单用户自定义表情份额上限（0 表示未配置，前端显示时按 env 默认兜底）
	CustomEmojiMaxPerUser int `json:"custom_emoji_max_per_user"`
}

// AuthView 认证组：第三方登录开关
type AuthView struct {
	GoogleLoginEnabled bool `json:"google_login_enabled"`
	GithubLoginEnabled bool `json:"github_login_enabled"`
}

// GithubView GitHub 组：用户名/Token/更新日志仓库名
type GithubView struct {
	GitHubUsername string `json:"github_username"`
	GitHubToken    string `json:"github_token"`
	ReleasesRepo   string `json:"releases_repo"`
}

// ProfileView 关于博主组：简介/头像/标语/名片/技能/社交矩阵
type ProfileView struct {
	Bio             string `json:"bio"`
	AvatarURL       string `json:"avatar_url"`
	Tagline         string `json:"tagline"`
	ProfileRole     string `json:"profile_role"`
	ProfileLocation string `json:"profile_location"`
	AvailableFor    string `json:"available_for"`
	SkillsStrong    string `json:"skills_strong"`
	SkillsLearning  string `json:"skills_learning"`
	SkillsInterests string `json:"skills_interests"`
	SocialTwitter   string `json:"social_twitter"`
	SocialMastodon  string `json:"social_mastodon"`
	SocialEmail     string `json:"social_email"`
	SocialRss       string `json:"social_rss"`
	SocialBilibili  string `json:"social_bilibili"`
}

// AboutView 关于页区块配置组：about_config（原生 JSON 对象）
type AboutView struct {
	AboutConfig json.RawMessage `json:"about_config"`
}

// LlmView LLM 组：API Key/URL/模型/协议
type LlmView struct {
	LLMAPIKey   string `json:"llm_api_key"`
	LLMAPIURL   string `json:"llm_api_url"`
	LLMModel    string `json:"llm_model"`
	LLMProtocol string `json:"llm_protocol"`
}

// CodeRunnerView 代码运行器组：开关 + 资源阈值 + 语言白名单
type CodeRunnerView struct {
	CodeRunnerEnabled        bool    `json:"code_runner_enabled"`
	CodeRunnerMaxCPUCores    float64 `json:"code_runner_max_cpu_cores"`
	CodeRunnerMaxMemoryMB    uint64  `json:"code_runner_max_memory_mb"`
	CodeRunnerMaxTimeoutSecs uint64  `json:"code_runner_max_timeout_secs"`
	CodeRunnerMaxOutputBytes uint64  `json:"code_runner_max_output_bytes"`
	CodeRunnerMaxSourceBytes uint64  `json:"code_runner_max_source_bytes"`
	CodeRunnerAllowNetwork   bool    `json:"code_runner_allow_network"`
	CodeRunnerLanguages      string  `json:"code_runner_languages"`
}

// ---- 从聚合读模型构造分组视图 ----

func generalView(s domainsettings.SiteSettings) GeneralView {
	return GeneralView{
		SiteName:              s.SiteName,
		SiteURL:               s.SiteURL,
		FooterText:            s.FooterText,
		PostsPerPage:          s.PostsPerPage,
		CommentsEnabled:       s.CommentsEnabled,
		CommentsModeration:    s.CommentsModeration,
		TechStack:             s.TechStack,
		CustomEmojiMaxPerUser: s.CustomEmojiMaxPerUser,
	}
}

func authView(s domainsettings.SiteSettings) AuthView {
	return AuthView{
		GoogleLoginEnabled: s.GoogleLoginEnabled,
		GithubLoginEnabled: s.GithubLoginEnabled,
	}
}

func githubView(s domainsettings.SiteSettings) GithubView {
	return GithubView{
		GitHubUsername: s.GitHubUsername,
		GitHubToken:    s.GitHubToken,
		ReleasesRepo:   s.ReleasesRepo,
	}
}

func profileView(s domainsettings.SiteSettings) ProfileView {
	return ProfileView{
		Bio:             s.Bio,
		AvatarURL:       s.AvatarURL,
		Tagline:         s.Tagline,
		ProfileRole:     s.ProfileRole,
		ProfileLocation: s.ProfileLocation,
		AvailableFor:    s.AvailableFor,
		SkillsStrong:    s.SkillsStrong,
		SkillsLearning:  s.SkillsLearning,
		SkillsInterests: s.SkillsInterests,
		SocialTwitter:   s.SocialTwitter,
		SocialMastodon:  s.SocialMastodon,
		SocialEmail:     s.SocialEmail,
		SocialRss:       s.SocialRss,
		SocialBilibili:  s.SocialBilibili,
	}
}

func aboutView(s domainsettings.SiteSettings) AboutView {
	return AboutView{AboutConfig: s.AboutConfig}
}

func llmView(s domainsettings.SiteSettings) LlmView {
	return LlmView{
		LLMAPIKey:   s.LLMAPIKey,
		LLMAPIURL:   s.LLMAPIURL,
		LLMModel:    s.LLMModel,
		LLMProtocol: s.LLMProtocol,
	}
}

func codeRunnerView(s domainsettings.SiteSettings) CodeRunnerView {
	return CodeRunnerView{
		CodeRunnerEnabled:        s.CodeRunnerEnabled,
		CodeRunnerMaxCPUCores:    s.CodeRunnerMaxCPUCores,
		CodeRunnerMaxMemoryMB:    s.CodeRunnerMaxMemoryMB,
		CodeRunnerMaxTimeoutSecs: s.CodeRunnerMaxTimeoutSecs,
		CodeRunnerMaxOutputBytes: s.CodeRunnerMaxOutputBytes,
		CodeRunnerMaxSourceBytes: s.CodeRunnerMaxSourceBytes,
		CodeRunnerAllowNetwork:   s.CodeRunnerAllowNetwork,
		CodeRunnerLanguages:      s.CodeRunnerLanguages,
	}
}

// ---- 分组更新入参（指针字段表部分更新，nil 不更新）----
// 字段与 domain UpdateInput 对齐，每组只含本组字段；service 方法映射成
// domain.UpdateInput 的子集后复用 s.Update，未提供字段保持不变。

// GeneralUpdate 基础信息组更新入参
type GeneralUpdate struct {
	SiteName              *string
	SiteURL               *string
	FooterText            *string
	PostsPerPage          *int
	CommentsEnabled       *bool
	CommentsModeration    *bool
	TechStack             *string
	CustomEmojiMaxPerUser *int
}

// AuthUpdate 认证组更新入参
type AuthUpdate struct {
	GoogleLoginEnabled *bool
	GithubLoginEnabled *bool
}

// GithubUpdate GitHub 组更新入参
type GithubUpdate struct {
	GitHubUsername *string
	GitHubToken    *string
	ReleasesRepo   *string
}

// ProfileUpdate 关于博主组更新入参
type ProfileUpdate struct {
	Bio             *string
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
}

// AboutUpdate 关于页区块配置组更新入参
type AboutUpdate struct {
	AboutConfig *json.RawMessage
}

// LlmUpdate LLM 组更新入参
type LlmUpdate struct {
	LLMAPIKey   *string
	LLMAPIURL   *string
	LLMModel    *string
	LLMProtocol *string
}

// CodeRunnerUpdate 代码运行器组更新入参
type CodeRunnerUpdate struct {
	CodeRunnerEnabled        *bool
	CodeRunnerMaxCPUCores    *float64
	CodeRunnerMaxMemoryMB    *uint64
	CodeRunnerMaxTimeoutSecs *uint64
	CodeRunnerMaxOutputBytes *uint64
	CodeRunnerMaxSourceBytes *uint64
	CodeRunnerAllowNetwork   *bool
	CodeRunnerLanguages      *string
}
