// Package coderunner 实现代码运行器的基础设施适配器。
//
// SandboxRunner 的 Docker 实现（docker_runner.go）、语言注册表（languages.go）、
// 资源钳制（config.go）。架构决策见 docs/adr/0006-code-runner-architecture.md。
package coderunner

import (
	"math"

	"blog-api/config"
	domaincoderunner "blog-api/internal/domain/coderunner"
)

// maxLimitsSnapshot 全局上限快照（从 config.CodeRunnerConfig 读取）。
//
// 用包级变量而非每次读 config，避免 ClampLimits 热路径上的间接寻址。
// InitMaxLimits 在应用启动时调用一次（T5 的 container 初始化里）。
type maxLimitsSnapshot struct {
	MaxCPUCores    float64
	MaxMemoryMB    uint64
	MaxTimeoutSecs uint64
	MaxOutputBytes uint64
	AllowNetwork   bool
}

// 包级全局状态。测试通过临时覆盖 + defer 还原。
var (
	globalMaxLimits = maxLimitsSnapshot{
		MaxCPUCores:    2.0,
		MaxMemoryMB:    1024,
		MaxTimeoutSecs: 30,
		MaxOutputBytes: 1048576,
		AllowNetwork:   false,
	}
	// globalAllowedLanguages 语言白名单。nil 表示不限制（注册表里的全部语言可用）。
	globalAllowedLanguages []string
)

// InitMaxLimits 从 config.CodeRunnerConfig 初始化全局上限与白名单。
// 在应用启动时调用一次（T5 container 初始化）。
func InitMaxLimits(cfg config.CodeRunnerConfig) {
	globalMaxLimits = maxLimitsSnapshot{
		MaxCPUCores:    cfg.MaxCPUCores,
		MaxMemoryMB:    cfg.MaxMemoryMB,
		MaxTimeoutSecs: cfg.MaxTimeoutSecs,
		MaxOutputBytes: cfg.MaxOutputBytes,
		AllowNetwork:   cfg.AllowNetwork,
	}
	if len(cfg.Languages) > 0 {
		canonical := make([]string, 0, len(cfg.Languages))
		for _, l := range cfg.Languages {
			canonical = append(canonical, NormalizeLang(l))
		}
		globalAllowedLanguages = canonical
	} else {
		globalAllowedLanguages = nil
	}
}

// ClampLimits 把作者声明的 overrides 钳制到全局上限内。
//
// 对齐 yggdrasil runner_config.rs::clamp_limits：
//   - cpu/memory/timeout 各自有 min 下限（防止 max 设过低时钳成 0）
//   - allow_network 取「作者声明 && 全局开关 && 语言允许」三者与
//   - output_bytes 只取 min（不设下限，0 也合法）
//
// langAllowsNetwork 为该语言是否本身允许网络（LanguageDef.AllowNetwork）。
func ClampLimits(merged domaincoderunner.ResourceLimits, langAllowsNetwork bool) domaincoderunner.ResourceLimits {
	cfg := globalMaxLimits

	// CPU：min 下限防 max 设过低；NaN 防御（JSON 解析异常）
	maxCPU := cfg.MaxCPUCores
	if math.IsNaN(maxCPU) {
		maxCPU = 2.0
	}
	minCPU := math.Min(0.1, maxCPU)
	cpu := minCPU
	if !math.IsNaN(merged.CPUCores) {
		cpu = clampFloat(merged.CPUCores, minCPU, maxCPU)
	}

	// memory/timeout：各自 min 下限（不超过 max，防止 max=0 时钳成 0）
	minMem := min64(16, cfg.MaxMemoryMB)
	memory := clampUint64(merged.MemoryMB, minMem, cfg.MaxMemoryMB)

	minTimeout := min64(1, cfg.MaxTimeoutSecs)
	timeout := clampUint64(merged.TimeoutSecs, minTimeout, cfg.MaxTimeoutSecs)

	return domaincoderunner.ResourceLimits{
		CPUCores:     cpu,
		MemoryMB:     memory,
		TimeoutSecs:  timeout,
		OutputBytes:  minUint64(merged.OutputBytes, cfg.MaxOutputBytes),
		AllowNetwork: merged.AllowNetwork && cfg.AllowNetwork && langAllowsNetwork,
	}
}

func clampFloat(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func clampUint64(v, lo, hi uint64) uint64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func min64(a, b uint64) uint64 {
	if a < b {
		return a
	}
	return b
}

func minUint64(a, b uint64) uint64 {
	if a < b {
		return a
	}
	return b
}
