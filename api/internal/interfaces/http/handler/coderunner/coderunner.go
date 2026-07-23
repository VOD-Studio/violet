// Package coderunner 提供 code-runner 模块的 HTTP handler。
//
// 三端点：
//   - POST /api/v1/code-runner/run        提交执行（轮询路径）
//   - GET  /api/v1/code-runner/run/stream 提交流式执行 + SSE 回传（阅读页用）
//   - GET  /api/v1/code-runner/tasks/{id} 查询任务结果（轮询兜底）
//
// SSE 端点必须用 GET（EventSource 限制 + 绕过 CSRF 中间件）。
package coderunner

import (
	"encoding/json"
	"net/http"
	"time"

	appcoderunner "blog-api/internal/application/coderunner"
	domaincoderunner "blog-api/internal/domain/coderunner"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
	"blog-api/internal/interfaces/http/response"
)

// Handler code-runner HTTP 处理器。
type Handler struct {
	svc *appcoderunner.Service
}

// NewHandler 创建 code-runner handler。
func NewHandler(svc *appcoderunner.Service) *Handler {
	return &Handler{svc: svc}
}

// runRequest 提交执行的请求体。
type runRequest struct {
	Language string                            `json:"language"`
	Source   string                            `json:"source"`
	Overrides *domaincoderunner.ResourceLimits `json:"overrides,omitempty"`
}

// Run 提交执行请求（轮询路径）。
//
// 解析 body → 构造 ExecRequest → 调 StartExec → 返回 task_id。
// 前端拿到 task_id 后轮询 GET /tasks/{id}。
func (h *Handler) Run(w http.ResponseWriter, r *http.Request) {
	req, err := decodeRunRequest(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}

	uid, err := userIDFromContext(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}

	taskID, err := h.svc.StartExec(r.Context(), req, uid)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]string{"task_id": taskID})
}

// RunStream 提交流式执行请求。
//
// 与 Run 同输入，返回 task_id。前端拿到后用 EventSource 连
// GET /run/stream?task_id=X 接收 stdout/stderr/done 事件。
func (h *Handler) RunStream(w http.ResponseWriter, r *http.Request) {
	req, err := decodeRunRequest(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}

	uid, err := userIDFromContext(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}

	taskID, err := h.svc.StartExecStream(r.Context(), req, uid)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]string{"task_id": taskID})
}

// Stream SSE 流式回传 stdout/stderr/done 事件。
//
// GET /run/stream?task_id=X。从 svc.ConsumeStream 取走 channel（一次性），
// 循环读 chunk 写 SSE 事件 + Flush。15s keep-alive 防代理超时。
// 客户端断开（r.Context().Done()）时退出。
//
// 注意：本端点注册为 POST（提交流式执行），而非 GET——因为 EventSource 只支持 GET
// 但不能带 body。这里拆成「POST 提交拿 task_id」+「前端 EventSource 连 GET」两步。
// 实际 GET SSE 端点在路由层单独注册（见 main.go）。
func (h *Handler) Stream(w http.ResponseWriter, r *http.Request) {
	taskID := r.URL.Query().Get("task_id")
	if taskID == "" {
		response.RespondError(w, r, domainshared.BadRequest("task_id 不能为空"))
		return
	}

	ch := h.svc.ConsumeStream(taskID)
	if ch == nil {
		// channel 不存在或已被消费：返回 404 让前端降级到轮询
		response.RespondError(w, r, domaincoderunner.ErrTaskNotFound)
		return
	}

	// SSE 响应头
	flusher, ok := w.(http.Flusher)
	if !ok {
		response.RespondError(w, r, domainshared.Internal("服务器不支持流式响应", nil))
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	// X-Accel-Buffering: no 关闭 nginx-proxy 缓冲，保证 chunk 实时推送
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	// keep-alive ticker（15s，对应 ygggrasil）
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	ctx := r.Context()
	for {
		select {
		case chunk, ok := <-ch:
			if !ok {
				// channel 关闭（done 已推送），结束
				return
			}
			if err := writeSSE(w, chunk); err != nil {
				return
			}
			flusher.Flush()
		case <-ticker.C:
			// keep-alive 注释行，防代理认为连接空闲而断开
			if _, err := w.Write([]byte(": keep-alive\n\n")); err != nil {
				return
			}
			flusher.Flush()
		case <-ctx.Done():
			// 客户端断开
			return
		}
	}
}

// GetTask 查询任务结果（轮询兜底路径）。
//
// GET /tasks/{id}。SSE 不可用或编辑器内运行时用。
func (h *Handler) GetTask(w http.ResponseWriter, r *http.Request) {
	taskID := r.PathValue("id")
	if taskID == "" {
		response.RespondError(w, r, domainshared.BadRequest("task_id 不能为空"))
		return
	}

	task, err := h.svc.GetExecResult(r.Context(), taskID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, task)
}

// decodeRunRequest 解析提交请求的公共逻辑。
func decodeRunRequest(r *http.Request) (appcoderunner.ExecRequest, error) {
	var req runRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return appcoderunner.ExecRequest{}, domainshared.BadRequest("请求格式无效")
	}
	if req.Language == "" {
		return appcoderunner.ExecRequest{}, domainshared.BadRequest("language 不能为空")
	}
	return appcoderunner.ExecRequest{
		Language: req.Language,
		Source:   req.Source,
		Overrides: req.Overrides,
	}, nil
}

// userIDFromContext 从 session 中间件注入的 context 取 userID。
// 未登录返回 Unauthorized 错误。
func userIDFromContext(r *http.Request) (domainshared.ID, error) {
	uidStr := middleware.GetUserID(r.Context())
	if uidStr == "" {
		return domainshared.ID{}, domainshared.Unauthorized("未登录")
	}
	uid, err := domainshared.ParseID(uidStr)
	if err != nil {
		return domainshared.ID{}, domainshared.Unauthorized("用户身份无效")
	}
	return uid, nil
}

// writeSSE 写一个 SSE 事件：event:<type>\ndata:<data>\n\n
func writeSSE(w http.ResponseWriter, chunk appcoderunner.OutputChunk) error {
	// event 行
	if _, err := w.Write([]byte("event: " + chunk.Type + "\n")); err != nil {
		return err
	}
	// data 行（SSE 规范：多行 data 各自前缀 data:）
	for _, line := range splitLines(chunk.Data) {
		if _, err := w.Write([]byte("data: " + line + "\n")); err != nil {
			return err
		}
	}
	// 空行结束事件
	_, err := w.Write([]byte("\n"))
	return err
}

// splitLines 按换行拆分（SSE data 多行需各自 data: 前缀）。
func splitLines(s string) []string {
	if s == "" {
		return []string{""}
	}
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	lines = append(lines, s[start:])
	return lines
}
