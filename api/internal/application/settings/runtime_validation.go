package settings

import (
	"fmt"
	"math"
	"slices"

	domainsettings "blog-api/internal/domain/settings"
)

// RuntimeValidationError 携带可定位到表单字段的错误。
type RuntimeValidationError struct{ Details map[string][]string }

func (e *RuntimeValidationError) Error() string { return "运行策略字段无效" }

func validateRuntime(group domainsettings.RuntimeGroup, value any) error {
	details := map[string][]string{}
	bound := func(key string, value, min, max float64) {
		if math.IsNaN(value) || math.IsInf(value, 0) || value < min || value > max {
			details[key] = []string{fmt.Sprintf("必须在 %g 到 %g 之间", min, max)}
		}
	}
	switch p := value.(type) {
	case domainsettings.RateLimitPolicy:
		for id, r := range p.Rules {
			prefix := "rules." + id + "."
			bound(prefix+"window_seconds", float64(r.WindowSeconds), 1, 86400)
			bound(prefix+"max_requests", float64(r.MaxRequests), 1, 1e9)
			bound(prefix+"burst_requests", float64(r.BurstRequests), 0, 1e9)
			bound(prefix+"daily_quota", float64(r.DailyQuota), 0, 1e9)
			if r.FailureMode != "allow" && r.FailureMode != "deny" {
				details[prefix+"failure_mode"] = []string{"必须是 allow 或 deny"}
			}
		}
	case domainsettings.ImagePolicy:
		bound("memory_max_entries", float64(p.MemoryMaxEntries), 1, 100000)
		bound("memory_max_bytes", float64(p.MemoryMaxBytes), 1, 1<<30)
		bound("memory_ttl_seconds", float64(p.MemoryTTLSeconds), 1, 86400)
		bound("disk_max_bytes", float64(p.DiskMaxBytes), 1, 1<<40)
		bound("disk_ttl_seconds", float64(p.DiskTTLSeconds), 1, 31536000)
		bound("cleanup_interval_seconds", float64(p.CleanupIntervalSeconds), 1, 86400)
		bound("max_source_dimension", float64(p.MaxSourceDimension), 1, 32768)
		bound("max_source_pixels", float64(p.MaxSourcePixels), 1, 100000000)
		bound("thumbnail_width", float64(p.ThumbnailWidth), 1, 4096)
		bound("thumbnail_quality", float64(p.ThumbnailQuality), 1, 100)
		bound("webp_quality", float64(p.WebPQuality), 1, 100)
		bound("webp_method", float64(p.WebPMethod), 0, 6)
		bound("max_concurrent", float64(p.MaxConcurrent), 1, 16)
		bound("encode_timeout_seconds", float64(p.EncodeTimeoutSeconds), 1, 120)
		bound("max_input_bytes", float64(p.MaxInputBytes), 1, 256<<20)
		bound("max_output_bytes", float64(p.MaxOutputBytes), 1, 256<<20)
		if p.WebPMode != "lossless" && p.WebPMode != "lossy" {
			details["webp_mode"] = []string{"必须是 lossless 或 lossy"}
		}
	case domainsettings.UploadQueuePolicy:
		bound("max_concurrent_files", float64(p.MaxConcurrentFiles), 1, 10)
	case domainsettings.CodeRunnerPolicy:
		bound("max_cpu_cores", p.MaxCPUCores, 0.1, 32)
		bound("max_memory_mb", float64(p.MaxMemoryMB), 16, 32768)
		bound("max_timeout_secs", float64(p.MaxTimeoutSecs), 1, 300)
		bound("max_output_bytes", float64(p.MaxOutputBytes), 1, 16<<20)
		bound("max_source_bytes", float64(p.MaxSourceBytes), 1, 4<<20)
		bound("max_concurrent", float64(p.MaxConcurrent), 1, 32)
		bound("queue_timeout_secs", float64(p.QueueTimeoutSecs), 1, 300)
		bound("task_ttl_secs", float64(p.TaskTTLSecs), 1, 86400)
		seen := map[string]bool{}
		for _, language := range p.Languages {
			if !slices.Contains([]string{"python", "node", "go", "rust", "bun"}, language) || seen[language] {
				details["languages"] = []string{"语言必须来自 python、node、go、rust、bun，且不能重复"}
			}
			seen[language] = true
		}
	default:
		return fmt.Errorf("未知运行策略分组 %s", group)
	}
	if len(details) > 0 {
		return &RuntimeValidationError{Details: details}
	}
	return nil
}
