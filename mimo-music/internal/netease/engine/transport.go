// Package engine 的 HTTP transport 层。
//
// transport 持有 *http.Client，提供三种请求方式：
//   - weapiPost：weapi 加密 POST（大部分接口用）
//   - postJSON：非加密 JSON POST（二维码登录用）
//   - apiGet：非加密 GET（2026 匿名搜索用）
//
// 三种方式都注入 Cookie、Referer、User-Agent，并从响应提取 Set-Cookie。
// 错误映射由 errors.go 的 mapHTTPError 处理。
package engine

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	merrors "github.com/VOD-Studio/mimo-music/errors"
)

const (
	// neteaseBaseURL 是网易云 API 的基础地址。
	neteaseBaseURL = "https://music.163.com"
	// neteaseUserAgent 是模拟浏览器请求的 User-Agent。
	neteaseUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
)

// transport 封装网易云 HTTP 请求的三种发送方式。
type transport struct {
	client *http.Client
}

// newTransport 创建 transport，默认 10 秒超时。
func newTransport(timeout time.Duration) *transport {
	if timeout == 0 {
		timeout = 10 * time.Second
	}
	return &transport{client: &http.Client{Timeout: timeout}}
}

// weapiPost 发送 weapi 加密 POST 请求。
//
// urlPath 是网易云端点路径（如 /weapi/song/enhance/player/url/v1），
// payload 是 JSON 字符串，cookie 可选。
// 返回原始 JSON 响应体和从 Set-Cookie 响应头提取的 Cookie 字符串。
func (t *transport) weapiPost(ctx context.Context, urlPath, payload, cookie string) ([]byte, string, error) {
	encrypted, err := WeAPIEncrypt(payload, "")
	if err != nil {
		return nil, "", fmt.Errorf("加密失败: %w", err)
	}

	// params 和 encSecKey 含 base64/十六进制特殊字符（+ = /），必须 URL 编码
	formData := url.Values{}
	formData.Set("params", encrypted.Params)
	formData.Set("encSecKey", encrypted.EncSecKey)
	form := strings.NewReader(formData.Encode())

	req, err := http.NewRequestWithContext(ctx, "POST", neteaseBaseURL+urlPath, form)
	if err != nil {
		return nil, "", fmt.Errorf("创建请求失败: %w", err)
	}

	setCommonHeaders(req, cookie)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", merrors.ErrUpstreamUnavailable, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("读取响应失败: %w", err)
	}

	if err := mapHTTPError(resp.StatusCode, body); err != nil {
		return nil, "", err
	}

	return body, extractCookies(resp), nil
}

// postJSON 发送非加密 JSON POST 请求（二维码登录用）。
func (t *transport) postJSON(ctx context.Context, fullURL, payload, cookie string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", fullURL, bytes.NewBufferString(payload))
	if err != nil {
		return nil, "", fmt.Errorf("创建请求失败: %w", err)
	}

	setCommonHeaders(req, cookie)
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", merrors.ErrUpstreamUnavailable, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("读取响应失败: %w", err)
	}

	if err := mapHTTPError(resp.StatusCode, body); err != nil {
		return nil, "", err
	}

	return body, extractCookies(resp), nil
}

// apiGet 发送非加密 GET 请求到网易云端点。
//
// 网易云在 2026 年对匿名 weapi 请求做了限制，部分接口用非加密 GET API
// 仍可匿名访问（如 /api/search/get）。
func (t *transport) apiGet(ctx context.Context, urlPath string, params url.Values, cookie string) ([]byte, error) {
	target := neteaseBaseURL + urlPath
	if len(params) > 0 {
		target += "?" + params.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, "GET", target, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	setCommonHeaders(req, cookie)

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", merrors.ErrUpstreamUnavailable, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	if err := mapHTTPError(resp.StatusCode, body); err != nil {
		return nil, err
	}

	return body, nil
}

// setCommonHeaders 设置网易云请求的公共 header（Referer / User-Agent / Cookie）。
func setCommonHeaders(req *http.Request, cookie string) {
	req.Header.Set("Referer", neteaseBaseURL)
	req.Header.Set("User-Agent", neteaseUserAgent)
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
}

// extractCookies 从 HTTP 响应的 Set-Cookie 头提取并合并 Cookie 字符串。
//
// 网易云登录接口通过 Set-Cookie 返回 MUSIC_U / __csrf 等关键 Cookie。
// 多个 Set-Cookie 头合并去重，取每个 cookie 的 name=value 部分，
// 拼成 "k=v; k=v" 格式。同名的 cookie 后者覆盖前者。
func extractCookies(resp *http.Response) string {
	cookies := resp.Cookies()
	if len(cookies) == 0 {
		return ""
	}

	merged := make(map[string]string, len(cookies))
	for _, c := range cookies {
		merged[c.Name] = c.Value
	}

	parts := make([]string, 0, len(merged))
	for name, value := range merged {
		parts = append(parts, name+"="+value)
	}
	return strings.Join(parts, "; ")
}
