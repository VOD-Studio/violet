package settings

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"blog-api/internal/domain/shared"
)

// RuntimeGroup 是固定的运行策略分组。
type RuntimeGroup string

const (
	RateLimitGroup   RuntimeGroup = "rate-limit"
	ImageGroup       RuntimeGroup = "image"
	UploadQueueGroup RuntimeGroup = "upload-queue"
	CodeRunnerGroup  RuntimeGroup = "code-runner"
)

// RateLimitPolicy 包含实际入口绑定的限流规则。
type RateLimitPolicy struct {
	// Rules 的键必须来自服务器实际绑定目录。
	Rules map[string]shared.RateLimitPolicy `json:"rules"`
}

// RateLimitMetadata 描述实际消费入口，不包含计数身份凭据。
type RateLimitMetadata struct {
	// ID 是实际绑定目录的稳定标识。
	ID string `json:"id"`
	// Title 是管理界面入口名称。
	Title string `json:"title"`
	// Description 描述规则影响的业务行为。
	Description string `json:"description"`
	// Identity 描述用户、IP或共享额度的计数方式。
	Identity string `json:"identity"`
	// Endpoints 是该规则实际保护的HTTP入口。
	Endpoints []string `json:"endpoints"`
}

// ImagePolicy 控制可重建缓存和图片处理资源。
type ImagePolicy struct {
	// MemoryMaxEntries 是内存缓存条目上限。
	MemoryMaxEntries int `json:"memory_max_entries"`
	// MemoryMaxBytes 是内存缓存字节上限。
	MemoryMaxBytes int64 `json:"memory_max_bytes"`
	// MemoryTTLSeconds 是内存缓存保留秒数。
	MemoryTTLSeconds int64 `json:"memory_ttl_seconds"`
	// DiskMaxBytes 是磁盘缓存字节上限，不包含正式素材。
	DiskMaxBytes int64 `json:"disk_max_bytes"`
	// DiskTTLSeconds 是磁盘缓存保留秒数。
	DiskTTLSeconds int64 `json:"disk_ttl_seconds"`
	// CleanupIntervalSeconds 是独立缓存清理间隔。
	CleanupIntervalSeconds int64 `json:"cleanup_interval_seconds"`
	// MaxSourceDimension 是源图单边像素上限。
	MaxSourceDimension int `json:"max_source_dimension"`
	// MaxSourcePixels 是源图总像素上限。
	MaxSourcePixels int64 `json:"max_source_pixels"`
	// ThumbnailWidth 是缩略图目标宽度。
	ThumbnailWidth int `json:"thumbnail_width"`
	// ThumbnailQuality 是 JPEG 缩略图质量。
	ThumbnailQuality int `json:"thumbnail_quality"`
	// WebPMode 指定无损或有损编码。
	WebPMode string `json:"webp_mode"`
	// WebPQuality 是 WebP 编码质量。
	WebPQuality int `json:"webp_quality"`
	// WebPMethod 是 WebP 编码强度。
	WebPMethod int `json:"webp_method"`
	// MaxConcurrent 是图片处理并发上限。
	MaxConcurrent int `json:"max_concurrent"`
	// EncodeTimeoutSeconds 是单次编码超时。
	EncodeTimeoutSeconds int `json:"encode_timeout_seconds"`
	// MaxInputBytes 是编码输入字节上限。
	MaxInputBytes int64 `json:"max_input_bytes"`
	// MaxOutputBytes 是编码输出字节上限。
	MaxOutputBytes int64 `json:"max_output_bytes"`
}

// UploadQueuePolicy 控制浏览器后续文件调度。
type UploadQueuePolicy struct {
	// MaxConcurrentFiles 是同一队列的在途文件上限。
	MaxConcurrentFiles int `json:"max_concurrent_files"`
}

// CodeRunnerPolicy 控制后续任务的准入和资源上限。
type CodeRunnerPolicy struct {
	// Enabled 控制新任务启停。
	Enabled bool `json:"enabled"`
	// MaxCPUCores 是单任务 CPU 核数上限。
	MaxCPUCores float64 `json:"max_cpu_cores"`
	// MaxMemoryMB 是单任务内存 MiB 上限。
	MaxMemoryMB uint64 `json:"max_memory_mb"`
	// MaxTimeoutSecs 是单任务执行秒数上限。
	MaxTimeoutSecs uint64 `json:"max_timeout_secs"`
	// MaxOutputBytes 是单任务输出字节上限。
	MaxOutputBytes uint64 `json:"max_output_bytes"`
	// MaxSourceBytes 是源码字节上限。
	MaxSourceBytes uint64 `json:"max_source_bytes"`
	// AllowNetwork 仍需与作者声明和语言许可同时满足。
	AllowNetwork bool `json:"allow_network"`
	// MaxConcurrent 是正在执行的任务上限。
	MaxConcurrent int `json:"max_concurrent"`
	// QueueTimeoutSecs 是排队秒数上限。
	QueueTimeoutSecs uint64 `json:"queue_timeout_secs"`
	// TaskTTLSecs 是 Redis 任务保留秒数。
	TaskTTLSecs uint64 `json:"task_ttl_secs"`
	// Languages 是 canonical 语言白名单，空列表禁止全部语言。
	Languages []string `json:"languages"`
}

// ImageCacheMaintenance 描述独立缓存维护的真实结果。
type ImageCacheMaintenance struct {
	// LastStartedAt 是最近维护开始时间，未运行时为空。
	LastStartedAt *time.Time `json:"last_started_at"`
	// LastFinishedAt 是最近维护结束时间。
	LastFinishedAt *time.Time `json:"last_finished_at"`
	// RemovedEntries 是最近维护删除的缓存项数量。
	RemovedEntries int `json:"removed_entries"`
	// RemovedBytes 是最近维护回收的字节数。
	RemovedBytes int64 `json:"removed_bytes"`
	// RemainingBytes 是最近维护后的缓存字节数。
	RemainingBytes int64 `json:"remaining_bytes"`
	// Error 是最近维护失败原因。
	Error string `json:"error,omitempty"`
	// Running 表示维护是否正在进行。
	Running bool `json:"running"`
}

// DefaultImagePolicy 保留既有图像输出并设置有限资源保护。
func DefaultImagePolicy() ImagePolicy {
	return ImagePolicy{MemoryMaxEntries: 100, MemoryMaxBytes: 64 << 20, MemoryTTLSeconds: 300, DiskMaxBytes: 1 << 30, DiskTTLSeconds: 7 * 86400, CleanupIntervalSeconds: 86400, MaxSourceDimension: 16384, MaxSourcePixels: 40000000, ThumbnailWidth: 300, ThumbnailQuality: 80, WebPMode: "lossless", WebPQuality: 80, WebPMethod: 4, MaxConcurrent: 2, EncodeTimeoutSeconds: 30, MaxInputBytes: 64 << 20, MaxOutputBytes: 64 << 20}
}

// RuntimeRecord 持久化组版本及显式覆盖，不持久化部署默认。
type RuntimeRecord struct {
	// Version 是用于原子比较交换的保存版本。
	Version uint64 `json:"version"`
	// Overrides 仅包含当前分组显式覆盖。
	Overrides json.RawMessage `json:"overrides"`
}

// RuntimeEffective 保留最近验证成功的完整值，用于进程重启恢复。
type RuntimeEffective struct {
	// Version 是上次成功准备的策略版本。
	Version uint64 `json:"version"`
	// Values 是上次成功准备的完整策略值。
	Values json.RawMessage `json:"values"`
}

var ErrRuntimeConflict = errors.New("运行策略已被其他管理员更新")

// RuntimePolicyStore 在同一站点设置表中原子更新单个分组。
type RuntimePolicyStore interface {
	Load(context.Context, RuntimeGroup) (RuntimeRecord, error)
	CompareAndSwap(context.Context, RuntimeGroup, uint64, json.RawMessage) (RuntimeRecord, error)
	LoadLegacyRunner(context.Context) (map[string]string, error)
	LoadEffective(context.Context, RuntimeGroup) (*RuntimeEffective, error)
	SaveEffective(context.Context, RuntimeGroup, RuntimeEffective) error
}
