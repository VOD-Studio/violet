package settings

import (
	"context"
	"net/url"
	"regexp"
	"strings"

	"blog-api/internal/domain/shared"
)

// Group 是唯一允许写入的配置边界，不接受任意 key 接口。
type Group string

const (
	General    Group = "general"
	Auth       Group = "auth"
	Security   Group = "security"
	Github     Group = "github"
	Profile    Group = "profile"
	About      Group = "about"
	LLM        Group = "llm"
	CodeRunner Group = "code-runner"
)

func Groups() []Group { return []Group{General, Auth, Security, Github, Profile, About, LLM, CodeRunner} }

func (g Group) Keys() []string {
	switch g {
	case General:
		return []string{"site_name", "site_url", "footer_text", "footer_github_url", "posts_per_page", "home_footprint_enabled", "home_footprint_aggregation_days", "comments_enabled", "comments_moderation", "tech_stack", "custom_emoji_max_per_user"}
	case Auth:
		return []string{"google_login_enabled", "github_login_enabled"}
	case Security:
		return []string{"trusted_origins", "trusted_proxies", "cookie_secure", "cookie_same_site", "session_max_devices"}
	case Github:
		return []string{"github_username", "github_token", "releases_repo"}
	case Profile:
		return []string{"bio", "avatar_url", "tagline", "profile_role", "profile_location", "available_for", "skills_strong", "skills_learning", "skills_interests", "social_twitter", "social_mastodon", "social_email", "social_rss", "social_bilibili"}
	case About:
		return []string{"about_config"}
	case LLM:
		return []string{"llm_api_key", "llm_api_url", "llm_model", "llm_protocol"}
	case CodeRunner:
		return []string{"code_runner_enabled", "code_runner_max_cpu_cores", "code_runner_max_memory_mb", "code_runner_max_timeout_secs", "code_runner_max_output_bytes", "code_runner_max_source_bytes", "code_runner_allow_network", "code_runner_languages"}
	default:
		return nil
	}
}

// GroupRecord 只含本组显式数据库覆盖；缺失键使用部署默认。
type GroupRecord struct {
	// Version 单调递增的数据库提交版本，初始为 0。
	Version int64
	// Values 本组显式覆盖，空串和 false/0 都不会被删除。
	Values map[string]string
}

// VersionedStore 在同一个数据库事务内锁定版本、校验并提交整组。
type VersionedStore interface {
	// LoadValues is used only at initialization, including legacy read-only identity fields.
	LoadValues(context.Context) (map[string]string, error)
	ReadGroup(context.Context, Group) (GroupRecord, error)
	ChangeGroup(context.Context, Group, int64, func(map[string]string) (map[string]string, error)) (GroupRecord, error)
}

var ErrVersionConflict = shared.Conflict("配置已被其他管理员更新，请重新加载后再保存")

var githubAccount = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$`)
var githubRepository = regexp.MustCompile(`^[A-Za-z0-9_.-]+$`)

// NormalizeFooterGitHubURL 仅接受 HTTPS GitHub 账号或仓库，移除凭据、查询和片段。
func NormalizeFooterGitHubURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	u, err := url.Parse(raw)
	if err != nil || !strings.EqualFold(u.Scheme, "https") || !strings.EqualFold(u.Host, "github.com") || u.Opaque != "" {
		return "", shared.FieldValidation("footer_github_url", "必须是 HTTPS github.com 账号或仓库链接")
	}
	parts := strings.FieldsFunc(u.Path, func(r rune) bool { return r == '/' })
	if len(parts) < 1 || len(parts) > 2 || !githubAccount.MatchString(parts[0]) || (len(parts) == 2 && (!githubRepository.MatchString(parts[1]) || parts[1] == "." || parts[1] == "..")) {
		return "", shared.FieldValidation("footer_github_url", "必须指向 GitHub 账号或仓库")
	}
	return "https://github.com/" + strings.Join(parts, "/"), nil
}
