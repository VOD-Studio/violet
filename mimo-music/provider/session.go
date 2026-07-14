// Package provider 定义 mimo-music 的平台抽象核心层。
package provider

import "context"

// SessionStore 是登录态存储接口。
//
// provider 声明"我需要 session 存储"，运行时层（store/redis）提供实现。
// session 有独立的生命周期和并发语义，与普通缓存不同。
type SessionStore interface {
	// Get 按 userID 取 Cookie，不存在返回空。
	Get(ctx context.Context, userID string) (string, error)

	// Save 保存 Cookie，关联 userID。
	Save(ctx context.Context, userID, cookie string) error

	// Delete 删除 session。
	Delete(ctx context.Context, userID string) error

	// ListAll 列出所有 session 的 userID（worker 健康检查用）。
	ListAll(ctx context.Context) ([]string, error)
}
