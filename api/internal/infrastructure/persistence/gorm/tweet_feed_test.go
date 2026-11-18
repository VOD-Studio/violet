package gorm

import (
	"context"
	"encoding/json"
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
	testPublicTweetFeed(t, db)
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
