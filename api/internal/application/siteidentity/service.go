// Package siteidentity 提供首页公开站点身份读模型。
package siteidentity

import (
	"context"
	"fmt"
	"net"
	"net/mail"
	"net/url"
	"strings"

	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
)

const (
	defaultSiteName         = "Violet"
	defaultSiteURL          = "https://xunrua.top"
	defaultRSSURL           = "/feed.xml"
	defaultQuote            = "We can only see a short distance ahead, but we can see plenty there that needs to be done."
	defaultQuoteTranslation = "「我们只能看清眼前的一小段路，但已足以看清有无数的事亟待完成。」"
	defaultQuoteAuthor      = "Alan Turing"
)

// SettingsReader 读取站点设置键值，不暴露写能力。
type SettingsReader interface {
	GetAll(ctx context.Context) (map[string]string, error)
}

// HeroDTO 是首页序章的最终视觉配置。
type HeroDTO struct {
	// BannerURL 为 nil 时使用前端内置背景，不输出空字符串。
	BannerURL        *string `json:"banner_url"`
	Quote            string  `json:"quote"`
	QuoteTranslation string  `json:"quote_translation"`
	QuoteAuthor      string  `json:"quote_author"`
}

// LinkDTO 是可直接渲染的公开链接。
type LinkDTO struct {
	Kind  string `json:"kind"`
	Label string `json:"label"`
	Href  string `json:"href"`
}

// HomeDTO 是首页足迹展示配置。
type HomeDTO struct {
	FootprintEnabled bool `json:"footprint_enabled"`
	// FootprintAggregationDays 的合法范围为 1–31，非法配置回退为 7。
	FootprintAggregationDays int `json:"footprint_aggregation_days"`
}

// IdentityDTO 是首页公开消费的站点身份，不含管理设置或敏感凭据。
type IdentityDTO struct {
	SiteName             string    `json:"site_name"`
	SiteURL              string    `json:"site_url"`
	OwnerName            string    `json:"owner_name"`
	Bio                  string    `json:"bio"`
	AvatarURL            string    `json:"avatar_url"`
	Location             string    `json:"location"`
	Hero                 HeroDTO   `json:"hero"`
	SocialLinks          []LinkDTO `json:"social_links"`
	SubscriptionChannels []LinkDTO `json:"subscription_channels"`
	Home                 HomeDTO   `json:"home"`
}

// Service 把站点设置投影为公开身份资源。
type Service struct {
	settings SettingsReader
}

// NewService 绑定只读设置端口。
func NewService(settings SettingsReader) *Service {
	return &Service{settings: settings}
}

// Get 返回已应用默认值、URL 校验和敏感字段隔离的站点身份。
func (s *Service) Get(ctx context.Context) (IdentityDTO, error) {
	values, err := s.settings.GetAll(ctx)
	if err != nil {
		return IdentityDTO{}, shared.Internal("读取站点身份设置失败", err)
	}
	settings := domainsettings.SiteSettings{}.MergeFrom(values)
	siteName := normalizeSiteName(settings.SiteName)
	siteURL := normalizeSiteURL(settings.SiteURL)
	githubUsername := normalizeGitHubUsername(settings.GitHubUsername)
	ownerName := githubUsername
	if ownerName == "" {
		ownerName = ownerFromSiteURL(siteURL)
	}
	if ownerName == "" {
		ownerName = siteName
	}

	bio := firstNonBlank(settings.Tagline, settings.Bio)
	if bio == "" {
		bio = fmt.Sprintf("这里是 %s，记录构建、拆解问题与生活思考。", siteName)
	}
	avatarURL := normalizeAssetHref(settings.AvatarURL)
	if avatarURL == "" && githubUsername != "" {
		avatarURL = "https://github.com/" + githubUsername + ".png?size=400"
	}

	var bannerURL *string
	if banner := firstValidAssetHref(values["hero_banner_url"], values["hero_image"]); banner != "" {
		bannerURL = &banner
	}
	rssURL := normalizeAssetHref(settings.SocialRss)
	if rssURL == "" {
		rssURL = defaultRSSURL
	}

	return IdentityDTO{
		SiteName:  siteName,
		SiteURL:   siteURL,
		OwnerName: ownerName,
		Bio:       bio,
		AvatarURL: avatarURL,
		Location:  strings.TrimSpace(settings.ProfileLocation),
		Hero: HeroDTO{
			BannerURL:        bannerURL,
			Quote:            firstNonBlank(values["hero_quote"], defaultQuote),
			QuoteTranslation: firstNonBlank(values["hero_quote_translation"], defaultQuoteTranslation),
			QuoteAuthor:      firstNonBlank(values["hero_quote_author"], defaultQuoteAuthor),
		},
		SocialLinks: buildSocialLinks(settings, githubUsername),
		SubscriptionChannels: []LinkDTO{
			{Kind: "rss", Label: "RSS", Href: rssURL},
		},
		Home: HomeDTO{
			FootprintEnabled:         settings.HomeFootprintEnabled,
			FootprintAggregationDays: settings.HomeFootprintAggregationDays,
		},
	}, nil
}

func normalizeSiteName(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || strings.EqualFold(value, "My Blog") || strings.EqualFold(value, "Blog") {
		return defaultSiteName
	}
	return value
}

func normalizeSiteURL(value string) string {
	parsed, ok := parseHTTPURL(value)
	if !ok || parsed.RawQuery != "" || parsed.Fragment != "" {
		return defaultSiteURL
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	parsed.RawPath = ""
	return parsed.String()
}

func normalizeAssetHref(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || strings.Contains(value, "\\") {
		return ""
	}
	if strings.HasPrefix(value, "/") && !strings.HasPrefix(value, "//") {
		parsed, err := url.Parse(value)
		if err == nil && parsed.Scheme == "" && parsed.Host == "" {
			return parsed.String()
		}
		return ""
	}
	parsed, ok := parseHTTPURL(value)
	if !ok {
		return ""
	}
	return parsed.String()
}

func firstValidAssetHref(values ...string) string {
	for _, value := range values {
		if normalized := normalizeAssetHref(value); normalized != "" {
			return normalized
		}
	}
	return ""
}

func parseHTTPURL(value string) (*url.URL, bool) {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Hostname() == "" || parsed.User != nil {
		return nil, false
	}
	if !strings.EqualFold(parsed.Scheme, "http") && !strings.EqualFold(parsed.Scheme, "https") {
		return nil, false
	}
	parsed.Scheme = strings.ToLower(parsed.Scheme)
	return parsed, true
}

func normalizeGitHubUsername(value string) string {
	value = strings.TrimSpace(value)
	if parsed, ok := parseHTTPURL(value); ok {
		host := strings.ToLower(parsed.Hostname())
		if host != "github.com" && host != "www.github.com" {
			return ""
		}
		value = firstPathSegment(parsed.Path)
	}
	value = strings.TrimPrefix(strings.TrimSpace(value), "@")
	if len(value) == 0 || len(value) > 39 || value[0] == '-' || value[len(value)-1] == '-' || strings.Contains(value, "--") {
		return ""
	}
	for _, char := range value {
		if (char < 'a' || char > 'z') && (char < 'A' || char > 'Z') && (char < '0' || char > '9') && char != '-' {
			return ""
		}
	}
	return value
}

func ownerFromSiteURL(siteURL string) string {
	parsed, ok := parseHTTPURL(siteURL)
	if !ok {
		return ""
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "localhost" || net.ParseIP(host) != nil {
		return ""
	}
	parts := strings.Split(host, ".")
	if len(parts) > 1 && parts[0] == "www" {
		return parts[1]
	}
	return parts[0]
}

func buildSocialLinks(settings domainsettings.SiteSettings, githubUsername string) []LinkDTO {
	links := make([]LinkDTO, 0, 5)
	if githubUsername != "" {
		links = append(links, LinkDTO{Kind: "github", Label: "GitHub", Href: "https://github.com/" + githubUsername})
	}
	if twitterURL := normalizeTwitterHref(settings.SocialTwitter); twitterURL != "" {
		links = append(links, LinkDTO{Kind: "twitter", Label: "X", Href: twitterURL})
	}
	if mastodonURL := normalizeWebHref(settings.SocialMastodon); mastodonURL != "" {
		links = append(links, LinkDTO{Kind: "mastodon", Label: "Mastodon", Href: mastodonURL})
	}
	if emailURL := normalizeEmailHref(settings.SocialEmail); emailURL != "" {
		links = append(links, LinkDTO{Kind: "email", Label: "Email", Href: emailURL})
	}
	if bilibiliURL := normalizeWebHref(settings.SocialBilibili); bilibiliURL != "" {
		links = append(links, LinkDTO{Kind: "bilibili", Label: "Bilibili", Href: bilibiliURL})
	}
	return links
}

func normalizeWebHref(value string) string {
	parsed, ok := parseHTTPURL(value)
	if !ok {
		return ""
	}
	return parsed.String()
}

func normalizeTwitterHref(value string) string {
	value = strings.TrimSpace(value)
	if parsed, ok := parseHTTPURL(value); ok {
		host := strings.ToLower(parsed.Hostname())
		if host != "x.com" && host != "www.x.com" && host != "twitter.com" && host != "www.twitter.com" {
			return ""
		}
		value = firstPathSegment(parsed.Path)
	}
	value = strings.TrimPrefix(strings.TrimSpace(value), "@")
	if len(value) == 0 || len(value) > 15 {
		return ""
	}
	for _, char := range value {
		if (char < 'a' || char > 'z') && (char < 'A' || char > 'Z') && (char < '0' || char > '9') && char != '_' {
			return ""
		}
	}
	return "https://x.com/" + value
}

func normalizeEmailHref(value string) string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(strings.ToLower(value), "mailto:") {
		value = value[len("mailto:"):]
	}
	parsed, err := mail.ParseAddress(value)
	if err != nil || parsed.Address != value {
		return ""
	}
	return "mailto:" + value
}

func firstPathSegment(path string) string {
	path = strings.Trim(path, "/")
	if path == "" {
		return ""
	}
	return strings.SplitN(path, "/", 2)[0]
}

func firstNonBlank(values ...string) string {
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			return value
		}
	}
	return ""
}
