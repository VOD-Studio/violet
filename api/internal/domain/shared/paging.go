package shared

import "context"

// ============================================================
// 分页值对象
// ============================================================

// 分页默认值与上限（全项目唯一真相，http 层 ParsePaging 与仓储层共用）。
const (
	// DefaultPage 未指定页码时的默认值
	DefaultPage = 1
	// DefaultPageLimit 未指定每页条数时的默认值
	DefaultPageLimit = 20
	// MaxPageLimit 每页条数硬上限，防资源耗尽
	MaxPageLimit = 100
	// MaxPage 页码硬上限：钳制 Offset 换算不溢出、防止超大 OFFSET 全表扫描
	MaxPage = 10000
)

// PageQuery 分页查询值对象（offset 语义）
//
// 由 http 层从 query 参数构造（ParsePageQuery），经 Normalize 钳制后
// 传入仓储 FindPage。领域层不感知参数来源，仓储实现不重复校验。
type PageQuery struct {
	// Page 页码，从 1 开始
	Page int
	// Limit 每页条数
	Limit int
}

// Normalize 钳制到合法区间：1≤page≤MaxPage、1≤limit≤MaxPageLimit，越界/缺省回默认值。
func (q PageQuery) Normalize() PageQuery {
	if q.Page < DefaultPage {
		q.Page = DefaultPage
	}
	if q.Page > MaxPage {
		q.Page = MaxPage
	}
	if q.Limit < DefaultPage {
		q.Limit = DefaultPageLimit
	}
	if q.Limit > MaxPageLimit {
		q.Limit = MaxPageLimit
	}
	return q
}

// Offset 换算 SQL OFFSET（调用前应已 Normalize）
func (q PageQuery) Offset() int {
	if q.Page < 1 {
		return 0
	}
	return (q.Page - 1) * q.Limit
}

// PageResult 分页查询结果（泛型承载 items，DTO 或领域对象均可）
type PageResult[T any] struct {
	// Items 当前页数据
	Items []T
	// Total 满足筛选条件的总条数（非仅当前页）
	Total int64
	// Page 钳制后的实际页码
	Page int
	// Limit 钳制后的实际每页条数
	Limit int
}

// NewPageResult 构造分页结果，页码/条数取钳制后的查询值。
func NewPageResult[T any](q PageQuery, items []T, total int64) PageResult[T] {
	return PageResult[T]{Items: items, Total: total, Page: q.Page, Limit: q.Limit}
}

// ctxKeyPageQuery 供 handler → service 透传分页参数的 context key（可选用法）
type ctxKeyPageQuery struct{}

// WithPageQuery 将分页参数放入 context
func WithPageQuery(ctx context.Context, q PageQuery) context.Context {
	return context.WithValue(ctx, ctxKeyPageQuery{}, q)
}

// PageQueryFrom 从 context 取分页参数，无则返回零值
func PageQueryFrom(ctx context.Context) PageQuery {
	q, _ := ctx.Value(ctxKeyPageQuery{}).(PageQuery)
	return q
}
