package settings

import (
	"encoding/json"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
)

// strPtr 辅助构造 *string
func strPtr(v string) *string { return &v }

// TestMergeFrom_FullMap 验证从完整键值对还原时所有字段正确映射。
func TestMergeFrom_FullMap(t *testing.T) {
	m := map[string]string{
		"site_name":                       "紫罗兰",
		"site_url":                        "https://violet.dev",
		"posts_per_page":                  "15",
		"home_footprint_enabled":          "false",
		"home_footprint_aggregation_days": "14",
		"comments_enabled":                "true",
		"comments_moderation":             "true",
		"google_login_enabled":            "true",
		"github_login_enabled":            "false",
		"github_username":                 "sun",
		"github_token":                    "secret-token",
		"tech_stack":                      "Go+React",
		"bio":                             "后端工程师",
		"footer_text":                     "© 2026",
		"about_config":                    `{"sections":[]}`,
		"avatar_url":                      "https://cdn/avatar.png",
		"tagline":                         "写代码的人",
		"profile_role":                    "工程师",
		"profile_location":                "杭州",
		"available_for":                   "开放工作机会",
		"skills_strong":                   "Go,PostgreSQL",
		"skills_learning":                 "Rust",
		"skills_interests":                "分布式系统",
		"social_twitter":                  "@sun",
		"social_mastodon":                 "@sun@mas.to",
		"social_email":                    "me@violet.dev",
		"social_rss":                      "/feed.xml",
		"social_bilibili":                 "https://bilibili.com/sun",
		"releases_repo":                   "sun/violet",
		"llm_api_key":                     "sk-xxx",
		"llm_api_url":                     "https://api.openai.com/v1",
		"llm_model":                       "gpt-4o",
		"llm_protocol":                    "openai",
	}
	s := SiteSettings{}.MergeFrom(m)

	assert.Equal(t, "紫罗兰", s.SiteName)
	assert.Equal(t, "https://violet.dev", s.SiteURL)
	assert.Equal(t, 15, s.PostsPerPage)
	assert.False(t, s.HomeFootprintEnabled)
	assert.Equal(t, 14, s.HomeFootprintAggregationDays)
	assert.True(t, s.CommentsEnabled)
	assert.True(t, s.CommentsModeration)
	assert.True(t, s.GoogleLoginEnabled)
	assert.False(t, s.GithubLoginEnabled)
	assert.Equal(t, "sun", s.GitHubUsername)
	assert.Equal(t, "secret-token", s.GitHubToken)
	assert.Equal(t, "Go+React", s.TechStack)
	assert.Equal(t, "后端工程师", s.Bio)
	assert.Equal(t, "© 2026", s.FooterText)
	assert.JSONEq(t, `{"sections":[]}`, string(s.AboutConfig))
	assert.Equal(t, "https://cdn/avatar.png", s.AvatarURL)
	assert.Equal(t, "写代码的人", s.Tagline)
	assert.Equal(t, "工程师", s.ProfileRole)
	assert.Equal(t, "杭州", s.ProfileLocation)
	assert.Equal(t, "开放工作机会", s.AvailableFor)
	assert.Equal(t, "Go,PostgreSQL", s.SkillsStrong)
	assert.Equal(t, "Rust", s.SkillsLearning)
	assert.Equal(t, "分布式系统", s.SkillsInterests)
	assert.Equal(t, "@sun", s.SocialTwitter)
	assert.Equal(t, "@sun@mas.to", s.SocialMastodon)
	assert.Equal(t, "me@violet.dev", s.SocialEmail)
	assert.Equal(t, "/feed.xml", s.SocialRss)
	assert.Equal(t, "https://bilibili.com/sun", s.SocialBilibili)
	assert.Equal(t, "sun/violet", s.ReleasesRepo)
	assert.Equal(t, "sk-xxx", s.LLMAPIKey)
	assert.Equal(t, "https://api.openai.com/v1", s.LLMAPIURL)
	assert.Equal(t, "gpt-4o", s.LLMModel)
	assert.Equal(t, "openai", s.LLMProtocol)
}

// TestMergeFrom_EmptyMapDefaults 验证空 map 时各字段的默认值。
// - PostsPerPage 默认 10
// - 首页发布足迹默认显示，聚合天数默认 7
// - parseBoolDefaultTrue 字段（google/github enabled）默认 true（升级无感）
// - 评论布尔字段默认 false（按 == "true"）
// - AboutConfig 为 nil
// - 数值字段为 0（消费方 fallback 默认值）
func TestMergeFrom_EmptyMapDefaults(t *testing.T) {
	s := SiteSettings{}.MergeFrom(map[string]string{})

	assert.Equal(t, 10, s.PostsPerPage, "PostsPerPage 缺省 10")
	assert.True(t, s.HomeFootprintEnabled, "未配置时默认显示首页发布足迹")
	assert.Equal(t, 7, s.HomeFootprintAggregationDays, "未配置时默认按 7 日聚合")
	assert.True(t, s.GoogleLoginEnabled, "未配置时默认启用 Google 登录")
	assert.True(t, s.GithubLoginEnabled, "未配置时默认启用 GitHub 登录")
	assert.False(t, s.CommentsEnabled, "comments_enabled 缺省 false")
	assert.False(t, s.CommentsModeration, "comments_moderation 缺省 false")
	assert.Nil(t, s.AboutConfig, "AboutConfig 缺省 nil")
	assert.Empty(t, s.SiteName)
	assert.Empty(t, s.LLMAPIKey)
}

// TestMergeFrom_ParseBoolDefaultTrue 验证 parseBoolDefaultTrue 的边界。
// "" 和 "true" → true；其余（含 "false"、"garbage"）→ false。
func TestMergeFrom_ParseBoolDefaultTrue(t *testing.T) {
	cases := []struct {
		raw    string
		expect bool
	}{
		{"", true},
		{"true", true},
		{"false", false},
		{"1", false},
		{"yes", false},
		{"TRUE", false}, // 仅小写 "true" 命中
	}
	for _, c := range cases {
		s := SiteSettings{}.MergeFrom(map[string]string{"google_login_enabled": c.raw})
		assert.Equal(t, c.expect, s.GoogleLoginEnabled, "google_login_enabled=%q", c.raw)
	}
}

// TestMergeFrom_PostsPerPageParsing 验证 posts_per_page 解析：
// 合法整数覆盖默认 10；空串/非法保持默认 10。
func TestMergeFrom_PostsPerPageParsing(t *testing.T) {
	t.Run("valid_overrides_default", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"posts_per_page": "25"})
		assert.Equal(t, 25, s.PostsPerPage)
	})
	t.Run("empty_keeps_default", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"posts_per_page": ""})
		assert.Equal(t, 10, s.PostsPerPage)
	})
	t.Run("invalid_keeps_default", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"posts_per_page": "abc"})
		assert.Equal(t, 10, s.PostsPerPage)
	})
	t.Run("zero_is_valid", func(t *testing.T) {
		// "0" 是合法数字，覆盖默认（消费方需自行处理 0）
		s := SiteSettings{}.MergeFrom(map[string]string{"posts_per_page": "0"})
		assert.Equal(t, 0, s.PostsPerPage)
	})
}

func TestMergeFrom_HomeFootprintAggregationDaysBounds(t *testing.T) {
	for _, value := range []string{"1", "7", "31"} {
		s := SiteSettings{}.MergeFrom(map[string]string{"home_footprint_aggregation_days": value})
		assert.Equal(t, value, strconv.Itoa(s.HomeFootprintAggregationDays))
	}
	for _, value := range []string{"0", "32", "invalid"} {
		s := SiteSettings{}.MergeFrom(map[string]string{"home_footprint_aggregation_days": value})
		assert.Equal(t, DefaultHomeFootprintAggregationDays, s.HomeFootprintAggregationDays)
	}
}

// TestMergeFrom_AboutConfig 验证 AboutConfig 仅在非空时赋值（空串保持 nil）。
func TestMergeFrom_AboutConfig(t *testing.T) {
	t.Run("non_empty", func(t *testing.T) {
		raw := `{"sections":[{"id":"bio","enabled":true}]}`
		s := SiteSettings{}.MergeFrom(map[string]string{"about_config": raw})
		assert.NotNil(t, s.AboutConfig)
		assert.JSONEq(t, raw, string(s.AboutConfig))
		// 类型为 json.RawMessage，可被 json.Marshal 透传
		out, err := json.Marshal(struct {
			C json.RawMessage `json:"about_config"`
		}{C: s.AboutConfig})
		assert.NoError(t, err)
		assert.Contains(t, string(out), raw)
	})
	t.Run("empty_is_nil", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"about_config": ""})
		assert.Nil(t, s.AboutConfig)
	})
}

// TestMergeFrom_IgnoresReceiverState 验证 MergeFrom 完全基于入参 map 构造，
// 接收者既有字段不影响结果（返回 fromMap(m) 的全新实例）。
func TestMergeFrom_IgnoresReceiverState(t *testing.T) {
	preexisting := SiteSettings{
		SiteName:           "不应泄漏",
		PostsPerPage:       999,
		GithubLoginEnabled: true,
	}
	got := preexisting.MergeFrom(map[string]string{"site_url": "https://x"})
	// 接收者字段不渗入结果
	assert.Empty(t, got.SiteName, "接收者 SiteName 不应渗入结果")
	assert.Equal(t, 10, got.PostsPerPage, "接收者 PostsPerPage 不应渗入，应回到默认 10")
	assert.True(t, got.GithubLoginEnabled, "parseBoolDefaultTrue 默认 true，不受接收者影响")
	assert.Equal(t, "https://x", got.SiteURL)
	// 接收者本身不变
	assert.Equal(t, "不应泄漏", preexisting.SiteName)
}
