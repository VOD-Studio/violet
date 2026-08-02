package comment

import (
	"context"
	"time"

	domain "blog-api/internal/domain/comment"
)

// commentPageMeta 评论检索分页元数据（内嵌进结果，JSON 展平）。
// 与 post 包的 PageMeta 同构，但不跨域依赖（评论域自治）。
type commentPageMeta struct {
	TotalCount int64 `json:"total_count"`
	HasMore    bool  `json:"has_more"`
	NextOffset int   `json:"next_offset"`
}

func newCommentPageMeta(total int64, offset, pageLen int) commentPageMeta {
	next := offset + pageLen
	return commentPageMeta{
		TotalCount: total,
		HasMore:    int64(next) < total,
		NextOffset: next,
	}
}

// SearchCommentsResult 评论检索结果 + 分页元数据（MCP search_comments / list_recent_comments 共用）。
type SearchCommentsResult struct {
	Comments []AdminCommentDTO `json:"comments"`
	commentPageMeta
}

// PostCommentStatDTO 按文章聚合的评论统计（MCP comment_stats 读模型）。
type PostCommentStatDTO struct {
	PostID          string    `json:"post_id"`
	PostTitle       string    `json:"post_title"`
	PostSlug        string    `json:"post_slug"`
	AnnotationCount int64     `json:"annotation_count"` // 批注数（带 anchor 的评论），区别于 CommentCount（全部评论）
	CommentCount    int64     `json:"comment_count"`
	LatestAt        time.Time `json:"latest_at"`
}

// CommentStatsResult 评论统计结果：全局汇总 + 按文章明细。
type CommentStatsResult struct {
	Summary struct {
		TotalAnnotations  int64 `json:"total_annotations"`
		TotalComments     int64 `json:"total_comments"`
		PostsWithFeedback int64 `json:"posts_with_feedback"`
	} `json:"summary"`
	Posts []PostCommentStatDTO `json:"posts"`
}

// SearchComments 按关键词检索已审核评论（MCP search_comments 编排）。
//
// query 经仓储做 body 多关键词 AND 检索；status 固定 approved（MCP 仅消费已审核反馈，
// pending 不进 agent 上下文）。anchorFilter 控制 all/annotation/free。
// limit/offset → page 换算（对齐 S1 文章检索模式）。
func (s *Service) SearchComments(ctx context.Context, query string, anchorFilter domain.AnchorFilter, limit, offset int) (*SearchCommentsResult, error) {
	if limit <= 0 {
		limit = 20
	}
	page := offset/limit + 1
	items, total, err := s.commentRepo.Search(ctx, domain.StatusApproved, query, anchorFilter, page, limit)
	if err != nil {
		return nil, err
	}
	dtos := toAdminCommentDTOs(items)
	if err := s.enrichAdminEmotes(ctx, dtos); err != nil {
		return nil, err
	}
	return &SearchCommentsResult{
		Comments:       dtos,
		commentPageMeta: newCommentPageMeta(total, offset, len(dtos)),
	}, nil
}

// ListRecentComments 按时间倒序浏览最新已审核评论（MCP list_recent_comments 编排）。
//
// 复用 FindAll（已 ORDER BY created_at DESC）。status 固定 approved。
// 与 SearchComments 的区别：无 query 维度，纯时间流式浏览。
func (s *Service) ListRecentComments(ctx context.Context, anchorFilter domain.AnchorFilter, limit, offset int) (*SearchCommentsResult, error) {
	if limit <= 0 {
		limit = 20
	}
	page := offset/limit + 1
	items, total, err := s.commentRepo.FindAll(ctx, domain.StatusApproved, anchorFilter, page, limit)
	if err != nil {
		return nil, err
	}
	dtos := toAdminCommentDTOs(items)
	if err := s.enrichAdminEmotes(ctx, dtos); err != nil {
		return nil, err
	}
	return &SearchCommentsResult{
		Comments:       dtos,
		commentPageMeta: newCommentPageMeta(total, offset, len(dtos)),
	}, nil
}

// CommentStats 按文章聚合评论统计（MCP comment_stats 编排）。
//
// 返回全局汇总（总批注/总评论/有反馈文章数）+ 按文章明细（批注密集的优先）。
// 仅 approved；零反馈文章不列入。无时间窗（优先级看累积反馈，非时间窗）。
func (s *Service) CommentStats(ctx context.Context) (*CommentStatsResult, error) {
	stats, err := s.commentRepo.Stats(ctx, domain.StatusApproved)
	if err != nil {
		return nil, err
	}
	result := &CommentStatsResult{Posts: make([]PostCommentStatDTO, 0, len(stats))}
	for _, st := range stats {
		result.Posts = append(result.Posts, PostCommentStatDTO{
			PostID:          st.PostID.String(),
			PostTitle:       st.PostTitle,
			PostSlug:        st.PostSlug,
			AnnotationCount: st.AnnotationCount,
			CommentCount:    st.CommentCount,
			LatestAt:        st.LatestAt,
		})
		result.Summary.TotalAnnotations += st.AnnotationCount
		result.Summary.TotalComments += st.CommentCount
	}
	result.Summary.PostsWithFeedback = int64(len(stats))
	return result, nil
}

// toAdminCommentDTOs 把 CommentWithPost 列表转为 AdminCommentDTO（复用 ListAll 的转换逻辑）。
// 抽出供 SearchComments / ListRecentComments 共用，避免与 ListAll 重复。
func toAdminCommentDTOs(items []*domain.CommentWithPost) []AdminCommentDTO {
	comments := make([]*domain.Comment, 0, len(items))
	for _, cwp := range items {
		comments = append(comments, cwp.Comment)
	}
	parentNames := buildParentNameMap(comments)
	dtos := make([]AdminCommentDTO, 0, len(items))
	for _, cwp := range items {
		name := ""
		if cwp.Comment.ParentID() != nil {
			name = parentNames[cwp.Comment.ParentID().String()]
		}
		dtos = append(dtos, AdminCommentDTO{
			CommentDTO: toDTO(cwp.Comment, nil, name),
			PostID:     cwp.Post.ID.String(),
			PostTitle:  cwp.Post.Title,
			PostSlug:   cwp.Post.Slug,
		})
	}
	return dtos
}
