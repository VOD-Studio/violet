// Package gorm 提供各领域仓储的 GORM 实现。
package gorm

import (
	"gorm.io/gorm"

	domainshared "blog-api/internal/domain/shared"
)

// countAndFind 对已组装好筛选/排序的 query 执行 Count + Offset/Limit Find。
//
// 仓储 FindPage 的公共骨架：caller 负责 Where/Order（排序须含唯一列
// tiebreaker，保证 offset 分页稳定），本函数完成计数与切片。
// poSlice 需为指向 PO 切片的指针（如 &pos）。
func countAndFind(query *gorm.DB, q domainshared.PageQuery, poSlice any, op string) (int64, error) {
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return 0, domainshared.Internal("统计"+op+"总数失败", err)
	}
	if err := query.Offset(q.Offset()).Limit(q.Limit).Find(poSlice).Error; err != nil {
		return 0, domainshared.Internal("查询"+op+"列表失败", err)
	}
	return total, nil
}
