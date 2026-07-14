// Package handler 提供 mimo-music HTTP 服务的请求处理器。
//
// handler 是薄层：解析 HTTP 请求，调用 service 层，封装响应。
// 不含业务逻辑。当前只有 health 端点，后续 issue 会添加 auth / playlist / song / search。
package handler

import (
	"net/http"

	"github.com/VOD-Studio/mimo-music/internal/server/response"
)

// HealthData 是 health 端点的响应数据。
type HealthData struct {
	// Status 是服务健康状态，固定为 "ok"。
	Status string `json:"status"`
}

// Health 处理 GET /health 请求，返回服务健康状态。
func Health(w http.ResponseWriter, r *http.Request) {
	response.OK(w, HealthData{Status: "ok"})
}
