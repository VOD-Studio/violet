package gorm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	appshared "blog-api/internal/application/shared"
	apptweet "blog-api/internal/application/tweet"
	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	"blog-api/internal/infrastructure/tweetfeed"
	tweethttp "blog-api/internal/interfaces/http/handler/tweet"
	"blog-api/internal/middleware"
)

func seedFeedAuthor(t *testing.T, db *gorm.DB, username string, deletedAt *time.Time) shared.ID {
	t.Helper()
	id := shared.NewID()
	row := model.User{Username: username, DisplayName: "显示名 " + username, Email: username + "@example.com", DeletedAt: deletedAt}
	row.ID = id.UUID()
	require.NoError(t, db.Create(&row).Error)
	return id
}

func TestPublicTweetFeedFiltersAndSnapshots(t *testing.T) {
	db := setupTweetTestDB(t)
	testPublicTweetFeed(t, db)
}

func TestPublicTweetFeedPostgres(t *testing.T) {
	testPublicTweetFeed(t, setupTweetFeedPostgresTestDB(t))
}

func setupTweetFeedPostgresTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("VIOLET_TWEET_FEED_TEST_DSN")
	if dsn == "" {
		t.Skip("VIOLET_TWEET_FEED_TEST_DSN is not configured")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	schema := "tweet_feed_" + strings.ReplaceAll(shared.NewID().String(), "-", "")
	require.NoError(t, db.Exec("CREATE SCHEMA "+schema).Error)
	t.Cleanup(func() { require.NoError(t, db.Exec("DROP SCHEMA "+schema+" CASCADE").Error) })
	require.NoError(t, db.Exec("SET search_path TO "+schema).Error)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Tweet{}, &model.TweetLike{}, &model.TweetHashtag{}))
	return db
}

func testPublicTweetFeed(t *testing.T, db *gorm.DB) {
	t.Helper()
	require.NoError(t, db.AutoMigrate(&model.TweetComment{}))
	ctx := context.Background()
	cache := miniredis.RunT(t)
	redisClient := redis.NewClient(&redis.Options{Addr: cache.Addr()})
	t.Cleanup(func() { _ = redisClient.Close() })
	store := tweetfeed.NewStore(redisClient)
	repo := NewTweetRepository(db)
	svc := apptweet.NewService(repo, NewTweetCommentRepository(db), NewUserRepository(db), nil, nil, nil, nil, nil, appshared.NoopEventBus{}).WithFeed(repo, store)
	h := tweethttp.NewHandler(svc).WithViewIdentity(middleware.HashedIPIdentity([]byte("test key")))

	now := time.Now().UTC().Truncate(time.Minute).Add(-time.Hour)
	alice := seedFeedAuthor(t, db, "alice", nil)
	bob := seedFeedAuthor(t, db, "bob", nil)
	botEmail := "bot+" + bob.String() + "@" + domainuser.BotUserEmailDomain
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", bob.UUID()).Update("email", botEmail).Error)
	deleted := seedFeedAuthor(t, db, "deleted", &now)
	photo := func(path string) datatypes.JSONSlice[model.TweetImagePO] {
		return datatypes.JSONSlice[model.TweetImagePO]{{URL: path}}
	}
	id := func(n string) shared.ID { return shared.MustParseID("00000000-0000-0000-0000-0000000000" + n) }
	add := func(n string, author shared.ID, body string, images datatypes.JSONSlice[model.TweetImagePO], quote *shared.ID, likes int, stamp time.Time) shared.ID {
		t.Helper()
		tweetID := id(n)
		row := model.Tweet{ID: tweetID.UUID(), AuthorID: author.UUID(), Content: body, Images: images, LikeCount: likes, CreatedAt: stamp, UpdatedAt: stamp}
		if quote != nil {
			value := quote.UUID()
			row.QuoteOf = &value
		}
		require.NoError(t, db.Create(&row).Error)
		for _, tag := range []string{"public", "hidden"} {
			if body == "#"+tag+"#" {
				require.NoError(t, db.Create(&model.TweetHashtag{TweetID: row.ID, Tag: tag, CreatedAt: stamp}).Error)
			}
		}
		return tweetID
	}
	older := add("01", alice, "old", photo("/uploads/old.jpg"), nil, 100, now.Add(-31*24*time.Hour))
	first := add("02", alice, "#public#", photo("/uploads/own.jpg"), nil, 3, now)
	second := add("03", bob, "#public#", nil, nil, 5, now)
	third := add("04", bob, "https://example.com/image.jpg", nil, nil, 0, now.Add(time.Minute))
	require.NoError(t, db.Model(&model.Tweet{}).Where("id = ?", third.UUID()).UpdateColumn("external_tweet_id", shared.NewID().UUID()).Error)
	quote := add("05", bob, "quote", nil, &first, 0, now.Add(2*time.Minute))
	hidden := add("06", deleted, "#hidden#", photo("/uploads/hidden.jpg"), &first, 100, now.Add(3*time.Minute))
	removed := add("07", alice, "removed", photo("/uploads/deleted.jpg"), nil, 100, now.Add(4*time.Minute))
	retired := add("08", bob, "deleted during pagination", nil, nil, 0, now.Add(3*time.Minute))
	require.NoError(t, repo.Delete(ctx, removed))
	require.NoError(t, db.Create(&model.TweetComment{ID: shared.NewID().UUID(), TweetID: first.UUID(), AuthorID: bob.UUID(), Body: "public comment"}).Error)
	require.NoError(t, db.Create(&model.TweetComment{ID: shared.NewID().UUID(), TweetID: first.UUID(), AuthorID: deleted.UUID(), Body: "not ranked"}).Error)

	page, next, err := svc.ListTimeline(ctx, "hot", "", 1)
	require.NoError(t, err)
	require.Len(t, page, 1)
	require.Equal(t, second.String(), page[0].ID, "equal rank and timestamp break ties by descending id")
	require.True(t, page[0].Author.IsBot, "public bot posts stay eligible")
	require.NotEmpty(t, next)
	for range 7 {
		require.NoError(t, repo.Like(ctx, second, shared.NewID()))
		require.NoError(t, repo.Like(ctx, third, shared.NewID()))
	}
	require.NoError(t, repo.Delete(ctx, retired))
	page, _, err = svc.ListTimeline(ctx, "hot", next, 5)
	require.NoError(t, err)
	ids := make([]string, 0, len(page))
	for _, row := range page {
		ids = append(ids, row.ID)
	}
	require.Equal(t, []string{first.String(), quote.String(), third.String()}, ids)
	require.Equal(t, 7, page[2].LikeCount, "snapshots freeze order, not DTOs")
	cache.FastForward(16 * time.Minute)
	_, _, err = svc.ListTimeline(ctx, "hot", next, 5)
	require.ErrorIs(t, err, apptweet.ErrHotCursorExpired)
	expired := httptest.NewRecorder()
	h.ListTimeline(expired, httptest.NewRequest(http.MethodGet, "/tweets?sort=hot&cursor="+next, nil))
	require.Equal(t, http.StatusConflict, expired.Code)
	require.Contains(t, expired.Body.String(), `"error":"TWEET_HOT_CURSOR_EXPIRED"`)

	page, next, err = svc.ListTimeline(ctx, "images", "", 1)
	require.NoError(t, err)
	require.Len(t, page, 1)
	require.Equal(t, first.String(), page[0].ID, "external preview and quoted attachment are not own images")
	page, _, err = svc.ListTimeline(ctx, "images", next, 1)
	require.NoError(t, err)
	require.Len(t, page, 1)
	require.Equal(t, older.String(), page[0].ID)

	sidebar, err := svc.Sidebar(ctx)
	require.NoError(t, err)
	require.Len(t, sidebar.Authors, 2)
	require.Equal(t, bob.String(), sidebar.Authors[0].ID)
	require.EqualValues(t, 3, sidebar.Authors[0].Count)
	require.Equal(t, "显示名 bob", sidebar.Authors[0].DisplayName)
	require.EqualValues(t, 1, sidebar.Authors[1].Count)
	require.Equal(t, []apptweet.SidebarTopicDTO{{Tag: "public", Count: 2}}, sidebar.Topics)
	require.Equal(t, []apptweet.SidebarImageDTO{{TweetID: first.String(), URL: "/uploads/own.jpg"}, {TweetID: older.String(), URL: "/uploads/old.jpg"}}, sidebar.Images)

	count := func(method, remote string, tweetID shared.ID, want int64) {
		t.Helper()
		r := httptest.NewRequest(method, "/tweets/"+tweetID.String()+"/views", nil)
		r.SetPathValue("id", tweetID.String())
		r.RemoteAddr = remote
		w := httptest.NewRecorder()
		if method == http.MethodPost {
			h.RecordView(w, r)
		} else {
			h.Get(w, r)
		}
		require.Equal(t, http.StatusOK, w.Code, w.Body.String())
		var body struct {
			Data struct {
				ViewCount *int64 `json:"view_count"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		require.NotNil(t, body.Data.ViewCount)
		require.Equal(t, want, *body.Data.ViewCount, "%s from %s", method, remote)
	}
	count(http.MethodGet, "192.0.2.1:3000", first, 0)
	count(http.MethodGet, "192.0.2.1:3000", first, 0)
	count(http.MethodPost, "192.0.2.1:3000", first, 1)
	count(http.MethodPost, "192.0.2.1:3001", first, 1)
	count(http.MethodPost, "192.0.2.2:3000", first, 2)
	count(http.MethodGet, "192.0.2.1:3000", first, 2)
	cache.FastForward(31 * time.Minute)
	count(http.MethodPost, "192.0.2.1:3001", first, 3)
	_, err = svc.RecordView(ctx, hidden.String(), "another-visitor")
	require.ErrorIs(t, err, domaintweet.ErrNotFound)
	_, err = svc.RecordView(ctx, removed.String(), "another-visitor")
	require.ErrorIs(t, err, domaintweet.ErrNotFound)
}

func TestPublicTweetDetailContext(t *testing.T) {
	testPublicTweetDetailContext(t, setupTweetTestDB(t))
}

func TestPublicTweetDetailContextPostgres(t *testing.T) {
	testPublicTweetDetailContext(t, setupTweetFeedPostgresTestDB(t))
}

func testPublicTweetDetailContext(t *testing.T, db *gorm.DB) {
	t.Helper()
	require.NoError(t, db.AutoMigrate(&model.TweetComment{}, &model.TweetCommentReaction{}))
	ctx := context.Background()
	repo := NewTweetRepository(db)
	svc := apptweet.NewService(repo, nil, nil, nil, nil, nil, nil, nil, appshared.NoopEventBus{}).WithDetailContextRepository(repo)
	h := tweethttp.NewHandler(svc)

	stamp := time.Date(2026, time.October, 30, 23, 41, 0, 0, time.UTC)
	newer := stamp.Add(time.Hour)
	alice := seedFeedAuthor(t, db, "alice", nil)
	bob := seedFeedAuthor(t, db, "bob", nil)
	deleted := seedFeedAuthor(t, db, "deleted", &newer)
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", alice.UUID()).
		Updates(map[string]any{"bio": "写代码的人", "avatar_url": "/uploads/alice.png"}).Error)

	id := func(n int) shared.ID { return shared.MustParseID(fmt.Sprintf("00000000-0000-0000-0000-%012x", n)) }
	add := func(n int, author shared.ID, content string, when time.Time, quoteOf int) {
		t.Helper()
		row := model.Tweet{ID: id(n).UUID(), AuthorID: author.UUID(), Content: content, CreatedAt: when, UpdatedAt: when}
		if quoteOf != 0 {
			target := id(quoteOf).UUID()
			row.QuoteOf = &target
		}
		require.NoError(t, db.Create(&row).Error)
	}
	add(1, alice, "root", stamp, 0)
	add(2, alice, "old public tweet", stamp.AddDate(-1, 0, 0), 0)
	add(3, alice, "removed", newer, 1)
	add(4, deleted, "hidden direct quote", newer, 1)
	add(5, bob, "nested quote", newer, 8)
	add(6, bob, "", newer, 1)
	add(12, bob, "same time, higher id", stamp, 1)
	add(7, bob, "below the limit", stamp, 1)
	add(8, bob, "direct quote eight", stamp, 1)
	add(9, bob, "direct quote nine", stamp, 1)
	add(10, bob, "direct quote ten", stamp, 1)
	add(11, bob, "direct quote eleven", stamp, 1)
	add(13, bob, "oldest direct quote", stamp.Add(-time.Minute), 1)

	for _, n := range []int{1, 2, 3, 4} {
		require.NoError(t, repo.Like(ctx, id(n), bob))
	}
	require.NoError(t, repo.Like(ctx, id(13), alice))
	require.NoError(t, repo.Delete(ctx, id(3)))
	commentID := shared.NewID().UUID()
	require.NoError(t, db.Create(&model.TweetComment{ID: commentID, TweetID: id(1).UUID(), AuthorID: bob.UUID(), Body: "comment"}).Error)
	require.NoError(t, db.Create(&model.TweetCommentReaction{ID: shared.NewID().UUID(), CommentID: commentID, UserID: bob.UUID(), EmojiID: 1}).Error)

	get := func(n, wantStatus int) *httptest.ResponseRecorder {
		t.Helper()
		tweetID := id(n).String()
		r := httptest.NewRequest(http.MethodGet, "/api/v1/tweets/"+tweetID+"/context", nil)
		r.SetPathValue("id", tweetID)
		w := httptest.NewRecorder()
		h.DetailContext(w, r)
		require.Equal(t, wantStatus, w.Code, w.Body.String())
		return w
	}
	read := func(n int) map[string]any {
		t.Helper()
		var body struct {
			Data map[string]any `json:"data"`
		}
		require.NoError(t, json.Unmarshal(get(n, http.StatusOK).Body.Bytes(), &body))
		return body.Data
	}
	quote := func(n int, content string, when time.Time) map[string]any {
		return map[string]any{
			"id": id(n).String(), "content": content, "created_at": when.Format(time.RFC3339),
			"author": map[string]any{"username": "bob", "display_name": "显示名 bob", "avatar_url": ""},
		}
	}
	author := map[string]any{
		"username": "alice", "display_name": "显示名 alice", "avatar_url": "/uploads/alice.png",
		"bio": "写代码的人", "tweet_count": float64(2), "received_like_count": float64(2),
	}
	require.Equal(t, map[string]any{
		"author": author,
		"quotes": []any{
			quote(6, "", newer), quote(12, "same time, higher id", stamp), quote(11, "direct quote eleven", stamp),
			quote(10, "direct quote ten", stamp), quote(9, "direct quote nine", stamp), quote(8, "direct quote eight", stamp),
		},
	}, read(1))
	require.Equal(t, map[string]any{"author": author, "quotes": []any{}}, read(2))
	get(3, http.StatusNotFound)
	get(4, http.StatusNotFound)
}
