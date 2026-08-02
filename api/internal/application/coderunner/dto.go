// Package coderunner 编排代码执行的用例。
//
// StartExec（轮询路径）与 StartExecStream（SSE 流式路径）共用同一套校验链
// 与沙箱执行。校验：语言白名单 → 源码大小。沙箱执行：信号量限并发 →
// ClampLimits 资源钳制 → SandboxRunner 起隔离容器。错误脱敏：匿名可见
// 「不支持的语言/超限」；系统内部异常一律「系统暂时不可用」（见 ADR-0006）。
package coderunner

import domaincoderunner "blog-api/internal/domain/coderunner"

// ExecRequest 代码执行请求（前端 POST body）。
//
// Language 可为别名（js/ts/rs），application 层经 NormalizeLang 归一为
// canonical key 后再进 domain/基础设施。Overrides 为作者在围栏 info string
// 里声明的资源覆盖，nil 表示用语言默认限制。
type ExecRequest struct {
	Language  string                          `json:"language"`
	Source    string                          `json:"source"`
	Overrides *domaincoderunner.ResourceLimits `json:"overrides,omitempty"`
}

// ExecResult 单次执行的最终结果（轮询路径返回，SSE 路径的 done 事件载荷）。
type ExecResult struct {
	Status     string `json:"status"` // 终态状态：success（正常退出）/error（用户代码非零退出）/timeout（超时强杀）/oom_killed（内存超限）/failed（系统异常）
	Stdout     string `json:"stdout"`
	Stderr     string `json:"stderr"`
	ExitCode   *int   `json:"exit_code,omitempty"`
	DurationMs uint64 `json:"duration_ms"` // 执行耗时（毫秒）
	Language   string `json:"language"`
}

// ExecTask 对外任务视图（GET /tasks/{id} 返回）。
//
// 与 domain.ExecutionTask 区别：ID/UserID 为字符串（JSON 友好）、不含 Source
// （源码不回传，避免泄漏/放大响应）。
type ExecTask struct {
	ID         string `json:"id"`
	Language   string `json:"language"`
	Status     string `json:"status"` // 状态机：queued/running（进行中，前端继续轮询）→ success/error/timeout/oom_killed/failed（终态）
	Stdout     string `json:"stdout"`
	Stderr     string `json:"stderr"`
	ExitCode   *int   `json:"exit_code,omitempty"`
	DurationMs uint64 `json:"duration_ms"` // 执行耗时（毫秒）；queued/running 态为 0
}

// FromDomainTask 把 domain 聚合转为对外 DTO。
func FromDomainTask(t *domaincoderunner.ExecutionTask) ExecTask {
	return ExecTask{
		ID:         t.ID().String(),
		Language:   t.Language(),
		Status:     t.Status(),
		Stdout:     t.Stdout(),
		Stderr:     t.Stderr(),
		ExitCode:   t.ExitCode(),
		DurationMs: t.DurationMs(),
	}
}
