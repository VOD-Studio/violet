// Package mimomusic 提供 mimo-music 服务的官方 HTTP client SDK。
//
// 调用方 import 本包即可调用 mimo-music 全量端点，无需手写 HTTP。
// SDK 自带统一错误映射、指数退避重试和 context 支持。
//
// SDK 的 DTO 镜像 mimo-music HTTP 响应的 JSON 结构，不依赖
// mimo-music 任何内部包，可作为独立库被外部项目复用。
package mimomusic

import "errors"

// 业务错误。SDK 把 mimo-music HTTP 信封里的业务 code 映射到这些哨兵 error，
// 调用方用 errors.Is 判定，不靠字符串。
var (
	// ErrUnauthorized 表示登录态失效或未登录（HTTP 401，code 10401）。
	ErrUnauthorized = errors.New("登录态失效")

	// ErrRateLimited 表示被限流（HTTP 429，code 10429）。
	ErrRateLimited = errors.New("被限流")

	// ErrNotFound 表示请求的资源不存在（HTTP 404，code 10404）。
	ErrNotFound = errors.New("资源不存在")

	// ErrUpstreamUnavailable 表示上游（网易云）不可用（HTTP 502，code 10502）。
	ErrUpstreamUnavailable = errors.New("上游不可用")

	// ErrInvalidResponse 表示 mimo-music 返回了无法解析的响应。
	ErrInvalidResponse = errors.New("响应格式无效")

	// ErrUnsupportedPlatform 表示不支持的平台（HTTP 503，code 10503）。
	ErrUnsupportedPlatform = errors.New("不支持的平台")

	// ErrServerError 表示 mimo-music 内部错误（HTTP 500，code 10500），
	// 不属于任何已知业务错误时返回。
	ErrServerError = errors.New("服务内部错误")

	// ErrInvalidRequest 表示请求参数错误（HTTP 400，code 10400）。
	ErrInvalidRequest = errors.New("请求参数错误")

	// ErrNetwork 表示网络层错误（连接超时、连接拒绝、DNS 失败等），
	// 与业务层 ErrUpstreamUnavailable（服务端返回 10502）区分。
	// 调用方用 errors.Is(err, ErrNetwork) 单独判定网络故障。
	ErrNetwork = errors.New("网络错误")
)

// businessError 映射 HTTP 信封业务 code 到哨兵 error。
//
// code=0 表示成功返回 nil。未知 code 归到 ErrServerError。
func businessError(code int) error {
	switch code {
	case 0:
		return nil
	case 10400:
		return ErrInvalidRequest
	case 10401:
		return ErrUnauthorized
	case 10404:
		return ErrNotFound
	case 10429:
		return ErrRateLimited
	case 10500:
		return ErrServerError
	case 10502:
		return ErrUpstreamUnavailable
	case 10503:
		return ErrUnsupportedPlatform
	default:
		return ErrServerError
	}
}
