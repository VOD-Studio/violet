package audit

import (
	"context"

	domainaudit "blog-api/internal/domain/audit"
	"blog-api/internal/domain/shared"
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

// List 分页查询审计事件
//
// filter 为零值时查全部；原 ListByActor 语义收敛为 filter.ActorUserID 非 nil。
func (q *Query) List(ctx context.Context, filter domainaudit.ListFilter, pageQ shared.PageQuery) (shared.PageResult[domainaudit.AuditEvent], error) {
	return q.store.FindPage(ctx, filter, pageQ)
}
