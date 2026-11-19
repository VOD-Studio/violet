package gorm

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"gorm.io/gorm"

	"blog-api/internal/application/publicprofile"
	"blog-api/internal/domain/shared"
)

// PublicProfileReader only projects current public sources, including after moderation/deletion.
type PublicProfileReader struct{ db *gorm.DB }

func NewPublicProfileReader(db *gorm.DB) *PublicProfileReader { return &PublicProfileReader{db: db} }

// Every consumer uses this visibility boundary. Emoji reactions are intentionally separate from tweet likes.
const publicProfileEvents = `
SELECT p.id, 1 AS kind, p.published_at AS created_at, p.title, p.excerpt AS body,
 '' AS selected_text, '/blog/' || p.slug AS url, p.cover_image, '[]'::jsonb AS images
FROM posts p WHERE p.author_id = @owner AND p.status = 'published' AND p.deleted_at IS NULL AND p.published_at <= @now
UNION ALL
SELECT t.id, 2, t.created_at, '',
 CASE WHEN t.content <> '' THEN t.content WHEN e.availability = 'available' AND NOT e.taken_down THEN COALESCE(e.snapshot->>'text', '') ELSE '' END,
 '', '/tweets/' || t.id::text, '', t.images
FROM tweets t LEFT JOIN external_tweets e ON e.id = t.external_tweet_id WHERE t.author_id = @owner AND t.created_at <= @now
UNION ALL
SELECT c.id, CASE WHEN c.anchor_block_id IS NULL THEN 3 ELSE 4 END, c.created_at,
 p.title, c.body, COALESCE(c.anchor_selected_text, ''), '/blog/' || p.slug, '', c.pictures
FROM comments c JOIN posts p ON p.id = c.post_id
WHERE c.created_by = @owner AND c.status = 'approved' AND p.status = 'published' AND p.deleted_at IS NULL AND p.published_at <= @now AND c.created_at <= @now
UNION ALL
SELECT c.id, 5, c.created_at, LEFT(t.content, 120), c.body, '', '/tweets/' || t.id::text, '', c.pictures
FROM tweet_comments c JOIN tweets t ON t.id = c.tweet_id
WHERE c.author_id = @owner AND c.created_at <= @now`

func (r *PublicProfileReader) Summary(ctx context.Context, owner shared.ID, start, end time.Time) (publicprofile.Stats, []publicprofile.Day, error) {
	args := []any{sql.Named("owner", owner.UUID()), sql.Named("now", time.Now().UTC()), sql.Named("start", start), sql.Named("end", end)}
	var stats publicprofile.Stats
	err := r.db.WithContext(ctx).Raw(`WITH events AS (SELECT id, kind, created_at FROM (`+publicProfileEvents+`) public_events)
SELECT COUNT(*) FILTER (WHERE kind = 1) AS posts,
 COUNT(*) FILTER (WHERE kind = 2) AS tweets,
 COUNT(*) FILTER (WHERE kind IN (3,5)) AS comments,
 COUNT(*) FILTER (WHERE kind = 4) AS annotations,
 (SELECT COUNT(*) FROM tweet_likes l JOIN events e ON e.id = l.tweet_id AND e.kind = 2) AS received_likes,
 ((SELECT COUNT(*) FROM comment_reactions r JOIN events e ON e.id = r.comment_id AND e.kind IN (3,4)) +
 (SELECT COUNT(*) FROM tweet_comment_reactions r JOIN events e ON e.id = r.comment_id AND e.kind = 5)) AS received_reactions
FROM events`, args...).Scan(&stats).Error
	if err != nil {
		return stats, nil, shared.Internal("查询公开主页统计失败", err)
	}
	days := make([]publicprofile.Day, 0)
	if err := r.db.WithContext(ctx).Raw(`WITH events AS (`+publicProfileEvents+`)
SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, COUNT(*) AS count
FROM events WHERE created_at >= @start AND created_at < @end GROUP BY date ORDER BY date`, args...).Scan(&days).Error; err != nil {
		return stats, nil, shared.Internal("查询公开逐日活跃度失败", err)
	}
	return stats, days, nil
}

func (r *PublicProfileReader) Activities(ctx context.Context, owner shared.ID, tab string, position publicprofile.Position, limit int) ([]publicprofile.Activity, error) {
	filter := ""
	switch tab {
	case "posts":
		filter = " AND kind = 1"
	case "tweets":
		filter = " AND kind = 2"
	case "comments":
		filter = " AND kind IN (3,5)"
	case "annotations":
		filter = " AND kind = 4"
	}
	args := []any{sql.Named("owner", owner.UUID()), sql.Named("now", position.Snapshot), sql.Named("limit", limit)}
	if !position.At.IsZero() {
		filter += " AND (created_at, kind, id) < (@at, @kind, CAST(@id AS uuid))"
		args = append(args, sql.Named("at", position.At), sql.Named("kind", position.Type), sql.Named("id", position.ID))
	}
	var rows []struct {
		ID           string
		Kind         int
		CreatedAt    time.Time
		Title        string
		Body         string
		SelectedText string
		URL          string
		CoverImage   string
		Images       []byte
	}
	if err := r.db.WithContext(ctx).Raw(`WITH events AS (`+publicProfileEvents+`)
SELECT * FROM events WHERE created_at <= @now`+filter+` ORDER BY created_at DESC, kind DESC, id DESC LIMIT @limit`, args...).Scan(&rows).Error; err != nil {
		return nil, shared.Internal("查询公开动态失败", err)
	}
	items := make([]publicprofile.Activity, 0, len(rows))
	kinds := [...]string{"", "post", "tweet", "comment", "annotation", "tweet_comment"}
	for _, row := range rows {
		var images []publicprofile.Image
		if row.Kind > 1 && len(row.Images) > 0 {
			if err := json.Unmarshal(row.Images, &images); err != nil {
				return nil, shared.Internal("读取动态图片失败", err)
			}
		}
		if images == nil {
			images = []publicprofile.Image{}
		}
		items = append(items, publicprofile.Activity{ID: row.ID, Type: kinds[row.Kind], Order: row.Kind, CreatedAt: row.CreatedAt.UTC(), Title: row.Title, Body: row.Body, SelectedText: row.SelectedText, URL: row.URL, CoverImage: row.CoverImage, Images: images})
	}
	return items, nil
}
