// Package settings 提供站点配置的应用用例。
package settings

import (
	"context"
	"strconv"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
)

// Service 站点配置用例服务
type Service struct {
	store domainsettings.SettingsStore
	bus   appshared.EventBus
}

// NewService 构造配置服务
func NewService(store domainsettings.SettingsStore, bus appshared.EventBus) *Service {
	return &Service{store: store, bus: bus}
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
		"about_config":         settings.AboutConfig,
		"avatar_url":           settings.AvatarURL,
		"tagline":              settings.Tagline,
		"profile_role":         settings.ProfileRole,
		"profile_location":     settings.ProfileLocation,
		"available_for":        settings.AvailableFor,
		"skills_strong":        settings.SkillsStrong,
		"skills_learning":      settings.SkillsLearning,
		"skills_interests":     settings.SkillsInterests,
		"social_twitter":       settings.SocialTwitter,
		"social_mastodon":      settings.SocialMastodon,
		"social_email":         settings.SocialEmail,
		"social_rss":           settings.SocialRss,
		"social_bilibili":      settings.SocialBilibili,
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
	if in.SiteURL != nil {
		updates["site_url"] = *in.SiteURL
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
	if in.AboutConfig != nil {
		updates["about_config"] = string(*in.AboutConfig)
	}
	// 关于博主（A 线）内容字段：均为字符串，统一批量写入
	for k, p := range map[string]*string{
		"avatar_url":      in.AvatarURL,
		"tagline":         in.Tagline,
		"profile_role":    in.ProfileRole,
		"profile_location": in.ProfileLocation,
		"available_for":   in.AvailableFor,
		"skills_strong":   in.SkillsStrong,
		"skills_learning": in.SkillsLearning,
		"skills_interests": in.SkillsInterests,
		"social_twitter":  in.SocialTwitter,
		"social_mastodon": in.SocialMastodon,
		"social_email":    in.SocialEmail,
		"social_rss":      in.SocialRss,
		"social_bilibili": in.SocialBilibili,
		"releases_repo":  in.ReleasesRepo,
	} {
		if p != nil {
			updates[k] = *p
		}
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
	// 配置变更审计（不含敏感值，只记变更键名）
	if len(updates) > 0 {
		keys := make([]string, 0, len(updates))
		for k := range updates {
			if isSensitiveSettingKey(k) {
				continue
			}
			keys = append(keys, k)
		}
		if err := s.bus.Publish(ctx, []shared.DomainEvent{domainsettings.NewSettingsUpdated(keys)}); err != nil {
			log.Warn().Err(err).Msg("发布配置更新事件失败")
		}
	}
	return s.GetAll(ctx)
}

// isSensitiveSettingKey 敏感配置键不记审计（凭据值不入审计日志）
func isSensitiveSettingKey(k string) bool {
	switch k {
	case "github_token", "llm_api_key", "resend_api_key", "email_from":
		return true
	}
	return false
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

// ---- 分组用例（admin 各菜单子页独立读写）----
//
// 每组 Get 调聚合 GetAll 构造该组视图；Update 把分组入参映射成
// domain.UpdateInput 子集后复用 s.Update（部分更新），其余字段保持不变。
// 这样 admin 按菜单隔离读写，既消除回填竞态，又复用底层聚合与存储逻辑。

// GetGeneral 读取基础信息组
func (s *Service) GetGeneral(ctx context.Context) (GeneralView, error) {
	all, err := s.GetAll(ctx)
	if err != nil {
		return GeneralView{}, err
	}
	return generalView(all), nil
}

// UpdateGeneral 更新基础信息组
func (s *Service) UpdateGeneral(ctx context.Context, in GeneralUpdate) (GeneralView, error) {
	all, err := s.Update(ctx, domainsettings.UpdateInput{
		SiteName: in.SiteName,
		SiteURL: in.SiteURL, FooterText: in.FooterText,
		PostsPerPage: in.PostsPerPage, CommentsEnabled: in.CommentsEnabled,
		CommentsModeration: in.CommentsModeration, TechStack: in.TechStack,
	})
	if err != nil {
		return GeneralView{}, err
	}
	return generalView(all), nil
}

// GetAuth 读取认证组
func (s *Service) GetAuth(ctx context.Context) (AuthView, error) {
	all, err := s.GetAll(ctx)
	if err != nil {
		return AuthView{}, err
	}
	return authView(all), nil
}

// UpdateAuth 更新认证组
func (s *Service) UpdateAuth(ctx context.Context, in AuthUpdate) (AuthView, error) {
	all, err := s.Update(ctx, domainsettings.UpdateInput{
		GoogleLoginEnabled: in.GoogleLoginEnabled, GithubLoginEnabled: in.GithubLoginEnabled,
	})
	if err != nil {
		return AuthView{}, err
	}
	return authView(all), nil
}

// GetGithub 读取 GitHub 组
func (s *Service) GetGithub(ctx context.Context) (GithubView, error) {
	all, err := s.GetAll(ctx)
	if err != nil {
		return GithubView{}, err
	}
	return githubView(all), nil
}

// UpdateGithub 更新 GitHub 组
func (s *Service) UpdateGithub(ctx context.Context, in GithubUpdate) (GithubView, error) {
	all, err := s.Update(ctx, domainsettings.UpdateInput{
		GitHubUsername: in.GitHubUsername, GitHubToken: in.GitHubToken,
		ReleasesRepo: in.ReleasesRepo,
	})
	if err != nil {
		return GithubView{}, err
	}
	return githubView(all), nil
}

// GetProfile 读取关于博主组
func (s *Service) GetProfile(ctx context.Context) (ProfileView, error) {
	all, err := s.GetAll(ctx)
	if err != nil {
		return ProfileView{}, err
	}
	return profileView(all), nil
}

// UpdateProfile 更新关于博主组
func (s *Service) UpdateProfile(ctx context.Context, in ProfileUpdate) (ProfileView, error) {
	all, err := s.Update(ctx, domainsettings.UpdateInput{
		Bio: in.Bio,
		AvatarURL: in.AvatarURL, Tagline: in.Tagline,
		ProfileRole: in.ProfileRole, ProfileLocation: in.ProfileLocation,
		AvailableFor: in.AvailableFor, SkillsStrong: in.SkillsStrong,
		SkillsLearning: in.SkillsLearning, SkillsInterests: in.SkillsInterests,
		SocialTwitter: in.SocialTwitter, SocialMastodon: in.SocialMastodon,
		SocialEmail: in.SocialEmail, SocialRss: in.SocialRss, SocialBilibili: in.SocialBilibili,
	})
	if err != nil {
		return ProfileView{}, err
	}
	return profileView(all), nil
}

// GetAbout 读取关于页区块配置组
func (s *Service) GetAbout(ctx context.Context) (AboutView, error) {
	all, err := s.GetAll(ctx)
	if err != nil {
		return AboutView{}, err
	}
	return aboutView(all), nil
}

// UpdateAbout 更新关于页区块配置组
func (s *Service) UpdateAbout(ctx context.Context, in AboutUpdate) (AboutView, error) {
	all, err := s.Update(ctx, domainsettings.UpdateInput{
		AboutConfig: in.AboutConfig,
	})
	if err != nil {
		return AboutView{}, err
	}
	return aboutView(all), nil
}

// GetLlm 读取 LLM 组
func (s *Service) GetLlm(ctx context.Context) (LlmView, error) {
	all, err := s.GetAll(ctx)
	if err != nil {
		return LlmView{}, err
	}
	return llmView(all), nil
}

// UpdateLlm 更新 LLM 组
func (s *Service) UpdateLlm(ctx context.Context, in LlmUpdate) (LlmView, error) {
	all, err := s.Update(ctx, domainsettings.UpdateInput{
		LLMAPIKey: in.LLMAPIKey, LLMAPIURL: in.LLMAPIURL,
		LLMModel: in.LLMModel, LLMProtocol: in.LLMProtocol,
	})
	if err != nil {
		return LlmView{}, err
	}
	return llmView(all), nil
}

// GetCodeRunner 读取代码运行器组
func (s *Service) GetCodeRunner(ctx context.Context) (CodeRunnerView, error) {
	all, err := s.GetAll(ctx)
	if err != nil {
		return CodeRunnerView{}, err
	}
	return codeRunnerView(all), nil
}

// UpdateCodeRunner 更新代码运行器组
func (s *Service) UpdateCodeRunner(ctx context.Context, in CodeRunnerUpdate) (CodeRunnerView, error) {
	all, err := s.Update(ctx, domainsettings.UpdateInput{
		CodeRunnerEnabled:        in.CodeRunnerEnabled,
		CodeRunnerMaxCPUCores:    in.CodeRunnerMaxCPUCores,
		CodeRunnerMaxMemoryMB:    in.CodeRunnerMaxMemoryMB,
		CodeRunnerMaxTimeoutSecs: in.CodeRunnerMaxTimeoutSecs,
		CodeRunnerMaxOutputBytes: in.CodeRunnerMaxOutputBytes,
		CodeRunnerMaxSourceBytes: in.CodeRunnerMaxSourceBytes,
		CodeRunnerAllowNetwork:   in.CodeRunnerAllowNetwork,
		CodeRunnerLanguages:      in.CodeRunnerLanguages,
	})
	if err != nil {
		return CodeRunnerView{}, err
	}
	return codeRunnerView(all), nil
}
