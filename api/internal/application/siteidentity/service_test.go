package siteidentity

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubSettingsReader struct {
	values map[string]string
	err    error
}

func (s stubSettingsReader) GetAll(context.Context) (map[string]string, error) {
	return s.values, s.err
}

func TestServiceGetReturnsServerDefaults(t *testing.T) {
	identity, err := NewService(stubSettingsReader{values: map[string]string{}}).Get(context.Background())
	require.NoError(t, err)

	assert.Equal(t, "Violet", identity.SiteName)
	assert.Equal(t, "https://xunrua.top", identity.SiteURL)
	assert.Equal(t, "xunrua", identity.OwnerName)
	assert.Equal(t, "这里是 Violet，记录构建、拆解问题与生活思考。", identity.Bio)
	assert.Empty(t, identity.AvatarURL)
	assert.Empty(t, identity.Location)
	assert.Nil(t, identity.Hero.BannerURL)
	assert.Equal(t, "We can only see a short distance ahead, but we can see plenty there that needs to be done.", identity.Hero.Quote)
	assert.Equal(t, "「我们只能看清眼前的一小段路，但已足以看清有无数的事亟待完成。」", identity.Hero.QuoteTranslation)
	assert.Equal(t, "Alan Turing", identity.Hero.QuoteAuthor)
	assert.Equal(t, []LinkDTO{}, identity.SocialLinks)
	assert.Equal(t, []LinkDTO{{Kind: "rss", Label: "RSS", Href: "/feed.xml"}}, identity.SubscriptionChannels)
	assert.True(t, identity.Home.FootprintEnabled)
	assert.Equal(t, 7, identity.Home.FootprintAggregationDays)
}

func TestServiceGetNormalizesConfiguredIdentity(t *testing.T) {
	identity, err := NewService(stubSettingsReader{values: map[string]string{
		"site_name":                       "  Violet Garden  ",
		"site_url":                        " HTTPS://example.com/ ",
		"github_username":                 " @octocat ",
		"bio":                             "详细简介",
		"tagline":                         "  首页短简介  ",
		"avatar_url":                      " /uploads/avatar.webp ",
		"profile_location":                "  杭州  ",
		"hero_banner_url":                 "javascript:alert(1)",
		"hero_image":                      " /uploads/banner.webp ",
		"hero_quote":                      "  Custom quote.  ",
		"hero_quote_translation":          "  自定义译文。  ",
		"hero_quote_author":               "  Author  ",
		"social_twitter":                  " @violet_blog ",
		"social_mastodon":                 " https://mastodon.social/@violet ",
		"social_email":                    " hello@example.com ",
		"social_rss":                      " https://example.com/feed.xml ",
		"social_bilibili":                 " https://space.bilibili.com/42 ",
		"home_footprint_enabled":          "false",
		"home_footprint_aggregation_days": "14",
	}}).Get(context.Background())
	require.NoError(t, err)

	assert.Equal(t, "Violet Garden", identity.SiteName)
	assert.Equal(t, "https://example.com", identity.SiteURL)
	assert.Equal(t, "octocat", identity.OwnerName)
	assert.Equal(t, "首页短简介", identity.Bio)
	assert.Equal(t, "/uploads/avatar.webp", identity.AvatarURL)
	assert.Equal(t, "杭州", identity.Location)
	require.NotNil(t, identity.Hero.BannerURL)
	assert.Equal(t, "/uploads/banner.webp", *identity.Hero.BannerURL)
	assert.Equal(t, HeroDTO{BannerURL: identity.Hero.BannerURL, Quote: "Custom quote.", QuoteTranslation: "自定义译文。", QuoteAuthor: "Author"}, identity.Hero)
	assert.Equal(t, []LinkDTO{
		{Kind: "github", Label: "GitHub", Href: "https://github.com/octocat"},
		{Kind: "twitter", Label: "X", Href: "https://x.com/violet_blog"},
		{Kind: "mastodon", Label: "Mastodon", Href: "https://mastodon.social/@violet"},
		{Kind: "email", Label: "Email", Href: "mailto:hello@example.com"},
		{Kind: "bilibili", Label: "Bilibili", Href: "https://space.bilibili.com/42"},
	}, identity.SocialLinks)
	assert.Equal(t, []LinkDTO{{Kind: "rss", Label: "RSS", Href: "https://example.com/feed.xml"}}, identity.SubscriptionChannels)
	assert.Equal(t, HomeDTO{FootprintEnabled: false, FootprintAggregationDays: 14}, identity.Home)
}

func TestServiceGetFiltersUnsafeLinksAndSensitiveSettings(t *testing.T) {
	identity, err := NewService(stubSettingsReader{values: map[string]string{
		"site_name":           "Blog",
		"site_url":            "javascript:alert(1)",
		"github_username":     "invalid/name",
		"avatar_url":          "data:image/png;base64,abc",
		"hero_banner_url":     "//evil.example/banner",
		"hero_image":          "file:///tmp/banner",
		"social_twitter":      "https://evil.example/user",
		"social_mastodon":     "javascript:alert(1)",
		"social_email":        "not-an-email",
		"social_rss":          "javascript:alert(1)",
		"social_bilibili":     "//evil.example/profile",
		"github_token":        "super-secret",
		"llm_api_key":         "llm-secret",
		"comments_enabled":    "true",
		"code_runner_enabled": "true",
		"about_config":        `{"private":"layout"}`,
	}}).Get(context.Background())
	require.NoError(t, err)

	assert.Equal(t, "Violet", identity.SiteName)
	assert.Equal(t, "https://xunrua.top", identity.SiteURL)
	assert.Equal(t, "xunrua", identity.OwnerName)
	assert.Empty(t, identity.AvatarURL)
	assert.Nil(t, identity.Hero.BannerURL)
	assert.Equal(t, []LinkDTO{}, identity.SocialLinks)
	assert.Equal(t, []LinkDTO{{Kind: "rss", Label: "RSS", Href: "/feed.xml"}}, identity.SubscriptionChannels)

	payload, err := json.Marshal(identity)
	require.NoError(t, err)
	for _, forbidden := range []string{"github_token", "super-secret", "llm_api_key", "llm-secret", "comments_enabled", "code_runner_enabled", "about_config"} {
		assert.NotContains(t, string(payload), forbidden)
	}
}

func TestServiceGetUsesGitHubProfileDefaults(t *testing.T) {
	identity, err := NewService(stubSettingsReader{values: map[string]string{
		"site_url":        "http://localhost:3000/",
		"github_username": "https://github.com/VOD-Studio/",
	}}).Get(context.Background())
	require.NoError(t, err)

	assert.Equal(t, "http://localhost:3000", identity.SiteURL)
	assert.Equal(t, "VOD-Studio", identity.OwnerName)
	assert.Equal(t, "https://github.com/VOD-Studio.png?size=400", identity.AvatarURL)
	assert.Equal(t, []LinkDTO{{Kind: "github", Label: "GitHub", Href: "https://github.com/VOD-Studio"}}, identity.SocialLinks)
}

func TestServiceGetReturnsSettingsFailure(t *testing.T) {
	_, err := NewService(stubSettingsReader{err: errors.New("database unavailable")}).Get(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "读取站点身份设置失败")
}
