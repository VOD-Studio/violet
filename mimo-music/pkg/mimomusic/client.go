// Package mimomusic 提供 mimo-music 服务的官方 HTTP client SDK。
package mimomusic

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// 信封是 mimo-music HTTP 服务的统一响应结构 {code, data, message}。
type envelope struct {
	Code    int             `json:"code"`
	Data    json.RawMessage `json:"data"`
	Message string          `json:"message"`
}

// Client 是 mimo-music 服务的 HTTP client。
//
// 由 NewClient 构造，内部自带指数退避重试和 context 支持。
// 各能力方法分别定义在 playlist.go / song.go / search.go 等文件。
type Client struct {
	baseURL    string
	httpClient *http.Client
	maxRetries int
	baseDelay  time.Duration
}

// Option 是 Client 的配置项。
type Option func(*Client)

// WithHTTPClient 设置底层 http.Client（默认用 http.DefaultClient）。
func WithHTTPClient(h *http.Client) Option {
	return func(c *Client) { c.httpClient = h }
}

// WithTimeout 设置单次请求的超时。
func WithTimeout(d time.Duration) Option {
	return func(c *Client) { c.httpClient = &http.Client{Timeout: d} }
}

// WithRetry 设置最大重试次数和指数退避初始间隔。
//
// maxRetries=0 表示不重试。仅对可重试错误（上游不可用 / 限流）生效。
func WithRetry(maxRetries int, baseDelay time.Duration) Option {
	return func(c *Client) {
		c.maxRetries = maxRetries
		c.baseDelay = baseDelay
	}
}

// NewClient 创建 mimo-music HTTP client。
//
// baseURL 是 mimo-music 服务地址（如 http://localhost:3721），结尾斜杠会被去掉。
func NewClient(baseURL string, opts ...Option) *Client {
	c := &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: http.DefaultClient,
		maxRetries: 3,
		baseDelay:  200 * time.Millisecond,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// isRetryableHTTP 判断 HTTP 响应是否值得重试。
//
// 5xx 和 429 可重试，其余不重试。
func isRetryableHTTP(statusCode int) bool {
	return statusCode >= 500 || statusCode == http.StatusTooManyRequests
}

// isRetryableErr 判断 Go 层 error 是否可重试。
func isRetryableErr(err error) bool {
	return errors.Is(err, ErrUpstreamUnavailable) || errors.Is(err, ErrRateLimited)
}

// requestOptions 是单次请求的配置。
type requestOptions struct {
	cookie    string
	body      any // 非 nil 时 JSON 序列化作为请求体（仅 POST 用）
	xCookie   bool // true 时把 cookie 放进 X-Cookie header（mimo-music 登录态端点约定）
}

// do 发起带重试的请求，把信封 data 反序列化到 out。
//
// 业务错误（信封 code != 0）映射到哨兵 error 后返回，不重试确定性错误。
// 网络错误和可重试 HTTP 状态码按指数退避重试。
func (c *Client) do(ctx context.Context, method, path string, query url.Values, opts requestOptions, out any) error {
	targetURL := c.baseURL + path
	if len(query) > 0 {
		targetURL += "?" + query.Encode()
	}

	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		err := c.doOnce(ctx, method, targetURL, opts, out)
		if err == nil {
			return nil
		}
		lastErr = err
		if !isRetryableErr(err) {
			return err
		}
		if attempt < c.maxRetries {
			delay := c.baseDelay * (1 << attempt)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}
	}
	return lastErr
}

// doOnce 发起单次请求并解析信封。
func (c *Client) doOnce(ctx context.Context, method, targetURL string, opts requestOptions, out any) error {
	var body io.Reader
	var contentType string
	if method == http.MethodPost {
		if opts.body != nil {
			raw, err := json.Marshal(opts.body)
			if err != nil {
				return fmt.Errorf("%w: 请求体序列化失败: %v", ErrInvalidResponse, err)
			}
			body = bytes.NewReader(raw)
			contentType = "application/json"
		} else {
			body = bytes.NewReader(nil)
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, targetURL, body)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidResponse, err)
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if opts.cookie != "" {
		if opts.xCookie {
			// mimo-music 登录态端点（status/logout）约定从 X-Cookie header 取 cookie。
			req.Header.Set("X-Cookie", opts.cookie)
		} else {
			req.Header.Set("Cookie", opts.cookie)
		}
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// 网络层错误（含超时、连接拒绝、DNS 失败）统一归到上游不可用，可重试。
		// 确定性错误由信封业务 code 表达，不会走到这里。
		return fmt.Errorf("%w: %v", ErrUpstreamUnavailable, err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("%w: 读取响应失败: %v", ErrInvalidResponse, err)
	}

	var env envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return fmt.Errorf("%w: JSON 解析失败: %v", ErrInvalidResponse, err)
	}

	// 业务错误码优先于 HTTP 状态码映射。
	if bizErr := businessError(env.Code); bizErr != nil {
		// 限流（10429）和上游不可用（10502）可重试，其余确定性错误直接返回。
		if env.Code == 10429 {
			return fmt.Errorf("%w: %s", ErrRateLimited, env.Message)
		}
		if env.Code == 10502 {
			return fmt.Errorf("%w: %s", ErrUpstreamUnavailable, env.Message)
		}
		return bizErr
	}

	// 信封 code=0 但 HTTP 状态码非 2xx，按 HTTP 状态码兜底。
	if isRetryableHTTP(resp.StatusCode) {
		return fmt.Errorf("%w: HTTP %d", ErrUpstreamUnavailable, resp.StatusCode)
	}

	if out != nil && len(env.Data) > 0 {
		if err := json.Unmarshal(env.Data, out); err != nil {
			return fmt.Errorf("%w: data 解析失败: %v", ErrInvalidResponse, err)
		}
	}
	return nil
}

// doGET 发起 GET 请求。
func (c *Client) doGET(ctx context.Context, path string, query url.Values, out any) error {
	return c.do(ctx, http.MethodGet, path, query, requestOptions{}, out)
}

// doPOST 发起 POST 请求，body 序列化为 JSON。
func (c *Client) doPOST(ctx context.Context, path string, body any, out any) error {
	return c.do(ctx, http.MethodPost, path, nil, requestOptions{body: body}, out)
}

// doGETWithXCookie 发起带 X-Cookie header 的 GET 请求（mimo-music 登录态查询用）。
func (c *Client) doGETWithXCookie(ctx context.Context, path string, query url.Values, cookie string, out any) error {
	return c.do(ctx, http.MethodGet, path, query, requestOptions{cookie: cookie, xCookie: true}, out)
}

// doPOSTWithXCookie 发起带 X-Cookie header 的 POST 请求（mimo-music 登出用）。
func (c *Client) doPOSTWithXCookie(ctx context.Context, path string, query url.Values, cookie string, out any) error {
	return c.do(ctx, http.MethodPost, path, query, requestOptions{cookie: cookie, xCookie: true}, out)
}
