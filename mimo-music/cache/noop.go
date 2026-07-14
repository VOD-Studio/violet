// Package cache 提供 Cache 接口的具体实现。
//
// noop 是空实现（SDK 模式默认用），redis 是生产实现。
package cache

import "github.com/VOD-Studio/mimo-music/provider"

// Noop 是 Cache 的空实现（重新导出，方便调用方从 cache 包引用）。
type Noop = provider.NoopCache
