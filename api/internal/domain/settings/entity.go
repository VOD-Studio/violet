// Package settings 提供站点设置的领域模型。
//
// 站点设置以 key-value 表存储，写入通过 VersionedStore 的组级版本事务，
// 运行时读模型由应用层合并部署默认后发布。
package settings

import (
	"context"
	"encoding/json"
	"strconv"

	"blog-api/internal/domain/shared"
)

const (
	DefaultHomeFootprintAggregationDays = 7
	MinHomeFootprintAggregationDays     = 1
	MaxHomeFootprintAggregationDays     = 31
)

// SettingsUpdated 站点配置已更新事件
//
// 配置以 key-value 存储无聚合根，事件由应用层在批量写入后构造发布。
// ChangedKeys 为本次实际变更的配置键列表（不含敏感值如 github_token/llm_api_key）。
type SettingsUpdated struct {
	shared.BaseEvent
	// ChangedKeys 本次变更的配置键
	ChangedKeys []string
}

// NewSettingsUpdated 构造配置更新事件
func NewSettingsUpdated(changedKeys []string) SettingsUpdated {
	return SettingsUpdated{
		BaseEvent:   shared.NewBaseEvent("settings.updated", shared.ID{}),
		ChangedKeys: changedKeys,
	}
}

// SiteSettings 站点配置读模型（聚合全部配置项）
type SiteSettings struct {
	// SiteName 站点名称
	SiteName string `json:"site_name"`
	// SiteURL 站点公开访问根 URL（用于生成绝对链接与 SEO canonical）
	SiteURL string `json:"site_url"`
	// PostsPerPage 列表页每页文章数（fromMap 默认 10）
	PostsPerPage int `json:"posts_per_page"`
	// HomeFootprintEnabled 是否在公开首页显示发布足迹（未配置默认启用）
	HomeFootprintEnabled bool `json:"home_footprint_enabled"`
	// HomeFootprintAggregationDays 单个足迹节点聚合的连续天数，范围 1–31（未配置默认 7）
	HomeFootprintAggregationDays int `json:"home_footprint_aggregation_days"`
	// CommentsEnabled 是否全局开启评论
	CommentsEnabled bool `json:"comments_enabled"`
	// CommentsModeration 评论是否需人工审核后才公开
	CommentsModeration bool `json:"comments_moderation"`
	// GoogleLoginEnabled 是否启用 Google OAuth 登录（parseBoolDefaultTrue，未配置默认启用）
	GoogleLoginEnabled bool `json:"google_login_enabled"`
	// GithubLoginEnabled 是否启用 GitHub OAuth 登录（parseBoolDefaultTrue，未配置默认启用）
	GithubLoginEnabled bool `json:"github_login_enabled"`
	// GitHubUsername 站长 GitHub 用户名（releases 区块默认 owner、社交展示）
	GitHubUsername string `json:"github_username"`
	// GitHubToken GitHub 访问令牌（拉取 releases / OAuth 用，属敏感配置）
	GitHubToken string `json:"github_token"`
	// TechStack 站点技术栈描述
	TechStack string `json:"tech_stack"`
	// Bio 站长简介
	Bio string `json:"bio"`
	// FooterText 页脚文案
	FooterText string `json:"footer_text"`
	// FooterGitHubURL 页脚独立 GitHub 账号或仓库链接；空串隐藏。
	FooterGitHubURL string `json:"footer_github_url"`
	// AboutConfig 关于页区块版面配置（{sections:[{id,enabled,order,params}]}）。
	// 存储层为 JSON 字符串（site_settings key-value 表）；API 边界用 json.RawMessage
	// 使其序列化为原生 JSON 对象（空配置序列化为 null），前端无需二次 parse。
	AboutConfig json.RawMessage `json:"about_config"`
	// 关于博主（A 线）内容字段：头像/标语/名片/技能/社交矩阵

	// AvatarURL 关于页博主头像 URL
	AvatarURL string `json:"avatar_url"`
	// Tagline 博主标语/一句话介绍
	Tagline string `json:"tagline"`
	// ProfileRole 博主职业角色（如「后端工程师」）
	ProfileRole string `json:"profile_role"`
	// ProfileLocation 博主所在地
	ProfileLocation string `json:"profile_location"`
	// AvailableFor 求职/合作意向文案（如「开放工作机会」）
	AvailableFor string `json:"available_for"`
	// SkillsStrong 精通技能列表
	SkillsStrong string `json:"skills_strong"`
	// SkillsLearning 正在学习技能列表
	SkillsLearning string `json:"skills_learning"`
	// SkillsInterests 兴趣方向列表
	SkillsInterests string `json:"skills_interests"`
	// SocialTwitter Twitter 社交链接
	SocialTwitter string `json:"social_twitter"`
	// SocialMastodon Mastodon 社交链接
	SocialMastodon string `json:"social_mastodon"`
	// SocialEmail 公开联系邮箱
	SocialEmail string `json:"social_email"`
	// SocialRss RSS 订阅地址
	SocialRss string `json:"social_rss"`
	// SocialBilibili Bilibili 主页链接
	SocialBilibili string `json:"social_bilibili"`
	// ReleasesRepo 更新日志区块读取的 GitHub 仓库名（owner/repo 或 repo，配合 github_username）
	ReleasesRepo string `json:"releases_repo"`
	// LLM 配置（OpenAI 协议兼容端点，覆盖 OpenAI/DeepSeek/Moonshot/通义/智谱/Ollama/vLLM）

	// LLMAPIKey LLM API 密钥（属敏感配置）
	LLMAPIKey string `json:"llm_api_key"`
	// LLMAPIURL LLM API 端点 URL（OpenAI 协议兼容）
	LLMAPIURL string `json:"llm_api_url"`
	// LLMModel 默认调用的模型名
	LLMModel string `json:"llm_model"`
	// LLMProtocol LLM 协议标识（区分 OpenAI/DeepSeek 等厂商协议变体）
	LLMProtocol string `json:"llm_protocol"`
	// 代码运行器配置（运行时可改，见 ADR-0006）

	// CodeRunnerEnabled 是否启用代码运行器（parseBoolDefaultTrue，未配置默认启用）
	CodeRunnerEnabled bool `json:"code_runner_enabled"`
	// CodeRunnerMaxCPUCores 单次执行最大 CPU 核数，必须为正。
	CodeRunnerMaxCPUCores float64 `json:"code_runner_max_cpu_cores"`
	// CodeRunnerMaxMemoryMB 单次执行内存上限（MB），必须为正。
	CodeRunnerMaxMemoryMB uint64 `json:"code_runner_max_memory_mb"`
	// CodeRunnerMaxTimeoutSecs 单次执行最大墙钟时长（秒），必须为正。
	CodeRunnerMaxTimeoutSecs uint64 `json:"code_runner_max_timeout_secs"`
	// CodeRunnerMaxOutputBytes 单次执行 stdout/stderr 合计最大输出字节，0 表示不保留输出。
	CodeRunnerMaxOutputBytes uint64 `json:"code_runner_max_output_bytes"`
	// CodeRunnerMaxSourceBytes 单次提交最大源码字节，必须为正。
	CodeRunnerMaxSourceBytes uint64 `json:"code_runner_max_source_bytes"`
	// CodeRunnerAllowNetwork 是否允许运行容器联网（最终生效需作者声明 + 语言允许 + 全局开关三者同时为真）
	CodeRunnerAllowNetwork bool `json:"code_runner_allow_network"`
	// CodeRunnerLanguages 允许运行的语言列表（逗号分隔的 canonical key：python/node/go/rust/bun）
	CodeRunnerLanguages string `json:"code_runner_languages"`
	// CustomEmojiMaxPerUser 单用户自传及收藏总份额上限；0 禁止新增。
	CustomEmojiMaxPerUser int `json:"custom_emoji_max_per_user"`
}

// SettingsStore 是运行时只读设置端口；写入必须经过组级版本事务。
type SettingsStore interface {
	GetAll(ctx context.Context) (map[string]string, error)
}

// MergeFrom 从键值对还原配置读模型
func (s SiteSettings) MergeFrom(m map[string]string) SiteSettings {
	return fromMap(m)
}

// 从 map 还原配置读模型
func fromMap(m map[string]string) SiteSettings {
	s := SiteSettings{
		PostsPerPage:                 10,
		HomeFootprintEnabled:         true,
		HomeFootprintAggregationDays: DefaultHomeFootprintAggregationDays,
	}
	s.SiteName = m["site_name"]
	s.SiteURL = m["site_url"]
	if v, ok := parseInt(m["posts_per_page"]); ok {
		s.PostsPerPage = v
	}
	s.HomeFootprintEnabled = parseBoolDefaultTrue(m["home_footprint_enabled"])
	if v, ok := parseInt(m["home_footprint_aggregation_days"]); ok &&
		v >= MinHomeFootprintAggregationDays && v <= MaxHomeFootprintAggregationDays {
		s.HomeFootprintAggregationDays = v
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
	s.FooterGitHubURL = m["footer_github_url"]
	if raw := m["about_config"]; raw != "" {
		s.AboutConfig = json.RawMessage(raw)
	}
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
	s.LLMAPIKey = m["llm_api_key"]
	s.LLMAPIURL = m["llm_api_url"]
	s.LLMModel = m["llm_model"]
	s.LLMProtocol = m["llm_protocol"]
	// 应用层在解析前为缺失键合并部署默认；零值不是恢复默认操作。
	s.CodeRunnerEnabled = parseBoolDefaultTrue(m["code_runner_enabled"])
	s.CodeRunnerMaxCPUCores = parseFloat(m["code_runner_max_cpu_cores"])
	s.CodeRunnerMaxMemoryMB = parseUint64(m["code_runner_max_memory_mb"])
	s.CodeRunnerMaxTimeoutSecs = parseUint64(m["code_runner_max_timeout_secs"])
	s.CodeRunnerMaxOutputBytes = parseUint64(m["code_runner_max_output_bytes"])
	s.CodeRunnerMaxSourceBytes = parseUint64(m["code_runner_max_source_bytes"])
	s.CodeRunnerAllowNetwork = m["code_runner_allow_network"] == "true"
	s.CodeRunnerLanguages = m["code_runner_languages"]
	if v, ok := parseInt(m["custom_emoji_max_per_user"]); ok {
		s.CustomEmojiMaxPerUser = v
	}
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

// parseUint64 解析无符号整数，空串/非法返回 0。
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

// parseFloat 解析浮点数，空串/非法返回 0。
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

// ErrOAuthNotConfigured OAuth 登录方式已开启但凭据未配置/不完整。
// 与 Disabled 区分：开关在管理端，凭据在环境/后台凭据写入，两者独立。
var ErrOAuthNotConfigured = shared.BadRequest("该登录方式未配置凭据，请在后台完成配置")
