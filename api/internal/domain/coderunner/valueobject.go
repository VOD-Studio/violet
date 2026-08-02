// Package coderunner 定义代码运行器领域模型。
//
// 承载「文章/编辑器中的可运行代码块」提交到后端沙箱执行、回流结果的核心能力。
// 后端用 Docker SDK 调 unix socket（兼容 docker 与 podman），在隔离容器内执行，
// stdout/stderr 经 SSE 流式回传到阅读页终端。支持 python/node/go/rust/bun 五种语言。
// 架构决策见 docs/adr/0006-code-runner-architecture.md。
package coderunner

import "strings"

// 执行状态机：
//
//	Queued → Running → Success | Error | Timeout | OomKilled | Failed
//
// 前两个为非终态（前端可继续轮询/SSE）；后五个为终态（任务结束）。
// Failed 表示系统内部异常（容器拉起失败等），Error 表示用户代码非零退出。
const (
	StatusQueued    = "queued"
	StatusRunning   = "running"
	StatusSuccess   = "success"
	StatusError     = "error"
	StatusTimeout   = "timeout"
	StatusOomKilled = "oom_killed"
	StatusFailed    = "failed"
)

// supportedLanguages 注册表里支持的语言 canonical key。
//
// 与 infrastructure/coderunner/languages.go 的 LANGUAGES 注册表保持同步。
// 别名归一（js→node、ts→bun、rs→rust）在 application 层执行，domain 只认 canonical。
var supportedLanguages = map[string]struct{}{
	"python": {},
	"node":   {},
	"go":     {},
	"rust":   {},
	"bun":    {},
}

// IsValidLanguage 判断语言标识是否在支持列表内（大小写不敏感、容忍首尾空白）。
//
// 仅接受 canonical key（python/node/go/rust/bun），别名（js/ts/rs 等）在
// application 层经 NormalizeLang 归一后再进入 domain。空串、多 token、含
// shell 元字符的值一律拒绝——这些是命令注入的常见载荷。
func IsValidLanguage(lang string) bool {
	clean := strings.ToLower(strings.TrimSpace(lang))
	_, ok := supportedLanguages[clean]
	return ok
}

// IsValidStatus 状态合法性校验。
func IsValidStatus(s string) bool {
	switch s {
	case StatusQueued, StatusRunning, StatusSuccess, StatusError, StatusTimeout, StatusOomKilled, StatusFailed:
		return true
	}
	return false
}

// IsTerminalStatus 是否终态（任务结束，不再变化）。
//
// 非终态（Queued/Running）前端继续轮询或收 SSE；终态后停止。
func IsTerminalStatus(s string) bool {
	switch s {
	case StatusSuccess, StatusError, StatusTimeout, StatusOomKilled, StatusFailed:
		return true
	}
	return false
}

// ResourceLimits 单次执行的资源限制。
//
// 作者可在围栏 info string 里声明覆盖（如 `python runnable {"timeout_secs":10}`），
// 在执行前被 ClampLimits 钳制到全局 CODE_RUNNER_MAX_* 上限内（见 infrastructure 层）。
// allow_network 需作者声明、语言允许、全局开关三者同时为真（见 ClampLimits）。
type ResourceLimits struct {
	// CPUCores 单次执行分配的 CPU 核数上限（ClampLimits 钳制到全局 CodeRunnerMaxCPUCores 内）
	CPUCores float64 `json:"cpu_cores"`
	// MemoryMB 单次执行内存上限（MB，ClampLimits 钳制到全局 CodeRunnerMaxMemoryMB 内）
	MemoryMB uint64 `json:"memory_mb"`
	// TimeoutSecs 单次执行最大墙钟时长（秒，ClampLimits 钳制到全局 CodeRunnerMaxTimeoutSecs 内）
	TimeoutSecs uint64 `json:"timeout_secs"`
	// OutputBytes stdout/stderr 合计最大输出字节（超出截断，ClampLimits 钳制到全局上限内）
	OutputBytes uint64 `json:"output_bytes"`
	// AllowNetwork 是否允许容器联网（最终生效需作者声明 + 语言允许 + 全局开关三者同时为真，见 ClampLimits）
	AllowNetwork bool `json:"allow_network"`
}
