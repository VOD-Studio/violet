package comment

import (
	"context"

	domain "blog-api/internal/domain/comment"
	"blog-api/internal/domain/shared"
)

// ListByPost 按文章分页列出评论。匿名黑洞直接返回 []；登录返回 approved ∪ 自己 pending。
//
// postAuthorID 由 handler 查文章作者传入，用于计算 is_author。anchorFilter 区分自由评论、
// 批注与全部，空值等同全部；depthFilter 为 TopLevel 时附带最早三条回复预览与总数。
// blockID 精确筛选批注块。sort 仅影响自由顶层评论，latest 为默认，hot 为总回应数降序；
// 回复预览、批注、后台与检索维持原有排序。所有排序均在数据库分页前完成。
func (s *Service) ListByPost(ctx context.Context, postID, viewerUserID, postAuthorID string, anchorFilter domain.AnchorFilter, depthFilter domain.DepthFilter, blockID, sort string, page, limit int) ([]CommentDTO, int64, error) {
	sort, err := shared.ParseCommentSort(sort)
	if err != nil {
		return nil, 0, err
	}
	if viewerUserID == "" {
		return []CommentDTO{}, 0, nil
	}
	pid, err := shared.ParseID(postID)
	if err != nil {
		return nil, 0, err
	}
	viewerID, err := shared.ParseID(viewerUserID)
	if err != nil {
		return nil, 0, err
	}
	result, err := s.commentRepo.FindPage(ctx, domain.ListFilter{
		PostID: &pid, Status: domain.StatusApproved, ViewerUserID: &viewerID,
		AnchorFilter: anchorFilter, DepthFilter: &depthFilter, BlockID: blockID, TopLevelSort: sort,
	}, shared.PageQuery{Page: page, Limit: limit}.Normalize())
	if err != nil {
		return nil, 0, err
	}
	items := result.Items
	// is_author 计算需要 post.author_id；解析失败时留空（所有评论都不算作者）。
	var authorID *shared.ID
	if postAuthorID != "" {
		if aid, err := shared.ParseID(postAuthorID); err == nil {
			authorID = &aid
		}
	}
	dtos := make([]CommentDTO, 0, len(items))
	// 顶层与回复预览平铺，供作者身份富化一次批量查询。
	flat := make([]*domain.Comment, 0, len(items)+replyPreviewLimit*len(items))
	for _, c := range items {
		dto := toDTO(c, authorID, "")
		if depthFilter == domain.DepthFilterTopLevel {
			parentID := c.ID()
			replies, err := s.commentRepo.FindPage(ctx, domain.ListFilter{
				ParentID: &parentID, Status: domain.StatusApproved, ViewerUserID: &viewerID, Sort: "asc",
			}, shared.PageQuery{Page: 1, Limit: replyPreviewLimit})
			if err != nil {
				return nil, 0, err
			}
			dto.RepliesTotal = replies.Total
			dto.Replies = make([]CommentDTO, 0, len(replies.Items))
			for _, r := range replies.Items {
				dto.Replies = append(dto.Replies, toDTO(r, authorID, ""))
			}
			flat = append(flat, replies.Items...)
		}
		dtos = append(dtos, dto)
		flat = append(flat, c)
	}
	flat, err = s.resolveReplyTargets(ctx, dtos, flat, viewerUserID)
	if err != nil {
		return nil, 0, err
	}
	if err := s.enrichOAuthIdentities(ctx, dtos, flat); err != nil {
		return nil, 0, err
	}
	if err := s.enrichEmotes(ctx, dtos); err != nil {
		return nil, 0, err
	}
	return dtos, result.Total, nil
}
