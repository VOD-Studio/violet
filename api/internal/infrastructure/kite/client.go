package kite

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	appmusic "blog-api/internal/application/music"
	"blog-api/internal/infrastructure/ssrf"
)

type Client struct {
	baseURL, token string
	http           *http.Client
}

func NewClient(baseURL, token string) *Client {
	u, err := url.Parse(strings.TrimRight(baseURL, "/"))
	base := ""
	if err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != "" && u.User == nil && u.RawQuery == "" && u.Fragment == "" {
		base = u.String()
	}
	return &Client{baseURL: base, token: token, http: &http.Client{Timeout: 15 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}}
}
func (c *Client) Configured() bool { return c.baseURL != "" && c.token != "" }
func (c *Client) BaseURL() string  { return c.baseURL }
func failure(reason, message string) error {
	return &appmusic.ProviderError{Reason: reason, Message: message}
}
func (c *Client) request(ctx context.Context, method, path, cookie string, q url.Values, out any) error {
	if !c.Configured() {
		return failure("NOT_CONFIGURED", "尚未配置有效的 Kite 地址与服务令牌")
	}
	endpoint := c.baseURL + path
	if len(q) > 0 {
		endpoint += "?" + q.Encode()
	}
	var body io.Reader
	if method == http.MethodPost {
		body = strings.NewReader("{}")
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return failure("UPSTREAM_ERROR", "音乐服务请求创建失败")
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if cookie != "" {
		req.Header.Set("Grpc-Metadata-X-Netease-Cookie", cookie)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return failure("UPSTREAM_ERROR", "Kite 连接失败或请求超时")
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20+1))
	if err != nil || len(raw) > 4<<20 {
		return failure("UPSTREAM_ERROR", "Kite 响应读取失败或过大")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var payload struct {
			Details []struct {
				Reason string `json:"reason"`
			} `json:"details"`
		}
		_ = json.Unmarshal(raw, &payload)
		for _, d := range payload.Details {
			switch d.Reason {
			case "SERVER_AUTH_FAILED":
				return failure(d.Reason, "Kite 服务令牌无效，请检查部署配置")
			case "LOGIN_REQUIRED":
				return failure(d.Reason, "网易云账号未连接或已过期，请重新扫码")
			}
		}
		return failure("UPSTREAM_ERROR", "Kite 未能完成请求，请稍后重试")
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return failure("UPSTREAM_ERROR", "Kite 返回了无效数据")
	}
	return nil
}
func (c *Client) Verify(ctx context.Context) error {
	if err := c.request(ctx, http.MethodGet, "/healthz", "", nil, nil); err != nil {
		return err
	}
	return c.request(ctx, http.MethodGet, "/api/v1/search/hot", "", nil, &struct{}{})
}

// 外部资源只接受绝对 HTTP(S) URL；不返回脚本、凭据或本地地址。
func publicURL(raw string) string {
	u, err := ssrf.ValidateURL(raw)
	if err != nil || u.User != nil || u.Hostname() == "" {
		return ""
	}
	host := strings.ToLower(u.Hostname())
	if host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") {
		return ""
	}
	if ip := net.ParseIP(host); ip != nil && ssrf.IsPrivateIP(ip) {
		return ""
	}
	return u.String()
}
