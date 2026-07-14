// Package netease 实现网易云音乐平台的 Provider。
package netease

import (
	"encoding/json"
	"fmt"
	"net/http"

	merrors "github.com/VOD-Studio/mimo-music/errors"
)

// neteaseCodeResponse 是网易云响应中包含 code 字段的通用结构。
type neteaseCodeResponse struct {
	// Code 是网易云业务码，200 表示成功。
	Code int `json:"code"`
	// Msg 是错误消息（code != 200 时）。
	Msg string `json:"msg,omitempty"`
	// Message 是另一种消息字段。
	Message string `json:"message,omitempty"`
}

// mapHTTPError 把 HTTP 状态码和响应体映射到统一错误。
//
// 网易云的状态码约定：
//   - HTTP 200 但 body.code != 200 → 业务错误（Cookie 失效、限流等）
//   - HTTP 301/302 → 重定向（通常是未登录）
//   - HTTP 460 → IP 限流
//   - HTTP 5xx → 上游不可用
func mapHTTPError(statusCode int, body []byte) error {
	// HTTP 层面错误
	switch {
	case statusCode == http.StatusOK:
		// 进一步检查 body 里的 code
		return mapBodyCode(body)
	case statusCode == 301 || statusCode == 302:
		return fmt.Errorf("%w: %d 重定向", merrors.ErrUnauthorized, statusCode)
	case statusCode == 401:
		return fmt.Errorf("%w: HTTP 401", merrors.ErrUnauthorized)
	case statusCode == 460:
		return fmt.Errorf("%w: HTTP 460", merrors.ErrRateLimited)
	case statusCode >= 500:
		return fmt.Errorf("%w: HTTP %d", merrors.ErrUpstreamUnavailable, statusCode)
	default:
		return fmt.Errorf("%w: HTTP %d", merrors.ErrUpstreamUnavailable, statusCode)
	}
}

// mapBodyCode 检查响应体的网易云业务 code。
func mapBodyCode(body []byte) error {
	var resp neteaseCodeResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		// 不是 JSON 或没有 code 字段，视为成功（有些端点返回数组）
		return nil
	}

	switch resp.Code {
	case 200:
		return nil
	case 301, -462: // 未登录 / Cookie 失效
		return fmt.Errorf("%w: code=%d", merrors.ErrUnauthorized, resp.Code)
	case 404, 512: // 资源不存在
		return fmt.Errorf("%w: code=%d", merrors.ErrNotFound, resp.Code)
	case 460, 466, 461, -300: // 限流
		return fmt.Errorf("%w: code=%d", merrors.ErrRateLimited, resp.Code)
	case 501, 502, 503, 506, 509, -200: // 服务不可用
		return fmt.Errorf("%w: code=%d", merrors.ErrUpstreamUnavailable, resp.Code)
	default:
		if resp.Code < 0 || resp.Code >= 500 {
			return fmt.Errorf("%w: code=%d %s", merrors.ErrUpstreamUnavailable, resp.Code, resp.Msg)
		}
		return nil
	}
}

// mapNeteaseError 把通用 error 映射到统一错误（兜底）。
func mapNeteaseError(err error) error {
	if err == nil {
		return nil
	}
	// 已经是统一错误，直接返回
	return err
}
