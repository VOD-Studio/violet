package tweet

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
)

// DetailContextProfileDTO 详情上下文中的公开身份资料。
type DetailContextProfileDTO struct {
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
}

// DetailContextAuthorDTO 主推文作者的资料及当前公开推文统计。
type DetailContextAuthorDTO struct {
	DetailContextProfileDTO
	Bio        string `json:"bio"`
	TweetCount int64  `json:"tweet_count"`
	// ReceivedLikeCount 累计逐条推文的现有赞数，不按点赞用户去重。
	ReceivedLikeCount int64 `json:"received_like_count"`
}

// DetailContextQuoteDTO 一条直接引用主推文的公开推文摘要。
type DetailContextQuoteDTO struct {
	ID        string                  `json:"id"`
	Author    DetailContextProfileDTO `json:"author"`
	Content   string                  `json:"content"`
	CreatedAt string                  `json:"created_at"`
}

// DetailContextDTO 公开推文详情的作者资料与最近直接引用。
type DetailContextDTO struct {
	Author DetailContextAuthorDTO  `json:"author"`
	Quotes []DetailContextQuoteDTO `json:"quotes"`
}

func (s *Service) WithDetailContextRepository(repo domaintweet.DetailContextRepository) *Service {
	s.detailContextRepo = repo
	return s
}

// DetailContext 不展开引用快照或外部原文，也不读取会话相关的数据。
func (s *Service) DetailContext(ctx context.Context, rawID string) (DetailContextDTO, error) {
	id, err := shared.ParseID(rawID)
	if err != nil {
		return DetailContextDTO{}, err
	}
	result, err := s.detailContextRepo.ReadDetailContext(ctx, id)
	if err != nil {
		return DetailContextDTO{}, err
	}
	out := DetailContextDTO{
		Author: DetailContextAuthorDTO{
			DetailContextProfileDTO: detailContextProfileDTO(result.Author.DetailContextProfile),
			Bio:                     result.Author.Bio,
			TweetCount:              result.Author.TweetCount,
			ReceivedLikeCount:       result.Author.ReceivedLikeCount,
		},
		Quotes: make([]DetailContextQuoteDTO, len(result.Quotes)),
	}
	for i, quote := range result.Quotes {
		out.Quotes[i] = DetailContextQuoteDTO{
			ID:        quote.ID.String(),
			Author:    detailContextProfileDTO(quote.DetailContextProfile),
			Content:   quote.Content,
			CreatedAt: quote.CreatedAt.UTC().Format(time.RFC3339),
		}
	}
	return out, nil
}

func detailContextProfileDTO(profile domaintweet.DetailContextProfile) DetailContextProfileDTO {
	return DetailContextProfileDTO{Username: profile.Username, DisplayName: profile.DisplayName, AvatarURL: profile.AvatarURL}
}
