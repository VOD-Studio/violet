package gorm

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	appshared "blog-api/internal/application/shared"
	apptweet "blog-api/internal/application/tweet"
	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	"blog-api/internal/infrastructure/xtweet"
	"blog-api/internal/middleware"
)

type externalUserRepo struct{ domainuser.UserRepository }

func (externalUserRepo) FindByIDs(context.Context, []shared.ID) ([]*domainuser.User, error) {
	return nil, nil
}

type externalBus struct {
	appshared.NoopEventBus
	count atomic.Int64
}

func (b *externalBus) Publish(_ context.Context, events []shared.DomainEvent) error {
	b.count.Add(int64(len(events)))
	return nil
}

type externalFetchFunc func(context.Context, string) (*apptweet.ExternalFetchResult, error)

func (f externalFetchFunc) Fetch(ctx context.Context, id string) (*apptweet.ExternalFetchResult, error) {
	return f(ctx, id)
}

type externalMedia struct {
	mu      sync.Mutex
	deleted []string
	err     error
	before  func()
}

func (m *externalMedia) Prepare(_ context.Context, id, version string, s *domaintweet.ExternalSnapshot, _ *int64) error {
	if m.before != nil {
		m.before()
	}
	for i := range s.Media {
		s.Media[i].URL = "/uploads/external-tweets/" + id + "/" + version + "/image.png"
	}
	return m.err
}

func (m *externalMedia) DeleteAll(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deleted = append(m.deleted, id)
	return nil
}

func (m *externalMedia) DeleteVersion(_ context.Context, id, version string) error {
	return m.DeleteAll(context.Background(), id+"/"+version)
}

func (*externalMedia) Sweep(context.Context, map[string]string, time.Time) error { return nil }

func completeExternal(id, text string) *apptweet.ExternalFetchResult {
	return &apptweet.ExternalFetchResult{
		SourceID: id, CanonicalURL: domaintweet.XCanonicalURL(id, "jack"),
		Availability: domaintweet.ExternalAvailable, FetchSource: "fxtwitter",
		Snapshot: &domaintweet.ExternalSnapshot{
			Author: domaintweet.ExternalAuthor{ID: "12", Name: "Jack", Handle: "jack", URL: "https://x.com/jack"},
			Text:   text, Segments: []domaintweet.ExternalSegment{{Kind: "text", Text: text}},
			PublishedAt: time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC), Completeness: domaintweet.TextComplete,
			Media: []domaintweet.ExternalMedia{{Kind: "photo", SourceURL: "https://pbs.twimg.com/media/photo.png"}},
		},
	}
}

func externalHarness(t *testing.T, fetcher apptweet.ExternalFetcher) (*gorm.DB, *apptweet.Service, *apptweet.ExternalService, *ExternalTweetRepository, *externalMedia, *miniredis.Miniredis, *externalBus) {
	t.Helper()
	db := setupTweetTestDB(t)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.ExternalTweet{}))
	rds := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: rds.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	media := &externalMedia{}
	repo := NewExternalTweetRepository(db)
	external := apptweet.NewExternalService(repo, fetcher, media, xtweet.NewPreviewStore(client))
	bus := &externalBus{}
	service := apptweet.NewService(NewTweetRepository(db), nil, externalUserRepo{}, nil, nil, nil, bus).WithExternal(external)
	return db, service, external, repo, media, rds, bus
}

func fixedExternalFetcher() apptweet.ExternalFetcher {
	return externalFetchFunc(func(_ context.Context, id string) (*apptweet.ExternalFetchResult, error) {
		return completeExternal(id, "原文 #source [doge]"), nil
	})
}

func requireExternalCode(t *testing.T, err error, code string) {
	t.Helper()
	require.Error(t, err)
	de := shared.AsDomainError(err)
	require.NotNil(t, de)
	assert.Equal(t, shared.ErrorCode(code), de.Code)
}

func TestExternalPublicationIdempotencyAndTokenOwnership(t *testing.T) {
	db, service, external, _, _, redisServer, bus := externalHarness(t, fixedExternalFetcher())
	ctx := context.Background()
	user := shared.NewID().String()
	preview, err := external.Preview(ctx, user, "https://twitter.com/anything/status/20?utm=x")
	require.NoError(t, err)
	var count int64
	require.NoError(t, db.Model(&model.Tweet{}).Count(&count).Error)
	assert.Zero(t, count)
	assert.Zero(t, bus.count.Load())
	_, err = service.Create(ctx, apptweet.CreateInput{AuthorID: shared.NewID().String(), ExternalPreviewToken: preview.PreviewToken, ClientRequestID: uuid.NewString()})
	requireExternalCode(t, err, "FORBIDDEN")

	in := apptweet.CreateInput{AuthorID: user, ExternalPreviewToken: preview.PreviewToken, ClientRequestID: uuid.NewString()}
	const concurrency = 8
	results := make(chan apptweet.TweetDTO, concurrency)
	errors := make(chan error, concurrency)
	var wg sync.WaitGroup
	for range concurrency {
		wg.Go(func() {
			dto, err := service.Create(ctx, in)
			results <- dto
			errors <- err
		})
	}
	wg.Wait()
	close(results)
	close(errors)
	var id string
	for err := range errors {
		require.NoError(t, err)
	}
	for dto := range results {
		if id == "" {
			id = dto.ID
		}
		assert.Equal(t, id, dto.ID)
		require.NotNil(t, dto.ExternalTweet)
		assert.Empty(t, dto.Content)
		assert.Equal(t, "20", dto.ExternalTweet.SourceID)
	}
	require.NoError(t, db.Model(&model.Tweet{}).Count(&count).Error)
	assert.EqualValues(t, 1, count)
	assert.EqualValues(t, 1, bus.count.Load())
	var tags int64
	require.NoError(t, db.Model(&model.TweetHashtag{}).Count(&tags).Error)
	assert.Zero(t, tags)

	in.Content = "换了感想"
	_, err = service.Create(ctx, in)
	requireExternalCode(t, err, "CONFLICT")
	in.Content = ""
	in.ClientRequestID = uuid.NewString()
	_, err = service.Create(ctx, in)
	requireExternalCode(t, err, "EXTERNAL_PREVIEW_USED")
	redisServer.FastForward(16 * time.Minute)
	_, err = service.Create(ctx, in)
	requireExternalCode(t, err, "EXTERNAL_PREVIEW_EXPIRED")
	var po model.Tweet
	require.NoError(t, db.First(&po, "id = ?", id).Error)
	in.ClientRequestID = po.ClientRequestID.String()
	dto, err := service.Create(ctx, in)
	require.NoError(t, err)
	assert.Equal(t, id, dto.ID)
}

func TestExternalVersionChangeWithdrawalAndNativeQuote(t *testing.T) {
	db, service, external, _, media, _, _ := externalHarness(t, fixedExternalFetcher())
	ctx := context.Background()
	user := shared.NewID().String()
	preview, err := external.Preview(ctx, user, "https://x.com/jack/status/20")
	require.NoError(t, err)
	id := shared.MustParseID(preview.ExternalTweet.ID)
	require.NoError(t, db.Model(&model.ExternalTweet{}).Where("id = ?", id.UUID()).Update("snapshot_version", uuid.NewString()).Error)
	_, err = service.Create(ctx, apptweet.CreateInput{AuthorID: user, ExternalPreviewToken: preview.PreviewToken, ClientRequestID: uuid.NewString()})
	requireExternalCode(t, err, "EXTERNAL_PREVIEW_CHANGED")
	preview, err = external.Preview(ctx, user, "https://x.com/jack/status/20")
	require.NoError(t, err)
	first, err := service.Create(ctx, apptweet.CreateInput{AuthorID: user, Content: "本站感想", ExternalPreviewToken: preview.PreviewToken, ClientRequestID: uuid.NewString()})
	require.NoError(t, err)
	preview2, err := external.Preview(ctx, shared.NewID().String(), "https://x.com/jack/status/20")
	require.NoError(t, err)
	assert.Equal(t, preview.ExternalTweet.ID, preview2.ExternalTweet.ID)
	quoted, err := service.Create(ctx, apptweet.CreateInput{AuthorID: user, QuoteOf: &first.ID})
	require.NoError(t, err)
	require.NotNil(t, quoted.QuotedTweet.ExternalTweet)
	assert.Nil(t, quoted.ExternalTweet)
	admin := context.WithValue(ctx, middleware.UserIsRootKey, true)
	require.NoError(t, service.WithdrawExternal(admin, id.String()))
	views, err := service.GetByIDs(ctx, []shared.ID{shared.MustParseID(first.ID), shared.MustParseID(quoted.ID)})
	require.NoError(t, err)
	require.Len(t, views, 2)
	for _, dto := range views {
		if dto.ID == first.ID {
			assert.Equal(t, "本站感想", dto.Content)
			assert.Nil(t, dto.ExternalTweet.Snapshot)
		} else {
			assert.Nil(t, dto.QuotedTweet.ExternalTweet.Snapshot)
		}
	}
	assert.Contains(t, media.deleted, id.String())
	_, err = external.Preview(ctx, user, "https://x.com/jack/status/20")
	requireExternalCode(t, err, "EXTERNAL_UNAVAILABLE")
	var count int64
	require.NoError(t, db.Model(&model.Tweet{}).Count(&count).Error)
	assert.EqualValues(t, 2, count)
}

func TestExternalRefreshTemporaryFailurePreservesSourceAndExplicitDeleteClearsIt(t *testing.T) {
	var failure error
	_, service, external, repo, media, redisServer, _ := externalHarness(t, externalFetchFunc(func(_ context.Context, id string) (*apptweet.ExternalFetchResult, error) {
		if failure != nil {
			return nil, failure
		}
		return completeExternal(id, "完整旧快照"), nil
	}))
	ctx := context.Background()
	preview, err := external.Preview(ctx, shared.NewID().String(), "https://x.com/jack/status/20")
	require.NoError(t, err)
	id := shared.MustParseID(preview.ExternalTweet.ID)
	admin := context.WithValue(ctx, middleware.UserIsRootKey, true)
	failure = &apptweet.ExternalFetchError{Kind: "unavailable"}
	_, err = service.RefreshExternal(admin, id.String())
	require.Error(t, err)
	source, err := repo.FindByID(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, "完整旧快照", source.Snapshot.Text)
	assert.Equal(t, domaintweet.ExternalAvailable, source.Availability)
	assert.Empty(t, media.deleted)
	redisServer.FastForward(time.Minute)
	failure = &apptweet.ExternalFetchError{Kind: "deleted", StopFallback: true}
	_, err = service.RefreshExternal(admin, id.String())
	require.Error(t, err)
	source, err = repo.FindByID(ctx, id)
	require.NoError(t, err)
	assert.Nil(t, source.Snapshot)
	assert.Equal(t, domaintweet.ExternalDeleted, source.Availability)
	assert.True(t, source.TakenDown)
	assert.Contains(t, media.deleted, id.String())
	redisServer.FastForward(time.Minute)
	failure = nil
	_, err = external.Preview(ctx, shared.NewID().String(), "https://x.com/jack/status/20")
	requireExternalCode(t, err, "EXTERNAL_UNAVAILABLE")
}

func TestExternalWithdrawalRejectsInFlightMediaCommit(t *testing.T) {
	_, service, external, repo, media, _, _ := externalHarness(t, fixedExternalFetcher())
	ctx := context.Background()
	entered, resume := make(chan struct{}), make(chan struct{})
	media.before = func() {
		close(entered)
		<-resume
	}
	done := make(chan error, 1)
	go func() {
		_, err := external.Preview(ctx, shared.NewID().String(), "https://x.com/jack/status/20")
		done <- err
	}()
	<-entered
	source, err := repo.Ensure(ctx, "20", time.Now().Add(time.Hour))
	require.NoError(t, err)
	admin := context.WithValue(ctx, middleware.UserIsRootKey, true)
	require.NoError(t, service.WithdrawExternal(admin, source.ID.String()))
	close(resume)
	requireExternalCode(t, <-done, "EXTERNAL_UNAVAILABLE")
	source, err = repo.FindByID(ctx, source.ID)
	require.NoError(t, err)
	assert.Nil(t, source.Snapshot)
	assert.True(t, source.TakenDown)
	media.mu.Lock()
	defer media.mu.Unlock()
	require.Len(t, media.deleted, 2)
	assert.Equal(t, source.ID.String(), media.deleted[0])
	assert.Contains(t, media.deleted[1], source.ID.String()+"/")
}

func TestExternalRequiredMediaFailureAndCleanupPublicationRace(t *testing.T) {
	db, _, external, repo, media, redisServer, _ := externalHarness(t, fixedExternalFetcher())
	ctx := context.Background()
	media.err = errors.New("mandatory media failed")
	_, err := external.Preview(ctx, shared.NewID().String(), "https://x.com/jack/status/20")
	requireExternalCode(t, err, "EXTERNAL_MEDIA_FAILED")
	var count int64
	require.NoError(t, db.Model(&model.Tweet{}).Count(&count).Error)
	assert.Zero(t, count)
	var source model.ExternalTweet
	require.NoError(t, db.First(&source, "source_id = ?", "20").Error)
	assert.Equal(t, "", source.SnapshotVersion)
	redisServer.FastForward(time.Minute)
	media.err = nil
	preview, err := external.Preview(ctx, shared.NewID().String(), "https://x.com/jack/status/20")
	require.NoError(t, err)
	id := shared.MustParseID(preview.ExternalTweet.ID)
	before := time.Now().Add(-24 * time.Hour)
	require.NoError(t, db.Model(&model.ExternalTweet{}).Where("id = ?", id.UUID()).Update("protected_until", before.Add(-time.Hour)).Error)
	rows, err := repo.FindUnused(ctx, before, 10)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	// 回收扫描与实际删除之间出现新的有效预览，删除阶段必须重新检查保护期。
	require.NoError(t, repo.Protect(ctx, []shared.ID{id}, time.Now().Add(time.Hour)))
	deleted, err := repo.DeleteUnused(ctx, id, before)
	require.NoError(t, err)
	assert.False(t, deleted)
}

func TestExternalQuoteSharesWithdrawalAndPreservesIndependentDepth(t *testing.T) {
	_, service, external, _, _, _, _ := externalHarness(t, externalFetchFunc(func(_ context.Context, id string) (*apptweet.ExternalFetchResult, error) {
		root := completeExternal(id, "source"+id)
		switch id {
		case "20":
			root.Quote = completeExternal("21", "quote21")
			root.Quote.Snapshot.QuoteURL = "https://x.com/jack/status/22"
		case "21":
			root.Quote = completeExternal("22", "quote22")
		}
		return root, nil
	}))
	ctx := context.Background()
	user := shared.NewID().String()
	first, err := external.Preview(ctx, user, "https://x.com/jack/status/20")
	require.NoError(t, err)
	quote, err := external.Preview(ctx, user, "https://x.com/jack/status/21")
	require.NoError(t, err)
	require.NotNil(t, quote.ExternalTweet.QuotedTweet)
	assert.Equal(t, "22", quote.ExternalTweet.QuotedTweet.SourceID)
	assert.Equal(t, first.ExternalTweet.QuotedTweet.ID, quote.ExternalTweet.ID)
	admin := context.WithValue(ctx, middleware.UserIsRootKey, true)
	require.NoError(t, service.WithdrawExternal(admin, quote.ExternalTweet.ID))
	views, err := external.GetMany(ctx, []shared.ID{shared.MustParseID(first.ExternalTweet.ID)})
	require.NoError(t, err)
	require.NotNil(t, views[first.ExternalTweet.ID].Snapshot)
	assert.Nil(t, views[first.ExternalTweet.ID].QuotedTweet.Snapshot)
	assert.Nil(t, views[first.ExternalTweet.ID].QuotedTweet.QuotedTweet)
}
