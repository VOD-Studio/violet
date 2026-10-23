// Package coderunner 定义代码运行器领域模型。
//
// 承载「文章/编辑器中的可运行代码块」提交到后端沙箱执行、回流结果的核心能力。
// 后端用 Docker SDK 调 unix socket（兼容 docker 与 podman），在隔离容器内执行，
// stdout/stderr 经 SSE 流式回传到阅读页终端。支持 python/node/go/rust/bun 五种语言。
// 架构决策见 docs/adr/0006-code-runner-architecture.md。
package coderunner

import (
	"fmt"
	"slices"
	"strings"
)

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
// 部署配置、旧配置迁移与执行入口统一使用 NormalizeLang 处理别名。
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
// application 层经 NormalizeLang 归一后再进入校验。空串、多 token、含
// shell 元字符的值一律拒绝——这些是命令注入的常见载荷。
func IsValidLanguage(lang string) bool {
	clean := strings.ToLower(strings.TrimSpace(lang))
	_, ok := supportedLanguages[clean]
	return ok
}

// NormalizeLang 将既有语言别名归一化；未知标识保留供调用方拒绝。
func NormalizeLang(lang string) string {
	clean := strings.ToLower(strings.TrimSpace(lang))
	switch clean {
	case "js", "javascript":
		return "node"
	case "rs":
		return "rust"
	case "ts", "typescript":
		return "bun"
	default:
		return clean
	}
}

// NormalizeLanguages 归一化并去重白名单，未知语言不能扩大为部署默认。
func NormalizeLanguages(languages []string) ([]string, error) {
	normalized := make([]string, 0, len(languages))
	for _, language := range languages {
		canonical := NormalizeLang(language)
		if canonical == "" {
			continue
		}
		if !IsValidLanguage(canonical) {
			return nil, fmt.Errorf("不支持的运行语言：%q", language)
		}
		if !slices.Contains(normalized, canonical) {
			normalized = append(normalized, canonical)
		}
	}
	return normalized, nil
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
// 作者可在围栏声明资源覆盖；执行时按提交策略和启动前策略的较严边界钳制。
// 联网仍需作者声明、语言许可与有效策略同时允许。
type ResourceLimits struct {
	// CPUCores 单次执行的 CPU 核数上限。
	CPUCores float64 `json:"cpu_cores"`
	// MemoryMB 单次执行的内存上限，单位 MiB。
	MemoryMB uint64 `json:"memory_mb"`
	// TimeoutSecs 单次执行的最大墙钟秒数。
	TimeoutSecs uint64 `json:"timeout_secs"`
	// OutputBytes stdout/stderr 合计字节上限，超出部分截断。
	OutputBytes uint64 `json:"output_bytes"`
	// AllowNetwork 作者的联网请求，不单独构成联网授权。
	AllowNetwork bool `json:"allow_network"`
}
