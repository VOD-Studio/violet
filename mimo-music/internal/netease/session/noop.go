// Package session 的空实现。
package session

import "context"

// NoopStore 是 SessionStore 的空实现，不做任何存储。
// 地基阶段未接入 Redis 时用，GetAvailable 返回未授权错误。
type NoopStore struct{}

// GetAvailable 永远返回未授权（无可用 session）。
func (NoopStore) GetAvailable(context.Context, AuthRequirement) (*Session, error) {
	return nil, ErrNoAvailableSession
}

// ReportSuccess 不做任何事。
func (NoopStore) ReportSuccess(string) {}

// ReportFailure 不做任何事。
func (NoopStore) ReportFailure(string, error) {}

// Save 不做任何事。
func (NoopStore) Save(context.Context, *Session) error { return nil }

// ListAll 返回空切片。
func (NoopStore) ListAll(context.Context) ([]string, error) { return nil, nil }
