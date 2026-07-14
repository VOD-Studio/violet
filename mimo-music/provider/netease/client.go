// Package netease 实现网易云音乐平台的 Provider。
package netease

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	merrors "github.com/VOD-Studio/mimo-music/errors"
	"github.com/VOD-Studio/mimo-music/provider"
)

// Client 是网易云 HTTP 客户端。
//
// 用 crypto.go 的 weapi 加密发送请求到网易云端点，解析 JSON 响应。
// 通过 Option 模式注入 Cache / SessionStore / Logger / Cookie。
type Client struct {
	httpClient *http.Client
	opts       provider.Options
}

// New 创建网易云客户端。
func New(opts ...provider.Option) *Client {
	o := provider.ApplyOptions(opts...)
	timeout := time.Duration(o.Timeout) * time.Second
	if timeout == 0 {
		timeout = 10 * time.Second
	}
	return &Client{
		httpClient: &http.Client{Timeout: timeout},
		opts:       o,
	}
}

// Platform 返回平台标识。
func (c *Client) Platform() string { return "netease" }

// Auth 返回 Auth 能力（后续 Issue-0006 实现）。
func (c *Client) Auth() provider.Auth { return &AuthService{client: c} }

// Playlist 返回歌单能力（后续 Issue-0009 实现）。
func (c *Client) Playlist() provider.Playlist { return &PlaylistService{client: c} }

// Song 返回歌曲能力（后续 Issue-0010 实现）。
func (c *Client) Song() provider.Song { return &SongService{client: c} }

// Search 返回搜索能力（后续 Issue-0011 实现）。
func (c *Client) Search() provider.Search { return &SearchService{client: c} }

// weapiPost 发送 weapi 加密 POST 请求。
//
// urlPath 是网易云端点路径（如 /weapi/song/enhance/player/url/v1），
// payload 是 JSON 字符串，cookie 可选。
// 返回原始 JSON 响应体。
func (c *Client) weapiPost(ctx context.Context, urlPath, payload, cookie string) ([]byte, error) {
	encrypted, err := WeAPIEncrypt(payload, "")
	if err != nil {
		return nil, fmt.Errorf("加密失败: %w", err)
	}

	form := strings.NewReader(fmt.Sprintf("params=%s&encSecKey=%s", encrypted.Params, encrypted.EncSecKey))

	url := "https://music.163.com" + urlPath
	req, err := http.NewRequestWithContext(ctx, "POST", url, form)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Referer", "https://music.163.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}

	resp, err := c.httpClient.Do(req)
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

// postJSON 是发送 JSON 请求的通用方法（非加密端点用）。
func (c *Client) postJSON(ctx context.Context, url, payload, cookie string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBufferString(payload))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Referer", "https://music.163.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}

	resp, err := c.httpClient.Do(req)
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

// getCookie 返回当前请求应用的 Cookie（优先用传入的，其次用默认）。
func (c *Client) getCookie(override string) string {
	if override != "" {
		return override
	}
	return c.opts.Cookie
}

// 编译期断言：Client 实现 Provider 接口。
var _ provider.Provider = (*Client)(nil)
