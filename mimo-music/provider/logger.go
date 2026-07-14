// Package provider 定义 mimo-music 的平台抽象核心层。
//
// 核心层零框架依赖：不 import HTTP 框架、Redis、Asynq。
// 只依赖标准库和自定义接口。SDK 用户自带实现，服务端注入 Redis / slog 实现。
package provider

// Logger 是核心层使用的日志接口。
//
// 核心层（provider/）不直接依赖 slog，而是依赖这个极简接口。
// 运行时层（observability 包）提供 slog adapter 注入。
// SDK 用户可以传自己的 Logger 实现，或用 noop。
type Logger interface {
	// Info 记录信息级日志。
	Info(msg string, args ...any)

	// Debug 记录调试级日志。
	Debug(msg string, args ...any)

	// Warn 记录警告级日志。
	Warn(msg string, args ...any)

	// Error 记录错误级日志。
	Error(msg string, args ...any)

	// With 返回带额外属性的子 Logger。
	With(args ...any) Logger
}

// NoopLogger 是 Logger 的空实现，不输出任何日志。
//
// SDK 模式默认用，避免强制依赖 slog。
type NoopLogger struct{}

// Info 不做任何事。
func (NoopLogger) Info(string, ...any) {}

// Debug 不做任何事。
func (NoopLogger) Debug(string, ...any) {}

// Warn 不做任何事。
func (NoopLogger) Warn(string, ...any) {}

// Error 不做任何事。
func (NoopLogger) Error(string, ...any) {}

// With 返回自身（空实现无状态）。
func (n NoopLogger) With(...any) Logger { return n }
