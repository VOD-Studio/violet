// Package provider 定义 mimo-music 的平台抽象核心层。
package provider

// Option 是构造 Provider 时的可选项（Option 模式）。
type Option func(*Options)

// Options 是 Provider 构造配置。
type Options struct {
	Cache     Cache
	Session   SessionStore
	Logger    Logger
	Timeout   int // 上游超时（秒）
	Cookie    string
}

// WithCache 注入 Cache 实现。
func WithCache(c Cache) Option {
	return func(o *Options) { o.Cache = c }
}

// WithSessionStore 注入 SessionStore 实现。
func WithSessionStore(s SessionStore) Option {
	return func(o *Options) { o.Session = s }
}

// WithLogger 注入 Logger 实现。
func WithLogger(l Logger) Option {
	return func(o *Options) { o.Logger = l }
}

// WithTimeout 设置上游超时（秒）。
func WithTimeout(seconds int) Option {
	return func(o *Options) { o.Timeout = seconds }
}

// WithCookie 设置默认 Cookie（匿名场景 SDK 用）。
func WithCookie(cookie string) Option {
	return func(o *Options) { o.Cookie = cookie }
}

// DefaultOptions 返回默认选项（NoopCache + NoopLogger）。
func DefaultOptions() Options {
	return Options{
		Cache:   NoopCache{},
		Logger:  NoopLogger{},
		Timeout: 10,
	}
}

// ApplyOptions 应用可选项到默认配置。
func ApplyOptions(opts ...Option) Options {
	o := DefaultOptions()
	for _, opt := range opts {
		opt(&o)
	}
	return o
}
