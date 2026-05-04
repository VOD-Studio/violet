// Package pagination 提供统一的分页逻辑
package pagination

// Params 分页参数
type Params struct {
	Page     int
	PageSize int
}

// Offset 计算数据库查询的偏移量
func (p Params) Offset() int {
	if p.Page < 1 {
		p.Page = 1
	}
	return (p.Page - 1) * p.PageSize
}

// Limit 计算数据库查询的限制数量，并应用合理的边界
func (p Params) Limit() int {
	if p.PageSize < 1 {
		p.PageSize = 20 // 默认每页 20 条
	}
	if p.PageSize > 100 {
		p.PageSize = 100 // 最多每页 100 条
	}
	return p.PageSize
}

// Response 分页响应信息
type Response struct {
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

// NewResponse 创建分页响应
func NewResponse(page, pageSize, total int) Response {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	totalPages := 0
	if total > 0 {
		totalPages = (total + pageSize - 1) / pageSize
	}

	return Response{
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	}
}
