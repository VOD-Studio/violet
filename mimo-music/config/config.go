// Package config 定义 mimo-music 服务的配置结构。
//
// 配置分模块：Server / Provider / Redis / Worker 各自独立文件。
// 通过环境变量加载，MIMO_MUSIC_ 前缀 + 模块名 + 字段名。
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config 是 mimo-music 服务的顶层配置。
type Config struct {
	// Server 是 HTTP 服务相关配置。
	Server ServerConfig

	// Provider 是网易云 provider 相关配置。
	Provider ProviderConfig

	// Redis 是 Redis 连接配置（cache / store / asynq 共用）。
	Redis RedisConfig

	// Worker 是 Asynq worker 相关配置。
	Worker WorkerConfig

	// OTel 是 OpenTelemetry 追踪配置。
	OTel OTelConfig
}

// ServerConfig 是 HTTP 服务相关配置。
type ServerConfig struct {
	// Port 是 HTTP 服务监听端口。
	Port int

	// Env 是运行环境（dev / prod）。
	//
	// dev 环境用彩色文本日志，prod 环境用 JSON 日志。
	Env string
}

// ProviderConfig 是网易云 provider 相关配置。
type ProviderConfig struct {
	// UpstreamTimeout 是调用网易云上游的超时时间，单位秒。
	UpstreamTimeout int

	// MaxRetries 是调用上游失败后的最大重试次数。
	MaxRetries int
}

// RedisConfig 是 Redis 连接配置。
//
// cache / store / asynq 三个组件共用同一个 Redis 连接。
type RedisConfig struct {
	// Host 是 Redis 主机地址。
	Host string

	// Port 是 Redis 端口。
	Port int

	// Password 是 Redis 密码，无密码时为空。
	Password string

	// DB 是 Redis 数据库编号。
	DB int

	// PoolSize 是 Redis 连接池大小（cache / store / asynq 共用）。
	PoolSize int
}

// WorkerConfig 是 Asynq worker 相关配置。
type WorkerConfig struct {
	// Concurrency 是 worker 并发处理的任务数。
	Concurrency int

	// CookieCheckInterval 是 Cookie 健康检查的轮询间隔，单位小时。
	CookieCheckInterval int
}

// OTelConfig 是 OpenTelemetry 追踪配置。
type OTelConfig struct {
	// Exporter 是 exporter 类型：none（noop，本地开发默认）/ otlp-grpc / otlp-http。
	Exporter string

	// Endpoint 是 OTLP collector 地址（如 localhost:4317）。
	// 仅 Exporter 非 none 时生效。
	Endpoint string

	// ServiceName 是上报到后端的服务名（如 mimo-music）。
	ServiceName string

	// SampleRatio 是根 span 采样率，0.0-1.0，1.0 表示全采样。
	SampleRatio float64
}

// Default 返回默认配置。
func Default() Config {
	return Config{
		Server: ServerConfig{
			Port: 3721,
			Env:  "dev",
		},
		Provider: ProviderConfig{
			UpstreamTimeout: 10,
			MaxRetries:      3,
		},
		Redis: RedisConfig{
			Host:     "localhost",
			Port:     6379,
			DB:       1, // 用 DB 1 避免和 mimo-blog（DB 0）冲突
			PoolSize: 10,
		},
		Worker: WorkerConfig{
			Concurrency:         5,
			CookieCheckInterval: 6,
		},
		OTel: OTelConfig{
			Exporter:    "none",
			ServiceName: "mimo-music",
			SampleRatio: 1.0,
		},
	}
}

// Addr 返回 Redis 地址（host:port 格式）。
func (r RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", r.Host, r.Port)
}

// Load 从环境变量加载配置，覆盖默认值。
//
// 环境变量前缀为 MIMO_MUSIC_，格式：MIMO_MUSIC_{MODULE}_{FIELD}。
// 例如 MIMO_MUSIC_SERVER_PORT、MIMO_MUSIC_REDIS_HOST。
func Load() Config {
	cfg := Default()

	cfg.Server.Port = envInt("MIMO_MUSIC_SERVER_PORT", cfg.Server.Port)
	cfg.Server.Env = envStr("MIMO_MUSIC_SERVER_ENV", cfg.Server.Env)
	cfg.Provider.UpstreamTimeout = envInt("MIMO_MUSIC_PROVIDER_UPSTREAM_TIMEOUT", cfg.Provider.UpstreamTimeout)
	cfg.Provider.MaxRetries = envInt("MIMO_MUSIC_PROVIDER_MAX_RETRIES", cfg.Provider.MaxRetries)
	cfg.Redis.Host = envStr("MIMO_MUSIC_REDIS_HOST", cfg.Redis.Host)
	cfg.Redis.Port = envInt("MIMO_MUSIC_REDIS_PORT", cfg.Redis.Port)
	cfg.Redis.Password = envStr("MIMO_MUSIC_REDIS_PASSWORD", cfg.Redis.Password)
	cfg.Redis.DB = envInt("MIMO_MUSIC_REDIS_DB", cfg.Redis.DB)
	cfg.Redis.PoolSize = envInt("MIMO_MUSIC_REDIS_POOL_SIZE", cfg.Redis.PoolSize)
	cfg.Worker.Concurrency = envInt("MIMO_MUSIC_WORKER_CONCURRENCY", cfg.Worker.Concurrency)
	cfg.Worker.CookieCheckInterval = envInt("MIMO_MUSIC_WORKER_COOKIE_CHECK_INTERVAL", cfg.Worker.CookieCheckInterval)
	cfg.OTel.Exporter = envStr("MIMO_MUSIC_OTEL_EXPORTER", cfg.OTel.Exporter)
	cfg.OTel.Endpoint = envStr("MIMO_MUSIC_OTEL_ENDPOINT", cfg.OTel.Endpoint)
	cfg.OTel.ServiceName = envStr("MIMO_MUSIC_OTEL_SERVICE_NAME", cfg.OTel.ServiceName)
	cfg.OTel.SampleRatio = envFloat("MIMO_MUSIC_OTEL_SAMPLE_RATIO", cfg.OTel.SampleRatio)

	cfg.Server.Env = strings.ToLower(cfg.Server.Env)
	return cfg
}

// String 返回配置摘要，用于启动日志。
func (c Config) String() string {
	return fmt.Sprintf("env=%s port=%d redis=%s db=%d otel=%s", c.Server.Env, c.Server.Port, c.Redis.Addr(), c.Redis.DB, c.OTel.Exporter)
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func envFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return fallback
}
