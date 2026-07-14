// Package response 提供 mimo-music HTTP 服务的统一响应封装。
//
// 所有端点返回统一信封 {code, data, message}：
//   - code=0 表示成功，非零表示业务错误
//   - data 是响应数据
//   - message 是人类可读的说明，成功时为空
package response

import (
	"encoding/json"
	"net/http"
)

// Code 是响应信封中的业务状态码。
//
// 0 表示成功，非零值对应 errors 包定义的错误类型。
// 具体错误码在后续 issue（登录 HTTP 端点）中定义。
type Code int

// Envelope 是统一的 HTTP 响应结构。
type Envelope struct {
	// Code 是业务状态码，0 表示成功。
	Code Code `json:"code"`

	// Data 是响应数据，成功时有值，失败时为 null。
	Data any `json:"data"`

	// Message 是人类可读的说明，成功时为空字符串。
	Message string `json:"message"`
}

// OK 写入成功响应（HTTP 200）。
func OK(w http.ResponseWriter, data any) {
	write(w, http.StatusOK, Envelope{Code: 0, Data: data, Message: ""})
}

// Error 写入错误响应。
//
// status 是 HTTP 状态码，code 是业务错误码，message 是说明。
func Error(w http.ResponseWriter, status int, code Code, message string) {
	write(w, status, Envelope{Code: code, Data: nil, Message: message})
}

func write(w http.ResponseWriter, status int, env Envelope) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(env)
}
