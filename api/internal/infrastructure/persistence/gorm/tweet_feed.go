package gorm

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

const ownTweetImages = "tweets.images <> '[]'"

func publicTweets(db *gorm.DB) *gorm.DB {
	return db.Model(&model.Tweet{}).
		Joins("JOIN users AS tweet_author ON tweet_author.id = tweets.author_id AND tweet_author.deleted_at IS NULL")
}

func tweetWindow(query *gorm.DB, since, until time.Time) *gorm.DB {
	return query.Where("tweets.created_at >= ? AND tweets.created_at < ?", since, until)
}

func (r *TweetRepository) FindImageTimeline(ctx context.Context, cursor *domaintweet.Cursor, limit int) ([]*domaintweet.Tweet, error) {
	return findTweetPage(publicTweets(r.db.WithContext(ctx)).Where(ownTweetImages), cursor, limit)
}

func (r *TweetRepository) RankHotTimeline(ctx context.Context, since, until time.Time) ([]shared.ID, error) {
	db := r.db.WithContext(ctx)
	comments := db.Model(&model.TweetComment{}).Select("COUNT(*)").
		Joins("JOIN users AS comment_author ON comment_author.id = tweet_comments.author_id AND comment_author.deleted_at IS NULL").
		Where("tweet_comments.tweet_id = tweets.id")
	quotes := db.Table("tweets AS quote").Select("COUNT(*)").
		Joins("JOIN users AS quote_author ON quote_author.id = quote.author_id AND quote_author.deleted_at IS NULL").
		Where("quote.quote_of = tweets.id")
	var rows []struct{ ID uuid.UUID }
	if err := tweetWindow(publicTweets(db), since, until).
		Select("tweets.id, tweets.like_count + (?) + (?) AS score", comments, quotes).
		Order("score DESC, tweets.created_at DESC, tweets.id DESC").Scan(&rows).Error; err != nil {
		return nil, shared.Internal("查询热门推文排序失败", err)
	}
	ids := make([]shared.ID, len(rows))
	for i, row := range rows {
		ids[i] = shared.IDFromUUID(row.ID)
	}
	return ids, nil
}

func (r *TweetRepository) FindSidebarAuthors(ctx context.Context, since, until time.Time, limit int) ([]domaintweet.SidebarAuthor, error) {
	var rows []struct {
		ID          uuid.UUID
		Username    string
		DisplayName string
		AvatarURL   string
		Count       int64
	}
	if err := tweetWindow(publicTweets(r.db.WithContext(ctx)), since, until).
		Select("tweet_author.id, tweet_author.username, COALESCE(tweet_author.display_name, '') AS display_name, COALESCE(tweet_author.avatar_url, '') AS avatar_url, COUNT(*) AS count").
		Group("tweet_author.id, tweet_author.username, tweet_author.display_name, tweet_author.avatar_url").
		Order("count DESC, tweet_author.username ASC, tweet_author.id ASC").Limit(limit).Scan(&rows).Error; err != nil {
		return nil, shared.Internal("查询推文侧栏作者失败", err)
	}
	authors := make([]domaintweet.SidebarAuthor, len(rows))
	for i, row := range rows {
		authors[i] = domaintweet.SidebarAuthor{
			ID: shared.IDFromUUID(row.ID), Username: row.Username, DisplayName: row.DisplayName, AvatarURL: row.AvatarURL, Count: row.Count,
		}
	}
	return authors, nil
}

func (r *TweetRepository) FindSidebarTopics(ctx context.Context, since, until time.Time, limit int) ([]domaintweet.SidebarTopic, error) {
	var topics []domaintweet.SidebarTopic
	if err := tweetWindow(publicTweets(r.db.WithContext(ctx)), since, until).
		Joins("JOIN tweet_hashtags ON tweet_hashtags.tweet_id = tweets.id").
		Select("tweet_hashtags.tag, COUNT(*) AS count").Group("tweet_hashtags.tag").
		Order("count DESC, tweet_hashtags.tag ASC").Limit(limit).Scan(&topics).Error; err != nil {
		return nil, shared.Internal("查询推文侧栏话题失败", err)
	}
	return topics, nil
}

func (r *TweetRepository) ReadViewCount(ctx context.Context, id shared.ID) (int64, error) {
	var row model.Tweet
	err := publicTweets(r.db.WithContext(ctx)).Select("tweets.view_count").Take(&row, "tweets.id = ?", id.UUID()).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, domaintweet.ErrNotFound
	}
	if err != nil {
		return 0, shared.Internal("读取推文浏览数失败", err)
	}
	return row.ViewCount, nil
}

func (r *TweetRepository) IncrementViewCount(ctx context.Context, id shared.ID) (int64, error) {
	db := r.db.WithContext(ctx)
	var row model.Tweet
	result := db.Model(&row).Clauses(clause.Returning{Columns: []clause.Column{{Name: "view_count"}}}).
		Where("id = ?", id.UUID()).
		Where("EXISTS (?)", db.Model(&model.User{}).Select("1").Where("users.id = tweets.author_id AND users.deleted_at IS NULL")).
		UpdateColumn("view_count", gorm.Expr("view_count + 1"))
	if result.Error != nil {
		return 0, shared.Internal("更新推文浏览数失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return 0, domaintweet.ErrNotFound
	}
	return row.ViewCount, nil
}

var _ domaintweet.FeedRepository = (*TweetRepository)(nil)
