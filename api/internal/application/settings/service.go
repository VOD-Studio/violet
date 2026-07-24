// Package settings 提供站点配置的应用用例。
package settings

import (
	"context"
	"strconv"

	"github.com/rs/zerolog/log"

	domainsettings "blog-api/internal/domain/settings"
)

// Service 站点配置用例服务
type Service struct {
	store domainsettings.SettingsStore
}

// NewService 构造配置服务
func NewService(store domainsettings.SettingsStore) *Service {
	return &Service{store: store}
}

// GetAll 获取全部站点配置
func (s *Service) GetAll(ctx context.Context) (domainsettings.SiteSettings, error) {
	m, err := s.store.GetAll(ctx)
	if err != nil {
		log.Error().Err(err).Msg("查询站点设置失败")
		return domainsettings.SiteSettings{}, err
	}
	return domainsettings.SiteSettings{}.MergeFrom(m), nil
}

// GetPublic 获取公开站点配置（不含敏感字段如 github_token）
func (s *Service) GetPublic(ctx context.Context) (map[string]any, error) {
	settings, err := s.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"site_name":            settings.SiteName,
		"site_description":     settings.SiteDescription,
		"site_url":             settings.SiteURL,
		"posts_per_page":       settings.PostsPerPage,
		"comments_enabled":     settings.CommentsEnabled,
		"comments_moderation":  settings.CommentsModeration,
		"google_login_enabled": settings.GoogleLoginEnabled,
		"github_login_enabled": settings.GithubLoginEnabled,
		"github_username":      settings.GitHubUsername,
		"tech_stack":           settings.TechStack,
		"bio":                  settings.Bio,
		"footer_text":          settings.FooterText,
		"code_runner_enabled":  settings.CodeRunnerEnabled,
	}, nil
}

// UpdateInput 更新入参（别名 domain 类型，供 handler 引用）
type UpdateInput = domainsettings.UpdateInput

// Update 更新站点配置（部分更新）
func (s *Service) Update(ctx context.Context, in UpdateInput) (domainsettings.SiteSettings, error) {
	updates := map[string]string{}
	if in.SiteName != nil {
		updates["site_name"] = *in.SiteName
	}
	if in.SiteDescription != nil {
		updates["site_description"] = *in.SiteDescription
	}
	if in.SiteURL != nil {
		updates["site_url"] = *in.SiteURL
	}
	if in.AdminEmail != nil {
		updates["admin_email"] = *in.AdminEmail
	}
	if in.PostsPerPage != nil {
		updates["posts_per_page"] = strconv.Itoa(*in.PostsPerPage)
	}
	if in.CommentsEnabled != nil {
		updates["comments_enabled"] = boolStr(*in.CommentsEnabled)
	}
	if in.CommentsModeration != nil {
		updates["comments_moderation"] = boolStr(*in.CommentsModeration)
	}
	if in.GoogleLoginEnabled != nil {
		updates["google_login_enabled"] = boolStr(*in.GoogleLoginEnabled)
	}
	if in.GithubLoginEnabled != nil {
		updates["github_login_enabled"] = boolStr(*in.GithubLoginEnabled)
	}
	if in.GitHubUsername != nil {
		updates["github_username"] = *in.GitHubUsername
	}
	if in.GitHubToken != nil {
		updates["github_token"] = *in.GitHubToken
	}
	if in.TechStack != nil {
		updates["tech_stack"] = *in.TechStack
	}
	if in.Bio != nil {
		updates["bio"] = *in.Bio
	}
	if in.FooterText != nil {
		updates["footer_text"] = *in.FooterText
	}
	if in.LLMAPIKey != nil {
		updates["llm_api_key"] = *in.LLMAPIKey
	}
	if in.LLMAPIURL != nil {
		updates["llm_api_url"] = *in.LLMAPIURL
	}
	if in.LLMModel != nil {
		updates["llm_model"] = *in.LLMModel
	}
	if in.LLMProtocol != nil {
		updates["llm_protocol"] = *in.LLMProtocol
	}
	// 代码运行器配置（运行时可改）
	if in.CodeRunnerEnabled != nil {
		updates["code_runner_enabled"] = boolStr(*in.CodeRunnerEnabled)
	}
	if in.CodeRunnerMaxCPUCores != nil {
		updates["code_runner_max_cpu_cores"] = strconv.FormatFloat(*in.CodeRunnerMaxCPUCores, 'f', -1, 64)
	}
	if in.CodeRunnerMaxMemoryMB != nil {
		updates["code_runner_max_memory_mb"] = strconv.FormatUint(*in.CodeRunnerMaxMemoryMB, 10)
	}
	if in.CodeRunnerMaxTimeoutSecs != nil {
		updates["code_runner_max_timeout_secs"] = strconv.FormatUint(*in.CodeRunnerMaxTimeoutSecs, 10)
	}
	if in.CodeRunnerMaxOutputBytes != nil {
		updates["code_runner_max_output_bytes"] = strconv.FormatUint(*in.CodeRunnerMaxOutputBytes, 10)
	}
	if in.CodeRunnerMaxSourceBytes != nil {
		updates["code_runner_max_source_bytes"] = strconv.FormatUint(*in.CodeRunnerMaxSourceBytes, 10)
	}
	if in.CodeRunnerAllowNetwork != nil {
		updates["code_runner_allow_network"] = boolStr(*in.CodeRunnerAllowNetwork)
	}
	if in.CodeRunnerLanguages != nil {
		updates["code_runner_languages"] = *in.CodeRunnerLanguages
	}
	if len(updates) > 0 {
		// 批量原子更新，避免逐键 Upsert 中途失败导致部分更新
		if err := s.store.UpsertMany(ctx, updates); err != nil {
			log.Error().Err(err).Msg("批量更新配置失败")
			return domainsettings.SiteSettings{}, err
		}
	}
	return s.GetAll(ctx)
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
