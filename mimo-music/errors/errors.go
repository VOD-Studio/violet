// Package errors 定义 mimo-music 的统一错误模型。
//
// 所有 provider 实现返回这些错误类型，server 层据此映射到 HTTP 状态码。
package errors

import "errors"

// 统一错误定义。
var (
	// ErrUpstreamUnavailable 表示上游（网易云）不可用（网络错误、5xx）。
	ErrUpstreamUnavailable = errors.New("上游不可用")

	// ErrRateLimited 表示被上游限流（HTTP 460 或频率过高）。
	ErrRateLimited = errors.New("被上游限流")

	// ErrNotFound 表示请求的资源不存在（歌单/歌曲 ID 无效）。
	ErrNotFound = errors.New("资源不存在")

	// ErrUnauthorized 表示登录态失效或未登录。
	ErrUnauthorized = errors.New("登录态失效")

	// ErrInvalidResponse 表示上游返回了无法解析的响应。
	ErrInvalidResponse = errors.New("上游响应格式无效")

	// ErrUnsupportedPlatform 表示不支持的平台。
	ErrUnsupportedPlatform = errors.New("不支持的平台")
)
