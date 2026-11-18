package gorm

import (
	"context"

	"github.com/google/uuid"

	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
)

const detailContextQuoteLimit = 6

const detailContextProfileColumns = "tweet_author.username, COALESCE(tweet_author.display_name, '') AS display_name, " +
	"COALESCE(tweet_author.avatar_url, '') AS avatar_url"

func (r *TweetRepository) ReadDetailContext(ctx context.Context, id shared.ID) (domaintweet.DetailContext, error) {
	db := r.db.WithContext(ctx)
	var result domaintweet.DetailContext
	// 同一作者的全部推文沿用主推文的公开可见性判定。
	author := publicTweets(db).
		Joins("JOIN tweets AS author_tweet ON author_tweet.author_id = tweets.author_id").
		Where("tweets.id = ?", id.UUID()).
		Select(detailContextProfileColumns + ", COALESCE(tweet_author.bio, '') AS bio, " +
			"COUNT(*) AS tweet_count, SUM(author_tweet.like_count) AS received_like_count").
		Group("tweet_author.id").Scan(&result.Author)
	if author.Error != nil {
		return domaintweet.DetailContext{}, shared.Internal("查询推文作者上下文失败", author.Error)
	}
	if author.RowsAffected == 0 {
		return domaintweet.DetailContext{}, domaintweet.ErrNotFound
	}

	rows, err := publicTweets(db).
		Select("tweets.id, tweets.content, tweets.created_at, "+detailContextProfileColumns).
		Where("tweets.quote_of = ?", id.UUID()).
		Order("tweets.created_at DESC, tweets.id DESC").Limit(detailContextQuoteLimit).Rows()
	if err != nil {
		return domaintweet.DetailContext{}, shared.Internal("查询推文直接引用失败", err)
	}
	defer rows.Close()

	for rows.Next() {
		var quote domaintweet.DetailContextQuote
		var quoteID uuid.UUID
		if err := rows.Scan(&quoteID, &quote.Content, &quote.CreatedAt, &quote.Username, &quote.DisplayName, &quote.AvatarURL); err != nil {
			return domaintweet.DetailContext{}, shared.Internal("读取推文直接引用失败", err)
		}
		quote.ID = shared.IDFromUUID(quoteID)
		if result.Quotes == nil {
			result.Quotes = make([]domaintweet.DetailContextQuote, 0, detailContextQuoteLimit)
		}
		result.Quotes = append(result.Quotes, quote)
	}
	if err := rows.Err(); err != nil {
		return domaintweet.DetailContext{}, shared.Internal("读取推文直接引用失败", err)
	}
	return result, nil
}

var _ domaintweet.DetailContextRepository = (*TweetRepository)(nil)
