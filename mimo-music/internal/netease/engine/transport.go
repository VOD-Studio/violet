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
	// neteaseUserAgent 是模拟网易云音乐桌面客户端的 User-Agent(参考 chaunsin 验证过的值)。
	neteaseUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) NeteaseMusicDesktop/2.3.17.1034"
)

// transport 封装网易云 HTTP 请求的三种发送方式。
type transport struct {
	client  *http.Client
	baseURL string // API 基础地址，默认 neteaseBaseURL，测试可注入 httptest 地址
}

// newTransport 创建 transport，默认 10 秒超时、baseURL 指向网易云。
func newTransport(timeout time.Duration) *transport {
	if timeout == 0 {
		timeout = 10 * time.Second
	}
	return &transport{client: &http.Client{Timeout: timeout}, baseURL: neteaseBaseURL}
}

// withBaseURL 返回 baseURL 被覆盖的 transport 副本（测试用）。
func (t *transport) withBaseURL(base string) *transport {
	return &transport{client: t.client, baseURL: base}
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

	return t.postForm(ctx, urlPath, encrypted.Params, encrypted.EncSecKey, cookie)
}

// eapiPost 发送 eapi 加密 POST 请求。
//
// encryptedParams 是 EAPIEncrypt 已加密的十六进制密文（不再二次加密，与 weapi 不同）。
// eapi 的请求体只有 params 一个字段（无 encSecKey）。
func (t *transport) eapiPost(ctx context.Context, urlPath, encryptedParams, cookie string) ([]byte, string, error) {
	return t.postForm(ctx, urlPath, encryptedParams, "", cookie)
}

// postForm 发送 form-urlencoded POST 请求的共享实现。
//
// weapi 带 params+encSecKey，eapi 只带 params。encSecKey 为空时只发 params。
// params 值含 base64/十六进制特殊字符（+ = /），必须 URL 编码。
func (t *transport) postForm(ctx context.Context, urlPath, params, encSecKey, cookie string) ([]byte, string, error) {
	formData := url.Values{}
	formData.Set("params", params)
	if encSecKey != "" {
		formData.Set("encSecKey", encSecKey)
	}
	form := strings.NewReader(formData.Encode())

	req, err := http.NewRequestWithContext(ctx, "POST", t.baseURL+urlPath, form)
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
	target := t.baseURL + urlPath
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

	// __remember_me=true 是网易云判断"非恶意请求"的标志 cookie(缺失则返回空 body)。
	// 参考 chaunsin/netease-cloud-music:所有请求默认带此 cookie。
	// 调用方传入的 cookie 若已含则不重复;否则补上。
	if cookie == "" {
		req.Header.Set("Cookie", "__remember_me=true")
	} else if !strings.Contains(cookie, "__remember_me") {
		req.Header.Set("Cookie", cookie+"; __remember_me=true")
	} else {
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

