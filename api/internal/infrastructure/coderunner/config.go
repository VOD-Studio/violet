// Package coderunner 实现代码运行器的基础设施适配器。
//
// SandboxRunner 的 Docker 实现（docker_runner.go）、语言注册表（languages.go）、
// 资源钳制（config.go）。架构决策见 docs/adr/0006-code-runner-architecture.md。
package coderunner

import (
	"math"
	"strconv"
	"strings"

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
// 在应用启动时调用一次（T5 container 初始化）。同时保存 env fallback 供 ReloadMaxLimitsFromMap 兜底。
func InitMaxLimits(cfg config.CodeRunnerConfig) {
	envFallback = cfg
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

// envFallback 启动时从 env config 读一次，作为 site_settings 未配时的兜底。
// InitMaxLimits 同步设置它。
var envFallback config.CodeRunnerConfig

// ReloadMaxLimitsFromMap 从 site_settings 的 key-value map 刷新全局上限与白名单。
//
// 每次执行前由 application/coderunner/service.go 的 validate 调用（经 SetReloadLimitsFn 注入），
// 实现运行时可配：admin 后台改完，下一次执行即生效（无需重启 api）。
//
// site_settings 值为空/0 表示「未配置」，用 envFallback（启动时 env config）兜底。
// 这样新部署（site_settings 还没值）自动用 env 默认，admin 改过则以 site_settings 为准。
func ReloadMaxLimitsFromMap(m map[string]string) {
	globalMaxLimits = maxLimitsSnapshot{
		MaxCPUCores:    firstFloat(m["code_runner_max_cpu_cores"], envFallback.MaxCPUCores),
		MaxMemoryMB:    firstUint64(m["code_runner_max_memory_mb"], envFallback.MaxMemoryMB),
		MaxTimeoutSecs: firstUint64(m["code_runner_max_timeout_secs"], envFallback.MaxTimeoutSecs),
		MaxOutputBytes: firstUint64(m["code_runner_max_output_bytes"], envFallback.MaxOutputBytes),
		AllowNetwork:   firstBool(m["code_runner_allow_network"], envFallback.AllowNetwork),
	}
	langStr := m["code_runner_languages"]
	if langStr == "" {
		// site_settings 未配语言白名单 → 用 envFallback
		if len(envFallback.Languages) > 0 {
			canonical := make([]string, 0, len(envFallback.Languages))
			for _, l := range envFallback.Languages {
				canonical = append(canonical, NormalizeLang(l))
			}
			globalAllowedLanguages = canonical
		} else {
			globalAllowedLanguages = nil
		}
	} else {
		parts := strings.Split(langStr, ",")
		canonical := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				canonical = append(canonical, NormalizeLang(p))
			}
		}
		if len(canonical) > 0 {
			globalAllowedLanguages = canonical
		} else {
			globalAllowedLanguages = nil
		}
	}
}

// firstFloat site_settings 非空且合法则用，否则 fallback。
func firstFloat(s string, fallback float64) float64 {
	if s == "" {
		return fallback
	}
	v, err := parseFloatStr(s)
	if err != nil {
		return fallback
	}
	return v
}

func firstUint64(s string, fallback uint64) uint64 {
	if s == "" {
		return fallback
	}
	v, err := parseUint64Str(s)
	if err != nil {
		return fallback
	}
	return v
}

func firstBool(s string, fallback bool) bool {
	if s == "" {
		return fallback
	}
	return s == "true"
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

// parseFloatStr 字符串转 float64（ReloadMaxLimitsFromMap 用）。
func parseFloatStr(s string) (float64, error) {
	return strconv.ParseFloat(s, 64)
}

// parseUint64Str 字符串转 uint64（ReloadMaxLimitsFromMap 用）。
func parseUint64Str(s string) (uint64, error) {
	return strconv.ParseUint(s, 10, 64)
}
