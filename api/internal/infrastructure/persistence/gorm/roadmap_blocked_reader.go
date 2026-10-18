package gorm

import (
	"context"

	"blog-api/internal/domain/shared"
)

// IsBlocked 在调用方当前事务中读取本次写入后的有效阻塞关系。
func (r *RoadmapRepository) IsBlocked(ctx context.Context, projectID, itemID shared.ID) (bool, error) {
	var blocked bool
	if err := r.db.WithContext(ctx).Raw(`SELECT EXISTS (
		SELECT 1 FROM roadmap_relations AS relation
		JOIN roadmap_items AS source ON source.id = relation.source_id AND source.project_id = relation.project_id
		JOIN roadmap_items AS target ON target.id = relation.target_id AND target.project_id = relation.project_id
		WHERE relation.project_id = ? AND relation.target_id = ? AND relation.type = 'blocks'
		  AND source.deleted_at IS NULL AND target.deleted_at IS NULL AND source.stage <> 'completed'
	)`, projectID.UUID(), itemID.UUID()).Scan(&blocked).Error; err != nil {
		return false, shared.Internal("查询路线图条目阻塞状态失败", err)
	}
	return blocked, nil
}
