// Package mcp - robots.go 提供 robots.txt 预检实现。
//
// scrape_url tool 调目标 URL 前先拉目标站点 /robots.txt，遵守 Disallow 规则。
// 这是抓取礼仪（避免被源站封 IP），与 SSRF 防护一起作为抓取前的预检。
//
// 策略选择（硬拒绝 vs warning）：本博客作为"转载别人文章"的工具，应站在源站立场——
// 源站 robots.txt 标 Disallow 即明确表达"不希望你抓"。即便 RFC 9309 把 robots 定位为
// 自愿遵守的礼仪（协议层面不强制），本博客选择**硬拒绝**作为对源站意愿的尊重，
// 这符合博客转载的合规立场。agent 看到 robots 拒绝错误后，可改抓其它允许的源。
package mcp

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/temoto/robotstxt"

	"blog-api/internal/brand"
	"blog-api/internal/infrastructure/ssrf"
)

// RobotsChecker robots.txt 预检的默认实现。
// 每次抓取前拉 /robots.txt（SSRF 防护 Transport）→ 用 temoto/robotstxt 解析 →
// 按 User-Agent brand.ImporterProduct 判定目标 path 是否允许。
//
// 不缓存 robots.txt（站点稀疏访问，缓存收益低；TTL 失效反而是 bug 源）。
// 真要缓存可后续在 infra 加 LRU，本期不做（YAGNI）。
type RobotsChecker struct {
	client *http.Client
}

// NewRobotsChecker 构造默认实现。复用 ssrf.NewSafeTransport 保证 robots.txt
// 抓取本身也防 SSRF（攻击者可能让 /robots.txt 指向内网）。
func NewRobotsChecker() *RobotsChecker {
	return &RobotsChecker{
		client: &http.Client{
			Timeout:   10 * time.Second,
			Transport: ssrf.NewSafeTransport(),
		},
	}
}


// Allowed 判断 target URL 是否被目标站点 robots.txt 允许抓取。
// 第二返回值为拒绝原因。
//
// 拉不到 robots.txt 时的放行策略（显式产品决策，非完全遵循 RFC 9309）：
//   - 4xx：RFC 9309 §2.3.1.3 规定 allow-all，遵循。
//   - 5xx / 网络不可达：RFC 9309 规定 temporary full disallow；
//     本博客选择 fail-open 放行——源站 robots 故障不应导致全量不可抓，
//     且抓取方仅单点低频请求，风险可控。此为偏离规范的产品决策。
func (r *RobotsChecker) Allowed(ctx context.Context, target string) (bool, string, error) {
	parsed, err := url.Parse(target)
	if err != nil {
		return false, "", fmt.Errorf("无效的 URL: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false, "仅允许 http/https", nil
	}
	robotsURL := fmt.Sprintf("%s://%s/robots.txt", parsed.Scheme, parsed.Host)

	req, err := http.NewRequestWithContext(ctx, "GET", robotsURL, nil)
	if err != nil {
		return false, "", err
	}
	req.Header.Set("User-Agent", brand.ImporterProduct)
	resp, err := r.client.Do(req)
	if err != nil {
		// 网络不可达：RFC 9309 是 temporary disallow，本博客产品决策 fail-open（见 Allowed 注释）
		return true, "", nil
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		// 4xx：RFC 9309 §2.3.1.3 allow-all。
		// 5xx：RFC 9309 是 temporary disallow，本博客产品决策 fail-open（见 Allowed 注释）。
		return true, "", nil
	}
	body, err := io.ReadAll(ssrf.LimitBody(resp.Body, ssrf.MaxBodyBytes))
	if err != nil {
		return true, "", nil
	}
	robots, err := robotstxt.FromBytes(body)
	if err != nil {
		return true, "", nil // 解析失败也放行
	}
	group := robots.FindGroup(brand.ImporterProduct)
	if group == nil {
		// 无匹配 UA 组：默认 * 组或全允许
		return true, "", nil
	}
	if group.Test(parsed.Path) {
		return true, "", nil
	}
	return false, fmt.Sprintf("robots.txt 禁止 %s 抓取路径 %s", brand.ImporterProduct, parsed.Path), nil
}
