package friendlink

import (
	"context"

	"blog-api/internal/domain/shared"
)

// ListPublicPage 只读取服务端快照，不在请求或 SSR 中抓取外站。
func (s *Service) ListPublicPage(ctx context.Context, sort string, page, limit int) ([]FriendLinkDTO, int64, error) {
	if sort == "" {
		sort = "updated"
	}
	if sort != "updated" && sort != "manual" {
		return nil, 0, shared.BadRequest("排序仅支持 updated 或 manual")
	}
	result, err := s.repo.FindApprovedPage(ctx, sort, shared.PageQuery{Page: page, Limit: limit}.Normalize())
	if err != nil {
		return nil, 0, err
	}
	items := make([]FriendLinkDTO, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, toDTO(item))
	}
	return items, result.Total, nil
}
