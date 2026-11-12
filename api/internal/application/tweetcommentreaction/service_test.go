package tweetcommentreaction_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	app "blog-api/internal/application/tweetcommentreaction"
	"blog-api/internal/domain/commentreaction"
	"blog-api/internal/domain/emoji"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/tweet"
	repo "blog-api/internal/infrastructure/persistence/gorm"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	handler "blog-api/internal/interfaces/http/handler/tweetcommentreaction"
)

type fixture struct {
	db                         *gorm.DB
	svc                        *app.Service
	tweetID, commentID, userID uuid.UUID
	emojiID                    int32
}

func setup(t *testing.T) fixture {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "reactions.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Tweet{}, &model.TweetComment{}, &model.EmojiGroup{}, &model.Emoji{}, &model.TweetCommentReaction{}))
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})
	f := fixture{db: db, tweetID: uuid.New(), commentID: uuid.New(), userID: uuid.New()}
	require.NoError(t, db.Create(&model.User{BaseModel: model.BaseModel{ID: f.userID}, Username: "viewer", DisplayName: "回应者", Email: "viewer@test", PasswordHash: "x"}).Error)
	require.NoError(t, db.Create(&model.Tweet{ID: f.tweetID, AuthorID: f.userID, Content: "公开推文"}).Error)
	require.NoError(t, db.Create(&model.TweetComment{ID: f.commentID, TweetID: f.tweetID, AuthorID: f.userID, Body: "评论", Path: f.commentID.String() + "/"}).Error)
	group := model.EmojiGroup{Name: "公开目录", Source: "system", IsEnabled: true}
	require.NoError(t, db.Create(&group).Error)
	e := model.Emoji{GroupID: group.ID, Name: "开心", URL: "/happy.png", GifURL: "/happy.gif", Meta: []byte(`{"type":1}`)}
	require.NoError(t, db.Create(&e).Error)
	f.emojiID = e.ID
	f.svc = app.NewService(repo.NewTweetRepository(db), repo.NewTweetCommentRepository(db), repo.NewEmojiGroupRepository(db), repo.NewTweetCommentReactionStore(db))
	return f
}

func TestReactionsPersistIdempotentlyAndRemainPublic(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	for range 2 {
		require.NoError(t, f.svc.Add(ctx, f.tweetID.String(), f.commentID.String(), f.userID.String(), f.emojiID))
	}
	items, err := f.svc.List(ctx, f.tweetID.String(), f.commentID.String(), f.userID.String())
	require.NoError(t, err)
	require.Len(t, items, 1)
	require.Equal(t, int64(1), items[0].Count)
	require.True(t, items[0].Self)
	require.Equal(t, "/happy.gif", items[0].GifURL)
	require.Equal(t, []commentreaction.RecentUser{{ID: f.userID.String(), Name: "回应者"}}, items[0].RecentUsers)
	public, err := f.svc.List(ctx, f.tweetID.String(), f.commentID.String(), "")
	require.NoError(t, err)
	require.False(t, public[0].Self)
	require.Equal(t, items[0].RecentUsers, public[0].RecentUsers)
	for range 2 {
		require.NoError(t, f.svc.Remove(ctx, f.tweetID.String(), f.commentID.String(), f.userID.String(), f.emojiID))
	}
	items, err = f.svc.List(ctx, f.tweetID.String(), f.commentID.String(), "")
	require.NoError(t, err)
	require.NotNil(t, items)
	require.Empty(t, items)
	batch, err := f.svc.Batch(ctx, f.tweetID.String(), nil, "")
	require.NoError(t, err)
	require.NotNil(t, batch)
	require.Empty(t, batch)
}

func TestReactionTargetAndEmojiRules(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	require.Error(t, f.svc.Add(ctx, f.tweetID.String(), f.commentID.String(), "", f.emojiID))
	require.Error(t, f.svc.Remove(ctx, f.tweetID.String(), f.commentID.String(), "", f.emojiID))
	other := uuid.New()
	require.NoError(t, f.db.Create(&model.Tweet{ID: other, AuthorID: f.userID, Content: "另一推文"}).Error)
	_, err := f.svc.List(ctx, other.String(), f.commentID.String(), "")
	require.ErrorIs(t, err, tweet.ErrCommentNotFound)
	batch, err := f.svc.Batch(ctx, other.String(), []string{f.commentID.String()}, "")
	require.NoError(t, err)
	require.Equal(t, []commentreaction.ReactionList{{CommentID: f.commentID.String(), Reactions: []commentreaction.AggregatedReaction{}}}, batch)
	require.ErrorIs(t, f.svc.Add(ctx, other.String(), f.commentID.String(), f.userID.String(), f.emojiID), tweet.ErrCommentNotFound)
	require.ErrorIs(t, f.svc.Remove(ctx, other.String(), f.commentID.String(), f.userID.String(), f.emojiID), tweet.ErrCommentNotFound)
	_, err = f.svc.List(ctx, uuid.NewString(), f.commentID.String(), "")
	require.ErrorIs(t, err, tweet.ErrNotFound)
	_, err = f.svc.List(ctx, f.tweetID.String(), uuid.NewString(), "")
	require.ErrorIs(t, err, tweet.ErrCommentNotFound)
	for _, id := range []int32{0, -1, 99999} {
		require.Error(t, f.svc.Add(ctx, f.tweetID.String(), f.commentID.String(), f.userID.String(), id))
	}
	for _, typ := range []int{2, 3, 99} {
		require.NoError(t, f.db.Model(&model.Emoji{}).Where("id = ?", f.emojiID).Update("meta", []byte(fmt.Sprintf(`{"type":%d}`, typ))).Error)
		require.Error(t, f.svc.Add(ctx, f.tweetID.String(), f.commentID.String(), f.userID.String(), f.emojiID))
	}
	require.NoError(t, f.db.Model(&model.Emoji{}).Where("id = ?", f.emojiID).Update("meta", []byte(`{"type":4}`)).Error)
	require.NoError(t, f.svc.Add(ctx, f.tweetID.String(), f.commentID.String(), f.userID.String(), f.emojiID))
	require.NoError(t, f.db.Model(&model.EmojiGroup{}).Where("name = ?", "公开目录").Update("is_enabled", false).Error)
	require.Error(t, f.svc.Add(ctx, f.tweetID.String(), f.commentID.String(), f.userID.String(), f.emojiID))
	require.NoError(t, f.svc.Remove(ctx, f.tweetID.String(), f.commentID.String(), f.userID.String(), f.emojiID))
	require.NoError(t, f.db.Delete(&model.Emoji{}, "id = ?", f.emojiID).Error)
	require.ErrorIs(t, f.svc.Add(ctx, f.tweetID.String(), f.commentID.String(), f.userID.String(), f.emojiID), emoji.ErrEmojiNotFound)
}

func TestRecentUsersAreBoundedOrderedAndExcludeDeleted(t *testing.T) {
	f := setup(t)
	at := time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)
	ids := make([]uuid.UUID, 0, 5)
	for i := range 5 {
		id := uuid.New()
		ids = append(ids, id)
		user := model.User{BaseModel: model.BaseModel{ID: id}, Username: fmt.Sprintf("u%d", i), DisplayName: fmt.Sprintf("公开%d", i), Email: fmt.Sprintf("u%d@test", i), PasswordHash: "x"}
		if i == 3 {
			user.DisplayName = ""
		}
		if i == 4 {
			user.DeletedAt = &at
		}
		require.NoError(t, f.db.Create(&user).Error)
		require.NoError(t, f.db.Create(&model.TweetCommentReaction{ID: uuid.MustParse(fmt.Sprintf("00000000-0000-0000-0000-%012d", i+1)), CommentID: f.commentID, EmojiID: f.emojiID, UserID: id, CreatedAt: at}).Error)
	}
	items, err := f.svc.List(context.Background(), f.tweetID.String(), f.commentID.String(), ids[0].String())
	require.NoError(t, err)
	require.True(t, items[0].Self)
	require.Equal(t, int64(5), items[0].Count)
	require.Equal(t, []commentreaction.RecentUser{{ID: ids[3].String(), Name: "u3"}, {ID: ids[2].String(), Name: "公开2"}, {ID: ids[1].String(), Name: "公开1"}}, items[0].RecentUsers)
	store := repo.NewTweetCommentReactionStore(f.db)
	require.NoError(t, store.Remove(context.Background(), shared.MustParseID(f.commentID.String()), shared.MustParseID(ids[3].String()), f.emojiID))
	items, err = f.svc.List(context.Background(), f.tweetID.String(), f.commentID.String(), "")
	require.NoError(t, err)
	require.Equal(t, ids[0].String(), items[0].RecentUsers[2].ID)
}

func TestReactionHTTPReadsUseArrayContract(t *testing.T) {
	f := setup(t)
	h := handler.NewHandler(f.svc)
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.SetPathValue("id", f.tweetID.String())
	r.SetPathValue("commentId", f.commentID.String())
	w := httptest.NewRecorder()
	h.List(w, r)
	require.Equal(t, http.StatusOK, w.Code)
	var body struct {
		Data json.RawMessage `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.JSONEq(t, `[]`, string(body.Data))
}
