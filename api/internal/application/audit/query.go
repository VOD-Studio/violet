package audit

import (
	"context"

	domainaudit "blog-api/internal/domain/audit"
)

// Query 操作日志查询用例（读侧）。
//
// 薄封装：透传 EventStore 的查询能力，handler 经此访问，
// 保持 application 层作为用例编排的边界。
type Query struct {
	store domainaudit.EventStore
}

// NewQuery 构造查询用例
func NewQuery(store domainaudit.EventStore) *Query {
	return &Query{store: store}
}

// List 分页查询全部事件
func (q *Query) List(ctx context.Context, page, limit int) (domainaudit.ListResult, error) {
	return q.store.List(ctx, page, limit)
}

// ListFiltered 按筛选条件分页查询
func (q *Query) ListFiltered(ctx context.Context, filter domainaudit.ListFilter, page, limit int) (domainaudit.ListResult, error) {
	return q.store.ListFiltered(ctx, filter, page, limit)
}

// ListByActor 分页查询指定操作人的事件
func (q *Query) ListByActor(ctx context.Context, userID string, page, limit int) (domainaudit.ListResult, error) {
	return q.store.ListByActor(ctx, userID, page, limit)
}
