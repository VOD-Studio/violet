package bilibili

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// Client 封装 B站表情面板 API 调用。
type Client struct {
	httpClient *http.Client
	cookie     string
	userAgent  string
}

// Option Client 的可选配置。
type Option func(*Client)

// WithUserAgent 自定义 User-Agent（默认带浏览器后缀以规避反爬）。
func WithUserAgent(ua string) Option {
	return func(c *Client) { c.userAgent = ua }
}

// WithHTTPClient 注入自定义 http.Client（测试用）。
func WithHTTPClient(h *http.Client) Option {
	return func(c *Client) { c.httpClient = h }
}

// sanitizeCookie 清洗 cookie 字符串：去除首尾空白与所有控制字符（换行、制表符等）。
// 从浏览器复制的 cookie 常夹带 \n / \r，会导致 http.Header.Set 拒绝（invalid header field value）。
func sanitizeCookie(cookie string) string {
	var b strings.Builder
	b.Grow(len(cookie))
	for _, r := range cookie {
		if r >= 0x20 && r != 0x7f {
			b.WriteRune(r)
		}
	}
	return strings.TrimSpace(b.String())
}

// NewClient 创建 B站表情 API 客户端。cookie 为空时 FetchEmojis 返回错误。
// cookie 会先经 sanitizeCookie 清洗控制字符，避免非法 header value。
func NewClient(cookie string, opts ...Option) *Client {
	c := &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		cookie:     sanitizeCookie(cookie),
		userAgent:  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Cookie 返回当前持有的完整 cookie 字符串（启动期注入值）。
func (c *Client) Cookie() string {
	return c.cookie
}

// FetchEmojis 获取表情包列表。apiType 为 "user" 或 "official"（其他值默认 user）。
// 返回过滤掉 type==13 收藏包和空 emote 包的有效列表。
func (c *Client) FetchEmojis(ctx context.Context, apiType string) ([]Package, error) {
	if c.cookie == "" {
		return nil, fmt.Errorf("未设置 B站 Cookie，请在环境变量中配置 BILIBILI_COOKIES")
	}

	var apiURL string
	switch apiType {
	case "official":
		apiURL = APIOfficial
		log.Info().Str("api", "official").Msg("使用官方表情 API")
	default:
		apiURL = APIUser
		log.Info().Str("api", "user").Msg("使用用户收藏表情 API")
	}

	return c.fetchEmojisFrom(ctx, apiURL, apiType)
}

// fetchEmojisFrom 实际执行请求并解析（url 由调用方决定，便于测试指向 httptest）。
func (c *Client) fetchEmojisFrom(ctx context.Context, apiURL, apiType string) ([]Package, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Referer", "https://www.bilibili.com")
	req.Header.Set("Cookie", c.cookie)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var apiResp Response
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if apiResp.Code != 0 {
		return nil, fmt.Errorf("API 错误: code=%d, msg=%s", apiResp.Code, apiResp.Msg)
	}

	packages := apiResp.Data.Packages
	if len(packages) == 0 {
		if len(apiResp.Data.UserPanelPackages) > 0 {
			packages = apiResp.Data.UserPanelPackages
		} else if len(apiResp.Data.AllPackages) > 0 {
			packages = apiResp.Data.AllPackages
		}
	}

	if len(packages) == 0 {
		log.Warn().Str("api_url", apiURL).RawJSON("response", body).Msg("B站表情 API 返回空 packages，打印原始响应供排查")
	}

	var validPackages []Package
	for _, pkg := range packages {
		if pkg.Type == 13 || len(pkg.Emote) == 0 {
			continue
		}
		validPackages = append(validPackages, pkg)
	}

	return validPackages, nil
}
