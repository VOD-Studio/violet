package settings

import (
	"encoding/json"

	domainsettings "blog-api/internal/domain/settings"
)

// GeneralView 基础信息组：站点名称/URL/页脚文案/分页/评论开关/技术栈
type GeneralView struct {
	SiteName             string `json:"site_name"`
	SiteURL              string `json:"site_url"`
	FooterText           string `json:"footer_text"`
	FooterGitHubURL      string `json:"footer_github_url"`
	PostsPerPage         int    `json:"posts_per_page"`
	HomeFootprintEnabled bool   `json:"home_footprint_enabled"`
	// HomeFootprintAggregationDays 单个节点聚合天数，合法范围 1–31
	HomeFootprintAggregationDays int    `json:"home_footprint_aggregation_days"`
	CommentsEnabled              bool   `json:"comments_enabled"`
	CommentsModeration           bool   `json:"comments_moderation"`
	TechStack                    string `json:"tech_stack"`
	// CustomEmojiMaxPerUser 0 禁止新增自定义表情；恢复部署默认通过 reset。
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
	GitHubTokenSet bool   `json:"github_token_set"`
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
	LLMAPIKeySet bool   `json:"llm_api_key_set"`
	LLMAPIURL    string `json:"llm_api_url"`
	LLMModel     string `json:"llm_model"`
	LLMProtocol  string `json:"llm_protocol"`
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
		SiteName:                     s.SiteName,
		SiteURL:                      s.SiteURL,
		FooterText:                   s.FooterText,
		FooterGitHubURL:              s.FooterGitHubURL,
		PostsPerPage:                 s.PostsPerPage,
		HomeFootprintEnabled:         s.HomeFootprintEnabled,
		HomeFootprintAggregationDays: s.HomeFootprintAggregationDays,
		CommentsEnabled:              s.CommentsEnabled,
		CommentsModeration:           s.CommentsModeration,
		TechStack:                    s.TechStack,
		CustomEmojiMaxPerUser:        s.CustomEmojiMaxPerUser,
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
		GitHubTokenSet: s.GitHubToken != "",
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
		LLMAPIKeySet: s.LLMAPIKey != "",
		LLMAPIURL:    s.LLMAPIURL,
		LLMModel:     s.LLMModel,
		LLMProtocol:  s.LLMProtocol,
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
