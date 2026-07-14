// Package handler 提供 mimo-music HTTP 服务的请求处理器。
package handler

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics 处理 GET /metrics 请求，暴露 Prometheus 文本格式指标。
//
// 无认证，供 Prometheus scrape 直接拉取。
func Metrics() http.Handler {
	return promhttp.Handler()
}
