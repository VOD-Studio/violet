// Package coderunner 编排代码执行的用例。
//
// 两条执行路径共用快照策略、动态并发准入和 Docker 沙箱。
// 排队超时及策略拒绝保留明确原因，依赖故障不降级为无隔离执行。
package coderunner

import domaincoderunner "blog-api/internal/domain/coderunner"

// ExecRequest 代码执行请求（前端 POST body）。
//
// Language 可为别名（js/ts/rs），application 层经 NormalizeLang 归一为
// canonical key 后再进 domain/基础设施。Overrides 为作者在围栏 info string
// 里声明的资源覆盖，nil 表示用语言默认限制。
type ExecRequest struct {
	Language  string                           `json:"language"`
	Source    string                           `json:"source"`
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
