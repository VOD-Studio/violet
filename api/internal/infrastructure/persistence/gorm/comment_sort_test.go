package gorm

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/comment"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/tweet"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func sortFixtureIDs() []uuid.UUID {
	return []uuid.UUID{
		uuid.MustParse("00000000-0000-0000-0000-000000000001"),
		uuid.MustParse("00000000-0000-0000-0000-000000000002"),
		uuid.MustParse("00000000-0000-0000-0000-000000000003"),
		uuid.MustParse("00000000-0000-0000-0000-000000000004"),
	}
}

func TestArticleCommentHotSortUsesAllReactionsBeforePagination(t *testing.T) {
	db := setupCommentTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.CommentReaction{}))
	repo := NewCommentRepository(db)
	ctx := context.Background()
	postID, viewer := shared.NewID(), shared.NewID()
	uid := viewer.UUID()
	ids := sortFixtureIDs()
	at := time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)
	for i, id := range ids {
		status := comment.StatusApproved
		created := at
		if i == 0 {
			created = at.Add(-time.Hour)
		}
		if i == 3 {
			status = comment.StatusPending
			created = at.Add(time.Hour)
		}
		require.NoError(t, db.Create(&model.Comment{ID: id, PostID: postID.UUID(), CreatedBy: &uid, Body: "自由评论", AuthorName: "作者", Status: status, Path: id.String() + "/", CreatedAt: created}).Error)
		count := []int{3, 2, 2, 0}[i]
		for n := range count {
			u := uuid.New()
			require.NoError(t, db.Create(&model.CommentReaction{ID: uuid.New(), CommentID: id, UserID: &u, EmojiID: int32(n + 1)}).Error)
		}
	}
	// 热度更高的他人待审、批注和其它文章不得混进自由顶层列表。
	for i := range 3 {
		id, other := uuid.New(), uuid.New()
		row := model.Comment{ID: id, PostID: postID.UUID(), CreatedBy: &other, Body: "不可混入", AuthorName: "其它", Status: comment.StatusPending, Path: id.String() + "/", CreatedAt: at.Add(2 * time.Hour)}
		if i == 1 {
			block := "annotation"
			row.Status = comment.StatusApproved
			row.AnchorBlockID = &block
		}
		if i == 2 {
			row.Status = comment.StatusApproved
			row.PostID = uuid.New()
		}
		require.NoError(t, db.Create(&row).Error)
		for n := range 5 {
			u := uuid.New()
			require.NoError(t, db.Create(&model.CommentReaction{ID: uuid.New(), CommentID: id, UserID: &u, EmojiID: int32(n + 1)}).Error)
		}
	}
	top := comment.DepthFilterTopLevel
	filter := comment.ListFilter{PostID: &postID, Status: comment.StatusApproved, ViewerUserID: &viewer, AnchorFilter: comment.AnchorFilterFree, DepthFilter: &top, TopLevelSort: "hot"}
	var got []string
	for page := 1; page <= 2; page++ {
		result, err := repo.FindPage(ctx, filter, shared.PageQuery{Page: page, Limit: 2})
		require.NoError(t, err)
		require.Equal(t, int64(4), result.Total)
		for _, item := range result.Items {
			got = append(got, item.ID().String())
		}
	}
	require.Equal(t, []string{ids[0].String(), ids[2].String(), ids[1].String(), ids[3].String()}, got)
	filter.TopLevelSort = "latest"
	result, err := repo.FindPage(ctx, filter, shared.PageQuery{Page: 1, Limit: 10})
	require.NoError(t, err)
	got = make([]string, 0, len(result.Items))
	for _, item := range result.Items {
		got = append(got, item.ID().String())
	}
	require.Equal(t, []string{ids[3].String(), ids[2].String(), ids[1].String(), ids[0].String()}, got)
	// 批注与后台未传 TopLevelSort 时仍按时间，而不被全局热度排序污染。
	filter.AnchorFilter = comment.AnchorFilterAll
	filter.TopLevelSort = "hot"
	result, err = repo.FindPage(ctx, filter, shared.PageQuery{Page: 1, Limit: 10})
	require.NoError(t, err)
	require.Equal(t, "不可混入", result.Items[0].Body())
}

func TestTweetCommentHotSortUsesAllReactionsAndStableTies(t *testing.T) {
	db := setupTweetCommentTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.TweetCommentReaction{}))
	repo := NewTweetCommentRepository(db)
	ctx := context.Background()
	tweetID, authorID := shared.NewID(), shared.NewID()
	ids := sortFixtureIDs()
	at := time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)
	for i, id := range ids {
		created := at
		if i == 0 {
			created = at.Add(-time.Hour)
		}
		if i == 3 {
			created = at.Add(time.Hour)
		}
		require.NoError(t, db.Create(&model.TweetComment{ID: id, TweetID: tweetID.UUID(), AuthorID: authorID.UUID(), Body: "顶层", Path: id.String() + "/", CreatedAt: created}).Error)
		for n := range []int{3, 2, 2, 0}[i] {
			require.NoError(t, db.Create(&model.TweetCommentReaction{ID: uuid.New(), CommentID: id, UserID: uuid.New(), EmojiID: int32(n + 1)}).Error)
		}
	}
	parent := ids[0]
	replyID := uuid.New()
	require.NoError(t, db.Create(&model.TweetComment{ID: replyID, TweetID: tweetID.UUID(), AuthorID: authorID.UUID(), Body: "回复", ParentID: &parent, Depth: 1, Path: parent.String() + "/" + replyID.String() + "/", CreatedAt: at}).Error)
	for n := range 5 {
		require.NoError(t, db.Create(&model.TweetCommentReaction{ID: uuid.New(), CommentID: replyID, UserID: uuid.New(), EmojiID: int32(n + 1)}).Error)
	}
	filter := tweet.ListFilter{TweetID: &tweetID, TopLevelSort: "hot"}
	var got []string
	for page := 1; page <= 2; page++ {
		result, err := repo.FindPage(ctx, filter, shared.PageQuery{Page: page, Limit: 2})
		require.NoError(t, err)
		require.Equal(t, int64(4), result.Total)
		for _, item := range result.Items {
			got = append(got, item.ID().String())
		}
	}
	require.Equal(t, []string{ids[0].String(), ids[2].String(), ids[1].String(), ids[3].String()}, got)
	filter.TopLevelSort = "latest"
	result, err := repo.FindPage(ctx, filter, shared.PageQuery{Page: 1, Limit: 10})
	require.NoError(t, err)
	got = make([]string, 0, len(result.Items))
	for _, item := range result.Items {
		got = append(got, item.ID().String())
	}
	require.Equal(t, []string{ids[3].String(), ids[2].String(), ids[1].String(), ids[0].String()}, got)
}
