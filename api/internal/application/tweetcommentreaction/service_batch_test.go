package tweetcommentreaction_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	app "blog-api/internal/application/tweetcommentreaction"
	"blog-api/internal/domain/commentreaction"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/tweet"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	handler "blog-api/internal/interfaces/http/handler/tweetcommentreaction"
)

func TestBatchReactionsKeepMissingAndForeignTargetsEmpty(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	otherTweetID, foreignID, deletedID, missingID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	require.NoError(t, f.db.Create(&model.Tweet{ID: otherTweetID, AuthorID: f.userID, Content: "另一推文"}).Error)
	require.NoError(t, f.db.Create(&[]model.TweetComment{
		{ID: foreignID, TweetID: otherTweetID, AuthorID: f.userID, Body: "其它推文评论", Path: foreignID.String() + "/"},
		{ID: deletedID, TweetID: f.tweetID, AuthorID: f.userID, Body: "过期评论", Path: deletedID.String() + "/"},
	}).Error)
	for _, id := range []uuid.UUID{f.commentID, foreignID, deletedID} {
		require.NoError(t, f.db.Create(&model.TweetCommentReaction{ID: uuid.New(), CommentID: id, UserID: f.userID, EmojiID: f.emojiID}).Error)
	}
	// SQLite 测试库保留孤立回应，以证明筛选评论集合而非仅依赖生产外键级联。
	require.NoError(t, f.db.Delete(&model.TweetComment{}, "id = ?", deletedID).Error)
	ids := []string{foreignID.String(), f.commentID.String(), deletedID.String(), f.commentID.String(), missingID.String(), strings.ToUpper(f.commentID.String())}
	items, err := f.svc.Batch(ctx, f.tweetID.String(), ids, "")
	require.NoError(t, err)
	require.Len(t, items, 4)
	for i, id := range []string{foreignID.String(), f.commentID.String(), deletedID.String(), missingID.String()} {
		require.Equal(t, id, items[i].CommentID)
		if i == 1 {
			require.Len(t, items[i].Reactions, 1)
			require.Equal(t, int64(1), items[i].Reactions[0].Count)
			require.False(t, items[i].Reactions[0].Self)
			require.Equal(t, "/happy.gif", items[i].Reactions[0].GifURL)
			continue
		}
		require.Equal(t, []commentreaction.AggregatedReaction{}, items[i].Reactions)
	}
}

func TestBatchReactionsValidateUniqueLimitAndUUIDs(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	ids := make([]string, app.MaxBatchCommentIDs)
	for i := range ids {
		ids[i] = uuid.NewString()
	}
	withDuplicates := append(append([]string{}, ids...), ids...)
	items, err := f.svc.Batch(ctx, f.tweetID.String(), withDuplicates, "")
	require.NoError(t, err)
	require.Len(t, items, app.MaxBatchCommentIDs)
	_, err = f.svc.Batch(ctx, f.tweetID.String(), append(ids, uuid.NewString()), "")
	require.True(t, shared.IsDomainError(err, shared.CodeBadRequest))
	_, err = f.svc.Batch(ctx, f.tweetID.String(), []string{f.commentID.String(), "not-a-uuid"}, "")
	require.True(t, shared.IsDomainError(err, shared.ErrInvalidID.Code))
	_, err = f.svc.Batch(ctx, "not-a-uuid", ids, "")
	require.True(t, shared.IsDomainError(err, shared.ErrInvalidID.Code))
	_, err = f.svc.Batch(ctx, uuid.NewString(), ids, "")
	require.ErrorIs(t, err, tweet.ErrNotFound)
}

func TestBatchReactionSQLCountDoesNotGrowWithTargetCount(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	ids := make([]string, 0, app.MaxBatchCommentIDs)
	ids = append(ids, f.commentID.String())
	comments := make([]model.TweetComment, 0, app.MaxBatchCommentIDs-1)
	reactions := make([]model.TweetCommentReaction, 0, app.MaxBatchCommentIDs)
	reactions = append(reactions, model.TweetCommentReaction{ID: uuid.New(), CommentID: f.commentID, UserID: f.userID, EmojiID: f.emojiID})
	for range app.MaxBatchCommentIDs - 1 {
		id := uuid.New()
		ids = append(ids, id.String())
		comments = append(comments, model.TweetComment{ID: id, TweetID: f.tweetID, AuthorID: f.userID, Body: "评论", Path: id.String() + "/"})
		reactions = append(reactions, model.TweetCommentReaction{ID: uuid.New(), CommentID: id, UserID: f.userID, EmojiID: f.emojiID})
	}
	require.NoError(t, f.db.Create(&comments).Error)
	require.NoError(t, f.db.Create(&reactions).Error)
	queryCount := 0
	count := func(*gorm.DB) {
		queryCount++
	}
	require.NoError(t, f.db.Callback().Query().Before("gorm:query").Register("count_batch_queries", count))
	require.NoError(t, f.db.Callback().Row().Before("gorm:row").Register("count_batch_rows", count))
	require.NoError(t, f.db.Callback().Raw().Before("gorm:raw").Register("count_batch_raw", count))
	one, err := f.svc.Batch(ctx, f.tweetID.String(), ids[:1], "")
	require.NoError(t, err)
	require.Len(t, one, 1)
	oneCount := queryCount
	require.Positive(t, oneCount)
	queryCount = 0
	many, err := f.svc.Batch(ctx, f.tweetID.String(), ids, "")
	require.NoError(t, err)
	require.Len(t, many, app.MaxBatchCommentIDs)
	require.Equal(t, oneCount, queryCount, "SQL count must remain constant for one and 100 comments with reactions")
	for _, item := range many {
		require.Len(t, item.Reactions, 1)
		require.Len(t, item.Reactions[0].RecentUsers, 1)
	}
}

func TestBatchReactionHTTPBoundsAndErrorContract(t *testing.T) {
	f := setup(t)
	h := handler.NewHandler(f.svc)
	tooMany := make([]string, app.MaxBatchCommentIDs+1)
	for i := range tooMany {
		tooMany[i] = uuid.NewString()
	}
	tooManyJSON, err := json.Marshal(map[string]any{"comment_ids": tooMany})
	require.NoError(t, err)
	cases := []struct {
		name, body, tweetID, code string
		status                    int
	}{
		{name: "invalid UUID", body: `{"comment_ids":["invalid"]}`, code: string(shared.ErrInvalidID.Code), status: http.StatusBadRequest},
		{name: "unique limit", body: string(tooManyJSON), code: "BAD_REQUEST", status: http.StatusBadRequest},
		{name: "oversized object", body: `{"comment_ids":[],"padding":"` + strings.Repeat("x", 16<<10) + `"}`, code: "PAYLOAD_TOO_LARGE", status: http.StatusRequestEntityTooLarge},
		{name: "oversized trailing whitespace", body: `{"comment_ids":[]}` + strings.Repeat(" ", 16<<10), code: "PAYLOAD_TOO_LARGE", status: http.StatusRequestEntityTooLarge},
		{name: "malformed", body: `{"comment_ids":`, code: "BAD_REQUEST", status: http.StatusBadRequest},
		{name: "multiple values", body: `{"comment_ids":[]} {}`, code: "BAD_REQUEST", status: http.StatusBadRequest},
		{name: "missing tweet", body: `{"comment_ids":[]}`, tweetID: uuid.NewString(), code: "NOT_FOUND", status: http.StatusNotFound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(tc.body))
			id := tc.tweetID
			if id == "" {
				id = f.tweetID.String()
			}
			r.SetPathValue("id", id)
			w := httptest.NewRecorder()
			h.Batch(w, r)
			require.Equal(t, tc.status, w.Code, w.Body.String())
			var body struct {
				Error   string `json:"error"`
				Message string `json:"message"`
			}
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
			require.Equal(t, tc.code, body.Error)
			require.NotEmpty(t, body.Message)
		})
	}
}

func TestBatchReactionHTTPReturnsOneArrayPerUniqueID(t *testing.T) {
	f := setup(t)
	missingID := uuid.NewString()
	ids := []string{missingID, f.commentID.String(), missingID}
	data, err := json.Marshal(map[string]any{"comment_ids": ids})
	require.NoError(t, err)
	r := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(data))
	r.SetPathValue("id", f.tweetID.String())
	w := httptest.NewRecorder()
	handler.NewHandler(f.svc).Batch(w, r)
	require.Equal(t, http.StatusOK, w.Code)
	var body struct {
		Data []commentreaction.ReactionList `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Equal(t, []commentreaction.ReactionList{
		{CommentID: missingID, Reactions: []commentreaction.AggregatedReaction{}},
		{CommentID: f.commentID.String(), Reactions: []commentreaction.AggregatedReaction{}},
	}, body.Data)
}
