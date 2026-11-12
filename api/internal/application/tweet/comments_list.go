package tweet

import (
	"context"

	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
)

// ListComments 列出推文顶层评论，支持真实分页前的时间或总回应数排序。
func (s *Service) ListComments(ctx context.Context, tweetIDStr, sort string, page, limit int) ([]CommentDTO, int64, error) {
	sort, err := shared.ParseCommentSort(sort)
	if err != nil {
		return nil, 0, err
	}
	if s.commentRepo == nil {
		return nil, 0, errCommentRepoNotInjected
	}
	tweetID, err := shared.ParseID(tweetIDStr)
	if err != nil {
		return nil, 0, shared.BadRequest("非法的推文 ID")
	}
	result, err := s.commentRepo.FindPage(ctx, domaintweet.ListFilter{TweetID: &tweetID, TopLevelSort: sort},
		shared.PageQuery{Page: page, Limit: limit}.Normalize())
	if err != nil {
		return nil, 0, err
	}
	comments := result.Items
	dtos := s.commentsToDTOs(ctx, comments)
	if err := s.attachRepliesCount(ctx, comments, dtos); err != nil {
		return nil, 0, err
	}
	if err := s.enrichEmotes(ctx, dtos); err != nil {
		return nil, 0, err
	}
	return dtos, result.Total, nil
}
